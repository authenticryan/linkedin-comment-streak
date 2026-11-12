// The whole API against real Postgres (PGlite, in memory) and a fake mailbox.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp, normEmail, LIMITS } from "../lib/app.js";
import { memoryDb } from "../lib/memory-db.js";

// One in-memory Postgres for the file, emptied before each test.
after(() => shared?.pg.close());
let shared;
async function freshDb() {
  shared ??= await memoryDb();
  await shared.query("TRUNCATE users, login_codes, sessions, day_counts RESTART IDENTITY CASCADE");
  return shared;
}

async function setup() {
  const db = await freshDb();
  const inbox = [];
  const handle = createApp({ db, secret: "test-secret", sendEmail: async (m) => inbox.push(m) });
  const call = async (method, path, body, token) => {
    const res = await handle(
      new Request(`https://sync.test${path}`, {
        method,
        headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    );
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  // Lets a test skip the 30-second wait between codes.
  const skipCooldown = (email) => db.query(`UPDATE login_codes SET sent_at = now() - interval '1 minute' WHERE email = $1`, [email]);
  const signIn = async (email, deviceId, marketing = false) => {
    await skipCooldown(email);
    assert.equal((await call("POST", "/api/login/start", { email, marketing })).status, 200);
    const { code } = inbox.at(-1);
    const r = await call("POST", "/api/login/verify", { email, code, deviceId });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.token;
  };
  return { db, inbox, call, signIn, skipCooldown };
}

const A = "device-aaaa-1111";
const B = "device-bbbb-2222";

test("emails are trimmed, lowercased and checked", () => {
  assert.equal(normEmail("  Ryan@Example.COM "), "ryan@example.com");
  assert.equal(normEmail("not-an-email"), null);
  assert.equal(normEmail(42), null);
});

test("sign in with an emailed code, then sign out", async () => {
  const { inbox, call } = await setup();
  const start = await call("POST", "/api/login/start", { email: "Me@Example.com" });
  assert.equal(start.status, 200);
  assert.equal(start.headers.get("access-control-allow-origin"), "*");
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].to, "me@example.com");
  assert.match(inbox[0].code, /^\d{6}$/);

  const ok = await call("POST", "/api/login/verify", { email: "me@example.com", code: inbox[0].code, deviceId: A });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.email, "me@example.com");
  assert.equal(ok.body.marketing, false);
  const token = ok.body.token;

  assert.equal((await call("GET", "/api/me", undefined, token)).body.email, "me@example.com");
  // A code works once.
  assert.equal((await call("POST", "/api/login/verify", { email: "me@example.com", code: inbox[0].code })).status, 400);

  assert.equal((await call("POST", "/api/logout", {}, token)).status, 200);
  assert.equal((await call("GET", "/api/me", undefined, token)).status, 401);
});

test("wrong codes are limited, and expired codes fail", async () => {
  const { db, inbox, call, skipCooldown } = await setup();
  await call("POST", "/api/login/start", { email: "a@b.co" });
  const good = inbox[0].code;
  const bad = good === "000000" ? "111111" : "000000";
  for (let i = 0; i < LIMITS.attempts; i++) {
    assert.equal((await call("POST", "/api/login/verify", { email: "a@b.co", code: bad })).status, 400);
  }
  assert.equal((await call("POST", "/api/login/verify", { email: "a@b.co", code: good })).status, 400, "locked after 5 wrong tries");

  await skipCooldown("a@b.co");
  await call("POST", "/api/login/start", { email: "a@b.co" });
  await db.query(`UPDATE login_codes SET expires_at = now() - interval '1 second'`);
  assert.equal((await call("POST", "/api/login/verify", { email: "a@b.co", code: inbox.at(-1).code })).status, 400, "expired");
});

test("codes are rate limited per email", async () => {
  const { call, skipCooldown } = await setup();
  assert.equal((await call("POST", "/api/login/start", { email: "x@y.co" })).status, 200);
  assert.equal((await call("POST", "/api/login/start", { email: "x@y.co" })).status, 429, "30-second cooldown");
  for (let i = 1; i < LIMITS.sendsPerHour; i++) {
    await skipCooldown("x@y.co");
    assert.equal((await call("POST", "/api/login/start", { email: "x@y.co" })).status, 200);
  }
  await skipCooldown("x@y.co");
  assert.equal((await call("POST", "/api/login/start", { email: "x@y.co" })).status, 429, "5 per hour");
  assert.equal((await call("POST", "/api/login/start", { email: "other@y.co" })).status, 200, "other emails unaffected");
  assert.equal((await call("POST", "/api/login/start", { email: "nope" })).status, 400);
});

test("a failed email lets you retry at once", async () => {
  const db = await freshDb();
  let down = true;
  const sent = [];
  const handle = createApp({ db, secret: "s", sendEmail: async (m) => (down ? Promise.reject(new Error("down")) : sent.push(m)) });
  const start = () =>
    handle(new Request("https://sync.test/api/login/start", { method: "POST", body: JSON.stringify({ email: "r@t.co" }) }));
  assert.equal((await start()).status, 502);
  down = false;
  assert.equal((await start()).status, 200);
  assert.equal(sent.length, 1);
});

