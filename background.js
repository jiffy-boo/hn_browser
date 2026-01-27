// Background service worker for API calls

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const JINA_READER_BASE = 'https://r.jina.ai';

// Import cost tracker
importScripts('cost-tracker.js');

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

  if (request.action === 'generateDiscussionSummary') {
    generateDiscussionSummary(request.story, request.comments).then(sendResponse);
    return true;
  }

  if (request.action === 'generateArticleSummary') {
    generateArticleSummary(request.story).then(sendResponse);
    return true;
  }

  if (request.action === 'getCostUsage') {
    costTracker.getCurrentUsage().then(sendResponse);
    return true;
  }

  if (request.action === 'resetCostUsage') {
    costTracker.resetUsage().then(sendResponse);
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

// Generate discussion summary only (faster, no article fetch)
async function generateDiscussionSummary(story, comments) {
  try {
    // Get API key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      return { success: false, error: 'No API key configured.' };
    }

    // Prepare comments text (limit to top 50 comments)
    const limitedComments = limitCommentsDepth(comments, 50);
    const commentsText = flattenComments(limitedComments).join('\n\n---\n\n');

    // Build discussion-only prompt
    const prompt = buildDiscussionPrompt(story, commentsText);

    // Call Claude API
    const { summary, usage } = await callClaudeAPISimple(apiKey, prompt);

    // Track usage and cost
    if (usage) {
      await costTracker.trackRequest(usage, 'discussion_summary', story.id);
    }

    return { success: true, summary };
  } catch (error) {
    console.error('Discussion summary error:', error);
    return { success: false, error: error.message };
  }
}

// Generate article summary only
async function generateArticleSummary(story) {
  try {
    // Get API key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      return { success: false, error: 'No API key configured.' };
    }

    // Fetch article content
    if (!story.url) {
      return { success: false, error: 'No article URL' };
    }

    const articleResult = await fetchArticleContent(story.url);
    if (!articleResult.success) {
      return { success: false, error: 'Failed to fetch article' };
    }

    // Build article-only prompt
    const prompt = buildArticlePrompt(story, articleResult.content);

    // Call Claude API
    const { summary, usage } = await callClaudeAPISimple(apiKey, prompt);

    // Track usage and cost
    if (usage) {
      await costTracker.trackRequest(usage, 'article_summary', story.id);
    }

    return { success: true, summary };
  } catch (error) {
    console.error('Article summary error:', error);
    return { success: false, error: error.message };
  }
}

