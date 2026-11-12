// Local sync server. Sign-in codes print here instead of being emailed.
//   npm run dev        in-memory Postgres, starts empty every time
//   npm run dev:neon   the Neon branch in .env.local (production unless you ran `neon checkout`)
// Then, in the extension's service worker console:
//   chrome.storage.local.set({ apiBase: "http://127.0.0.1:8787" })
import http from "node:http";
import { createApp } from "./lib/app.js";
import { neonDb } from "./lib/db.js";
import { consoleMailer } from "./lib/email.js";

const PORT = Number(process.env.PORT) || 8787;
const url = process.env.DATABASE_URL;
const db = url ? neonDb(url) : await (await import("./lib/memory-db.js")).memoryDb();
const handle = createApp({ db, sendEmail: consoleMailer, secret: process.env.AUTH_SECRET || "dev-secret" });

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = {};
    for (const h of ["authorization", "content-type"]) if (req.headers[h]) headers[h] = req.headers[h];
    const response = await handle(
      new Request(`http://127.0.0.1:${PORT}${req.url}`, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      })
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  })
  .listen(PORT, "127.0.0.1", () => {
    const where = url ? `Neon branch ${process.env.NEON_BRANCH || new URL(url).hostname.split(".")[0]}` : "in-memory";
    console.log(`sync server on http://127.0.0.1:${PORT} (${where}, codes print here)`);
  });
