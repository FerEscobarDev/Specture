const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function directoryNames(relativePath, filename) {
  return fs
    .readdirSync(path.join(root, relativePath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(root, relativePath, entry.name, filename)))
    .map((entry) => entry.name)
    .sort();
}

test("keeps Copilot and Claude manifest metadata synchronized", () => {
  const copilotPlugin = readJson("plugin.json");
  const claudePlugin = readJson(".claude-plugin/plugin.json");
  const copilotMarketplace = readJson(".github/plugin/marketplace.json");

  assert.equal(copilotPlugin.name, claudePlugin.name);
  assert.equal(copilotMarketplace.name, copilotPlugin.name);
  assert.equal(copilotMarketplace.plugins[0].name, copilotPlugin.name);
  // Version agreement across all four manifests is asserted in release-contract.test.js.
  assert.equal(copilotPlugin.skills, "skills/");
  assert.equal(copilotPlugin.agents, "agents/");
  assert.equal(copilotPlugin.hooks, "hooks.json");
});

test("provides a Copilot profile for every Claude specialist", () => {
  const matrix = readJson("copilot/compatibility-matrix.json");
  const claudeAgents = directoryNames("agents", "AGENT.md");
  const copilotAgents = fs
    .readdirSync(path.join(root, "copilot", "agents"))
    .filter((entry) => entry.endsWith(".agent.md"))
    .map((entry) => entry.replace(/\.agent\.md$/, ""))
    .sort();

  assert.deepEqual(matrix.agents.slice().sort(), claudeAgents);
  assert.deepEqual(copilotAgents, claudeAgents);
});

test("tracks every Specture skill in the compatibility matrix", () => {
  const matrix = readJson("copilot/compatibility-matrix.json");
  const skills = directoryNames("skills", "SKILL.md");

  assert.deepEqual(matrix.skills.slice().sort(), skills);
});

test("quotes descriptions that contain YAML mapping characters", () => {
  for (const skill of directoryNames("skills", "SKILL.md")) {
    const content = fs.readFileSync(
      path.join(root, "skills", skill, "SKILL.md"),
      "utf8"
    );
    const description = content.match(/^description:\s*(.+)$/m);

    assert.ok(description, `${skill} must declare a description`);
    if (description[1].includes(": ")) {
      assert.match(
        description[1],
        /^'(?:[^']|'')*'$/,
        `${skill} must quote a description containing ": "`
      );
    }
  }
});
