// Documentation paths inside test code — the one rule of the "Specture independiente" release
// that is enforced in two places with the same scanner:
//
//   red-check.js files          FAIL before the seal when a file of the RED commit names one
//   doctor check doc-reading-test  WARNING / ERROR on the tests a project already has
//
// A test never reads documentation: not Specture's (`docs/**`, `.specture/**`, a spec, an ADR,
// the contract companion) and not the project's own (`*.md` anywhere, the folder
// `.specture/docs-index.yml` declares as `source_of_truth_dir`). Documentation is not behaviour
// of the system — it can be rewritten, moved or pruned without the software changing — so a
// test bound to it turns every pruning into a red CI (Psikora, 2026-09/10: 41 test files read
// `.md` files that a cleanup removed; the deploy was blocked for a month).
//
// `scanDocumentationReads(text, { extraDirs })` → [{ line, match, path }] — one entry per line
// that names a documentation path. Comment-only lines are skipped (a comment that cites a doc
// is not a dependency); everything else counts, string literals included.

const fs = require("fs");
const path = require("path");

const COMMENT_LINE = /^\s*(\/\/|#|\*|\/\*|--|<!--|''')/;
const DOC_PATH_TOKEN = /[A-Za-z0-9_./\\-]*(?:docs[\\/]|\.specture[\\/])[A-Za-z0-9_./\\-]*|[A-Za-z0-9_./\\-]+\.mdx?\b/g;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The folder a project's docs-index.yml declares as its documentation root ("SGD.Docs/",
// "wiki/", …). null when the file or the key is absent, or when it is Specture's own `docs/`.
function sourceOfTruthDir(projectRoot) {
  try {
    const text = fs.readFileSync(path.join(projectRoot, ".specture", "docs-index.yml"), "utf8");
    const m = text.match(/^\s*source_of_truth_dir\s*:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m);
    if (!m) return null;
    const dir = m[1].trim().replace(/\\/g, "/").replace(/\/+$/, "");
    return dir && dir !== "docs" ? dir : null;
  } catch {
    return null;
  }
}

function scanDocumentationReads(text, { extraDirs = [] } = {}) {
  const extra = extraDirs.filter(Boolean).map((d) => new RegExp(`[A-Za-z0-9_./\\\\-]*(?:^|[^A-Za-z0-9_])${escapeRegExp(d.replace(/\/+$/, ""))}[\\\\/][A-Za-z0-9_./\\\\-]*`, "g"));
  const out = [];
  String(text).split(/\r?\n/).forEach((line, index) => {
    if (COMMENT_LINE.test(line)) return;
    const seen = new Set();
    const push = (raw) => {
      // a token that is only ".md" glued to nothing, or a URL, is not a path
      const token = raw.replace(/^[^A-Za-z0-9_.]+/, "").replace(/\\/g, "/");
      if (!token || /^https?:/.test(raw) || seen.has(token)) return;
      seen.add(token);
      out.push({ line: index + 1, match: token, path: token.replace(/^\.\//, "") });
    };
    for (const m of line.matchAll(DOC_PATH_TOKEN)) {
      // `docs/` must start a path segment: "mydocs/x" or "src/thedocs/" are not documentation
      const t = m[0];
      if (/(?:^|[\\/])docs[\\/]/.test(t) || /\.specture[\\/]/.test(t) || /\.mdx?$/.test(t.replace(/[\\/]+$/, ""))) push(t);
    }
    for (const re of extra) for (const m of line.matchAll(re)) push(m[0]);
  });
  return out;
}

// Which of the scanned paths point at nothing on disk (relative to the project root). A path
// that no longer exists is the ENOENT that turned Psikora's CI red.
function missingOnDisk(projectRoot, reads) {
  return reads.filter((r) => /^[A-Za-z0-9_.-]/.test(r.path) && !fs.existsSync(path.join(projectRoot, r.path)));
}

module.exports = { scanDocumentationReads, sourceOfTruthDir, missingOnDisk, DOC_PATH_TOKEN };
