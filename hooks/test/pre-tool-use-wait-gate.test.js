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

test("CLI wait gate reads command, CommandLine or cmd and answers with the flat decision shape", () => {
  const projectRoot = createProject();
  for (const toolInput of [{ command: "sleep 90; echo tick" }, { CommandLine: "Start-Sleep -Seconds 300" }, { cmd: "until grep -q DONE out.txt; do sleep 20; done" }]) {
    const { status, json } = run(cliHook, projectRoot, toolInput);
    assert.equal(status, 0);
    assert.equal(json.permissionDecision, "deny", JSON.stringify(toolInput));
    assert.match(json.permissionDecisionReason, /Specture wait guard/);
  }
  assert.equal(run(cliHook, projectRoot, { command: "dotnet test --filter FullyQualifiedName~FooTests" }).stdout, "");
  assert.equal(run(cliHook, createProject({ enabled: false }), { command: "sleep 3060" }).stdout, "");
});
