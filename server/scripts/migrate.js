// Creates the tables in Neon. Safe to run again.
//   npm run migrate      reads .env.local (written by `neon deploy` / `neon env pull`)
// Uses the direct connection: Neon advises against running schema changes
// through the pooler.
import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "../lib/db.js";

const env = process.env;
const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || env.POSTGRES_URL;
if (!url) throw new Error("No DATABASE_URL. Run `neon env pull` in server/ first.");
const sql = neon(url);
const statements = SCHEMA.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
for (const s of statements) await sql.query(s);
console.log(`✓ schema applied to ${new URL(url).hostname.split(".")[0]} (${statements.length} statements)`);
