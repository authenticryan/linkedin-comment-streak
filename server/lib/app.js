// The sync API: sign in with a 6-digit email code, then sync daily counts.
//
// createApp() takes its database and mailer as arguments, so the tests run
// it against an in-memory Postgres (PGlite) and a fake mailbox, and
// production runs it against Neon and Resend (see instance.js).
//
//   POST   /api/login/start   { email, marketing }           -> { ok }
//   POST   /api/login/verify  { email, code, deviceId }      -> { token, email, marketing }
//   POST   /api/sync          { deviceId, counts, goal?, goalUpdatedAt? }
//                                                           -> { others, goal, goalUpdatedAt }
//   GET    /api/me                                          -> { email, marketing }
//   PATCH  /api/me            { marketing }                  -> { email, marketing }
//   DELETE /api/me            (deletes the account and its data)
//   POST   /api/logout
//
// Everything after sign-in needs `Authorization: Bearer <token>`. No cookies,
// so allowing every origin (CORS) is safe and the extension needs no extra
// host permission.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const LIMITS = {
  codeMinutes: 10, // a code works for this long
  attempts: 5, // wrong guesses before a code stops working
  cooldownSeconds: 30, // between two codes for the same email
  sendsPerHour: 5, // codes per email per hour
  sessionDays: 365, // a session ends after this long without use
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_DAYS = 5000;
const MAX_BODY = 256 * 1024;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS } });
const fail = (status, error) => json(status, { error });

