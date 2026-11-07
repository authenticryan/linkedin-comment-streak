// Checks the manifest is valid and every file it points to exists.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../extension/", import.meta.url));
const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const errors = [];

if (m.manifest_version !== 3) errors.push("manifest_version must be 3");
if (!/^\d+\.\d+\.\d+$/.test(m.version)) errors.push(`version "${m.version}" should look like 1.2.3`);

const files = [
  m.background?.service_worker,
  m.action?.default_popup,
  ...Object.values(m.icons ?? {}),
  ...Object.values(m.action?.default_icon ?? {}),
  ...(m.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
  "offscreen.html",
].filter(Boolean);

for (const f of files) if (!existsSync(join(dir, f))) errors.push(`missing file: extension/${f}`);

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ manifest ok (v${m.version}, ${files.length} files checked)`);
