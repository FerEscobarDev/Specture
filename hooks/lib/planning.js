// Parser for the Spec Planning Gate artefacts — pure functions, no I/O.
//
//   - `_planning.md`  → COVERAGE_TABLE rows (op / br / sym / oos / gap / sup) + hash
//   - ROADMAP epic block → id, state, Template:, operations, RN ids, GAP ids, Aparcado:,
//     Diferidos heredados:, and its scope fingerprint (`scopeHash`, epic block + linked RN text)
//   - `*.spec.md`     → declared operations, RN citations, Superficie lines, AC/BR/EC count
//
// Used by hooks/lib/spec-set-check.js (roadmap item 29), hooks/lib/metrics-report.js and
// hooks/lib/review.js (the batch review stage, v2.3.0).
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
// A supersession motive: the BR of a feature spec, the AC of a migration spec or the GAP it
// closes (`GAP-nnn`, optionally with a domain prefix like RN ids).
const MOTIVE_SRC = "(?:BR|AC)-\\d+|GAP-(?:[A-Z]+-)?\\d+";
const SECTION_LABELS = /^(COVERAGE_TABLE|OPEN_QUESTIONS|RESOLVED_ALONE|SUPERSESIONES|CODE_SURFACE|MECH_CHECK|VEREDICTOS|SPEC_SHA|CHANGELOG|CONCERNS)\s*:/;

// Only a BR motive fills the legacy `br` field; AC/GAP motives leave it null.
function brOf(motivo) {
  return motivo && /^BR-/.test(motivo) ? motivo : null;
}

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
      // `[BR-n]` in feature specs; `[AC-n]` in migration specs (MIGRATION_SPEC_TEMPLATE has no BR section).
      m = value.match(new RegExp(`^\`?([^\`]+?)\`?\\s*${ARROW}\\s*\`?([A-Za-z0-9_.-]+)\`?\\s*(?:\\[\\s*((?:BR|AC)-\\d+(?:\\s*,\\s*(?:BR|AC)-\\d+)*)\\s*\\])?\\s*$`));
      if (!m) return null;
      return { rule: collapse(m[1]), slug: m[2], br: m[3] ? collapse(m[3]) : null };
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
      m = value.match(new RegExp(`^\`?([^\`\\s:]+)::([^\`]+?)\`?\\s*${ARROW}\\s*\`?([A-Za-z0-9_.-]+)\`?\\s*(?:\\(\\s*(${MOTIVE_SRC})\\s*\\))?\\s*$`));
      return m ? { path: m[1], test: collapse(m[2]), slug: m[3], motivo: m[4] || null, br: brOf(m[4]) } : null;
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

// The last `VISUAL_APPROVAL: <sha> — …` line of a design-system epic's `_planning.md`, or
// null. Written by the coordinator when the user approves the showcase (build/SKILL.md
// "Coordinator processes the report"); it is the only durable record of the visual gate.
function lastVisualApproval(text) {
  let last = null;
  for (const line of lines(text)) {
    const m = line.match(/VISUAL_APPROVAL\s*:\s*(\S+)/);
    if (m) last = { sha: m[1], line: collapse(line) };
  }
  return last;
}

