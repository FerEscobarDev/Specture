#!/usr/bin/env node
// review — parser and CLI of the batch review register (the review stage of `build`, v2.3.0).
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review.js" <command> [options] [--project <root>] [--json]
//
// The register lives in `docs/05-specs/_reviews/<YYYY-MM-DD>-<slug>.md` (grammar in
// templates/BATCH_REVIEW_TEMPLATE.md; procedure in skills/build/REVIEW_STAGE.md). The CURRENT
// register is the last one by name (date) whose ESTADO is not EJECUTADA.
//
//   status                              What the queue must do with the current register:
//                 `REVIEW: NONE`                                   no register, or all EJECUTADA
//                 `REVIEW: OPEN <id> <ESTADO> pendientes:<n>`       PREPARANDO | RONDA-1 | RONDA-2;
//                                                                  n = AGENDA items `respuesta: pendiente`
//                 `REVIEW: CLOSED <id> por-ejecutar:<n> aparcados:<m>`  CERRADA with work left
//                 `REVIEW: DRAINED <id>`                           CERRADA and every epic of EPICS is
//                                                                  `[x]` or parked
//                 "Parked" is read from the ROADMAP (`**Aparcado:**` on a `[ ]` epic) — the live
//                 marker; the register's APARCADOS is its history. A disagreement is a `- nota:`.
//   scope-hash    --epic <X.Y>          `SCOPE <X.Y>: <sha12>` — planning.scopeHash over the ROADMAP
//                 and business_requirements.md; what R5 records in `## SCOPE`.
//   scope-check   --batch <id> [--epic <X.Y>]
//                 Compares the recorded SCOPE of each epic of EPICS (or only --epic) with the
//                 current one: `REVIEW scope-check: SAME <n>` | `REVIEW scope-check: CHANGED <k>`,
//                 then `- SCOPE <X.Y>: SAME | CHANGED <viejo>→<nuevo> | MISSING` per epic
//                 (MISSING = no SCOPE line; an epic gone from the ROADMAP is `CHANGED <viejo>→ausente`).
//
// stdout: first line is the token, then one `- <detalle>` per line. Exit 0 = OK / SAME,
// 1 = CHANGED or MISSING, 2 = UNVERIFIABLE (`<prefix> UNVERIFIABLE <motivo>`: malformed current
// register, no register for --batch, no ROADMAP, unknown epic) or usage (unknown command or
// option, missing value). `--json` prints the result object with its `token`. `--project`
// defaults to cwd. Every command accepts only its own flags: an unknown one is never ignored.

const fs = require("fs");
const path = require("path");
const planning = require("./planning");
const { lines } = require("./doctor/project");

const REVIEWS_DIR = "docs/05-specs/_reviews";
const ROADMAP = "docs/04-roadmap/ROADMAP.md";
const REQUIREMENTS = "docs/01-requirements/business_requirements.md";
const REGISTER_NAME = /^\d{4}-\d{2}-\d{2}-.+\.md$/;
const ESTADOS = ["PREPARANDO", "RONDA-1", "RONDA-2", "CERRADA", "EJECUTADA"];
const OPEN_ESTADOS = ["PREPARANDO", "RONDA-1", "RONDA-2"];
const COMMAND_FLAGS = {
  status: [],
  "scope-hash": ["epic"],
  "scope-check": ["batch", "epic"]
};

