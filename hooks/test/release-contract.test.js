// Release contract — what must be true of the repository for a version to be
// publishable. `scripts/bump-version.js` is the writer; this file is the reader.
//
//   1. Every manifest carries the same plugin version.
//   2. README.md has a changelog entry for that version.
//   3. Every hook command registered for any platform points to a script that exists.
//   4. `bump-version.js --check` agrees.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("every manifest carries the same plugin version", () => {
  const version = readJson("plugin.json").version;
  const claudePlugin = readJson(".claude-plugin/plugin.json");
  const marketplace = readJson(".github/plugin/marketplace.json");
  const matrix = readJson("copilot/compatibility-matrix.json");

  assert.match(version, /^\d+\.\d+\.\d+$/, "plugin.json version must be X.Y.Z");
  assert.equal(claudePlugin.version, version, ".claude-plugin/plugin.json");
  assert.equal(marketplace.metadata.version, version, ".github/plugin/marketplace.json metadata");
  assert.equal(marketplace.plugins[0].version, version, ".github/plugin/marketplace.json plugins[0]");
  assert.equal(matrix.claudeSource, version, "copilot/compatibility-matrix.json claudeSource");
});

test("README changelog has an entry for the current version", () => {
  const version = readJson("plugin.json").version;
  const heading = new RegExp(`^### v${version.replace(/\./g, "\\.")}(\\s|$)`, "m");

  assert.match(readText("README.md"), heading, `README.md must contain "### v${version} — <title>"`);
});

test("every registered hook command points to an existing script", () => {
  const commands = [];

  const settings = readJson("settings.json");
  for (const entries of Object.values(settings.hooks || {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks || []) commands.push(hook.command);
    }
  }

  const hooksJson = readJson("hooks.json");
  for (const entries of Object.values(hooksJson.hooks || {})) {
    for (const entry of entries) {
      if (entry.bash) commands.push(entry.bash);
      if (entry.powershell) commands.push(entry.powershell);
    }
  }

  assert.ok(commands.length >= 2, "expected hook commands in settings.json and hooks.json");
  for (const command of commands) {
    const match = command.match(/\$\{[A-Z_]+\}\/([^"']+)/);
    assert.ok(match, `cannot parse a plugin-relative script path from: ${command}`);
    assert.ok(
      fs.existsSync(path.join(root, match[1])),
      `${match[1]} is referenced by a hook command but does not exist`
    );
  }
});

test("bump-version --check passes on the current tree", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "bump-version.js"), "--check"],
    { cwd: root, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
