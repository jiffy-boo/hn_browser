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
    timeRange: 'day' // 'day', '3days', '7days', 'all' - default to 24 hours
  },
  keyboardHelpVisible: false,
  filtersCollapsed: false,
  commentCache: {}, // Cache comments by story ID
  summaryCache: {}, // Cache summaries by story ID (local copy for quick access)
  summaryStatus: {} // Track summary loading status: 'loading', 'ready', or null
};

// Initialize the extension
async function init() {
  // Load read stories, filter settings, and UI state from storage
  const {
    readStories = [],
    filterSettings = {},
    filtersCollapsed = false,
    commentCache = {},
    summaryCache = {}
  } = await chrome.storage.local.get(['readStories', 'filterSettings', 'filtersCollapsed', 'commentCache', 'summaryCache']);

  state.readStories = new Set(readStories);
  state.filtersCollapsed = filtersCollapsed;
  state.commentCache = commentCache;
  state.summaryCache = summaryCache;

  // Load saved filter settings
  if (filterSettings.minPoints !== undefined) state.filters.minPoints = filterSettings.minPoints;
  if (filterSettings.minComments !== undefined) state.filters.minComments = filterSettings.minComments;
  if (filterSettings.timeRange !== undefined) state.filters.timeRange = filterSettings.timeRange;

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
        <div id="filters-panel" class="${state.filtersCollapsed ? 'collapsed' : ''}">
          <div class="filters-header">
            <h2>Filters</h2>
            <button id="toggle-filters" class="toggle-btn" aria-label="Toggle filters">
              ${state.filtersCollapsed ? '▼' : '▲'}
            </button>
          </div>
          <div id="filters-content" style="display: ${state.filtersCollapsed ? 'none' : 'block'}">
            <div class="filter-group">
              <label for="points-filter">Min Points:</label>
              <input type="number" id="points-filter" min="0" max="9999" value="${state.filters.minPoints}" placeholder="0">
            </div>
            <div class="filter-group">
              <label for="comments-filter">Min Comments:</label>
              <input type="number" id="comments-filter" min="0" max="9999" value="${state.filters.minComments}" placeholder="0">
            </div>
            <div class="filter-group">
              <label for="time-filter">Time Range:</label>
              <select id="time-filter">
                <option value="all" ${state.filters.timeRange === 'all' ? 'selected' : ''}>All time</option>
                <option value="day" ${state.filters.timeRange === 'day' ? 'selected' : ''}>Last 24 hours</option>
                <option value="3days" ${state.filters.timeRange === '3days' ? 'selected' : ''}>Last 3 days</option>
                <option value="7days" ${state.filters.timeRange === '7days' ? 'selected' : ''}>Last 7 days</option>
              </select>
            </div>
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
    // Toggle filters collapse
    document.getElementById('toggle-filters').addEventListener('click', () => {
      toggleFilters();
    });

    document.getElementById('points-filter').addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      state.filters.minPoints = value;
      saveFilterSettings();
      applyFilters();
    });

    document.getElementById('comments-filter').addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      state.filters.minComments = value;
      saveFilterSettings();
      applyFilters();
    });

    document.getElementById('time-filter').addEventListener('change', (e) => {
      state.filters.timeRange = e.target.value;
      saveFilterSettings();
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

// Toggle filters collapse/expand
function toggleFilters() {
  state.filtersCollapsed = !state.filtersCollapsed;

  const filtersPanel = document.getElementById('filters-panel');
  const filtersContent = document.getElementById('filters-content');
  const toggleBtn = document.getElementById('toggle-filters');

  filtersPanel.classList.toggle('collapsed');
  filtersContent.style.display = state.filtersCollapsed ? 'none' : 'block';
  toggleBtn.textContent = state.filtersCollapsed ? '▼' : '▲';

  // Save collapsed state
  chrome.storage.local.set({ filtersCollapsed: state.filtersCollapsed });
}

// Save filter settings to Chrome storage
function saveFilterSettings() {
  chrome.storage.local.set({
    filterSettings: {
      minPoints: state.filters.minPoints,
      minComments: state.filters.minComments,
      timeRange: state.filters.timeRange
    }
  });
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

    // Get summary status
    const summaryStatus = state.summaryStatus[story.id];
    let statusIcon = '';
    if (summaryStatus === 'loading') {
      statusIcon = '<span class="summary-status loading" title="Generating summary...">⟳</span>';
    } else if (summaryStatus === 'ready') {
      statusIcon = '<span class="summary-status ready" title="Summary ready">✓</span>';
    }

    storyEl.innerHTML = `
      <div class="story-title">${escapeHtml(story.title)}</div>
      <div class="story-meta">
        <span class="points">${story.score} points</span>
        <span class="comments">${commentCount} comments</span>
        <span class="domain">${escapeHtml(domain)}</span>
        ${statusIcon}
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

// Update summary status indicator for a specific story
function updateSummaryStatus(storyId, status) {
  state.summaryStatus[storyId] = status;

  // Find and update the story item in the sidebar
  const storyIndex = state.filteredStories.findIndex(s => s.id === storyId);
  if (storyIndex === -1) return;

  const storyItems = document.querySelectorAll('.story-item');
  const storyEl = storyItems[storyIndex];
  if (!storyEl) return;

  // Remove existing status icon
  const existingStatus = storyEl.querySelector('.summary-status');
  if (existingStatus) {
    existingStatus.remove();
  }

  // Add new status icon
  const metaEl = storyEl.querySelector('.story-meta');
  if (metaEl && status) {
    let statusIcon = '';
    if (status === 'loading') {
      statusIcon = '<span class="summary-status loading" title="Generating summary...">⟳</span>';
    } else if (status === 'ready') {
      statusIcon = '<span class="summary-status ready" title="Summary ready">✓</span>';
    }
    metaEl.insertAdjacentHTML('beforeend', statusIcon);
  }
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

  // Check if we have cached comments
  const cachedComments = state.commentCache[story.id];

  let commentsData = [];
  if (cachedComments) {
    // Use cached comments - instant load!
    console.log(`[HN Inbox] Using cached comments for story ${story.id}`);
    commentsData = cachedComments.data;
    document.getElementById('comments-tree').innerHTML = cachedComments.html;

    // Re-attach event listeners for collapse buttons
    reattachCommentListeners();
  } else if (story.kids && story.kids.length > 0) {
    // Fetch comments ONCE (with parallel loading)
    console.log(`[HN Inbox] Fetching ${story.kids.length} comments in parallel...`);
    const startTime = performance.now();

    commentsData = await fetchCommentTree(story.kids);

    const fetchTime = performance.now() - startTime;
    console.log(`[HN Inbox] Fetched comments in ${(fetchTime / 1000).toFixed(2)}s`);

    // Render from the fetched data (no duplicate fetching!)
    renderCommentsFromData(commentsData);

    // Cache the comments (both data and rendered HTML)
    cacheComments(story.id, commentsData, document.getElementById('comments-tree').innerHTML);
  } else {
    document.getElementById('comments-tree').innerHTML = '<div class="empty">No comments yet</div>';
  }

  // Check if we have cached summary
  const cachedSummary = state.summaryCache[story.id];
  if (cachedSummary) {
    console.log(`[HN Inbox] Using cached summary for story ${story.id}`);
    displayPartialSummary(cachedSummary, false);
    updateSummaryStatus(story.id, 'ready');
  } else {
    // Generate AI summary with progressive loading
    generateAndDisplaySummary(story, commentsData);
  }

  // Preload next story's comments AND summary in background
  preloadNextStory();
}

// Fetch comment tree as data structure (for AI summary and rendering)
// OPTIMIZED: Fetches all comments at each level in parallel
async function fetchCommentTree(commentIds) {
  // Fetch all top-level comments in parallel
  const commentPromises = commentIds.map(id => fetchCommentData(id));
  const comments = await Promise.all(commentPromises);

  // Filter out null results (deleted/dead comments)
  return comments.filter(c => c !== null);
}

// Recursively fetch comment data with parallel loading
async function fetchCommentData(commentId) {
  const response = await chrome.runtime.sendMessage({ action: 'fetchComment', commentId });

  if (!response.success || !response.comment || response.comment.deleted || response.comment.dead) {
    return null;
  }

  const comment = response.comment;

  // Fetch all replies in parallel (not sequentially!)
  let replies = [];
  if (comment.kids && comment.kids.length > 0) {
    const replyPromises = comment.kids.map(replyId => fetchCommentData(replyId));
    const allReplies = await Promise.all(replyPromises);
    replies = allReplies.filter(r => r !== null);
  }

  return {
    id: comment.id,
    by: comment.by,
    text: comment.text,
    time: comment.time,
    replies
  };
}

// Generate and display AI summary (with progressive loading)
async function generateAndDisplaySummary(story, comments) {
  const summaryEl = document.getElementById('summary-content');

  // Mark as loading
  updateSummaryStatus(story.id, 'loading');

  try {
    // Step 1: Generate discussion summary first (faster, no article fetch needed)
    console.log(`[HN Inbox] Generating discussion summary for story ${story.id}...`);
    const discussionResponse = await chrome.runtime.sendMessage({
      action: 'generateDiscussionSummary',
      story,
      comments
    });

    if (!discussionResponse.success) {
      summaryEl.innerHTML = `<div class="error-message">${escapeHtml(discussionResponse.error)}</div>`;
      updateSummaryStatus(story.id, null);
      return;
    }

    // Display discussion summary immediately
    displayPartialSummary(discussionResponse.summary, true);

    // Step 2: Generate article summary in parallel (if URL exists)
    if (story.url) {
      console.log(`[HN Inbox] Generating article summary for story ${story.id}...`);
      const articleResponse = await chrome.runtime.sendMessage({
        action: 'generateArticleSummary',
        story
      });

      if (articleResponse.success) {
        // Combine and display full summary
        const fullSummary = {
          ...discussionResponse.summary,
          articleSummary: articleResponse.summary.articleSummary
        };

        displayPartialSummary(fullSummary, false);

        // Cache the full summary
        state.summaryCache[story.id] = fullSummary;
        chrome.storage.local.get('summaryCache', (data) => {
          const cache = data.summaryCache || {};
          cache[story.id] = fullSummary;
          chrome.storage.local.set({ summaryCache: cache });
        });
      } else {
        // Cache discussion-only summary
        state.summaryCache[story.id] = discussionResponse.summary;
      }
    } else {
      // No article URL, just cache discussion summary
      state.summaryCache[story.id] = discussionResponse.summary;
    }

    // Mark as ready
    updateSummaryStatus(story.id, 'ready');

  } catch (error) {
    summaryEl.innerHTML = `<div class="error-message">Failed to generate summary: ${escapeHtml(error.message)}</div>`;
    updateSummaryStatus(story.id, null);
  }
}

// Display partial or full summary (progressive loading)
function displayPartialSummary(summary, isPartial) {
  const summaryEl = document.getElementById('summary-content');

  let articleSummaryHtml = '';
  if (summary.articleSummary) {
    articleSummaryHtml = `<p><strong>Article Summary:</strong> ${escapeHtml(summary.articleSummary)}</p>`;
  } else if (isPartial) {
    articleSummaryHtml = `<p><strong>Article Summary:</strong> <span class="loading-text">Loading...</span></p>`;
  }

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
      ${articleSummaryHtml}
      <p><strong>Discussion Summary:</strong> ${escapeHtml(summary.discussionSummary)}</p>
      ${interestingCommentsHtml}
    </div>
  `;

  // Re-attach click handlers for interesting comments
  summaryEl.querySelectorAll('.comment-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const author = e.target.dataset.author;
      scrollToComment(author);
    });
  });
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

