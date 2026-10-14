const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const { makeProject, contextFor, snapshot, cleanup } = require("./helpers.test");
const catalog = require("../index");
const { readQualityCommands, parseQualityCommands, expandCommand, commandFor } = require("../../hooks/lib/quality");

const migration = catalog.find((m) => m.id === "2.9-test-scoped-command");
const STACK = ".specture/stack.yml";
const qualityCli = path.resolve(__dirname, "..", "..", "hooks", "lib", "quality.js");

// A v2.8.0 project: the block exists, `test_scoped` does not.
const V28 =
  'project:\n  name: "Demo"\n  slug: "demo"\n\n' +
  "quality:\n" +
  '  linter: "eslint"\n' +
  "  commands:\n" +
  '    test: "npm test"              # whole suite\n' +
  '    type_check: "npx tsc --noEmit"\n' +
  '    lint: "sin definir"\n' +
  '    format_check: "none"\n' +
  '    mutation: "sin definir"\n' +
  "\n" +
  'conventions_file: ".specture/conventions.md"\n';

const readStack = (root) => fs.readFileSync(path.join(root, STACK), "utf8");

afterEach(cleanup);

test("2.9-test-scoped-command inserts test_scoped right after test:, keeps everything else and is idempotent", () => {
  const root = makeProject({ [STACK]: V28 });
  assert.equal(migration.detect(contextFor(root)), "pending");
  const result = migration.apply(contextFor(root));
  const text = readStack(root);
  assert.match(text, /    test: "npm test"              # whole suite\n    test_scoped: "sin definir"    # only the tests in \{files\} \/ \{names\}/, "lands right after test:, same indent");
  assert.ok(text.endsWith('\nconventions_file: ".specture/conventions.md"\n'));
  assert.deepEqual(parseQualityCommands(text).values, { test: "npm test", test_scoped: "sin definir", type_check: "npx tsc --noEmit", lint: "sin definir", format_check: "none", mutation: "sin definir" });
  assert.ok(result.notes.some((n) => /quality-catalog/.test(n) && /Step 7/.test(n)));
  assert.equal(migration.verify(contextFor(root)), true);
  assert.equal(migration.detect(contextFor(root)), "done");
  const before = snapshot(root);
  migration.apply(contextFor(root));
  assert.deepEqual(snapshot(root), before, "idempotent");

  const q = readQualityCommands(root);
  assert.equal(q.states.test_scoped, "undefined");
  assert.equal(q.commands.test, "npm test");
});

test("2.9-test-scoped-command keeps CRLF, lands after the last entry when test: is absent, and is n/a without the block", () => {
  const crlf = makeProject({ [STACK]: V28.replace(/\n/g, "\r\n") });
  migration.apply(contextFor(crlf));
  assert.ok(!/[^\r]\n/.test(readStack(crlf)), "no bare LF slipped in");
  assert.equal(migration.detect(contextFor(crlf)), "done");

  const noTest = makeProject({ [STACK]: 'quality:\n  commands:\n    lint: "eslint {files}"\n' });
  migration.apply(contextFor(noTest));
  assert.equal(readStack(noTest), 'quality:\n  commands:\n    lint: "eslint {files}"\n    test_scoped: "sin definir"    # only the tests in {files} / {names} — every run but the baseline and Step 7 (v2.9.0)\n');

  assert.equal(migration.detect(contextFor(makeProject({}))), "n/a");
  assert.equal(migration.detect(contextFor(makeProject({ [STACK]: 'quality:\n  linter: "eslint"\n' }))), "n/a", "no commands block → 2.8-quality-commands writes it whole, test_scoped included");
  // The 2.8 migration writes every slot, so on a fresh v2.8 block this one is already done.
  const fresh = makeProject({ [STACK]: 'quality:\n  linter: "eslint"\n' });
  catalog.find((m) => m.id === "2.8-quality-commands").apply(contextFor(fresh));
  assert.equal(migration.detect(contextFor(fresh)), "done");
});

test("quality.js: {names} expands to base names without extension or test suffix; commandFor returns null for an undefined slot", () => {
  assert.equal(
    expandCommand("dotnet test --filter {names} -- {files}", ["tests/A/FooTests.cs", "tests/B/bar.test.ts", "tests/C/Bar.test.ts", "x y.cs"]),
    'dotnet test --filter FooTests bar Bar x y -- tests/A/FooTests.cs tests/B/bar.test.ts tests/C/Bar.test.ts "x y.cs"'
  );
  assert.equal(expandCommand("npm test", ["a.js"]), "npm test");
  const root = makeProject({ [STACK]: V28 });
  assert.equal(commandFor(root, "test_scoped", ["a.js"]), null);
  assert.equal(commandFor(root, "test", []), "npm test");
  assert.equal(commandFor(root, "format_check", ["a.js"]), null, "none → null");
});

test("quality.js CLI: show lists every slot; expand prints the command or SKIPPED with exit 3", () => {
  const root = makeProject({ [STACK]: V28.replace('type_check: "npx tsc --noEmit"', 'type_check: "npx tsc --noEmit {files}"') });
  const run = (...args) => spawnSync(process.execPath, [qualityCli, ...args, "--project", root], { encoding: "utf8" });
  const show = run("show");
  assert.equal(show.status, 0);
  assert.equal(show.stdout, 'test: npm test\ntest_scoped: sin definir\ntype_check: npx tsc --noEmit {files}\nlint: sin definir\nformat_check: none\nmutation: sin definir\n');
  const expanded = run("expand", "type_check", "--files", "tests/a.test.ts,tests/b c.test.ts");
  assert.equal(expanded.status, 0);
  assert.equal(expanded.stdout, 'npx tsc --noEmit tests/a.test.ts "tests/b c.test.ts"\n');
  const skipped = run("expand", "test_scoped", "--files", "tests/a.test.ts");
  assert.equal(skipped.status, 3);
  assert.equal(skipped.stdout, "SKIPPED test_scoped: sin definir en stack.yml quality.commands\n");
  assert.equal(run("expand", "format_check", "--files", "a").stdout, "SKIPPED format_check: none\n");
  assert.equal(run("expand", "nope").status, 2);
});
