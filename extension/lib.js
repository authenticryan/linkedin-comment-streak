// Shared logic for the background worker and the popup.

export const DEFAULT_GOAL = 100;

const pad = (n) => String(n).padStart(2, "0");

// Local-time date key, e.g. "2026-11-07".
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// True when a finished network request is LinkedIn creating a new comment
// (or a reply). Edits go to .../normComments/<id> and deletes use DELETE,
// so neither is counted.
export function isCommentCreate({ method, url, statusCode }) {
  if (method !== "POST") return false;
  if (statusCode < 200 || statusCode >= 300) return false;

  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!u.hostname.endsWith("linkedin.com")) return false;

  const path = u.pathname.toLowerCase().replace(/\/+$/, "");

  // Current REST endpoint, plus the older one as a fallback.
  if (path === "/voyager/api/voyagersocialdashnormcomments") return true;
  if (path === "/voyager/api/feed/comments") return true;

  // In case LinkedIn moves comment creation to GraphQL.
  if (path === "/voyager/api/graphql") {
    const q = (u.searchParams.get("queryId") || "").toLowerCase();
    return q.includes("normcomment") && q.includes("create");
  }

  // LinkedIn's newer web app sends every action to one endpoint and names
  // it in `sduiid`. A comment is "com.linkedin.sdui.comments.createComment"
  // (seen live, Nov 2026). The "submitCommentButton" request that fires just
  // before it goes to /actions/component and is ignored.
  if (path === "/flagship-web/rsc-action/actions/server-request") {
    const action = (u.searchParams.get("sduiid") || "").split(".").pop().toLowerCase();
    return action === "createcomment" || action === "createreply";
  }
  return false;
}

// Heatmap shade (0-4), relative to the daily goal so colour = consistency.
export function level(count, goal) {
  if (!count) return 0;
  const r = count / goal;
  if (r < 0.5) return 1;
  if (r < 1) return 2;
  if (r < 2) return 3;
  return 4;
}

export function computeStats(counts, goal, now = new Date()) {
  const today = startOfDay(now);
  const c = (d) => counts[dayKey(d)] || 0;

  // Current streak: consecutive days at or above goal. If today isn't
  // done yet, the streak is still alive from yesterday (GitHub-style).
  let current = 0;
  let d = c(today) >= goal ? today : addDays(today, -1);
  while (c(d) >= goal) {
    current++;
    d = addDays(d, -1);
  }

  let longest = 0;
  const keys = Object.keys(counts).filter((k) => counts[k] > 0).sort();
  if (keys.length) {
    let run = 0;
    for (let x = parseKey(keys[0]); x <= today; x = addDays(x, 1)) {
      if (c(x) >= goal) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
  }

  let yearTotal = 0;
  let goalDays30 = 0;
  for (let i = 0; i < 365; i++) {
    const v = c(addDays(today, -i));
    yearTotal += v;
    if (i < 30 && v >= goal) goalDays30++;
  }

  return { today: c(today), current, longest, yearTotal, goalDays30 };
}

// What the goal-reached overlay shows, read right after today hits the goal.
export function celebration(counts, goal, now = new Date()) {
  const today = startOfDay(now);
  const key = dayKey(today);
  const s = computeStats(counts, goal, now);
  // Longest streak before today, to tell if today set a new record.
  const before = computeStats({ ...counts, [key]: 0 }, goal, now).longest;

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    week.push({ day: d.getDay(), level: level(counts[dayKey(d)] || 0, goal) });
  }

  return {
    goal,
    streak: s.current,
    record: s.current > 1 && s.current > before,
    goalDays: Object.values(counts).filter((n) => n >= goal).length,
    // Today's heatmap shade one comment ago, so the overlay can fill it in.
    prevLevel: level(Math.max(0, (counts[key] || 0) - 1), goal),
    week,
  };
}

// This computer's counts plus the totals from the user's other computers
// (from sync). Everything the user sees is based on this.
export function totalCounts(local = {}, remote = {}) {
  const out = { ...local };
  for (const [day, n] of Object.entries(remote)) out[day] = (out[day] || 0) + n;
  return out;
}
