// Release gate: the project-schema files (templates/project-config, ROADMAP and
// SPEC templates, skills' Required Inputs) must match migrations/schema-manifest.json.
// Changing any of them requires `npm run schema:sync` — the moment to decide
// whether a migration is needed.

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");

test("schema manifest is in sync with the schema-defining files", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "schema-manifest.js"), "--check"], { cwd: root, encoding: "utf8" });

  assert.equal(result.status, 0, `${result.stderr}\nRun \`npm run schema:sync\` after deciding whether a migration is needed.`);
});
