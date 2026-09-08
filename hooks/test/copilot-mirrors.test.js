const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const generator = path.join(root, "scripts", "copilot-mirrors.js");
const { BODY_CAP, notice } = require(generator);
const temporaryDirectories = [];

function tmpRoot(agents, agentTools) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-mirrors-"));
  temporaryDirectories.push(dir);
  for (const [name, text] of Object.entries(agents)) {
    fs.mkdirSync(path.join(dir, "agents", name), { recursive: true });
    fs.writeFileSync(path.join(dir, "agents", name, "AGENT.md"), text);
  }
  fs.mkdirSync(path.join(dir, "copilot", "agents"), { recursive: true });
  fs.writeFileSync(path.join(dir, "copilot", "compatibility-matrix.json"), JSON.stringify({ platformAdaptations: { agentTools } }, null, 2));
  return dir;
}

function run(dir, ...args) {
  return spawnSync(process.execPath, [generator, "--root", dir, ...args], { encoding: "utf8" });
}

function agentFile(description, body, extra = "model: sonnet") {
  return `---\nname: foo\ndescription: ${description}\n${extra}\n---\n\n${body}\n`;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("generates a mirror with the Copilot frontmatter, the notice, the full body and the platform substitutions", () => {
  const body = [
    "# Agent — Foo",
    "",
    "Ask with `AskUserQuestion`, then EnterPlanMode and `ExitPlanMode`.",
    "Run `node \"${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js\" check`.",
    "",
    "## Output",
    "STATUS: APPROVED"
  ].join("\n");
  const dir = tmpRoot({ foo: agentFile("Validates things: strictly. Returns APPROVED.", body) }, { foo: ["read", "search"] });

  const result = run(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /written \(1 of 1 mirrors changed\)/);

  const mirror = fs.readFileSync(path.join(dir, "copilot", "agents", "foo.agent.md"), "utf8");
  const [, frontmatter, ...rest] = mirror.split("---\n");
  const keys = frontmatter.trim().split("\n").map((l) => l.split(":")[0]);
  assert.deepEqual(keys, ["name", "description", "tools", "disable-model-invocation"]);
  assert.match(frontmatter, /^name: foo$/m);
  assert.match(frontmatter, /^description: "Validates things: strictly\. Returns APPROVED\."$/m);
  assert.match(frontmatter, /^tools: \["read","search"\]$/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  assert.doesNotMatch(frontmatter, /model:/);

  const generatedBody = rest.join("---\n");
  assert.ok(generatedBody.startsWith(`\n${notice("foo")}\n\n# Agent — Foo`), generatedBody.slice(0, 200));
  assert.match(generatedBody, /a closed question in chat \(2-4 options, one recommended\), then a closed proposal in chat \(Copilot plan workflow\) and explicit user approval of that proposal\./);
  assert.match(generatedBody, /\$\{PLUGIN_ROOT\}\/scripts\/doctor\.js/);
  assert.doesNotMatch(generatedBody, /CLAUDE_PLUGIN_ROOT|AskUserQuestion|EnterPlanMode|ExitPlanMode/);
  assert.match(generatedBody, /STATUS: APPROVED\n$/);
});

test("--check reports stale, missing and orphan mirrors and passes once regenerated", () => {
  const dir = tmpRoot({ foo: agentFile("Foo agent.", "Body one.") }, { foo: ["read"] });
  const missing = run(dir, "--check");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing: copilot\/agents\/foo\.agent\.md/);

  assert.equal(run(dir).status, 0);
  assert.equal(run(dir, "--check").status, 0);

  fs.writeFileSync(path.join(dir, "agents", "foo", "AGENT.md"), agentFile("Foo agent.", "Body two."));
  fs.writeFileSync(path.join(dir, "copilot", "agents", "ghost.agent.md"), "---\nname: ghost\n---\n");
  const stale = run(dir, "--check");
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale: +copilot\/agents\/foo\.agent\.md/);
  assert.match(stale.stderr, /orphan: +copilot\/agents\/ghost\.agent\.md/);
  assert.match(stale.stderr, /npm run mirrors:sync/);

  const rewritten = run(dir);
  assert.equal(rewritten.status, 0);
  assert.match(rewritten.stdout, /orphan copilot\/agents\/ghost\.agent\.md/);
  fs.rmSync(path.join(dir, "copilot", "agents", "ghost.agent.md"));
  assert.equal(run(dir, "--check").status, 0);
  assert.match(fs.readFileSync(path.join(dir, "copilot", "agents", "foo.agent.md"), "utf8"), /Body two\./);
});

test("a CRLF mirror on disk is not drift", () => {
  const dir = tmpRoot({ foo: agentFile("Foo agent.", "Body.") }, { foo: ["read"] });
  assert.equal(run(dir).status, 0);
  const file = path.join(dir, "copilot", "agents", "foo.agent.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
  assert.equal(run(dir, "--check").status, 0);
});

test("refuses an agent without a tools entry and a body over the Copilot cap — never truncates", () => {
  const noTools = tmpRoot({ foo: agentFile("Foo agent.", "Body.") }, {});
  const refused = run(noTools);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /foo: no tools entry .*agentTools/);
  assert.ok(!fs.existsSync(path.join(noTools, "copilot", "agents", "foo.agent.md")));

  const huge = tmpRoot({ foo: agentFile("Foo agent.", "x".repeat(BODY_CAP + 1)) }, { foo: ["read"] });
  const over = run(huge);
  assert.equal(over.status, 2);
  assert.match(over.stderr, new RegExp(`over the Copilot cap of ${BODY_CAP}`));
  assert.ok(!fs.existsSync(path.join(huge, "copilot", "agents", "foo.agent.md")));
});

test("refuses a frontmatter whose name does not match the directory", () => {
  const dir = tmpRoot({ foo: "---\nname: bar\ndescription: x\n---\nBody.\n" }, { foo: ["read"] });
  const result = run(dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /foo: frontmatter name is "bar"/);
});
