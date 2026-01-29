# Undo "Not Interested" Feature

## Overview

Users can now undo "not interested" markings with the `u` keyboard shortcut. This restores previously removed stories back to the inbox.

## How It Works

### Marking Stories as Not Interested

When you press `l`:
1. Story is added to `notInterestedStories` set (filtered out)
2. Story ID is pushed to `notInterestedHistory` array (for undo)
3. Both saved to Chrome storage
4. Story disappears from inbox
5. Auto-advances to next story

### Undoing

When you press `u`:
1. Last story ID is popped from `notInterestedHistory` array (LIFO)
2. Story ID is removed from `notInterestedStories` set
3. Both saved to Chrome storage
4. Filters re-applied (story reappears)
5. Restored story is auto-selected
6. User scrolls to the restored story

### State Management

**New State Property:**
```javascript
state.notInterestedHistory = []  // Array of story IDs (LIFO stack)
```

**Storage:**
- Saved to Chrome storage as `notInterestedHistory`
- Persists across page refreshes
- Survives browser restarts

### Example Usage

```
View 10 stories:
Story 1, Story 2, Story 3, Story 4, Story 5, ...

Press 'l' on Story 2:
Story 1, Story 3, Story 4, Story 5, ...
History: [2]

Press 'l' on Story 4:
Story 1, Story 3, Story 5, ...
History: [2, 4]

Press 'l' on Story 5:
Story 1, Story 3, ...
History: [2, 4, 5]

Press 'u':
Story 1, Story 3, Story 5, ...  ← Story 5 restored!
History: [2, 4]

Press 'u':
Story 1, Story 3, Story 4, Story 5, ...  ← Story 4 restored!
History: [2]

Press 'u':
Story 1, Story 2, Story 3, Story 4, Story 5, ...  ← Story 2 restored!
History: []

Press 'u':
Nothing happens (history empty)
```

## Implementation Details

### Modified Functions

**`init()` (content.js:27):**
- Loads `notInterestedHistory` from storage
- Initializes `state.notInterestedHistory` array

**`markAsNotInterested()` (content.js:1054):**
- Pushes story ID to `notInterestedHistory`
- Saves history to storage

**New: `undoNotInterested()` (content.js:1100):**
```javascript
function undoNotInterested() {
  if (state.notInterestedHistory.length === 0) {
    console.log('[HN Inbox] No stories to undo');
    return;
  }

  // Pop the last story from history
  const storyId = state.notInterestedHistory.pop();

  // Remove from not interested set
  state.notInterestedStories.delete(storyId);

  // Save to storage
  chrome.storage.local.set({
    notInterestedStories: Array.from(state.notInterestedStories),
    notInterestedHistory: state.notInterestedHistory
  });

  // Re-apply filters to add story back
  applyFilters();

  // Find and select the restored story
  const restoredIndex = state.filteredStories.findIndex(s => s.id === storyId);
  if (restoredIndex !== -1) {
    selectStory(restoredIndex);
    scrollToSelectedStory();
  }

  // Update sidebar
  renderStoryList();
}
```

### Keyboard Shortcuts

**Updated `setupKeyboardShortcuts()` (content.js:996):**
- Added `case 'u'` to call `undoNotInterested()`

**Updated Keyboard Help:**
- Added `<kbd>u</kbd> Undo not interested` to help overlay

## User Experience

### Before Undo Feature

```
User accidentally presses 'l' on interesting story
Story disappears forever
User must refresh and re-triage all stories
Frustrating!
```

### After Undo Feature

```
User accidentally presses 'l' on interesting story
User immediately presses 'u'
Story reappears and is selected
User continues triaging
Seamless!
```

## Edge Cases Handled

✅ **Nothing to undo:**
- If history is empty, logs message and does nothing
- No error, no crash

✅ **Story doesn't match current filters:**
- Story is still restored to `notInterestedStories`
- May not appear in sidebar if filters exclude it
- But it's no longer in "not interested" set

