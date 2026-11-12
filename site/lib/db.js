// The production database: Neon over HTTP. query(text, params) -> rows.
// lib/memory-db.js has the same interface for tests and local development.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

export const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

// HTTP, not a pool: a sign-up is two short queries. Use the pooled DATABASE_URL.
export function neonDb(url) {
  const sql = neon(url);
  return { query: (text, params = []) => sql.query(text, params) };
}
