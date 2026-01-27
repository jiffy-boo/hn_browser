// Content script - replaces HN UI with custom interface

// State management
const state = {
  stories: [],
  filteredStories: [],
  selectedStoryIndex: 0,
  selectedStory: null,
  readStories: new Set(),
  filters: {
    minPoints: 0,
    minComments: 0,
    timeRange: 'all' // 'day', '3days', '7days', 'all'
  },
  keyboardHelpVisible: false
};

// Initialize the extension
async function init() {
  // Load read stories from storage
  const { readStories = [] } = await chrome.storage.local.get('readStories');
  state.readStories = new Set(readStories);

  // Replace the entire page with our custom UI
  document.body.innerHTML = '';
  document.body.appendChild(createMainUI());

  // Load stories
  await loadStories();

  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
}

// Create the main UI structure
function createMainUI() {
  const container = document.createElement('div');
  container.id = 'hn-inbox-container';
  container.innerHTML = `
    <div id="hn-inbox">
      <div id="sidebar">
        <div id="filters-panel">
          <h2>Filters</h2>
          <div class="filter-group">
            <label>Min Points: <span id="points-value">0</span></label>
            <input type="range" id="points-filter" min="0" max="500" step="10" value="0">
          </div>
          <div class="filter-group">
            <label>Min Comments: <span id="comments-value">0</span></label>
            <input type="range" id="comments-filter" min="0" max="200" step="5" value="0">
          </div>
          <div class="filter-group">
            <label>Time Range:</label>
            <select id="time-filter">
              <option value="all">All time</option>
              <option value="day">Last 24 hours</option>
              <option value="3days">Last 3 days</option>
              <option value="7days">Last 7 days</option>
            </select>
          </div>
          <div class="filter-stats">
            <span id="story-count">0</span> stories
          </div>
        </div>
        <div id="story-list">
          <div class="loading">Loading stories...</div>
        </div>
      </div>
      <div id="main-panel">
        <div id="story-detail">
          <div class="empty-state">
            <h2>Welcome to HN Inbox</h2>
            <p>Select a story from the sidebar or use <kbd>j</kbd>/<kbd>k</kbd> to navigate</p>
            <p>Press <kbd>?</kbd> for keyboard shortcuts</p>
          </div>
        </div>
      </div>
    </div>
    <div id="keyboard-help" class="hidden">
      <div class="help-content">
        <h2>Keyboard Shortcuts</h2>
        <div class="shortcut-list">
          <div class="shortcut"><kbd>j</kbd> Navigate down</div>
          <div class="shortcut"><kbd>k</kbd> Navigate up</div>
          <div class="shortcut"><kbd>Enter</kbd> Open selected story</div>
          <div class="shortcut"><kbd>o</kbd> Open article in new tab</div>
          <div class="shortcut"><kbd>e</kbd> Mark as read</div>
          <div class="shortcut"><kbd>r</kbd> Refresh story list</div>
          <div class="shortcut"><kbd>?</kbd> Toggle this help</div>
          <div class="shortcut"><kbd>Esc</kbd> Close help</div>
        </div>
        <p class="help-footer">Click anywhere to close</p>
      </div>
    </div>
  `;

  // Set up filter event listeners
  setTimeout(() => {
    document.getElementById('points-filter').addEventListener('input', (e) => {
      state.filters.minPoints = parseInt(e.target.value);
      document.getElementById('points-value').textContent = e.target.value;
      applyFilters();
    });

    document.getElementById('comments-filter').addEventListener('input', (e) => {
      state.filters.minComments = parseInt(e.target.value);
      document.getElementById('comments-value').textContent = e.target.value;
      applyFilters();
    });

    document.getElementById('time-filter').addEventListener('change', (e) => {
      state.filters.timeRange = e.target.value;
      applyFilters();
    });

    // Keyboard help overlay click to close
    document.getElementById('keyboard-help').addEventListener('click', () => {
      toggleKeyboardHelp();
    });
  }, 0);

  return container;
}

