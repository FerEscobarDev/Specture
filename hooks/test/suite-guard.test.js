const assert = require("node:assert/strict");
const { test } = require("node:test");
const { classifyFullSuite, denyReason, distinguishingTokens } = require("../lib/suite-guard");

function quality(testCmd, scoped) {
  return { commands: { test: testCmd || null, test_scoped: scoped || null } };
}

const sealIn = (phase) => ({ epic: "epic-1.2-notas", phase, specs: [] });

const DOTNET = quality("dotnet test", "dotnet test --no-restore --filter \"$(printf 'FullyQualifiedName~%s|' {names} | sed 's/|$//')\"");
const PYTEST = quality("pytest -q", "pytest -q {files}");
const VITEST = quality("npx vitest run", "npx vitest run {files}");
const GRADLE = quality("./gradlew test", "./gradlew test $(printf -- '--tests *%s* ' {names})");
const GO = quality("go test ./...", "go test $(dirname {files} | sort -u)");

test("the full suite is denied in red/green/mutation and allowed in baseline/verify", () => {
  for (const phase of ["red", "green", "mutation"]) {
    const found = classifyFullSuite({ command: "dotnet test", seal: sealIn(phase), quality: DOTNET });
    assert.ok(found, phase);
    assert.equal(found.kind, "full-suite");
    assert.equal(found.phase, phase);
    assert.equal(found.matched, "dotnet test");
  }
  for (const phase of ["baseline", "verify"]) {
    assert.equal(classifyFullSuite({ command: "dotnet test", seal: sealIn(phase), quality: DOTNET }), null, phase);
  }
});

test("fail open: no seal, corrupt seal, seal without phase, test slot undefined or none, empty command", () => {
  assert.equal(classifyFullSuite({ command: "dotnet test", seal: null, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "dotnet test", seal: { corrupt: true }, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "dotnet test", seal: { epic: "e", phase: null, specs: [] }, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "dotnet test", seal: sealIn("green"), quality: quality(null, null) }), null);
  assert.equal(classifyFullSuite({ command: "dotnet test", seal: sealIn("green"), quality: null }), null);
  assert.equal(classifyFullSuite({ command: "   ", seal: sealIn("green"), quality: DOTNET }), null);
});

test("a scoped run carrying a distinguishing token of test_scoped is allowed (.NET --filter, gradle --tests); the bare suite is not", () => {
  const seal = sealIn("green");
  assert.equal(classifyFullSuite({ command: "dotnet test --no-restore --filter \"FullyQualifiedName~FooTests\"", seal, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "dotnet   test --filter FullyQualifiedName~FooTests", seal, quality: DOTNET }), null, "whitespace is normalised");
  assert.ok(classifyFullSuite({ command: "cd api && dotnet test 2>&1 | tail -40", seal, quality: DOTNET }), "a pipe and a cd do not hide the suite");
  assert.ok(classifyFullSuite({ command: "dotnet test tests/Psikora.Integration.Tests", seal, quality: DOTNET }), "a project path is not a filter: still the whole project suite");
  assert.equal(classifyFullSuite({ command: "./gradlew test --tests *FooTest*", seal, quality: GRADLE }), null);
  assert.ok(classifyFullSuite({ command: "./gradlew test", seal, quality: GRADLE }));
  assert.deepEqual(distinguishingTokens("dotnet test", "dotnet test --no-restore --filter {names}"), ["--no-restore", "--filter"]);
});

test("test_scoped = test + placeholders: a path-like argument after the match is the scope (pytest, vitest); flags alone are not", () => {
  const seal = sealIn("green");
  assert.equal(classifyFullSuite({ command: "pytest -q tests/test_a.py", seal, quality: PYTEST }), null);
  assert.equal(classifyFullSuite({ command: "pytest -q tests/test_a.py tests/test_b.py && echo ok", seal, quality: PYTEST }), null);
  assert.ok(classifyFullSuite({ command: "pytest -q", seal, quality: PYTEST }));
  assert.ok(classifyFullSuite({ command: "pytest -q -x | tee out.txt", seal, quality: PYTEST }), "a flag is not a scope; the path after the pipe belongs to tee");
  assert.equal(classifyFullSuite({ command: "npx vitest run src/a.test.ts", seal, quality: VITEST }), null);
  assert.ok(classifyFullSuite({ command: "npx vitest run", seal, quality: VITEST }));
});

test("word boundaries: a different binary or a longer word never matches; go's ./... suite matches only itself", () => {
  const seal = sealIn("green");
  assert.equal(classifyFullSuite({ command: "dotnet testx", seal, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "mydotnet test", seal, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "pytest -qq", seal, quality: PYTEST }), null);
  assert.equal(classifyFullSuite({ command: "go test ./pkg/foo", seal, quality: GO }), null);
  assert.ok(classifyFullSuite({ command: "go test ./...", seal, quality: GO }));
});

test("the sanctioned CLI is no bypass: quality.js run|expand test is denied out of phase, test_scoped is not", () => {
  const seal = sealIn("green");
  for (const command of [
    'node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/quality.js" run test --log',
    "node hooks/lib/quality.js expand test",
    "node C:/plugin/hooks/lib/quality.js run test --files a"
  ]) {
    const found = classifyFullSuite({ command, seal, quality: DOTNET });
    assert.ok(found, command);
    assert.equal(found.matched, "quality.js run|expand test");
  }
  assert.equal(classifyFullSuite({ command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/quality.js" expand test_scoped --files a.test.js', seal, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "node hooks/lib/quality.js run type_check --log", seal, quality: DOTNET }), null);
  assert.equal(classifyFullSuite({ command: "node hooks/lib/quality.js run test --log", seal: sealIn("verify"), quality: DOTNET }), null);
});

test("test identical to test_scoped, or test_scoped undefined: denied with a note asking for a distinguishing test_scoped", () => {
  const same = classifyFullSuite({ command: "npm test", seal: sealIn("green"), quality: quality("npm test", "npm test") });
  assert.ok(same);
  assert.match(same.note, /identical to test/);
  const undefinedScoped = classifyFullSuite({ command: "npm test", seal: sealIn("green"), quality: quality("npm test", null) });
  assert.ok(undefinedScoped);
  assert.match(undefinedScoped.note, /sin definir/);
  const reason = denyReason("npm test", same);
  assert.match(reason, /Specture suite guard/);
  assert.match(reason, /phase `green`/);
  assert.match(reason, /Step 3\.9 \(phase baseline\) and Step 7 \(phase verify\)/);
  assert.match(reason, /expand test_scoped/);
  assert.match(reason, /seal-cli\.js phase --set baseline\|verify/);
  assert.match(reason, /Note: test_scoped is identical/);
  assert.match(reason, /hooks\.enabled: false/);
});
