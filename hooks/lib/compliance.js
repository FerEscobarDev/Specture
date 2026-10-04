#!/usr/bin/env node
// compliance — the mechanical half of the compliance review (since v2.4.0).
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" <command> [options] [--project <root>] [--json]
//
//   range      --milestone <N> [--date YYYY-MM-DD]
//              The milestone's code, as per-epic windows: each epic's work lies in
//              (LOCK_e, CLOSE_e] — LOCK from `_planning.md` (`- LOCK_SHA:`), else from the ROADMAP
//              history (`[/]` flip); CLOSE from the ROADMAP history (`[x]` flip). Concurrency is 1,
//              so a window holds only that epic's work, whatever other milestones interleave.
//              Excludes docs/, .specture/, lockfiles and binaries; groups the files by architecture
//              component ("Carpeta raíz", else first directory) into chunks of at most ~120 000
//              characters of diff. Writes .specture/state/compliance/<id>/ (range.json,
//              chunk-<k>.files, chunk-<k>.diff, commits.txt).
//   lint       --id <id>              every part the reviewer wrote: grammar, and no Specture
//              vocabulary in the suggested comments (rule IDs, Specture file names, `§`, the
//              included paths of review-rules.md).
//   assemble   --id <id>              merges the parts into docs/07-reviews/cumplimiento-milestone-<N>-
//              <date>[-pK].md: removes exact duplicates, orders by severity, numbers F-n, computes
//              STATUS (any BLOCKER → REJECTED_MAJOR, IMPORTANT → REJECTED_MINOR, else APPROVED).
//   stub       --milestone <N> --reason "<…>" [--date]   a BLOCKED report when the range or the
//              parts could not be trusted — never a guess.
//   triage     --report <file> --set "F-1=corregir;F-2=diferir:<motivo>;F-3=no-aplica:<motivo>"
//              records the user's decision per finding. Only `Tipo: refactor` can be corrected.
//   correction --report <file> --set "F-1=<sha>;F-4=no-corregido:<motivo>"
//   status                            reports with TRIAGE PENDIENTE or corrections still open.
//   record     --report <file>        appends a `kind: "compliance"` line to build-metrics.jsonl.
//
// stdout: first line is the token `COMPLIANCE <cmd>: <RESULT> …`, then `- <detail>` lines.
// Exit 0 = success, 1 = FAIL (lint, a report that does not parse, a bad --set), 2 = UNVERIFIABLE
// or usage. What cannot be established (no git, a missing LOCK, a window that is not an ancestry
// line) is UNVERIFIABLE, never a silent guess.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { findProjectRoot } = require("./specture-guard");
const { parseLockSha } = require("./planning");
const { parseComponents } = require("./current-state");
const { FRAMEWORK_PREFIXES } = require("./seal");
const reviewRules = require("./review-rules");

const ROADMAP = "docs/04-roadmap/ROADMAP.md";
const SPECS_DIR = "docs/05-specs";
const ARCHITECTURE = "docs/02-architecture/architecture.md";
const REVIEWS_DIR = "docs/07-reviews";
const STATE_DIR = ".specture/state/compliance";
const METRICS_FILE = "docs/.specture-meta/build-metrics.jsonl";
const CHUNK_LIMIT = 120000;
const SEVERITIES = ["BLOCKER", "IMPORTANT", "NIT"];
const TIPOS = ["refactor", "comportamiento", "test", "proceso"];
const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Gemfile\.lock|poetry\.lock|Cargo\.lock|packages\.lock\.json|go\.sum)$/i;
const REPORT_NAME = /^cumplimiento-milestone-([A-Za-z0-9.]+)-(\d{4}-\d{2}-\d{2})(?:-p(\d+))?\.md$/;

// ---------- small helpers ----------

function readText(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return null;
  }
}

function lines(text) {
  return String(text).replace(/^\uFEFF/, "").split(/\r?\n/);
}

function git(root, args) {
  const res = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { ok: res.status === 0, stdout: res.stdout || "", stderr: res.stderr || "" };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pluginVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "plugin.json"), "utf8")).version;
  } catch {
    return null;
  }
}

// ---------- milestone → epics ----------

const MILESTONE_HEADING = /^#{2,3}\s+(Milestone\b.*)$/i;
const EPIC_LINE = /^\s*-\s*\[( |\/|x)\]\s*(.*)$/;

// { title, tombstone, ids: [...], states: {id: state} } for `Milestone <N>`, or null. Tombstone
// lines (`- [x] Epic 3.1, Epic 3.2`) can hold several ids: every `Epic X.Y` token counts.
function milestoneEpics(roadmapText, n) {
  const all = lines(roadmapText);
  const wanted = new RegExp(`^Milestone\\s+${escapeRegExp(n)}(?![\\w.])`, "i");
  const start = all.findIndex((l) => {
    const m = l.match(MILESTONE_HEADING);
    return m && wanted.test(m[1].trim());
  });
  if (start === -1) return null;
  const title = all[start].replace(/^#+\s*/, "").trim();
  const out = { title, tombstone: /\barchivad[oa]s?\b|✅/i.test(title), ids: [], states: {} };
  for (let i = start + 1; i < all.length; i++) {
    if (MILESTONE_HEADING.test(all[i]) || /^#{1,2}\s/.test(all[i])) break;
    const epic = all[i].match(EPIC_LINE);
    if (!epic) continue;
    const state = epic[1] === "x" ? "done" : epic[1] === "/" ? "in-progress" : "pending";
    for (const m of epic[2].matchAll(/\bEpic\s+([A-Za-z0-9][A-Za-z0-9._-]*?)(?=[\s:*,)]|$)/gi)) {
      const id = m[1].replace(/[.]+$/, "");
      if (!out.ids.includes(id)) {
        out.ids.push(id);
        out.states[id] = state;
      }
    }
  }
  return out;
}

// Epic id → state for every epic line of a ROADMAP text (all ids of a line).
function roadmapStates(text) {
  const states = {};
  for (const line of lines(text)) {
    const epic = line.match(EPIC_LINE);
    if (!epic) continue;
    const state = epic[1] === "x" ? "done" : epic[1] === "/" ? "in-progress" : "pending";
    for (const m of epic[2].matchAll(/\bEpic\s+([A-Za-z0-9][A-Za-z0-9._-]*?)(?=[\s:*,)]|$)/gi)) {
      states[m[1].replace(/[.]+$/, "")] = state;
    }
  }
  return states;
}

