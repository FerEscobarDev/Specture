const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const cliPath = path.resolve(__dirname, "..", "lib", "honesty-check.js");
const honesty = require("../lib/honesty-check");
const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(dir);
  return dir;
}

function git(cwd, ...args) {
  const result = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

// A Specture project that is also a git repo, isolated from any repo above os.tmpdir().
function createRepo() {
  const root = tempDir("specture-honesty-");
  git(root, "init", "-q");
  git(root, "config", "core.autocrlf", "false");
  git(root, "config", "commit.gpgsign", "false");
  write(root, ".specture/stack.yml", "schema: 1\n");
  return root;
}

function write(root, rel, content) {
  const abs = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, ...rel.split("/")), "utf8");
}

function commit(root, message, ...paths) {
  git(root, "add", "--", ...paths);
  git(root, "commit", "-q", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function writeSeal(root, state) {
  write(root, ".specture/state/build-locked.json", JSON.stringify(state, null, 2));
}

// Every test dir is a direct child of os.tmpdir(): git never climbs into a repo above it.
function hc(root, ...args) {
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: os.tmpdir() };
  const result = spawnSync(process.execPath, [cliPath, ...args, "--project", root], { cwd: root, encoding: "utf8", env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, token: result.stdout.split(/\r?\n/)[0] };
}

// ---- clean-tree ---------------------------------------------------------------------------

test("clean-tree: PASS on a clean test tree; an uncommitted test file = FAIL; globs from the seal or --test-globs", () => {
  const root = createRepo();
  write(root, "tests/a.test.js", "test('a', () => {});\n");
  write(root, "src/a.js", "module.exports = 1;\n");
  commit(root, "base", ".specture/stack.yml", "tests/a.test.js", "src/a.js");
  writeSeal(root, { epic: "e", test_globs: ["tests/**/*.test.js"], specs: [] });
  write(root, "src/b.js", "untracked production code is not this check's business\n");

  let r = hc(root, "clean-tree");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY clean-tree: PASS /);

  write(root, "tests/b.test.js", "test('b', () => {});\n");
  r = hc(root, "clean-tree");
  assert.equal(r.status, 1);
  assert.equal(r.token, "HONESTY clean-tree: FAIL 1");
  assert.match(r.stdout, /^- .*tests\/b\.test\.js/m);

  write(root, "tests/a.test.js", "test('a', () => { changed(); });\n");
  r = hc(root, "clean-tree");
  assert.equal(r.token, "HONESTY clean-tree: FAIL 2", "a modified tracked test counts too");

  r = hc(root, "clean-tree", "--test-globs", "tests/**/*.spec.js");
  assert.equal(r.status, 0, "--test-globs overrides the seal's globs");

  const json = JSON.parse(hc(root, "clean-tree", "--json").stdout);
  assert.equal(json.status, "FAIL");
  assert.equal(json.findings.length, 2);
  assert.equal(json.token, "HONESTY clean-tree: FAIL 2");
});

test("clean-tree: UNVERIFIABLE without globs (no seal, no flag) or outside a git repo", () => {
  const root = createRepo();
  let r = hc(root, "clean-tree");
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY clean-tree: UNVERIFIABLE /);

  const notGit = tempDir("specture-honesty-nogit-");
  write(notGit, ".specture/stack.yml", "schema: 1\n");
  r = hc(notGit, "clean-tree", "--test-globs", "tests/**");
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY clean-tree: UNVERIFIABLE .*git/);
});

// ---- range --------------------------------------------------------------------------------

const EPIC_DIR = "docs/05-specs/epic-2.1-limites";

function planning(register = []) {
  return ["# Planning", "", "## COVERAGE_TABLE", "- br: BR-1 → 01-limite", "", "## SUPERSESIONES", ...register, "", "## VEREDICTOS", ""].join("\n");
}

