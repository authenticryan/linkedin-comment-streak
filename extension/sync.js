// Optional sign-in and sync, run by the background worker.
//
// Storage (chrome.storage.local):
//   counts      this computer's comments per day (unchanged from before sync)
//   remote      the sum of the user's other computers per day, from the server
//   auth        { token, email, marketing } while signed in
//   sync        { at, error, saved } for the popup's status line and saved summary
//   deviceId    random id for this computer's rows on the server
// chrome.storage.session:
//   pendingLogin { email, marketing } between "email me a code" and the code
import { API_BASE } from "./config.js";

const local = chrome.storage.local;

export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function api(path, { method = "POST", body, token } = {}) {
  const { apiBase } = await local.get("apiBase");
  let res;
  try {
    res = await fetch(`${apiBase || API_BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("offline", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "server_error", res.status);
  return data;
}

export async function deviceId() {
  let { deviceId: id } = await local.get("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    await local.set({ deviceId: id });
  }
  return id;
}

// --- Sign-in ---------------------------------------------------------------

export async function startLogin(email, marketing) {
  await api("/api/login/start", { body: { email, marketing: Boolean(marketing) } });
  await chrome.storage.session.set({ pendingLogin: { email: email.trim().toLowerCase(), marketing: Boolean(marketing) } });
}

export async function resendCode() {
  const { pendingLogin } = await chrome.storage.session.get("pendingLogin");
  if (!pendingLogin) throw new ApiError("no_pending_login", 0);
  await startLogin(pendingLogin.email, pendingLogin.marketing);
}

export async function cancelLogin() {
  await chrome.storage.session.remove("pendingLogin");
}

export async function verifyLogin(code) {
  const { pendingLogin } = await chrome.storage.session.get("pendingLogin");
  if (!pendingLogin) throw new ApiError("no_pending_login", 0);
  const res = await api("/api/login/verify", { body: { email: pendingLogin.email, code, deviceId: await deviceId() } });
  await chrome.storage.session.remove("pendingLogin");
  await local.set({ auth: { token: res.token, email: res.email, marketing: res.marketing }, sync: {} });
  await syncNow();
}

async function clearAccount() {
  await local.remove(["auth", "remote", "sync"]);
}

export async function signOut() {
  const { auth } = await local.get("auth");
  await clearAccount();
  if (auth?.token) await api("/api/logout", { token: auth.token }).catch(() => {});
}

export async function setMarketing(marketing) {
  const { auth } = await local.get("auth");
  if (!auth?.token) return;
  const res = await api("/api/me", { method: "PATCH", token: auth.token, body: { marketing } });
  await local.set({ auth: { ...auth, marketing: res.marketing } });
}

export async function deleteAccount() {
  const { auth } = await local.get("auth");
  if (!auth?.token) return;
  await api("/api/me", { method: "DELETE", token: auth.token });
  await clearAccount();
}

// --- Sync ------------------------------------------------------------------

// Sends all of this computer's counts (a few KB even after years) and gets the
// other computers' totals back. Sending everything every time means a failed
// sync heals itself on the next one, with no change tracking.
async function doSync() {
  const s = await local.get(["auth", "counts", "goal", "goalUpdatedAt", "sync"]);
  if (!s.auth?.token) return;
  const body = { deviceId: await deviceId(), counts: s.counts || {} };
  // A goal set before sync existed counts as the oldest possible change.
  if (s.goal != null) Object.assign(body, { goal: s.goal, goalUpdatedAt: s.goalUpdatedAt || 1 });

  try {
    const res = await api("/api/sync", { token: s.auth.token, body });
    // `saved` is what the server holds for the whole account; the popup shows it.
    const patch = { remote: res.others || {}, sync: { at: Date.now(), ...(res.saved && { saved: res.saved }) } };
    if (res.goal && (res.goalUpdatedAt || 0) > (s.goalUpdatedAt || 0)) {
      Object.assign(patch, { goal: res.goal, goalUpdatedAt: res.goalUpdatedAt });
    }
    await local.set(patch);
  } catch (err) {
    if (err.status === 401) await clearAccount(); // signed out elsewhere, or account deleted
    else await local.set({ sync: { ...s.sync, error: err.code } });
    throw err;
  }
}

let running = null;
export function syncNow() {
  running ??= doSync().finally(() => (running = null));
  return running;
}

// At most one sync per 30 seconds while you comment. Each sync wakes the
// database, so this keeps it asleep most of the day (and inside free limits).
export async function syncSoon() {
  const { auth } = await local.get("auth");
  if (auth?.token && !(await chrome.alarms.get("sync"))) chrome.alarms.create("sync", { delayInMinutes: 0.5 });
}