// Render comment tree from already-fetched data (NO API CALLS)
// This eliminates duplicate fetching!
function renderCommentsFromData(commentsData) {
  const commentsTree = document.getElementById('comments-tree');
  commentsTree.innerHTML = '';

  for (const commentData of commentsData) {
    const commentEl = renderCommentFromData(commentData, 0);
    if (commentEl) {
      commentsTree.appendChild(commentEl);
    }
  }
}

// Render individual comment from data (NO API CALLS)
function renderCommentFromData(commentData, depth) {
  if (!commentData) return null;

  const commentEl = document.createElement('div');
  commentEl.className = 'comment';
  commentEl.style.marginLeft = `${depth * 20}px`;
  commentEl.dataset.commentId = commentData.id;

  const timeAgo = formatTimeAgo(commentData.time);

  commentEl.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${escapeHtml(commentData.by)}</span>
      <span class="comment-time">${timeAgo}</span>
      <button class="collapse-btn" aria-label="Collapse thread">[-]</button>
    </div>
    <div class="comment-text">${commentData.text || ''}</div>
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

  // Render replies from data (recursively)
  if (commentData.replies && commentData.replies.length > 0) {
    for (const replyData of commentData.replies) {
      const replyEl = renderCommentFromData(replyData, depth + 1);
      if (replyEl) {
        commentReplies.appendChild(replyEl);
      }
    }
  }

  return commentEl;
}

