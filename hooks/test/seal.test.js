const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const seal = require("../lib/seal");

const temporaryDirectories = [];

function projectWith(state) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-seal-"));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, ".specture", "state"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "state", "build-locked.json"), typeof state === "string" ? state : JSON.stringify(state));
  return root;
}

const V3 = {
  epic: "epic-1.2-notas",
  sealed_at: "2026-09-07T10:00:00Z",
  spec_sha: "abc1234",
  spec_paths: ["docs/05-specs/epic-1.2-notas/*.spec.md"],
  test_globs: ["tests/**/*.test.js"],
  allowed_paths: ["archivador_api/src/notas/service.js", "archivador_api/src/notas/"],
  supersede_paths: [],
  specs: [{ slug: "01-modelo-nota", red_sha: "red111", test_paths: ["tests/notas/modelo-nota.test.js"] }]
};

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("readSeal: v1, v2 and v3 shapes; arrays default to []", () => {
  const v1 = seal.readSeal(projectWith({ epic: "a", red_sha: "r", test_paths: ["tests/**"] }));
  assert.equal(v1.specs.length, 1);
  assert.equal(v1.specs[0].legacy, true);
  assert.deepEqual(v1.spec_paths, []);
  assert.deepEqual(v1.allowed_paths, []);
  assert.equal(v1.spec_sha, null);

  const v2 = seal.readSeal(projectWith({ epic: "a", specs: [{ slug: "01", red_sha: "r", test_paths: ["tests/a/**"] }] }));
  assert.equal(v2.specs[0].slug, "01");
  assert.equal(v2.specs[0].legacy, false);

  const v3 = seal.readSeal(projectWith(V3));
  assert.equal(v3.spec_sha, "abc1234");
  assert.deepEqual(v3.spec_paths, V3.spec_paths);
  assert.deepEqual(v3.allowed_paths, V3.allowed_paths);
  assert.deepEqual(v3.test_globs, V3.test_globs);
  assert.equal(v3.specs.length, 1);

  assert.equal(seal.readSeal(projectWith("nope")).corrupt, true);
  assert.equal(seal.readSeal(projectWith("[1,2]")).corrupt, true);
  assert.equal(seal.readSeal(path.join(os.tmpdir(), "no-such-project-" + Date.now())), null);
});

test("hasRules: a plan-time seal without specs[] still rules; an empty object does not", () => {
  assert.equal(seal.hasRules(seal.readSeal(projectWith({ epic: "a", spec_sha: "s", spec_paths: ["docs/05-specs/a/*.spec.md"] }))), true);
  assert.equal(seal.hasRules(seal.readSeal(projectWith({ epic: "a", allowed_paths: ["src/"] }))), true);
  assert.equal(seal.hasRules(seal.readSeal(projectWith({ epic: "a" }))), false);
  assert.equal(seal.hasRules(seal.readSeal(projectWith("nope"))), false);
  assert.equal(seal.hasRules(null), false);
});

test("classify: precedence test → spec → allowed, docs/ and .specture/ never governed by allowed_paths", () => {
  const s = seal.readSeal(projectWith(V3));
  assert.equal(seal.classify("tests/notas/modelo-nota.test.js", s).kind, "test");
  assert.equal(seal.classify("tests/notas/modelo-nota.test.js", s).spec.slug, "01-modelo-nota");
  assert.equal(seal.classify("docs/05-specs/epic-1.2-notas/01-modelo-nota.spec.md", s).kind, "spec");
  assert.equal(seal.classify("docs/05-specs/epic-1.2-notas/_planning.md", s), null);
  assert.equal(seal.classify("archivador_api/src/notas/service.js", s), null, "declared file");
  assert.equal(seal.classify("archivador_api/src/notas/router.js", s), null, "under a declared dir");
  assert.equal(seal.classify("tests/notas/helpers.js", s).kind, "allowed", "a helper outside the test globs is production code — the coordinator adds the test root to test_globs");
  assert.equal(seal.classify("tests/notas/helpers.js", seal.readSeal(projectWith({ ...V3, test_globs: ["tests/**"] }))), null, "test root in test_globs → helpers writable");
  assert.equal(seal.classify("tests/notas/otro.test.js", s), null, "future test under the conventions glob");
  assert.equal(seal.classify("archivador_api/src/pagos/service.js", s).kind, "allowed");
  assert.equal(seal.classify("README.md", s).kind, "allowed");
  assert.equal(seal.classify("docs/04-roadmap/ROADMAP.md", s), null);
  assert.equal(seal.classify(".specture/state/build-locked.json", s), null);
  assert.equal(seal.classify("archivador_api\\src\\pagos\\x.js", s).kind, "allowed", "backslashes normalized");
});

test("without allowed_paths nothing outside the surface is denied (fail open, as before)", () => {
  const s = seal.readSeal(projectWith({ ...V3, allowed_paths: [] }));
  assert.equal(seal.classify("archivador_api/src/pagos/service.js", s), null);
  assert.equal(seal.classify("docs/05-specs/epic-1.2-notas/01-modelo-nota.spec.md", s).kind, "spec");
  assert.equal(seal.classify("tests/notas/modelo-nota.test.js", s).kind, "test");
});

test("supersede_paths lifts the TEST deny for that path only", () => {
  const s = seal.readSeal(projectWith({ ...V3, supersede_paths: ["tests/notas/modelo-nota.test.js"] }));
  assert.equal(seal.classify("tests/notas/modelo-nota.test.js", s), null);
  assert.equal(seal.classify("docs/05-specs/epic-1.2-notas/01-modelo-nota.spec.md", s).kind, "spec");
  assert.equal(seal.classify("archivador_api/src/pagos/service.js", s).kind, "allowed");
});

test("denyReason names the kind, the path, the epic and the recovery path", () => {
  const s = seal.readSeal(projectWith(V3));
  assert.match(seal.denyReason("test", "tests/x.test.js", s, s.specs[0]), /TDD Honesty Gate: `tests\/x\.test\.js`.*epic-1\.2-notas.*spec 01-modelo-nota.*red111/);
  assert.match(seal.denyReason("spec", "docs/05-specs/e/01.spec.md", s), /Spec Seal: `docs\/05-specs\/e\/01\.spec\.md`.*SPEC_SHA abc1234.*BLOCKED: spec/);
  assert.match(seal.denyReason("allowed", "src/x.js", s), /Allowed Paths: `src\/x\.js`.*Crea:\/Modifica:.*BLOCKED: spec <ID>/);
});

test("dirToGlob and the glob matcher accept plain file paths and directory entries", () => {
  assert.equal(seal.dirToGlob("src/x/"), "src/x/**");
  assert.equal(seal.dirToGlob("src/x/a.js"), "src/x/a.js");
  assert.equal(seal.pathMatchesAnyGlob("src/x/deep/a.js", ["src/x/**"]), true);
  assert.equal(seal.pathMatchesAnyGlob("src/x/a.js", ["src/x/a.js"]), true);
  assert.equal(seal.pathMatchesAnyGlob("src/x/a.js", ["src/x/b.js"]), false);
});
