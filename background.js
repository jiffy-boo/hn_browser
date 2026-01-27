// Background service worker for API calls

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const JINA_READER_BASE = 'https://r.jina.ai';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchStory') {
    fetchStory(request.storyId).then(sendResponse);
    return true; // Will respond asynchronously
  }

  if (request.action === 'fetchComment') {
    fetchComment(request.commentId).then(sendResponse);
    return true;
  }

  if (request.action === 'fetchTopStories') {
    fetchTopStories().then(sendResponse);
    return true;
  }

  if (request.action === 'fetchArticleContent') {
    fetchArticleContent(request.url).then(sendResponse);
    return true;
  }

  if (request.action === 'generateSummary') {
    generateSummary(request.story, request.comments).then(sendResponse);
    return true;
  }
});

// Fetch top story IDs from HN API
async function fetchTopStories() {
  try {
    const response = await fetch(`${HN_API_BASE}/topstories.json`);
    const storyIds = await response.json();
    return { success: true, storyIds: storyIds.slice(0, 100) }; // Get top 100
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Fetch individual story data
async function fetchStory(storyId) {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${storyId}.json`);
    const story = await response.json();
    return { success: true, story };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Fetch individual comment data
async function fetchComment(commentId) {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${commentId}.json`);
    const comment = await response.json();
    return { success: true, comment };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Fetch article content using Jina AI Reader
async function fetchArticleContent(url) {
  try {
    const response = await fetch(`${JINA_READER_BASE}/${url}`);
    const content = await response.text();
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Generate AI summary using Claude API
async function generateSummary(story, comments) {
  try {
    // Check cache first
    const { summaryCache = {} } = await chrome.storage.local.get('summaryCache');
    if (summaryCache[story.id]) {
      return { success: true, summary: summaryCache[story.id] };
    }

    // Get API key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      return { success: false, error: 'No API key configured. Click the extension icon to add your Claude API key.' };
    }

    // Fetch article content if URL exists
    let articleContent = '';
    if (story.url) {
      const articleResult = await fetchArticleContent(story.url);
      if (articleResult.success) {
        articleContent = articleResult.content;
      }
    }

    // Prepare comments text (flatten the comment tree)
    const commentsText = flattenComments(comments).join('\n\n---\n\n');

    // Call Claude API
    const summary = await callClaudeAPI(apiKey, story, articleContent, commentsText);

    // Cache the result
    summaryCache[story.id] = summary;
    await chrome.storage.local.set({ summaryCache });

    return { success: true, summary };
  } catch (error) {
    console.error('Summary generation error:', error);
    return { success: false, error: error.message };
  }
}

// Call Claude API to generate summary
async function callClaudeAPI(apiKey, story, articleContent, commentsText) {
  const prompt = buildSummaryPrompt(story, articleContent, commentsText);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API request failed');
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  // Parse the response to extract structured summary
  return parseSummaryResponse(responseText);
}

// Build prompt for Claude
function buildSummaryPrompt(story, articleContent, commentsText) {
  const hasArticle = articleContent && articleContent.length > 100;

  return `You are helping summarize a Hacker News discussion. Please provide a structured summary in the following JSON format:

{
  "articleSummary": "2-3 sentence summary of the article content",
  "discussionSummary": "2-3 sentence summary of the overall discussion themes",
  "interestingComments": [
    {
      "author": "username",
      "snippet": "First ~100 chars of the comment",
      "reason": "One sentence explaining why this comment is interesting"
    }
  ]
}

Story Title: ${story.title}
${story.url ? `Article URL: ${story.url}` : 'No article URL (Ask HN, Show HN, or discussion)'}

${hasArticle ? `ARTICLE CONTENT:\n${articleContent.slice(0, 15000)}\n\n` : ''}

HACKER NEWS DISCUSSION (${story.descendants || 0} comments):
${commentsText.slice(0, 20000)}

Please analyze this and provide:
1. A 2-3 sentence summary of ${hasArticle ? 'the article content' : 'the discussion topic'}
2. A 2-3 sentence summary of the main themes in the HN discussion
3. 3-5 interesting/insightful comments with author names and reasons why they're noteworthy (look for: novel insights, expert perspectives, counterarguments, useful resources, or entertaining observations)

Return ONLY the JSON object, no other text.`;
}

// Parse Claude's response
function parseSummaryResponse(responseText) {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (e) {
    // If not valid JSON, try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Fallback: return a basic structure
    return {
      articleSummary: responseText.split('\n')[0] || 'Summary generation failed',
      discussionSummary: 'Unable to parse discussion summary',
      interestingComments: []
    };
  }
}

// Flatten comment tree for processing
function flattenComments(comments, depth = 0) {
  if (!comments || comments.length === 0) return [];

  const flattened = [];
  const maxDepth = 3; // Only include top 3 levels to avoid token limits

  for (const comment of comments) {
    if (!comment || comment.deleted || comment.dead) continue;

    // Add comment text with author
    const indent = '  '.repeat(depth);
    flattened.push(`${indent}[${comment.by}]: ${stripHtml(comment.text || '')}`);

    // Recursively add replies (but limit depth)
    if (depth < maxDepth && comment.replies && comment.replies.length > 0) {
      flattened.push(...flattenComments(comment.replies, depth + 1));
    }
  }

  return flattened;
}

// Strip HTML tags from comment text
function stripHtml(html) {
  return html
    .replace(/<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Storage helpers
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    readStories: [],
    summaryCache: {},
    apiKey: ''
  });
});
