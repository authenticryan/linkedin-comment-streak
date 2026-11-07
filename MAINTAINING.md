# Maintaining

The code is small and has no dependencies. Nearly all future breakage comes from one place: **LinkedIn changing its website.** Chrome's extension APIs used here (Manifest V3, `webRequest`, `offscreen`) are stable.

## How the extension works

| File | Job | What can break it |
|---|---|---|
| `extension/lib.js` → `isCommentCreate` | Decides whether a LinkedIn network request was "post a comment" | LinkedIn renames the action or moves the endpoint |
| `extension/content.js` | ⌘+Enter finds and presses the Comment/Reply button | LinkedIn changes the comment box (labels, button text) |
| `extension/background.js` | Counts, updates the badge, triggers the chime | Rarely: Chrome API changes |
| `extension/popup.*` | Heatmap, streaks, settings | Nothing external |

Today LinkedIn's web app posts a comment as:

```
POST /flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.comments.createComment
```

## When something breaks

### No ding or count after commenting

1. `chrome://extensions` → LinkedIn Comment Streak → click **service worker** to open its console
2. Post a comment
3. Look at the `[LCS] POST ...` lines. One of them is the new "post a comment" request.
4. Update `isCommentCreate` in `extension/lib.js`, add that request name to `tests/lib.test.mjs`, run `npm test`
5. Fix the day's count with **+** in the popup

Watch out for lookalikes. Today a `submitCommentButton` request fires just before every `createComment`, and counting both would double count. Match the one action that only happens when a comment is actually saved.

### ⌘+Enter does nothing (or adds a line break)

The comment box changed. On linkedin.com, open DevTools and inspect the comment editor and its button. Then update `isCommentEditor` (the editor's `aria-label`) or `SUBMIT_LABEL` (the button text) in `extension/content.js`.

### LinkedIn in another language

`SUBMIT_LABEL` matches English button text (Comment / Reply / Post). Add translations there if you switch LinkedIn's language.

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

Counts live in Chrome's local storage for this extension. **Removing the extension, or switching from the unpacked version to a Chrome Web Store install, starts you from zero.** Two features would remove that risk (see backlog).

## Backlog (ideas, in priority order)

1. **Export / import** your history as a JSON file. Needed before switching to a Store install or a new computer.
2. **Self-check:** if you press Comment but no `createComment` is counted within a few seconds, show a "!" on the badge. You'd know straight away when LinkedIn changes something, instead of noticing days later.
3. Weekly summary in the popup (this week vs last week).
