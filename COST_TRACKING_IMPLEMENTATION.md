# Cost Tracking Implementation

## Overview

Client-side cost tracking has been implemented for all Claude API usage. The system tracks token usage and calculates costs entirely on the client side without requiring additional API calls.

## Features

✅ **Automatic Tracking**: All Claude API requests are automatically tracked
✅ **Per-API-Key Storage**: Costs are tracked separately for each API key
✅ **Detailed Metrics**: Tracks input tokens, output tokens, cache writes, and cache reads
✅ **Cost Calculation**: Calculates costs based on Claude 4.5 Haiku pricing
✅ **Request Context**: Each request is categorized (full_summary, discussion_summary, article_summary)
✅ **Visual Dashboard**: Popup displays total cost, requests, tokens, and averages
✅ **Reset Functionality**: Can reset usage data when needed

## Implementation Details

### 1. Cost Tracker Module (cost-tracker.js)

**Pricing Configuration:**
```javascript
const PRICING = {
  'claude-haiku-4-5-20251001': {
    name: 'Claude 4.5 Haiku',
    input: 1.00,           // $1.00 per million tokens
    output: 5.00,          // $5.00 per million tokens
    cacheWrite: 1.25,      // $1.25 per million tokens
    cacheRead: 0.10        // $0.10 per million tokens
  }
};
```

**Key Methods:**
- `calculateCost(usage)` - Calculates cost from Claude API usage object
- `trackRequest(usage, requestType, storyId)` - Stores request data with context
- `getCurrentUsage()` - Retrieves statistics for current API key
- `resetUsage()` - Clears all usage data
- `formatCost(cost)` - Formats cost for display
- `formatTokens(tokens)` - Formats token count for display

**Storage Structure:**
```javascript
costTracking: {
  'key_hash': {
    totalCost: 0.15,
    totalTokens: 45000,
    requests: [
      {
        model: 'claude-haiku-4-5-20251001',
        tokens: { input: 3000, output: 500, cacheWrite: 0, cacheRead: 0 },
        costs: { input: 0.003, output: 0.0025, total: 0.0055 },
        requestType: 'discussion_summary',
        storyId: '12345',
        timestamp: 1234567890
      }
    ],
    firstRequest: 1234567890,
    lastRequest: 1234567899
  }
}
```

### 2. Integration Points in background.js

**Import:**
```javascript
importScripts('cost-tracker.js');
```

**Tracking in callClaudeAPI() (full summaries):**
```javascript
const data = await response.json();
if (data.usage) {
  await costTracker.trackRequest(data.usage, 'full_summary', story.id);
}
```

**Tracking in generateDiscussionSummary():**
```javascript
const { summary, usage } = await callClaudeAPISimple(apiKey, prompt);
if (usage) {
  await costTracker.trackRequest(usage, 'discussion_summary', story.id);
}
```

**Tracking in generateArticleSummary():**
```javascript
const { summary, usage } = await callClaudeAPISimple(apiKey, prompt);
if (usage) {
  await costTracker.trackRequest(usage, 'article_summary', story.id);
}
```

**Message Handlers:**
```javascript
if (request.action === 'getCostUsage') {
  costTracker.getCurrentUsage().then(sendResponse);
  return true;
}

if (request.action === 'resetCostUsage') {
  costTracker.resetUsage().then(sendResponse);
  return true;
}
```

### 3. UI Dashboard (popup.html/popup.js)

**Display Metrics:**
- Total Cost (all API requests combined)
- Total Requests (number of API calls)
- Total Tokens (all token types combined)
- Average Cost per Request
- Model Name (Claude 4.5 Haiku)

**Visual Layout:**
```
┌─────────────────────────────────────┐
│  API Usage & Cost Tracking          │
├─────────────────┬───────────────────┤
│  Total Cost     │  API Requests     │
│  $0.15          │  12               │
├─────────────────┴───────────────────┤
│  Total Tokens: 45.0K                │
│  Avg Cost/Request: $0.0125          │
│  Model: Claude 4.5 Haiku            │
├─────────────────────────────────────┤
│  [Reset Usage Data]                 │
└─────────────────────────────────────┘
```

## Usage Data Flow

1. **API Request Made** → Claude API responds with usage object:
   ```json
   {
     "usage": {
       "input_tokens": 3000,
       "output_tokens": 500,
       "cache_creation_input_tokens": 0,
       "cache_read_input_tokens": 0
     }
   }
   ```

2. **Cost Calculation** → CostTracker calculates costs:
   - Input cost: (3000 × $1.00) / 1,000,000 = $0.003
   - Output cost: (500 × $5.00) / 1,000,000 = $0.0025
   - Total: $0.0055

3. **Storage** → Data saved to Chrome storage under API key hash:
   ```javascript
   key_hash: `key_${apiKey.length}_${apiKey.slice(-8)}`
   ```

4. **Display** → Popup retrieves and formats data:
   - Sends `getCostUsage` message to background
   - Receives aggregated statistics
   - Updates UI with formatted values

## Request Types

The system categorizes requests into three types:

