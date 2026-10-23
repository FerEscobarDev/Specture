const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const claudeHook = path.resolve(__dirname, "..", "pre-tool-use-wait-gate.js");
const cliHook = path.resolve(__dirname, "..", "specture-pre-tool-use-wait-gate.js");
const temporaryDirectories = [];

function createProject({ enabled = true, specture = true } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-wait-hook-"));
  temporaryDirectories.push(projectRoot);
  if (specture) {
    fs.mkdirSync(path.join(projectRoot, ".specture"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, ".specture", "stack.yml"), "schema: 1\n");
    fs.writeFileSync(path.join(projectRoot, ".specture", "settings.yml"), `profile: custom\nhooks.enabled: ${enabled}\n`);
  }
  return projectRoot;
}

function run(hook, cwd, toolInput) {
  const result = spawnSync(process.execPath, [hook], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: toolInput })
  });
  return { status: result.status, stdout: result.stdout, json: result.stdout ? JSON.parse(result.stdout) : null };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("Claude Code wait gate denies a polling loop and a long sleep, naming the recovery path", () => {
  const projectRoot = createProject();
  for (const command of ["for i in $(seq 1 58); do sleep 10; done; git log -1", "sleep 3060; date"]) {
    const { status, json } = run(claudeHook, projectRoot, { command });
    assert.equal(status, 0);
    assert.equal(json.hookSpecificOutput.hookEventName, "PreToolUse");
    assert.equal(json.hookSpecificOutput.permissionDecision, "deny", command);
    assert.match(json.hookSpecificOutput.permissionDecisionReason, /Specture wait guard/);
    assert.match(json.hookSpecificOutput.permissionDecisionReason, /never poll/);
  }
});

test("Claude Code wait gate allows real work, short pauses and time limits", () => {
  const projectRoot = createProject();
  for (const command of ["timeout 590 dotnet test tests/Integration", "sleep 2 && curl -s localhost:3000", "git status --short", "npm test"]) {
    const { status, stdout } = run(claudeHook, projectRoot, { command });
    assert.equal(status, 0);
    assert.equal(stdout, "", `should allow silently: ${command}`);
  }
});

test("Claude Code wait gate is opt-in: silent when hooks are off, outside Specture, or without a command", () => {
  assert.equal(run(claudeHook, createProject({ enabled: false }), { command: "sleep 3060" }).stdout, "");
  assert.equal(run(claudeHook, createProject({ specture: false }), { command: "sleep 3060" }).stdout, "");
  assert.equal(run(claudeHook, createProject(), { file_path: "x.js" }).stdout, "");
  assert.equal(run(claudeHook, createProject(), {}).stdout, "");
});

test("CLI wait gate reads command, CommandLine or cmd and answers with both decision shapes", () => {
  const projectRoot = createProject();
  for (const toolInput of [{ command: "sleep 90; echo tick" }, { CommandLine: "Start-Sleep -Seconds 300" }, { cmd: "until grep -q DONE out.txt; do sleep 20; done" }]) {
    const { status, json } = run(cliHook, projectRoot, toolInput);
    assert.equal(status, 0);
    assert.deepEqual(Object.keys(json), ["decision", "reason", "permissionDecision", "permissionDecisionReason"], JSON.stringify(toolInput));
    assert.equal(json.decision, "deny", JSON.stringify(toolInput));
    assert.equal(json.permissionDecision, "deny", JSON.stringify(toolInput));
    assert.match(json.reason, /Specture wait guard/);
  }
  assert.equal(run(cliHook, projectRoot, { command: "dotnet test --filter FullyQualifiedName~FooTests" }).stdout, "");
  assert.equal(run(cliHook, createProject({ enabled: false }), { command: "sleep 3060" }).stdout, "");
});

// Antigravity runs the hook from the plugin directory and sends `toolCall.args.CommandLine` plus
// the project in `workspacePaths` — the cwd never is the project.
test("CLI wait gate under the Antigravity envelope: denies from a foreign cwd via workspacePaths", () => {
  const projectRoot = createProject();
  const pluginDir = createProject({ specture: false });
  const spawn = (payload) => spawnSync(process.execPath, [cliHook], { cwd: pluginDir, encoding: "utf8", input: JSON.stringify(payload) });

  const denied = spawn({
    conversationId: "ec33ebf9-0cba-4100-8142-c61503f6c587",
    stepIdx: 7,
    toolCall: { name: "run_command", args: { CommandLine: "while true; do sleep 15; done", Cwd: projectRoot } },
    workspacePaths: [projectRoot]
  });
  assert.equal(denied.status, 0);
  const json = JSON.parse(denied.stdout);
  assert.equal(json.decision, "deny");
  assert.match(json.reason, /Specture wait guard/);

  // real work passes; a project without the opt-in stays silent; no workspace at all → silent
  assert.equal(spawn({ toolCall: { name: "run_command", args: { CommandLine: "npm test" } }, workspacePaths: [projectRoot] }).stdout, "");
  assert.equal(spawn({ toolCall: { name: "run_command", args: { CommandLine: "sleep 3060" } }, workspacePaths: [createProject({ enabled: false })] }).stdout, "");
  assert.equal(spawn({ toolCall: { name: "run_command", args: { CommandLine: "sleep 3060" } } }).stdout, "");
});

