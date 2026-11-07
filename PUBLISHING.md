# Publishing to the Chrome Web Store

**Short version:** yes, you can publish it. It costs a one-time $5 developer fee. Expect about an hour of setup and a review that usually takes a few days.

## Decisions to make first

### 1. The name

LinkedIn's trademark rules and the Store's impersonation policy make "LinkedIn" at the start of a product name a rejection risk. It reads as if LinkedIn made it.

**Decided (v1.2.1):** the extension is named **"Comment Streak for LinkedIn"**. Never use the LinkedIn logo or blue "in" mark. The current icon is fine. The GitHub repo name stays `linkedin-comment-streak`.

### 2. Visibility

| Option | Who can install | Good for |
|---|---|---|
| **Unlisted** | Anyone with the link; not searchable | Start here: you and a few friends, low exposure |
| Public | Everyone, appears in search | Once it's proven stable |
| Private | Only testers you name | Not needed |

### 3. Your existing history

A Store install is a different extension from your unpacked copy, so **it starts with an empty heatmap.** Build export/import first (MAINTAINING.md backlog #1) if you want to keep your history.

## Steps

1. **Register as a developer:** https://chrome.google.com/webstore/devconsole. Sign in, pay the $5 fee and accept the developer agreement. 2-Step Verification must be on for the Google account. _You have to do this step yourself._
2. **Build the zip:** `npm run package` → `dist/linkedin-comment-streak-<version>.zip`. Every tagged GitHub release also has it attached.
3. **New item → upload the zip.**
4. **Store listing tab**
   - Description (draft below), category **Productivity**, language English
   - Icon: 128×128 (taken from the zip)
   - At least 1 screenshot, **1280×800** (up to 5)
   - Small promo tile, **440×280**
5. **Privacy practices tab:** paste the answers below.
6. **Distribution:** pick visibility, then **Submit for review.**

Updates later: bump the version, upload the new zip, submit. Users get it automatically.

## Listing copy (draft)

**Summary (max 132 characters)**
> Count your LinkedIn comments, keep a daily streak, and see your consistency as a GitHub-style heatmap.

**Description**
> Building a presence on LinkedIn comes down to showing up every day. Comment Streak for LinkedIn counts the comments you post on LinkedIn (desktop) and turns them into a year-long heatmap, so you can see at a glance how consistent you are.
>
> • Toolbar badge with today's count, green when you hit your goal
> • Heatmap shaded by your daily goal, plus current and longest streaks
> • A soft chime for every comment and a brighter one when you hit your goal
> • ⌘+Enter / Ctrl+Enter to post the comment you're typing
>
> Private by design: no account, no server, no tracking. It never reads your comment text. Counts are stored only in your browser.
>
> Not affiliated with or endorsed by LinkedIn.

## Privacy practices answers

**Single purpose**
> Tracks how many comments the user posts on LinkedIn each day and shows their consistency as a heatmap with streaks.

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the daily comment counts, the user's daily goal and the chime setting locally. |
| `webRequest` | Detects when LinkedIn's "create comment" request completes successfully, using only its URL and status, so the comment can be counted. Request and response bodies are never read. |
| `alarms` | Refreshes the toolbar badge periodically so today's count resets after midnight. |
| `offscreen` | Plays a short chime when a comment is counted (extension service workers cannot play audio). |
| Host `https://www.linkedin.com/*` | Needed to observe LinkedIn's comment requests and to add the ⌘+Enter shortcut to LinkedIn's comment box. No other sites are accessed. |

**Remote code:** No, all code is in the package.

**Data usage:** tick no data types, since nothing leaves the browser. Certify all three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:**
`https://github.com/authenticryan/linkedin-comment-streak/blob/main/PRIVACY.md`

## Review risks

- **Trademark / name:** the most likely reason for rejection. See decision 1.
- **Host permission + `webRequest`:** these can trigger a slower manual review. The narrow host (linkedin.com only) and clear justifications help.
- **LinkedIn's terms:** they prohibit scraping and automation. This extension doesn't scrape and only presses the Comment button when you press ⌘+Enter, which is a user action, so the risk is low.

## Other stores (optional)

- **Microsoft Edge Add-ons:** free developer account, and Chrome extensions like this one usually work unchanged. Same zip.
- **Firefox:** would need changes (Firefox has no `offscreen` API for the chime). Not worth it unless people ask.

## Later: automatic Store uploads

The Chrome Web Store has an upload API. Once the listing exists, a GitHub Action can upload the zip from each tagged release. It needs an OAuth client ID, secret and refresh token stored as repo secrets. It's worth setting up only if you release often.
