const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { afterEach, test } = require("node:test");

const cliPath = path.resolve(__dirname, "..", "lib", "red-check.js");
const honestyPath = path.resolve(__dirname, "..", "lib", "honesty-check.js");
const { parseCoverageMap } = require("../lib/red-check");
const { parseSpecIds } = require("../lib/planning");

const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(dir);
  return dir;
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function git(cwd, ...args) {
  const result = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function commit(root, message, ...paths) {
  git(root, "add", "--", ...paths);
  git(root, "commit", "-q", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function cli(bin, root, ...args) {
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: os.tmpdir() };
  const result = spawnSync(process.execPath, [bin, ...args, "--project", root], { cwd: root, encoding: "utf8", env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, lines: result.stdout.split(/\r?\n/).filter(Boolean) };
}

const SPEC = [
  "# Spec: demo",
  "",
  "**Epic:** 1.1   **Módulo:** Notas",
  "",
  "## Criterios de Aceptación",
  "",
  "- **AC-1:** rejects an empty title",
  "- **AC-2:** stores the note",
  "",
  "## Reglas de Negocio",
  "",
  "- **BR-1:** titles are unique",
  "",
  "## Casos Borde",
  "",
  "- **EC-1:** a 200-character title",
  "",
  "## Superficie de Código Existente",
  "",
  "- Crea: `src/notes/create-note.js`",
  "- Fixtures disponibles: `tests/fixtures/db.js`",
  ""
].join("\n");

const MAP_OK = [
  '- AC-1 → test "rejects an empty title"',
  '- AC-2 → test "stores the note"',
  '- BR-1 → test+ "accepts a new title" / test- "rejects a duplicate title"',
  '- EC-1 → test "accepts a 200-character title"',
  ""
].join("\n");

const TEST_FILE = [
  'const { test } = require("node:test");',
  'test("rejects an empty title", () => { throw new Error("RED"); });',
  'test("stores the note", () => { throw new Error("RED"); });',
  'test("accepts a new title", () => { throw new Error("RED"); });',
  'test("rejects a duplicate title", () => { throw new Error("RED"); });',
  'test("accepts a 200-character title", () => { throw new Error("RED"); });',
  ""
].join("\n");

function project({ commands, extraRedFiles = {}, map = MAP_OK, sealGlobs = ["tests/**"] } = {}) {
  const root = tempDir("specture-red-check-");
  git(root, "init", "-q");
  git(root, "config", "core.autocrlf", "false");
  git(root, "config", "commit.gpgsign", "false");
  const commandLines = commands ? Object.entries(commands).map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`).join("\n") + "\n" : "";
  write(root, ".specture/stack.yml", `project:\n  name: "Demo"\nquality:\n  linter: "x"\n${commands ? `  commands:\n${commandLines}` : ""}`);
  write(root, "docs/05-specs/epic-1.1-notas/demo.spec.md", SPEC);
  write(root, "docs/.specture-meta/coverage/demo.map", map);
  commit(root, "chore: scaffold", ".specture", "docs");
  write(root, "tests/demo.test.js", TEST_FILE);
  write(root, "tests/fixtures/db.js", "module.exports = {};\n");
  for (const [rel, content] of Object.entries(extraRedFiles)) write(root, rel, content);
  const redSha = commit(root, "test(notas): RED", "tests", ...Object.keys(extraRedFiles));
  write(root, ".specture/state/build-locked.json", JSON.stringify({
    epic: "epic-1.1-notas", sealed_at: "2026-10-12T00:00:00Z", spec_sha: redSha, spec_paths: ["docs/05-specs/epic-1.1-notas/*.spec.md"],
    test_globs: sealGlobs, allowed_paths: ["src/notes/"], specs: [{ slug: "demo", red_sha: redSha, test_paths: ["tests/demo.test.js"] }]
  }, null, 2));
  return { root, redSha };
}

const common = (redSha) => ["--red-sha", redSha, "--slug", "demo", "--epic-dir", "docs/05-specs/epic-1.1-notas", "--map", "docs/.specture-meta/coverage/demo.map"];

test("red-check all: a clean RED passes files and coverage, and commands are SKIPPED when undefined", () => {
  const { root, redSha } = project();
  const r = cli(cliPath, root, "all", ...common(redSha));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.lines[0], /^RED-CHECK files: PASS 2 archivo\(s\)/);
  assert.match(r.lines[1], /^RED-CHECK coverage: PASS 4 ID\(s\) cubiertos por 4 línea\(s\).*5 test\(s\)/);
  assert.match(r.lines[2], /^RED-CHECK commands: SKIPPED ningún comando/);
  assert.ok(r.lines.some((l) => /nota: lint: SKIPPED \(sin definir/.test(l)), r.stdout);
});

test("red-check files: a helper outside the test globs and the declared surface fails; a declared fixture passes", () => {
  const { root, redSha } = project({ extraRedFiles: { "src/notes/helper.js": "module.exports = 1;\n" } });
  const r = cli(cliPath, root, "files", "--red-sha", redSha, "--slug", "demo", "--epic-dir", "docs/05-specs/epic-1.1-notas");
  assert.equal(r.status, 1);
  assert.equal(r.lines[0], "RED-CHECK files: FAIL 1");
  assert.match(r.lines[1], /^- src\/notes\/helper\.js — fuera de los test globs y no declarado en la Superficie/);
  assert.ok(!r.stdout.includes("tests/fixtures/db.js"), "the declared fixture is not a finding");

  const explicit = cli(cliPath, root, "files", "--red-sha", redSha, "--slug", "demo", "--epic-dir", "docs/05-specs/epic-1.1-notas", "--test-globs", "tests/**,src/**");
  assert.equal(explicit.status, 0, "explicit globs override the seal");
});

test("red-check coverage: a missing id, a duplicated id, a foreign id and a test name absent from the RED are findings", () => {
  const map = [
    '- AC-1 → test "rejects an empty title"',
    '- AC-1 → test "rejects an empty title"',
    '- BR-1 → test+ "accepts a new title" / test- "rejects a duplicate title"',
    '- EC-1 → test "accepts a very long title"',
    '- EC-9 → test "stores the note"',
    ""
  ].join("\n");
  const { root, redSha } = project({ map });
  const r = cli(cliPath, root, "coverage", ...common(redSha));
  assert.equal(r.status, 1, r.stdout);
  assert.equal(r.lines[0], "RED-CHECK coverage: FAIL 4");
  assert.ok(r.lines.some((l) => /^- AC-1 — aparece 2 veces/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /^- AC-2 — sin test en el COVERAGE_MAP/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /^- EC-9 — está en el COVERAGE_MAP pero no en/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /^- EC-1 — el test "accepts a very long title" no aparece/.test(l)), r.stdout);

  const json = JSON.parse(cli(cliPath, root, "coverage", ...common(redSha), "--json").stdout);
  assert.equal(json[0].status, "FAIL");
  assert.deepEqual(json[0].ids, ["AC-1", "AC-2", "BR-1", "EC-1"]);
});

test("red-check commands: runs the declared commands with {files}, reports the failing one with its output tail, skips none/undefined", () => {
  const commands = {
    test: "none",
    type_check: 'node -e "process.exit(process.argv.length === 3 ? 0 : 7)" {files}',
    lint: 'node -e "console.log(\'lint says no\'); process.exit(1)"',
    format_check: "sin definir"
  };
  const { root, redSha } = project({ commands });
  const r = cli(cliPath, root, "commands", "--red-sha", redSha);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.lines[0], "RED-CHECK commands: FAIL 1");
  assert.ok(r.lines.some((l) => /^- lint — exit 1: node -e/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /lint says no/.test(l)), "the output tail travels with the finding");
  assert.ok(r.lines.some((l) => /nota: type_check: PASS \(node -e .* tests\/demo\.test\.js tests\/fixtures\/db\.js\)/.test(l)), r.stdout);
  assert.ok(r.lines.some((l) => /nota: format_check: SKIPPED \(sin definir/.test(l)), r.stdout);

  const all = cli(cliPath, root, "all", ...common(redSha));
  assert.equal(all.status, 1);
  assert.equal(all.lines.filter((l) => /^RED-CHECK /.test(l)).length, 3, "all runs files, coverage and stops at the failing commands");
});

test("red-check: unverifiable on a missing map, a missing spec, no seal and an unknown commit; usage on a bad command", () => {
  const { root, redSha } = project();
  assert.match(cli(cliPath, root, "coverage", "--red-sha", redSha, "--slug", "demo", "--epic-dir", "docs/05-specs/epic-1.1-notas", "--map", "nope.map").lines[0], /^RED-CHECK coverage: UNVERIFIABLE no existe el COVERAGE_MAP/);
  assert.match(cli(cliPath, root, "files", "--red-sha", redSha, "--slug", "otro", "--epic-dir", "docs/05-specs/epic-1.1-notas").lines[0], /UNVERIFIABLE no existe docs\/05-specs\/epic-1.1-notas\/otro\.spec\.md/);
  assert.match(cli(cliPath, root, "files", "--red-sha", "0000000", "--slug", "demo", "--epic-dir", "docs/05-specs/epic-1.1-notas").lines[0], /UNVERIFIABLE commit desconocido/);
  fs.rmSync(path.join(root, ".specture/state"), { recursive: true });
  const noSeal = cli(cliPath, root, "files", "--red-sha", redSha, "--slug", "demo", "--epic-dir", "docs/05-specs/epic-1.1-notas");
  assert.equal(noSeal.status, 2);
  assert.match(noSeal.lines[0], /UNVERIFIABLE sin sello/);
  const bad = cli(cliPath, root, "nope");
  assert.equal(bad.status, 2);
  assert.match(bad.lines[0], /^RED-CHECK nope: UNVERIFIABLE unknown command/);
});

test("parseCoverageMap and parseSpecIds", () => {
  assert.deepEqual(parseCoverageMap(MAP_OK).map((e) => [e.id, e.names.length]), [["AC-1", 1], ["AC-2", 1], ["BR-1", 2], ["EC-1", 1]]);
  assert.deepEqual(parseCoverageMap("COVERAGE_MAP:\n- AC-3 → test `backticked`\n- GUARD-1 → x\n")[0], { id: "AC-3", names: ["backticked"], raw: "- AC-3 → test `backticked`" });
  assert.deepEqual(parseSpecIds(SPEC), ["AC-1", "AC-2", "BR-1", "EC-1"]);
  assert.deepEqual(parseSpecIds("- **AC-1:** a\n- **AC-1:** again\n- AC-2 plain\n"), ["AC-1"], "once each, bold form only");
});

test("honesty-check red-fix-kind: ADDITIVE when the red-fix only adds tests, REWRITE when it deletes a line of the RED", () => {
  const { root, redSha } = project();
  const additive = cli(honestyPath, root, "red-fix-kind", "--slug", "demo");
  assert.equal(additive.status, 0, additive.stdout);
  assert.match(additive.lines[0], /^HONESTY red-fix-kind: PASS ADDITIVE \(\+0 -0/);

  write(root, "tests/demo.test.js", TEST_FILE + 'test("one more", () => { throw new Error("RED"); });\n');
  commit(root, "test(red-fix): demo — AC-2", "tests/demo.test.js");
  const added = cli(honestyPath, root, "red-fix-kind", "--slug", "demo");
  assert.match(added.lines[0], /^HONESTY red-fix-kind: PASS ADDITIVE \(\+1 -0/, added.stdout);

  write(root, "tests/demo.test.js", TEST_FILE.replace("stores the note", "persists the note"));
  commit(root, "test(red-fix): demo — AC-2 rewritten", "tests/demo.test.js");
  const rewrite = cli(honestyPath, root, "red-fix-kind", "--slug", "demo");
  assert.match(rewrite.lines[0], /^HONESTY red-fix-kind: PASS REWRITE \(\+1 -1/, rewrite.stdout);
  assert.equal(JSON.parse(cli(honestyPath, root, "red-fix-kind", "--slug", "demo", "--json").stdout).kind, "REWRITE");
  assert.match(cli(honestyPath, root, "red-fix-kind", "--slug", "otro").lines[0], /UNVERIFIABLE el sello no tiene specs\[otro\]/);
  assert.ok(redSha);
});
