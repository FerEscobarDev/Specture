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

// ---- v2.2.0: light supersession loop ------------------------------------------------------

const EPIC = "epic-1.2-notas";
const SPEC_DIR = `docs/05-specs/${EPIC}`;

function writeState(root, state) {
  fs.mkdirSync(path.join(root, ".specture", "state"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "state", "build-locked.json"), JSON.stringify(state, null, 2));
}

function withSpecFiles(root, ...slugs) {
  fs.mkdirSync(path.join(root, ...SPEC_DIR.split("/")), { recursive: true });
  for (const slug of slugs) fs.writeFileSync(path.join(root, ...SPEC_DIR.split("/"), `${slug}.spec.md`), `# ${slug}\n`);
  fs.writeFileSync(path.join(root, ...SPEC_DIR.split("/"), "_planning.md"), "# plan\n");
}

function sealedEpic(extra = {}) {
  return {
    epic: EPIC,
    sealed_at: "2026-09-07T10:00:00Z",
    spec_sha: "abc1234",
    spec_paths: [`${SPEC_DIR}/*.spec.md`],
    test_globs: ["tests/**/*.test.js"],
    allowed_paths: [],
    supersede_paths: [],
    specs: [
      { slug: "01-modelo", red_sha: "red111", red_sha_orig: "red111", test_paths: ["tests/notas/modelo.test.js"] },
      { slug: "02-api", red_sha: "red222", red_sha_orig: "red222", test_paths: ["tests/notas/api.test.js"] }
    ],
    ...extra
  };
}

test("an unknown flag is a usage error (exit 2, 'unknown option'), also a flag valid only for another command", () => {
  const root = createProject();
  let r = cli(root, "write", "--epic", "e", "--spec-sha", "s", "--spec-paths", "docs/05-specs/e/*.spec.md", "--bogus", "1");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option --bogus/);
  r = cli(root, "write", "--epic", "e", "--spec-sha", "s", "--spec-paths", "docs/05-specs/e/*.spec.md", "--clear");
  assert.equal(r.status, 2, "--clear belongs to supersede");
  assert.match(r.stderr, /unknown option --clear/);
  r = cli(root, "merge-spec", "--slug", "01", "--red-sha", "r", "--paths", "tests/a.test.js");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option --paths/);
  r = cli(root, "release", "--slug", "01");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option --slug/);
  assert.equal(fs.existsSync(path.join(root, ".specture", "state", "build-locked.json")), false, "nothing was written");
});

test("write keeps specs[] entries intact (red_sha_orig and any other field) and lock_sha; clears lifted/supersede; --lock-sha sets it", () => {
  const root = createProject();
  const specs = [{ slug: "01-modelo", red_sha: "red333", red_sha_orig: "red111", test_paths: ["tests/notas/modelo.test.js"], note: "kept" }];
  writeState(root, sealedEpic({ specs, lock_sha: "lock1", lifted_spec_paths: [`${SPEC_DIR}/01-modelo.spec.md`], supersede_paths: ["tests/old.test.js"], supersede_for: "01-modelo" }));

  let r = cli(root, "write", "--epic", EPIC, "--spec-sha", "def5678", "--spec-paths", `${SPEC_DIR}/*.spec.md`);
  assert.equal(r.status, 0, r.stderr);
  let state = readState(root);
  assert.deepEqual(state.specs, specs, "every field of every entry survives");
  assert.equal(state.lock_sha, "lock1", "lock_sha survives a write without --lock-sha");
  assert.deepEqual(state.lifted_spec_paths, []);
  assert.deepEqual(state.supersede_paths, []);
  assert.equal(state.supersede_for, null);
  assert.equal(state.spec_sha, "def5678");

  r = cli(root, "write", "--epic", EPIC, "--spec-sha", "def5678", "--spec-paths", `${SPEC_DIR}/*.spec.md`, "--lock-sha", "lock2");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readState(root).lock_sha, "lock2");

  r = cli(root, "write", "--epic", "epic-9.9-otro", "--spec-sha", "s", "--spec-paths", "docs/05-specs/epic-9.9-otro/*.spec.md");
  assert.equal(r.status, 0, r.stderr);
  state = readState(root);
  assert.equal(state.lock_sha, null, "another epic starts without a lock");
  assert.deepEqual(state.specs, []);
});

