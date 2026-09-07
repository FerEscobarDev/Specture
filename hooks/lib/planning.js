// Parser for the Spec Planning Gate artefacts — pure functions, no I/O.
//
//   - `_planning.md`  → COVERAGE_TABLE rows (op / br / sym / oos / gap / sup) + hash
//   - ROADMAP epic block → id, state, Template:, operations, RN ids, GAP ids
//   - `*.spec.md`     → declared operations, RN citations, Superficie lines, AC/BR/EC count
//
// Used by hooks/lib/spec-set-check.js (roadmap item 29) and hooks/lib/metrics-report.js.
// The grammar is the one printed in templates/PLANNING_TEMPLATE.md and in
// agents/spec-planner/AGENT.md "Output Format". Both the `## COVERAGE_TABLE` heading form
// (v1.18.0+) and the bare `COVERAGE_TABLE:` label form written by the v1.17.0 planner parse.

const crypto = require("crypto");
const { lines, epicIdFrom, extractSection, parseRoadmap } = require("./doctor/project");

const ROW_KINDS = ["op", "br", "sym", "oos", "gap", "sup"];
const ROW = /^\s*-\s*(op|br|sym|oos|gap|sup)\s*:\s*(.*)$/;
const ARROW = "(?:→|->)";
const DASH = "\\s+(?:—|–|--|-)\\s+"; // field separator: em dash, en dash, `--` or ` - `
const RN_ID = /\bRN-(?:[A-Z]+-)?\d+\b/g;
const GAP_ID = /\bGAP-(?:[A-Z]+-)?\d+\b/g;
const SECTION_LABELS = /^(COVERAGE_TABLE|OPEN_QUESTIONS|RESOLVED_ALONE|SUPERSESIONES|CODE_SURFACE|MECH_CHECK|VEREDICTOS|SPEC_SHA|CHANGELOG|CONCERNS)\s*:/;

