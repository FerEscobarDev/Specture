const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");
const quality = require("../lib/quality");

const cliPath = path.resolve(__dirname, "..", "lib", "quality.js");
const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

// A `node -e` command is the only runner every CI has. Double quotes are escaped YAML-style for
// the stack.yml parser (`stripValue`).
function nodeCommand(code) {
  return `node -e \\"${code.replace(/"/g, '\\\\\\"')}\\"`;
}

function git(root, ...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function createProject(commands = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-quality-"));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, ".specture"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.js"), "module.exports = 1;\n");
  fs.writeFileSync(path.join(root, "docs", "readme.md"), "# docs\n");
  fs.writeFileSync(path.join(root, ".gitignore"), "docs/.specture-meta/\n");
  const lines = Object.entries({ test: "sin definir", test_scoped: "sin definir", type_check: "sin definir", lint: "none", format_check: "sin definir", mutation: "sin definir", ...commands }).map(
    ([k, v]) => `    ${k}: "${v}"`
  );
  fs.writeFileSync(path.join(root, ".specture", "stack.yml"), ["quality:", "  commands:", ...lines, ""].join("\n"));
  git(root, "init", "-q");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init");
  return root;
}

function commit(root, file, content, message) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
  git(root, "add", file);
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", message);
}

function cli(root, ...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args, "--project", root], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function logsIn(root) {
  const dir = path.join(root, "docs", ".specture-meta", "runs");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith(".log")).sort() : [];
}

const FAILING = nodeCommand("console.log('alpha passed');console.error('FAILED beta');process.exit(1)");
const PASSING = nodeCommand("console.log('all green')");

test("run <slot> --log streams the whole output to docs/.specture-meta/runs with a parseable header and trailer; exit = the command's", () => {
  const root = createProject({ test: FAILING });
  const r = cli(root, "run", "test", "--log");
  assert.equal(r.status, 1, r.stderr);
  const logs = logsIn(root);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-test-[0-9a-f]{7}\.log$/, "ISO start without colons, slot, sha7");
  const file = path.join(root, "docs", ".specture-meta", "runs", logs[0]);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /^# specture-run: 1\n# slot: test\n# sha: [0-9a-f]{40}\n# tree: clean\n# phase: \(none\)\n# command: node -e /);
  assert.ok(text.indexOf("alpha passed") < text.indexOf("FAILED beta"), "stdout and stderr in order, in the body");
  assert.match(text, /\n# ---\n# end: \d{4}-.*\n# duration_s: \d+\n# exit: 1\n$/);
  assert.match(r.stdout, new RegExp(`^RUN test: exit 1 · \\d+ s · sha [0-9a-f]{7} · tree clean · log docs/\\.specture-meta/runs/${logs[0]}`));
  assert.match(r.stdout, /leer fallos: grep en docs\/\.specture-meta\/runs\//, "the recovery line says grep, never rerun");
  const parsed = quality.parseRunLog(file);
  assert.equal(parsed.sha, git(root, "rev-parse", "HEAD"));
  assert.equal(parsed.exit, 1);
  assert.equal(parsed.complete, true);
  assert.equal(parsed.tree, "clean");
  assert.equal(parsed.phase, null);
  assert.equal(parsed.failuresFile, null);
});

test("run without --log passes the output through and writes no file; a `sin definir` slot is SKIPPED (exit 3); unknown slot is usage (exit 2)", () => {
  const root = createProject({ test: PASSING });
  let r = cli(root, "run", "test");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /all green/);
  assert.deepEqual(logsIn(root), []);
  r = cli(root, "run", "type_check", "--log");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /^SKIPPED type_check: sin definir/);
  r = cli(root, "run", "lint", "--log");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /^SKIPPED lint: none/);
  r = cli(root, "run", "bogus");
  assert.equal(r.status, 2);
});

