import { dayKey, addDays, startOfDay, computeStats, celebration, level, totalCounts, DEFAULT_GOAL } from "./lib.js";
import { playChime } from "./chime.js";

const $ = (id) => document.getElementById(id);
const WEEKS = 53;
const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });
const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;

async function render() {
  const store = await chrome.storage.local.get(["counts", "remote", "goal", "sound", "celebrate", "auth", "sync"]);
  const { goal = DEFAULT_GOAL, sound = true, celebrate = true } = store;
  // This computer plus your other signed-in computers.
  const counts = totalCounts(store.counts, store.remote);
  const s = computeStats(counts, goal);
  renderAccount(store.auth, store.sync, counts);
  $("sound").checked = sound;
  $("celebrate").checked = celebrate;

  $("todayCount").textContent = s.today;
  $("goalLabel").textContent = goal;
  $("progressFill").style.width = `${Math.min(100, (s.today / goal) * 100)}%`;
  $("current").textContent = days(s.current);
  $("longest").textContent = days(s.longest);
  $("goal30").textContent = `${s.goalDays30}/30`;
  $("yearTotal").textContent = `${s.yearTotal.toLocaleString()} ${s.yearTotal === 1 ? "comment" : "comments"} in the last year`;
  if (document.activeElement !== $("goal")) $("goal").value = goal;

  // 53 week columns, Sunday-first, ending with the current week.
  const today = startOfDay();
  const start = addDays(today, -today.getDay() - (WEEKS - 1) * 7);

  const grid = $("grid");
  grid.replaceChildren();
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const n = counts[dayKey(d)] || 0;
    const cell = document.createElement("i");
    cell.className = `l${level(n, goal)}${d.getTime() === today.getTime() ? " today" : ""}`;
    cell.title = `${n} ${n === 1 ? "comment" : "comments"} on ${fmt.format(d)}`;
    grid.append(cell);
  }

  const months = $("months");
  months.replaceChildren();
  for (let w = 0; w < WEEKS; w++) {
    const ws = addDays(start, w * 7);
    if (ws.getDate() <= 7) {
      const label = document.createElement("span");
      label.style.gridColumn = String(w + 1);
      label.textContent = monthFmt.format(ws);
      months.append(label);
    }
  }
}

$("goal").addEventListener("change", (e) => {
  const v = Math.round(Number(e.target.value));
  if (v >= 1 && v <= 1000) {
    // The timestamp lets the newest goal win when several computers sync.
    chrome.storage.local.set({ goal: v, goalUpdatedAt: Date.now() });
    chrome.runtime.sendMessage({ type: "sync:soon" });
  } else render();
});
$("sound").addEventListener("change", (e) => chrome.storage.local.set({ sound: e.target.checked }));
$("celebrate").addEventListener("change", (e) => chrome.storage.local.set({ celebrate: e.target.checked }));

// Click: the normal ding. Shift-click: the whole goal moment (goal chime and
// celebration) on the LinkedIn tab you're looking at, as if today's comment
// had just reached the goal. Off LinkedIn, Shift-click plays the chime only.
$("testChime").addEventListener("click", async (e) => {
  if (!e.shiftKey) return playChime(false);

  const store = await chrome.storage.local.get(["counts", "remote", "goal"]);
  const { goal = DEFAULT_GOAL } = store;
  const counts = totalCounts(store.counts, store.remote);
  const key = dayKey();
  const data = celebration({ ...counts, [key]: Math.max(counts[key] || 0, goal) }, goal);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "celebrate", data });
    chrome.runtime.sendMessage({ type: "goalChime" });
    window.close();
  } catch {
    // No listener: not LinkedIn, or a LinkedIn tab opened before this version.
    playChime(true);
    const onLinkedIn = /^https:\/\/www\.linkedin\.com\//.test(tab?.url || "");
    const btn = $("testChime");
    btn.textContent = onLinkedIn ? "Refresh LinkedIn to see it" : "Open LinkedIn to see it";
    setTimeout(() => (btn.textContent = "Play"), 2500);
  }
});
$("plus").addEventListener("click", () => chrome.runtime.sendMessage({ type: "adjust", delta: 1 }));
$("minus").addEventListener("click", () => chrome.runtime.sendMessage({ type: "adjust", delta: -1 }));
// --- Back up & sync ---------------------------------------------------------

const MESSAGES = {
  invalid_email: "Enter a valid email address.",
  invalid_code: "That code is wrong or has expired. Check it, or send a new one.",
  too_many_codes: "Too many codes for this email. Wait a minute and try again.",
  email_failed: "The email didn't send. Try again in a minute.",
  no_pending_login: "Start again: enter your email.",
  offline: "Can't reach the sync server. Check your connection.",
  signed_out: "You were signed out. Sign in again.",
  server_error: "Something went wrong on the server. Try again.",
};
const dialog = $("accountDialog");