// Load stories from HN API
async function loadStories() {
  const storyListEl = document.getElementById('story-list');
  storyListEl.innerHTML = '<div class="loading">Loading stories...</div>';

  const response = await chrome.runtime.sendMessage({ action: 'fetchTopStories' });

  if (!response.success) {
    storyListEl.innerHTML = '<div class="error">Failed to load stories</div>';
    return;
  }

  // Fetch story details for each ID
  const storyPromises = response.storyIds.map(id =>
    chrome.runtime.sendMessage({ action: 'fetchStory', storyId: id })
  );

  const storyResults = await Promise.all(storyPromises);
  state.stories = storyResults
    .filter(r => r.success && r.story && r.story.type === 'story')
    .map(r => r.story);

  applyFilters();
}

// Apply filters and update the story list
function applyFilters() {
  const now = Date.now() / 1000; // Current time in seconds
  const timeRanges = {
    'day': 24 * 60 * 60,
    '3days': 3 * 24 * 60 * 60,
    '7days': 7 * 24 * 60 * 60,
    'all': Infinity
  };

  state.filteredStories = state.stories.filter(story => {
    // Points filter
    if (story.score < state.filters.minPoints) return false;

    // Comments filter
    const commentCount = story.descendants || 0;
    if (commentCount < state.filters.minComments) return false;

    // Time filter
    const timeRange = timeRanges[state.filters.timeRange];
    if (now - story.time > timeRange) return false;

    return true;
  });

  // Reset selection if current selection is out of range
  if (state.selectedStoryIndex >= state.filteredStories.length) {
    state.selectedStoryIndex = 0;
  }

  renderStoryList();
  updateStoryCount();
}

// Render the story list in the sidebar
function renderStoryList() {
  const storyListEl = document.getElementById('story-list');

  if (state.filteredStories.length === 0) {
    storyListEl.innerHTML = '<div class="empty">No stories match your filters</div>';
    return;
  }

  storyListEl.innerHTML = '';

  state.filteredStories.forEach((story, index) => {
    const storyEl = document.createElement('div');
    storyEl.className = 'story-item';
    if (index === state.selectedStoryIndex) {
      storyEl.classList.add('selected');
    }
    if (state.readStories.has(story.id)) {
      storyEl.classList.add('read');
    }

    const domain = story.url ? new URL(story.url).hostname.replace('www.', '') : 'news.ycombinator.com';
    const commentCount = story.descendants || 0;

    storyEl.innerHTML = `
      <div class="story-title">${escapeHtml(story.title)}</div>
      <div class="story-meta">
        <span class="points">${story.score} points</span>
        <span class="comments">${commentCount} comments</span>
        <span class="domain">${escapeHtml(domain)}</span>
      </div>
    `;

    storyEl.addEventListener('click', () => {
      selectStory(index);
    });

    storyListEl.appendChild(storyEl);
  });
}

// Update story count display
function updateStoryCount() {
  document.getElementById('story-count').textContent = state.filteredStories.length;
}

// Select a story and display it in the main panel
function selectStory(index) {
  if (index < 0 || index >= state.filteredStories.length) return;

  state.selectedStoryIndex = index;
  state.selectedStory = state.filteredStories[index];

  // Update visual selection in sidebar
  document.querySelectorAll('.story-item').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });

  // Load story details in main panel
  renderStoryDetail();
}

