// The build seal — `.specture/state/build-locked.json` — shared by every PreToolUse gate hook,
// `lib/seal-cli.js` (the only sanctioned writer) and the doctor.
//
// Schema v3 (v1.18.0+): epic-level spec seal + allowed paths + one entry per spec
//   { "epic": "<slug>", "sealed_at": "<ISO-8601>",
//     "spec_sha": "<sha of the docs(specs) plan commit>",
//     "spec_paths": ["docs/05-specs/<epic>/*.spec.md"],      // validated specs — immutable during the epic
//     "test_globs": ["tests/**/*.test.ts"],                   // conventions-wide test globs (RED helpers stay writable)
//     "allowed_paths": ["src/x/service.ts", "src/x/"],        // optional — Crea:/Modifica: of the specs (item 36)
//     "supersede_paths": ["tests/old.test.ts"],               // optional, transient — declared supersessions (item 35)
//     "specs": [ { "slug": "<task-slug>", "red_sha": "<sha>", "test_paths": ["<file|glob>", …] } ] }
// Schema v2 (v1.15.0, still accepted): { "epic", "sealed_at", "specs": [ { slug, red_sha, test_paths } ] }
// Schema v1 (still accepted): { "epic", "red_sha", "test_paths": [...], "locked_at" }
//
// Three deny kinds, in precedence order: a sealed TEST path (TDD Honesty Gate), a sealed SPEC
// path (Spec Seal), a write OUTSIDE allowed_paths (Allowed Paths — only when the seal carries
// them, only for paths outside docs/ and .specture/). Everything else is allowed.
//
// A seal is STALE when the ROADMAP has no epic in `[/]`: the epic closed and the seal was
// never released. Hooks fail open on a stale seal (with a reason) so a leftover file cannot
// block unrelated work; `doctor check` reports it.

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(".specture", "state", "build-locked.json");
const ROADMAP_FILE = path.join("docs", "04-roadmap", "ROADMAP.md");
const FRAMEWORK_PREFIXES = ["docs/", ".specture/"]; // never governed by allowed_paths

function globToRegExp(glob) {
  // Minimal glob translator covering the patterns used in conventions.md
  // (e.g. `**/*.test.ts`, `tests/**/*.py`, `*.spec.js`) and plain file paths.
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

// `src/x/` (a directory entry) covers everything under it.
function dirToGlob(entry) {
  const e = String(entry).replace(/\\/g, "/");
  return e.endsWith("/") ? e + "**" : e;
}

function relativize(absolutePath, projectRoot) {
  const norm = path.resolve(absolutePath);
  const root = path.resolve(projectRoot);
  if (norm.startsWith(root + path.sep) || norm === root) {
    return path.relative(root, norm).replace(/\\/g, "/");
  }
  return norm.replace(/\\/g, "/");
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.length > 0) : [];
}

// Returns null (no seal), { corrupt: true }, or
// { state, epic, spec_sha, spec_paths, test_globs, allowed_paths, supersede_paths,
//   specs: [{ slug, red_sha, test_paths, legacy }] }.
function readSeal(projectRoot) {
  const abs = path.join(projectRoot, STATE_FILE);
  if (!fs.existsSync(abs)) return null;
  let state;
  try {
    state = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return { corrupt: true };
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) return { corrupt: true };
  const specs = [];
  if (Array.isArray(state.test_paths) && state.test_paths.length > 0) {
    specs.push({ slug: state.spec || null, red_sha: state.red_sha || null, test_paths: stringList(state.test_paths), legacy: true });
  }
  if (Array.isArray(state.specs)) {
    for (const spec of state.specs) {
      if (spec && typeof spec === "object" && Array.isArray(spec.test_paths)) {
        specs.push({ slug: spec.slug || null, red_sha: spec.red_sha || null, test_paths: stringList(spec.test_paths), legacy: false });
      }
    }
  }
  return {
    state,
    epic: state.epic || null,
    spec_sha: typeof state.spec_sha === "string" ? state.spec_sha : null,
    spec_paths: stringList(state.spec_paths),
    test_globs: stringList(state.test_globs),
    allowed_paths: stringList(state.allowed_paths),
    supersede_paths: stringList(state.supersede_paths),
    specs
  };
}

