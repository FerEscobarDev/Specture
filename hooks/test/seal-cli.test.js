const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const cliPath = path.resolve(__dirname, "..", "lib", "seal-cli.js");
const temporaryDirectories = [];

function createProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-seal-cli-"));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, ".specture"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "stack.yml"), "schema: 1\n");
  return root;
}

function cli(root, ...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args, "--project", root], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function readState(root) {
  return JSON.parse(fs.readFileSync(path.join(root, ".specture", "state", "build-locked.json"), "utf8"));
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("write → merge-spec ×2 → unseal-spec → write again → release: epic fields and specs[] survive each other", () => {
  const root = createProject();
  let r = cli(root, "write", "--epic", "epic-1.2-notas", "--spec-sha", "abc1234", "--spec-paths", "docs/05-specs/epic-1.2-notas/*.spec.md", "--test-globs", "tests/**/*.test.js", "--allowed-paths", "src/notas/service.js,src/notas/");
  assert.equal(r.status, 0, r.stderr);
  let state = readState(root);
  assert.equal(state.epic, "epic-1.2-notas");
  assert.equal(state.spec_sha, "abc1234");
  assert.deepEqual(state.spec_paths, ["docs/05-specs/epic-1.2-notas/*.spec.md"]);
  assert.deepEqual(state.allowed_paths, ["src/notas/service.js", "src/notas/"]);
  assert.deepEqual(state.specs, []);
  const sealedAt = state.sealed_at;

  r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red111", "--test-paths", "tests/notas/modelo.test.js");
  assert.equal(r.status, 0, r.stderr);
  r = cli(root, "merge-spec", "--slug", "02-api", "--red-sha", "red222", "--test-paths", "tests/notas/api.test.js,tests/notas/api-errors.test.js");
  assert.equal(r.status, 0, r.stderr);
  state = readState(root);
  assert.deepEqual(state.specs.map((s) => s.slug), ["01-modelo", "02-api"]);
  assert.deepEqual(state.specs[1].test_paths, ["tests/notas/api.test.js", "tests/notas/api-errors.test.js"]);
  assert.equal(state.spec_sha, "abc1234", "merge-spec never touches epic-level fields");
  assert.equal(state.sealed_at, sealedAt);

  r = cli(root, "merge-spec", "--slug", "02-api", "--red-sha", "red333", "--test-paths", "tests/notas/api.test.js");
  state = readState(root);
  assert.equal(state.specs.length, 2, "replaces by slug, never duplicates");
  assert.equal(state.specs[1].red_sha, "red333");

  r = cli(root, "unseal-spec", "--slug", "02-api");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readState(root).specs.map((s) => s.slug), ["01-modelo"]);

  r = cli(root, "write", "--epic", "epic-1.2-notas", "--spec-sha", "def5678", "--spec-paths", "docs/05-specs/epic-1.2-notas/*.spec.md");
  state = readState(root);
  assert.equal(state.spec_sha, "def5678");
  assert.deepEqual(state.specs.map((s) => s.slug), ["01-modelo"], "write preserves specs[] of the same epic");
  assert.deepEqual(state.allowed_paths, ["src/notas/service.js", "src/notas/"], "omitted lists keep their previous value");
  assert.equal(state.sealed_at, sealedAt);

  r = cli(root, "supersede", "--paths", "tests/old/a.test.js");
  assert.deepEqual(readState(root).supersede_paths, ["tests/old/a.test.js"]);
  r = cli(root, "supersede", "--clear");
  assert.deepEqual(readState(root).supersede_paths, []);

  r = cli(root, "show");
  assert.equal(JSON.parse(r.stdout).epic, "epic-1.2-notas");

  r = cli(root, "release");
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(path.join(root, ".specture", "state", "build-locked.json")), false);
  assert.equal(cli(root, "release").status, 0, "release is idempotent");
});

test("merge-spec without a seal creates a specs[]-only seal; write over another epic drops its specs[]", () => {
  const root = createProject();
  const r = cli(root, "merge-spec", "--slug", "01", "--red-sha", "r1", "--test-paths", "tests/a.test.js", "--epic", "epic-x");
  assert.equal(r.status, 0, r.stderr);
  let state = readState(root);
  assert.equal(state.epic, "epic-x");
  assert.equal(state.specs.length, 1);
  assert.ok(state.sealed_at);

  const w = cli(root, "write", "--epic", "epic-y", "--spec-sha", "s", "--spec-paths", "docs/05-specs/epic-y/*.spec.md");
  assert.equal(w.status, 0);
  assert.match(w.stderr, /dropping 1 specs\[\] entries of another epic/);
  state = readState(root);
  assert.equal(state.epic, "epic-y");
  assert.deepEqual(state.specs, []);
});

test("show prints the seal (or 'no seal'); supersede accepts comma lists and repeated flags", () => {
  const root = createProject();
  assert.equal(cli(root, "show").stdout.trim(), "no seal");
  cli(root, "write", "--epic", "e", "--spec-sha", "s1", "--spec-paths", "docs/05-specs/e/*.spec.md");
  const shown = JSON.parse(cli(root, "show").stdout);
  assert.equal(shown.epic, "e");
  assert.equal(shown.spec_sha, "s1");
  assert.deepEqual(shown.specs, []);

  assert.equal(cli(root, "supersede", "--paths", "tests/old/a.test.js, tests/old/b.test.js").status, 0);
  assert.deepEqual(readState(root).supersede_paths, ["tests/old/a.test.js", "tests/old/b.test.js"]);
  assert.equal(cli(root, "supersede", "--paths", "tests/old/c.test.js", "--paths", "tests\\old\\d.test.js").status, 0);
  assert.deepEqual(readState(root).supersede_paths, ["tests/old/c.test.js", "tests/old/d.test.js"], "repeated flags accumulate; backslashes become posix");
  assert.equal(cli(root, "supersede", "--clear").status, 0);
  assert.deepEqual(readState(root).supersede_paths, []);
});

test("corrupt seal → exit 1; missing required flag or unknown command → exit 2", () => {
  const root = createProject();
  fs.mkdirSync(path.join(root, ".specture", "state"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "state", "build-locked.json"), "not-json");
  const corrupt = cli(root, "merge-spec", "--slug", "01", "--red-sha", "r", "--test-paths", "tests/a.test.js");
  assert.equal(corrupt.status, 1);
  assert.match(corrupt.stderr, /corrupt seal/);
  assert.equal(cli(root, "release").status, 0, "release still works on a corrupt file");

  assert.equal(cli(createProject(), "write", "--epic", "e").status, 2);
  assert.equal(cli(createProject(), "frobnicate").status, 2);
  assert.equal(cli(createProject(), "supersede", "--paths", "a").status, 1, "no seal to update");
});
