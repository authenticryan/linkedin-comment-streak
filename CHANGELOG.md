# Changelog

## 1.2.0 — 2026-11-07

- ⌘+Enter (Ctrl+Enter on Windows) posts the comment or reply you're typing.
- Counting now matches LinkedIn's `createComment` action exactly, so the `submitCommentButton` request that fires just before it can't cause a double count.

## 1.1.0 — 2026-11-07

- Chime when a comment is counted, plus a brighter chime when you hit your daily goal. On/off switch and preview in the popup.
- Supports LinkedIn's new web app (`/flagship-web/rsc-action/...`). Counting didn't work there before.

## 1.0.0 — 2026-11-07

- First version: counts comments posted on desktop, toolbar badge, GitHub-style heatmap, streaks, daily goal.