// base (old test of a closed epic) → plan → RED of 01 → GREEN → RED of 02 (sibling) → supersede commit
function rangeRepo() {
  const root = createRepo();
  write(root, "tests/old.test.js", "test('viejo', () => expect(limit()).toBe(10));\n");
  write(root, "tests/other.test.js", "test('otro', () => {});\n");
  write(root, "src/limit.js", "module.exports = () => 10;\n");
  commit(root, "base", ".specture/stack.yml", "tests/old.test.js", "tests/other.test.js", "src/limit.js");
  write(root, `${EPIC_DIR}/01-limite.spec.md`, "# 01\n");
  write(root, `${EPIC_DIR}/_planning.md`, planning());
  const lock = commit(root, "docs(specs): plan", EPIC_DIR);
  write(root, "tests/limite.test.js", "test('25MB', () => expect(limit()).toBe(25));\n");
  const red1 = commit(root, "test(red): 01-limite", "tests/limite.test.js");
  write(root, "src/limit.js", "module.exports = () => 25;\n");
  commit(root, "feat: 01-limite", "src/limit.js");
  write(root, "tests/api.test.js", "test('api', () => {});\n");
  const red2 = commit(root, "test(red): 02-api", "tests/api.test.js");
  write(root, "tests/old.test.js", "test('viejo', () => expect(limit()).toBe(25));\n");
  const sup = commit(root, "test(supersede): old — loop compilación", "tests/old.test.js");
  const seal = {
    epic: "epic-2.1-limites",
    spec_sha: lock,
    lock_sha: lock,
    spec_paths: [`${EPIC_DIR}/*.spec.md`],
    test_globs: ["tests/**/*.test.js"],
    supersede_paths: [],
    specs: [
      { slug: "01-limite", red_sha: red1, red_sha_orig: red1, test_paths: ["tests/limite.test.js"] },
      { slug: "02-api", red_sha: red2, red_sha_orig: red2, test_paths: ["tests/api.test.js"] }
    ]
  };
  writeSeal(root, seal);
  return { root, lock, red1, red2, sup, seal };
}

test("range: an unregistered test commit = FAIL; registered with its SHA = PASS (the sibling's RED is sanctioned by the seal)", () => {
  const { root, sup } = rangeRepo();
  let r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.token, "HONESTY range: FAIL 1");
  assert.ok(r.stdout.includes(sup.slice(0, 7)), "the finding names the commit");
  assert.match(r.stdout, /tests\/old\.test\.js/);

  write(root, `${EPIC_DIR}/_planning.md`, planning([`- tests/old.test.js::viejo — motivo: BR-1 — spec: 01-limite — commit: ${sup.slice(0, 7)} — loop: compilación`]));
  r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY range: PASS 1 registrados/);
});

test("range: RED_ORIG is the lower bound, not the moving red_sha", () => {
  const { root, seal } = rangeRepo();
  const head = git(root, "rev-parse", "HEAD");
  writeSeal(root, { ...seal, specs: [{ ...seal.specs[0], red_sha: head }, seal.specs[1]] });
  const r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1, "red_sha = HEAD would hide the commit; red_sha_orig does not");
});

test("range: a registered commit that touches a test outside its registered paths = FAIL", () => {
  const { root, sup } = rangeRepo();
  write(root, "tests/old.test.js", "test('viejo', () => expect(limit()).toBe(26));\n");
  write(root, "tests/other.test.js", "test('otro', () => { sneaky(); });\n");
  const wide = commit(root, "test(supersede): old + other", "tests/old.test.js", "tests/other.test.js");
  write(
    root,
    `${EPIC_DIR}/_planning.md`,
    planning([
      `- tests/old.test.js::viejo — motivo: BR-1 — spec: 01-limite — commit: ${sup.slice(0, 7)}`,
      `- tests/old.test.js::viejo — motivo: BR-1 — spec: 01-limite — commit: ${wide.slice(0, 9)}`
    ])
  );
  const r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1, r.stdout);
  assert.equal(r.token, "HONESTY range: FAIL 1");
  assert.match(r.stdout, /tests\/other\.test\.js/);
  assert.ok(r.stdout.includes(wide.slice(0, 7)));
});

test("range: a sibling's RED is sanctioned only for its own files — touching another spec's sealed test = FAIL", () => {
  const { root, sup, seal } = rangeRepo();
  write(root, "tests/nuevo.test.js", "test('nuevo', () => {});\n");
  write(root, "tests/limite.test.js", "test('25MB', () => expect(limit()).toBe(99));\n");
  const red3 = commit(root, "test(red): 03-ui", "tests/nuevo.test.js", "tests/limite.test.js");
  writeSeal(root, { ...seal, specs: [...seal.specs, { slug: "03-ui", red_sha: red3, red_sha_orig: red3, test_paths: ["tests/nuevo.test.js"] }] });
  write(root, `${EPIC_DIR}/_planning.md`, planning([`- tests/old.test.js::viejo — motivo: BR-1 — spec: 01-limite — commit: ${sup}`]));
  const r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1, r.stdout);
  assert.equal(r.token, "HONESTY range: FAIL 1");
  assert.match(r.stdout, /tests\/limite\.test\.js/);
  assert.match(r.stdout, /01-limite/);
});