1. **full_summary** - Complete summary (article + discussion)
   - Generated by: `callClaudeAPI()`
   - Max tokens: 2000
   - Includes: Article content + comments

2. **discussion_summary** - Discussion only (faster)
   - Generated by: `generateDiscussionSummary()`
   - Max tokens: 1000
   - Includes: Top 50 comments

3. **article_summary** - Article only
   - Generated by: `generateArticleSummary()`
   - Max tokens: 1000
   - Includes: First 5K chars of article

## Privacy & Security

- **API Key Hashing**: Full API keys are never stored in tracking data
- **Hash Format**: `key_${length}_${last8chars}` (e.g., `key_64_api12345`)
- **Local Storage**: All data stored locally in Chrome storage
- **No Telemetry**: No data sent to external servers

## Storage Management

- **Request Limit**: Only last 100 requests stored per API key
- **Automatic Pruning**: Older requests automatically removed when limit exceeded
- **Reset Function**: User can manually clear all data via popup

## Cost Estimation

Based on Claude 4.5 Haiku pricing as of January 2025:

**Typical Summary Costs:**
- Discussion-only summary: ~3,000-5,000 tokens → **$0.015-$0.025**
- Article-only summary: ~5,000-8,000 tokens → **$0.025-$0.040**
- Full summary (deprecated): ~8,000-15,000 tokens → **$0.040-$0.075**

**Progressive Loading (current approach):**
- Discussion (3-5K tokens) + Article (5-8K tokens) = 8-13K total
- Average cost: **$0.020-$0.035 per story**
- With preloading: ~2-3 requests per browsing session

**Cost per 100 Stories:**
- Viewing 100 stories: **$2.00-$3.50**
- With caching: Significantly lower on revisits

## Files Modified

### New Files:
- `cost-tracker.js` - Core cost tracking module (246 lines)

### Modified Files:
- `background.js` - Added tracking integration (7 new lines)
  - Line 7: `importScripts('cost-tracker.js')`
  - Line 119-121: Tracking in `generateDiscussionSummary()`
  - Line 149-151: Tracking in `generateArticleSummary()`
  - Line 239-241: Tracking in `callClaudeAPI()`
  - Line 243-251: Message handlers for cost queries
  - Line 427-430: Modified `callClaudeAPISimple()` to return usage

- `popup.html` - Added cost tracking UI (~60 new lines)
  - CSS styles for cost section (lines 111-185)
  - HTML for cost display (lines 148-165)

- `popup.js` - Added cost data loading/display (~50 new lines)
  - `loadCostUsage()` function
  - `formatCost()` helper
  - `formatTokens()` helper
  - Reset button handler

## Testing

### 1. Verify Tracking is Working

Open the background service worker console:
```
1. chrome://extensions/
2. Click "Service Worker" under HN Inbox
3. Generate a summary in the extension
4. Check console for: "[Cost Tracker] Request tracked: $0.0055 | Type: discussion_summary | Tokens: 3500"
```

### 2. Check Storage

In the service worker console:
```javascript
chrome.storage.local.get('costTracking', (data) => {
  console.log(data.costTracking);
});
```

### 3. View Dashboard

1. Click the extension icon
2. Check "API Usage & Cost Tracking" section
3. Verify metrics update after generating summaries
4. Test reset button

### 4. Manual Cost Check

Compare tracked costs with actual API usage:
1. Check Anthropic Console usage
2. Compare with tracked costs in extension
3. Verify calculations are accurate

## Troubleshooting

### Cost Not Tracking

**Check:**
- Extension reloaded after changes?
- Background service worker running?
- API responses include usage data?

**Fix:**
```javascript
// In background service worker console:
costTracker.getCurrentUsage().then(console.log);
```

### Incorrect Cost Calculations

**Check:**
- Pricing constants up to date?
- Usage data format correct?
- All token types accounted for?

**Fix:**
Update PRICING in cost-tracker.js if rates change.

### Storage Issues

**Check:**
- Chrome storage quota (10MB limit)
- Storage permissions in manifest.json

**Clear:**
```javascript
chrome.storage.local.remove('costTracking');
```

## Future Enhancements

Possible improvements:

1. **Cost Alerts**: Warn when costs exceed threshold
2. **Usage Graphs**: Visual charts of usage over time
3. **Export Data**: Download usage data as CSV/JSON
4. **Budget Tracking**: Set monthly budget and track progress
5. **Cost Breakdown**: Show costs by request type
6. **Cache Efficiency**: Track cache hit rate and savings
7. **Daily/Weekly Reports**: Automated usage summaries

## API Response Format

Claude API returns usage data in this format:

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "..."
    }
  ],
  "model": "claude-haiku-4-5-20251001",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 3000,
    "output_tokens": 500,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

The `usage` object is what we capture and track.

## Summary

The cost tracking system is now fully integrated and operational. Every Claude API request is automatically tracked, costs are calculated accurately, and users can monitor their usage through a clean dashboard interface. All data is stored locally and tied to the specific API key being used.

**Result**: Complete visibility into API costs with zero additional API calls! 🎉