// The last commit where each epic entered `[/]` and `[x]`, walking the ROADMAP history.
function roadmapTransitions(root, ids) {
  const log = git(root, ["log", "--reverse", "--format=%H", "--", ROADMAP]);
  if (!log.ok) return null;
  const lock = {};
  const close = {};
  let prev = {};
  for (const sha of log.stdout.split(/\r?\n/).filter(Boolean)) {
    const show = git(root, ["show", `${sha}:./${ROADMAP}`]);
    if (!show.ok) continue;
    const states = roadmapStates(show.stdout);
    for (const id of ids) {
      if (states[id] === "in-progress" && prev[id] !== "in-progress") lock[id] = sha;
      if (states[id] === "done" && prev[id] !== "done") close[id] = sha;
    }
    prev = states;
  }
  return { lock, close };
}

function epicDir(root, id) {
  let dirs = [];
  try {
    dirs = fs.readdirSync(path.join(root, SPECS_DIR), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return null;
  }
  const re = new RegExp(`^epic-${escapeRegExp(id)}(?:[-_]|$)`, "i");
  return dirs.find((d) => re.test(d)) || null;
}

function resolveCommit(root, rev) {
  const res = git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  return res.ok ? res.stdout.trim() : null;
}

// ---------- range ----------

function excluded(rel) {
  return FRAMEWORK_PREFIXES.some((p) => rel.startsWith(p)) || LOCKFILES.test(rel);
}

function windowFiles(root, lock, close) {
  const res = git(root, ["diff", "--numstat", "--relative", "--no-renames", "--diff-filter=ACMR", lock, close]);
  if (!res.ok) return null;
  const files = [];
  const skipped = [];
  for (const line of res.stdout.split(/\r?\n/).filter(Boolean)) {
    const [added, , file] = line.split("\t");
    if (!file) continue;
    if (added === "-") skipped.push(`${file} (binario)`);
    else if (excluded(file)) continue;
    else files.push(file);
  }
  return { files, skipped };
}

function componentRoots(root) {
  const text = readText(root, ARCHITECTURE);
  if (!text) return [];
  return parseComponents(text)
    .filter((c) => c.root)
    .map((c) => ({ name: c.name, root: c.root.replace(/^`|`$/g, "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "") }))
    .filter((c) => c.root && c.root !== "." && !/^n\/?a\b/i.test(c.root) && !c.root.startsWith("["))
    .sort((a, b) => b.root.length - a.root.length);
}

function groupOf(file, components) {
  const hit = components.find((c) => file === c.root || file.startsWith(`${c.root}/`));
  if (hit) return hit.name;
  const first = file.includes("/") ? file.split("/")[0] : "(raíz)";
  return `otros: ${first}`;
}

function range(root, opts) {
  const n = opts.milestone;
  const date = opts.date || today();
  const roadmapText = readText(root, ROADMAP);
  if (roadmapText === null) return { token: "UNVERIFIABLE", detail: `no existe ${ROADMAP}` };
  const milestone = milestoneEpics(roadmapText, n);
  if (!milestone) return { token: "UNVERIFIABLE", detail: `no hay "Milestone ${n}" en el ROADMAP` };
  if (milestone.ids.length === 0) return { token: "UNVERIFIABLE", detail: `Milestone ${n} no tiene epics` };
  const open = milestone.ids.filter((id) => milestone.states[id] !== "done");
  if (open.length > 0) return { token: "UNVERIFIABLE", detail: `Milestone ${n} no está cerrado: ${open.map((id) => `Epic ${id}`).join(", ")} sin [x]` };
  if (!git(root, ["rev-parse", "--git-dir"]).ok) return { token: "UNVERIFIABLE", detail: "no es un repositorio git" };
  const history = roadmapTransitions(root, milestone.ids);
  if (!history) return { token: "UNVERIFIABLE", detail: `no se pudo leer el historial de ${ROADMAP}` };

  const epics = [];
  const problems = [];
  const skipped = [];
  for (const id of milestone.ids) {
    const dir = epicDir(root, id);
    const planning = dir ? readText(root, `${SPECS_DIR}/${dir}/_planning.md`) : null;
    const lockSource = planning && parseLockSha(planning) ? "planning" : "roadmap";
    const lockRev = lockSource === "planning" ? parseLockSha(planning) : history.lock[id];
    const closeRev = history.close[id];
    const lock = lockRev ? resolveCommit(root, lockRev) : null;
    const close = closeRev ? resolveCommit(root, closeRev) : null;
    if (!lock) {
      problems.push(`Epic ${id}: sin LOCK (${lockRev ? `${lockRev} no existe` : "ni LOCK_SHA en _planning.md ni [/] en el historial del ROADMAP"})`);
      continue;
    }
    if (!close) {
      problems.push(`Epic ${id}: sin el commit que lo marcó [x] en el historial del ROADMAP`);
      continue;
    }
    if (!git(root, ["merge-base", "--is-ancestor", lock, close]).ok) {
      problems.push(`Epic ${id}: LOCK ${lock.slice(0, 7)} no es ancestro de CLOSE ${close.slice(0, 7)} (historia reescrita o squash)`);
      continue;
    }
    const files = windowFiles(root, lock, close);
    if (!files) {
      problems.push(`Epic ${id}: git diff falló en ${lock.slice(0, 7)}..${close.slice(0, 7)}`);
      continue;
    }
    skipped.push(...files.skipped);
    const log = git(root, ["log", "--format=%h%x09%s", `${lock}..${close}`]);
    const commits = log.stdout.split(/\r?\n/).filter(Boolean).map((l) => {
      const [sha, ...rest] = l.split("\t");
      return { sha, subject: rest.join("\t") };
    });
    epics.push({ id, dir, lock, close, lockSource, files: files.files, commits });
  }
  if (problems.length > 0) return { token: "UNVERIFIABLE", detail: `ventanas no verificables para Milestone ${n}`, lines: problems };

  // per-file diff text across the windows that touched it
  const fileDiff = new Map();
  for (const e of epics) {
    for (const file of e.files) {
      const d = git(root, ["diff", "--relative", "--no-renames", e.lock, e.close, "--", file]);
      const chunk = `# Epic ${e.id} · ${e.lock.slice(0, 7)}..${e.close.slice(0, 7)}\n${d.stdout}`;
      fileDiff.set(file, (fileDiff.get(file) || "") + chunk);
    }
  }
  const components = componentRoots(root);
  const groups = new Map();
  for (const file of [...fileDiff.keys()].sort()) {
    const g = groupOf(file, components);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(file);
  }
  const chunks = [];
  for (const [label, files] of groups) {
    let current = [];
    let size = 0;
    const flush = () => {
      if (current.length === 0) return;
      chunks.push({ label, files: current, diffChars: size });
      current = [];
      size = 0;
    };
    for (const file of files) {
      const s = fileDiff.get(file).length;
      if (current.length > 0 && size + s > CHUNK_LIMIT) flush();
      current.push(file);
      size += s;
    }
    flush();
  }
  chunks.forEach((c, i) => {
    c.id = `chunk-${i + 1}`;
  });

  const head = resolveCommit(root, "HEAD");
  const id = `milestone-${n}-${date}`;
  const dir = path.join(root, STATE_DIR, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const c of chunks) {
    fs.writeFileSync(path.join(dir, `${c.id}.files`), c.files.join("\n") + "\n");
    fs.writeFileSync(path.join(dir, `${c.id}.diff`), c.files.map((f) => fileDiff.get(f)).join("\n"));
  }
  fs.writeFileSync(
    path.join(dir, "commits.txt"),
    epics.flatMap((e) => e.commits.map((c) => `Epic ${e.id}\t${c.sha}\t${c.subject}`)).join("\n") + "\n"
  );
  const data = {
    id,
    milestone: String(n),
    title: milestone.title,
    date,
    head,
    epics: epics.map((e) => ({ id: e.id, dir: e.dir, lock: e.lock, close: e.close, lockSource: e.lockSource, files: e.files.length, commits: e.commits.length })),
    chunks: chunks.map((c) => ({ id: c.id, label: c.label, files: c.files, diffChars: c.diffChars })),
    skipped
  };
  fs.writeFileSync(path.join(dir, "range.json"), JSON.stringify(data, null, 2) + "\n");
  const fileCount = chunks.reduce((k, c) => k + c.files.length, 0);
  return {
    token: fileCount === 0 ? "EMPTY" : "READY",
    detail: `${id} · ${epics.length} epics · ${fileCount} archivos · ${chunks.length} bloques`,
    lines: [...chunks.map((c) => `${c.id} ${c.label} · ${c.files.length} archivos · ${c.diffChars} caracteres de diff`), ...skipped.map((s) => `omitido: ${s}`)],
    data
  };
}

// ---------- parts (written by the compliance-reviewer) ----------

const FINDING_KEYS = ["SEV", "TIPO", "TITULO", "UBICACION", "SIMBOLO", "FRAGMENTO", "ORIGEN", "POR_QUE", "COMENTARIO"];

function parsePart(text) {
  const part = { chunk: null, summary: [], strengths: [], findings: [], general: [], conflicts: [], notEvaluated: [], errors: [] };
  let current = null;
  lines(text).forEach((raw, i) => {
    const line = raw.trim();
    const n = i + 1;
    if (!line || line.startsWith("<!--")) return;
    if (/^HALLAZGO\s*$/i.test(line)) {
      if (current) part.errors.push(`línea ${n}: HALLAZGO sin FIN del anterior`);
      current = { line: n };
      return;
    }
    if (/^FIN\s*$/i.test(line)) {
      if (!current) {
        part.errors.push(`línea ${n}: FIN sin HALLAZGO`);
        return;
      }
      for (const k of FINDING_KEYS) if (!current[k]) part.errors.push(`hallazgo de la línea ${current.line}: falta ${k}`);
      if (current.SEV && !SEVERITIES.includes(current.SEV.toUpperCase())) part.errors.push(`hallazgo de la línea ${current.line}: SEV "${current.SEV}" (BLOCKER | IMPORTANT | NIT)`);
      if (current.TIPO && !TIPOS.includes(current.TIPO.toLowerCase())) part.errors.push(`hallazgo de la línea ${current.line}: TIPO "${current.TIPO}" (refactor | comportamiento | test | proceso)`);
      if (current.UBICACION && !/^[^\s:]+:\d+$/.test(current.UBICACION)) part.errors.push(`hallazgo de la línea ${current.line}: UBICACION "${current.UBICACION}" (esperado <ruta>:<línea>)`);
      part.findings.push({
        sev: String(current.SEV || "").toUpperCase(),
        tipo: String(current.TIPO || "").toLowerCase(),
        title: current.TITULO,
        location: current.UBICACION,
        symbol: current.SIMBOLO && current.SIMBOLO !== "-" ? current.SIMBOLO : null,
        fragment: current.FRAGMENTO,
        origin: current.ORIGEN,
        why: current.POR_QUE,
        comment: current.COMENTARIO,
        line: current.line
      });
      current = null;
      return;
    }
    const kv = line.match(/^([A-Z_]+)\s*:\s*(.*)$/);
    if (!kv) {
      part.errors.push(`línea ${n}: fuera de la gramática: "${line.slice(0, 60)}"`);
      return;
    }
    const [, key, value] = kv;
    if (current) {
      if (FINDING_KEYS.includes(key)) current[key] = value.trim();
      else part.errors.push(`línea ${n}: clave ${key} dentro de un HALLAZGO`);
      return;
    }
    if (key === "PARTE") part.chunk = value.trim();
    else if (key === "RESUMEN") part.summary.push(value.trim());
    else if (key === "BIEN") part.strengths.push(value.trim());
    else if (key === "GENERAL") part.general.push(value.trim());
    else if (key === "CONFLICTO") part.conflicts.push(value.trim());
    else if (key === "NO_EVALUADO") part.notEvaluated.push(value.trim());
    else part.errors.push(`línea ${n}: clave desconocida ${key}`);
  });
  if (current) part.errors.push(`hallazgo de la línea ${current.line}: sin FIN`);
  if (!part.chunk) part.errors.push("falta PARTE: <id del bloque>");
  return part;
}

// Words a reader of a suggested comment cannot follow: framework vocabulary and the paths
// review-rules.md includes. Comments explain the problem in plain words instead.
function forbiddenPatterns(root) {
  const out = [
    { re: /\b(?:R|RV|ADR|RN|AC|BR|EC|W|CL|FA|HU|F)-[A-Z0-9][A-Za-z0-9-]*\b/, why: "cita un ID de regla" },
    { re: /\bADR\b/, why: "cita un ADR" },
    { re: /specture/i, why: "menciona el framework" },
    { re: /docs\/0\d-/, why: "cita una ruta de documentación del framework" },
    { re: /§/, why: "cita una sección de un documento" },
    { re: /\b(?:conventions\.md|rules\.yml|review-rules(?:\.md)?|_planning\.md|ROADMAP\.md|settings\.yml|stack\.yml)\b/i, why: "cita un archivo de configuración del framework" }
  ];
  const file = path.join(root, reviewRules.REVIEW_RULES_FILE);
  if (fs.existsSync(file)) {
    const parsed = reviewRules.parseReviewRules(fs.readFileSync(file, "utf8"));
    const refs = [...parsed.includes, ...parsed.flexible.refs].map((r) => r.path).filter(Boolean);
    for (const p of new Set(refs)) {
      out.push({ re: new RegExp(escapeRegExp(path.basename(p)), "i"), why: `cita el archivo incluido ${p}` });
    }
  }
  return out;
}

function lintPart(part, patterns) {
  const problems = [...part.errors];
  const texts = [
    ...part.findings.map((f) => ({ where: `hallazgo de la línea ${f.line} (COMENTARIO)`, text: f.comment || "" })),
    ...part.general.map((g, i) => ({ where: `GENERAL ${i + 1}`, text: g }))
  ];
  for (const { where, text } of texts) {
    for (const p of patterns) {
      const m = text.match(p.re);
      if (m) problems.push(`${where}: ${p.why} ("${m[0]}") — el comentario debe entenderse sin documentos internos`);
    }
  }
  return problems;
}

function stateDir(root, id) {
  return path.join(root, STATE_DIR, id);
}

function readRange(root, id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir(root, id), "range.json"), "utf8"));
  } catch {
    return null;
  }
}

function lint(root, opts) {
  const data = readRange(root, opts.id);
  if (!data) return { token: "UNVERIFIABLE", detail: `no hay range.json para ${opts.id} — corré range primero` };
  const patterns = forbiddenPatterns(root);
  const out = [];
  for (const c of data.chunks) {
    const text = readText(root, `${STATE_DIR}/${opts.id}/part-${c.id}.md`);
    if (text === null) {
      out.push(`${c.id}: falta part-${c.id}.md`);
      continue;
    }
    const part = parsePart(text);
    if (part.chunk && part.chunk !== c.id) out.push(`${c.id}: PARTE dice "${part.chunk}"`);
    for (const p of lintPart(part, patterns)) out.push(`${c.id}: ${p}`);
  }
  return out.length === 0 ? { token: "PASS", detail: `${data.chunks.length} parte(s)` } : { token: "FAIL", detail: `${out.length}`, lines: out };
}

// ---------- report ----------

function reportPath(root, milestone, date) {
  const base = `cumplimiento-milestone-${milestone}-${date}`;
  let rel = `${REVIEWS_DIR}/${base}.md`;
  for (let k = 2; fs.existsSync(path.join(root, rel)); k++) rel = `${REVIEWS_DIR}/${base}-p${k}.md`;
  return rel;
}

function statusOf(findings) {
  if (findings.some((f) => f.sev === "BLOCKER")) return "REJECTED_MAJOR";
  if (findings.some((f) => f.sev === "IMPORTANT")) return "REJECTED_MINOR";
  return "APPROVED";
}

function renderReport(meta, body) {
  const findings = body.findings;
  const count = (s) => findings.filter((f) => f.sev === s).length;
  const status = meta.status || statusOf(findings);
  const triage = meta.triage || (findings.length === 0 || status === "BLOCKED" ? "NO REQUERIDO" : "PENDIENTE");
  const out = [
    `# Revisión de cumplimiento — ${meta.title}`,
    "",
    `**Fecha:** ${meta.date}`,
    "**Revisor:** compliance-reviewer (agente) · armado por compliance.js",
    `**Milestone:** ${meta.milestone}`,
    `**Rango:** ${meta.id}`,
    `**HEAD:** ${meta.head || "—"}`,
    "",
    "## Veredicto",
    "",
    `**STATUS: ${status}**`,
    `**TRIAGE:** ${triage}`,
    `**Hallazgos:** BLOCKER ${count("BLOCKER")} · IMPORTANT ${count("IMPORTANT")} · NIT ${count("NIT")}`,
    ""
  ];
  if (meta.reason) out.push(`**Motivo:** ${meta.reason}`, "");
  out.push("## Resumen", "", ...(body.summary.length ? body.summary.map((s) => `- ${s}`) : ["- (sin resumen)"]), "");
  out.push("## Lo que está bien", "", ...(body.strengths.length ? body.strengths.map((s) => `- ${s}`) : ["- (nada destacado)"]), "");
  out.push("## Hallazgos", "");
  if (findings.length === 0) out.push("Sin hallazgos.", "");
  findings.forEach((f, i) => {
    out.push(
      `### F-${i + 1} [${f.sev}] ${f.title}`,
      "",
      `- **Ubicación:** \`${f.location}\` @${(meta.head || "HEAD").slice(0, 7)}${f.symbol ? ` · \`${f.symbol}\`` : ""}`,
      `- **Fragmento:** \`${String(f.fragment).replace(/`/g, "'")}\``,
      `- **Tipo:** ${f.tipo}`,
      `- **Origen:** ${f.origin}`,
      `- **Por qué:** ${f.why}`,
      `- **Comentario sugerido:** ${f.comment}`,
      ""
    );
  });
  out.push("## Comentarios generales sugeridos", "", ...(body.general.length ? body.general.map((g) => `- ${g}`) : ["- (ninguno)"]), "");
  out.push("## Reglas en conflicto", "", ...(body.conflicts.length ? body.conflicts.map((c) => `- ${c}`) : ["- (ninguno)"]), "");
  out.push("## Alcance y nivel flexible", "", ...body.scope.map((s) => `- ${s}`), ...body.notEvaluated.map((s) => `- No evaluado: ${s}`), "");
  out.push("## TRIAGE", "", ...(body.triage && body.triage.length ? body.triage : ["(sin decisiones todavía)"]), "");
  out.push("## DIFERIDOS", "", ...(body.deferred && body.deferred.length ? body.deferred : ["(ninguno)"]), "");
  out.push("## CORRECCIÓN", "", ...(body.correction && body.correction.length ? body.correction : ["(ninguna)"]), "");
  return out.join("\n");
}