test("merge-spec: red_sha_orig is the FIRST RED (kept on a second merge, replaced with --reset-orig); --add-test-paths unions", () => {
  const root = createProject();
  let r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red111", "--test-paths", "tests/a.test.js", "--epic", EPIC);
  assert.equal(r.status, 0, r.stderr);
  let entry = readState(root).specs[0];
  assert.equal(entry.red_sha, "red111");
  assert.equal(entry.red_sha_orig, "red111", "a new entry starts its own RED_ORIG");

  const state = readState(root);
  state.specs[0].note = "kept";
  writeState(root, state);
  r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red222", "--add-test-paths", "tests/b.test.js, tests/a.test.js");
  assert.equal(r.status, 0, r.stderr);
  entry = readState(root).specs[0];
  assert.equal(entry.red_sha, "red222");
  assert.equal(entry.red_sha_orig, "red111", "a second merge never moves RED_ORIG");
  assert.deepEqual(entry.test_paths, ["tests/a.test.js", "tests/b.test.js"], "--add-test-paths unions without duplicates");
  assert.equal(entry.note, "kept", "merge-spec keeps the entry's other fields");

  r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red333", "--test-paths", "tests/c.test.js");
  entry = readState(root).specs[0];
  assert.equal(entry.red_sha_orig, "red111");
  assert.deepEqual(entry.test_paths, ["tests/c.test.js"], "--test-paths replaces");

  r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red444", "--test-paths", "tests/c.test.js", "--reset-orig");
  assert.equal(r.status, 0, r.stderr);
  entry = readState(root).specs[0];
  assert.equal(entry.red_sha_orig, "red444", "--reset-orig re-anchors RED_ORIG");
  assert.equal(readState(root).specs.length, 1);

  r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red555");
  assert.equal(r.status, 2, "--test-paths or --add-test-paths is required");
  assert.match(r.stderr, /required/);
});

test("a legacy entry without red_sha_orig anchors RED_ORIG on its existing red_sha at the next merge", () => {
  const root = createProject();
  writeState(root, sealedEpic({ specs: [{ slug: "01-modelo", red_sha: "red111", test_paths: ["tests/notas/modelo.test.js"] }] }));
  const r = cli(root, "merge-spec", "--slug", "01-modelo", "--red-sha", "red222", "--add-test-paths", "tests/notas/extra.test.js");
  assert.equal(r.status, 0, r.stderr);
  const entry = readState(root).specs[0];
  assert.equal(entry.red_sha, "red222");
  assert.equal(entry.red_sha_orig, "red111");
});

test("unseal-spec now also lifts the spec from spec_paths (the bug: the hook kept denying the edit)", () => {
  const root = createProject();
  withSpecFiles(root, "01-modelo", "02-api", "03-ui");
  writeState(root, sealedEpic());
  const r = cli(root, "unseal-spec", "--slug", "02-api");
  assert.equal(r.status, 0, r.stderr);
  const state = readState(root);
  assert.deepEqual(state.specs.map((s) => s.slug), ["01-modelo"]);
  assert.deepEqual(state.spec_paths, [`${SPEC_DIR}/01-modelo.spec.md`, `${SPEC_DIR}/03-ui.spec.md`]);
  assert.deepEqual(state.lifted_spec_paths, [`${SPEC_DIR}/02-api.spec.md`]);

  const { readSeal, classify } = require("../lib/seal");
  const s = readSeal(root);
  assert.equal(classify(`${SPEC_DIR}/02-api.spec.md`, s), null, "the unsealed spec is editable");
  assert.equal(classify(`${SPEC_DIR}/01-modelo.spec.md`, s).kind, "spec", "its siblings stay sealed");
});

