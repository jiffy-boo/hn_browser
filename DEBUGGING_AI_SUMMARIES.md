# Debugging "Failed to Fetch" Error

## Quick Diagnosis Steps

### Step 1: Check Browser Console

1. Open Chrome DevTools (F12)
2. Go to the "Console" tab
3. Look for error messages when you click on a story
4. Look for messages starting with "Summary generation error:" or API-related errors

**What to look for:**
- `Failed to fetch` - Network or CORS issue
- `401 Unauthorized` - Invalid API key
- `429 Too Many Requests` - Rate limit hit
- `Network error` - Connection issue
- Any other specific error messages

### Step 2: Check Network Tab

1. Open Chrome DevTools (F12)
2. Go to the "Network" tab
3. Click on a story to trigger summary generation
4. Look for failed requests (shown in red)

**Key requests to check:**
- Requests to `api.anthropic.com` (Claude API)
- Requests to `r.jina.ai` (Jina Reader)
- Look at the Status Code column

**Click on failed requests and check:**
- Headers tab: Is the API key being sent?
- Response tab: What error message is returned?
- Preview tab: Structured error information

### Step 3: Verify API Key

Run this in the browser console (F12):
```javascript
chrome.storage.local.get('apiKey', (data) => {
  console.log('API Key exists:', !!data.apiKey);
  console.log('API Key starts with sk-ant-:', data.apiKey?.startsWith('sk-ant-'));
  console.log('API Key length:', data.apiKey?.length);
  // Don't log the actual key for security
});
```

**Expected output:**
- API Key exists: `true`
- API Key starts with sk-ant-: `true`
- API Key length: Should be around 100-150 characters

### Step 4: Test API Key Manually

Test your API key with curl:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

If this fails, your API key is invalid or you have quota issues.

### Step 5: Check Service Worker Console

The background service worker has its own console:

1. Go to `chrome://extensions/`
2. Find "HN Inbox"
3. Click "service worker" (blue link under "Inspect views")
4. A new DevTools window opens - this is the background worker console
5. Look for error messages here

**What to look for:**
- Errors when calling Claude API
- CORS errors
- Network errors

## Common Issues & Fixes

### Issue 1: Invalid API Key

**Symptoms:**
- Error message mentions "401" or "unauthorized"
- Network tab shows 401 status code

**Fix:**
1. Go to https://console.anthropic.com/settings/keys
2. Verify your API key is active
3. Create a new key if needed
4. Click HN Inbox extension icon
5. Paste the new key and save

### Issue 2: CORS/Network Error

**Symptoms:**
- "Failed to fetch" with no status code
- CORS policy errors in console
- Network tab shows "(failed)" with no status code

**Possible causes:**
- Browser extension permissions issue
- Network firewall blocking API
- VPN/proxy interference

**Fix:**
1. Check manifest.json has correct host_permissions:
```json
"host_permissions": [
  "https://news.ycombinator.com/*",
  "https://hacker-news.firebaseio.com/*",
  "https://r.jina.ai/*",
  "https://api.anthropic.com/*"
]
```

2. Reload the extension after adding permissions
3. Try disabling VPN if you're using one
4. Check firewall settings

### Issue 3: Rate Limiting

**Symptoms:**
- Error mentions "429" or "rate limit"
- Works for a few stories, then fails

**Fix:**
- Wait a few minutes before trying again
- Check your API usage at https://console.anthropic.com/settings/usage
- Consider upgrading your API plan if needed

### Issue 4: Jina Reader Failing

**Symptoms:**
- Error occurs only for stories with URLs
- Ask HN posts work fine (no URL)

**Test Jina Reader:**
```bash
curl https://r.jina.ai/https://news.ycombinator.com
```

If this fails, Jina Reader might be down or blocking requests.

**Fix:**
- Wait and try again later
- The extension should still generate discussion summaries even if article fetch fails

### Issue 5: Article Too Long / Timeout

**Symptoms:**
- Works for some stories but not others
- Fails on stories with very long articles or many comments

**Fix:**
The code already has token limits, but if needed, we can reduce them further in background.js.

## Advanced Debugging

### Enable Verbose Logging

Add this to the top of background.js (after line 4):
```javascript
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[HN Inbox Debug]', ...args);
  }
}
```

Then add logging throughout the code:
```javascript
async function generateSummary(story, comments) {
  debugLog('Generating summary for story:', story.id, story.title);

  try {
    // Check cache
    const { summaryCache = {} } = await chrome.storage.local.get('summaryCache');
    if (summaryCache[story.id]) {
      debugLog('Using cached summary for story:', story.id);
      return { success: true, summary: summaryCache[story.id] };
    }

    // Get API key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    debugLog('API key exists:', !!apiKey);

    if (!apiKey) {
      return { success: false, error: 'No API key configured.' };
    }

    // ... rest of function
  } catch (error) {
    debugLog('Error in generateSummary:', error);
    // ... rest of error handling
  }
}
```

### Test Minimal API Call

Add this function to background.js for testing:
```javascript
// Test function - call from console in service worker
async function testClaudeAPI() {
  const { apiKey } = await chrome.storage.local.get('apiKey');

  console.log('Testing Claude API...');
  console.log('API Key exists:', !!apiKey);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'Say hello'
        }]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Response data:', data);

    if (!response.ok) {
      console.error('API Error:', data);
    } else {
      console.log('Success! Claude says:', data.content[0].text);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}
```

Then run in service worker console:
```javascript
testClaudeAPI();
```

### Check Permissions

Run in browser console:
```javascript
chrome.permissions.getAll((permissions) => {
  console.log('Permissions:', permissions);
});
```

Verify that `https://api.anthropic.com/*` is in the host_permissions.

## What Information to Collect

When reporting the issue, please provide:

1. **Console errors** (from both page console and service worker console)
2. **Network tab screenshot** showing failed request
3. **API key validation** (does it start with sk-ant-?, is it active?)
4. **Browser/OS**: Chrome version, operating system
5. **Story that fails**: Does it fail on all stories or specific ones?
6. **Timing**: Does it work initially then fail? Or always fails?

## Quick Test Checklist

- [ ] API key is set (check extension popup)
- [ ] API key starts with `sk-ant-`
- [ ] API key is active at console.anthropic.com
- [ ] No CORS errors in console
- [ ] No 401/403/429 errors in network tab
- [ ] Service worker console shows no errors
- [ ] Jina Reader is accessible (test with curl)
- [ ] Other Chrome extensions disabled (test for conflicts)
- [ ] Extension permissions include api.anthropic.com

## Need More Help?

If none of the above works, let me know:
1. What errors you see in console (exact text)
2. What the network tab shows (status codes)
3. Results of the API key test
4. Whether it fails on all stories or just some

I can then create a more targeted fix!
