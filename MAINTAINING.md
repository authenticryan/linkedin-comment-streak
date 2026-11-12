# Maintaining

The code is small and has no dependencies. Nearly all future breakage comes from one place: **LinkedIn changing its website.** Chrome's extension APIs used here (Manifest V3, `webRequest`, `offscreen`) are stable.

## How the extension works

| File | Job | What can break it |
|---|---|---|
| `extension/lib.js` → `isCommentCreate` | Decides whether a LinkedIn network request was "post a comment" | LinkedIn renames the action or moves the endpoint |
| `extension/content.js` | ⌘+Enter finds and presses the Comment/Reply button | LinkedIn changes the comment box (labels, button text) |
| `extension/background.js` | Counts, updates the badge, triggers the chime and the goal celebration | Rarely: Chrome API changes |
| `extension/celebrate.js` | Goal celebration overlay on linkedin.com | Nothing external: it draws in its own shadow root |
| `extension/sync.js` | Optional sign-in and sync, called by the background worker | The sync server being down (the extension keeps counting locally and catches up later) |
| `server/` | Sync server: email-code sign-in, per-computer daily counts | Neon, Vercel or Resend outages, or their free limits |
| `extension/popup.*` | Heatmap, streaks, settings | Nothing external |

Today LinkedIn's web app posts a comment as:

```
POST /flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.comments.createComment
```

## When something breaks

### No ding or count after commenting

1. `chrome://extensions` → Comment Streak for LinkedIn → click **service worker** to open its console
2. Post a comment
3. Look at the `[LCS] POST ...` lines. One of them is the new "post a comment" request.
4. Update `isCommentCreate` in `extension/lib.js`, add that request name to `tests/lib.test.mjs`, run `npm test`
5. Fix the day's count with **+** in the popup

Watch out for lookalikes. Today a `submitCommentButton` request fires just before every `createComment`, and counting both would double count. Match the one action that only happens when a comment is actually saved.

### ⌘+Enter does nothing (or adds a line break)

The comment box changed. On linkedin.com, open DevTools and inspect the comment editor and its button. Then update `isCommentEditor` (the editor's `aria-label`) or `SUBMIT_LABEL` (the button text) in `extension/content.js`.

### LinkedIn in another language

`SUBMIT_LABEL` matches English button text (Comment / Reply / Post). Add translations there if you switch LinkedIn's language.

## Sync server

The extension works without it. When signed in, the extension sends all of this computer's counts at most once an hour while you comment, when you open the popup and the last sync is over an hour old, when Chrome starts, and when you click **Sync now**. Comments count locally at once; only the server copy waits. The server stores one row per day per computer and answers with the totals from your other computers.

### Where it runs

| Part | Where | Notes |
|---|---|---|
| API | Vercel project `comment-streak-sync` → https://comment-streak-sync.vercel.app | Region `sin1` (Singapore), next to the database. Set in `server/vercel.json`. |
| Database | Neon project `fragrant-sky-51831676`, branch `production` | AWS Singapore. To link a fresh copy: `cd server && neon link --org-id org-steep-sound-29743092 --project-id fragrant-sky-51831676` |
| Email | Resend | Sends from `onboarding@resend.dev` until a domain is verified |

Vercel has three secret environment variables (Production): `DATABASE_URL` (Neon, pooled), `RESEND_API_KEY`, and `AUTH_SECRET`. A new `AUTH_SECRET` (`openssl rand -hex 32`) only stops codes that were already sent. Optional: `EMAIL_FROM`, for example `Comment Streak <hello@yourdomain.com>`, after you verify the domain in Resend.

### Run it locally

```sh
cd server && npm install
npm test           # the API against real Postgres in memory (PGlite)
npm run dev        # local server on http://127.0.0.1:8787, empty in-memory database
npm run dev:neon   # the same, on the Neon branch in .env.local
```

Sign-in codes print in the terminal. To point the extension at the local server, open its service worker console and run `chrome.storage.local.set({ apiBase: "http://127.0.0.1:8787" })`. To go back, run `chrome.storage.local.remove("apiBase")`.

`server/.env.local` holds the Neon connection strings, and `server/.neon` the linked project. Git ignores both. To get `.env.local` again: `cd server && neon env pull`.

### Change the database or deploy

```sh
cd server
npm run migrate                # apply schema.sql to Neon (direct connection). Safe to run again.
npm run smoke                  # sign up a test user on two computers, sync, delete it. Leaves nothing.
vercel deploy --prod           # deploy the API
```

`schema.sql` only adds (`CREATE ... IF NOT EXISTS`). For a change to an existing table, test it on a Neon branch first: `neon checkout dev --create`, then `npm run migrate && npm run smoke`, then `neon checkout production`. The branch deletes itself after 7 days (`server/neon.ts`).

### Before other people use sync

- Verify a domain in Resend and set `EMAIL_FROM`. Without it, codes reach only your own inbox.
- In the Chrome Web Store listing, update the privacy practices: the extension now collects an email address (for sign-in) when the user turns on sync.

### Look at the data

In the Neon SQL editor:

```sql
SELECT email, marketing_opt_in, created_at, last_seen_at FROM users ORDER BY created_at DESC;
SELECT day, sum(count) FROM day_counts JOIN users ON users.id = user_id
WHERE email = 'you@example.com' GROUP BY day ORDER BY day DESC LIMIT 30;
```

## Releasing a new version

1. Make the change. Run `npm run check && npm test`.
2. Bump `version` in `extension/manifest.json` (patch for fixes, minor for features).
3. Add a section to `CHANGELOG.md`.
4. Commit and push, then tag:
   ```sh
   git tag v1.2.1 && git push --tags
   ```
5. GitHub Actions builds `linkedin-comment-streak-<version>.zip` and attaches it to a GitHub release. If you publish on the Chrome Web Store, upload that zip there (see PUBLISHING.md).

CI runs the checks and tests on every push to `main`.

## Your data

Counts live in Chrome's local storage for this extension. **Without Back up & sync, removing the extension, or switching from the unpacked version to a Chrome Web Store install, starts you from zero.** Sign in to Back up & sync first: on the new install, sign in again and the history comes back.

## Backlog (ideas, in priority order)

1. **Export** your history as a JSON file, for people who do not want an account.
2. **Self-check:** if you press Comment but no `createComment` is counted within a few seconds, show a "!" on the badge. You'd know straight away when LinkedIn changes something, instead of noticing days later.
3. Weekly summary in the popup (this week vs last week).