test("the header records the seal's phase and a dirty tree outside docs/ (with the warning); parseRunLog without a trailer is incomplete", () => {
  const root = createProject({ test: PASSING });
  fs.mkdirSync(path.join(root, ".specture", "state"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "state", "build-locked.json"), JSON.stringify({ epic: "e", phase: "verify", specs: [] }));
  fs.writeFileSync(path.join(root, "src", "b.js"), "dirty\n");
  const r = cli(root, "run", "test", "--log");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /tree dirty/);
  assert.match(r.stdout, /aviso: árbol sucio fuera de docs\/ y \.specture\/ — este log no sirve como línea base/);
  const file = path.join(root, "docs", ".specture-meta", "runs", logsIn(root)[0]);
  const parsed = quality.parseRunLog(file);
  assert.equal(parsed.phase, "verify");
  assert.equal(parsed.tree, "dirty");

  const cut = path.join(root, "docs", ".specture-meta", "runs", "2026-01-01T00-00-00Z-test-abcdef0.log");
  fs.writeFileSync(cut, "# specture-run: 1\n# slot: test\n# sha: abcdef0abcdef0abcdef0abcdef0abcdef0abcd\n# tree: clean\n# phase: (none)\n# command: x\n# cwd: y\n# start: 2026-01-01T00:00:00.000Z\n# ---\nrunning...\n");
  const incomplete = quality.parseRunLog(cut);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.exit, null);
  assert.equal(incomplete.duration_s, null);
  assert.throws(() => quality.recordFailures(cut, ["- a::b — x — 2026"]), /no trailer/);
  assert.equal(cli(root, "runs", "record-failures", "--log", "docs/.specture-meta/runs/2026-01-01T00-00-00Z-test-abcdef0.log", "--none").status, 1);
});

test("runs reusable: NONE until the failures are recorded; REUSABLE afterwards; a code change or a dirty src/ breaks it, a docs/ change does not", () => {
  const root = createProject({ test: FAILING });
  assert.match(cli(root, "runs", "reusable").stdout, /^NONE sin logs de test/);
  cli(root, "run", "test", "--log");
  const log = `docs/.specture-meta/runs/${logsIn(root)[0]}`;

  let r = cli(root, "runs", "reusable");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /^NONE .*sin \.failures registrado/);

  // The list lives under docs/ (ignored by the tree check) — a scratch file in src/ would be "dirty".
  const list = path.join(root, "docs", ".specture-meta", "fallos.txt");
  fs.writeFileSync(list, "- tests/a.test.js::beta — FAILED beta — 2026-10-22T10:00:00Z\n\n");
  r = cli(root, "runs", "record-failures", "--log", log, "--from-file", "docs/.specture-meta/fallos.txt");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^RECORDED 1 fallo\(s\) → docs\/\.specture-meta\/runs\/.*\.log\.failures/);
  assert.equal(fs.readFileSync(path.join(root, `${log}.failures`), "utf8"), "- tests/a.test.js::beta — FAILED beta — 2026-10-22T10:00:00Z\n");

  r = cli(root, "runs", "reusable");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^REUSABLE docs\/\.specture-meta\/runs\/.*\.log · sha [0-9a-f]{7} · failures 1\n- tests\/a\.test\.js::beta/);

  commit(root, "docs/other.md", "# more docs\n", "docs only");
  assert.match(cli(root, "runs", "reusable").stdout, /^REUSABLE/, "a docs/ commit keeps the baseline valid");

  fs.writeFileSync(path.join(root, "src", "dirty.js"), "x\n");
  assert.match(cli(root, "runs", "reusable").stdout, /^NONE árbol sucio fuera de docs\//);
  fs.rmSync(path.join(root, "src", "dirty.js"));

  commit(root, "src/a.js", "module.exports = 2;\n", "code change");
  r = cli(root, "runs", "reusable");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /^NONE .*el árbol cambió fuera de docs\/ desde [0-9a-f]{7}/);

  // --none records an empty list that still counts as recorded.
  cli(root, "run", "test", "--log");
  const newest = `docs/.specture-meta/runs/${logsIn(root).sort().reverse()[0]}`;
  r = cli(root, "runs", "record-failures", "--log", newest, "--none");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(root, `${newest}.failures`), "utf8"), "- (ninguno)\n");
  r = cli(root, "runs", "reusable");
  assert.match(r.stdout, /^REUSABLE .* · failures 0\n$/);
});