// Render story details in the main panel
async function renderStoryDetail() {
  const story = state.selectedStory;
  if (!story) return;

  const mainPanel = document.getElementById('story-detail');
  mainPanel.innerHTML = '<div class="loading">Loading story details...</div>';

  const domain = story.url ? new URL(story.url).hostname.replace('www.', '') : 'news.ycombinator.com';
  const timeAgo = formatTimeAgo(story.time);
  const commentCount = story.descendants || 0;

  let html = `
    <div class="story-header">
      <h1>${escapeHtml(story.title)}</h1>
      <div class="story-metadata">
        <span class="points">${story.score} points</span>
        <span class="author">by ${escapeHtml(story.by)}</span>
        <span class="time">${timeAgo}</span>
        <span class="domain">${escapeHtml(domain)}</span>
      </div>
      ${story.url ? `<button id="open-article-btn" class="primary-btn">Open Article</button>` : ''}
    </div>

    <div class="summary-section">
      <h2>AI Summary</h2>
      <div id="summary-content" class="summary-loading">
        <div class="loading">Generating AI summary...</div>
      </div>
    </div>

    <div class="comments-section">
      <h2>Comments (${commentCount})</h2>
      <div id="comments-tree" class="loading">Loading comments...</div>
    </div>
  `;

  mainPanel.innerHTML = html;

  // Set up button listeners
  const openBtn = document.getElementById('open-article-btn');
  if (openBtn) {
    openBtn.addEventListener('click', () => openArticle());
  }

  // Load comments and build tree structure
  let commentsData = [];
  if (story.kids && story.kids.length > 0) {
    commentsData = await fetchCommentTree(story.kids);
    await renderComments(story.kids);
  } else {
    document.getElementById('comments-tree').innerHTML = '<div class="empty">No comments yet</div>';
  }

  // Generate AI summary (runs in parallel with comment rendering)
  generateAndDisplaySummary(story, commentsData);
}

// Fetch comment tree as data structure (for AI summary)
async function fetchCommentTree(commentIds) {
  const comments = [];

  for (const commentId of commentIds) {
    const comment = await fetchCommentData(commentId);
    if (comment) {
      comments.push(comment);
    }
  }

  return comments;
}

// Recursively fetch comment data
async function fetchCommentData(commentId) {
  const response = await chrome.runtime.sendMessage({ action: 'fetchComment', commentId });

  if (!response.success || !response.comment || response.comment.deleted || response.comment.dead) {
    return null;
  }

  const comment = response.comment;

  // Fetch replies recursively
  const replies = [];
  if (comment.kids && comment.kids.length > 0) {
    for (const replyId of comment.kids) {
      const reply = await fetchCommentData(replyId);
      if (reply) {
        replies.push(reply);
      }
    }
  }

  return {
    id: comment.id,
    by: comment.by,
    text: comment.text,
    time: comment.time,
    replies
  };
}

// Generate and display AI summary
async function generateAndDisplaySummary(story, comments) {
  const summaryEl = document.getElementById('summary-content');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateSummary',
      story,
      comments
    });

    if (!response.success) {
      summaryEl.innerHTML = `<div class="error-message">${escapeHtml(response.error)}</div>`;
      return;
    }

    const summary = response.summary;
    displaySummary(summary);
  } catch (error) {
    summaryEl.innerHTML = `<div class="error-message">Failed to generate summary: ${escapeHtml(error.message)}</div>`;
  }
}

// Display the AI-generated summary
function displaySummary(summary) {
  const summaryEl = document.getElementById('summary-content');

  let interestingCommentsHtml = '';
  if (summary.interestingComments && summary.interestingComments.length > 0) {
    interestingCommentsHtml = `
      <div class="interesting-comments">
        <strong>Interesting Comments:</strong>
        <ul>
          ${summary.interestingComments.map(comment => `
            <li>
              <a href="#" class="comment-link" data-author="${escapeHtml(comment.author)}">
                ${escapeHtml(comment.author)}
              </a>: ${escapeHtml(comment.reason)}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  summaryEl.innerHTML = `
    <div class="summary-content">
      <p><strong>Article Summary:</strong> ${escapeHtml(summary.articleSummary)}</p>
      <p><strong>Discussion Summary:</strong> ${escapeHtml(summary.discussionSummary)}</p>
      ${interestingCommentsHtml}
    </div>
  `;

  // Add click handlers for interesting comments
  summaryEl.querySelectorAll('.comment-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const author = e.target.dataset.author;
      scrollToComment(author);
    });
  });
}

// Scroll to and highlight a comment by author
function scrollToComment(author) {
  // Find comment by author
  const commentElements = document.querySelectorAll('.comment');

  for (const commentEl of commentElements) {
    const authorEl = commentEl.querySelector('.comment-author');
    if (authorEl && authorEl.textContent === author) {
      // Scroll to comment
      commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight temporarily
      commentEl.classList.add('highlighted');
      setTimeout(() => {
        commentEl.classList.remove('highlighted');
      }, 3000);

      break;
    }
  }
}

