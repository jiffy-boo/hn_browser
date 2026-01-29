# Triage Mode Implementation

## Overview

The extension has been redesigned from an "auto-load" inbox to a **triage-first workflow**. Users now mark stories as interesting/not interesting before batch processing summaries.

## New User Flow

### Phase 1: Triage Mode (Default)

**What Users See:**
1. Sidebar shows stories with metadata only (title, points, comments, domain, author, time)
2. Selecting a story shows **metadata only** in main panel - no automatic loading
3. Main panel displays:
   - Title (large format)
   - Points, author, time, domain, comment count
   - "Open Article" button (if URL exists)
   - Instructions: "Press `l` to mark as not interested, or `s` to summarize all"

**User Actions:**
- `j`/`k` - Navigate between stories
- `l` - Mark current story as "not interested" → removes from inbox, auto-advances to next
- `s` - Start batch summarization of all remaining stories
- `o` - Open article in new tab
- `e` - Mark as read (existing functionality)
- `r` - Refresh stories (existing functionality)

**Key Behavior:**
- All stories start as "interesting" (no marking required)
- Stories marked "not interested" disappear immediately
- No visual indicator for "interesting" - presence in inbox = interesting
- After pressing `l`, automatically advances to next story

### Phase 2: Batch Summarization

**Triggered By:** User presses `s` key

**Confirmation:**
- Shows dialog: "Summarize N stories? This will use API credits."
- User can cancel or proceed

**Processing:**
1. Processes all remaining stories **sequentially** (not parallel)
2. For each story:
   - Fetch comments (if not cached)
   - Fetch article content (if URL exists)
   - Generate full AI summary (article + discussion combined)
   - Cache everything
3. Shows progress indicator:
   ```
   Summarizing Stories...
   Processing story 5 of 12
   [Story Title]
   [Progress bar: 42% complete]
   ```

**After Completion:**
- All stories now show full content when selected
- Each story displays:
  - Title and metadata
  - AI Summary (article + discussion)
  - Full comment tree

## State Management Changes

### New State Properties

```javascript
state.notInterestedStories = new Set()  // Stories user marked as not interesting
state.summarized = new Set()            // Stories that have been summarized
state.isSummarizing = false             // Flag for batch processing
```

### Storage

**New keys in Chrome storage:**
- `notInterestedStories` - Array of story IDs marked as not interesting
- Persists across sessions

**Existing keys still used:**
- `readStories` - Stories marked as read
- `commentCache` - Cached comment data + HTML
- `summaryCache` - Cached AI summaries
- `scrollPositions` - Scroll position per story
- `filterSettings` - User's filter preferences

## Implementation Details

### Modified Functions

**`renderStoryDetail()` (content.js:375):**
- Now checks if story has been summarized
- If **not summarized**: Shows metadata only + instructions
- If **summarized**: Shows full content (metadata + summary + comments)
- No automatic loading of comments or summaries

**`applyFilters()` (content.js:193):**
- Filters out stories in `notInterestedStories` set
- Stories marked "not interested" never appear in filtered list

**`selectStory()` (content.js:353):**
- Unchanged - still saves scroll position before switching
- Still restores scroll position after rendering

### New Functions

**`markAsNotInterested()` (content.js:1048):**
```javascript
- Adds story to notInterestedStories set
- Saves to Chrome storage
- Re-applies filters to remove from list
- Auto-advances to next story (or previous if last)
- Updates sidebar
```

**`summarizeAll()` (content.js:1085):**
```javascript
- Filters stories that haven't been summarized
- Shows confirmation dialog with count
- Processes each story sequentially
- Shows progress indicator
- Calls summarizeSingleStory() for each
```

**`summarizeSingleStory(story)` (content.js:1138):**
```javascript
- Fetches comments (or uses cache)
- Generates full summary via generateSummary action
- Caches comments and summary
- Marks story as summarized
```

**`displayFullSummary(summary)` (content.js:1174):**
```javascript
- Displays article summary
- Displays discussion summary
- Shows interesting comments with click handlers
- Highlights comments when clicking author names
```

### Keyboard Shortcuts

**Updated `setupKeyboardShortcuts()` (content.js:977):**

Added:
- `l` - Mark as not interested
- `s` - Summarize all

Existing (unchanged):
- `j` - Navigate down
- `k` - Navigate up
- `Enter` - Open selected story
- `o` - Open article in new tab
- `e` - Mark as read
- `r` - Refresh stories
- `?` - Toggle help
- `Esc` - Close help

## API Calls

### Triage Phase (Before Summarization)
**API calls:** ZERO

Stories load with metadata only from HN API. No Claude API calls, no Jina AI calls.

### Batch Summarization Phase

For each story:
1. **HN API** - Fetch comments (if not cached)
2. **Jina AI** - Fetch article content (if URL exists, if not cached)
3. **Claude API** - Generate summary via `generateSummary` action
   - Uses the original full summary approach
   - Combines article + discussion in one API call
   - Max tokens: 2000

**API Cost Estimate:**
- 10 stories × ~8,000 tokens each = ~80,000 tokens
- Cost: ~$0.30-$0.50 for 10 stories
- Benefit: User only pays for stories they're interested in

## UI Changes

### New CSS Classes

**`.triage-instructions`** (styles.css:595)
- Styled box with instructions
- Centered text
- Keyboard shortcuts highlighted with `<kbd>` tags