function assemble(root, opts) {
  const data = readRange(root, opts.id);
  if (!data) return { token: "UNVERIFIABLE", detail: `no hay range.json para ${opts.id} — corré range primero` };
  const body = { summary: [], strengths: [], findings: [], general: [], conflicts: [], notEvaluated: [], scope: [] };
  const errors = [];
  for (const c of data.chunks) {
    const text = readText(root, `${STATE_DIR}/${opts.id}/part-${c.id}.md`);
    if (text === null) {
      errors.push(`falta part-${c.id}.md`);
      continue;
    }
    const part = parsePart(text);
    if (part.errors.length) errors.push(...part.errors.map((e) => `${c.id}: ${e}`));
    body.summary.push(...part.summary.map((s) => `${c.label}: ${s}`));
    body.strengths.push(...part.strengths);
    body.findings.push(...part.findings);
    body.general.push(...part.general);
    body.conflicts.push(...part.conflicts);
    body.notEvaluated.push(...part.notEvaluated);
  }
  if (errors.length) return { token: "FAIL", detail: `${errors.length}`, lines: errors };
  const seen = new Set();
  body.findings = body.findings
    .filter((f) => {
      const key = `${f.location}|${f.origin}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const s = SEVERITIES.indexOf(a.sev) - SEVERITIES.indexOf(b.sev);
      if (s !== 0) return s;
      const [pa, la] = a.location.split(/:(?=\d+$)/);
      const [pb, lb] = b.location.split(/:(?=\d+$)/);
      return pa === pb ? Number(la) - Number(lb) : pa.localeCompare(pb);
    });
  body.conflicts = [...new Set(body.conflicts)];
  body.notEvaluated = [...new Set(body.notEvaluated)];
  body.scope = [
    `Epics: ${data.epics.map((e) => `${e.id} (${e.lock.slice(0, 7)}..${e.close.slice(0, 7)}, ${e.files} archivos)`).join(" · ")}`,
    `Bloques: ${data.chunks.length ? data.chunks.map((c) => `${c.label} (${c.files.length})`).join(" · ") : "ninguno — el rango no tiene archivos de código"}`,
    ...(data.skipped || []).map((s) => `Omitido: ${s}`)
  ];
  const rel = reportPath(root, data.milestone, data.date);
  fs.mkdirSync(path.join(root, REVIEWS_DIR), { recursive: true });
  const status = statusOf(body.findings);
  fs.writeFileSync(path.join(root, rel), renderReport({ title: data.title, date: data.date, milestone: data.milestone, id: data.id, head: data.head }, body));
  return { token: "WRITTEN", detail: `${rel} · STATUS ${status} · ${body.findings.length} hallazgo(s)`, data: { report: rel, status, findings: body.findings.length } };
}

function stub(root, opts) {
  const date = opts.date || today();
  const roadmapText = readText(root, ROADMAP);
  const milestone = roadmapText ? milestoneEpics(roadmapText, opts.milestone) : null;
  const rel = reportPath(root, opts.milestone, date);
  fs.mkdirSync(path.join(root, REVIEWS_DIR), { recursive: true });
  const body = { summary: [], strengths: [], findings: [], general: [], conflicts: [], notEvaluated: [], scope: ["No se revisó: la revisión no pudo completarse."] };
  fs.writeFileSync(
    path.join(root, rel),
    renderReport({ title: milestone ? milestone.title : `Milestone ${opts.milestone}`, date, milestone: opts.milestone, id: `milestone-${opts.milestone}-${date}`, head: resolveCommit(root, "HEAD"), status: "BLOCKED", triage: "NO REQUERIDO", reason: opts.reason }, body)
  );
  return { token: "WRITTEN", detail: `${rel} · STATUS BLOCKED`, data: { report: rel, status: "BLOCKED" } };
}

// ---------- report parsing, triage, correction ----------

function sectionLines(all, heading) {
  const start = all.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < all.length && !/^##\s/.test(all[i]); i++) out.push(all[i]);
  return out;
}

function parseReport(text) {
  const all = lines(text);
  const errors = [];
  const status = (text.match(/\*\*STATUS:\s*(APPROVED|REJECTED_MINOR|REJECTED_MAJOR|BLOCKED)\*\*/) || [])[1] || null;
  const triageLine = (text.match(/^\*\*TRIAGE:\*\*\s*(.+)$/m) || [])[1] || null;
  const milestone = (text.match(/^\*\*Milestone:\*\*\s*(\S+)/m) || [])[1] || null;
  if (!status) errors.push("sin **STATUS: …**");
  if (!triageLine) errors.push("sin **TRIAGE:**");
  if (!milestone) errors.push("sin **Milestone:**");
  const findings = [];
  let current = null;
  for (const line of all) {
    const h = line.match(/^###\s+F-(\d+)\s+\[(BLOCKER|IMPORTANT|NIT)\]\s+(.*)$/);
    if (h) {
      current = { id: `F-${h[1]}`, sev: h[2], title: h[3].trim(), tipo: null, location: null };
      findings.push(current);
      continue;
    }
    if (/^##\s/.test(line)) current = null;
    if (!current) continue;
    const tipo = line.match(/^-\s+\*\*Tipo:\*\*\s*(\S+)/);
    if (tipo) current.tipo = tipo[1].toLowerCase();
    const loc = line.match(/^-\s+\*\*Ubicación:\*\*\s*`([^`]+)`/);
    if (loc) current.location = loc[1];
  }
  for (const f of findings) if (!TIPOS.includes(f.tipo)) errors.push(`${f.id} sin Tipo válido`);
  const triage = {};
  for (const line of sectionLines(all, "TRIAGE") || []) {
    const m = line.match(/^-\s+(F-\d+)\s+—\s+(corregir|diferir|no aplica)\b(?:\s+—\s+(.*))?$/);
    if (m) triage[m[1]] = { decision: m[2], reason: m[3] || null };
  }
  const correction = {};
  for (const line of sectionLines(all, "CORRECCIÓN") || []) {
    const m = line.match(/^-\s+(F-\d+)\s+—\s+(corregido|no corregido)\b(?:\s+—\s+(.*))?$/);
    if (m) correction[m[1]] = { result: m[2], detail: m[3] || null };
  }
  const deferred = (sectionLines(all, "DIFERIDOS") || []).filter((l) => /^-\s+F-\d+/.test(l)).length;
  const triageState = triageLine ? (/^PENDIENTE/.test(triageLine) ? "PENDIENTE" : /^HECHO/.test(triageLine) ? "HECHO" : /^NO REQUERIDO/.test(triageLine) ? "NO REQUERIDO" : null) : null;
  if (triageLine && !triageState) errors.push(`TRIAGE "${triageLine}" (PENDIENTE | HECHO <fecha> | NO REQUERIDO)`);
  return { status, triage: triageState, milestone, findings, decisions: triage, correction, deferred, errors };
}

function parseSet(value) {
  return String(value || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const m = item.match(/^(F-\d+)\s*=\s*([^:]+?)\s*(?::\s*(.*))?$/);
      return m ? { id: m[1], value: m[2].trim(), reason: m[3] ? m[3].trim() : null } : { bad: item };
    });
}

function replaceSection(text, heading, newLines) {
  const all = lines(text);
  const start = all.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return `${text.replace(/\s+$/, "")}\n\n## ${heading}\n\n${newLines.join("\n")}\n`;
  let end = start + 1;
  while (end < all.length && !/^##\s/.test(all[end])) end++;
  return [...all.slice(0, start + 1), "", ...newLines, "", ...all.slice(end)].join("\n");
}

function triage(root, opts) {
  const rel = opts.report;
  const text = readText(root, rel);
  if (text === null) return { token: "UNVERIFIABLE", detail: `no existe ${rel}` };
  const report = parseReport(text);
  if (report.errors.length) return { token: "FAIL", detail: "el reporte no parsea", lines: report.errors };
  const items = parseSet(opts.set);
  const problems = [];
  const byId = new Map(report.findings.map((f) => [f.id, f]));
  const decisions = {};
  for (const item of items) {
    if (item.bad) {
      problems.push(`"${item.bad}" no es F-n=<decisión>`);
      continue;
    }
    const f = byId.get(item.id);
    if (!f) {
      problems.push(`${item.id} no existe en el reporte`);
      continue;
    }
    const v = item.value.toLowerCase().replace(/-/g, " ");
    if (!["corregir", "diferir", "no aplica"].includes(v)) {
      problems.push(`${item.id}: "${item.value}" (corregir | diferir | no-aplica)`);
      continue;
    }
    if (v === "corregir" && f.tipo !== "refactor") {
      problems.push(`${item.id} es de tipo ${f.tipo}: solo se corrige un refactor (un cambio de comportamiento va a un spec; un test lo cambia el test-writer; un hallazgo de proceso, como un mensaje de commit, no se corrige con código) — diferilo o marcalo no aplica`);
      continue;
    }
    decisions[item.id] = { decision: v, reason: item.reason };
  }
  const missing = report.findings.filter((f) => !decisions[f.id] && !report.decisions[f.id]).map((f) => f.id);
  if (missing.length) problems.push(`sin decisión: ${missing.join(", ")}`);
  if (problems.length) return { token: "FAIL", detail: `${problems.length}`, lines: problems };
  const all = { ...report.decisions, ...decisions };
  const date = opts.date || today();
  const triageLines = report.findings.map((f) => `- ${f.id} — ${all[f.id].decision}${all[f.id].reason ? ` — ${all[f.id].reason}` : ""}`);
  const deferredLines = report.findings
    .filter((f) => all[f.id].decision === "diferir")
    .map((f) => `- ${f.id} — ${f.title} — dueño: sin epic${all[f.id].reason ? ` — ${all[f.id].reason}` : ""}`);
  let out = text.replace(/^\*\*TRIAGE:\*\*.*$/m, `**TRIAGE:** HECHO ${date}`);
  out = replaceSection(out, "TRIAGE", triageLines);
  out = replaceSection(out, "DIFERIDOS", deferredLines.length ? deferredLines : ["(ninguno)"]);
  fs.writeFileSync(path.join(root, rel), out);
  const counts = (d) => Object.values(all).filter((x) => x.decision === d).length;
  return { token: "RECORDED", detail: `${rel} · corregir ${counts("corregir")} · diferir ${counts("diferir")} · no aplica ${counts("no aplica")}`, lines: report.findings.filter((f) => all[f.id].decision === "corregir").map((f) => `corregir ${f.id} ${f.location}`) };
}

function correction(root, opts) {
  const rel = opts.report;
  const text = readText(root, rel);
  if (text === null) return { token: "UNVERIFIABLE", detail: `no existe ${rel}` };
  const report = parseReport(text);
  if (report.errors.length) return { token: "FAIL", detail: "el reporte no parsea", lines: report.errors };
  const problems = [];
  const results = { ...report.correction };
  for (const item of parseSet(opts.set)) {
    if (item.bad) {
      problems.push(`"${item.bad}" no es F-n=<sha|no-corregido:motivo>`);
      continue;
    }
    if (!report.decisions[item.id] || report.decisions[item.id].decision !== "corregir") {
      problems.push(`${item.id} no tiene decisión "corregir" en el triage`);
      continue;
    }
    if (/^no[- ]corregido$/i.test(item.value)) results[item.id] = { result: "no corregido", detail: item.reason || "sin motivo" };
    else if (/^[0-9a-f]{7,40}$/i.test(item.value)) results[item.id] = { result: "corregido", detail: item.value };
    else problems.push(`${item.id}: "${item.value}" (un sha o no-corregido:<motivo>)`);
  }
  if (problems.length) return { token: "FAIL", detail: `${problems.length}`, lines: problems };
  const ids = Object.keys(results).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  const out = replaceSection(text, "CORRECCIÓN", ids.map((id) => `- ${id} — ${results[id].result} — ${results[id].detail}`));
  fs.writeFileSync(path.join(root, rel), out);
  return { token: "RECORDED", detail: `${rel} · ${ids.length} resultado(s)` };
}

function listReports(root) {
  let names = [];
  try {
    names = fs.readdirSync(path.join(root, REVIEWS_DIR)).filter((n) => REPORT_NAME.test(n)).sort();
  } catch {
    return [];
  }
  return names.map((n) => ({ rel: `${REVIEWS_DIR}/${n}`, report: parseReport(readText(root, `${REVIEWS_DIR}/${n}`) || "") }));
}

function status(root) {
  const pending = [];
  let deferred = 0;
  for (const { rel, report } of listReports(root)) {
    deferred += report.deferred;
    if (report.triage === "PENDIENTE") pending.push(`${rel} — TRIAGE PENDIENTE (${report.findings.length} hallazgo(s))`);
    const open = Object.entries(report.decisions).filter(([id, d]) => d.decision === "corregir" && !report.correction[id]).map(([id]) => id);
    if (report.triage === "HECHO" && open.length) pending.push(`${rel} — CORRECCIÓN pendiente: ${open.join(", ")}`);
  }
  return pending.length
    ? { token: "PENDING", detail: `${pending.length} · diferidos ${deferred}`, lines: pending }
    : { token: "NONE", detail: `diferidos ${deferred}` };
}

function record(root, opts) {
  const rel = opts.report;
  const text = readText(root, rel);
  if (text === null) return { token: "UNVERIFIABLE", detail: `no existe ${rel}` };
  const report = parseReport(text);
  if (report.errors.length) return { token: "FAIL", detail: "el reporte no parsea", lines: report.errors };
  const count = (pred) => report.findings.filter(pred).length;
  const decisions = Object.values(report.decisions);
  const results = Object.values(report.correction);
  const line = {
    kind: "compliance",
    milestone: report.milestone,
    report: rel,
    status: report.status,
    findings: { BLOCKER: count((f) => f.sev === "BLOCKER"), IMPORTANT: count((f) => f.sev === "IMPORTANT"), NIT: count((f) => f.sev === "NIT") },
    tipo: { refactor: count((f) => f.tipo === "refactor"), comportamiento: count((f) => f.tipo === "comportamiento"), test: count((f) => f.tipo === "test"), proceso: count((f) => f.tipo === "proceso") },
    triage: {
      corregir: decisions.filter((d) => d.decision === "corregir").length,
      diferir: decisions.filter((d) => d.decision === "diferir").length,
      no_aplica: decisions.filter((d) => d.decision === "no aplica").length
    },
    corrected: results.filter((r) => r.result === "corregido").length,
    not_corrected: results.filter((r) => r.result === "no corregido").length,
    plugin: pluginVersion(),
    ts: opts.ts || new Date().toISOString()
  };
  const file = path.join(root, METRICS_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(line) + "\n");
  return { token: "APPENDED", detail: `${METRICS_FILE} · milestone ${line.milestone}`, data: line };
}

// ---------- CLI ----------

const COMMANDS = { range, lint, assemble, stub, triage, correction, status, record };
const NEEDS = {
  range: ["milestone"],
  lint: ["id"],
  assemble: ["id"],
  stub: ["milestone", "reason"],
  triage: ["report", "set"],
  correction: ["report", "set"],
  status: [],
  record: ["report"]
};

function usage(message) {
  if (message) process.stderr.write(`compliance: ${message}\n`);
  process.stderr.write(`usage: node hooks/lib/compliance.js <${Object.keys(COMMANDS).join("|")}> [options] [--project <root>] [--json]\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS[command]) usage(command ? `unknown command ${command}` : "missing command");
  const opts = { command, project: null, json: false };
  const valued = { "--project": "project", "--milestone": "milestone", "--date": "date", "--id": "id", "--report": "report", "--set": "set", "--reason": "reason" };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") opts.json = true;
    else if (valued[a]) opts[valued[a]] = rest[++i];
    else usage(`unknown argument ${a}`);
  }
  for (const k of NEEDS[command]) if (!opts[k]) usage(`${command} needs --${k}`);
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) usage("--date is YYYY-MM-DD");
  return opts;
}

const EXIT = { READY: 0, EMPTY: 0, PASS: 0, WRITTEN: 0, RECORDED: 0, NONE: 0, PENDING: 0, APPENDED: 0, FAIL: 1, UNVERIFIABLE: 2 };

function main(argv) {
  const opts = parseArgs(argv);
  const start = path.resolve(opts.project || ".");
  const root = findProjectRoot(start);
  if (!root) usage(`not a Specture project (no .specture/stack.yml found from ${start})`);
  const result = COMMANDS[opts.command](root, opts);
  if (opts.json) process.stdout.write(JSON.stringify({ ...result, token: `COMPLIANCE ${opts.command}: ${result.token}` }) + "\n");
  else {
    process.stdout.write(`COMPLIANCE ${opts.command}: ${result.token}${result.detail ? ` ${result.detail}` : ""}\n`);
    for (const l of result.lines || []) process.stdout.write(`- ${l}\n`);
  }
  return EXIT[result.token] === undefined ? 1 : EXIT[result.token];
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  STATE_DIR,
  REVIEWS_DIR,
  REPORT_NAME,
  CHUNK_LIMIT,
  milestoneEpics,
  roadmapStates,
  parsePart,
  lintPart,
  forbiddenPatterns,
  parseReport,
  listReports,
  statusOf,
  range,
  lint,
  assemble,
  stub,
  triage,
  correction,
  status,
  record,
  main
};