test("runs lists newest first and filters by --slot / --sha; summary sums the complete runs since a date or a rev; prune keeps the newest N per slot and names what it removed", () => {
  const root = createProject({ test: PASSING, type_check: PASSING });
  cli(root, "run", "type_check", "--log");
  cli(root, "run", "test", "--log");
  cli(root, "run", "test", "--log");
  let r = cli(root, "runs");
  const lines = r.stdout.trim().split("\n");
  assert.equal(lines.length, 3, "two runs in the same second never overwrite each other");
  for (const line of lines) assert.match(line, /^\S+\.log · (test|type_check) · sha [0-9a-f]{7} · tree clean · exit 0 · \d+ s · failures sin registrar · docs\/\.specture-meta\/runs\//);
  assert.ok(lines[0] >= lines[1] && lines[1] >= lines[2], "newest first (the name starts with the ISO start)");
  assert.equal(cli(root, "runs", "--slot", "type_check").stdout.trim().split("\n").length, 1);
  assert.equal(cli(root, "runs", "--sha", "HEAD").stdout.trim().split("\n").length, 3);
  assert.equal(cli(root, "runs", "--last", "1").stdout.trim().split("\n").length, 1);

  r = cli(root, "runs", "summary", "--since", "2000-01-01");
  assert.match(r.stdout, /^runs: 2 · minutes: \d+(\.\d)?\n$/, "summary counts only the `test` slot by default: type_check is not a full-suite run");
  r = cli(root, "runs", "summary", "--since", "HEAD", "--slot", "test");
  assert.match(r.stdout, /^runs: 2 · minutes: /);
  r = cli(root, "runs", "summary", "--since", "2000-01-01", "--slot", "type_check");
  assert.match(r.stdout, /^runs: 1 · minutes: /);
  assert.match(cli(root, "runs", "summary", "--since", "2999-01-01").stdout, /^runs: 0 · minutes: 0\n$/);
  assert.equal(cli(root, "runs", "summary", "--since", "nope").status, 2);

  const before = logsIn(root);
  const oldestTest = before.filter((n) => n.includes("-test-")).sort()[0];
  fs.writeFileSync(path.join(root, "docs", ".specture-meta", "runs", `${oldestTest}.failures`), "- (ninguno)\n");
  r = cli(root, "runs", "prune", "--keep", "1");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`borrado docs/\\.specture-meta/runs/${oldestTest}\\nborrado docs/\\.specture-meta/runs/${oldestTest}\\.failures`));
  assert.equal(logsIn(root).length, 2, "one per slot kept");
  assert.equal(cli(root, "runs", "prune", "--keep", "5").stdout, "nada que borrar\n");
  assert.equal(cli(root, "runs", "prune").status, 2);
});

test("run --timeout-min kills a run that overruns and leaves an incomplete-but-trailed log with exit null", async () => {
  const root = createProject({ test: nodeCommand("setTimeout(function(){},60000)") });
  const run = await quality.runLogged(root, "test", [], { timeoutMs: 300 });
  assert.equal(run.exit, null);
  assert.equal(run.complete, true, "the trailer is written even when the process is killed");
  assert.match(fs.readFileSync(run.file, "utf8"), /# error: timeout after 300 ms/);
  assert.match(cli(root, "runs", "reusable").stdout, /^NONE/);
});

test("runLogName and the exported constants", () => {
  assert.equal(quality.runLogName("2026-10-22T14:03:11.123Z", "test", "ab12cd3ef"), "2026-10-22T14-03-11Z-test-ab12cd3.log");
  assert.equal(quality.runLogName("2026-10-22T14:03:11Z", "mutation", null), "2026-10-22T14-03-11Z-mutation-unknown.log");
  assert.equal(quality.RUNS_DIR.replace(/\\/g, "/"), "docs/.specture-meta/runs");
  assert.equal(quality.NO_FAILURES_LINE, "- (ninguno)");
});
