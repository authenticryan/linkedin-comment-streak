# Changelog

## 1.4.0 — 2026-11-11

- A goal celebration. When the comment that reaches your daily goal posts, LinkedIn dims and a card counts up to your goal, confetti made of heatmap squares bursts, and today's square fills in. The card shows your streak, how many goal days you have had, and the time you finished. It stays until you close it (button, Esc, or click outside), once per day.
- "Celebrate goal" switch and a **Preview** button in the popup. Preview shows the celebration on the LinkedIn tab you are looking at.
- No new permissions.

## 1.3.0 — 2026-11-08

- Built for power users: the default daily goal is now 100 comments (was 5), and you can set a goal up to 1,000 (was 100). A goal you already set doesn't change.
- The yearly total shows a thousands separator (for example, 14,049 comments).
- Store screenshots show a power user's year at the new default goal.

## 1.2.1 — 2026-11-07

- Renamed to "Comment Streak for LinkedIn" for the Chrome Web Store, so the name doesn't look like an official LinkedIn product.
- Store listing images added in `store/`.

## 1.2.0 — 2026-11-07

- ⌘+Enter (Ctrl+Enter on Windows) posts the comment or reply you're typing.
- Counting now matches LinkedIn's `createComment` action exactly, so the `submitCommentButton` request that fires just before it can't cause a double count.

## 1.1.0 — 2026-11-07

- Chime when a comment is counted, plus a brighter chime when you hit your daily goal. On/off switch and preview in the popup.
- Supports LinkedIn's new web app (`/flagship-web/rsc-action/...`). Counting didn't work there before.

## 1.0.0 — 2026-11-07

- First version: counts comments posted on desktop, toolbar badge, GitHub-style heatmap, streaks, daily goal.
