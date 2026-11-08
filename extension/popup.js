import { dayKey, addDays, startOfDay, computeStats, level, DEFAULT_GOAL } from "./lib.js";
import { playChime } from "./chime.js";

const $ = (id) => document.getElementById(id);
const WEEKS = 53;
const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });
const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;

async function render() {
  const { counts = {}, goal = DEFAULT_GOAL, sound = true } = await chrome.storage.local.get(["counts", "goal", "sound"]);
  const s = computeStats(counts, goal);
  $("sound").checked = sound;

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
  if (v >= 1 && v <= 1000) chrome.storage.local.set({ goal: v });
  else render();
});
$("sound").addEventListener("change", (e) => chrome.storage.local.set({ sound: e.target.checked }));
// Click once for the normal ding, shift-click to hear the goal chime.
$("testChime").addEventListener("click", (e) => playChime(e.shiftKey));
$("plus").addEventListener("click", () => chrome.runtime.sendMessage({ type: "adjust", delta: 1 }));
$("minus").addEventListener("click", () => chrome.runtime.sendMessage({ type: "adjust", delta: -1 }));
chrome.storage.onChanged.addListener(render);

render();