// Call Claude API to generate summary
async function callClaudeAPI(apiKey, story, articleContent, commentsText) {
  console.log(`[HN Inbox] Generating summary for story: ${story.id} - ${story.title}`);

  const prompt = buildSummaryPrompt(story, articleContent, commentsText);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });
  } catch (fetchError) {
    console.error('[HN Inbox] Network error calling Claude API:', fetchError);
    throw new Error(`Network error: ${fetchError.message}. Check your internet connection and extension permissions.`);
  }

  console.log(`[HN Inbox] Claude API response status: ${response.status}`);

  if (!response.ok) {
    let errorMessage = `Claude API error (${response.status})`;
    try {
      const error = await response.json();
      errorMessage = error.error?.message || errorMessage;
      console.error('[HN Inbox] Claude API error details:', error);
    } catch (e) {
      console.error('[HN Inbox] Could not parse error response');
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  console.log('[HN Inbox] Summary generated successfully');

  // Track usage and cost
  if (data.usage) {
    await costTracker.trackRequest(data.usage, 'full_summary', story.id);
  }

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

${hasArticle ? `ARTICLE CONTENT:\n${articleContent.slice(0, 5000)}\n\n` : ''}

HACKER NEWS DISCUSSION (${story.descendants || 0} comments):
${commentsText.slice(0, 10000)}

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

// Limit comments to top N comments (for faster processing)
function limitCommentsDepth(comments, maxCount) {
  if (!comments || comments.length === 0) return [];

  let count = 0;
  const limited = [];

  function collectComments(commentList) {
    for (const comment of commentList) {
      if (count >= maxCount) break;
      if (!comment || comment.deleted || comment.dead) continue;

      limited.push(comment);
      count++;

      // Include immediate replies for context (but they don't count toward limit for top-level)
      if (comment.replies && comment.replies.length > 0 && count < maxCount) {
        collectComments(comment.replies);
      }
    }
  }

  collectComments(comments);
  return limited;
}

// Build prompt for discussion-only summary
function buildDiscussionPrompt(story, commentsText) {
  return `You are summarizing a Hacker News discussion. Return ONLY a JSON object in this format:

{
  "discussionSummary": "2-3 sentence summary of the main discussion themes",
  "interestingComments": [
    {
      "author": "username",
      "snippet": "First ~100 chars of comment",
      "reason": "One sentence why it's interesting"
    }
  ]
}

Story: ${story.title}
${story.url ? `URL: ${story.url}` : 'Discussion-only post'}

HN Comments (${story.descendants || 0} total):
${commentsText.slice(0, 10000)}

Provide:
1. 2-3 sentence summary of main discussion themes
2. 3-5 most interesting/insightful comments with reasons

Return ONLY the JSON, no other text.`;
}

// Build prompt for article-only summary
function buildArticlePrompt(story, articleContent) {
  return `Summarize this article in 2-3 sentences. Return ONLY a JSON object:

{
  "articleSummary": "2-3 sentence summary of the article"
}

Article Title: ${story.title}
Article URL: ${story.url}

Article Content:
${articleContent.slice(0, 5000)}

Return ONLY the JSON, no other text.`;
}

// Simplified Claude API call
async function callClaudeAPISimple(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
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

  // Return both the parsed summary and usage data for caller to track
  return {
    summary: parseSummaryResponse(responseText),
    usage: data.usage || null
  };
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

// Storage helpers - only set defaults if not already set
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['readStories', 'summaryCache', 'apiKey', 'filterSettings']);

  const defaults = {
    readStories: existing.readStories || [],
    summaryCache: existing.summaryCache || {},
    apiKey: existing.apiKey || '',
    filterSettings: existing.filterSettings || {}
  };

  await chrome.storage.local.set(defaults);
  console.log('[HN Inbox] Extension installed/updated. Preserved existing settings.');
});

// Debug/test function - run in service worker console to test API connection
// Usage: testClaudeConnection()
async function testClaudeConnection() {
  console.log('[HN Inbox] Testing Claude API connection...');

  // Check API key
  const { apiKey } = await chrome.storage.local.get('apiKey');
  console.log('[HN Inbox] API key exists:', !!apiKey);
  console.log('[HN Inbox] API key starts with sk-ant-:', apiKey?.startsWith('sk-ant-'));
  console.log('[HN Inbox] API key length:', apiKey?.length);

  if (!apiKey) {
    console.error('[HN Inbox] ERROR: No API key found. Set it via the extension popup.');
    return;
  }

  // Test API call
  try {
    console.log('[HN Inbox] Sending test request to Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Say "API test successful"'
        }]
      })
    });

    console.log('[HN Inbox] Response status:', response.status);
    console.log('[HN Inbox] Response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json();
      console.error('[HN Inbox] API ERROR:', error);
      console.error('[HN Inbox] Error type:', error.error?.type);
      console.error('[HN Inbox] Error message:', error.error?.message);
      return;
    }

    const data = await response.json();
    console.log('[HN Inbox] ✅ SUCCESS! Claude responded:', data.content[0].text);
    console.log('[HN Inbox] Full response:', data);
  } catch (error) {
    console.error('[HN Inbox] ❌ FETCH ERROR:', error);
    console.error('[HN Inbox] This usually means a network or permissions issue');
    console.error('[HN Inbox] Check that manifest.json includes "https://api.anthropic.com/*" in host_permissions');
  }
}

// Make it globally accessible for console testing
self.testClaudeConnection = testClaudeConnection;
