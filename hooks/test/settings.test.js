const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const settings = require("../lib/settings");
const { guard } = require("../lib/specture-guard");

const temporaryDirectories = [];

function createProject({ settingsYaml, conventions } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-settings-"));
  temporaryDirectories.push(projectRoot);
  fs.mkdirSync(path.join(projectRoot, ".specture"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".specture", "stack.yml"), "schema: 1\n");
  if (settingsYaml !== undefined) {
    fs.writeFileSync(path.join(projectRoot, ".specture", "settings.yml"), settingsYaml);
  }
  if (conventions !== undefined) {
    fs.writeFileSync(path.join(projectRoot, ".specture", "conventions.md"), conventions);
  }
  return projectRoot;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("parses the flat settings.yml subset (comments, quotes, CRLF, numbers, booleans)", () => {
  const parsed = settings.parseSettingsYaml(
    'schema_version: "1.15.0"   # comment\r\nprofile: custom\r\nhooks.enabled: true\r\n# full-line comment\r\ndocs_index.max_entries_per_dispatch: 5\r\nplaceholder: [true | false]\r\n'
  );

  assert.deepEqual(parsed, {
    schema_version: "1.15.0",
    profile: "custom",
    "hooks.enabled": true,
    "docs_index.max_entries_per_dispatch": 5
  });
});

test("reads settings.yml and expands the custom profile with defaults", () => {
  const root = createProject({
    settingsYaml: "schema_version: 1.15.0\nprofile: custom\nhooks.enabled: true\ncontext7.enabled: true\n"
  });
  const result = settings.readSettings(root);

  assert.equal(result.source, "settings.yml");
  assert.equal(result.schemaVersion, "1.15.0");
  assert.equal(result.values["hooks.enabled"], true);
  assert.equal(result.values["context7.enabled"], true);
  assert.equal(result.values["docs_index.enabled"], true);
  assert.equal(result.values["docs_index.max_entries_per_dispatch"], 3);
  assert.equal(result.values["knowledge.enabled"], false);
});

test("lean and full profiles override the individual toggles", () => {
  const lean = createProject({ settingsYaml: "profile: lean\nknowledge.enabled: true\n" });
  const full = createProject({ settingsYaml: "profile: full\nhooks.enabled: false\n" });

  const leanValues = settings.readSettings(lean).values;
  assert.equal(leanValues["hooks.enabled"], true);
  assert.equal(leanValues["docs_index.enabled"], false);
  assert.equal(leanValues["knowledge.enabled"], false, "lean ignores individual toggles");

  const fullValues = settings.readSettings(full).values;
  assert.equal(fullValues["hooks.enabled"], true, "full ignores individual toggles");
  assert.equal(fullValues["context7.enabled"], true);
});

test("falls back to conventions.md §10 (bold and plain forms, legacy aliases) when settings.yml is absent", () => {
  const root = createProject({
    conventions:
      "## 10. Specture\n\n- **specture.profile**: custom\n- **hooks.enabled**: true   # gate\n- context7.enabled: false\n- **learn.enabled**: true\n- **docs_index.max_entries_per_dispatch**: 4\n"
  });
  const result = settings.readSettings(root);

  assert.equal(result.source, "conventions.md");
  assert.equal(result.schemaVersion, null);
  assert.equal(result.values["hooks.enabled"], true);
  assert.equal(result.values["knowledge.enabled"], true, "learn.enabled aliases to knowledge.enabled");
  assert.equal(result.values["docs_index.max_entries_per_dispatch"], 4);
});

test("template placeholders in conventions.md count as unset", () => {
  const root = createProject({
    conventions: "- **hooks.enabled**: [true | false]\n- **knowledge.enabled**: [true | false]\n"
  });
  const result = settings.readSettings(root);

  assert.equal(result.source, "defaults");
  assert.equal(result.values["hooks.enabled"], false);
});

test("settings.yml wins over conventions.md when both exist", () => {
  const root = createProject({
    settingsYaml: "profile: custom\nhooks.enabled: false\n",
    conventions: "- **hooks.enabled**: true\n"
  });

  assert.equal(settings.readToggle(root, "hooks.enabled"), false);
});

test("the hook guard honours settings.yml and still honours legacy conventions.md", () => {
  const modern = createProject({ settingsYaml: "profile: lean\n" });
  const legacy = createProject({ conventions: "- **hooks.enabled**: true\n" });
  const off = createProject({ settingsYaml: "profile: custom\n" });

  assert.equal(guard({ cwd: modern }).active, true);
  assert.equal(guard({ cwd: legacy }).active, true);
  assert.equal(guard({ cwd: off }).active, false);
});

test("serializeSettings round-trips through parseSettingsYaml", () => {
  const text = settings.serializeSettings(
    { profile: "custom", "hooks.enabled": true, "docs_index.max_entries_per_dispatch": 2 },
    { schemaVersion: "1.15.0" }
  );
  const parsed = settings.parseSettingsYaml(text);

  assert.equal(parsed.schema_version, "1.15.0");
  assert.equal(parsed.profile, "custom");
  assert.equal(parsed["hooks.enabled"], true);
  assert.equal(parsed["docs_index.max_entries_per_dispatch"], 2);
  assert.equal(parsed["knowledge.enabled"], false);
});
