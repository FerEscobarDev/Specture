const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const hookPath = path.resolve(
  __dirname,
  "..",
  "copilot-pre-tool-use-tdd-gate.js"
);
const temporaryDirectories = [];

function createProject({ enabled = true, state } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-hook-"));
  temporaryDirectories.push(projectRoot);
  fs.mkdirSync(path.join(projectRoot, ".specture", "state"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".specture", "stack.yml"), "schema: 1\n");
  fs.writeFileSync(
    path.join(projectRoot, ".specture", "conventions.md"),
    `- **hooks.enabled**: ${enabled}\n`
  );

  if (state !== undefined) {
    const content = typeof state === "string" ? state : JSON.stringify(state);
    fs.writeFileSync(
      path.join(projectRoot, ".specture", "state", "build-locked.json"),
      content
    );
  }

  return projectRoot;
}

function runHook(cwd, targetPath) {
  return spawnSync(process.execPath, [hookPath], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_input: { file_path: targetPath }
    })
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("denies a sealed test file", () => {
  const projectRoot = createProject({
    state: {
      epic: "accounts",
      red_sha: "deadbeef",
      test_paths: ["tests/**/*.test.js"]
    }
  });
  const targetPath = path.join(projectRoot, "tests", "account.test.js");
  const result = runHook(projectRoot, targetPath);

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    permissionDecision: "deny",
    permissionDecisionReason:
      'TDD Honesty Gate: `tests/account.test.js` is part of the sealed test contract for epic "accounts" (RED commit deadbeef). Tests cannot be modified between the RED commit and the epic\'s completion.'
  });
});

test("allows a non-test file during a sealed build", () => {
  const projectRoot = createProject({
    state: { test_paths: ["tests/**/*.test.js"] }
  });
  const result = runHook(projectRoot, path.join(projectRoot, "src", "account.js"));

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("denies under the v2 multi-spec schema and fails open on a stale seal", () => {
  const projectRoot = createProject({
    state: { epic: "accounts", specs: [{ slug: "02-api", red_sha: "bbb222", test_paths: ["tests/api/**/*.test.js"] }] }
  });
  fs.mkdirSync(path.join(projectRoot, "docs", "04-roadmap"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), "- [/] **Epic 1.1:** accounts\n");
  const denied = runHook(projectRoot, path.join(projectRoot, "tests", "api", "x.test.js"));
  assert.match(JSON.parse(denied.stdout).permissionDecisionReason, /spec 02-api.*bbb222/);

  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), "- [x] **Epic 1.1:** accounts\n");
  const stale = runHook(projectRoot, path.join(projectRoot, "tests", "api", "x.test.js"));
  assert.equal(stale.status, 0);
  assert.equal(stale.stdout, "", "allowed");
  assert.match(stale.stderr, /stale seal/);
});

test("fails open when hooks are disabled or state is corrupt", () => {
  const disabledProject = createProject({
    enabled: false,
    state: { test_paths: ["tests/**/*.test.js"] }
  });
  const corruptProject = createProject({ state: "not-json" });

  assert.equal(
    runHook(disabledProject, path.join(disabledProject, "tests", "account.test.js"))
      .stdout,
    ""
  );
  assert.equal(
    runHook(corruptProject, path.join(corruptProject, "tests", "account.test.js"))
      .stdout,
    ""
  );
});

test("v3: denies a sealed spec and a write outside allowed_paths with the shared reasons (Copilot/Antigravity envelope)", () => {
  const projectRoot = createProject({
    state: {
      epic: "epic-1.2-notas",
      spec_sha: "abc1234",
      spec_paths: ["docs/05-specs/epic-1.2-notas/*.spec.md"],
      test_globs: ["tests/**/*.test.js"],
      allowed_paths: ["src/notas/"],
      specs: [{ slug: "01-modelo-nota", red_sha: "red111", test_paths: ["tests/notas/modelo-nota.test.js"] }]
    }
  });
  fs.mkdirSync(path.join(projectRoot, "docs", "04-roadmap"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), "- [/] **Epic 1.2:** notas\n");

  const spec = runHook(projectRoot, path.join(projectRoot, "docs", "05-specs", "epic-1.2-notas", "01-modelo-nota.spec.md"));
  assert.deepEqual(Object.keys(JSON.parse(spec.stdout)), ["permissionDecision", "permissionDecisionReason"]);
  assert.match(JSON.parse(spec.stdout).permissionDecisionReason, /Spec Seal.*SPEC_SHA abc1234/);

  const outside = runHook(projectRoot, path.join(projectRoot, "src", "billing", "x.js"));
  assert.match(JSON.parse(outside.stdout).permissionDecisionReason, /Allowed Paths: `src\/billing\/x\.js`/);
  assert.equal(runHook(projectRoot, path.join(projectRoot, "src", "notas", "router.js")).stdout, "");

  // Antigravity's field name
  const agy = spawnSync(process.execPath, [hookPath], {
    cwd: projectRoot,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_input: { TargetFile: path.join(projectRoot, "src", "billing", "y.js") } })
  });
  assert.match(JSON.parse(agy.stdout).permissionDecisionReason, /Allowed Paths/);
});
