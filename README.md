# Comment Streak for LinkedIn

[![CI](https://github.com/authenticryan/linkedin-comment-streak/actions/workflows/ci.yml/badge.svg)](https://github.com/authenticryan/linkedin-comment-streak/actions/workflows/ci.yml)

**A GitHub-style streak for your LinkedIn comments.**

Comment Streak is a Chrome extension that counts the comments you post on LinkedIn and turns them into a year-long heatmap. You set a daily goal. Every comment adds a soft ding and bumps the toolbar badge, and the badge turns green when you hit the goal.

![Comment Streak popup: today's count of 4 out of 5, a 23-day current streak, 25 of the last 30 days on goal, and a year-long green heatmap](store/screenshot-1-1280x800.png)

**Chrome Web Store:** in review · **Download:** [latest release](https://github.com/authenticryan/linkedin-comment-streak/releases/latest) · **Privacy:** [nothing leaves your browser](PRIVACY.md)

---

## Why I built this

Every guide to growing on LinkedIn gives the same advice: comment thoughtfully on other people's posts, every day. Comments start conversations with people you'd like to know, and they put your name in front of audiences that don't follow you yet, long before your own posts take off.

So I set myself a goal of one hundred comments a day, and then realised I couldn't tell whether I was hitting it. LinkedIn shows impressions on your posts, but it gives you no daily count of the comments you write. The habit only works if you keep it up every day, and that was the part I couldn't see.

Developers already have a fix for this problem: GitHub's contribution graph. A green square for every day you showed up is a simple reason not to break the chain. So I built the same thing for LinkedIn comments. It counts on its own, so there's nothing to log, and it sits in the toolbar where I see it all day.

## What it does

- **Automatic counting.** Post a comment or a reply on linkedin.com and it's counted, with nothing to log by hand. Edits, deletes and failed posts don't count.
- **Toolbar badge.** Today's count is always visible. The badge turns from blue to green when you hit your goal.
- **Heatmap and streaks.** A year of days, each shaded by how close you came to your goal: light is under half, mid is under goal, dark is goal met and darkest is double. You also get your current streak, your longest streak and how many of the last 30 days hit the goal. Hover a day to see its count.
- **A ding for every comment.** A soft two-note chime plays for each comment, and a brighter four-note chime plays when you reach your goal. Preview it with **Play** (shift-click for the goal chime) or switch it off.
- **⌘+Enter to post.** (Ctrl+Enter on Windows) posts the comment you're typing.
- **Fixable.** If a count is ever wrong, **−** and **+** correct today's number.
- **Private.** No account, no server, no analytics. It never reads your comment text.

![Dark mode: a ding for every comment, the badge shows today's count, ⌘+Enter posts the comment you're typing](store/screenshot-2-1280x800.png)

## Product decisions

In a small product, most of the interesting decisions are about what to leave out, and why.

| Decision | Reasoning |
|---|---|
| **Count automatically from LinkedIn's own request** | People abandon trackers they have to update by hand. Watching for LinkedIn's "comment saved" request means counting takes zero effort, and only comments that actually posted are counted. |
| **Count one exact action and ignore lookalikes** | About 80 ms before every real `createComment`, LinkedIn fires a similar-looking `submitCommentButton` request. Counting both would double every number, and nobody keeps using a tracker they can't trust. |
| **Shade by your goal, not by raw volume** | GitHub shades a day by how busy it was. Here the colour answers one question: did I show up? Dark green means you met your goal, whether the goal is 2 a day or 10. |
| **Streaks survive until the day is over** | If the streak dropped to 0 every morning until your first comment, it would feel like a penalty. As on GitHub, it stays alive from yesterday until midnight. |
| **Show "Goal hit, last 30 days" next to the streak** | One missed day resets a streak to zero, and that's when people quit. Seeing 25/30 tells you you're still consistent, so one bad day doesn't end the habit. |
| **A chime, and a bigger one at the goal** | Instant feedback helps a habit stick, and the goal chime marks the finish line. The sound is generated in the browser, so there are no audio files, and it can be switched off. |
| **Let people fix the count** | Counting depends on LinkedIn's website, and that website changes. With − and +, a missed comment takes two seconds to fix and doesn't cost you your streak. |
| **⌘+Enter presses LinkedIn's own button** | It makes the core action faster without automating it. You still write and send every comment yourself, which keeps the extension clear of LinkedIn's rules against automation. |
| **Named "Comment Streak for LinkedIn"** | A name that starts with "LinkedIn" reads like an official product, which risks rejection from the Chrome Web Store. "X for LinkedIn" passes review and still matches what people search for. The listing uses no LinkedIn logo. |
| **No account, no server, narrow permissions** | It runs on a site full of private data, so it reads only the address and status of LinkedIn's own requests, and only on linkedin.com. That earns trust and keeps store review simple. |
| **Desktop only, and upfront about it** | A Chrome extension can't see the LinkedIn mobile app. The README and the store listing say so, so nobody is surprised by a low count. |

## How it's built

- **Manifest V3, vanilla JavaScript, no build step, zero dependencies.** About 550 lines in total. The store package is about 11 KB.
- **Counting without reading content.** The background service worker listens to `webRequest.onCompleted` on two LinkedIn URL patterns and looks only at each request's method, URL and status code. A comment counts when a `POST` to LinkedIn's create-comment action returns a 2xx status. It never reads request or response bodies.
- **Works on both versions of LinkedIn's site.** LinkedIn's classic web app uses its Voyager REST API. Its newer web app sends every action to a single endpoint and names the action in an `sduiid` parameter. The matcher handles both, with a GraphQL fallback. Support for the newer app shipped in v1.1.0, because counting didn't work there before.
- **No lost counts.** Storage writes go through a queue, so two comments posted seconds apart can't overwrite each other. A 2-second guard stops one comment from being counted twice.
- **Sound from a service worker.** Manifest V3 service workers can't play audio, so the chime runs in an offscreen document. The Web Audio API generates it from sine tones and an overtone, so there are no sound files.
- **Tested against real traffic.** The tests use request names captured on linkedin.com, including the lookalikes that must not count, and they also cover the streak and shading rules. They run on Node's built-in test runner.
- **Built to be fixed fast.** The service worker logs every LinkedIn `POST` it sees. If LinkedIn changes its endpoint, the new request name appears in the console after a single test comment. [MAINTAINING.md](MAINTAINING.md) is the runbook.
- **Store images from the real UI.** A script renders the actual popup in headless Chrome with a year of sample data, so the screenshots show the real product, not a mockup.
- **Light and dark.** It follows the system theme and uses GitHub's contribution-graph palette.
- **Release pipeline.** On every push, GitHub Actions validates the manifest and runs the tests. Pushing a `v*` tag builds the store zip and publishes a GitHub release, with notes taken from the changelog. The release fails if the tag and manifest versions disagree.

## Go-to-market notes

How I'd take this from side project to something people find:

- **Who it's for:** people who grow on LinkedIn by commenting. That means job seekers trying to get noticed by hiring managers, founders and B2B sellers doing social selling, and new creators building an audience before their own posts take off.
- **Positioning:** for people building a LinkedIn presence one comment at a time, Comment Streak makes daily consistency visible. LinkedIn analytics tools track outputs you can't control (impressions, followers). Comment Streak tracks the input you can: comments. And unlike AI comment tools, it never writes anything for you.
- **Discovery:** Chrome Web Store search comes first ("LinkedIn comments", "LinkedIn streak", "LinkedIn habit"), so the listing's name, summary and screenshots do most of the work. LinkedIn itself comes next. Growth coaches already tell their clients to comment every day, and this gives them a tool to recommend.
- **The product markets itself:** for developers, a green contribution graph is already a status symbol. A shareable "90 days of comments" image, posted on LinkedIn, would reach exactly the people likely to install it.
- **What I'd measure:** the extension has no analytics by design, so the Chrome Web Store dashboard is the scoreboard: weekly active users, installs against uninstalls, and rating. Activation is the first comment counted, which proves counting works for that user. Retention is still being active after 30 days. Anything deeper would need opt-in telemetry, and that would cost trust.
- **Biggest risk:** dependence on LinkedIn's platform. LinkedIn can change its website at any time, and it already has once (v1.1.0). The safeguards: tests built on real request names, a debug log with a runbook, a manual fix for the count, and a planned self-check that flags when counting stops.

## Roadmap

- Export and import your history as a file, so a new computer or a reinstall keeps your heatmap
- Self-check: a "!" on the badge if you press Comment and nothing is counted, so a LinkedIn change gets caught in seconds rather than days
- Weekly summary: this week compared with last week
- Shareable heatmap image (the growth loop above)
- Microsoft Edge Add-ons (the same package should work unchanged)

## Run it locally

1. Clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension/` folder.
3. Pin it (puzzle-piece icon → pin **Comment Streak for LinkedIn**), then comment on linkedin.com.

After pulling an update, click ↻ on the extension in `chrome://extensions` and refresh your LinkedIn tabs.

```sh
npm test                    # detection, streak and heatmap tests
npm run check               # manifest and syntax checks
npm run package             # build dist/linkedin-comment-streak-<version>.zip for the Chrome Web Store
sh scripts/store-assets.sh  # regenerate store screenshots, promo tile and icons (macOS, needs Chrome)
```

You don't need to run `npm install`, because there are no dependencies. Requires Node 20+.

## Repository

```
extension/              The extension (load this folder unpacked)
  manifest.json         MV3 manifest: permissions, linkedin.com host, popup
  background.js         Service worker: detects comments, counts, badge, chime
  lib.js                Shared logic: comment matcher, streaks, heatmap shades
  content.js            ⌘+Enter shortcut on LinkedIn's comment box
  popup.html/css/js     Heatmap, streaks and settings
  offscreen.*, chime.js Chime playback (Web Audio, no sound files)
  icons/
tests/                  Logic tests (Node, no dependencies)
scripts/                Manifest check, store zip, release notes, store images, icons
store/                  Store screenshots, promo tile, icon and their HTML sources
.github/workflows/      CI and tag-driven releases
MAINTAINING.md          What breaks, how to fix it, how to release
PUBLISHING.md           Chrome Web Store submission guide
PRIVACY.md              Privacy policy
CHANGELOG.md            Release history
```

## Versioning

[Semantic Versioning](https://semver.org/), with `extension/manifest.json` as the source of truth. Every release is a tagged commit with a [changelog](CHANGELOG.md) entry and a GitHub release that has the store zip attached. The full process is in [MAINTAINING.md](MAINTAINING.md).

## Credits

- The heatmap: GitHub's contribution graph, including its colour palette.
- Built by Ryan Dsouza, with [Claude Code](https://claude.com/claude-code) as pair programmer.
- [MIT licensed](LICENSE). Not affiliated with or endorsed by LinkedIn.
