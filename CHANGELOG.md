# Changelog

## 1.5.0 — 2026-11-12

- Optional backup and sync. Sign in with a 6-digit code that is sent to your email. There is no password. Your daily counts and your goal sync between your computers, and they move with you to a new computer or to the Chrome Web Store version.
- Each computer keeps its own count, and the server adds them together, so two computers never overwrite each other. Your goal follows the most recent change.
- Backups run at most once an hour while you comment, and when Chrome starts. **Sync now** backs up at once. Your counts on this computer always update immediately.
- **Back up & sync** in the top-right corner of the popup shows the sync status. Its panel shows what the server has saved for you (comments, days and computers) and confirms when that matches the popup. From there you can sync now, sign out, change product-update emails, or delete your account and synced data.
- The extension works the same without an account.
- The goal celebration now shows on a LinkedIn tab that was open before the extension was installed, updated or reloaded. Before, it failed silently until you refreshed LinkedIn. Shift-click **Play** works on those tabs too.
- The goal moment also comes when synced comments from another computer take today's total past your goal: on your next comment, once per day.
- One new permission, `scripting`, to add the celebration to those tabs. Chrome shows no new warning for it.
- The sync server is in `server/` (Vercel Functions, Neon Postgres, Resend).

## 1.4.0 — 2026-11-11

- A goal celebration. When the comment that reaches your daily goal posts, LinkedIn dims and a card counts up to your goal, confetti made of heatmap squares bursts, and today's square fills in. The card shows your streak, how many goal days you have had, and the time you finished. It stays until you close it (button, Esc, or click outside), once per day.
- "Celebrate goal" switch in the popup. Shift-click **Play** on a LinkedIn tab to preview the whole goal moment: the goal chime and the celebration.
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
