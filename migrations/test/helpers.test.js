// Shared helpers for migration tests. Named *.test.js so `node --test` loads it
// harmlessly (it registers no tests); it must not be a plain .js file because
// any .js under a test/ directory is executed as a test by node's discovery.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const pluginVersion = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8")).version;
const { loadProject, createContext, walk } = require("../../hooks/lib/doctor/project");

const created = [];

function makeProject(files = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-migration-"));
  created.push(projectRoot);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(projectRoot, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (text === null) continue; // directory only
    fs.writeFileSync(abs, text);
  }
  return projectRoot;
}

function contextFor(projectRoot, options = {}) {
  return createContext(loadProject(projectRoot, options.pluginVersion || pluginVersion), options);
}

function snapshot(projectRoot) {
  const out = {};
  for (const rel of walk(projectRoot, "")) {
    out[rel] = fs.readFileSync(path.join(projectRoot, rel), "utf8");
  }
  return out;
}

function cleanup() {
  while (created.length > 0) {
    fs.rmSync(created.pop(), { recursive: true, force: true });
  }
}

module.exports = { root, pluginVersion, makeProject, contextFor, snapshot, cleanup };