test("range: a non-empty supersede_paths = FAIL; no seal = UNVERIFIABLE", () => {
  const { root, sup, seal } = rangeRepo();
  write(root, `${EPIC_DIR}/_planning.md`, planning([`- tests/old.test.js::viejo — motivo: BR-1 — spec: 01-limite — commit: ${sup}`]));
  writeSeal(root, { ...seal, supersede_paths: ["tests/old.test.js"] });
  let r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /supersede_paths/);

  fs.rmSync(path.join(root, ".specture", "state", "build-locked.json"));
  r = hc(root, "range", "--slug", "01-limite", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY range: UNVERIFIABLE /);
});

// ---- red-lines ----------------------------------------------------------------------------

function redRepo() {
  const root = createRepo();
  write(root, "src/x.js", "module.exports = 1;\n");
  commit(root, "base", ".specture/stack.yml", "src/x.js");
  write(root, "tests/a.test.js", "const x = require('../src/x');\n\ntest('uno', () => {\n  expect(x).toBe(1);\n});\n");
  const red = commit(root, "test(red): 01", "tests/a.test.js");
  writeSeal(root, { epic: "e", test_globs: ["tests/**/*.test.js"], specs: [{ slug: "01", red_sha: red, red_sha_orig: red, test_paths: ["tests/*.test.js"] }] });
  return { root, red };
}

test("red-lines: every line the RED added survives in HEAD = PASS; a deleted line = FAIL; a deleted file = FAIL", () => {
  const { root } = redRepo();
  write(root, "tests/a.test.js", "const x = require('../src/x');\n\ntest('uno', () => {\n  expect(x).toBe(1);\n});\n\ntest('dos', () => {});\n");
  commit(root, "test(supersede): extra", "tests/a.test.js");
  let r = hc(root, "red-lines");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY red-lines: PASS /);
  assert.equal(hc(root, "red-lines", "--slug", "01").status, 0);

  write(root, "tests/a.test.js", "const x = require('../src/x');\n\ntest('uno', () => {\n});\n");
  commit(root, "weaken", "tests/a.test.js");
  r = hc(root, "red-lines", "--slug", "01");
  assert.equal(r.status, 1);
  assert.equal(r.token, "HONESTY red-lines: FAIL 1");
  assert.match(r.stdout, /tests\/a\.test\.js.*expect\(x\)\.toBe\(1\);/);

  git(root, "rm", "-q", "tests/a.test.js");
  git(root, "commit", "-q", "-m", "drop");
  r = hc(root, "red-lines");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /tests\/a\.test\.js.*borrado/);
});

test("red-lines: a registered red-fix of the spec's own RED replaces the lines it changed — its new lines become the contract (v2.2.2)", () => {
  const { root } = redRepo();
  // The RED's setup was mechanically wrong; the red-fix rewrites that line and nothing else.
  write(root, "tests/a.test.js", "const x = require('../src/x');\n\ntest('uno', () => {\n  expect(x).toBe(1); // fixture corregida\n});\n");
  const fix = commit(root, "test(red-fix): 01", "tests/a.test.js");

  // Without the register (or without --epic-dir) the changed RED line is missing → FAIL.
  assert.equal(hc(root, "red-lines", "--slug", "01").status, 1);
  write(root, `${EPIC_DIR}/_planning.md`, planning([`- red-fix: tests/a.test.js — spec: 01 — commit: ${fix.slice(0, 8)}`]));
  let r = hc(root, "red-lines", "--slug", "01", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY red-lines: PASS /);

  // A red-fix registered for another spec does not excuse this one.
  write(root, `${EPIC_DIR}/_planning.md`, planning([`- red-fix: tests/a.test.js — spec: 02 — commit: ${fix.slice(0, 8)}`]));
  assert.equal(hc(root, "red-lines", "--slug", "01", "--epic-dir", EPIC_DIR).status, 1);

  // The red-fix's own lines are now part of the contract: weakening them later is a FAIL.
  write(root, `${EPIC_DIR}/_planning.md`, planning([`- red-fix: tests/a.test.js — spec: 01 — commit: ${fix.slice(0, 8)}`]));
  write(root, "tests/a.test.js", "const x = require('../src/x');\n\ntest('uno', () => {\n});\n");
  commit(root, "weaken after red-fix", "tests/a.test.js");
  r = hc(root, "red-lines", "--slug", "01", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /fixture corregida/);
});