**`.summarization-progress`** (styles.css:613)
- Progress screen during batch processing
- Large title and story name
- Progress counter

**`.progress-bar` and `.progress-fill`** (styles.css:627)
- Visual progress indicator
- Orange fill matches HN theme
- Smooth width transition

### Updated Keyboard Help

Help overlay now includes:
```
l - Mark as not interested
s - Summarize all stories
```

## User Experience

### Before Triage Mode

1. Open story → auto-loads comments + summary (10-20s wait)
2. Navigate to next story → auto-loads again
3. User wastes API credits on uninteresting stories
4. Browsing feels slow and forced

### After Triage Mode

1. Open story → instant metadata display
2. Quickly scan 20 stories in 30 seconds
3. Mark 15 as "not interested" with `l` key
4. Press `s` to summarize remaining 5 stories
5. Wait ~30-60 seconds for batch processing
6. Browse the 5 summarized stories with full content

**Result:** Faster browsing, lower costs, better control

## Edge Cases Handled

✅ **No stories left after triage:**
- Shows "All stories triaged!" message
- Suggests pressing `s` to summarize or `r` to refresh

✅ **All stories already summarized:**
- Alert: "All visible stories have already been summarized!"
- Doesn't re-process

✅ **Summarization in progress:**
- Pressing `s` again shows message: "Already summarizing..."
- Prevents duplicate processing

✅ **Mark last story as not interested:**
- Auto-selects previous story
- Doesn't crash if no stories left

✅ **Cached data:**
- Reuses cached comments and summaries
- Doesn't re-fetch unnecessarily

✅ **Scroll positions:**
- Still remembers scroll position per story
- Works for both summarized and unsummarized views

## Performance Improvements

### Before (Auto-load)
- Load 1st story: 10-20s
- Load 2nd story: 10-20s
- Load 3rd story: 10-20s
- **Total for 20 stories:** 200-400 seconds (3-7 minutes!)

### After (Triage Mode)
- Triage 20 stories: 30 seconds
- Remove 15 as not interesting: instant
- Summarize 5 stories: 30-60 seconds
- **Total time:** ~60-90 seconds (1-1.5 minutes!)

**Improvement:** 70-85% faster!

### Cost Savings

**Before:**
- Summarize all 20 stories = $0.60-$1.00

**After:**
- Summarize only 5 interesting stories = $0.15-$0.25

**Savings:** 75% cost reduction!

## Files Modified

### content.js
- Line 8: Added `notInterestedStories`, `summarized`, `isSummarizing` to state
- Line 32: Load `notInterestedStories` from storage
- Line 117-126: Updated keyboard help with new shortcuts
- Line 202: Filter out not interested stories in `applyFilters()`
- Line 375-452: Completely rewrote `renderStoryDetail()` for triage mode
- Line 991-996: Added `l` and `s` keyboard shortcuts
- Line 1048-1083: Added `markAsNotInterested()` function
- Line 1085-1135: Added `summarizeAll()` function
- Line 1138-1171: Added `summarizeSingleStory()` function
- Line 1174-1209: Added `displayFullSummary()` function

### styles.css
- Line 595-611: Added `.triage-instructions` styles
- Line 613-625: Added `.summarization-progress` styles
- Line 627-634: Added `.progress-bar` and `.progress-fill` styles

### No changes needed:
- background.js - All existing API handlers still work
- popup.html / popup.js - Settings and cost tracking unchanged
- manifest.json - Permissions unchanged

## Testing Checklist

### Basic Triage Flow
- [ ] Load extension - stories show metadata only
- [ ] Select story - shows metadata in main panel with instructions
- [ ] Press `l` - story disappears, auto-advances to next
- [ ] Press `j`/`k` - navigation still works

### Batch Summarization
- [ ] Triage down to 3-5 stories
- [ ] Press `s` - shows confirmation dialog
- [ ] Confirm - shows progress indicator
- [ ] Wait for completion - stories now show full content
- [ ] Click through stories - all have summaries + comments

### Edge Cases
- [ ] Press `l` on last story - doesn't crash
- [ ] Press `s` with no unsummarized stories - shows alert
- [ ] Press `s` while already summarizing - shows message
- [ ] Refresh page - not interested stories stay hidden
- [ ] Scroll in story, switch away, come back - scroll position remembered

### Keyboard Shortcuts
- [ ] `l` marks as not interested
- [ ] `s` starts batch summarization
- [ ] `o` opens article in new tab
- [ ] `e` marks as read
- [ ] `r` refreshes stories
- [ ] `?` shows updated help with new shortcuts

## Migration Notes

**For existing users:**
- Cached summaries from before still work
- Stories will show as summarized if cache exists
- No data loss - all caches preserved

**Breaking changes:**
- None! Fully backward compatible

## Future Enhancements

Possible improvements:

1. **Undo "not interested"** - Add keyboard shortcut to restore story
2. **Smart triage** - Auto-hide based on keywords/domains
3. **Batch size control** - Let user choose how many to summarize at once
4. **Background processing** - Summarize while user continues triaging
5. **Export not interested list** - Save filters for future sessions
6. **Parallel summarization** - Process multiple stories at once (faster but more complex)
7. **Preview mode** - Show first comment before triaging

## Summary

Triage mode transforms the UX from "passive inbox" to "active curation." Users quickly scan stories, remove noise, and only process what matters. The result is faster browsing, lower costs, and better control.

**Result:** 70-85% faster browsing, 75% cost savings, 100% user control! 🚀
