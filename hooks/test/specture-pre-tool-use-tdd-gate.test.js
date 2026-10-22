// The universal seal gate (`hooks.json` hosts — Antigravity today). Two envelopes reach it:
// the Claude-style `{ tool_name, tool_input }` with cwd = project, and Antigravity's
// `{ toolCall: { name, args }, workspacePaths }` with cwd = the plugin directory. Both must deny
// the same things with the same reasons, and the decision must carry Antigravity's
// `decision` / `reason` next to the flat `permissionDecision` pair.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const hookPath = path.resolve(__dirname, "..", "specture-pre-tool-use-tdd-gate.js");
const DECISION_KEYS = ["decision", "reason", "permissionDecision", "permissionDecisionReason"];
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

// A directory that is NOT a Specture project — what Antigravity's hook cwd looks like (the
// plugin directory).
function pluginLikeCwd() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-plugin-cwd-"));
  temporaryDirectories.push(dir);
  return dir;
}

function spawnHook(cwd, payload) {
  return spawnSync(process.execPath, [hookPath], { cwd, encoding: "utf8", input: JSON.stringify(payload) });
}

// Claude-style envelope, cwd = project.
function runHook(cwd, targetPath) {
  return spawnHook(cwd, { hook_event_name: "PreToolUse", tool_input: { file_path: targetPath } });
}

// Antigravity envelope: camelCase protojson, cwd = plugin dir, the project in workspacePaths.
function runAgy(projectRoot, targetPath, { workspacePaths = [projectRoot], name = "write_to_file" } = {}) {
  return spawnHook(pluginLikeCwd(), {
    conversationId: "286b0abe-0fa3-443b-b112-ec565ac5070d",
    stepIdx: 19,
    toolCall: { name, args: { TargetFile: targetPath, CodeContent: "..." } },
    workspacePaths,
    modelName: "auto"
  });
}

function decision(result) {
  return JSON.parse(result.stdout);
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("denies a sealed test file with both decision shapes", () => {
  const projectRoot = createProject({
    state: { epic: "accounts", red_sha: "deadbeef", test_paths: ["tests/**/*.test.js"] }
  });
  const result = runHook(projectRoot, path.join(projectRoot, "tests", "account.test.js"));
  const reason =
    'TDD Honesty Gate: `tests/account.test.js` is part of the sealed test contract for epic "accounts" (RED commit deadbeef). Tests cannot be modified between the RED commit and the epic\'s completion.';

  assert.equal(result.status, 0);
  assert.deepEqual(decision(result), {
    decision: "deny",
    reason,
    permissionDecision: "deny",
    permissionDecisionReason: reason
  });
});

test("Antigravity envelope: finds the project in workspacePaths although cwd is the plugin directory", () => {
  const projectRoot = createProject({
    state: { epic: "accounts", red_sha: "deadbeef", test_paths: ["tests/**/*.test.js"] }
  });
  for (const name of ["write_to_file", "replace_file_content", "multi_replace_file_content"]) {
    const result = runAgy(projectRoot, path.join(projectRoot, "tests", "account.test.js"), { name });
    assert.equal(result.status, 0, name);
    const out = decision(result);
    assert.deepEqual(Object.keys(out), DECISION_KEYS, name);
    assert.equal(out.decision, "deny", name);
    assert.match(out.reason, /TDD Honesty Gate: `tests\/account\.test\.js`/, name);
  }
  // production file outside any seal rule → silent
  assert.equal(runAgy(projectRoot, path.join(projectRoot, "src", "account.js")).stdout, "");
});

test("Antigravity envelope: falls back to the target file's directory when workspacePaths is absent", () => {
  const projectRoot = createProject({
    state: { epic: "accounts", red_sha: "deadbeef", test_paths: ["tests/**/*.test.js"] }
  });
  const result = runAgy(projectRoot, path.join(projectRoot, "tests", "deep", "account.test.js"), { workspacePaths: [] });
  assert.equal(decision(result).decision, "deny");
});

test("allows a non-test file during a sealed build", () => {
  const projectRoot = createProject({ state: { test_paths: ["tests/**/*.test.js"] } });
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
  assert.match(decision(denied).reason, /spec 02-api.*bbb222/);

  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), "- [x] **Epic 1.1:** accounts\n");
  const stale = runHook(projectRoot, path.join(projectRoot, "tests", "api", "x.test.js"));
  assert.equal(stale.status, 0);
  assert.equal(stale.stdout, "", "allowed");
  assert.match(stale.stderr, /stale seal/);
});

