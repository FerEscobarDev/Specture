// Release contract — what must be true of the repository for a version to be
// publishable. `scripts/bump-version.js` is the writer; this file is the reader.
//
//   1. Every manifest carries the same plugin version.
//   2. README.md has a changelog entry for that version.
//   3. Every hook command registered for any platform points to a script that exists.
//   4. `bump-version.js --check` agrees.
//   5. release.yml marks "Latest" only for the highest version tag.

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
  const rootPlugin = readJson("plugin.json");
  const version = rootPlugin.version;
  const claudePlugin = readJson(".claude-plugin/plugin.json");

  assert.match(version, /^\d+\.\d+\.\d+$/, "plugin.json version must be X.Y.Z");
  assert.equal(claudePlugin.version, version, ".claude-plugin/plugin.json");
  assert.equal(rootPlugin.name, claudePlugin.name, "both manifests name the same plugin");
});

// The root plugin.json is Antigravity's manifest. agy's loader rejects a manifest whose
// `skills` / `agents` / `hooks` keys are strings (`agy plugin validate`: "unexpected token
// \"skills/\". The loader skips this plugin") and discovers skills/ and hooks.json by convention.
// A `.antigravity-plugin/plugin.json` would only duplicate it (agy then warns that the root one
// is ignored), so there is none.
test("the root manifest is Antigravity's: no string component keys, no duplicate manifest", () => {
  const manifest = readJson("plugin.json");
  for (const key of ["skills", "agents", "hooks"]) {
    assert.ok(!(key in manifest), `plugin.json must not declare "${key}" — agy skips the plugin`);
  }
  assert.ok(!fs.existsSync(path.join(root, ".antigravity-plugin")), "one Antigravity manifest: the root plugin.json");
  assert.ok(!fs.existsSync(path.join(root, "copilot")), "Copilot CLI support was removed in v2.11.0 — no copilot/ directory");
  assert.ok(!fs.existsSync(path.join(root, ".github", "plugin")), "no Copilot marketplace manifest");
});

test("README changelog has an entry for the current version", () => {
  const version = readJson("plugin.json").version;
  const heading = new RegExp(`^### v${version.replace(/\./g, "\\.")}(\\s|$)`, "m");

  assert.match(readText("README.md"), heading, `README.md must contain "### v${version} — <title>"`);
});

// Claude Code loads a plugin's hooks from `hooks/hooks.json` (top-level `"hooks"` wrapper, same
// shape as `hooks` in settings.json, `${CLAUDE_PLUGIN_ROOT}` quoted). A plugin's own
// `settings.json` only contributes `agent` / `subagentStatusLine` — hooks declared there never
// run, which is how v1.2.0 → v2.9.0 shipped every gate inert (found in Psikora, 2026-10-18).
test("hooks/hooks.json registers the Claude Code gates in the shape Claude Code loads", () => {
  const registry = readJson("hooks/hooks.json");
  assert.ok(registry.hooks && !Array.isArray(registry.hooks), "top-level \"hooks\" wrapper is required");
  const groups = registry.hooks.PreToolUse;
  assert.ok(Array.isArray(groups) && groups.length >= 2, "PreToolUse must register the seal gate and the wait guard");

  const byScript = (name) => groups.find((g) => (g.hooks || []).some((h) => h.command.includes(name)));
  const seal = byScript("pre-tool-use-tdd-gate.js");
  const wait = byScript("pre-tool-use-wait-gate.js");
  assert.ok(seal, "seal gate not registered");
  assert.ok(wait, "wait guard not registered");
  for (const tool of ["Edit", "Write", "NotebookEdit"]) assert.ok(seal.matcher.split("|").includes(tool), `seal matcher must cover ${tool}`);
  for (const tool of ["Bash", "PowerShell"]) assert.ok(wait.matcher.split("|").includes(tool), `wait matcher must cover ${tool}`);

  for (const group of groups) {
    for (const hook of group.hooks) {
      assert.equal(hook.type, "command");
      assert.match(hook.command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/[^"]+"$/, `command runs through a shell: quote the plugin path (${hook.command})`);
    }
  }
  assert.ok(!fs.existsSync(path.join(root, "settings.json")), "a plugin settings.json does not register hooks — do not bring it back");
});

// Antigravity loads a plugin's hooks from the root `hooks.json`: every top-level key is the NAME
// of a hook group whose value maps events to matcher groups, each with a `hooks` array of
// `{ type: "command", command, timeout }`. A top-level `"version": 1` (the old Copilot shape) is
// not an object and makes agy drop the whole file; a handler without `command` never runs.
test("hooks.json registers the Antigravity gates in the shape agy loads", () => {
  const registry = readJson("hooks.json");
  assert.ok(!("version" in registry), "a top-level \"version\" key makes agy skip hooks.json");
  const groups = Object.entries(registry);
  assert.ok(groups.length >= 1, "at least one named hook group");
  const preToolUse = groups.flatMap(([, spec]) => spec.PreToolUse || []);
  assert.ok(preToolUse.length >= 2, "PreToolUse must register the seal gate and the wait guard");

  const byScript = (name) => preToolUse.find((g) => (g.hooks || []).some((h) => (h.command || "").includes(name)));
  const seal = byScript("specture-pre-tool-use-tdd-gate.js");
  const wait = byScript("specture-pre-tool-use-wait-gate.js");
  assert.ok(seal, "seal gate not registered");
  assert.ok(wait, "wait guard not registered");
  for (const tool of ["write_to_file", "replace_file_content", "multi_replace_file_content"]) {
    assert.ok(seal.matcher.split("|").includes(tool), `seal matcher must cover ${tool}`);
  }
  assert.ok(wait.matcher.split("|").includes("run_command"), "wait matcher must cover run_command");
  for (const group of preToolUse) {
    for (const hook of group.hooks) {
      assert.equal(hook.type || "command", "command");
      assert.match(hook.command, /^node "\$\{PLUGIN_ROOT\}\/hooks\/[^"]+"$/, `quote the plugin path (${hook.command})`);
      assert.ok(Number.isInteger(hook.timeout) && hook.timeout > 0, "timeout in seconds");
    }
  }
});

test("every registered hook command points to an existing script", () => {
  const commands = [];

  const claudeHooks = readJson("hooks/hooks.json");
  for (const entries of Object.values(claudeHooks.hooks || {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks || []) commands.push(hook.command);
    }
  }

  const hooksJson = readJson("hooks.json");
  for (const spec of Object.values(hooksJson)) {
    for (const entries of Object.values(spec)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        for (const hook of entry.hooks || []) commands.push(hook.command);
      }
    }
  }

  assert.ok(commands.length >= 4, "expected hook commands in hooks/hooks.json and hooks.json");
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

test("release.yml marks Latest only for the highest version tag", () => {
  const workflow = readText(".github/workflows/release.yml");

  assert.match(workflow, /git tag --list 'v\*' --sort=-v:refname/, "highest tag by version order, not lexical");
  assert.match(workflow, /gh release create [^\n]*--latest="\$LATEST"/, "create must pass --latest explicitly");
  assert.match(workflow, /gh release edit [^\n]*--latest="\$LATEST"/, "edit must pass --latest explicitly");
});
