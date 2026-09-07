// Corpus lint — mechanical checks over the project's documentation.
// Every finding: { severity, group: "corpus", check, file, detail, action }.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { lines } = require("../project");

const CITED_PATH = /(?:docs\/\d{2}-[a-z-]+\/[A-Za-z0-9_.()/-]+\.(?:md|ya?ml|json)|\.specture\/decisions\/\d{3}-[A-Za-z0-9-]+\.md)/g;
const PLACEHOLDER_PATH = /docs\/[A-Za-z0-9_./-]*\.\.\.[A-Za-z0-9_./-]*/g;
const LINE_CITATION = /\b[\w./-]+\.md:\d+\b/g;
const SPEC_IDS = /\b(?:AC|BR|EC)-\d+\b/;
const REVIEW_STATUS = /STATUS:\s*\**\s*(APPROVED|REJECTED_MINOR|REJECTED_MAJOR|BLOCKED)/;
const ADR_STATUS = /^(?:##\s+Status\b|\*\*Status:?\*\*|-\s*\*\*Status)/m;
const SPEC_LINE_CEILING = 300;

function finding(severity, check, file, detail, action) {
  return { severity, group: "corpus", check, file, detail, action };
}

function brokenPaths(project) {
  const missing = new Map(); // cited path → Set(citing files)
  const placeholders = new Map();
  for (const rel of project.living) {
    const text = project.read(rel);
    if (text === null) continue;
    for (const match of text.matchAll(CITED_PATH)) {
      const cited = match[0].replace(/[).,:;]+$/, "");
      if (cited.includes("...")) continue;
      if (cited.startsWith("docs/07-reviews/review-") && cited.includes("...")) continue;
      if (!project.exists(cited)) {
        if (!missing.has(cited)) missing.set(cited, new Set());
        missing.get(cited).add(rel);
      }
    }
    for (const match of text.matchAll(PLACEHOLDER_PATH)) {
      if (!placeholders.has(match[0])) placeholders.set(match[0], new Set());
      placeholders.get(match[0]).add(rel);
    }
  }
  const out = [];
  for (const [cited, citers] of missing) {
    out.push(
      finding("ERROR", "broken-path", [...citers][0], `cited path does not exist: ${cited} (cited by ${citers.size} file${citers.size === 1 ? "" : "s"})`, "fix the path or cite the artifact by its stable ID")
    );
  }
  for (const [placeholder, citers] of placeholders) {
    out.push(finding("ERROR", "placeholder-path", [...citers][0], `unfilled path placeholder: ${placeholder}`, "replace `...` with the real file name"));
  }
  return out;
}

function adrs(project) {
  const out = [];
  const byNumber = new Map();
  for (const rel of project.files) {
    if (!rel.startsWith(".specture/decisions/") || !rel.endsWith(".md")) continue;
    const name = path.posix.basename(rel);
    if (name === "000-template.md") continue;
    const number = name.match(/^(\d{3})-/);
    if (!number) continue;
    if (!byNumber.has(number[1])) byNumber.set(number[1], []);
    byNumber.get(number[1]).push(rel);
    const text = project.read(rel) || "";
    if (!ADR_STATUS.test(text)) {
      out.push(finding("WARNING", "adr-status", rel, "ADR has no parseable Status (`## Status` or `**Status:**`)", "add a Status line so the validator can tell Accepted from Superseded"));
    }
  }
  for (const [number, files] of byNumber) {
    if (files.length > 1) {
      out.push(finding("ERROR", "adr-duplicate", files[0], `ADR number ${number} is used by ${files.length} files: ${files.join(", ")}`, "renumber one of them; citations to ADR-" + number + " are ambiguous"));
    }
  }
  return out;
}

function reviews(project) {
  const out = [];
  for (const rel of project.files) {
    if (!rel.startsWith("docs/07-reviews/") || !rel.endsWith(".md")) continue;
    const text = project.read(rel) || "";
    if (!REVIEW_STATUS.test(text)) {
      out.push(finding("WARNING", "review-status", rel, "review has no parseable `STATUS:` verdict", "add the STATUS block (APPROVED | REJECTED_MINOR | REJECTED_MAJOR | BLOCKED)"));
    }
  }
  return out;
}

// Canonical H2 sections come from the plugin's own spec templates, parsed at load
// (so a template edit — e.g. a new section — is canonical without touching this file).
// A missing template contributes nothing; both missing → the check disables itself.
const TEMPLATE_NAMES = ["SPEC_TEMPLATE.md", "MIGRATION_SPEC_TEMPLATE.md"];