export function normEmail(v) {
  const email = typeof v === "string" ? v.trim().toLowerCase() : "";
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function createApp({ db, sendEmail, secret }) {
  if (!db || !sendEmail || !secret) throw new Error("createApp needs db, sendEmail and secret");

  const sha256 = (s) => createHash("sha256").update(s).digest("hex");
  const hashCode = (email, code) => createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
  const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

  // --- Sign-in ---------------------------------------------------------------

  async function startLogin({ email: raw, marketing }) {
    const email = normEmail(raw);
    if (!email) return fail(400, "invalid_email");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

    // Replaces any earlier code for this email, unless the rate limit says no.
    const rows = await db.query(
      `INSERT INTO login_codes (email, code_hash, expires_at, marketing_opt_in)
       VALUES ($1, $2, now() + make_interval(mins => $4), $3)
       ON CONFLICT (email) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         marketing_opt_in = excluded.marketing_opt_in,
         sent_at = now(),
         sends = CASE WHEN login_codes.window_start < now() - interval '1 hour' THEN 1 ELSE login_codes.sends + 1 END,
         window_start = CASE WHEN login_codes.window_start < now() - interval '1 hour' THEN now() ELSE login_codes.window_start END
       WHERE login_codes.sent_at < now() - make_interval(secs => $5)
         AND (login_codes.window_start < now() - interval '1 hour' OR login_codes.sends < $6)
       RETURNING email`,
      [email, hashCode(email, code), marketing === true, LIMITS.codeMinutes, LIMITS.cooldownSeconds, LIMITS.sendsPerHour]
    );
    if (!rows.length) return fail(429, "too_many_codes");

    try {
      await sendEmail({ to: email, code, minutes: LIMITS.codeMinutes });
    } catch (err) {
      console.error("[sync] email failed", err);
      // Let the user try again straight away.
      await db.query(`UPDATE login_codes SET sent_at = now() - interval '1 hour', sends = sends - 1 WHERE email = $1`, [email]);
      return fail(502, "email_failed");
    }
    return json(200, { ok: true });
  }

  async function verifyLogin({ email: raw, code: rawCode, deviceId }) {
    const email = normEmail(raw);
    const code = String(rawCode ?? "").replace(/\s/g, "");
    if (!email || !/^\d{6}$/.test(code)) return fail(400, "invalid_code");

    // Count the attempt first, so guesses are limited even if they race.
    const [row] = await db.query(
      `UPDATE login_codes SET attempts = attempts + 1
       WHERE email = $1 AND expires_at > now() AND attempts < $2
       RETURNING code_hash, marketing_opt_in`,
      [email, LIMITS.attempts]
    );
    if (!row || !same(row.code_hash, hashCode(email, code))) return fail(400, "invalid_code");

    // A code works once.
    const used = await db.query(`DELETE FROM login_codes WHERE email = $1 AND code_hash = $2 RETURNING email`, [
      email,
      row.code_hash,
    ]);
    if (!used.length) return fail(400, "invalid_code");

    // Ticking the box opts in; signing in again without it never opts out.
    const [user] = await db.query(
      `INSERT INTO users (email, marketing_opt_in, marketing_opt_in_at, last_seen_at)
       VALUES ($1, $2::boolean, CASE WHEN $2::boolean THEN now() END, now())
       ON CONFLICT (email) DO UPDATE SET
         last_seen_at = now(),
         marketing_opt_in = users.marketing_opt_in OR excluded.marketing_opt_in,
         marketing_opt_in_at = CASE WHEN NOT users.marketing_opt_in AND excluded.marketing_opt_in
                                    THEN now() ELSE users.marketing_opt_in_at END
       RETURNING id, email, marketing_opt_in`,
      [email, row.marketing_opt_in]
    );

    const token = randomBytes(32).toString("base64url");
    await db.query(`INSERT INTO sessions (token_hash, user_id, device_id) VALUES ($1, $2, $3)`, [
      sha256(token),
      user.id,
      DEVICE.test(deviceId ?? "") ? deviceId : null,
    ]);
    return json(200, { token, email: user.email, marketing: user.marketing_opt_in });
  }

  async function userFrom(req) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
    if (!m) return null;
    const [row] = await db.query(
      `UPDATE sessions SET last_used_at = now()
       WHERE token_hash = $1 AND last_used_at > now() - make_interval(days => $2)
       RETURNING user_id`,
      [sha256(m[1]), LIMITS.sessionDays]
    );
    return row ? { id: row.user_id, tokenHash: sha256(m[1]) } : null;
  }

  // --- Sync ------------------------------------------------------------------

  // The extension sends all of this computer's counts. We replace this
  // computer's rows with them (so fixes and deletions carry over) and answer
  // with the totals from the user's other computers, plus a summary of
  // everything saved for the account.
  async function sync(user, { deviceId, counts, goal, goalUpdatedAt }) {
    if (!DEVICE.test(deviceId ?? "")) return fail(400, "invalid_device");
    const entries = Object.entries(counts && typeof counts === "object" ? counts : {});
    const realDay = (d) => {
      const t = DAY.test(d) ? Date.parse(`${d}T00:00:00Z`) : NaN;
      return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d); // rejects 2026-02-30 and 2026-13-01
    };
    const valid = ([d, n]) => realDay(d) && Number.isInteger(n) && n >= 0 && n <= 100_000;
    if (entries.length > MAX_DAYS || !entries.every(valid)) return fail(400, "invalid_counts");
    const days = entries.filter(([, n]) => n > 0);

    const queries = [
      [
        `WITH input AS (SELECT * FROM unnest($3::date[], $4::int[]) AS t (day, count)),
         gone AS (
           DELETE FROM day_counts d
           WHERE d.user_id = $1 AND d.device_id = $2 AND d.day NOT IN (SELECT day FROM input)
         )
         INSERT INTO day_counts (user_id, device_id, day, count)
         SELECT $1, $2, day, count FROM input
         ON CONFLICT (user_id, device_id, day) DO UPDATE SET count = excluded.count, updated_at = now()
         WHERE day_counts.count <> excluded.count`,
        [user.id, deviceId, days.map(([d]) => d), days.map(([, n]) => n)],
      ],
    ];

    // Goal: the newest change wins. A timestamp in the future is capped to now.
    if (Number.isInteger(goal) && goal >= 1 && goal <= 1000 && Number.isFinite(goalUpdatedAt) && goalUpdatedAt > 0) {
      const at = Math.min(Math.round(goalUpdatedAt), Date.now());
      queries.push([
        `UPDATE users SET goal = $2, goal_updated_at = to_timestamp($3::float8 / 1000)
         WHERE id = $1 AND (goal_updated_at IS NULL OR goal_updated_at < to_timestamp($3::float8 / 1000))`,
        [user.id, goal, at],
      ]);
    }

    queries.push(
      [
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(count)::int AS count
         FROM day_counts WHERE user_id = $1 AND device_id <> $2 GROUP BY day`,
        [user.id, deviceId],
      ],
      [`SELECT goal, round(extract(epoch FROM goal_updated_at) * 1000)::float8 AS goal_at FROM users WHERE id = $1`, [user.id]],
      // What the server now holds for the whole account, so the popup can show it.
      [
        `SELECT coalesce(sum(count), 0)::int AS comments, count(DISTINCT day)::int AS days,
                count(DISTINCT device_id)::int AS computers
         FROM day_counts WHERE user_id = $1`,
        [user.id],
      ]
    );

    const results = await db.batch(queries);
    const others = Object.fromEntries(results.at(-3).map((r) => [r.day, r.count]));
    const me = results.at(-2)[0] || {};
    const saved = results.at(-1)[0];
    return json(200, { others, goal: me.goal ?? null, goalUpdatedAt: me.goal_at ?? null, saved });
  }

  // --- Account ---------------------------------------------------------------

  async function me(user) {
    const [row] = await db.query(`SELECT email, marketing_opt_in FROM users WHERE id = $1`, [user.id]);
    return row ? json(200, { email: row.email, marketing: row.marketing_opt_in }) : fail(401, "signed_out");
  }

  async function setMarketing(user, { marketing }) {
    if (typeof marketing !== "boolean") return fail(400, "invalid_marketing");
    await db.query(
      `UPDATE users SET marketing_opt_in = $2,
         marketing_opt_in_at = CASE WHEN $2 AND NOT marketing_opt_in THEN now() WHEN $2 THEN marketing_opt_in_at END
       WHERE id = $1`,
      [user.id, marketing]
    );
    return me(user);
  }

  async function deleteAccount(user) {
    // Sessions and counts go with the user (ON DELETE CASCADE).
    await db.query(
      `WITH u AS (DELETE FROM users WHERE id = $1 RETURNING email)
       DELETE FROM login_codes WHERE email IN (SELECT email FROM u)`,
      [user.id]
    );
    return json(200, { ok: true });
  }

  async function logout(user) {
    await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [user.tokenHash]);
    return json(200, { ok: true });
  }

  // --- Routing ---------------------------------------------------------------

  const open = {
    "POST /api/login/start": startLogin,
    "POST /api/login/verify": verifyLogin,
  };
  const signedIn = {
    "POST /api/sync": sync,
    "GET /api/me": me,
    "PATCH /api/me": setMarketing,
    "DELETE /api/me": deleteAccount,
    "POST /api/logout": logout,
  };

  async function readBody(req) {
    if (req.method === "GET" || req.method === "DELETE") return {};
    const text = await req.text();
    if (text.length > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
    try {
      const body = JSON.parse(text || "{}");
      return body && typeof body === "object" ? body : {};
    } catch {
      return {};
    }
  }

  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const route = `${req.method} ${new URL(req.url).pathname.replace(/\/+$/, "")}`;
    try {
      if (open[route]) return await open[route](await readBody(req));
      if (!signedIn[route]) return fail(404, "not_found");
      const user = await userFrom(req);
      if (!user) return fail(401, "signed_out");
      return await signedIn[route](user, await readBody(req));
    } catch (err) {
      if (err.status === 413) return fail(413, "too_large");
      console.error("[sync]", route, err);
      return fail(500, "server_error");
    }
  };
}