// True when the seal can deny anything at all.
function hasRules(seal) {
  if (!seal || seal.corrupt) return false;
  return seal.specs.length > 0 || seal.spec_paths.length > 0 || seal.allowed_paths.length > 0;
}

// First sealed spec whose test_paths match the (project-relative) path, or null. A path
// listed in `supersede_paths` (a declared, sanctioned supersession) is exempt from the test
// deny — and only from it.
function matchSealed(relativePath, seal) {
  if (!seal || !Array.isArray(seal.specs)) return null;
  if (seal.supersede_paths && seal.supersede_paths.length > 0 && pathMatchesAnyGlob(relativePath, seal.supersede_paths)) return null;
  return seal.specs.find((spec) => pathMatchesAnyGlob(relativePath, spec.test_paths)) || null;
}

function matchSealedSpecPath(relativePath, seal) {
  return Boolean(seal && seal.spec_paths && seal.spec_paths.length > 0 && pathMatchesAnyGlob(relativePath, seal.spec_paths));
}

// True when the seal declares allowed_paths and the path is production code outside them.
function outsideAllowedPaths(relativePath, seal) {
  if (!seal || !seal.allowed_paths || seal.allowed_paths.length === 0) return false;
  const rel = relativePath.replace(/\\/g, "/");
  if (FRAMEWORK_PREFIXES.some((p) => rel.startsWith(p))) return false;
  const allowed = [
    ...seal.allowed_paths.map(dirToGlob),
    ...seal.test_globs,
    ...seal.specs.flatMap((s) => s.test_paths),
    ...seal.spec_paths
  ];
  return !pathMatchesAnyGlob(rel, allowed);
}

// A path `relativize` could not make project-relative (it lives outside the project root):
// posix-absolute or drive-letter absolute. The seal never governs it.
function isOutsideProject(relativePath) {
  return /^(?:[A-Za-z]:)?\//.test(String(relativePath).replace(/\\/g, "/"));
}

// The deny kind for a path, in precedence order, or null when the edit is allowed:
//   { kind: "test", spec } | { kind: "spec" } | { kind: "allowed" }
function classify(relativePath, seal) {
  if (!hasRules(seal)) return null;
  if (isOutsideProject(relativePath)) return null;
  const spec = matchSealed(relativePath, seal);
  if (spec) return { kind: "test", spec };
  if (matchSealedSpecPath(relativePath, seal)) return { kind: "spec" };
  if (outsideAllowedPaths(relativePath, seal)) return { kind: "allowed" };
  return null;
}

// The human-readable deny reason for a classification (shared by every platform's hook).
function denyReason(kind, relativePath, seal, spec) {
  const epic = seal.epic || "current epic";
  if (kind === "test") {
    return (
      `TDD Honesty Gate: \`${relativePath}\` is part of the sealed test contract for epic "${epic}"` +
      `${spec && spec.slug ? ` (spec ${spec.slug})` : ""} (RED commit ${(spec && spec.red_sha) || "unknown"}). ` +
      `Tests cannot be modified between the RED commit and the epic's completion.`
    );
  }
  if (kind === "spec") {
    return (
      `Spec Seal: \`${relativePath}\` is a validated spec sealed at SPEC_SHA ${seal.spec_sha || "unknown"} for epic "${epic}". ` +
      `Specs are immutable during the epic — never edit or regenerate one. If it is unexecutable, report ` +
      `BLOCKED: spec <AC-n/BR-n/EC-n> so the coordinator runs the spec-correction loop.`
    );
  }
  return (
    `Allowed Paths: \`${relativePath}\` is not declared by any spec of epic "${epic}" (Superficie de Código Existente: Crea:/Modifica:). ` +
    `Zero code without spec — report BLOCKED: spec <ID> naming this file so the planner adds it (Modifica:) ` +
    `instead of writing outside the declared surface.`
  );
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

module.exports = {
  STATE_FILE,
  ROADMAP_FILE,
  FRAMEWORK_PREFIXES,
  globToRegExp,
  pathMatchesAnyGlob,
  dirToGlob,
  relativize,
  readSeal,
  hasRules,
  matchSealed,
  matchSealedSpecPath,
  outsideAllowedPaths,
  isOutsideProject,
  classify,
  denyReason,
  sealIsStale
};
