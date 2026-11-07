# LinkedIn Comment Streak

A Chrome extension that counts the LinkedIn comments you post on desktop and shows them as a GitHub-style heatmap, so you can see how consistent you are with your daily commenting goal.

- Toolbar badge with today's count (turns green when you hit your goal)
- Year heatmap, current and longest streak, goal days in the last 30
- A soft ding for every comment, a brighter chime when you hit your goal
- ⌘+Enter (Ctrl+Enter on Windows) posts the comment you're typing
- No account, no server: everything stays in your browser

## Install (from source)

1. Download or clone this repo
2. Open `chrome://extensions` and turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension` folder
4. Pin it: puzzle-piece icon → pin **LinkedIn Comment Streak**

After pulling an update, click ↻ on the extension in `chrome://extensions` and refresh your LinkedIn tabs.

## Use

- Comment on LinkedIn as usual. The badge counts up and you hear a ding.
- Click the icon for the heatmap and streaks. Set your daily goal at the bottom (default 5).
- If a count is wrong, use **− / +** to fix today's number.
- **Chime** turns the sound on or off. **Play** previews it (shift-click for the goal chime).

Heatmap shades are relative to your goal: light = under half, mid = under goal, dark = goal met, darkest = 2× goal.

**What counts:** new comments and replies posted from this Chrome profile. Edits, deletes and failed posts don't count. Mobile comments aren't tracked.

**Privacy:** see [PRIVACY.md](PRIVACY.md). In short, it only looks at the address of LinkedIn's "post comment" request, never your comment text, and sends nothing anywhere.

## Development

```sh
npm test          # logic tests (counting rules, streaks, heatmap shades)
npm run check     # manifest + syntax checks
npm run package   # builds dist/linkedin-comment-streak-<version>.zip for the Chrome Web Store
```

No dependencies to install. Needs Node 20+.

- [MAINTAINING.md](MAINTAINING.md): what breaks, how to fix it, how to release
- [PUBLISHING.md](PUBLISHING.md): getting it on the Chrome Web Store
- [CHANGELOG.md](CHANGELOG.md)

Not affiliated with or endorsed by LinkedIn.
