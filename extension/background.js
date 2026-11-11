import { dayKey, isCommentCreate, celebration, DEFAULT_GOAL } from "./lib.js";

// Serialise writes so two quick comments can't overwrite each other.
// Resolves with today's new count.
let queue = Promise.resolve();
function adjustToday(delta) {
  queue = queue
    .then(async () => {
      const key = dayKey();
      const { counts = {} } = await chrome.storage.local.get("counts");
      const next = Math.max(0, (counts[key] || 0) + delta);
      if (next) counts[key] = next;
      else delete counts[key];
      await chrome.storage.local.set({ counts });
      return next;
    })
    .catch((err) => console.error("[LCS] save failed", err));
  return queue;
}

async function refreshBadge() {
  const { counts = {}, goal = DEFAULT_GOAL } = await chrome.storage.local.get(["counts", "goal"]);
  const n = counts[dayKey()] || 0;
  await chrome.action.setBadgeText({ text: n ? String(n) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: n >= goal ? "#1a7f37" : "#0a66c2" });
}

// --- Chime -----------------------------------------------------------------

let creating = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play a short chime when a LinkedIn comment is counted",
    })
    .finally(() => (creating = null));
  await creating;
}

async function chime(todayCount) {
  const { sound = true, goal = DEFAULT_GOAL } = await chrome.storage.local.get(["sound", "goal"]);
  if (!sound) return;
  await ensureOffscreen();
  await chrome.runtime.sendMessage({ target: "offscreen", type: "chime", goalHit: todayCount === goal });
}

// --- Goal celebration ------------------------------------------------------

// Shows the goal-reached overlay (celebrate.js) on the tab where the comment
// was posted. Once per day and goal, even if the count is fixed down and back.
async function showCelebration(tabId, todayCount) {
  if (tabId < 0) return;
  const { counts = {}, goal = DEFAULT_GOAL, celebrate = true, celebrated } = await chrome.storage.local.get([
    "counts",
    "goal",
    "celebrate",
    "celebrated",
  ]);
  const mark = `${dayKey()}/${goal}`;
  if (!celebrate || todayCount !== goal || celebrated === mark) return;
  // Fails if the tab was open before the extension was installed or updated.
  await chrome.tabs.sendMessage(tabId, { type: "celebrate", data: celebration(counts, goal) });
  await chrome.storage.local.set({ celebrated: mark });
}

// --- Detection -------------------------------------------------------------

let lastCountedAt = 0;
async function onComment(tabId) {
  // Guard against one comment triggering two matching requests.
  if (Date.now() - lastCountedAt < 2000) return;
  lastCountedAt = Date.now();
  console.info("[LCS] comment counted");
  const n = await adjustToday(1);
  if (!n) return;
  chime(n).catch((err) => console.warn("[LCS] chime failed", err));
  showCelebration(tabId, n).catch((err) => console.warn("[LCS] celebration failed", err));
}

// Watch LinkedIn's own API calls. Only the URL, method and status are read.
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === "POST") {
      // Open the service worker console to see these if counting ever stops.
      const u = new URL(details.url);
      console.debug("[LCS] POST", details.statusCode, u.pathname, u.searchParams.get("sduiid") || "");
    }
    if (isCommentCreate(details)) onComment(details.tabId);
  },
  { urls: ["https://www.linkedin.com/voyager/api/*", "https://www.linkedin.com/flagship-web/*"] }
);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "adjust" && (msg.delta === 1 || msg.delta === -1)) {
    adjustToday(msg.delta).then(() => sendResponse(true));
    return true;
  }
});

chrome.storage.onChanged.addListener(() => refreshBadge());

// Reset the badge after midnight.
chrome.alarms.onAlarm.addListener(() => refreshBadge());
function setup() {
  chrome.alarms.create("badge", { periodInMinutes: 15 });
  refreshBadge();
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
