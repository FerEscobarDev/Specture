// Invariant: a project freshly created from the current templates (what `setup`
// produces at the installed plugin version) has NO pending migration. If this
// fails, either the templates or the catalog moved without the other.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const { root, pluginVersion, makeProject, contextFor, cleanup } = require("./helpers.test");
const catalog = require("../index");

afterEach(cleanup);

function template(rel) {
  return fs.readFileSync(path.join(root, "templates", "project-config", ...rel.split("/")), "utf8");
}

test("a project built from the current templates detects every migration as done or n/a", () => {
  const projectRoot = makeProject({
    ".specture/stack.yml": template("stack.template.yml"),
    ".specture/conventions.md": template("conventions.template.md"),
    ".specture/settings.yml": template("settings.template.yml").replace('"[X.Y.Z]"', pluginVersion),
    ".specture/decisions/001-initial-stack.md": template("decisions/000-template.md"),
    ".gitignore": ".specture/state/\ndocs/.specture-meta/*\n!docs/.specture-meta/build-metrics.jsonl\n"
  });
  const ctx = contextFor(projectRoot);
  const statuses = catalog.map((m) => ({ id: m.id, status: m.detect(ctx) }));
  const pending = statuses.filter((s) => s.status === "pending");

  assert.deepEqual(pending, [], `fresh setup must not need migrations: ${JSON.stringify(pending)}`);
  assert.ok(statuses.every((s) => s.status === "done" || s.status === "n/a"), JSON.stringify(statuses));
});

test("the settings template parses and carries every framework toggle", () => {
  const { parseSettingsYaml, TOGGLE_KEYS } = require("../../hooks/lib/settings");
  const parsed = parseSettingsYaml(template("settings.template.yml").replace('"[X.Y.Z]"', pluginVersion));

  assert.equal(parsed.schema_version, pluginVersion);
  assert.equal(parsed.profile, "custom");
  for (const key of TOGGLE_KEYS) assert.ok(key in parsed, key);
});