✅ **Multiple undos:**
- Can press `u` multiple times
- Undoes in reverse order (LIFO)
- Stops when history is empty

✅ **Story already summarized:**
- Undo preserves summary
- Cached data remains intact
- Story shows full content if already summarized

✅ **Persistence:**
- History survives page refresh
- Can undo even after closing/reopening page
- Syncs with Chrome storage

✅ **Story scrolling:**
- Restored story is auto-selected
- Sidebar scrolls to show it
- User knows exactly what was restored

## Keyboard Shortcuts Summary

| Key | Action |
|-----|--------|
| `j` | Navigate down |
| `k` | Navigate up |
| `Enter` | Open selected story |
| `l` | Mark as not interested |
| `u` | **Undo not interested** ← NEW |
| `s` | Summarize all stories |
| `o` | Open article in new tab |
| `e` | Mark as read |
| `r` | Refresh story list |
| `?` | Toggle help |
| `Esc` | Close help |

## Storage Structure

**Chrome Storage Keys:**
```javascript
{
  notInterestedStories: [123, 456, 789],        // Set of removed story IDs
  notInterestedHistory: [123, 456, 789],        // History for undo (LIFO)
  readStories: [111, 222],
  filterSettings: { minPoints: 10, ... },
  commentCache: { ... },
  summaryCache: { ... },
  scrollPositions: { ... }
}
```

## Testing

### Test Basic Undo

1. Open HN Inbox
2. Press `l` on a story
3. Verify story disappears
4. Press `u`
5. Verify story reappears and is selected

### Test Multiple Undos

1. Mark 3 stories as not interested (press `l` three times)
2. All 3 should disappear
3. Press `u` three times
4. Verify all 3 reappear in reverse order

### Test Empty History

1. Undo all stories (press `u` until nothing happens)
2. Press `u` again
3. Verify no error, just logs message

### Test Persistence

1. Mark 2 stories as not interested
2. Refresh the page (F5)
3. Press `u`
4. Verify story is restored (history survived refresh)

### Test With Filters

1. Set filters: min points 50
2. Mark a 40-point story as not interested
3. Press `u`
4. Story is removed from "not interested" but may not show (doesn't meet filter)
5. Lower filter to 0
6. Story should now appear

## Console Messages

**Marking as not interested:**
```
[HN Inbox] Marked story 12345 as not interested
```

**Undoing:**
```
[HN Inbox] Restored story 12345
```

**Nothing to undo:**
```
[HN Inbox] No stories to undo
```

## Performance

**Impact:** Negligible
- History is just an array of integers
- Push/pop operations are O(1)
- Storage saves are async (non-blocking)

**Memory:** Minimal
- Each story ID is ~5 bytes
- 100 removed stories = ~500 bytes
- Well within Chrome storage limits

## Future Enhancements

Possible improvements:

1. **Visual feedback** - Show toast message when undo happens
2. **Redo functionality** - Add `Shift+U` to redo
3. **Undo limit** - Cap history at 50 items to prevent bloat
4. **Bulk undo** - Restore all removed stories at once
5. **Undo with confirmation** - Show which story will be restored
6. **History viewer** - Show list of removed stories

## Files Modified

**content.js:**
- Line 11: Added `notInterestedHistory: []` to state
- Line 32: Load `notInterestedHistory` from storage
- Line 41: Initialize `state.notInterestedHistory`
- Line 120: Added `<kbd>u</kbd> Undo not interested` to help
- Line 1063: Push to history when marking not interested
- Line 1100-1137: Added `undoNotInterested()` function
- Line 1001-1004: Added `case 'u'` keyboard shortcut

## Summary

The undo feature provides a safety net for accidental "not interested" markings. Users can quickly recover removed stories with a single keypress, making the triage workflow more forgiving and efficient.

**Result:** No more permanent mistakes! 🎉
