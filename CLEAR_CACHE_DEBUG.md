# Clear Cache Debug Feature

## Overview

Added a debug button in the extension popup to clear all cached story data. This is useful for testing and debugging when encountering issues related to stale cached data.

## Location

**Extension Popup → Debug Section → "Clear All Story Data" button**

Access via:
1. Click the extension icon in Chrome toolbar
2. Scroll down to "Debug" section
3. Click red "Clear All Story Data" button

## What Gets Cleared

### Story Data (Removed):
✅ **`commentCache`** - Cached comments data and HTML for all stories
✅ **`summaryCache`** - Cached AI summaries for all stories
✅ **`scrollPositions`** - Remembered scroll positions for each story
✅ **`readStories`** - Stories marked as read
✅ **`notInterestedStories`** - Stories removed from inbox
✅ **`notInterestedHistory`** - Undo history for removed stories

### Settings & Data (Preserved):
❌ **`apiKey`** - Your Claude API key (kept!)
❌ **`filterSettings`** - Filter preferences (min points, time range, etc.)
❌ **`filtersCollapsed`** - UI state for filters panel
❌ **`costTracking`** - API usage and cost tracking data

## When to Use

### Debugging Scenarios:

**1. Stale comment data:**
- Comments not updating after HN changes
- Cached comments from old version of extension
- Rendering issues in comment tree

**2. Summary issues:**
- Old summary format showing
- Summaries not matching current story content
- Cached summaries from previous API version

**3. UI state bugs:**
- Scroll positions wrong after layout changes
- Stories stuck in "read" state incorrectly
- "Not interested" stories not behaving correctly

**4. Testing new features:**
- Want fresh state to test triage mode
- Need to verify summarization from scratch
- Testing with clean cache

**5. After extension updates:**
- Updated code but seeing old behavior
- Cached data incompatible with new version
- Want to ensure fresh start

### Not Needed For:

❌ Changing API key (just update in settings)
❌ Changing filters (they persist separately)
❌ Resetting cost tracking (use "Reset Usage Data" button instead)
❌ Normal browsing (cache improves performance!)

## How It Works

### User Flow:

```
1. Click extension icon
   ↓
2. Scroll to "Debug" section
   ↓
3. Click "Clear All Story Data" button
   ↓
4. Confirmation dialog appears:
   "Clear all cached story data?

   This will remove:
   - Comment caches
   - AI summaries
   - Scroll positions
   - Read/uninterested state

   Your API key and settings will be preserved."
   ↓
5. Click OK to confirm
   ↓
6. Success message: "All story data cleared! Refresh the page to see changes."
   ↓
7. Refresh HN page
   ↓
8. Fresh state - all stories appear new!
```

### Technical Implementation:

```javascript
// Clear all story data
await chrome.storage.local.remove([
  'commentCache',
  'summaryCache',
  'scrollPositions',
  'readStories',
  'notInterestedStories',
  'notInterestedHistory'
]);
```

**What happens:**
- Removes specified keys from Chrome local storage
- Leaves all other keys intact (apiKey, filterSettings, etc.)
- Next page load starts with empty caches
- Stories load fresh from HN API
- Summaries generated fresh from Claude API

## UI Design

### Button Appearance:

```
┌─────────────────────────────────┐
│ Debug                            │
├─────────────────────────────────┤
│ Clear all cached story data...  │
│ Your API key and settings will  │
│ be preserved.                   │
│                                 │
│ [Clear All Story Data] ← Red    │
└─────────────────────────────────┘
```

**Styling:**
- Red button (warning color)
- Clear description text
- Same style as "Reset Usage Data" button
- Located in dedicated Debug section

### Confirmation Dialog:

```
┌─────────────────────────────────────┐
│  Clear all cached story data?      │
│                                     │
│  This will remove:                 │
│  - Comment caches                  │
│  - AI summaries                    │
│  - Scroll positions                │
│  - Read/uninterested state         │
│                                     │
│  Your API key and settings will    │
│  be preserved.                      │
│                                     │
│          [Cancel]    [OK]          │
└─────────────────────────────────────┘
```

### Success Message:

```
┌─────────────────────────────────────┐
│ ✓ All story data cleared!          │
│   Refresh the page to see changes. │
└─────────────────────────────────────┘
```

