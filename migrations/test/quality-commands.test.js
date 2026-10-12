const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const { makeProject, contextFor, snapshot, cleanup } = require("./helpers.test");
const catalog = require("../index");
const { readQualityCommands, parseQualityCommands } = require("../../hooks/lib/quality");

const migration = catalog.find((m) => m.id === "2.8-quality-commands");
const STACK = ".specture/stack.yml";

const WITH_QUALITY =
  'project:\n  name: "Demo"\n  slug: "demo"\n\n' +
  "quality:\n" +
  '  linter: "eslint"        # the team\'s choice\n' +
  '  formatter: "prettier"\n' +
  '  type_checker: "none"\n' +
  "\n" +
  'conventions_file: ".specture/conventions.md"\n';

const readStack = (root) => fs.readFileSync(path.join(root, STACK), "utf8");

afterEach(cleanup);

test("2.8-quality-commands adds the block under quality: with every slot sin definir and leaves the rest byte-for-byte", () => {
  const root = makeProject({ [STACK]: WITH_QUALITY });
  assert.equal(migration.detect(contextFor(root)), "pending");
  const result = migration.apply(contextFor(root));
  const text = readStack(root);
  const parsed = parseQualityCommands(text);
  assert.deepEqual(parsed.values, { test: "sin definir", type_check: "sin definir", lint: "sin definir", format_check: "sin definir", mutation: "sin definir" });
  assert.ok(text.startsWith(WITH_QUALITY.slice(0, WITH_QUALITY.indexOf("\nconventions_file"))), "everything before the block is intact");
  assert.ok(text.endsWith('\nconventions_file: ".specture/conventions.md"\n'), "everything after the section is intact");
  assert.match(text, /type_checker: "none"\n  # What the framework EXECUTES/, "the block lands right after the last quality entry");
  assert.ok(result.notes.some((n) => /quality-catalog/.test(n)));
  assert.equal(migration.verify(contextFor(root)), true);
  assert.equal(migration.detect(contextFor(root)), "done");
  const before = snapshot(root);
  migration.apply(contextFor(root));
  assert.deepEqual(snapshot(root), before, "idempotent");

  const q = readQualityCommands(root);
  assert.deepEqual(q.commands, { test: null, type_check: null, lint: null, format_check: null, mutation: null });
  assert.equal(q.states.lint, "undefined");
});

test("2.8-quality-commands keeps CRLF and is n/a without stack.yml or without a quality section", () => {
  const root = makeProject({ [STACK]: WITH_QUALITY.replace(/\n/g, "\r\n") });
  migration.apply(contextFor(root));
  const text = readStack(root);
  assert.ok(!/[^\r]\n/.test(text), "no bare LF slipped in");
  assert.ok(parseQualityCommands(text));

  assert.equal(migration.detect(contextFor(makeProject({}))), "n/a");
  assert.equal(migration.detect(contextFor(makeProject({ [STACK]: 'project:\n  name: "Demo"\n' }))), "n/a");
});

test("quality.js: readQualityCommands classifies defined / none / undefined and expands {files}", () => {
  const root = makeProject({
    [STACK]: 'quality:\n  linter: "x"\n  commands:\n    test: "npm test"   # suite\n    type_check: none\n    lint: "npx eslint {files}"\n    format_check: ""\n    extra: "ignored"\n'
  });
  const q = readQualityCommands(root);
  assert.deepEqual(q.states, { test: "defined", type_check: "none", lint: "defined", format_check: "undefined", mutation: "undefined" });
  assert.equal(q.commands.test, "npm test");
  assert.equal(q.commands.type_check, null);
  const { expandCommand } = require("../../hooks/lib/quality");
  assert.equal(expandCommand(q.commands.lint, ["src/a.ts", "src/with space.ts"]), 'npx eslint src/a.ts "src/with space.ts"');
  assert.equal(expandCommand("npm test", ["x"]), "npm test");
  assert.equal(readQualityCommands(makeProject({})).exists, false);
});