test("red-lines: UNVERIFIABLE without a seal or with an unknown slug", () => {
  const { root } = redRepo();
  assert.equal(hc(root, "red-lines", "--slug", "99").status, 2);
  fs.rmSync(path.join(root, ".specture", "state", "build-locked.json"));
  const r = hc(root, "red-lines");
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY red-lines: UNVERIFIABLE /);
});

// ---- spec-delta ---------------------------------------------------------------------------

const SPEC_01 = [
  "# Spec 01-limite",
  "",
  "## 1. Criterios de Aceptación",
  "- **AC-1:** rechaza archivos de más de 25 MB",
  "- **BR-1:** el límite es 25 MB",
  "",
  "## 9. Supersesiones de tests sellados",
  "(ninguna)",
  "",
  "## 10. Fuera de Scope",
  "- nada",
  ""
].join("\n");
const SPEC_02 = "# Spec 02-api\n\n## 1. Criterios de Aceptación\n- **AC-1:** expone el límite\n";
const PLANNING_BASE = [
  "# Planning",
  "",
  "## COVERAGE_TABLE",
  "- br: BR-1 → 01-limite",
  "",
  "## SUPERSESIONES",
  "",
  "## VEREDICTOS",
  "### set — dispatch 1 — ronda 1 — 2026-09-27T10:00:00-03:00",
  "APPROVED",
  "",
  "## SPEC_SHA",
  "- abc1234",
  ""
].join("\n");

function deltaRepo() {
  const root = createRepo();
  write(root, `${EPIC_DIR}/01-limite.spec.md`, SPEC_01);
  write(root, `${EPIC_DIR}/02-api.spec.md`, SPEC_02);
  write(root, `${EPIC_DIR}/_planning.md`, PLANNING_BASE);
  const base = commit(root, "docs(specs): plan", ".specture/stack.yml", EPIC_DIR);
  return { root, base };
}

const crlf = (text) => text.replace(/\r?\n/g, "\r\n");

test("spec-delta: only the slug's Supersesiones section and the sup:/register rows changed (even in CRLF) = PASS", () => {
  const { root, base } = deltaRepo();
  write(
    root,
    `${EPIC_DIR}/01-limite.spec.md`,
    crlf(SPEC_01.replace("(ninguna)", "- Supersede: `tests/old.test.js::viejo` — motivo: BR-1 — epic origen: epic-1.1-archivos — acción: reescribir"))
  );
  write(
    root,
    `${EPIC_DIR}/_planning.md`,
    crlf(
      PLANNING_BASE.replace("- br: BR-1 → 01-limite", "- br: BR-1 → 01-limite\n- sup: tests/old.test.js::viejo → 01-limite (BR-1)")
        .replace("## SUPERSESIONES\n", "## SUPERSESIONES\n- tests/old.test.js::viejo — motivo: BR-1 — spec: 01-limite — commit: pendiente\n")
        .replace("APPROVED\n", "APPROVED\n### 01-limite — dispatch 2 — ronda 1 — 2026-09-28T09:00:00-03:00 — delta — loop\nAPPROVED\n")
        .replace("- abc1234", "- abc1234\n- def5678")
    )
  );
  write(root, `${EPIC_DIR}/02-api.spec.md`, crlf(SPEC_02));
  const r = hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", base, "--slug", "01-limite");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY spec-delta: PASS /);
});

test("spec-delta: a changed AC = FAIL citing file and line; a changed sibling spec = FAIL", () => {
  const { root, base } = deltaRepo();
  const changed = SPEC_01.replace("más de 25 MB", "más de 30 MB");
  write(root, `${EPIC_DIR}/01-limite.spec.md`, changed);
  let r = hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", base, "--slug", "01-limite");
  assert.equal(r.status, 1, r.stdout);
  assert.equal(r.token, "HONESTY spec-delta: FAIL 1");
  const line = changed.split("\n").findIndex((l) => l.includes("30 MB")) + 1;
  assert.ok(r.stdout.includes(`${EPIC_DIR}/01-limite.spec.md:${line}`), r.stdout);
  assert.match(r.stdout, /30 MB/);

  write(root, `${EPIC_DIR}/01-limite.spec.md`, SPEC_01);
  write(root, `${EPIC_DIR}/02-api.spec.md`, SPEC_02 + "- **AC-2:** nuevo\n");
  r = hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", base, "--slug", "01-limite");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /02-api\.spec\.md:5/);

  write(root, `${EPIC_DIR}/02-api.spec.md`, SPEC_02);
  write(root, `${EPIC_DIR}/_planning.md`, PLANNING_BASE.replace("- br: BR-1 → 01-limite", "- br: BR-1 → 02-api"));
  r = hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", base, "--slug", "01-limite");
  assert.equal(r.status, 1, "a non-sup COVERAGE_TABLE row is not ignored");
  assert.match(r.stdout, /_planning\.md:4/);
});

