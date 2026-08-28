// Project model for the doctor and the migrations: filesystem access, the
// "living documents" set, ROADMAP parsing and the migration context.

const fs = require("fs");
const path = require("path");
const { readSettings } = require("../settings");

const IGNORED_DIRS = new Set(["node_modules", ".git", ".claude", "bin", "obj", "dist", "build", ".next", "coverage"]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

// Recursively lists files under `relDir` (posix, relative to root). Missing dir → [].
function walk(root, relDir = "") {
  const out = [];
  const start = path.join(root, relDir);
  if (!fs.existsSync(start)) return out;
  const stack = [relDir];
  while (stack.length > 0) {
    const rel = stack.pop();
    const abs = path.join(root, rel);
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        stack.push(rel ? `${rel}/${entry.name}` : entry.name);
      } else if (entry.isFile()) {
        out.push(rel ? `${rel}/${entry.name}` : entry.name);
      }
    }
  }
  return out.map(toPosix).sort();
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return null;
  }
}

function writeText(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function lines(text) {
  return String(text || "").split(/\r?\n/);
}

// ---------------------------------------------------------------------------
// ROADMAP
// ---------------------------------------------------------------------------

const MILESTONE_HEADING = /^#{2,3}\s+Milestone\b(.*)$/i;
const EPIC_LINE = /^\s*-\s*\[( |\/|x)\]\s*(.*)$/;

function epicIdFrom(text) {
  const bold = text.match(/\*\*Epic\s+([^:*]+?)\s*[:*]/i);
  if (bold) return bold[1].trim();
  const plain = text.match(/\bEpic\s+([A-Za-z0-9._-]+)/i);
  return plain ? plain[1].trim() : null;
}

// Returns { epics, milestones }. A milestone is `closed` when it is a tombstone
// (heading marked archived) or every epic under it is [x].
function parseRoadmap(text) {
  const epics = [];
  const milestones = [];
  let current = null;
  lines(text).forEach((line, index) => {
    const heading = line.match(MILESTONE_HEADING);
    if (heading) {
      current = {
        title: line.replace(/^#+\s*/, "").trim(),
        lineNo: index + 1,
        tombstone: /archivad|✅/i.test(heading[1]),
        epics: []
      };
      milestones.push(current);
      return;
    }
    const epic = line.match(EPIC_LINE);
    if (epic) {
      const entry = {
        state: epic[1] === "x" ? "done" : epic[1] === "/" ? "in-progress" : "pending",
        id: epicIdFrom(epic[2]),
        text: epic[2].trim(),
        lineNo: index + 1,
        milestone: current ? current.title : null
      };
      epics.push(entry);
      if (current) current.epics.push(entry);
    }
  });
  for (const m of milestones) {
    m.closed = m.tombstone || (m.epics.length > 0 && m.epics.every((e) => e.state === "done"));
  }
  return { epics, milestones };
}

// ---------------------------------------------------------------------------
// Living documents — the ones the corpus lint may hold to account. Immutable
// history (specs of closed epics, reviews, debug logs, archived milestones,
// local telemetry) is excluded on purpose.
// ---------------------------------------------------------------------------

function isLivingDoc(rel) {
  if (!rel.endsWith(".md")) return false;
  if (rel.startsWith("docs/07-reviews/")) return false;
  if (rel.startsWith("docs/06-debug-logs/")) return false;
  if (rel.startsWith("docs/04-roadmap/archive/")) return false;
  if (rel.startsWith("docs/.specture-meta/")) return false;
  if (rel.startsWith("docs/05-specs/")) {
    const rest = rel.slice("docs/05-specs/".length);
    if (rest.startsWith("_current/")) return true;
    if (rest.endsWith("/_planning.md")) return true;
    return !rest.includes("/"); // root-level planning docs (impact analyses, open questions)
  }
  return rel.startsWith("docs/") || rel.startsWith(".specture/");
}

// ---------------------------------------------------------------------------
// stack.yml — only the two fields the doctor needs; no YAML dependency.
// ---------------------------------------------------------------------------

function stackField(stackText, section, key) {
  let inSection = false;
  for (const line of lines(stackText)) {
    if (/^\S/.test(line)) {
      inSection = new RegExp(`^${section}\\s*:`).test(line);
      continue;
    }
    if (!inSection) continue;
    const field = line.match(new RegExp(`^\\s+${key}\\s*:\\s*(.*)$`));
    if (field) {
      const value = field[1].replace(/#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2");
      return value || null;
    }
  }
  return null;
}

function loadProject(root, pluginVersion) {
  const files = [...walk(root, "docs"), ...walk(root, ".specture")];
  const stackText = readText(root, ".specture/stack.yml") || "";
  const roadmapText = readText(root, "docs/04-roadmap/ROADMAP.md");
  return {
    root,
    pluginVersion,
    settings: readSettings(root),
    stackText,
    contractFile: stackField(stackText, "api", "contract_file"),
    roadmapText,
    roadmap: roadmapText === null ? null : parseRoadmap(roadmapText),
    files,
    living: files.filter(isLivingDoc),
    exists: (rel) => exists(root, rel),
    read: (rel) => readText(root, rel)
  };
}

// Context handed to migrations. `dryRun` turns writes into no-ops that are recorded.
function createContext(project, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const writes = [];
  return {
    projectRoot: project.root,
    pluginVersion: project.pluginVersion,
    settings: project.settings,
    stackText: project.stackText,
    contractFile: project.contractFile,
    roadmap: project.roadmap,
    roadmapText: project.roadmapText,
    dryRun,
    writes,
    exists: (rel) => exists(project.root, rel),
    read: (rel) => readText(project.root, rel),
    list: (relDir) => walk(project.root, relDir),
    write: (rel, text) => {
      writes.push(rel);
      if (!dryRun) writeText(project.root, rel, text);
    },
    refresh: () => Object.assign(project, loadProject(project.root, project.pluginVersion))
  };
}

module.exports = {
  IGNORED_DIRS,
  toPosix,
  walk,
  exists,
  readText,
  writeText,
  lines,
  parseRoadmap,
  epicIdFrom,
  isLivingDoc,
  stackField,
  loadProject,
  createContext
};