// --- Suite Guard (v3.2.0) ----------------------------------------------------------------------

function sealedProject({ phase = "green", roadmapInProgress = true, enabled = true } = {}) {
  const projectRoot = createProject({ enabled });
  fs.writeFileSync(
    path.join(projectRoot, ".specture", "stack.yml"),
    ["quality:", "  commands:", '    test: "dotnet test"', '    test_scoped: "dotnet test --no-restore --filter {names}"', ""].join("\n")
  );
  fs.mkdirSync(path.join(projectRoot, ".specture", "state"), { recursive: true });
  const seal = { epic: "epic-1.2-notas", sealed_at: "2026-10-22T10:00:00Z", spec_sha: "abc", spec_paths: [], test_globs: ["tests/**"], specs: [] };
  if (phase !== null) seal.phase = phase;
  fs.writeFileSync(path.join(projectRoot, ".specture", "state", "build-locked.json"), JSON.stringify(seal));
  fs.mkdirSync(path.join(projectRoot, "docs", "04-roadmap"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "docs", "04-roadmap", "ROADMAP.md"), roadmapInProgress ? "- [/] Epic 1.2\n" : "- [x] Epic 1.2\n");
  return projectRoot;
}

test("Claude Code suite guard denies the full suite out of phase and names the phase and the recovery path", () => {
  const projectRoot = sealedProject({ phase: "green" });
  for (const command of ["dotnet test", "cd api && dotnet test 2>&1 | tail -40", 'node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/quality.js" run test --log']) {
    const { status, json } = run(claudeHook, projectRoot, { command });
    assert.equal(status, 0);
    assert.equal(json.hookSpecificOutput.permissionDecision, "deny", command);
    assert.match(json.hookSpecificOutput.permissionDecisionReason, /Specture suite guard/);
    assert.match(json.hookSpecificOutput.permissionDecisionReason, /phase `green`/);
    assert.match(json.hookSpecificOutput.permissionDecisionReason, /expand test_scoped/);
  }
});

test("Claude Code suite guard allows the scoped run, the suite in baseline/verify, a seal without phase, no seal, and hooks off", () => {
  assert.equal(run(claudeHook, sealedProject({ phase: "green" }), { command: "dotnet test --no-restore --filter FullyQualifiedName~FooTests" }).stdout, "");
  assert.equal(run(claudeHook, sealedProject({ phase: "green" }), { command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/quality.js" expand test_scoped --files a' }).stdout, "");
  assert.equal(run(claudeHook, sealedProject({ phase: "baseline" }), { command: "dotnet test" }).stdout, "");
  assert.equal(run(claudeHook, sealedProject({ phase: "verify" }), { command: 'node hooks/lib/quality.js run test --log' }).stdout, "");
  assert.equal(run(claudeHook, sealedProject({ phase: null }), { command: "dotnet test" }).stdout, "", "a seal without phase (pre-3.2, or fresh from write) never arms the guard");
  assert.equal(run(claudeHook, sealedProject({ phase: "green", enabled: false }), { command: "dotnet test" }).stdout, "");
  const noSeal = sealedProject({ phase: "green" });
  fs.rmSync(path.join(noSeal, ".specture", "state", "build-locked.json"));
  assert.equal(run(claudeHook, noSeal, { command: "dotnet test" }).stdout, "");
});

test("Claude Code suite guard: a stale seal allows WITH a reason; the wait guard still wins when both apply", () => {
  const stale = run(claudeHook, sealedProject({ phase: "green", roadmapInProgress: false }), { command: "dotnet test" });
  assert.equal(stale.json.hookSpecificOutput.permissionDecision, "allow");
  assert.match(stale.json.hookSpecificOutput.permissionDecisionReason, /stale seal for epic "epic-1.2-notas"/);
  const both = run(claudeHook, sealedProject({ phase: "green" }), { command: "sleep 3060; dotnet test" });
  assert.equal(both.json.hookSpecificOutput.permissionDecision, "deny");
  assert.match(both.json.hookSpecificOutput.permissionDecisionReason, /Specture wait guard/);
});

test("CLI suite guard: denies under the Antigravity envelope via workspacePaths, allows the scoped run and a stale seal", () => {
  const projectRoot = sealedProject({ phase: "red" });
  const pluginDir = createProject({ specture: false });
  const spawn = (CommandLine, root) =>
    spawnSync(process.execPath, [cliHook], { cwd: pluginDir, encoding: "utf8", input: JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine } }, workspacePaths: [root] }) });
  const denied = spawn("dotnet test", projectRoot);
  const json = JSON.parse(denied.stdout);
  assert.equal(json.decision, "deny");
  assert.match(json.reason, /Specture suite guard/);
  assert.match(json.reason, /phase `red`/);
  assert.equal(spawn("dotnet test --filter FullyQualifiedName~FooTests", projectRoot).stdout, "");
  assert.equal(spawn("dotnet test", sealedProject({ phase: "red", roadmapInProgress: false })).stdout, "", "a stale seal is silent on the CLI host");
  assert.equal(run(cliHook, projectRoot, { command: "dotnet test" }).json.permissionDecision, "deny", "the Claude envelope works on the CLI host too");
});
