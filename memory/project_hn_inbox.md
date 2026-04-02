---
name: HN Inbox - Project Overview
description: What the project is, current feature set, and UX paradigm
type: project
---

Chrome extension (Manifest V3) that replaces the Hacker News UI with a Superhuman-style inbox. Uses Claude Haiku for AI summaries and Jina AI Reader for article content.

**Why:** The extension was first built as auto-loading (open story → auto-fetch comments + summary). This was too slow and expensive. It was redesigned to a triage-first workflow.

**Current UX paradigm (triage-first):**
1. Stories load with metadata only — zero API calls
2. User scans with `j`/`k`, presses `l` to discard stories (not interested)
3. User presses `s` to batch-summarize the remaining stories they care about
4. Batch runs sequentially in background with non-blocking progress bar
5. `u` key undoes "not interested"

Result: ~70-85% faster browsing, ~75% lower API costs vs. auto-load.

**AI summary pipeline:**
- Stage 1 (3-5s): Discussion summary from HN comments only
- Stage 2 (5-8s): Article summary via Jina AI Reader (if URL exists, not paywalled)
- Next story preloads in background after current story loads → feels instant on `j`+Enter
- Sidebar shows ⟳ (loading) / ✓ (ready) indicators

**Features implemented:**
- Triage mode (l/s/u keys)
- Progressive summary loading (discussion first, article second)
- Background preloading of next story
- Non-blocking batch summarization with progress bar
- Scroll position memory per story
- Read/unread tracking
- Comment tree with collapsible threads
- Cost tracking in popup (per API key hash)
- Clear cache debug button in popup
- Filters: min points, min comments, time range
