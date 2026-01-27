# Quick Fix for "Failed to Fetch" Error

## Most Likely Cause: Missing Permission ✅

I found the issue! The manifest.json was missing permission to access the Claude API.

**This is now FIXED** - just follow the steps below to apply the update.

## How to Fix (2 minutes)

### Step 1: Reload the Extension

1. Go to `chrome://extensions/`
2. Find "HN Inbox"
3. Click the **reload icon** (circular arrow)
4. You should see a permissions update prompt
5. Click "Reload" or "Accept" if prompted

### Step 2: Test It

1. Go to `news.ycombinator.com`
2. Click on any story with comments
3. Wait 5-20 seconds for the AI summary to generate
4. ✅ It should work now!

## If It Still Doesn't Work

### Quick Test in Service Worker Console

1. Go to `chrome://extensions/`
2. Find "HN Inbox"
3. Click the **"service worker"** link (blue text under "Inspect views")
4. In the console that opens, type:
   ```javascript
   testClaudeConnection()
   ```
5. Press Enter

**What to expect:**
- ✅ "SUCCESS! Claude responded: API test successful"
- ❌ If you see errors, read them carefully - they'll tell you what's wrong

### Common Issues After Permission Fix

#### 1. Invalid API Key
**Error:** "401 Unauthorized" or "invalid API key"

**Fix:**
1. Go to https://console.anthropic.com/settings/keys
2. Verify your key is active
3. Create a new key if needed
4. Click the HN Inbox extension icon
5. Paste new key and save

#### 2. Rate Limit
**Error:** "429 Too Many Requests"

**Fix:**
- Wait 1-2 minutes
- Try a different story
- Check your usage at https://console.anthropic.com/settings/usage

#### 3. No API Key Set
**Error:** "No API key configured"

**Fix:**
1. Click the HN Inbox extension icon (puzzle piece in Chrome toolbar)
2. Paste your Claude API key (get from https://console.anthropic.com/)
3. Click "Save Settings"

## Still Having Issues?

Run this in the page console (F12):
```javascript
// Check if API key is set
chrome.storage.local.get('apiKey', (data) => {
  console.log('Has API key:', !!data.apiKey);
  console.log('Key format correct:', data.apiKey?.startsWith('sk-ant-'));
});
```

Then check:
1. Browser console (F12) for error messages
2. Network tab (F12) for failed requests
3. Service worker console for backend errors

**Send me:**
- Console error messages (screenshot or copy/paste)
- Network tab status codes
- Results of `testClaudeConnection()`

And I can help debug further!

---

## What Was Changed

**manifest.json:**
- Added `"https://api.anthropic.com/*"` to `host_permissions`
- This allows the extension to make requests to Claude API

**background.js:**
- Added detailed logging to track API calls
- Added better error messages
- Added `testClaudeConnection()` test function

The most important fix is the manifest.json permission - that's almost certainly what was causing your "Failed to fetch" error!
