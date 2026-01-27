# Scroll Position Memory

## Overview

The extension now remembers your scroll position for each story. When you navigate between stories, each one remembers where you left off.

## Features

✅ **Per-Story Memory**: Each story remembers its own scroll position
✅ **Persistent Across Sessions**: Scroll positions are saved to Chrome storage
✅ **Smart Defaults**: New stories always start at the top
✅ **Seamless Navigation**: Return to exactly where you were when revisiting a story

## How It Works

### Saving Scroll Position

When you navigate away from a story (using `j`/`k` or clicking another story):
1. The current scroll position of `#main-panel` is captured
2. Stored in memory under that story's ID
3. Saved to Chrome storage for persistence

### Restoring Scroll Position

When you open a story:
1. Check if a saved scroll position exists for this story ID
2. If yes → restore to that position after rendering
3. If no → scroll to top (0)

### Implementation Details

**State Management:**
```javascript
state.scrollPositions = {
  '12345': 850,    // Story ID → scroll position in pixels
  '67890': 1200,
  '11111': 0
}
```

**Save Point (content.js:344):**
```javascript
function selectStory(index) {
  // Save current scroll position before switching
  if (state.selectedStory) {
    const mainPanel = document.getElementById('main-panel');
    if (mainPanel) {
      state.scrollPositions[state.selectedStory.id] = mainPanel.scrollTop;
      saveScrollPositions();
    }
  }
  // ... select new story
}
```

**Restore Point (content.js:404):**
```javascript
// After rendering HTML
requestAnimationFrame(() => {
  const mainPanelElement = document.getElementById('main-panel');
  const savedScrollPosition = state.scrollPositions[story.id];
  if (savedScrollPosition !== undefined && mainPanelElement) {
    mainPanelElement.scrollTop = savedScrollPosition;
  } else if (mainPanelElement) {
    mainPanelElement.scrollTop = 0;  // New story - start at top
  }
});
```

**Storage Persistence (content.js:248):**
```javascript
function saveScrollPositions() {
  chrome.storage.local.set({
    scrollPositions: state.scrollPositions
  });
}
```

## User Experience

### Before (No Memory)
```
1. Open Story A, scroll down to comment #50
2. Press 'j' to go to Story B
3. Story B opens scrolled to same position as Story A (wrong!)
4. Press 'k' to go back to Story A
5. Story A is at top again (lost your place!)
```

### After (With Memory)
```
1. Open Story A, scroll down to comment #50
2. Press 'j' to go to Story B
3. Story B opens at top (correct!)
4. Scroll down to comment #30 in Story B
5. Press 'k' to go back to Story A
6. Story A is at comment #50 (exactly where you left it!)
```

## Browser Behavior

**Scroll Container:**
- `#main-panel` has `overflow-y: auto`
- Scroll position tracked on this element
- Each story rendered inside `#story-detail` within `#main-panel`

**Timing:**
- `requestAnimationFrame()` ensures DOM has updated before restoring scroll
- Prevents flash of content at wrong position
- Smooth, seamless experience

## Storage Management

**Chrome Storage:**
- Scroll positions saved to `chrome.storage.local`
- Persists across page refreshes
- Survives browser restarts
- Synchronized with other cached data

**Cleanup:**
- No automatic cleanup (positions accumulate)
- Could add cleanup for old/deleted stories in future
- Chrome storage limit: 10MB (unlikely to be reached by scroll positions)

## Files Modified

**content.js:**
- Line 20: Added `scrollPositions: {}` to state
- Line 31: Load scroll positions from storage in `init()`
- Line 248-253: Added `saveScrollPositions()` helper function
- Line 344-349: Save scroll position before switching stories in `selectStory()`
- Line 404-413: Restore scroll position after rendering in `renderStoryDetail()`

## Testing

### Test Scroll Memory
1. Open a story with many comments
2. Scroll down halfway
3. Press `j` to go to next story
4. Verify new story starts at top
5. Press `k` to go back
6. Verify you're back at the halfway point

### Test Persistence
1. Open a story, scroll down
2. Navigate to another story
3. Refresh the page (F5)
4. Navigate back to first story
5. Verify scroll position was remembered across refresh

### Test New Stories
1. Open a story you haven't viewed before
2. Verify it starts at top (scrollTop = 0)
3. Scroll down and navigate away
4. Come back
5. Verify it remembers the position

## Edge Cases Handled

✅ **First time viewing story**: Scrolls to top
✅ **Returning to story**: Restores exact position
✅ **Switching between stories**: Each remembers independently
✅ **Page refresh**: Positions loaded from storage
✅ **No previous story**: Doesn't crash when saving (checks `if (state.selectedStory)`)
✅ **Missing main panel**: Doesn't crash (checks `if (mainPanel)`)

## Future Enhancements

Possible improvements:

1. **Cleanup Old Positions**: Remove scroll positions for stories older than 7 days
2. **Smooth Scrolling**: Animate scroll to saved position instead of instant jump
3. **Scroll Progress Indicator**: Show "50% through comments" in sidebar
4. **Smart Positioning**: Scroll to highlighted comment when clicking "interesting comment" links
5. **Reset Option**: Add UI to clear all saved scroll positions

## Summary

Scroll position memory makes navigating between stories feel natural and seamless. You never lose your place, and new stories always start at the top. The implementation is simple, efficient, and persists across sessions.

**Result**: Natural navigation experience with perfect scroll memory! 📜✨
