# Quick Setup Guide

## Step 1: Create Extension Icons

You need three icon files for the Chrome extension. Use one of these methods:

### Method A: Use the Icon Generator (Easiest)

1. Open `create-icons.html` in your browser
2. Click the download buttons for each icon size
3. Save the files to the `icons/` folder as:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### Method B: Create Your Own Icons

Create three PNG files (16×16, 48×48, 128×128) with an orange inbox/envelope design and save them in the `icons/` folder.

### Method C: Use Placeholder Icons Temporarily

You can use any PNG images temporarily - just name them correctly and place them in `icons/`.

## Step 2: Load Extension in Chrome

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" button
5. Select the `hn_browser` folder
6. You should see "HN Inbox" in your extensions list!

## Step 3: Test the Extension

1. Navigate to https://news.ycombinator.com
2. The page should be replaced with the HN Inbox interface
3. Try the keyboard shortcuts:
   - Press `?` to see all shortcuts
   - Use `j` and `k` to navigate through stories
   - Press `Enter` to open a story
   - Press `o` to open the article in a new tab
   - Press `e` to mark as read

## Step 4: Configure Filters

In the left sidebar, you can:
- Adjust minimum points (0-500)
- Adjust minimum comments (0-200)
- Filter by time range (24h, 3 days, 7 days, all time)
- See the count of stories matching your filters

## Step 5: Optional - Add Claude API Key

The AI summary features aren't implemented yet, but you can prepare by:

1. Click the extension icon in your Chrome toolbar
2. Enter your Claude API key from https://console.anthropic.com/
3. Click "Save Settings"

The key will be stored securely for when AI features are added.

## Troubleshooting

### Extension doesn't load
- Make sure all files are in the correct location
- Check that icon files exist in the `icons/` folder
- Look for errors in `chrome://extensions/` (expand the extension card)

### Page doesn't change when visiting HN
- Refresh the extension: go to `chrome://extensions/` and click the reload icon
- Check the browser console (F12) for JavaScript errors
- Make sure you're on `https://news.ycombinator.com` (not `http://`)

### Stories not loading
- Open the browser console (F12) and check for network errors
- The HN API might be temporarily down - try refreshing with `r`
- Check your internet connection

### Keyboard shortcuts not working
- Make sure you're not typing in a text input field
- Try clicking on the page first to ensure it has focus
- Check if another extension is conflicting

## Development Mode

If you want to modify the code:

1. Make your changes to the files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the HN Inbox extension card
4. Reload the HN page to see your changes

## What's Working Now

✅ Story list with filters
✅ Keyboard navigation (j/k/Enter/o/e/r/?)
✅ Comment tree with collapsible threads
✅ Read/unread tracking
✅ Clean, minimal UI

## What's Coming Next

🔜 AI-powered summaries (article + discussion)
🔜 Interesting comment extraction
🔜 Click to jump to comments
🔜 Better loading states
🔜 Article content fetching

---

Enjoy your new HN Inbox! 📬