function ago(ms) {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return new Date(ms).toLocaleDateString();
}

async function renderAccount(auth, sync = {}, counts = {}) {
  const btn = $("account");
  btn.classList.toggle("on", Boolean(auth) && !sync.error);
  btn.classList.toggle("warn", Boolean(auth && sync.error));
  $("accountLabel").textContent = !auth ? "Back up & sync" : sync.error ? "Sync paused" : sync.at ? `Synced ${ago(sync.at)}` : "Syncing…";

  const { pendingLogin } = await chrome.storage.session.get("pendingLogin");
  const step = auth ? "account" : pendingLogin ? "code" : "email";
  if (dialog.dataset.step !== step) {
    dialog.dataset.step = step;
    note("");
  }
  if (auth) {
    $("accountEmail").textContent = auth.email;
    $("marketingOn").checked = Boolean(auth.marketing);
    $("syncStatus").textContent = sync.error
      ? `Last sync failed. ${MESSAGES[sync.error] || MESSAGES.server_error}`
      : sync.at && !sync.saved
        ? `Last synced ${ago(sync.at)}.`
        : "";
    // Proof that the backup worked: the server's own totals for the account.
    const saved = sync.saved;
    $("saved").hidden = !saved;
    if (saved) {
      const n = (x, word) => `${x.toLocaleString()} ${word}${x === 1 ? "" : "s"}`;
      $("savedValue").textContent = `${n(saved.comments, "comment")} over ${n(saved.days, "day")}`;
      $("savedMeta").textContent = `From ${n(saved.computers, "computer")} · synced ${ago(sync.at)}.`;
      const here = Object.values(counts).reduce((a, b) => a + b, 0);
      $("savedMatch").hidden = saved.comments !== here;
    }
  } else if (pendingLogin) {
    $("codeEmail").textContent = pendingLogin.email;
  }
}

function note(text, isError = false) {
  $("accountNote").textContent = text;
  $("accountNote").classList.toggle("error", isError);
}

// Runs a sign-in or sync action in the background worker.
async function act(type, payload = {}, button) {
  note("");
  if (button) button.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type, ...payload });
    if (!res?.ok) throw new Error(res?.error || "server_error");
    await render();
    return true;
  } catch (err) {
    note(MESSAGES[err.message] || MESSAGES.server_error, true);
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

$("account").addEventListener("click", async () => {
  note("");
  await render();
  dialog.showModal();
  if (dialog.dataset.step === "email") $("email").focus();
  if (dialog.dataset.step === "code") $("code").focus();
});
$("closeDialog").addEventListener("click", () => dialog.close());

// One request at a time per form (Enter plus the auto-submit can't send twice).
function onSubmit(form, run) {
  const button = form.querySelector("button[type=submit]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!button.disabled) await run(button);
  });
}
onSubmit($("emailForm"), async (button) => {
  if (await act("auth:start", { email: $("email").value, marketing: $("marketing").checked }, button)) {
    $("code").value = "";
    $("code").focus();
  }
});
onSubmit($("codeForm"), async (button) => {
  if (await act("auth:verify", { code: $("code").value.replace(/\D/g, "") }, button)) {
    note("You're signed in. Your history is backed up.");
  }
});
// Submit as soon as six digits are typed or pasted.
$("code").addEventListener("input", (e) => {
  if (e.target.value.replace(/\D/g, "").length === 6) $("codeForm").requestSubmit();
});
$("resend").addEventListener("click", async (e) => {
  if (await act("auth:resend", {}, e.target)) note("New code sent.");
});
$("changeEmail").addEventListener("click", () => act("auth:cancel"));

$("syncNow").addEventListener("click", async (e) => {
  if (await act("sync:now", {}, e.target)) note("Synced.");
});
$("marketingOn").addEventListener("change", async (e) => {
  if (!(await act("account:marketing", { value: e.target.checked }))) e.target.checked = !e.target.checked;
});
$("signOut").addEventListener("click", async (e) => {
  if (await act("auth:signout", {}, e.target)) dialog.close();
});
// Two clicks, so one slip can't delete the account.
let confirmDelete = 0;
$("deleteAccount").addEventListener("click", async (e) => {
  if (Date.now() - confirmDelete > 5000) {
    confirmDelete = Date.now();
    e.target.textContent = "Click again to delete your account and synced data";
    setTimeout(() => (e.target.textContent = "Delete my account and synced data"), 5000);
    return;
  }
  if (await act("account:delete", {}, e.target)) {
    dialog.close();
  }
});

chrome.storage.onChanged.addListener(render);

render();
// Get your other computers' latest counts (skipped if synced a minute ago).
chrome.runtime.sendMessage({ type: "sync:pull" }).catch(() => {});
