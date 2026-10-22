// Tests check — does any test of the project depend on documentation?
// Every finding: { severity, group: "tests", check, file, detail, action }.
//
//   doc-reading-test  WARNING  a test file names a documentation path (`docs/`, `.specture/`,
//                              a `*.md`, the docs-index `source_of_truth_dir`); documentation is
//                              not behaviour, and the next pruning of the corpus breaks the test
//                     ERROR    …and at least one of those paths no longer exists: the test is
//                              already failing with ENOENT (Psikora, 2026-09-22 → 10-19)
//   build-reads-docs  WARNING  a build manifest of the project (package.json scripts, a .csproj,
//                              a Makefile, pyproject.toml, build.gradle…) names `docs/` or
//                              `.specture/`: the project would stop building with Specture's
//                              folders gone — e.g. a typed client regenerated from the contract
//                              at build time instead of being committed
//
// Read-only. The doctor never edits tests: the user deletes or rewrites them (a documentation
// duty is a `DOC-n` the code-reviewer verifies, never a test). Mechanical twin of
// `red-check.js files`, which denies the same thing before a RED is sealed.

const fs = require("fs");
const path = require("path");
const { scanDocumentationReads, sourceOfTruthDir, missingOnDisk } = require("../../doc-paths");

const IGNORED_DIRS = new Set(["node_modules", ".git", ".claude", "bin", "obj", "dist", "build", ".next", "coverage", "vendor", "target", ".venv", "venv", "__pycache__", "docs", ".specture"]);
const CODE_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|py|cs|java|kt|kts|go|rb|rs|php|swift|scala|dart|fs|vb)$/i;
// A test by name (`x.test.ts`, `x.spec.js`, `FooTests.cs`, `test_foo.py`, `foo_test.go`) or by
// folder (`tests/`, `test/`, `__tests__/`, `spec/`).
const TEST_NAME = /(?:[._-](?:test|tests|spec|specs)\.[^.]+$|Tests?\.(?:cs|java|kt|kts|scala|fs|vb)$|(?:^|\/)test_[^/]+\.py$|_test\.(?:go|py|rb|rs|js|ts)$)/i;
const TEST_DIR = /(?:^|\/)(?:tests?|__tests__|specs?)\//i;
const MAX_LINES_SHOWN = 3;
// Build manifests whose commands run at build or CI time.
const BUILD_MANIFEST = /(?:^|\/)(?:package\.json|Makefile|pyproject\.toml|build\.gradle(?:\.kts)?|pom\.xml|Cargo\.toml|CMakeLists\.txt|Directory\.Build\.(?:props|targets)|[^/]+\.(?:csproj|fsproj|vbproj|sln|props|targets))$/i;
const SPECTURE_PATH = /(?:^|[^A-Za-z0-9_])(?:docs[\\/]|\.specture[\\/])/;

function finding(severity, check, file, detail, action) {
  return { severity, group: "tests", check, file, detail, action };
}

// { tests: [rel], manifests: [rel] } — every test file and every build manifest of the project,
// outside the ignored directories and outside Specture's own folders.
function walkProject(root) {
  const tests = [];
  const manifests = [];
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(relPath);
      } else if (entry.isFile()) {
        if (CODE_EXT.test(entry.name) && (TEST_NAME.test(relPath) || TEST_DIR.test(relPath))) tests.push(relPath);
        else if (BUILD_MANIFEST.test(relPath)) manifests.push(relPath);
      }
    }
  }
  return { tests: tests.sort(), manifests: manifests.sort() };
}

function walkCode(root) {
  return walkProject(root).tests;
}

// Lines of a build manifest that name a Specture folder. For package.json only the `scripts`
// block counts (a `files` or `description` field is not a build step).
function manifestReads(rel, text) {
  let haystack = text;
  if (/package\.json$/i.test(rel)) {
    try {
      const scripts = JSON.parse(text).scripts || {};
      haystack = Object.entries(scripts).map(([k, v]) => `${k}: ${v}`).join("\n");
    } catch {
      return [];
    }
  }
  const out = [];
  haystack.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(#|\/\/|<!--)/.test(line)) return;
    const m = line.match(SPECTURE_PATH);
    if (m) out.push({ line: index + 1, text: line.trim().slice(0, 120) });
  });
  return out;
}

function run(project) {
  const root = project.root;
  const extraDirs = [sourceOfTruthDir(root)].filter(Boolean);
  const out = [];
  const { tests: testFiles, manifests } = walkProject(root);
  for (const rel of manifests) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    const reads = manifestReads(rel, text);
    if (reads.length === 0) continue;
    out.push(finding(
      "WARNING",
      "build-reads-docs",
      rel,
      `a build step names a Specture folder (${reads.slice(0, MAX_LINES_SHOWN).map((r) => `:${r.line} \`${r.text}\``).join(", ")}) — the project would stop building with \`docs/\` and \`.specture/\` gone`,
      "commit the generated output (e.g. the typed API client) and run the generator inside the epic, never at build or CI time; Specture's folders are its working files, not a dependency of the project"
    ));
  }
  for (const rel of testFiles) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    const reads = scanDocumentationReads(text, { extraDirs });
    if (reads.length === 0) continue;
    const missing = missingOnDisk(root, reads);
    const shown = reads.slice(0, MAX_LINES_SHOWN).map((r) => `:${r.line} \`${r.match}\``).join(", ");
    const more = reads.length > MAX_LINES_SHOWN ? ` (+${reads.length - MAX_LINES_SHOWN})` : "";
    const detail = missing.length > 0
      ? `the test reads documentation and ${missing.length} path(s) no longer exist — it fails with ENOENT today: ${missing.slice(0, MAX_LINES_SHOWN).map((r) => `\`${r.path}\``).join(", ")}`
      : `the test reads documentation (${shown}${more}) — a document is not behaviour of the system, and the next pruning of the corpus breaks this test`;
    out.push(finding(
      missing.length > 0 ? "ERROR" : "WARNING",
      "doc-reading-test",
      rel,
      detail,
      "delete the test or rewrite it against the code's behaviour; a documentation duty is a `DOC-n` of the spec that the code-reviewer verifies — no test ever reads `docs/`, `.specture/` or a `*.md`"
    ));
  }
  return out;
}

module.exports = { run, walkCode, walkProject, manifestReads, TEST_NAME, TEST_DIR, BUILD_MANIFEST };
