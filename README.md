# HN Inbox - Chrome Extension

An inbox-style interface for Hacker News with AI-powered summaries, inspired by Superhuman.

## Features

### Current Implementation

✅ **Two-Panel Layout**
- Left sidebar with filters and story list
- Main panel with story details and comments

✅ **Smart Filters**
- Minimum points threshold (0-500)
- Minimum comment count (0-200)
- Time range (24h, 3d, 7d, all time)
- Real-time story count

✅ **Keyboard Shortcuts** (Superhuman-style)
- `j/k` - Navigate up/down through stories
- `Enter` - Open selected story
- `o` - Open article in new tab
- `e` - Mark as read
- `r` - Refresh story list
- `?` - Show keyboard shortcuts

✅ **Comment Tree**
- Nested comment structure (preserves HN threading)
- Collapsible threads (click [-] to collapse)
- Shows author, time, and text
- Proper indentation for nested replies

✅ **Read/Unread Tracking**
- Visual indicator for read stories
- Persists across sessions

✅ **AI Summaries** (using Claude API)
- Article content summary (2-3 sentences via Jina AI Reader)
- Discussion summary (2-3 sentences)
- 3-5 "interesting comments" with explanations
- Clickable links to jump to comments in tree
- Comment highlighting when clicked from summary
- Smart caching to avoid regenerating summaries
- Loading states while generating

### Planned Features

🔜 **Enhanced Features**
- Article content caching
- Offline support for read stories
- Export summaries
- Search within discussions

## Installation

### 1. Add Extension Icons

Create three PNG icons in the `icons/` directory:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

You can use a simple orange bookmark or inbox icon to match the HN theme.

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `hn_browser` directory
5. The extension should now be installed!

### 3. Configure Claude API Key (Required for AI Summaries)

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Click the HN Inbox extension icon in Chrome toolbar
3. Paste your Claude API key (starts with `sk-ant-`)
4. Click "Save Settings"

**Note:** AI summaries will only work after you add your API key. See [AI_SUMMARY_SETUP.md](AI_SUMMARY_SETUP.md) for detailed setup instructions and cost information.

## Usage

1. Navigate to [news.ycombinator.com](https://news.ycombinator.com)
2. The page will be replaced with the HN Inbox interface
3. Use the filters in the left sidebar to narrow down stories
4. Use keyboard shortcuts to navigate:
   - Press `?` to see all shortcuts
   - Use `j/k` to navigate stories
   - Press `Enter` to view a story
   - Press `o` to open the article

## Architecture

### File Structure

```
hn_browser/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for API calls
├── content.js             # Main content script (replaces HN UI)
├── styles.css             # UI styles
├── popup.html             # Settings popup UI
├── popup.js               # Settings popup logic
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

### Key Components

**content.js**
- Replaces the HN page with custom UI
- Manages state (stories, filters, selection)
- Handles keyboard shortcuts
- Renders story list and comment tree
- Tracks read/unread status

**background.js**
- Service worker for API calls
- Fetches stories and comments from HN API
- Will handle Claude API calls for summaries
- Will fetch article content via Jina AI Reader

**Storage**
- `readStories` - Array of read story IDs
- `summaryCache` - Cached AI summaries
- `apiKey` - Claude API key

### HN API Endpoints

- Top stories: `https://hacker-news.firebaseio.com/v0/topstories.json`
- Story details: `https://hacker-news.firebaseio.com/v0/item/{id}.json`
- Comment details: `https://hacker-news.firebaseio.com/v0/item/{id}.json`

### Comment Tree Algorithm

Comments are rendered recursively:
1. Fetch comment by ID from HN API
2. Create comment element with proper indentation (depth × 20px)
3. Add collapse/expand functionality
4. Recursively render child comments (replies)
5. Attach to parent's reply container

## Next Steps

### Phase 1: AI Summaries (In Progress)

1. Implement Claude API integration in background.js
2. Fetch article content using Jina AI Reader API
3. Generate summaries for:
   - Article content
   - HN discussion
   - Interesting comments
4. Cache summaries to avoid regeneration
5. Add loading states

### Phase 2: Enhanced UX

1. Comment highlighting and scrolling
2. Better error handling
3. Retry logic for failed requests
4. Progress indicators for long operations
5. Accessibility improvements

### Phase 3: Advanced Features

1. Search within stories
2. Custom filters (by domain, author)
3. Save stories for later
4. Export summaries
5. Dark mode

## Development

### Testing

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the HN Inbox extension
4. Navigate to news.ycombinator.com to test

### Debugging

- Open Chrome DevTools (F12) on news.ycombinator.com to debug content.js
- Go to `chrome://extensions/` and click "service worker" to debug background.js
- Check console for errors and logs

## API Keys Required

- **Claude API**: Get from [Anthropic Console](https://console.anthropic.com/)
  - Used for generating AI summaries
  - Stored securely in Chrome storage
  - Never exposed in page context

## Security Notes

- API key is stored in Chrome's local storage (sandboxed per extension)
- API calls are made from background service worker (not page context)
- Content Security Policy enforced by Manifest V3
- No data sent to third parties except Claude API and Jina Reader

## License

MIT License - feel free to modify and distribute!

## Contributing

Contributions welcome! Some ideas:
- Add more keyboard shortcuts
- Improve filter options
- Better comment rendering
- Mobile-responsive design
- Dark mode
- Different AI providers

---

Built with ❤️ for the HN community
