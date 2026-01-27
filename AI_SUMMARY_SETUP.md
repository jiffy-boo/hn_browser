# AI Summary Feature Setup

The AI summary feature is now fully implemented! Here's how to set it up and use it.

## What It Does

When you select a story, the extension will:

1. **Fetch the article content** using Jina AI Reader API
2. **Fetch all HN comments** and build a comment tree
3. **Send to Claude API** to generate:
   - 2-3 sentence article summary
   - 2-3 sentence discussion summary
   - 3-5 interesting comments with explanations of why they're noteworthy
4. **Display the summary** above the comment tree
5. **Cache the result** so you don't regenerate summaries for stories you've already viewed

## Setup Instructions

### 1. Get Your Claude API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to "API Keys" section
4. Click "Create Key"
5. Copy your API key (starts with `sk-ant-`)

### 2. Add API Key to Extension

1. Click the HN Inbox extension icon in your Chrome toolbar
2. Paste your API key into the "Claude API Key" field
3. Click "Save Settings"

That's it! The extension will now generate AI summaries.

## How to Use

1. Navigate to https://news.ycombinator.com
2. Use filters to find interesting stories (or browse all)
3. Select a story (click or press `Enter`)
4. You'll see:
   - "Generating AI summary..." loading indicator
   - After 5-20 seconds, the AI summary appears with:
     - Article summary
     - Discussion summary
     - Interesting comments (clickable!)

### Click on Interesting Comments

The "Interesting Comments" section shows 3-5 noteworthy comments. Click on any author name to:
- Scroll to that comment in the tree below
- Highlight it with an orange border for 3 seconds
- Automatically expand collapsed threads if needed

## Features

### Smart Caching
- Summaries are cached locally (Chrome storage)
- Once generated, they load instantly
- No duplicate API calls for the same story
- Cache persists across browser sessions

### Efficient API Usage
- Only fetches article content when needed
- Limits comment depth to top 3 levels for summarization
- Truncates very long articles/discussions to stay within token limits
- Uses Claude 3.5 Sonnet (fast and cost-effective)

### Error Handling
- Shows helpful error if API key is missing
- Displays API errors clearly (e.g., rate limits, invalid key)
- Gracefully handles missing article content or comments
- Continues to work even if summary generation fails

## API Costs

Using Claude 3.5 Sonnet:
- Input: ~$3 per million tokens
- Output: ~$15 per million tokens

Typical story summary:
- Input: 5,000-15,000 tokens (article + comments)
- Output: 200-500 tokens (summary)
- Cost per summary: ~$0.02-$0.05

With caching, you only pay once per story!

## Troubleshooting

### "No API key configured" error
- Click the extension icon and add your Claude API key
- Make sure it starts with `sk-ant-`
- Click "Save Settings"

### Summary not loading
- Check browser console (F12) for errors
- Verify your API key is valid at https://console.anthropic.com/
- Check your API quota/credits
- Some stories might not have accessible articles (Ask HN, Show HN without URLs)

### "Failed to generate summary" error
- Could be rate limit (wait a minute and try again)
- Could be invalid API key (check console.anthropic.com)
- Could be network issue (check your connection)
- Check browser console for detailed error message

### Comments not clickable from summary
- Make sure comments have finished loading in the tree below
- Try scrolling down to ensure comments are rendered
- Check that the author name matches exactly

## How It Works (Technical)

### Architecture

```
content.js (UI)
    ↓ (sends story + comments)
background.js (service worker)
    ↓ (fetches article via Jina)
    ↓ (calls Claude API)
    ↓ (parses JSON response)
    ↓ (caches result)
content.js (UI)
    ↓ (displays summary)
    ↓ (adds click handlers)
```

### Claude Prompt

The extension sends Claude:
- Story title and metadata
- Article content (via Jina AI Reader - clean markdown)
- Flattened comment tree (top 3 levels, stripped of HTML)
- Structured request for JSON response

Claude responds with:
```json
{
  "articleSummary": "...",
  "discussionSummary": "...",
  "interestingComments": [
    {
      "author": "username",
      "snippet": "First ~100 chars",
      "reason": "Why it's interesting"
    }
  ]
}
```

### Jina AI Reader

- Free API for converting web pages to clean markdown
- URL: `https://r.jina.ai/{article_url}`
- Returns article text without ads, popups, or navigation
- Perfect for LLM consumption

## Privacy & Security

- API key stored locally in Chrome storage (sandboxed per extension)
- API calls made from background service worker (not page context)
- No data sent to third parties except:
  - Claude API (for summarization)
  - Jina AI Reader (for article content)
- Summary cache stored locally (not synced)

## Advanced Configuration

### Clear Summary Cache

If you want to regenerate summaries (e.g., after prompt changes):

1. Open Chrome DevTools (F12)
2. Go to Application tab
3. Select "Storage" > "Local Storage"
4. Find your extension ID
5. Delete the `summaryCache` key

Or run in console:
```javascript
chrome.storage.local.set({ summaryCache: {} });
```

### Customize Summary Prompt

Edit `background.js` → `buildSummaryPrompt()` function to change:
- Summary length (currently 2-3 sentences)
- Number of interesting comments (currently 3-5)
- What makes a comment "interesting"
- Response format

After changes:
1. Go to `chrome://extensions/`
2. Click refresh icon on HN Inbox
3. Clear cache (see above)
4. Reload news.ycombinator.com

## Next Steps

Want to enhance the AI features? Ideas:
- Add "Ask Claude about this discussion" chat interface
- Generate topic tags/categories for stories
- Sentiment analysis of discussion tone
- Timeline view of how discussion evolved
- Related story suggestions
- TL;DR mode (one sentence per story in sidebar)

---

Happy summarizing! 🤖