// OLD FUNCTION - kept for backward compatibility with preloading
// Render comment tree (legacy - fetches from API)
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

// Cache comments for a story
function cacheComments(storyId, commentsData, commentsHtml) {
  state.commentCache[storyId] = {
    data: commentsData,
    html: commentsHtml
  };

  // Also save to Chrome storage
  chrome.storage.local.get('commentCache', (data) => {
    const cache = data.commentCache || {};
    cache[storyId] = {
      data: commentsData,
      html: commentsHtml,
      timestamp: Date.now()
    };
    chrome.storage.local.set({ commentCache: cache });
  });
}

// Re-attach event listeners to cached comment elements
function reattachCommentListeners() {
  document.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentEl = btn.closest('.comment');
      const commentText = commentEl.querySelector('.comment-text');
      const commentReplies = commentEl.querySelector('.comment-replies');

      const isCollapsed = commentEl.classList.toggle('collapsed');
      btn.textContent = isCollapsed ? '[+]' : '[-]';
      commentText.style.display = isCollapsed ? 'none' : 'block';
      commentReplies.style.display = isCollapsed ? 'none' : 'block';
    });
  });
}

// Preload comments AND summary for next story (OPTIMIZED)
async function preloadNextStory() {
  const nextIndex = state.selectedStoryIndex + 1;
  if (nextIndex >= state.filteredStories.length) return;

  const nextStory = state.filteredStories[nextIndex];

  // Preload comments if not cached
  let commentsData = [];
  if (!state.commentCache[nextStory.id] && nextStory.kids && nextStory.kids.length > 0) {
    console.log(`[HN Inbox] Preloading ${nextStory.kids.length} comments for story ${nextStory.id} in background...`);

    const startTime = performance.now();

    // Fetch comments ONCE with parallel loading
    commentsData = await fetchCommentTree(nextStory.kids);

    // Render from data (no duplicate fetching!)
    const tempContainer = document.createElement('div');
    for (const commentData of commentsData) {
      const commentEl = renderCommentFromData(commentData, 0);
      if (commentEl) {
        tempContainer.appendChild(commentEl);
      }
    }

    // Cache the preloaded comments
    cacheComments(nextStory.id, commentsData, tempContainer.innerHTML);

    const loadTime = performance.now() - startTime;
    console.log(`[HN Inbox] Preloaded comments for story ${nextStory.id} in ${(loadTime / 1000).toFixed(2)}s`);
  } else if (state.commentCache[nextStory.id]) {
    // Use cached comments data
    commentsData = state.commentCache[nextStory.id].data;
  }

  // Preload summary if not cached
  if (!state.summaryCache[nextStory.id] && commentsData.length > 0) {
    console.log(`[HN Inbox] Preloading summary for story ${nextStory.id} in background...`);
    updateSummaryStatus(nextStory.id, 'loading');

    try {
      // Generate discussion summary first
      const discussionResponse = await chrome.runtime.sendMessage({
        action: 'generateDiscussionSummary',
        story: nextStory,
        comments: commentsData
      });

      if (discussionResponse.success) {
        let fullSummary = discussionResponse.summary;

        // Generate article summary if URL exists
        if (nextStory.url) {
          const articleResponse = await chrome.runtime.sendMessage({
            action: 'generateArticleSummary',
            story: nextStory
          });

          if (articleResponse.success) {
            fullSummary = {
              ...discussionResponse.summary,
              articleSummary: articleResponse.summary.articleSummary
            };
          }
        }

        // Cache the summary
        state.summaryCache[nextStory.id] = fullSummary;
        chrome.storage.local.get('summaryCache', (data) => {
          const cache = data.summaryCache || {};
          cache[nextStory.id] = fullSummary;
          chrome.storage.local.set({ summaryCache: cache });
        });

        updateSummaryStatus(nextStory.id, 'ready');
        console.log(`[HN Inbox] Preloaded summary for story ${nextStory.id}`);
      } else {
        updateSummaryStatus(nextStory.id, null);
      }
    } catch (error) {
      console.error(`[HN Inbox] Failed to preload summary for story ${nextStory.id}:`, error);
      updateSummaryStatus(nextStory.id, null);
    }
  }
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