// The last `- LOCK_SHA: <sha> — <ISO>` line of `_planning.md` (`## SPEC_SHA`, written by the
// coordinator at queue step 5.1), or null. The last one wins: an epic parked and locked again
// starts its work at the newer lock. Used to compute a milestone's per-epic windows.
function parseLockSha(text) {
  let last = null;
  for (const line of lines(text)) {
    const m = line.match(/^\s*-\s*LOCK_SHA\s*:\s*`?([0-9a-f]{7,40})`?/i);
    if (m) last = m[1].toLowerCase();
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

// Every value of a field that may repeat (`**Diferidos heredados:**` is one line per item).
// Whole-word label: `Aparcado` does not match an `**Aparcados …**` line.
function fieldValues(blockLines, label) {
  const re = new RegExp(`\\*\\*${label}\\b[^*]*\\*\\*\\s*:?\\s*(.*)$`, "i");
  return blockLines.map((line) => line.match(re)).filter(Boolean).map((m) => m[1].trim());
}

// `**Aparcado:** <ISO> — <clase> — <motivo> — tanda <id>` (templates/ROADMAP_TEMPLATE.md, v2.3.0).
// The motivo may itself hold dashes. A line without its tanda parses with `tanda: null` and
// one with fewer fields keeps what it has — the doctor (`parked-orphan`) reports the gap.
function parseParked(value) {
  if (value === null || value === undefined) return null;
  const text = unquote(value);
  const full = text.match(new RegExp(`^(.+?)${DASH}(.+?)${DASH}(.+?)${DASH}tanda\\s+(\\S+)\\s*$`, "i"));
  if (full) return { ts: full[1].trim(), clase: full[2].trim(), motivo: collapse(full[3]), tanda: full[4] };
  const noBatch = text.match(new RegExp(`^(.+?)${DASH}(.+?)${DASH}(.+?)\\s*$`));
  if (noBatch) return { ts: noBatch[1].trim(), clase: noBatch[2].trim(), motivo: collapse(noBatch[3]), tanda: null };
  return { ts: text || null, clase: null, motivo: null, tanda: null };
}

// Epic kinds (roadmap `- **Tipo:**`). Absent → "backend": every roadmap authored before
// v2.0.0 has no line, so nothing is a page epic and the design-system gate stays silent.
const EPIC_KINDS = ["design-system", "pagina", "backend", "migracion"];

// "design-system" | "pagina" | "backend" | "migracion" when recognised; null when the line
// is present but says something else (the caller reports it — never silently a default).
function epicKind(value) {
  if (value === null || value === undefined) return "backend";
  const raw = String(value).replace(/[`*]/g, "").trim().toLowerCase();
  if (raw === "") return "backend";
  return EPIC_KINDS.includes(raw) ? raw : null;
}

// { id, state, template, tipo, operations: [{id, mode}], rules: [RN…], gaps: [GAP…],
//   parked: {ts, clase, motivo, tanda} | null, diferidos: [string], text }
function parseEpicBlock(text) {
  const all = lines(text);
  const head = all.find((l) => /\bEpic\b/i.test(l)) || "";
  const stateMatch = head.match(/\[( |\/|x)\]/);
  const opsValue = fieldValue(all, "Operaciones del contrato");
  const gapsValue = fieldValue(all, "Breaking changes in scope") || fieldValue(all, "Gaps");
  const tipoValue = fieldValue(all, "Tipo");
  return {
    id: epicIdFrom(head),
    state: !stateMatch ? null : stateMatch[1] === "x" ? "done" : stateMatch[1] === "/" ? "in-progress" : "pending",
    template: (fieldValue(all, "Template") || "").replace(/`/g, "").trim() || null,
    tipo: epicKind(tipoValue),
    tipoRaw: tipoValue,
    hasTipoLine: tipoValue !== null,
    operations: parseOperations(opsValue),
    hasOperationsLine: opsValue !== null,
    rules: idList(fieldValue(all, "Reglas de negocio clave"), RN_ID),
    hasRulesLine: fieldValue(all, "Reglas de negocio clave") !== null,
    gaps: idList(gapsValue, GAP_ID),
    hasGapsLine: gapsValue !== null,
    parked: parseParked(fieldValues(all, "Aparcado")[0]),
    // Items separated by ` · ` on one line, or one line per item — both forms add up.
    diferidos: fieldValues(all, "Diferidos heredados").flatMap((v) => v.split(/\s+·\s+/)).map((s) => s.trim()).filter(Boolean),
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
// Scope fingerprint of an epic (review stage, v2.3.0)
// ---------------------------------------------------------------------------

// Lines that are bookkeeping of the queue, not scope: the coordinator writes them while the
// batch runs, and a parked or inherited-deferral line must not make a reviewed epic "changed".
const SCOPE_IGNORED_LINE = /^(?:[-*+]\s*)?\*\*(?:Aparcado|Diferidos heredados)\b[^*]*\*\*/i;
// Any stable id of business_requirements.md that opens a definition (templates/BUSINESS_REQUIREMENTS_TEMPLATE.md).
const REQ_ID_START = /^(?:RN|CL|FA|HU)-(?:[A-Za-z0-9]+-)*\d+(?![0-9A-Za-z_])/;

// A requirements line without its leading list / table / heading markers, bold and backticks.
function stripLineMarkers(line) {
  let out = String(line).trim();
  for (let prev = null; prev !== out; ) {
    prev = out;
    out = out.replace(/^(?:[-*+]\s+|\d+[.)]\s+|\|\s*|#+\s*|\*\*|__|`)/, "").trim();
  }
  return out;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The definition block of `id` (RN-001, RN-SEG-007, …) in business_requirements.md: from the
// first line that — without list/table/heading markers and `**` — starts with the id, up to a
// blank line, a heading or a line that starts with another RN/CL/FA/HU id. Each line collapsed
// (CRLF, runs of spaces, indentation); null when the id is not defined.
function rnDefinition(requirementsText, id) {
  if (requirementsText === null || requirementsText === undefined) return null;
  const all = lines(requirementsText);
  const starts = new RegExp(`^${escapeRegExp(id)}(?![0-9A-Za-z_])`);
  const start = all.findIndex((l) => starts.test(stripLineMarkers(l)));
  if (start === -1) return null;
  const out = [collapse(all[start])];
  for (let i = start + 1; i < all.length; i++) {
    const line = all[i];
    if (line.trim() === "" || /^\s{0,3}#/.test(line) || REQ_ID_START.test(stripLineMarkers(line))) break;
    out.push(collapse(line));
  }
  return out.join("\n");
}

// The text scopeHash digests, or null when the epic is not in the ROADMAP: the epic block
// normalized (CRLF → LF, whitespace collapsed, blank lines dropped, the checkbox as `[?]`, no
// `**Aparcado:**` / `**Diferidos heredados:**` lines) followed by the definition of each RN of
// "Reglas de negocio clave" — `RN-xxx:MISSING` when business_requirements.md does not define it.
function scopeMaterial(roadmapText, epicId, requirementsText) {
  const epic = findEpicBlock(roadmapText, epicId);
  if (!epic) return null;
  const block = lines(epic.text)
    .map(collapse)
    .filter((l) => l !== "" && !SCOPE_IGNORED_LINE.test(l))
    .map((l, i) => (i === 0 ? l.replace(/\[(?: |\/|x|X)\]/, "[?]") : l));
  const rules = epic.rules.map((rn) => rnDefinition(requirementsText, rn) || `${rn}:MISSING`);
  return [...block, ...rules].join("\n");
}

// sha256 (12 hex) of scopeMaterial, or null when the epic is not in the ROADMAP. Stable across
// the checkbox state, so the SCOPE recorded when a batch review closes still matches when the
// epic's turn comes; it moves when the epic block or a linked RN's text changes.
function scopeHash(roadmapText, epicId, requirementsText) {
  const material = scopeMaterial(roadmapText, epicId, requirementsText);
  if (material === null) return null;
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 12);
}

// ---------------------------------------------------------------------------
// Spec files
// ---------------------------------------------------------------------------

// `Crea (<anything>):` is the "sibling / planned" variant of Crea: (the template says
// `Crea (spec hermano anterior):`; planners write variations of the parenthetical).
const SURFACE_LINE = /^\s*-\s*(Llama a|Crea\s*\([^)]*\)|Crea|Modifica|Fixtures disponibles)\s*:\s*(.*)$/i;
const PATH_LIKE = /^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/;

function parseSurfaceLine(kind, rest) {
  const symbol = (rest.match(/`([^`]+)`/) || [null, rest.split(/\s+(?:en|—|–|-)\s+/)[0]])[1];
  const pathMatch = rest.match(/\ben\s+`?([^`\s]+)`?/);
  const firmaMatch = rest.match(/firma\s*:\s*(.+?)(?:\s*`?\(planeada|$)/i);
  const cleanSymbol = unquote(symbol);
  // `Modifica: \`src/app.js\`` — the subject IS the path when no `en <path>` follows.
  const path = pathMatch ? pathMatch[1] : PATH_LIKE.test(cleanSymbol) ? cleanSymbol : null;
  return {
    kind: /^crea\s*\(/i.test(kind) ? "crea-hermano" : kind.toLowerCase().replace(/\s.*$/, ""),
    symbol: cleanSymbol,
    path,
    firma: firmaMatch ? normalizeSignature(firmaMatch[1]) : null,
    planned: /\(planeada\s*[—–-]+\s*re-anclar\)/i.test(rest),
    raw: collapse(rest)
  };
}

// `- **Implementa** (…): \`operationId\` — \`[a, b]\`` (template) or `- **Implementa:** \`a\` — \`POST /x\``:
// a bracket list wins; otherwise every backticked identifier-looking token counts.
function operationsFromLine(line) {
  const m = line.match(/\*\*(Implementa|Consume)\s*:?\s*\*\*\s*:?(.*)$/i);
  if (!m) return null;
  const mode = m[1].toLowerCase() === "consume" ? "consume" : "implementa";
  const rest = m[2];
  const bracket = rest.match(/\[([^\]]*)\]/);
  const ids = bracket
    ? bracket[1].split(",").map((s) => unquote(s)).filter(Boolean)
    : [...rest.matchAll(/`([A-Za-z][A-Za-z0-9_.]*)`/g)].map((x) => x[1]).filter((id) => id.toLowerCase() !== "operationid");
  return ids.map((id) => ({ id, mode }));
}

const SUPERSEDE_LINE = new RegExp(`^\\s*-\\s*Supersede\\s*:\\s*\`?([^\`\\s:]+)::([^\`]+?)\`?${DASH}motivo\\s*:\\s*(${MOTIVE_SRC})\\b`, "i");

// { slug, operations: [{id, mode}], hasOperationsSection, rules, surface: [...], plannedSymbols,
//   createdPaths, modifiedPaths, idCount, gaps, supersedes: [{path, test, motivo, br, accion}], outOfScope: [] }
function parseSpec(text, slug) {
  const opsSection = extractSection(text, /^##\s+Operaciones del Contrato/i) || "";
  const operations = [];
  for (const line of lines(opsSection)) {
    const found = operationsFromLine(line);
    if (found) operations.push(...found);
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
    const m = line.match(SUPERSEDE_LINE);
    if (!m) continue;
    const accion = line.match(new RegExp(`${DASH}acci[oó]n\\s*:\\s*(reescribir|retirar)\\b`, "i"));
    supersedes.push({ path: m[1], test: collapse(m[2]), motivo: m[3], br: brOf(m[3]), accion: accion ? accion[1].toLowerCase() : null });
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

// ---------------------------------------------------------------------------
// _planning.md registers written by the coordinator (v2.2.0)
// ---------------------------------------------------------------------------

// Lines of a register: the `## <NAME>` section (any suffix) or the bare `<NAME>:` label block of
// the v1.17.0 planner, up to the next `## ` heading or label line.
function registerLines(text, name) {
  const all = lines(text);
  const heading = new RegExp(`^##\\s+${name}\\b`);
  const label = new RegExp(`^\\s*${name}\\s*:`);
  const start = all.findIndex((l) => heading.test(l) || label.test(l));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < all.length; i++) {
    if (/^##\s/.test(all[i]) || SECTION_LABELS.test(all[i].trim())) break;
    out.push(all[i]);
  }
  return out;
}

// The value of a ` — name: value` field, or null.
function registerField(line, name, valueSrc) {
  const m = line.match(new RegExp(`${DASH}${name}\\s*:\\s*(${valueSrc})`, "i"));
  return m ? m[1].trim() : null;
}

// `## SUPERSESIONES` register (templates/PLANNING_TEMPLATE.md):
//   - <path>::<test> — motivo: <BR|AC|GAP> — spec: <slug> — commit: <pendiente|sha|sin cambio> [— loop: …] [— j9: SÍ] [— acción: …]
//   - red-fix: <path> — spec: <slug> — commit: <sha>
// → [{kind, path, test, motivo, slug, commit, loop, j9, accion, raw}]; `commit: pendiente` → null.
function parseSupersessionRegister(text) {
  const out = [];
  for (const raw of registerLines(text, "SUPERSESIONES")) {
    const line = raw.replace(/`/g, "");
    const commit = registerField(line, "commit", "sin cambio|pendiente|[0-9a-f]{7,40}");
    const accion = registerField(line, "acci[oó]n", "reescribir|retirar");
    const common = {
      slug: registerField(line, "spec", "[A-Za-z0-9_.-]+"),
      commit: commit === "pendiente" ? null : commit,
      loop: registerField(line, "loop", "compilaci[oó]n|runtime"),
      j9: registerField(line, "j9", "S[IÍ]|NO"),
      accion: accion ? accion.toLowerCase() : null
    };
    const redFix = line.match(/^\s*-\s*red-fix\s*:\s*(\S+)/i);
    if (redFix) {
      out.push({ kind: "red-fix", path: redFix[1], test: null, motivo: null, ...common, raw: collapse(raw) });
      continue;
    }
    const sup = line.match(new RegExp(`^\\s*-\\s*([^\\s:]+)::(.+?)${DASH}motivo\\s*:\\s*(${MOTIVE_SRC})\\b`));
    if (sup) out.push({ kind: "supersede", path: sup[1], test: collapse(sup[2]), motivo: sup[3], ...common, raw: collapse(raw) });
  }
  return out;
}

const VERDICT_HEADER = new RegExp(`^###\\s+([A-Za-z0-9_.-]+)${DASH}dispatch\\s+(\\d+)\\b(.*)$`);

// `### <set|slug> — dispatch N [— ronda R] — <fecha|ISO> [— tree <sha12>] [— head <sha12>] [— delta] [— loop] [— J9]`
// Legacy headers (`### set — dispatch 1 — 2026-09-23`, `… (loop de corrección)`) parse with null
// ronda/tree/head. → [{target, dispatch, ronda, ts, tree, head, delta, loop, j9, raw}]
function parseVerdictHeaders(text) {
  const out = [];
  for (const line of lines(text)) {
    const m = line.match(VERDICT_HEADER);
    if (!m) continue;
    const rest = m[3];
    const ronda = rest.match(/\bronda\s+(\d+)\b/i);
    const ts = rest.match(/\b(\d{4}-\d{2}-\d{2}(?:T[0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)?)/);
    const tree = rest.match(/\btree\s+([0-9a-f]{7,40})\b/i);
    const head = rest.match(/\bhead\s+([0-9a-f]{7,40})\b/i);
    const flag = (name) => new RegExp(`${DASH}${name}\\b`, "i").test(rest);
    out.push({
      target: m[1],
      dispatch: Number(m[2]),
      ronda: ronda ? Number(ronda[1]) : null,
      ts: ts ? ts[1] : null,
      tree: tree ? tree[1] : null,
      head: head ? head[1] : null,
      delta: flag("delta"),
      // `— loop` (v2.2.0) or the legacy free text `(loop de corrección)`.
      loop: flag("loop") || /\bloop\b/i.test(rest),
      j9: flag("J9"),
      raw: collapse(line)
    });
  }
  return out;
}

const GUARD_LINE = new RegExp(`^\\s*-\\s*\\*\\*(GUARD-\\d+)\\s*:?\\s*\\*\\*.*?${ARROW}\\s*test\\s*:\\s*\`?([^\`\\s:]+)::([^\`]+?)\`?\\s*$`);

// `- **GUARD-n:** <comportamiento> → test: \`<path>::<nombre>\`` (templates/SPEC_TEMPLATE.md).
// A GUARD without a test pointer protects nothing mechanically and is skipped.
function parseGuards(text) {
  const out = [];
  for (const line of lines(text)) {
    const m = line.match(GUARD_LINE);
    if (m) out.push({ id: m[1], path: m[2], test: collapse(m[3]) });
  }
  return out;
}

module.exports = {
  ROW_KINDS,
  RN_ID,
  GAP_ID,
  EPIC_KINDS,
  epicKind,
  normalizeSignature,
  parseCoverageTable,
  coverageHash,
  lastMechCheck,
  lastVisualApproval,
  parseLockSha,
  parseOperations,
  parseEpicBlock,
  parseRoadmapEpics,
  findEpicBlock,
  rnDefinition,
  scopeMaterial,
  scopeHash,
  parseSpec,
  parseSupersessionRegister,
  parseVerdictHeaders,
  parseGuards
};
