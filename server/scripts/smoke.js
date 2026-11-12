// Checks the real database end to end: signs up a throwaway user on two
// computers, syncs, checks the totals, then deletes the user again.
//   npm run smoke      uses the Neon branch in .env.local
// Leaves nothing behind, even when a step fails.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../lib/app.js";
import { neonDb } from "../lib/db.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("No DATABASE_URL. Run `neon env pull` in server/ first.");
const db = neonDb(url);
const inbox = [];
const handle = createApp({ db, secret: randomBytes(32).toString("hex"), sendEmail: async (m) => inbox.push(m) });

const email = `smoke-${randomBytes(4).toString("hex")}@example.com`;
const [A, B] = [randomUUID(), randomUUID()];

async function call(method, path, body, token) {
  const res = await handle(
    new Request(`https://smoke.test${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function signIn(deviceId) {
  // A second code inside 30 seconds is refused, so age the last one.
  await db.query(`UPDATE login_codes SET sent_at = now() - interval '1 minute' WHERE email = $1`, [email]);
  assert.equal((await call("POST", "/api/login/start", { email })).status, 200);
  const r = await call("POST", "/api/login/verify", { email, code: inbox.at(-1).code, deviceId });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.token;
}

async function step(name, fn) {
  const t = performance.now();
  await fn();
  console.log(`✓ ${name} (${Math.round(performance.now() - t)} ms)`);
}

const host = new URL(url).hostname.split(".")[0];
console.log(`Smoke test on ${process.env.NEON_BRANCH || "?"} branch (${host}) as ${email}`);
let a, b, userId;
try {
  await step("database answers", async () => assert.equal((await db.query("SELECT 1 AS ok"))[0].ok, 1));

  await step("email code: wrong code refused, right code signs in", async () => {
    assert.equal((await call("POST", "/api/login/start", { email })).status, 200);
    const wrong = inbox.at(-1).code === "000000" ? "111111" : "000000";
    assert.equal((await call("POST", "/api/login/verify", { email, code: wrong, deviceId: A })).body.error, "invalid_code");
    const r = await call("POST", "/api/login/verify", { email, code: inbox.at(-1).code, deviceId: A });
    assert.equal(r.status, 200);
    a = r.body.token;
    userId = (await db.query("SELECT id FROM users WHERE email = $1", [email]))[0].id;
  });

  await step("second computer signs in", async () => (b = await signIn(B)));

  await step("sync: each computer gets the other's counts, newest goal wins", async () => {
    const t = Date.now();
    let r = await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-10": 30, "2026-11-11": 5 }, goal: 50, goalUpdatedAt: t }, a);
    assert.deepEqual(r.body.others, {});
    r = await call("POST", "/api/sync", { deviceId: B, counts: { "2026-11-10": 25 }, goal: 100, goalUpdatedAt: t - 60_000 }, b);
    assert.deepEqual(r.body.others, { "2026-11-10": 30, "2026-11-11": 5 });
    assert.equal(r.body.goal, 50);
    r = await call("POST", "/api/sync", { deviceId: A, counts: { "2026-11-10": 31, "2026-11-11": 5 }, goal: 50, goalUpdatedAt: t }, a);
    assert.deepEqual(r.body.others, { "2026-11-10": 25 });
    assert.deepEqual(r.body.saved, { comments: 61, days: 2, computers: 2 });
    const rows = await db.query("SELECT count(*)::int AS n, sum(count)::int AS total FROM day_counts WHERE user_id = $1", [userId]);
    assert.deepEqual(rows[0], { n: 3, total: 61 });
  });

  await step("product-update emails: opt in and read back", async () => {
    assert.equal((await call("PATCH", "/api/me", { marketing: true }, a)).body.marketing, true);
    assert.equal((await call("GET", "/api/me", undefined, b)).body.marketing, true);
  });

  await step("delete account: signs out every computer, removes every row", async () => {
    assert.equal((await call("DELETE", "/api/me", undefined, a)).status, 200);
    assert.equal((await call("GET", "/api/me", undefined, b)).status, 401);
    const [left] = await db.query(
      `SELECT (SELECT count(*) FROM users WHERE id = $1)::int AS users,
              (SELECT count(*) FROM sessions WHERE user_id = $1)::int AS sessions,
              (SELECT count(*) FROM day_counts WHERE user_id = $1)::int AS days`,
      [userId]
    );
    assert.deepEqual(left, { users: 0, sessions: 0, days: 0 });
  });
} finally {
  await db.query("DELETE FROM users WHERE email = $1", [email]);
  await db.query("DELETE FROM login_codes WHERE email = $1", [email]);
}
console.log("✓ smoke test passed, test user removed");