const DASH = "\\s+(?:—|–|--|-)\\s+"; // field separator, as in planning.js
const ITEM_EPIC = "([^\\s—–]+)";
// A template marker left unfilled: `<X.Y>`, `<sha12>`, `<pregunta cerrada>` (not `< 24 h`).
const PLACEHOLDER = /<[^\s<>](?:[^<>]*[^\s<>])?>/;
const EPIC_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const AGENDA_ITEM = new RegExp(`^-\\s*\\*{0,2}(A-\\d+)\\*{0,2}${DASH}${ITEM_EPIC}${DASH}(.+?)${DASH}(.+?)${DASH}respuesta\\s*:\\s*(.+?)(?:${DASH}fuente\\s*:\\s*(.+?))?\\s*$`, "i");
const FILTERED_ITEM = new RegExp(`^-\\s*\\*{0,2}(F-\\d+)\\*{0,2}${DASH}${ITEM_EPIC}${DASH}(.+?)${DASH}resuelta por\\s*:\\s*(.+?)(?:${DASH}cita\\s*:\\s*(.+?))?\\s*$`, "i");
const PREMISE_ITEM = new RegExp(`^-\\s*\\*{0,2}(PR-\\d+)\\*{0,2}${DASH}${ITEM_EPIC}${DASH}(.+?)${DASH}(VERIFICADA|FALSA)\\s+(\\S+)(?:\\s*(?:→|->)\\s*(\\S+))?\\s*$`, "i");
const SCOPE_ITEM = new RegExp(`^-\\s*([^\\s:]+)\\s*:\\s*SCOPE\\s+([0-9a-f]{12})(?![0-9A-Za-z])(?:${DASH}(\\S+).*)?\\s*$`);
const PARKED_ITEM = new RegExp(`^-\\s*${ITEM_EPIC}${DASH}(\\S+)${DASH}(.+?)${DASH}(.+?)\\s*$`);
const EXECUTION_ITEM = /^-\s*([^\s:]+)\s*:\s*(.+?)\s*$/;

class UsageError extends Error {}

