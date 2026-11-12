import { dayKey, isCommentCreate, celebration, totalCounts, DEFAULT_GOAL } from "./lib.js";
import {
  startLogin,
  resendCode,
  cancelLogin,
  verifyLogin,
  signOut,
  setMarketing,
  deleteAccount,
  syncNow,
  syncSoon,
  SYNC_EVERY_MIN,
} from "./sync.js";

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
      syncSoon();
      return next;
    })
    .catch((err) => console.error("[LCS] save failed", err));
  return queue;
}

// Everything the user sees: this computer plus their other synced computers.
async function totals() {
  const { counts = {}, remote = {} } = await chrome.storage.local.get(["counts", "remote"]);
  return totalCounts(counts, remote);
}

async function refreshBadge() {
  const { goal = DEFAULT_GOAL } = await chrome.storage.local.get("goal");
  const n = (await totals())[dayKey()] || 0;
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

async function ring(goalHit) {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({ target: "offscreen", type: "chime", goalHit });
}

async function chime(todayCount) {
  const { sound = true, goal = DEFAULT_GOAL } = await chrome.storage.local.get(["sound", "goal"]);
  if (sound) await ring(todayCount === goal);
}

// --- Goal celebration ------------------------------------------------------

// Shows the goal-reached overlay (celebrate.js) on the tab where the comment
// was posted. Once per day and goal, even if the count is fixed down and back.
async function showCelebration(tabId, todayCount) {
  if (tabId < 0) return;
  const { goal = DEFAULT_GOAL, celebrate = true, celebrated } = await chrome.storage.local.get([
    "goal",
    "celebrate",
    "celebrated",
  ]);
  const mark = `${dayKey()}/${goal}`;
  if (!celebrate || todayCount !== goal || celebrated === mark) return;
  // Fails if the tab was open before the extension was installed or updated.
  await chrome.tabs.sendMessage(tabId, { type: "celebrate", data: celebration(await totals(), goal) });
  await chrome.storage.local.set({ celebrated: mark });
}

// --- Detection -------------------------------------------------------------

let lastCountedAt = 0;
async function onComment(tabId) {
  // Guard against one comment triggering two matching requests.
  if (Date.now() - lastCountedAt < 2000) return;
  lastCountedAt = Date.now();
  console.info("[LCS] comment counted");
  if (!(await adjustToday(1))) return;
  // The goal counts comments from all your computers, so use the total.
  const n = (await totals())[dayKey()] || 0;
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
  // Shift+Play in the popup: the goal chime, played here because the popup
  // closes as soon as the celebration opens.
  if (msg?.type === "goalChime") ring(true).catch((err) => console.warn("[LCS] chime failed", err));

  // Sign-in and sync actions from the popup. Answers { ok } or { ok: false, error }.
  const action = ACCOUNT_ACTIONS[msg?.type];
  if (action) {
    action(msg).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err.code || "server_error" })
    );
    return true;
  }
});

const ACCOUNT_ACTIONS = {
  "auth:start": (m) => startLogin(m.email, m.marketing),
  "auth:resend": () => resendCode(),
  "auth:cancel": () => cancelLogin(),
  "auth:verify": (m) => verifyLogin(m.code),
  "auth:signout": () => signOut(),
  "account:marketing": (m) => setMarketing(Boolean(m.value)),
  "account:delete": () => deleteAccount(),
  "sync:now": () => syncNow(),
  "sync:soon": () => syncSoon(),
  // The popup opened: get the other computers' latest, unless the last sync
  // is less than an hour old (newer comments go with the hourly backup).
  "sync:pull": async () => {
    const { sync } = await chrome.storage.local.get("sync");
    if (!sync?.at || Date.now() - sync.at > SYNC_EVERY_MIN * 60_000) await syncNow();
  },
};

chrome.storage.onChanged.addListener(() => refreshBadge());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync") syncNow().catch(() => {});
  else refreshBadge(); // the 15-minute alarm resets the badge after midnight
});
function setup() {
  chrome.alarms.create("badge", { periodInMinutes: 15 });
  refreshBadge();
  syncNow().catch(() => {});
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
