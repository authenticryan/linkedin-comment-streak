// Local preview of tryrelink.live: the static page from public/ plus the waitlist API.
//   npm run dev        in-memory Postgres, starts empty every time
//   npm run dev:neon   the Neon database in .env.local (production data)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createWaitlist } from "./lib/waitlist.js";
import { neonDb } from "./lib/db.js";

const PORT = Number(process.env.PORT) || 8790;
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const url = process.env.DATABASE_URL;
const db = url ? neonDb(url) : await (await import("./lib/memory-db.js")).memoryDb();
const handle = createWaitlist({ db });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    if (path.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const response = await handle(
        new Request(`http://127.0.0.1:${PORT}${req.url}`, {
          method: req.method,
          headers: req.headers["content-type"] ? { "content-type": req.headers["content-type"] } : {},
          body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
        })
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    // Static files, with clean URLs like Vercel (/privacy -> privacy.html).
    const rel = normalize(path === "/" ? "/index.html" : path).replace(/^(\.\.[/\\])+/, "");
    for (const file of [rel, `${rel}.html`]) {
      try {
        const body = await readFile(join(PUBLIC, file));
        res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
        return res.end(body);
      } catch {}
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`tryrelink.live preview on http://127.0.0.1:${PORT} (${url ? "Neon" : "in-memory"} waitlist)`);
  });