function unquote(value) {
  return String(value || "").replace(/`/g, "").trim();
}

function collapse(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

// Signatures compare as strings after dropping backticks and collapsing whitespace.
function normalizeSignature(value) {
  return collapse(unquote(value).replace(/\(planeada\s*[—–-]+\s*re-anclar\)/i, ""));
}

// ---------------------------------------------------------------------------
// COVERAGE_TABLE
// ---------------------------------------------------------------------------

// Lines of the COVERAGE_TABLE block: from `## COVERAGE_TABLE` (or `COVERAGE_TABLE:`) to the
// next `## ` heading or the next `LABEL:` line. Returns null when the block is absent.
function coverageBlockLines(text) {
  const all = lines(text);
  const start = all.findIndex((l) => /^##\s+COVERAGE_TABLE\b/.test(l) || /^\s*COVERAGE_TABLE\s*:/.test(l));
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < all.length; i++) {
    const line = all[i];
    if (/^##\s/.test(line)) break;
    if (SECTION_LABELS.test(line.trim())) break;
    out.push(line);
  }
  return out;
}

function parseRow(kind, rest) {
  const value = rest.trim();
  let m;
  switch (kind) {
    case "op":
      m = value.match(new RegExp(`^\`?([A-Za-z0-9_.-]+)\`?\\s*${ARROW}\\s*\`?([A-Za-z0-9_.-]+)\`?\\s*\\((implementa|consume)\\)\\s*$`));
      return m ? { operationId: m[1], slug: m[2], mode: m[3] } : null;
    case "br":
      m = value.match(new RegExp(`^\`?([^\`]+?)\`?\\s*${ARROW}\\s*\`?([A-Za-z0-9_.-]+)\`?\\s*(?:\\[\\s*(BR-\\d+)\\s*\\])?\\s*$`));
      if (!m) return null;
      return { rule: collapse(m[1]), slug: m[2], br: m[3] || null };
    case "sym":
      m = value.match(new RegExp(`^(.+?)${DASH}crea\\s*:\\s*\`?([A-Za-z0-9_.-]+)\`?${DASH}firma\\s*:\\s*(.+?)${DASH}consume\\s*:\\s*\\[([^\\]]*)\\]\\s*$`));
      if (!m) return null;
      return {
        symbol: unquote(m[1]),
        crea: m[2],
        firma: normalizeSignature(m[3]),
        consume: m[4].split(",").map((s) => unquote(s)).filter(Boolean)
      };
    case "oos":
      m = value.match(new RegExp(`^(.+?)\\s*${ARROW}\\s*(?:cubierto por\\s*:\\s*\`?([A-Za-z0-9_.-]+)\`?|diferido a\\s*:\\s*(.+?))\\s*$`));
      if (!m) return null;
      return { item: collapse(m[1]), coveredBy: m[2] || null, deferredTo: m[3] ? collapse(m[3]) : null };
    case "gap":
      m = value.match(new RegExp(`^\`?(GAP-(?:[A-Z]+-)?\\d+)\`?\\s*${ARROW}\\s*\`?([A-Za-z0-9_.-]+)\`?\\s*$`));
      return m ? { gap: m[1], slug: m[2] } : null;
    case "sup":
      m = value.match(new RegExp(`^\`?([^\`\\s:]+)::([^\`]+?)\`?\\s*${ARROW}\\s*\`?([A-Za-z0-9_.-]+)\`?\\s*(?:\\(\\s*(BR-\\d+)\\s*\\))?\\s*$`));
      return m ? { path: m[1], test: collapse(m[2]), slug: m[3], br: m[4] || null } : null;
    default:
      return null;
  }
}

// { found, rows: {op[], br[], sym[], oos[], gap[], sup[]}, errors: [{line, text}], rowLines }
function parseCoverageTable(text) {
  const block = coverageBlockLines(text);
  const rows = Object.fromEntries(ROW_KINDS.map((k) => [k, []]));
  const result = { found: block !== null, rows, errors: [], rowLines: [] };
  if (block === null) return result;
  for (const raw of block) {
    const m = raw.match(ROW);
    if (!m) continue;
    const parsed = parseRow(m[1], m[2]);
    result.rowLines.push(collapse(raw));
    if (parsed) rows[m[1]].push({ ...parsed, raw: collapse(raw) });
    else result.errors.push({ line: collapse(raw), kind: m[1] });
  }
  return result;
}

// sha256 over the normalized row block, 12 hex chars. Only the `- kind:` rows count, so
// answering questions or appending verdicts never invalidates a MECH_CHECK token.
function coverageHash(text) {
  const { rowLines } = parseCoverageTable(text);
  return crypto.createHash("sha256").update(rowLines.join("\n")).digest("hex").slice(0, 12);
}

// The last `MECH_CHECK: <STATUS> <sha|reason>` line of a _planning.md, or null.
function lastMechCheck(text) {
  let last = null;
  for (const line of lines(text)) {
    const m = line.match(/MECH_CHECK\s*:\s*(PASS|FAIL|UNVERIFIABLE|MANUAL|HASH)\b\s*(\S*)/);
    if (m) last = { status: m[1], value: m[2] || null, line: collapse(line) };
  }
  return last;
}

// ---------------------------------------------------------------------------
// ROADMAP epic block
// ---------------------------------------------------------------------------

function idList(value, regex) {
  return [...new Set((String(value || "").match(regex) || []))];
}

// Parses the `**Operaciones del contrato:**` value: backticked ids with an optional
// `(consume)` / `(implementa)` suffix each; bare comma-separated ids as a fallback; a
// trailing global `(consume)` marks every bare id as consumed. "Omitir"/"Ninguna"/"N/A" → [].
function parseOperations(value) {
  const text = String(value || "").trim();
  if (!text || /^(omitir|ninguna|n\/a|—|-)/i.test(text)) return [];
  const ops = [];
  const backticked = [...text.matchAll(/`([A-Za-z][A-Za-z0-9_.-]*)`\s*(?:\((consume|implementa)\))?/g)];
  if (backticked.length > 0) {
    const globalConsume = /\)\s*$/.test(text) && /\(consume\)\s*$/i.test(text) && backticked.every((m) => !m[2]);
    for (const m of backticked) ops.push({ id: m[1], mode: m[2] || (globalConsume ? "consume" : "implementa") });
    return ops;
  }
  const globalConsume = /\(consume\)/i.test(text);
  for (const token of text.replace(/\((consume|implementa)\)/gi, "").split(/[,\s]+/)) {
    if (/^[A-Za-z][A-Za-z0-9_.]*$/.test(token)) ops.push({ id: token, mode: globalConsume ? "consume" : "implementa" });
  }
  return ops;
}

function fieldValue(blockLines, label) {
  const re = new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*:?\\s*(.*)$`, "i");
  for (const line of blockLines) {
    const m = line.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

// { id, state, template, operations: [{id, mode}], rules: [RN…], gaps: [GAP…], text }
function parseEpicBlock(text) {
  const all = lines(text);
  const head = all.find((l) => /\bEpic\b/i.test(l)) || "";
  const stateMatch = head.match(/\[( |\/|x)\]/);
  const opsValue = fieldValue(all, "Operaciones del contrato");
  const gapsValue = fieldValue(all, "Breaking changes in scope") || fieldValue(all, "Gaps");
  return {
    id: epicIdFrom(head),
    state: !stateMatch ? null : stateMatch[1] === "x" ? "done" : stateMatch[1] === "/" ? "in-progress" : "pending",
    template: (fieldValue(all, "Template") || "").replace(/`/g, "").trim() || null,
    operations: parseOperations(opsValue),
    hasOperationsLine: opsValue !== null,
    rules: idList(fieldValue(all, "Reglas de negocio clave"), RN_ID),
    hasRulesLine: fieldValue(all, "Reglas de negocio clave") !== null,
    gaps: idList(gapsValue, GAP_ID),
    hasGapsLine: gapsValue !== null,
    text
  };
}