function usage() {
  return [
    "usage: review.js <command> [options] [--project <root>] [--json]",
    "  status",
    "  scope-hash  --epic <X.Y>",
    "  scope-check --batch <id> [--epic <X.Y>]"
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function collapse(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clean(value) {
  return String(value || "").replace(/[`*]/g, "").trim();
}

function unquoteCita(value) {
  return String(value || "").trim().replace(/^["“«](.*)["”»]$/, "$1");
}

// "2.1", "Epic 2.1", "epic-2.1-cobros" → "2.1"; "HC-IHCE.5" stays whole (only the numeric id
// of an `epic-<X.Y>-<slug>` directory name is cut out of its slug).
function epicIdOf(value) {
  const text = clean(value);
  const dir = text.match(/^epic-(\d+(?:\.\d+)*)(?:-|$)/i);
  return dir ? dir[1] : text.replace(/^epic\s+/i, "").trim();
}

function pendingValue(value) {
  const text = collapse(value);
  return /^pendiente\b/i.test(text) ? null : text;
}

// Splits on commas outside parentheses: `2.3 (datos, pagos), 2.4` → ["2.3 (datos, pagos)", "2.4"].
function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of String(value)) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function sectionKey(heading) {
  const name = heading.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  const known = ["POLITICAS", "AGENDA", "FILTRADAS", "PREMISAS", "DECISIONES PERSISTIDAS", "SCOPE", "APARCADOS", "EJECUCION", "METRICAS"];
  return known.find((k) => name.startsWith(k)) || "OTRA";
}

function malformed(section, line, what = "línea mal formada") {
  return PLACEHOLDER.test(line) ? `${section}: línea de la plantilla sin rellenar: ${line}` : `${section}: ${what}: ${line}`;
}

// A list of epic ids from a header value (EPICS, REGULATORIOS). Each part contributes its
// leading token (`2.3 (datos personales)` → 2.3); an invalid token is an error, never dropped.
function epicList(field, value, errors) {
  const out = [];
  for (const part of splitTopLevel(value)) {
    const tokenText = clean(part).replace(/^epic\s+/i, "").split(/[\s(]/)[0];
    if (EPIC_ID.test(tokenText)) out.push(tokenText);
    else if (PLACEHOLDER.test(part)) errors.push(`${field}: \`${part}\` es un marcador de la plantilla sin rellenar`);
    else errors.push(`${field}: \`${part}\` no es un id de epic`);
  }
  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// parseBatchReview
// ---------------------------------------------------------------------------

// { id, estado, epics[], regulatorios[], agenda: [{id, ronda, epic, clase, pregunta, respuesta|null, fuente|null}],
//   filtradas: [{id, epic, pregunta, resueltaPor, cita}], premisas: [{id, epic, estado, ref, destino}],
//   scope: {<X.Y>: {sha, ts}}, aparcados: [{epic, ts, clase, motivo}],
//   ejecucion: {<X.Y>: 'pendiente'|'en curso'|'hecho'|'aparcado'}, metricas: {name: number}, errors: [string] }
// Header fields (`- ID:`, `- ESTADO:`, `- EPICS:`, `- REGULATORIOS:`) are read before the first
// `## ` heading. Errors: a missing or invalid ID/ESTADO/EPICS, and any malformed item line of
// AGENDA (A-n), FILTRADAS (F-n), PREMISAS (PR-n), SCOPE, APARCADOS or EJECUCIÓN — a template
// line left unfilled says so. Everything else is prose and never an error.
function parseBatchReview(text) {
  const all = lines(text);
  const out = { id: null, estado: null, epics: [], regulatorios: [], agenda: [], filtradas: [], premisas: [], scope: {}, aparcados: [], ejecucion: {}, metricas: {}, errors: [] };
  const errors = out.errors;

  const header = {};
  for (const line of all) {
    if (/^##\s/.test(line)) break;
    const m = line.match(/^\s*-\s*(ID|ESTADO|EPICS|REGULATORIOS)\s*:\s*(.*)$/);
    if (m && !(m[1] in header)) header[m[1]] = m[2].trim();
  }
  if (!("ID" in header)) errors.push("falta la línea `- ID:`");
  else if (EPIC_ID.test(clean(header.ID))) out.id = clean(header.ID);
  else errors.push(PLACEHOLDER.test(header.ID) ? `ID: \`${header.ID}\` es un marcador de la plantilla sin rellenar` : `ID inválido: \`${header.ID}\``);

  if (!("ESTADO" in header)) errors.push("falta la línea `- ESTADO:`");
  else {
    const estado = clean(header.ESTADO).split(/\s+/)[0].toUpperCase();
    if (ESTADOS.includes(estado)) out.estado = estado;
    else errors.push(`ESTADO desconocido: ${header.ESTADO} (${ESTADOS.join(" | ")})`);
  }

  if (!("EPICS" in header)) errors.push("falta la línea `- EPICS:`");
  else {
    const before = errors.length;
    out.epics = epicList("EPICS", header.EPICS, errors);
    if (out.epics.length === 0 && errors.length === before) errors.push("EPICS vacío: la tanda no nombra ningún epic");
  }
  if ("REGULATORIOS" in header && !/^\(?\s*ningun[oa]s?\s*\)?\s*$/i.test(clean(header.REGULATORIOS)) && clean(header.REGULATORIOS) !== "") {
    out.regulatorios = epicList("REGULATORIOS", header.REGULATORIOS, errors);
  }

  let section = null;
  let ronda = null;
  for (const raw of all) {
    if (/^#\s/.test(raw)) {
      section = null;
      continue;
    }
    if (/^##\s/.test(raw)) {
      section = sectionKey(raw.replace(/^##\s+/, ""));
      ronda = null;
      continue;
    }
    if (/^###\s/.test(raw)) {
      const sub = raw.replace(/^###\s+/, "").trim();
      const n = sub.match(/^Ronda\s+(\d+)/i);
      ronda = n ? Number(n[1]) : /^Mini-?revisi[oó]n/i.test(sub) ? "mini" : null;
      continue;
    }
    if (!/^\s*-\s/.test(raw)) continue;
    const line = collapse(raw);
    switch (section) {
      case "AGENDA": {
        if (!/^-\s*\*{0,2}A-\d+/.test(line)) break;
        const m = line.match(AGENDA_ITEM);
        if (!m || !EPIC_ID.test(m[2])) {
          errors.push(malformed("AGENDA", line, "línea A-n mal formada"));
          break;
        }
        out.agenda.push({ id: m[1].toUpperCase(), ronda, epic: m[2], clase: m[3].trim(), pregunta: m[4].trim(), respuesta: pendingValue(m[5]), fuente: m[6] ? pendingValue(m[6]) : null });
        break;
      }
      case "FILTRADAS": {
        if (!/^-\s*\*{0,2}F-\d+/.test(line)) break;
        const m = line.match(FILTERED_ITEM);
        if (!m || !EPIC_ID.test(m[2])) {
          errors.push(malformed("FILTRADAS", line, "línea F-n mal formada"));
          break;
        }
        out.filtradas.push({ id: m[1].toUpperCase(), epic: m[2], pregunta: m[3].trim(), resueltaPor: m[4].trim(), cita: m[5] ? unquoteCita(m[5]) : null });
        break;
      }
      case "PREMISAS": {
        if (!/^-\s*\*{0,2}PR-\d+/.test(line)) break;
        const m = line.match(PREMISE_ITEM);
        if (!m || !EPIC_ID.test(m[2])) {
          errors.push(malformed("PREMISAS", line, "línea PR-n mal formada"));
          break;
        }
        out.premisas.push({ id: m[1].toUpperCase(), epic: m[2], estado: m[4].toUpperCase(), ref: m[5], destino: m[6] || null });
        break;
      }
      case "SCOPE": {
        const m = line.match(SCOPE_ITEM);
        if (!m || !EPIC_ID.test(m[1])) {
          errors.push(malformed("SCOPE", line));
          break;
        }
        out.scope[m[1]] = { sha: m[2], ts: m[3] || null };
        break;
      }
      case "APARCADOS": {
        const m = line.match(PARKED_ITEM);
        if (!m || !EPIC_ID.test(m[1])) {
          errors.push(malformed("APARCADOS", line));
          break;
        }
        out.aparcados.push({ epic: m[1], ts: m[2], clase: m[3].trim(), motivo: m[4].trim() });
        break;
      }
      case "EJECUCION": {
        const m = line.match(EXECUTION_ITEM);
        const value = m ? m[2] : "";
        const state = /^pendiente\b/i.test(value) ? "pendiente" : /^en curso\b/i.test(value) ? "en curso" : /^(?:\[x\]|hecho\b)/i.test(value) ? "hecho" : /^aparcado\b/i.test(value) ? "aparcado" : null;
        if (!m || !EPIC_ID.test(m[1]) || state === null) {
          errors.push(malformed("EJECUCIÓN", line));
          break;
        }
        out.ejecucion[m[1]] = state;
        break;
      }
      case "METRICAS":
        for (const metric of line.matchAll(/([A-Za-z_]+)\s*:\s*(\d+)/g)) out.metricas[metric[1]] = Number(metric[2]);
        break;
      default:
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Batch state against the ROADMAP (pure — the doctor reuses them)
// ---------------------------------------------------------------------------

// { hechos, porEjecutar, aparcados, notes } for the EPICS of a parsed register, given
// planning.parseRoadmapEpics(). Parked = `**Aparcado:**` on a `[ ]` epic of the ROADMAP.
function batchProgress(review, roadmapEpics) {
  const hechos = [];
  const porEjecutar = [];
  const aparcados = [];
  const notes = [];
  for (const id of review.epics) {
    const epic = roadmapEpics.find((e) => e.id === id);
    if (!epic) {
      porEjecutar.push(id);
      notes.push(`${id} no está en el ROADMAP — se cuenta por ejecutar`);
      continue;
    }
    if (epic.state === "done") {
      hechos.push(id);
      continue;
    }
    if (epic.parked && epic.state === "pending") {
      aparcados.push(id);
      continue;
    }
    porEjecutar.push(id);
    if (epic.parked) notes.push(`${id} está [/] con una línea \`**Aparcado:**\` — se cuenta por ejecutar`);
    else if (review.aparcados.some((a) => a.epic === id)) notes.push(`${id} figura en APARCADOS del registro pero el ROADMAP no lo marca \`**Aparcado:**\` — se cuenta por ejecutar`);
  }
  return { hechos, porEjecutar, aparcados, notes };
}

// [{epic, status: 'SAME'|'CHANGED'|'MISSING', recorded, current}] — recorded SCOPE vs the
// current planning.scopeHash; `current` is null when the epic is no longer in the ROADMAP.
function compareScopes(review, roadmapText, requirementsText, epicIds = review.epics) {
  return epicIds.map((id) => {
    const recorded = review.scope[id] ? review.scope[id].sha : null;
    const current = planning.scopeHash(roadmapText, id, requirementsText);
    if (recorded === null) return { epic: id, status: "MISSING", recorded, current };
    return { epic: id, status: current === recorded ? "SAME" : "CHANGED", recorded, current };
  });
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return null;
  }
}

// Every `<YYYY-MM-DD>-<slug>.md` under docs/05-specs/_reviews/, sorted by name, parsed.
function listRegisters(root) {
  let names;
  try {
    names = fs.readdirSync(path.join(root, REVIEWS_DIR), { withFileTypes: true }).filter((e) => e.isFile() && REGISTER_NAME.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
  return names.sort().map((name) => {
    const file = `${REVIEWS_DIR}/${name}`;
    return { name, file, review: parseBatchReview(readText(root, file) || "") };
  });
}

// The last register by name whose ESTADO is not EJECUTADA (a malformed ESTADO counts: it is
// never skipped silently), or null.
function currentRegister(registers) {
  for (let i = registers.length - 1; i >= 0; i--) {
    if (registers[i].review.estado !== "EJECUTADA") return registers[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function unverifiable(command, reason, extra = {}) {
  return { command, status: "UNVERIFIABLE", reason, findings: [], notes: [], ...extra };
}

function requireFlags(opts, ...keys) {
  for (const key of keys) {
    if (!(key in opts.flags)) throw new UsageError(`--${key} is required for ${opts.command}`);
  }
}

function statusCommand(opts, root) {
  const current = currentRegister(listRegisters(root));
  if (!current) return { command: "status", status: "NONE", findings: [], notes: [] };
  const { review, file } = current;
  if (review.errors.length > 0) return unverifiable("status", `registro mal formado: ${file}`, { file, findings: review.errors });
  const base = { command: "status", id: review.id, estado: review.estado, file, findings: [], notes: [] };
  if (OPEN_ESTADOS.includes(review.estado)) {
    const pending = review.agenda.filter((a) => a.respuesta === null);
    return { ...base, status: "OPEN", pendientes: pending.length, pendingItems: pending };
  }
  const roadmapText = readText(root, ROADMAP);
  if (roadmapText === null) return unverifiable("status", `${ROADMAP} no encontrado: no se puede saber qué epics de ${review.id} quedan por ejecutar`, { file });
  const progress = batchProgress(review, planning.parseRoadmapEpics(roadmapText));
  return {
    ...base,
    status: progress.porEjecutar.length === 0 ? "DRAINED" : "CLOSED",
    hechos: progress.hechos,
    porEjecutar: progress.porEjecutar,
    aparcados: progress.aparcados,
    notes: progress.notes
  };
}

// The notes that make a MISSING RN visible (the hash counts it as `RN-xxx:MISSING`).
function missingRuleNotes(epic, requirementsText) {
  if (requirementsText === null) return epic.rules.length > 0 ? [`${REQUIREMENTS} no encontrado — ${epic.rules.join(", ")} cuentan como MISSING`] : [];
  return epic.rules.filter((rn) => planning.rnDefinition(requirementsText, rn) === null).map((rn) => `${rn} no está definida en ${REQUIREMENTS} — cuenta como ${rn}:MISSING`);
}

function scopeHashCommand(opts, root) {
  requireFlags(opts, "epic");
  const wanted = epicIdOf(opts.flags.epic) || opts.flags.epic;
  const roadmapText = readText(root, ROADMAP);
  if (roadmapText === null) return unverifiable("scope-hash", `${ROADMAP} no encontrado`, { epic: wanted });
  const epic = planning.findEpicBlock(roadmapText, opts.flags.epic);
  if (!epic) return unverifiable("scope-hash", `el epic ${wanted} no existe en ${ROADMAP}`, { epic: wanted });
  const requirementsText = readText(root, REQUIREMENTS);
  const sha = planning.scopeHash(roadmapText, epic.id, requirementsText);
  return { command: "scope-hash", status: "OK", epic: epic.id, sha, rules: epic.rules, findings: [], notes: missingRuleNotes(epic, requirementsText) };
}

function scopeCheckCommand(opts, root) {
  requireFlags(opts, "batch");
  const batch = clean(opts.flags.batch);
  const register = listRegisters(root).find((r) => r.review.id === batch || r.name === `${batch}.md`);
  if (!register) return unverifiable("scope-check", `no hay registro de la tanda ${batch} en ${REVIEWS_DIR}/`);
  if (register.review.errors.length > 0) return unverifiable("scope-check", `registro mal formado: ${register.file}`, { file: register.file, findings: register.review.errors });
  const roadmapText = readText(root, ROADMAP);
  if (roadmapText === null) return unverifiable("scope-check", `${ROADMAP} no encontrado`, { file: register.file });
  const ids = opts.flags.epic ? [epicIdOf(opts.flags.epic) || opts.flags.epic] : register.review.epics;
  const epics = compareScopes(register.review, roadmapText, readText(root, REQUIREMENTS), ids);
  const changed = epics.filter((e) => e.status !== "SAME").length;
  return { command: "scope-check", status: changed > 0 ? "CHANGED" : "SAME", batch: register.review.id, file: register.file, count: changed > 0 ? changed : epics.length, epics, findings: [], notes: [] };
}

const COMMANDS = { status: statusCommand, "scope-hash": scopeHashCommand, "scope-check": scopeCheckCommand };

function run(opts) {
  const root = path.resolve(opts.project || process.cwd());
  try {
    return COMMANDS[opts.command](opts, root);
  } catch (error) {
    if (error instanceof UsageError) return unverifiable(opts.command, error.message, { usage: true });
    return unverifiable(opts.command, `error inesperado: ${collapse(error && error.message)}`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { command: argv[0], flags: {}, json: false, project: null };
  const known = COMMAND_FLAGS[opts.command];
  if (!known) throw new UsageError(`unknown command ${opts.command || "(none)"}`);
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new UsageError(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === "json") {
      opts.json = true;
      continue;
    }
    if (key !== "project" && !known.includes(key)) throw new UsageError(`unknown option --${key} for ${opts.command}`);
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`missing value for --${key}`);
    if (key === "project") opts.project = value;
    else opts.flags[key] = value;
  }
  return opts;
}

function prefix(result) {
  if (result.command === "scope-hash" && result.epic) return `SCOPE ${result.epic}:`;
  if (result.command === "scope-hash" || result.command === "scope-check") return `REVIEW ${result.command}:`;
  return "REVIEW:";
}

function token(result) {
  const head = prefix(result);
  switch (result.status) {
    case "UNVERIFIABLE":
      return `${head} UNVERIFIABLE ${result.reason}`;
    case "NONE":
      return `${head} NONE`;
    case "OPEN":
      return `${head} OPEN ${result.id} ${result.estado} pendientes:${result.pendientes}`;
    case "CLOSED":
      return `${head} CLOSED ${result.id} por-ejecutar:${result.porEjecutar.length} aparcados:${result.aparcados.length}`;
    case "DRAINED":
      return `${head} DRAINED ${result.id}`;
    case "OK":
      return `${head} ${result.sha}`;
    default:
      return `${head} ${result.status} ${result.count}`; // scope-check SAME <n> | CHANGED <k>
  }
}

function render(result) {
  const body = [];
  if (result.command === "status" && result.file && result.status !== "UNVERIFIABLE") body.push(`registro: ${result.file}`);
  for (const item of result.pendingItems || []) body.push(`pendiente: ${item.id} — ${item.epic} — ${item.clase} — ${item.pregunta}`);
  if (result.porEjecutar && result.porEjecutar.length > 0) body.push(`por ejecutar: ${result.porEjecutar.join(", ")}`);
  if (result.aparcados && result.aparcados.length > 0) body.push(`aparcados: ${result.aparcados.join(", ")}`);
  for (const e of result.epics || []) {
    const detail = e.status === "CHANGED" ? `CHANGED ${e.recorded}→${e.current || "ausente"}` : e.status;
    body.push(`SCOPE ${e.epic}: ${detail}`);
  }
  body.push(...result.findings, ...result.notes.map((n) => `nota: ${n}`));
  return [token(result), ...body.map((l) => `- ${l}`)].join("\n") + "\n";
}

function exitCode(result) {
  if (result.status === "UNVERIFIABLE") return 2;
  return result.status === "CHANGED" ? 1 : 0;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    process.stdout.write(`${token(unverifiable(argv[0], error.message))}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  const result = run(opts);
  if (result.usage) process.stderr.write(`${usage()}\n`);
  process.stdout.write(opts.json ? JSON.stringify({ token: token(result), ...result }, null, 2) + "\n" : render(result));
  process.exit(exitCode(result));
}

module.exports = {
  REVIEWS_DIR,
  ESTADOS,
  COMMAND_FLAGS,
  parseBatchReview,
  batchProgress,
  compareScopes,
  listRegisters,
  currentRegister,
  parseArgs,
  run,
  token,
  render,
  exitCode
};
