// The test-contract seal — `.specture/state/build-locked.json` — shared by every
// TDD Honesty Gate hook.
//
// Schema v2 (v1.15.0+): one epic, one entry per spec
//   { "epic": "<slug>", "sealed_at": "<ISO-8601>",
//     "specs": [ { "slug": "<task-slug>", "red_sha": "<sha>", "test_paths": ["<glob>", …] } ] }
// Schema v1 (still accepted): { "epic", "red_sha", "test_paths": [...], "locked_at" }
//
// A seal is STALE when the ROADMAP has no epic in `[/]`: the epic closed and the
// seal was never released. Hooks fail open on a stale seal (with a reason) so a
// leftover file cannot block unrelated work; `doctor check` reports it.

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(".specture", "state", "build-locked.json");
const ROADMAP_FILE = path.join("docs", "04-roadmap", "ROADMAP.md");

function globToRegExp(glob) {
  // Minimal glob translator covering the patterns used in conventions.md
  // (e.g. `**/*.test.ts`, `tests/**/*.py`, `*.spec.js`).
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^$()|{}[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("(^|/)" + re + "$", "i");
}

function pathMatchesAnyGlob(filePath, globs) {
  const normalized = filePath.replace(/\\/g, "/");
  return globs.some((g) => globToRegExp(g).test(normalized));
}

function relativize(absolutePath, projectRoot) {
  const norm = path.resolve(absolutePath);
  const root = path.resolve(projectRoot);
  if (norm.startsWith(root + path.sep) || norm === root) {
    return path.relative(root, norm).replace(/\\/g, "/");
  }
  return norm.replace(/\\/g, "/");
}

// Returns null (no seal), { corrupt: true }, or { state, epic, specs: [{ slug, red_sha, test_paths, legacy }] }.
function readSeal(projectRoot) {
  const abs = path.join(projectRoot, STATE_FILE);
  if (!fs.existsSync(abs)) return null;
  let state;
  try {
    state = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return { corrupt: true };
  }
  if (!state || typeof state !== "object") return { corrupt: true };
  const specs = [];
  if (Array.isArray(state.test_paths) && state.test_paths.length > 0) {
    specs.push({ slug: state.spec || null, red_sha: state.red_sha || null, test_paths: state.test_paths, legacy: true });
  }
  if (Array.isArray(state.specs)) {
    for (const spec of state.specs) {
      if (spec && typeof spec === "object" && Array.isArray(spec.test_paths)) {
        specs.push({ slug: spec.slug || null, red_sha: spec.red_sha || null, test_paths: spec.test_paths, legacy: false });
      }
    }
  }
  return { state, epic: state.epic || null, specs };
}

// First sealed spec whose test_paths match the (project-relative) path, or null.
function matchSealed(relativePath, seal) {
  if (!seal || !Array.isArray(seal.specs)) return null;
  return seal.specs.find((spec) => pathMatchesAnyGlob(relativePath, spec.test_paths)) || null;
}

// True when the ROADMAP exists and no epic is [/] — the seal outlived its epic.
function sealIsStale(projectRoot) {
  const roadmap = path.join(projectRoot, ROADMAP_FILE);
  if (!fs.existsSync(roadmap)) return false;
  try {
    return !/^\s*-\s*\[\/\]/m.test(fs.readFileSync(roadmap, "utf8"));
  } catch {
    return false;
  }
}

module.exports = { STATE_FILE, ROADMAP_FILE, globToRegExp, pathMatchesAnyGlob, relativize, readSeal, matchSealed, sealIsStale };