test("spec-delta: an unknown base = UNVERIFIABLE", () => {
  const { root } = deltaRepo();
  const r = hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", "0123456789abcdef0123456789abcdef01234567", "--slug", "01-limite");
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY spec-delta: UNVERIFIABLE /);
});

// ---- protected ----------------------------------------------------------------------------

function protectedProject(supersedeLine) {
  const root = tempDir("specture-honesty-protected-");
  write(root, ".specture/stack.yml", "schema: 1\n");
  write(
    root,
    ".specture/rules.yml",
    [
      "schema: 1",
      "rules:",
      "  - id: R-limite",
      "    tags: [archivos]",
      '    rule: "el límite de subida lo fija el ADR-001"',
      '    verify: "`tests/limits.test.js::rechaza archivos de más de 10 MB`"',
      "    severity: BLOCKER",
      "  - id: R-prosa",
      "    tags: [all]",
      '    rule: "prosa"',
      '    verify: "archivos del diff: una unidad por archivo"',
      "    severity: IMPORTANT",
      ""
    ].join("\n")
  );
  write(root, "docs/05-specs/epic-1.1-archivos/01-subida.spec.md", "# 01\n\n## Guards\n- **GUARD-1:** no borra archivos ajenos → test: `tests/guard.test.js::no borra archivos ajenos`\n");
  write(root, `${EPIC_DIR}/01-limite.spec.md`, `# 01\n\n## 9. Supersesiones de tests sellados\n${supersedeLine}\n`);
  write(root, `${EPIC_DIR}/_planning.md`, "# plan\n");
  return root;
}

test("protected: a Supersede over a test listed in a rule's verify: = FAIL; over another epic's GUARD = FAIL; over a free test = PASS", () => {
  let root = protectedProject("- Supersede: `tests/limits.test.js::rechaza archivos de más de 10 MB` — motivo: BR-1 — epic origen: epic-1.1-archivos");
  let r = hc(root, "protected", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.token, "HONESTY protected: FAIL 1");
  assert.match(r.stdout, /protegido por R-limite/);

  root = protectedProject("- Supersede: `tests/guard.test.js::no borra archivos ajenos` — motivo: BR-2 — epic origen: epic-1.1-archivos");
  r = hc(root, "protected", "--epic-dir", EPIC_DIR, "--slug", "01-limite");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /GUARD-1 de epic-1\.1-archivos\/01-subida/);

  root = protectedProject("- Supersede: `tests/old.test.js::viejo` — motivo: BR-1 — epic origen: epic-1.1-archivos");
  r = hc(root, "protected", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY protected: PASS /);
});

test("protected: an unreadable rules.yml or a missing epic dir = UNVERIFIABLE", () => {
  const root = protectedProject("- Supersede: `tests/old.test.js::viejo` — motivo: BR-1 — epic origen: x");
  assert.equal(hc(root, "protected", "--epic-dir", "docs/05-specs/no-existe").status, 2);
  write(root, ".specture/rules.yml", "rules:\n  - id: R-x\n    rule: |\n");
  const r = hc(root, "protected", "--epic-dir", EPIC_DIR);
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY protected: UNVERIFIABLE .*rules\.yml/);
});

test("verifyTokens: backticked and bare <path>::<test> tokens; prose without :: protects nothing", () => {
  assert.deepEqual(honesty.verifyTokens("`tests/a.test.js::uno dos` y `tests/b.test.js::tres`"), [
    { path: "tests/a.test.js", test: "uno dos" },
    { path: "tests/b.test.js", test: "tres" }
  ]);
  assert.deepEqual(honesty.verifyTokens("tests/a.test.js::rechaza 10 MB; tests/b.test.js::otro"), [
    { path: "tests/a.test.js", test: "rechaza 10 MB" },
    { path: "tests/b.test.js", test: "otro" }
  ]);
  assert.deepEqual(honesty.verifyTokens("archivos del diff: una unidad por archivo"), []);
  assert.deepEqual(honesty.verifyTokens(["tests/a.test.js::x"]), [{ path: "tests/a.test.js", test: "x" }], "an inline YAML list");
});

