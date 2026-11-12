// The waitlist API against real Postgres (PGlite, in memory).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createWaitlist, normEmail } from "../lib/waitlist.js";
import { memoryDb } from "../lib/memory-db.js";

let shared;
after(() => shared?.pg.close());

async function setup() {
  shared ??= await memoryDb();
  await shared.query("TRUNCATE waitlist RESTART IDENTITY");
  const db = shared;
  const handle = createWaitlist({ db });
  const call = async (method, body, contentType = "application/json") => {
    const res = await handle(
      new Request("https://tryrelink.test/api/waitlist", {
        method,
        headers: contentType ? { "content-type": contentType } : {},
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      })
    );
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { db, call, handle };
}

test("normEmail trims, lowercases and rejects junk", () => {
  assert.equal(normEmail("  Ryan@Example.COM "), "ryan@example.com");
  assert.equal(normEmail("no-at-sign"), null);
  assert.equal(normEmail("a@b"), null);
  assert.equal(normEmail(42), null);
  assert.equal(normEmail(`${"a".repeat(250)}@b.co`), null);
});

test("joining returns your place in line", async () => {
  const { call } = await setup();
  assert.deepEqual((await call("POST", { email: "one@example.com" })).body, { ok: true, position: 1 });
  assert.deepEqual((await call("POST", { email: "two@example.com" })).body, { ok: true, position: 2 });
});

test("joining twice keeps the first place and adds no row", async () => {
  const { call, db } = await setup();
  await call("POST", { email: "one@example.com" });
  await call("POST", { email: "two@example.com" });
  const again = await call("POST", { email: " ONE@example.com" });
  assert.deepEqual(again.body, { ok: true, position: 1 });
  const [{ n }] = await db.query("SELECT count(*)::int AS n FROM waitlist");
  assert.equal(n, 2);
});

test("an invalid email is refused", async () => {
  const { call } = await setup();
  const res = await call("POST", { email: "not an email" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "invalid_email");
});

test("the hidden bot field fakes success and stores nothing", async () => {
  const { call, db } = await setup();
  const res = await call("POST", { email: "bot@example.com", company: "Spam Inc" });
  assert.deepEqual(res.body, { ok: true, position: null });
  assert.equal((await db.query("SELECT 1 FROM waitlist")).length, 0);
});

test("attribution is stored, clipped, and the referrer keeps only its host", async () => {
  const { call, db } = await setup();
  await call("POST", {
    email: "utm@example.com",
    source: "hero",
    utm_source: "linkedin",
    utm_medium: "post",
    utm_campaign: "x".repeat(500),
    referrer: "https://www.linkedin.com/feed/update/urn:li:activity:123?secret=1",
  });
  const [row] = await db.query("SELECT * FROM waitlist");
  assert.equal(row.source, "hero");
  assert.equal(row.utm_source, "linkedin");
  assert.equal(row.utm_campaign.length, 100);
  assert.equal(row.referrer, "www.linkedin.com");
});

test("GET returns the live count, cached for only a few seconds", async () => {
  const { call } = await setup();
  assert.deepEqual((await call("GET", undefined, null)).body, { count: 0 });
  await call("POST", { email: "a@example.com" });
  await call("POST", { email: "b@example.com" });
  const res = await call("GET", undefined, null);
  assert.deepEqual(res.body, { count: 2 });
  assert.match(res.headers.get("cache-control"), /s-maxage=5\b/);
});

test("only JSON POSTs are accepted", async () => {
  const { call } = await setup();
  assert.equal((await call("POST", "email=a%40example.com", "application/x-www-form-urlencoded")).status, 415);
  assert.equal((await call("POST", "{not json", "application/json")).status, 400);
  assert.equal((await call("POST", "[1,2]", "application/json")).status, 400);
  assert.equal((await call("POST", JSON.stringify({ email: "a@example.com", pad: "x".repeat(5000) }))).status, 413);
});

test("other methods and paths are refused", async () => {
  const { call, handle } = await setup();
  const res = await call("PUT", { email: "a@example.com" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET, POST");
  assert.equal((await handle(new Request("https://tryrelink.test/api/other"))).status, 404);
});
