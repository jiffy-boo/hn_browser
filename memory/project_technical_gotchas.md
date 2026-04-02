---
name: HN Inbox - Technical Gotchas
description: Non-obvious technical details that are easy to miss or forget
type: project
---

**CORS header required for Claude API from browser:**
Direct browser calls to Anthropic API require the `anthropic-dangerous-direct-browser-access` header. Without it, requests silently fail. This is set in background.js's API call helper.

**Jina AI Reader fails ~10-20% of the time:**
Paywalled articles, dynamic JS-heavy sites, and timeouts cause failures. The app gracefully degrades — discussion summary still works, article summary section just says loading or shows an error. Don't treat Jina failure as a bug.

**Model:** `claude-haiku-4-5-20251001` — chosen for speed (3-5s responses). Sonnet would be 8-15s, Opus 15-30s. Already on the fastest option.

**Prompt size limits (set deliberately):**
- Article content: capped at 5,000 chars (not 15K)
- Comments: top 50 only (not all)
- Rationale: 40-50% cost/speed reduction with minimal quality loss

**Chrome storage keys in use:**
`commentCache`, `summaryCache`, `scrollPositions`, `readStories`, `notInterestedStories`, `notInterestedHistory`, `filterSettings`, `costTracking`, `apiKey`

**Cost tracking is client-side only:**
Uses token counts from API response to calculate cost. Keyed by a non-cryptographic hash of the API key (last 8 chars + length). Good enough for display, not for billing.

**Extension architecture:**
- `content.js` — replaces HN page, all UI and state
- `background.js` — service worker, all API calls (HN, Jina, Claude)
- `cost-tracker.js` — imported into background.js via `importScripts()`
- `popup.js` / `popup.html` — settings + cost display