// ---- base-worktree ------------------------------------------------------------------------

test("base-worktree: checks out the lock commit, overlays the current files, and --remove deletes it", () => {
  const root = createRepo();
  write(root, "src/x.js", "v1\n");
  write(root, "tests/a.test.js", "old\n");
  const lock = commit(root, "base", ".specture/stack.yml", "src/x.js", "tests/a.test.js");
  write(root, "src/x.js", "v2\n");
  commit(root, "green", "src/x.js");
  write(root, "tests/a.test.js", "rewritten\n");
  const dir = path.join(tempDir("specture-honesty-wt-"), "base");

  let r = hc(root, "base-worktree", "--lock", lock, "--files", "tests/a.test.js", "--dir", dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.token, `HONESTY base-worktree: READY ${dir}`);
  assert.equal(read(dir, "src/x.js"), "v1\n", "the base is the lock commit");
  assert.equal(read(dir, "tests/a.test.js"), "rewritten\n", "the listed files come from the current tree");

  r = hc(root, "base-worktree", "--remove", dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.token, /^HONESTY base-worktree: REMOVED /);
  assert.equal(fs.existsSync(dir), false);
  assert.equal(git(root, "worktree", "list", "--porcelain").includes(path.basename(path.dirname(dir))), false, "git no longer lists it");
});

test("base-worktree: an unknown sha = UNVERIFIABLE and nothing is created", () => {
  const root = createRepo();
  write(root, "src/x.js", "v1\n");
  commit(root, "base", ".specture/stack.yml", "src/x.js");
  const dir = path.join(tempDir("specture-honesty-wt-"), "base");
  const r = hc(root, "base-worktree", "--lock", "0123456789abcdef0123456789abcdef01234567", "--files", "src/x.js", "--dir", dir);
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY base-worktree: UNVERIFIABLE /);
  assert.equal(fs.existsSync(dir), false);
});

// ---- a project in a subdirectory of its repo ------------------------------------------------

test("a project inside a subdirectory of the repo: git paths are re-rooted, files outside the project are ignored", () => {
  const repo = createRepo();
  const root = path.join(repo, "app");
  write(root, ".specture/stack.yml", "schema: 1\n");
  write(repo, "outside.test.js", "x\n");
  write(root, `${EPIC_DIR}/01-limite.spec.md`, SPEC_01);
  write(root, `${EPIC_DIR}/_planning.md`, PLANNING_BASE);
  const base = commit(repo, "plan", ".");
  write(root, "tests/a.test.js", "test('a', () => {\n  expect(1).toBe(1);\n});\n");
  const red = commit(repo, "red", "app/tests/a.test.js");
  writeSeal(root, { epic: "e", test_globs: ["tests/**/*.test.js", "*.test.js"], specs: [{ slug: "01-limite", red_sha: red, red_sha_orig: red, test_paths: ["tests/a.test.js"] }] });
  write(repo, "outside2.test.js", "untracked, outside the project\n");

  assert.equal(hc(root, "clean-tree").status, 0, "a test file outside the project is not the project's");
  assert.equal(hc(root, "red-lines").status, 0);
  assert.equal(hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", base, "--slug", "01-limite").status, 0);
  write(root, `${EPIC_DIR}/01-limite.spec.md`, SPEC_01.replace("25 MB", "30 MB"));
  const r = hc(root, "spec-delta", "--epic-dir", EPIC_DIR, "--base", base, "--slug", "01-limite");
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.stdout.includes(`${EPIC_DIR}/01-limite.spec.md:4`), r.stdout);

  write(root, "tests/a.test.js", "test('a', () => {\n});\n");
  commit(repo, "weaken", "app/tests/a.test.js");
  const lines = hc(root, "red-lines");
  assert.equal(lines.status, 1);
  assert.match(lines.stdout, /^- tests\/a\.test\.js: falta/m, "findings name project-relative paths");
});

// ---- usage --------------------------------------------------------------------------------

test("usage: an unknown option or command → exit 2 with the token", () => {
  const root = createRepo();
  let r = hc(root, "clean-tree", "--bogus", "x");
  assert.equal(r.status, 2);
  assert.match(r.token, /^HONESTY clean-tree: UNVERIFIABLE .*unknown option --bogus/);
  r = hc(root, "frobnicate");
  assert.equal(r.status, 2);
  r = hc(root, "range", "--slug", "01");
  assert.equal(r.status, 2, "--epic-dir is required");
  assert.match(r.token, /required/);
});
