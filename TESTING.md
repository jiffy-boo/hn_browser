# Testing the AI Summary Feature

Quick guide to test the new AI summary functionality.

## Prerequisites

1. Extension loaded in Chrome (`chrome://extensions/`)
2. Claude API key configured (click extension icon → paste key → save)
3. Internet connection

## Test Plan

### Test 1: Basic Summary Generation

1. Go to https://news.ycombinator.com
2. Wait for stories to load (should see ~100 stories in sidebar)
3. Click on any story with 50+ comments
4. You should see:
   - ✅ Story header with title, metadata
   - ✅ "Generating AI summary..." loading message
   - ✅ After 5-20 seconds: AI summary appears with:
     - Article summary (2-3 sentences)
     - Discussion summary (2-3 sentences)
     - 3-5 interesting comments
   - ✅ Comment tree below loads separately

### Test 2: Summary Caching

1. Click on a story you haven't viewed yet
2. Wait for summary to generate (~10 seconds)
3. Click on a different story
4. Click back to the first story
5. You should see:
   - ✅ Summary appears **instantly** (no "Generating..." message)
   - This confirms caching is working!

### Test 3: Interesting Comments Click

1. Open any story with comments
2. Wait for summary to generate
3. In the "Interesting Comments" section, click on an author name
4. You should see:
   - ✅ Page scrolls to that comment
   - ✅ Comment gets orange border highlight
   - ✅ Highlight fades after 3 seconds

### Test 4: Stories Without URLs (Ask HN, etc.)

1. Filter stories to show "Ask HN" posts (they usually don't have URLs)
2. Click on an Ask HN post
3. You should see:
   - ✅ Summary still generates (just discussion, no article summary)
   - ✅ Discussion summary covers the Ask HN topic
   - ✅ Interesting comments from the discussion

### Test 5: Filters + Summaries

1. Set min points to 100
2. Set min comments to 50
3. Click on a filtered story
4. You should see:
   - ✅ Summary generates normally
   - ✅ High-quality discussions in interesting comments
   - ✅ Caching works across filter changes

### Test 6: Keyboard Navigation + Summaries

1. Press `j` to navigate down through stories
2. Press `Enter` to open a story
3. Press `j` to go to next story
4. Press `Enter` to open it
5. You should see:
   - ✅ Summaries load for each story
   - ✅ Previously viewed stories show cached summaries
   - ✅ Keyboard shortcuts still work while summary loads

### Test 7: Error Handling

#### Missing API Key
1. Clear your API key (extension popup → delete key → save)
2. Open a story
3. You should see:
   - ✅ Error message: "No API key configured..."
   - ✅ Link or instruction to add API key

#### Invalid API Key
1. Set API key to `sk-ant-fake123` (invalid)
2. Open a story
3. You should see:
   - ✅ Error message about invalid API key
   - ✅ Comments still load normally

## Browser Console Checks

Open Chrome DevTools (F12) and check:

### Normal Operation
- No errors in console
- You might see: `Generating summary for story: [story title]`
- No warning about rate limits

### Check Cache
```javascript
// Run in console to see cached summaries
chrome.storage.local.get('summaryCache', (data) => {
  console.log('Cached summaries:', Object.keys(data.summaryCache || {}).length);
  console.log(data.summaryCache);
});
```

### Clear Cache (for testing)
```javascript
// Run in console to clear cache
chrome.storage.local.set({ summaryCache: {} }, () => {
  console.log('Cache cleared!');
  location.reload();
});
```

## Expected Behavior Summary

| Feature | Expected Result |
|---------|----------------|
| First summary load | 5-20 seconds, shows loading |
| Cached summary load | Instant, no loading |
| Click interesting comment | Scrolls + highlights |
| No API key | Clear error message |
| Invalid API key | API error displayed |
| Story with no URL | Discussion summary only |
| Story with article | Article + discussion summary |
| Comment highlighting | Orange border, 3s fade |
| Summary caching | Persists across sessions |

## Common Issues

### Summary not appearing
- **Check**: Is API key set? Click extension icon to verify
- **Check**: Browser console for errors
- **Check**: Network tab - are API calls failing?
- **Try**: Reload extension (`chrome://extensions/` → reload button)

### "Generating..." never finishes
- **Check**: Network connection
- **Check**: Claude API quota at console.anthropic.com
- **Check**: Browser console for specific error
- **Try**: Wait 30 seconds (very long articles take time)

### Click on comment doesn't work
- **Check**: Are comments loaded in tree below?
- **Check**: Does author name match exactly?
- **Try**: Scroll down to ensure comments are rendered

### Cache not working
- **Check**: Chrome storage permissions
- **Try**: Clear cache (see console command above)
- **Try**: Reload extension

## Performance Benchmarks

Typical timings:
- Story list load: 2-5 seconds (100 stories)
- Comment tree load: 1-3 seconds (50 comments)
- First summary generation: 5-20 seconds
- Cached summary load: <100ms
- Comment click → scroll: <500ms

## API Usage

For each summary:
- Input tokens: ~5,000-15,000 (article + comments)
- Output tokens: ~200-500 (summary JSON)
- Cost: ~$0.02-$0.05 per story
- With caching: Pay once per story!

---

If all tests pass, you're good to go! 🎉

Report issues or unexpected behavior for debugging.
