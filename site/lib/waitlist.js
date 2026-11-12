// The waitlist API behind tryrelink.live.
//
//   GET  /api/waitlist                                  -> { count }
//   POST /api/waitlist  { email, source?, utm_source?, utm_medium?, utm_campaign?, referrer? }
//                                                       -> { ok, position }
//
// createWaitlist() takes its database as an argument, so the tests run it
// against an in-memory Postgres (PGlite) and production runs it against Neon.
// The page and the API share one origin, so there are no CORS headers. A POST
// must be JSON: a form on another site cannot send JSON without a preflight.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY = 4 * 1024;

const json = (status, data, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

export function normEmail(v) {
  const email = typeof v === "string" ? v.trim().toLowerCase() : "";
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

const clip = (v, max = 100) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function hostOf(v) {
  try {
    return new URL(v).host.slice(0, 100) || null;
  } catch {
    return null;
  }
}

export function createWaitlist({ db }) {
  if (!db) throw new Error("createWaitlist needs db");

  async function join(body) {
    // Bots fill every field; people never see this one. Answer as if it worked.
    if (clip(body.company)) return json(200, { ok: true, position: null });

    const email = normEmail(body.email);
    if (!email) return json(400, { error: "invalid_email" });

    // A second sign-up with the same email keeps the first place in line.
    await db.query(
      `INSERT INTO waitlist (email, source, utm_source, utm_medium, utm_campaign, referrer)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [
        email,
        clip(body.source, 20),
        clip(body.utm_source),
        clip(body.utm_medium),
        clip(body.utm_campaign),
        hostOf(body.referrer),
      ]
    );
    const [row] = await db.query(
      `SELECT count(*)::int AS position FROM waitlist
       WHERE id <= (SELECT id FROM waitlist WHERE email = $1)`,
      [email]
    );
    return json(200, { ok: true, position: row.position });
  }

  return async function handle(req) {
    const { pathname } = new URL(req.url);
    if (pathname !== "/api/waitlist") return json(404, { error: "not_found" });

    try {
      if (req.method === "GET") {
        const [row] = await db.query("SELECT count(*)::int AS count FROM waitlist");
        // The page shows this live. A few seconds of CDN cache means a crowd of
        // visitors polling every 15 s still reaches the database only a few times a minute.
        return json(200, { count: row.count }, { "cache-control": "public, s-maxage=5, stale-while-revalidate=10" });
      }
      if (req.method === "POST") {
        if (!(req.headers.get("content-type") || "").includes("application/json")) {
          return json(415, { error: "json_only" });
        }
        const text = await req.text();
        if (text.length > MAX_BODY) return json(413, { error: "too_large" });
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          return json(400, { error: "invalid_json" });
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "invalid_json" });
        return await join(body);
      }
      return json(405, { error: "method_not_allowed" }, { allow: "GET, POST" });
    } catch (err) {
      console.error(err);
      return json(500, { error: "server_error" });
    }
  };
}
