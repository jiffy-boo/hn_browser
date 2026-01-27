# CORS Header Fix

## Issue Fixed

The Anthropic API now requires the `anthropic-dangerous-direct-browser-access` header when making requests directly from browser contexts (including Chrome extensions).

## What Was Changed

Added the header to all Claude API requests in `background.js`:

```javascript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true'  // ← Added this
}
```

## Why Is This Header Needed?

Anthropic requires this header to acknowledge that you understand the security implications of calling their API directly from browser code.

**Is this safe in a Chrome extension?**

Yes! While the header name says "dangerous", it's actually reasonably secure in this context because:

1. **Service Worker Protection**: The API calls are made from the background service worker, not from page context
2. **Extension Sandboxing**: Chrome extensions run in their own sandboxed environment
3. **Storage Security**: The API key is stored in Chrome's local storage, which is isolated per extension
4. **No Public Exposure**: The API key is never exposed to websites or other extensions

The header is mainly there to warn against using API keys in traditional web pages where they could be easily extracted from the JavaScript code.

## How to Apply

1. Go to `chrome://extensions/`
2. Click the reload icon for HN Inbox
3. Go to `news.ycombinator.com`
4. Click on a story - AI summaries should now work! ✅

## Test the Fix

Run this in the service worker console (`chrome://extensions/` → click "service worker"):

```javascript
testClaudeConnection()
```

You should see:
```
✅ SUCCESS! Claude responded: API test successful
```

## Security Best Practices

Even though this is safe for a Chrome extension, here are some best practices:

1. **Never commit your API key** to Git/GitHub
2. **Don't share your extension .crx file** with your API key in it
3. **Use separate API keys** for development and production
4. **Rotate your API key** if you suspect it's been compromised
5. **Monitor your API usage** at https://console.anthropic.com/settings/usage

## Additional Info

The extension is designed with security in mind:
- API key is only stored locally (not synced across devices)
- API calls are made from background service worker (isolated context)
- No API key is ever sent to any server except Anthropic's official API
- Content scripts don't have access to the API key

This is the standard approach for API-based Chrome extensions and is considered secure.