test("fails open when hooks are disabled, state is corrupt, or the event targets no Specture project", () => {
  const disabledProject = createProject({ enabled: false, state: { test_paths: ["tests/**/*.test.js"] } });
  const corruptProject = createProject({ state: "not-json" });

  assert.equal(runHook(disabledProject, path.join(disabledProject, "tests", "account.test.js")).stdout, "");
  assert.equal(runHook(corruptProject, path.join(corruptProject, "tests", "account.test.js")).stdout, "");

  const elsewhere = pluginLikeCwd();
  const notAProject = spawnHook(pluginLikeCwd(), {
    toolCall: { name: "write_to_file", args: { TargetFile: path.join(elsewhere, "tests", "x.test.js") } },
    workspacePaths: [elsewhere]
  });
  assert.equal(notAProject.status, 0);
  assert.equal(notAProject.stdout, "");
});

test("v3: denies a sealed spec and a write outside allowed_paths with the shared reasons", () => {
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
  assert.deepEqual(Object.keys(decision(spec)), DECISION_KEYS);
  assert.match(decision(spec).reason, /Spec Seal.*SPEC_SHA abc1234/);

  const outside = runHook(projectRoot, path.join(projectRoot, "src", "billing", "x.js"));
  assert.match(decision(outside).reason, /Allowed Paths: `src\/billing\/x\.js`/);
  assert.equal(runHook(projectRoot, path.join(projectRoot, "src", "notas", "router.js")).stdout, "");

  // the same three rules through the Antigravity envelope
  assert.match(decision(runAgy(projectRoot, path.join(projectRoot, "src", "billing", "y.js"))).reason, /Allowed Paths/);
  assert.match(decision(runAgy(projectRoot, path.join(projectRoot, "docs", "05-specs", "epic-1.2-notas", "01-modelo-nota.spec.md"))).reason, /Spec Seal/);
  assert.equal(runAgy(projectRoot, path.join(projectRoot, "src", "notas", "service.js")).stdout, "");

  // stale v3 seal (no epic [/]) → all three kinds fail open with the reason on stderr
  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), "- [x] **Epic 1.2:** notas\n");
  for (const rel of [["docs", "05-specs", "epic-1.2-notas", "01-modelo-nota.spec.md"], ["src", "billing", "x.js"], ["tests", "notas", "modelo-nota.test.js"]]) {
    const stale = runHook(projectRoot, path.join(projectRoot, ...rel));
    assert.equal(stale.status, 0);
    assert.equal(stale.stdout, "", rel.join("/"));
    assert.match(stale.stderr, /stale seal/);
  }
});

test("after `seal-cli lift-spec` the lifted spec is editable and its sibling stays denied", () => {
  const projectRoot = createProject({
    state: {
      epic: "epic-1.2-notas",
      spec_sha: "abc1234",
      spec_paths: ["docs/05-specs/epic-1.2-notas/*.spec.md"],
      test_globs: ["tests/**/*.test.js"],
      specs: [{ slug: "01-modelo-nota", red_sha: "red111", test_paths: ["tests/notas/modelo-nota.test.js"] }]
    }
  });
  fs.mkdirSync(path.join(projectRoot, "docs", "04-roadmap"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), "- [/] **Epic 1.2:** notas\n");
  const specDir = path.join(projectRoot, "docs", "05-specs", "epic-1.2-notas");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "01-modelo-nota.spec.md"), "# 01\n");
  fs.writeFileSync(path.join(specDir, "02-api.spec.md"), "# 02\n");

  const sealCli = path.resolve(__dirname, "..", "lib", "seal-cli.js");
  const lifted = spawnSync(process.execPath, [sealCli, "lift-spec", "--slug", "02-api", "--project", projectRoot], { encoding: "utf8" });
  assert.equal(lifted.status, 0, lifted.stderr);

  const allowed = runHook(projectRoot, path.join(specDir, "02-api.spec.md"));
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, "", "the lifted spec is editable");
  const sibling = runHook(projectRoot, path.join(specDir, "01-modelo-nota.spec.md"));
  assert.equal(decision(sibling).decision, "deny");
  assert.match(decision(sibling).reason, /Spec Seal.*01-modelo-nota\.spec\.md/);
});