// Render comment tree
async function renderComments(commentIds) {
  const commentsTree = document.getElementById('comments-tree');
  commentsTree.innerHTML = '';

  for (const commentId of commentIds) {
    const commentEl = await renderComment(commentId, 0);
    if (commentEl) {
      commentsTree.appendChild(commentEl);
    }
  }
}

// Render individual comment with nesting
async function renderComment(commentId, depth) {
  const response = await chrome.runtime.sendMessage({ action: 'fetchComment', commentId });

  if (!response.success || !response.comment || response.comment.deleted || response.comment.dead) {
    return null;
  }

  const comment = response.comment;
  const commentEl = document.createElement('div');
  commentEl.className = 'comment';
  commentEl.style.marginLeft = `${depth * 20}px`;
  commentEl.dataset.commentId = commentId;

  const timeAgo = formatTimeAgo(comment.time);

  commentEl.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${escapeHtml(comment.by)}</span>
      <span class="comment-time">${timeAgo}</span>
      <button class="collapse-btn" aria-label="Collapse thread">[-]</button>
    </div>
    <div class="comment-text">${comment.text || ''}</div>
    <div class="comment-replies"></div>
  `;

  // Collapse/expand functionality
  const collapseBtn = commentEl.querySelector('.collapse-btn');
  const commentText = commentEl.querySelector('.comment-text');
  const commentReplies = commentEl.querySelector('.comment-replies');

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = commentEl.classList.toggle('collapsed');
    collapseBtn.textContent = isCollapsed ? '[+]' : '[-]';
    commentText.style.display = isCollapsed ? 'none' : 'block';
    commentReplies.style.display = isCollapsed ? 'none' : 'block';
  });

  // Render replies
  if (comment.kids && comment.kids.length > 0) {
    for (const replyId of comment.kids) {
      const replyEl = await renderComment(replyId, depth + 1);
      if (replyEl) {
        commentReplies.appendChild(replyEl);
      }
    }
  }

  return commentEl;
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Escape key - close keyboard help
    if (e.key === 'Escape' && state.keyboardHelpVisible) {
      toggleKeyboardHelp();
      return;
    }

    // Question mark - toggle help
    if (e.key === '?') {
      e.preventDefault();
      toggleKeyboardHelp();
      return;
    }

    // If help is visible, don't process other shortcuts
    if (state.keyboardHelpVisible) return;

    switch (e.key) {
      case 'j':
        e.preventDefault();
        navigateDown();
        break;
      case 'k':
        e.preventDefault();
        navigateUp();
        break;
      case 'Enter':
        e.preventDefault();
        selectStory(state.selectedStoryIndex);
        break;
      case 'o':
        e.preventDefault();
        openArticle();
        break;
      case 'e':
        e.preventDefault();
        markAsRead();
        break;
      case 'r':
        e.preventDefault();
        refreshStories();
        break;
    }
  });
}

// Navigation functions
function navigateDown() {
  if (state.selectedStoryIndex < state.filteredStories.length - 1) {
    selectStory(state.selectedStoryIndex + 1);
    scrollToSelectedStory();
  }
}

function navigateUp() {
  if (state.selectedStoryIndex > 0) {
    selectStory(state.selectedStoryIndex - 1);
    scrollToSelectedStory();
  }
}

function scrollToSelectedStory() {
  const selectedEl = document.querySelector('.story-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function openArticle() {
  if (state.selectedStory && state.selectedStory.url) {
    window.open(state.selectedStory.url, '_blank');
  }
}

function markAsRead() {
  if (state.selectedStory) {
    state.readStories.add(state.selectedStory.id);

    // Update visual state
    const selectedEl = document.querySelector('.story-item.selected');
    if (selectedEl) {
      selectedEl.classList.add('read');
    }

    // Save to storage
    chrome.storage.local.set({
      readStories: Array.from(state.readStories)
    });
  }
}

function refreshStories() {
  loadStories();
}

function toggleKeyboardHelp() {
  state.keyboardHelpVisible = !state.keyboardHelpVisible;
  const helpEl = document.getElementById('keyboard-help');
  helpEl.classList.toggle('hidden');
}

// Utility functions
function formatTimeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