Green success banner, auto-hides after 3 seconds.

## Implementation Details

### Files Modified:

**popup.html:**
- Added Debug section before About section
- Added red "Clear All Story Data" button
- Added explanatory text

**popup.js:**
- Added `clearCacheBtn` element reference
- Added click event listener
- Added confirmation dialog
- Uses `chrome.storage.local.remove()` to delete keys
- Shows success message

### Code:

```javascript
// Clear all story data (for debugging)
clearCacheBtn.addEventListener('click', async () => {
  if (!confirm('Clear all cached story data?\n\n...')) {
    return;
  }

  try {
    // Remove all story-related data
    await chrome.storage.local.remove([
      'commentCache',
      'summaryCache',
      'scrollPositions',
      'readStories',
      'notInterestedStories',
      'notInterestedHistory'
    ]);

    showStatus('All story data cleared! Refresh the page to see changes.', 'success');

    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  } catch (error) {
    showStatus('Failed to clear cache', 'error');
    console.error('Clear cache error:', error);
  }
});
```

## Effect on User Experience

### Before Clearing:

```
Stories shown:
- Story A (read, summarized, cached comments)
- Story B (not interested, removed from inbox)
- Story C (summarized, scroll position saved)

Cache contains:
- 50 story summaries
- 100 cached comment trees
- 50 scroll positions
- 20 read story IDs
- 10 not interested story IDs
```

### After Clearing:

```
Stories shown:
- Story A (fresh, not read, no summary, no cache)
- Story B (back in inbox! not interested state cleared)
- Story C (fresh, scroll starts at top)

Cache contains:
- Nothing! Fresh start.

Preserved:
- API key still set
- Filters still configured (min points, time range)
- Cost tracking still intact
```

### User Must:

1. **Refresh the HN page** to see changes (old data still in memory)
2. **Re-triage stories** (all appear "new" again)
3. **Re-summarize** if needed (summaries cleared)
4. **Scroll positions reset** (all stories start at top)

## Testing

### Test Clear Cache:

1. Open HN Inbox with some cached data
2. Note which stories are read/not interested
3. Click extension icon → Debug → Clear All Story Data
4. Confirm in dialog
5. See success message
6. Refresh HN page
7. Verify:
   - All stories appear fresh (no read indicators)
   - Previously removed stories are back
   - No cached summaries (must re-generate)
   - Scroll positions reset

### Test Settings Preserved:

1. Before clearing: Note your filter settings
2. Clear cache
3. Verify filters still set correctly
4. Verify API key still saved
5. Verify cost tracking data intact

### Test Error Handling:

1. Click clear cache
2. Cancel in confirmation dialog
3. Verify nothing was cleared
4. Try clearing with extension error
5. Verify error message shown

## Console Output

**On clear:**
```
[Popup] Clear cache button clicked
[Popup] Removed storage keys: commentCache, summaryCache, ...
[Popup] All story data cleared successfully
```

**On error:**
```
Clear cache error: [error details]
```

## Storage Impact

**Before clearing (typical usage):**
```
commentCache: ~500KB - 2MB
summaryCache: ~100KB - 500KB
scrollPositions: ~5KB
readStories: ~1KB
notInterestedStories: ~1KB
notInterestedHistory: ~1KB

Total: ~600KB - 3MB
```

**After clearing:**
```
Total story data: 0 bytes
Settings data: ~10KB (apiKey, filters, costTracking)
```

**Benefit:** Frees up Chrome local storage space!

## Future Enhancements

Possible improvements:

1. **Selective clearing** - Choose what to clear (comments only, summaries only, etc.)
2. **Scheduled clearing** - Auto-clear old caches after 7 days
3. **Cache size display** - Show how much storage is used
4. **Export before clear** - Download cache as JSON before clearing
5. **Clear and reload** - Auto-refresh page after clearing

## Summary

The clear cache button provides a quick way to reset all story-related data for debugging and testing. It's a nuclear option that gives you a completely fresh start while preserving your important settings and API key.

**Use it when:** Testing, debugging, or encountering weird behavior
**Avoid it when:** Normal browsing (cache improves performance!)

**Result:** Fresh slate for debugging! 🧹