function headingBase(line) {
  return line
    .replace(/^#{2}\s*/, "")
    .split("(")[0]
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/^[\d\s.]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalSectionBases() {
  const bases = new Set();
  for (const name of TEMPLATE_NAMES) {
    try {
      const text = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "templates", name), "utf8");
      for (const line of lines(text)) {
        if (/^##\s/.test(line)) bases.add(headingBase(line));
      }
    } catch {
      // template not readable → contributes nothing
    }
  }
  return bases;
}

const CANONICAL_SECTIONS = canonicalSectionBases();

function sectionDestination(heading) {
  if (/decisi[oó]n/i.test(heading)) return "user decision: record it in the epic's _planning.md (the coordinator appends it during spec planning)";
  if (/deuda/i.test(heading)) return "move the debt to the ROADMAP as a pending epic/task";
  if (/divergencia|handoff/i.test(heading)) return "move it to docs/03-ux-ui/handoff-mapping.md";
  if (/supersesi[oó]n/i.test(heading)) return "declare it with `Supersede:` lines under the template section \"Supersesiones de tests sellados\" (the register lives in the epic's _planning.md § SUPERSESIONES) — not in a free-form section";
  return "move it to its owning document or delete it (the template's sections are the spec's contract)";
}

// Like spec-size, this scans every spec (project.living excludes epic specs by design):
// off-template sections in historical specs are noise the user can ignore, but new specs
// get flagged the moment they grow a rogue section.
function specSections(project) {
  const out = [];
  if (CANONICAL_SECTIONS.size === 0) return out;
  for (const rel of project.files) {
    if (!rel.startsWith("docs/05-specs/") || !rel.endsWith(".spec.md")) continue;
    const text = project.read(rel) || "";
    for (const line of lines(text)) {
      if (!/^##\s/.test(line)) continue;
      const base = headingBase(line);
      if (!base) continue;
      const canonical = [...CANONICAL_SECTIONS].some((c) => base === c || base.startsWith(c + " "));
      if (!canonical) {
        out.push(finding("WARNING", "spec-section", rel, `off-template section: ${line.trim()}`, sectionDestination(line)));
      }
    }
  }
  return out;
}

function specs(project) {
  const out = [];
  for (const rel of project.files) {
    if (!rel.startsWith("docs/05-specs/") || !rel.endsWith(".spec.md")) continue;
    const text = project.read(rel) || "";
    if (!SPEC_IDS.test(text)) {
      out.push(finding("WARNING", "spec-ids", rel, "spec declares no AC-n / BR-n / EC-n IDs", "give every acceptance criterion, business rule and edge case a stable ID"));
    }
    const count = lines(text).length;
    if (count > SPEC_LINE_CEILING) {
      out.push(finding("WARNING", "spec-size", rel, `spec has ${count} lines (ceiling ${SPEC_LINE_CEILING})`, "split it, or move decisions/debt/supersession narrative out of the spec"));
    }
  }
  return out;
}

// Files changed since the last tag (working tree included); null when git is unavailable.
function changedSinceLastTag(root) {
  try {
    const tag = execFileSync("git", ["describe", "--tags", "--abbrev=0"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const diff = execFileSync("git", ["diff", "--name-only", tag], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return new Set([...lines(diff), ...lines(untracked)].map((l) => l.trim()).filter(Boolean));
  } catch {
    return null;
  }
}

function lineCitations(project) {
  const changed = changedSinceLastTag(project.root);
  const scope = changed ? project.living.filter((rel) => changed.has(rel)) : project.living;
  const out = [];
  for (const rel of scope) {
    const text = project.read(rel) || "";
    const hits = text.match(LINE_CITATION);
    if (hits && hits.length > 0) {
      out.push(finding("WARNING", "line-citation", rel, `${hits.length} line-number citation(s) into living documents (e.g. ${hits[0]})`, "cite stable IDs or headings; file:line only for code pinned to a SHA (anchor policy, v1.14.1)"));
    }
  }
  return out;
}

function run(project) {
  return [...brokenPaths(project), ...adrs(project), ...reviews(project), ...specs(project), ...specSections(project), ...lineCitations(project)];
}

module.exports = { run, SPEC_LINE_CEILING, CITED_PATH, LINE_CITATION, REVIEW_STATUS, ADR_STATUS };
