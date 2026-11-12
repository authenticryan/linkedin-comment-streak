// The production database: Neon over HTTP.
//   query(text, params) -> rows
//   batch([[text, params], ...]) -> [rows, ...]   (one transaction)
// lib/memory-db.js has the same interface for tests and local development.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

export const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

// HTTP, not a connection pool: each request runs a few short queries, and a
// batch is one round trip. Use the pooled DATABASE_URL here.
export function neonDb(url) {
  const sql = neon(url);
  return {
    query: (text, params = []) => sql.query(text, params),
    batch: (list) => sql.transaction(list.map(([text, params]) => sql.query(text, params))),
  };
}
