// Prints the CHANGELOG section for a version, e.g. `node scripts/release-notes.mjs v1.2.0`.
import { readFileSync } from "node:fs";

const version = (process.argv[2] || "").replace(/^v/, "");
const log = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const start = log.indexOf(`## ${version}`);
if (start === -1) {
  console.log(`Release ${version}`);
} else {
  const rest = log.slice(start).split("\n").slice(1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  console.log(rest.slice(0, end === -1 ? undefined : end).join("\n").trim());
}