// Every epic of a ROADMAP with its block text and parsed fields.
function parseRoadmapEpics(roadmapText) {
  const all = lines(roadmapText);
  const { epics } = parseRoadmap(roadmapText);
  return epics.map((epic, index) => {
    const start = epic.lineNo - 1;
    const stop = index + 1 < epics.length ? epics[index + 1].lineNo - 1 : all.length;
    const block = [all[start]];
    for (let i = start + 1; i < stop; i++) {
      const line = all[i];
      if (/^#/.test(line) || /^---/.test(line)) break;
      if (line.trim() !== "" && !/^\s/.test(line)) break;
      block.push(line);
    }
    return { ...parseEpicBlock(block.join("\n")), id: epic.id, state: epic.state, milestone: epic.milestone };
  });
}

// The epic block for `epicId` ("1.1", "Epic 1.1", "epic-1.1-archivos" → "1.1"), or null.
function findEpicBlock(roadmapText, epicId) {
  const wanted = String(epicId || "").replace(/^epic[-\s]*/i, "").split(/[-\s]/)[0].trim();
  return parseRoadmapEpics(roadmapText).find((e) => e.id === wanted || e.id === String(epicId)) || null;
}

// ---------------------------------------------------------------------------
// Spec files
// ---------------------------------------------------------------------------

const SURFACE_LINE = /^\s*-\s*(Llama a|Crea \(spec hermano anterior\)|Crea|Modifica|Fixtures disponibles)\s*:\s*(.*)$/i;

function parseSurfaceLine(kind, rest) {
  const symbol = (rest.match(/`([^`]+)`/) || [null, rest.split(/\s+(?:en|—|–|-)\s+/)[0]])[1];
  const pathMatch = rest.match(/\ben\s+`?([^`\s]+)`?/);
  const firmaMatch = rest.match(/firma\s*:\s*(.+?)(?:\s*`?\(planeada|$)/i);
  return {
    kind: kind.toLowerCase().startsWith("crea (") ? "crea-hermano" : kind.toLowerCase().replace(/\s.*$/, ""),
    symbol: unquote(symbol),
    path: pathMatch ? pathMatch[1] : null,
    firma: firmaMatch ? normalizeSignature(firmaMatch[1]) : null,
    planned: /\(planeada\s*[—–-]+\s*re-anclar\)/i.test(rest),
    raw: collapse(rest)
  };
}

// { slug, operations: [{id, mode}], hasOperationsSection, rules, surface: [...], plannedSymbols,
//   createdPaths, modifiedPaths, idCount, gaps, supersedes: [{path, test, br}], outOfScope: [] }
function parseSpec(text, slug) {
  const opsSection = extractSection(text, /^##\s+Operaciones del Contrato/i) || "";
  const operations = [];
  for (const line of lines(opsSection)) {
    const m = line.match(/\*\*(Implementa|Consume)\*\*[^[]*\[([^\]]*)\]/i);
    if (!m) continue;
    for (const id of m[2].split(",").map((s) => unquote(s)).filter(Boolean)) {
      operations.push({ id, mode: m[1].toLowerCase() === "consume" ? "consume" : "implementa" });
    }
  }
  const surfaceSection = extractSection(text, /^##\s+Superficie de C/i) || "";
  const surface = [];
  for (const line of lines(surfaceSection)) {
    const m = line.match(SURFACE_LINE);
    if (m) surface.push(parseSurfaceLine(m[1], m[2]));
  }
  const supersedeSection = extractSection(text, /^##\s+(?:\d+\.\s*)?Supersesiones/i) || "";
  const supersedes = [];
  for (const line of lines(supersedeSection)) {
    const m = line.match(/^\s*-\s*Supersede\s*:\s*`?([^`\s:]+)::([^`]+?)`?\s+(?:—|–|--|-)\s+motivo\s*:\s*(BR-\d+)/i);
    if (m) supersedes.push({ path: m[1], test: collapse(m[2]), br: m[3] });
  }
  const oosSection = extractSection(text, /^##\s+(?:\d+\.\s*)?Fuera de Scope/i) || "";
  const outOfScope = lines(oosSection).filter((l) => /^\s*-\s+\S/.test(l)).map((l) => collapse(l.replace(/^\s*-\s*/, "")));
  const gapsLine = (text.match(/\*\*Gaps cubiertos[^*]*\*\*\s*:?\s*(.*)$/im) || [null, ""])[1];
  return {
    slug,
    operations,
    hasOperationsSection: opsSection.trim().length > 0,
    rules: idList(text, RN_ID),
    surface,
    plannedSymbols: surface.filter((s) => s.planned),
    createdPaths: surface.filter((s) => s.kind === "crea" && s.path).map((s) => s.path),
    modifiedPaths: surface.filter((s) => s.kind === "modifica" && s.path).map((s) => s.path),
    surfaceWithoutPath: surface.filter((s) => (s.kind === "crea" || s.kind === "modifica") && !s.path),
    idCount: (text.match(/^\s*-\s*\*\*(AC|BR|EC)-\d+/gm) || []).length,
    gaps: idList(gapsLine, GAP_ID),
    supersedes,
    outOfScope
  };
}

module.exports = {
  ROW_KINDS,
  RN_ID,
  GAP_ID,
  normalizeSignature,
  parseCoverageTable,
  coverageHash,
  lastMechCheck,
  parseOperations,
  parseEpicBlock,
  parseRoadmapEpics,
  findEpicBlock,
  parseSpec
};