test("lift-spec expands a literal-dir glob to an explicit list without the lifted slug and records it; the entry stays", () => {
  const root = createProject();
  withSpecFiles(root, "01-modelo", "02-api");
  writeState(root, sealedEpic({ spec_paths: [`${SPEC_DIR}/*.spec.md`, "docs/05-specs/otro/*.spec.md"] }));
  let r = cli(root, "lift-spec", "--slug", "01-modelo");
  assert.equal(r.status, 0, r.stderr);
  let state = readState(root);
  assert.deepEqual(state.spec_paths, [`${SPEC_DIR}/02-api.spec.md`, "docs/05-specs/otro/*.spec.md"], "only the covering glob is expanded");
  assert.deepEqual(state.lifted_spec_paths, [`${SPEC_DIR}/01-modelo.spec.md`]);
  assert.deepEqual(state.specs.map((s) => s.slug), ["01-modelo", "02-api"], "lift-spec keeps the specs[] entry");

  r = cli(root, "lift-spec", "--slug", "02-api");
  assert.equal(r.status, 0, r.stderr);
  state = readState(root);
  assert.deepEqual(state.spec_paths, ["docs/05-specs/otro/*.spec.md"], "an explicit entry equal to the path is removed");
  assert.deepEqual(state.lifted_spec_paths, [`${SPEC_DIR}/01-modelo.spec.md`, `${SPEC_DIR}/02-api.spec.md`]);

  r = cli(root, "lift-spec", "--slug", "02-api");
  assert.equal(r.status, 1, "already lifted: nothing covers it any more");
  assert.match(r.stderr, /seal-cli: no sealed spec for slug 02-api/);
});

test("lift-spec of a slug that no entry covers → exit 1; a glob with a wildcard dirname cannot be expanded → exit 1", () => {
  const root = createProject();
  withSpecFiles(root, "01-modelo");
  writeState(root, sealedEpic());
  let r = cli(root, "lift-spec", "--slug", "99-inexistente");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /seal-cli: no sealed spec for slug 99-inexistente/);
  assert.deepEqual(readState(root).spec_paths, [`${SPEC_DIR}/*.spec.md`], "nothing changes on failure");

  writeState(root, sealedEpic({ spec_paths: ["docs/05-specs/**/*.spec.md"] }));
  r = cli(root, "lift-spec", "--slug", "01-modelo");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /seal-cli: cannot expand docs\/05-specs\/\*\*\/\*\.spec\.md/);

  assert.equal(cli(createProject(), "lift-spec", "--slug", "01").status, 1, "no seal to update");
  assert.equal(cli(createProject(), "lift-spec").status, 2, "--slug is required");
});

test("supersede refuses a path in the test_paths of its own spec or a sibling's (exit 1) unless --shared-with-red; --clear empties both fields", () => {
  const root = createProject();
  writeState(root, sealedEpic());
  let r = cli(root, "supersede", "--slug", "01-modelo", "--paths", "tests/old/a.test.js,tests/notas/modelo.test.js");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /seal-cli: refused: tests\/notas\/modelo\.test\.js is in specs\[01-modelo\]\.test_paths \(RED of 01-modelo\) — pass --shared-with-red/);
  assert.deepEqual(readState(root).supersede_paths, [], "nothing written on refusal");

  r = cli(root, "supersede", "--slug", "01-modelo", "--paths", "tests/notas/api.test.js");
  assert.equal(r.status, 1, "a sibling's RED file is refused too");
  assert.match(r.stderr, /refused: tests\/notas\/api\.test\.js is in specs\[02-api\]\.test_paths/);

  r = cli(root, "supersede", "--paths", "tests/notas/api.test.js");
  assert.equal(r.status, 1, "without --slug the same rule applies");
  assert.match(r.stderr, /refused/);

  r = cli(root, "supersede", "--slug", "01-modelo", "--paths", "tests/old/a.test.js,tests/notas/modelo.test.js", "--shared-with-red");
  assert.equal(r.status, 0, r.stderr);
  let state = readState(root);
  assert.deepEqual(state.supersede_paths, ["tests/old/a.test.js", "tests/notas/modelo.test.js"]);
  assert.equal(state.supersede_for, "01-modelo");

  r = cli(root, "supersede", "--clear");
  assert.equal(r.status, 0, r.stderr);
  state = readState(root);
  assert.deepEqual(state.supersede_paths, []);
  assert.equal(state.supersede_for, null);

  r = cli(root, "supersede", "--clear", "--paths", "tests/old/a.test.js");
  assert.equal(r.status, 2, "--clear takes no paths");
});
