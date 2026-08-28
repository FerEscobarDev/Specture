const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const hookPath = path.resolve(__dirname, "..", "pre-tool-use-tdd-gate.js");
const temporaryDirectories = [];

function createProject({ enabled = true, state, roadmap } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-claude-hook-"));
  temporaryDirectories.push(projectRoot);
  fs.mkdirSync(path.join(projectRoot, ".specture", "state"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".specture", "stack.yml"), "schema: 1\n");
  fs.writeFileSync(path.join(projectRoot, ".specture", "settings.yml"), `profile: custom\nhooks.enabled: ${enabled}\n`);
  if (state !== undefined) {
    fs.writeFileSync(path.join(projectRoot, ".specture", "state", "build-locked.json"), typeof state === "string" ? state : JSON.stringify(state));
  }
  if (roadmap !== undefined) {
    fs.mkdirSync(path.join(projectRoot, "docs", "04-roadmap"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), roadmap);
  }
  return projectRoot;
}

function runHook(cwd, targetPath) {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_input: { file_path: targetPath } })
  });
  return { status: result.status, stdout: result.stdout, json: result.stdout ? JSON.parse(result.stdout) : null };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("denies a sealed test file (legacy v1 schema) and names the RED commit", () => {
  const projectRoot = createProject({
    state: { epic: "accounts", red_sha: "deadbeef", test_paths: ["tests/**/*.test.js"] },
    roadmap: "- [/] **Epic 1.1:** accounts\n"
  });
  const { status, json } = runHook(projectRoot, path.join(projectRoot, "tests", "account.test.js"));

  assert.equal(status, 0);
  assert.equal(json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(json.hookSpecificOutput.permissionDecisionReason, /tests\/account\.test\.js/);
  assert.match(json.hookSpecificOutput.permissionDecisionReason, /deadbeef/);
});

test("denies with the matching spec's RED commit under the v2 multi-spec schema", () => {
  const projectRoot = createProject({
    state: {
      epic: "accounts",
      sealed_at: "2026-08-28T00:00:00Z",
      specs: [
        { slug: "01-model", red_sha: "aaa111", test_paths: ["tests/model/**/*.test.js"] },
        { slug: "02-api", red_sha: "bbb222", test_paths: ["tests/api/**/*.test.js"] }
      ]
    },
    roadmap: "- [/] **Epic 1.1:** accounts\n"
  });
  const { json } = runHook(projectRoot, path.join(projectRoot, "tests", "api", "account.test.js"));

  assert.equal(json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(json.hookSpecificOutput.permissionDecisionReason, /spec 02-api/);
  assert.match(json.hookSpecificOutput.permissionDecisionReason, /bbb222/);
  assert.equal(runHook(projectRoot, path.join(projectRoot, "src", "account.js")).stdout, "");
});

test("a stale seal (no [/] epic in the ROADMAP) fails open with a reason", () => {
  const projectRoot = createProject({
    state: { epic: "accounts", red_sha: "deadbeef", test_paths: ["tests/**/*.test.js"] },
    roadmap: "- [x] **Epic 1.1:** accounts\n- [ ] **Epic 1.2:** next\n"
  });
  const { json } = runHook(projectRoot, path.join(projectRoot, "tests", "account.test.js"));

  assert.equal(json.hookSpecificOutput.permissionDecision, "allow");
  assert.match(json.hookSpecificOutput.permissionDecisionReason, /stale seal/);
});

test("without a ROADMAP the seal is trusted; without hooks.enabled nothing happens", () => {
  const trusted = createProject({ state: { epic: "x", test_paths: ["tests/**"] } });
  assert.equal(runHook(trusted, path.join(trusted, "tests", "a.test.js")).json.hookSpecificOutput.permissionDecision, "deny");

  const disabled = createProject({ enabled: false, state: { epic: "x", test_paths: ["tests/**"] } });
  assert.equal(runHook(disabled, path.join(disabled, "tests", "a.test.js")).stdout, "");

  const corrupt = createProject({ state: "not-json" });
  assert.equal(runHook(corrupt, path.join(corrupt, "tests", "a.test.js")).stdout, "");
});
