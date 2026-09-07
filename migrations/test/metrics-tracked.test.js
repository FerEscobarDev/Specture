const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const { makeProject, contextFor, snapshot, cleanup } = require("./helpers.test");
const catalog = require("../index");
const byId = Object.fromEntries(catalog.map((m) => [m.id, m]));

const STACK = 'project:\n  name: "Mi App"\n';
const NEW_FORM = ".specture/state/\ndocs/.specture-meta/*\n!docs/.specture-meta/build-metrics.jsonl\n";

afterEach(cleanup);

function gitignoreOf(root) {
  return fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/).filter(Boolean);
}

function lifecycle(files, extraAssert) {
  const m = byId["1.18-metrics-tracked"];
  const root = makeProject(files);
  assert.equal(m.detect(contextFor(root)), "pending");
  const result = m.apply(contextFor(root));
  assert.equal(m.verify(contextFor(root)), true);
  assert.equal(m.detect(contextFor(root)), "done");
  const before = snapshot(root);
  m.apply(contextFor(root));
  assert.deepEqual(snapshot(root), before, "idempotent");
  if (extraAssert) extraAssert(root, result);
  return root;
}

test("1.18-metrics-tracked rewrites the directory entry into the glob + negation, in place", () => {
  lifecycle({ ".specture/stack.yml": STACK, ".gitignore": "node_modules/\n.specture/state/\ndocs/.specture-meta/\n" }, (root) => {
    assert.deepEqual(gitignoreOf(root), ["node_modules/", ".specture/state/", "docs/.specture-meta/*", "!docs/.specture-meta/build-metrics.jsonl"]);
  });
  lifecycle({ ".specture/stack.yml": STACK, ".gitignore": "docs/.specture-meta\n" }, (root) => {
    assert.deepEqual(gitignoreOf(root), ["docs/.specture-meta/*", "!docs/.specture-meta/build-metrics.jsonl"]);
  });
});

test("1.18-metrics-tracked appends the pair (with a comment) when the entry is absent, and keeps CRLF", () => {
  lifecycle({ ".specture/stack.yml": STACK, ".gitignore": "node_modules/\r\n" }, (root) => {
    const text = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    assert.ok(text.includes("\r\n"), "CRLF preserved");
    assert.deepEqual(gitignoreOf(root).filter((l) => !l.startsWith("#")), ["node_modules/", "docs/.specture-meta/*", "!docs/.specture-meta/build-metrics.jsonl"]);
  });
  lifecycle({ ".specture/stack.yml": STACK }, (root) => {
    assert.deepEqual(gitignoreOf(root).filter((l) => !l.startsWith("#")), ["docs/.specture-meta/*", "!docs/.specture-meta/build-metrics.jsonl"]);
  });
});

test("1.18-metrics-tracked notes the git add when the metrics file already exists", () => {
  lifecycle({ ".specture/stack.yml": STACK, ".gitignore": "docs/.specture-meta/\n", "docs/.specture-meta/build-metrics.jsonl": "{}\n" }, (root, result) => {
    assert.ok(result.notes.some((n) => n.includes("git add docs/.specture-meta/build-metrics.jsonl")));
  });
});

test("the new form is done for 1.18 AND for 1.7; applying 1.7 on it changes nothing (no re-add of the directory entry)", () => {
  const root = makeProject({ ".specture/stack.yml": STACK, ".gitignore": NEW_FORM });
  assert.equal(byId["1.18-metrics-tracked"].detect(contextFor(root)), "done");
  assert.equal(byId["1.7-meta-gitignore"].detect(contextFor(root)), "done");
  assert.equal(byId["1.7-meta-gitignore"].verify(contextFor(root)), true);
  const before = snapshot(root);
  byId["1.7-meta-gitignore"].apply(contextFor(root));
  assert.deepEqual(snapshot(root), before);
  assert.equal(byId["1.7-meta-gitignore"].detect(contextFor(makeProject({ ".specture/stack.yml": STACK, ".gitignore": "docs/.specture-meta/\n" }))), "done", "old form still done for 1.7");
  assert.equal(byId["1.18-metrics-tracked"].detect(contextFor(makeProject({ ".gitignore": NEW_FORM }))), "n/a", "not a Specture project");
});
