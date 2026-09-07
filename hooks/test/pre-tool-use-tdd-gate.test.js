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

// ---- schema v3 (v1.18.0): sealed specs + allowed paths ---------------------------------

const V3_STATE = {
  epic: "epic-1.2-notas",
  sealed_at: "2026-09-07T10:00:00Z",
  spec_sha: "abc1234",
  spec_paths: ["docs/05-specs/epic-1.2-notas/*.spec.md"],
  test_globs: ["tests/**/*.test.js"],
  allowed_paths: ["src/notas/service.js", "src/notas/"],
  specs: [{ slug: "01-modelo-nota", red_sha: "red111", test_paths: ["tests/notas/modelo-nota.test.js"] }]
};
const IN_PROGRESS = "- [/] **Epic 1.2:** notas\n";

test("v3: a plan-time seal with only spec_paths denies the sealed spec and allows everything else", () => {
  const projectRoot = createProject({ state: { epic: "epic-1.2-notas", spec_sha: "abc1234", spec_paths: V3_STATE.spec_paths }, roadmap: IN_PROGRESS });
  const denied = runHook(projectRoot, path.join(projectRoot, "docs", "05-specs", "epic-1.2-notas", "01-modelo-nota.spec.md"));
  assert.equal(denied.json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(denied.json.hookSpecificOutput.permissionDecisionReason, /Spec Seal: `docs\/05-specs\/epic-1\.2-notas\/01-modelo-nota\.spec\.md`.*SPEC_SHA abc1234.*BLOCKED: spec/);
  assert.equal(runHook(projectRoot, path.join(projectRoot, "docs", "05-specs", "epic-1.2-notas", "_planning.md")).stdout, "");
  assert.equal(runHook(projectRoot, path.join(projectRoot, "src", "x.js")).stdout, "");
  assert.equal(runHook(projectRoot, path.join(projectRoot, "tests", "x.test.js")).stdout, "");
});

test("v3: allowed_paths denies production code outside the declared surface, never docs/ or .specture/", () => {
  const projectRoot = createProject({ state: V3_STATE, roadmap: IN_PROGRESS });
  const reason = (rel) => {
    const { json, stdout } = runHook(projectRoot, path.join(projectRoot, ...rel.split("/")));
    return json ? json.hookSpecificOutput.permissionDecisionReason : stdout;
  };
  assert.equal(reason("src/notas/service.js"), "", "declared file");
  assert.equal(reason("src/notas/router.js"), "", "under a declared dir");
  assert.equal(reason("tests/notas/otro.test.js"), "", "future test under test_globs");
  assert.equal(reason("docs/04-roadmap/ROADMAP.md"), "");
  assert.equal(reason(".specture/state/build-locked.json"), "");
  assert.match(reason("src/billing/x.js"), /Allowed Paths: `src\/billing\/x\.js`.*epic-1\.2-notas.*Crea:\/Modifica:.*BLOCKED: spec <ID>/);
  assert.match(reason("README.md"), /Allowed Paths: `README\.md`/);
  assert.match(reason("tests/notas/modelo-nota.test.js"), /TDD Honesty Gate/, "sealed test wins over allowed");
  assert.match(reason("docs/05-specs/epic-1.2-notas/01-modelo-nota.spec.md"), /Spec Seal/);
});

test("v3: a stale seal fails open with a reason for all three kinds; supersede_paths lifts only the test deny", () => {
  const stale = createProject({ state: V3_STATE, roadmap: "- [x] **Epic 1.2:** notas\n" });
  for (const rel of ["tests/notas/modelo-nota.test.js", "docs/05-specs/epic-1.2-notas/01-modelo-nota.spec.md", "src/billing/x.js"]) {
    const { json } = runHook(stale, path.join(stale, ...rel.split("/")));
    assert.equal(json.hookSpecificOutput.permissionDecision, "allow", rel);
    assert.match(json.hookSpecificOutput.permissionDecisionReason, /stale seal/);
  }

  const superseding = createProject({ state: { ...V3_STATE, supersede_paths: ["tests/notas/modelo-nota.test.js"] }, roadmap: IN_PROGRESS });
  assert.equal(runHook(superseding, path.join(superseding, "tests", "notas", "modelo-nota.test.js")).stdout, "");
  assert.equal(runHook(superseding, path.join(superseding, "src", "billing", "x.js")).json.hookSpecificOutput.permissionDecision, "deny");
});
