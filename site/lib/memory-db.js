// Tests and local development: real Postgres compiled to WebAssembly, in
// memory. Same SQL and interface as lib/db.js. Kept apart from lib/db.js so
// the deployed function never bundles it.
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA } from "./db.js";

export async function memoryDb() {
  const pg = new PGlite();
  await pg.exec(SCHEMA);
  return { pg, query: async (text, params = []) => (await pg.query(text, params)).rows };
}
