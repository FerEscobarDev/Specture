// Shared helpers for migrations. Everything works through the migration `ctx`
// (hooks/lib/doctor/project.js createContext) so dry runs never touch disk.

const fs = require("fs");
const path = require("path");
const { lines, extractSection } = require("../hooks/lib/doctor/project");

const TEMPLATES = path.resolve(__dirname, "..", "templates");

function gitignoreLines(ctx) {
  return lines(ctx.read(".gitignore") || "").map((l) => l.trim());
}

// Exact line match (after trim) — for entries where the trailing slash / glob matters.
function hasGitignoreLine(ctx, exact) {
  return gitignoreLines(ctx).includes(exact);
}

function hasGitignoreEntry(ctx, entry) {
  const wanted = entry.replace(/\/$/, "");
  return gitignoreLines(ctx).some((l) => l.replace(/\/$/, "") === wanted);
}

function ensureGitignoreEntry(ctx, entry, comment) {
  if (hasGitignoreEntry(ctx, entry)) return false;
  const current = ctx.read(".gitignore");
  const eol = current && current.includes("\r\n") ? "\r\n" : "\n";
  const prefix = current ? (current.endsWith("\n") ? current : current + eol) : "";
  const block = (comment ? `# ${comment}${eol}` : "") + entry + eol;
  ctx.write(".gitignore", prefix + block);
  return true;
}

function templateText(relative) {
  return fs.readFileSync(path.join(TEMPLATES, relative), "utf8");
}

// extractSection lives in hooks/lib/doctor/project.js (shared with hooks/lib/planning.js)
// and is re-exported below for the migrations.

function eolOf(text) {
  return text && text.includes("\r\n") ? "\r\n" : "\n";
}

// Parses the Dependencias grammar: `Ninguna` | `Epic X.Y[, Epic Z.W]` | `Milestone N completo` (unions allowed).
const DEP_TOKEN = /^(?:Ninguna|Epic\s+[A-Za-z0-9._-]+|Milestone\s+[A-Za-z0-9._-]+\s+completo)$/i;

function dependenciesValid(value) {
  const cleaned = String(value).replace(/\(.*?\)/g, "").replace(/[`*]/g, "").trim().replace(/\.$/, "");
  if (!cleaned) return false;
  return cleaned.split(/\s*,\s*|\s+y\s+/).every((token) => DEP_TOKEN.test(token.trim()));
}

// operationIds from an OpenAPI document (JSON parsed properly; YAML by regex).
function operationIdsFrom(text, file) {
  const ids = [];
  if (/\.json$/i.test(file)) {
    try {
      const doc = JSON.parse(text);
      for (const [p, methods] of Object.entries(doc.paths || {})) {
        for (const [method, op] of Object.entries(methods || {})) {
          if (op && typeof op === "object" && op.operationId) {
            ids.push({ operationId: op.operationId, method: method.toUpperCase(), path: p, summary: op.summary || "" });
          }
        }
      }
      return ids;
    } catch {
      // fall through to regex
    }
  }
  for (const match of String(text).matchAll(/operationId["']?\s*:\s*["']?([A-Za-z0-9_.-]+)/g)) {
    ids.push({ operationId: match[1], method: "", path: "", summary: "" });
  }
  return ids;
}

// HU-… identifiers with the text of their line (business_requirements.md).
function userStoriesFrom(text) {
  const out = [];
  for (const line of lines(text)) {
    const match = line.match(/\b(HU-[A-Z0-9-]+)\b(.*)$/i);
    if (match) out.push({ id: match[1], text: match[2].replace(/^[\s:*—-]+/, "").trim().slice(0, 120) });
  }
  return out;
}


// Inserts rule items into a rules.yml text (LF in, LF out) after the LAST item of the
// `rules:` list, leaving every comment, every existing rule and the file's own shape
// byte-for-byte. `rules: []` — the empty placeholder that projects created before
// v1.20.0 still carry — becomes `rules:` so the appended items parse.
function insertRuleItems(text, itemLines) {
  if (itemLines.length === 0) return text;
  const all = text.split("\n");
  const start = all.findIndex((l) => /^rules\s*:/.test(l));
  if (start === -1) throw new Error("rules.yml no declara `rules:`");
  if (/^rules\s*:\s*\[\s*\]\s*$/.test(all[start])) all[start] = "rules:";
  let end = start;
  for (let i = start + 1; i < all.length; i++) {
    if (/^\s+\S/.test(all[i])) end = i;
    else if (all[i].trim() !== "") break;
  }
  all.splice(end + 1, 0, ...itemLines);
  return all.join("\n");
}

module.exports = {
  insertRuleItems,
  TEMPLATES,
  gitignoreLines,
  hasGitignoreEntry,
  hasGitignoreLine,
  ensureGitignoreEntry,
  templateText,
  extractSection,
  eolOf,
  dependenciesValid,
  operationIdsFrom,
  userStoriesFrom
};