test("two computers sync without overwriting each other", async () => {
  const { call, signIn } = await setup();
  const tokenA = await signIn("me@x.co", A);
  const tokenB = await signIn("me@x.co", B);

  // A has history; B is new. A sees no other computers yet.
  let r = await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-10": 100, "2026-11-11": 40 } }, tokenA);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.others, {});
  assert.deepEqual(r.body.saved, { comments: 140, days: 2, computers: 1 });

  // B posts today and gets A's counts back. The summary covers both computers.
  r = await call("POST", "/api/sync", { deviceId: B, counts: { "2026-11-11": 25 } }, tokenB);
  assert.deepEqual(r.body.others, { "2026-11-10": 100, "2026-11-11": 40 });
  assert.deepEqual(r.body.saved, { comments: 165, days: 2, computers: 2 });

  // A fixes today down to 39 and drops yesterday; B sees exactly that.
  await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-11": 39 } }, tokenA);
  r = await call("POST", "/api/sync", { deviceId: B, counts: { "2026-11-11": 26 } }, tokenB);
  assert.deepEqual(r.body.others, { "2026-11-11": 39 });

  // And A sees B's latest.
  r = await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-11": 39 } }, tokenA);
  assert.deepEqual(r.body.others, { "2026-11-11": 26 });
  assert.deepEqual(r.body.saved, { comments: 65, days: 1, computers: 2 });
});

test("accounts never see each other's counts", async () => {
  const { call, signIn } = await setup();
  const me = await signIn("me@x.co", A);
  const you = await signIn("you@x.co", B);
  await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-11": 100 } }, me);
  const r = await call("POST", "/api/sync", { deviceId: B, counts: {} }, you);
  assert.deepEqual(r.body.others, {});
});

test("the newest goal wins across computers", async () => {
  const { call, signIn } = await setup();
  const t = await signIn("me@x.co", A);
  const sync = (deviceId, goal, goalUpdatedAt) => call("POST", "/api/sync", { deviceId, counts: {}, goal, goalUpdatedAt }, t);

  let r = await sync(A, 50, 1_000);
  assert.equal(r.body.goal, 50);
  assert.equal(r.body.goalUpdatedAt, 1_000);
  r = await sync(B, 100, 500); // older change: ignored
  assert.equal(r.body.goal, 50);
  r = await sync(B, 80, 2_000); // newer change: wins
  assert.equal(r.body.goal, 80);
  assert.equal(r.body.goalUpdatedAt, 2_000);
  r = await call("POST", "/api/sync", { deviceId: A, counts: {} }, t); // no goal sent
  assert.equal(r.body.goal, 80);
});

test("bad sync input is rejected", async () => {
  const { call, signIn } = await setup();
  const t = await signIn("me@x.co", A);
  assert.equal((await call("POST", "/api/sync", { deviceId: "x", counts: {} }, t)).status, 400);
  assert.equal((await call("POST", "/api/sync", { deviceId: A, counts: { "2026-13-45": 1 } }, t)).status, 400);
  assert.equal((await call("POST", "/api/sync", { deviceId: A, counts: { "2026-02-30": 1 } }, t)).status, 400);
  assert.equal((await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-11": -1 } }, t)).status, 400);
  assert.equal((await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-11": 1.5 } }, t)).status, 400);
  assert.equal((await call("POST", "/api/sync", { deviceId: A, counts: {} })).status, 401, "no token");
  assert.equal((await call("POST", "/api/sync", { deviceId: A, counts: {} }, "made-up")).status, 401);
  assert.equal((await call("GET", "/api/nothing")).status, 404);
});

test("marketing consent: opt in at sign-up, change later, never by accident", async () => {
  const { call, signIn } = await setup();
  const t = await signIn("me@x.co", A, true);
  assert.equal((await call("GET", "/api/me", undefined, t)).body.marketing, true);
  await signIn("me@x.co", B, false); // signing in again without the box doesn't opt out
  assert.equal((await call("GET", "/api/me", undefined, t)).body.marketing, true);
  assert.equal((await call("PATCH", "/api/me", { marketing: false }, t)).body.marketing, false);
  assert.equal((await call("PATCH", "/api/me", { marketing: "yes" }, t)).status, 400);
});

test("deleting the account removes its data and signs out everywhere", async () => {
  const { db, call, signIn } = await setup();
  const tA = await signIn("me@x.co", A);
  const tB = await signIn("me@x.co", B);
  await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-11": 100 } }, tA);
  assert.equal((await call("DELETE", "/api/me", undefined, tA)).status, 200);
  assert.equal((await call("GET", "/api/me", undefined, tB)).status, 401);
  for (const table of ["users", "sessions", "day_counts", "login_codes"]) {
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n, 0, table);
  }
});

test("CORS preflight", async () => {
  const { call } = await setup();
  const r = await call("OPTIONS", "/api/sync");
  assert.equal(r.status, 204);
  assert.match(r.headers.get("access-control-allow-headers"), /authorization/);
});
