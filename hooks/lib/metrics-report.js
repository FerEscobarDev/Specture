#!/usr/bin/env node
// Build metrics reader — `docs/.specture-meta/build-metrics.jsonl` (framework roadmap item 34,
// gate design §6.5). The file is append-only (one JSON object per epic, written by the build
// coordinator when it processes the epic-agent's report) and tracked in git (decision A7).
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/metrics-report.js" [--project <root>] [--last N] [--json]
//       Per-epic table + aggregates split by `source` (gate | baseline) + the §6.5 reading.
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/metrics-report.js" --baseline [--project <root>] [--since <ref>] [--write] [--json]
//       Reconstructs one line per [x] epic from what is mechanically recoverable — review
//       verdicts in docs/07-reviews/ (STATUS / CAUSE), _planning.md counters when present,
//       RED / revert / supersede commits in `git log` — and, with --write, appends the epics not
//       already in the file (source: "baseline"). Fields that cannot be reconstructed are null.
//
// Always fail-open: a missing file is "no metrics yet" (exit 0), a malformed line is skipped
// with a warning on stderr, a git error leaves the git-derived fields null.
//
// Line schema (v1.18.0):
//   { ts, source: "gate"|"baseline", plugin, epic, specs, planner_dispatches, open_questions,
//     resolved_alone, c7_rejections, mech_check_failures, validator_dispatches,
//     validator_verdict: "APPROVED"|"ESCALATED"|null, needs_context_spec, iteration_cap_spec,
//     blocked_spec, reviewer_rejected_major_spec_defect, review_rejections: {minor, major},
//     supersessions, outcome: "DONE"|"BLOCKED"|"REJECTED_MAJOR"|"ESCALATED", tokens: null|{input, output, source} }
// Additive fields (v2.2.0, all numeric; a line without them still reads — they are averaged
// over the lines that carry them): gate_rounds, gate_human_contacts, exec_human_contacts,
//   planner_redispatch_after_approved (must stay 0 — gate re-dispatches caused by a WARNING or
//   NOTE of an APPROVED; execution-born correction, red-fix and supersession loops go to
//   planner_dispatches_loop), validator_dispatches_loop,
//   planner_dispatches_loop, supersede_loops, supersede_tests, j9_regressions,
//   exec_blocked_compile, exec_blocked_runtime, baseline_failures, late_findings;
//   plus `effort` ({<agent>: <level>}, not numeric — carried, never averaged).
// `validator_dispatches` counts gate dispatches only; the correction-loop ones (`— loop`,
// legacy `(loop de corrección)`) go to `validator_dispatches_loop`.
// Additive fields (v2.3.0, review stage — skills/build/REVIEW_STAGE.md): `batch_id` (string: the
//   review register's ID), the six figures of the register's `## MÉTRICAS` line — review_rounds,
//   review_questions, review_filtered, review_human_contacts, late_questions, premises_false —
//   and, per epic, `parked` (numeric) and `park_class` (string, carried). The six belong to the
//   batch, not to the epic: every epic line of a batch may repeat them, so they are counted once
//   per `batch_id` (the first line of the batch that carries each one) — averaged per batch and
//   totalled in `review_totals`. R1 ("el planner no pregunta") counts open_questions + the
//   batch's review_questions on a line that carries `batch_id`.
// Compliance records (v2.4.0, `kind: "compliance"` — one per milestone report, appended by
//   `compliance.js record` after the triage): { kind, milestone, report, status,
//   findings: {BLOCKER, IMPORTANT, NIT}, tipo: {refactor, comportamiento, test},
//   triage: {corregir, diferir, no_aplica}, corrected, not_corrected, plugin, ts }. They carry no
//   `epic`: they are read into their own list, never counted as epics nor as malformed lines.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { lines, readText, walk, parseRoadmap } = require("./doctor/project");
const { REVIEW_STATUS } = require("./doctor/checks/corpus");
const { parseVerdictHeaders, parseSupersessionRegister } = require("./planning");
const { findProjectRoot } = require("./specture-guard");

const METRICS_FILE = path.join("docs", ".specture-meta", "build-metrics.jsonl");
const REVIEW_CAUSE = /CAUSE:\s*\**\s*(none|implementation|spec_defect|architecture)/i;
const NUMERIC = [
  "specs", "planner_dispatches", "open_questions", "resolved_alone", "c7_rejections", "mech_check_failures",
  "validator_dispatches", "needs_context_spec", "iteration_cap_spec", "blocked_spec",
  "reviewer_rejected_major_spec_defect", "supersessions",
  // v2.2.0
  "gate_rounds", "gate_human_contacts", "exec_human_contacts", "planner_redispatch_after_approved",
  "validator_dispatches_loop", "planner_dispatches_loop", "supersede_loops", "supersede_tests", "j9_regressions",
  "exec_blocked_compile", "exec_blocked_runtime", "baseline_failures", "late_findings",
  // v2.3.0 — per epic
  "parked"
];
// v2.3.0 — per batch (one review register), read once per `batch_id`.
const BATCH_FIELDS = ["review_rounds", "review_questions", "review_filtered", "review_human_contacts", "late_questions", "premises_false"];
// Rounds of validation per epic from which the reading asks to review the validator's criterion.
const GATE_ROUNDS_CEILING = 3;

function parseArgs(argv) {
  const opts = { project: null, last: null, json: false, baseline: false, since: null, write: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project") opts.project = argv[++i];
    else if (arg === "--last") opts.last = Number(argv[++i]);
    else if (arg === "--json") opts.json = true;
    else if (arg === "--baseline") opts.baseline = true;
    else if (arg === "--since") opts.since = argv[++i];
    else if (arg === "--write") opts.write = true;
    else throw new Error(`unknown option ${arg}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function readMetrics(projectRoot) {
  const text = readText(projectRoot, METRICS_FILE);
  if (text === null) return { exists: false, entries: [], compliance: [], skipped: 0 };
  const entries = [];
  const compliance = [];
  let skipped = 0;
  for (const line of lines(text)) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === "object" && obj.kind === "compliance") compliance.push(obj);
      else if (obj && typeof obj === "object" && obj.epic) entries.push(obj);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { exists: true, entries, compliance, skipped };
}

function mean(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  return nums.length === 0 ? null : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function batchIdOf(entry) {
  return typeof entry.batch_id === "string" && entry.batch_id.trim() !== "" ? entry.batch_id.trim() : null;
}

// batch_id → {field: value} with the first value each BATCH_FIELDS field takes in the batch.
function batchFigures(entries) {
  const batches = new Map();
  for (const e of entries) {
    const id = batchIdOf(e);
    if (id === null) continue;
    const figures = batches.get(id) || {};
    for (const key of BATCH_FIELDS) if (!(key in figures) && isNumber(e[key])) figures[key] = e[key];
    batches.set(id, figures);
  }
  return batches;
}

// Questions asked for an epic: open_questions, plus its batch's review_questions when the line
// carries batch_id (the review stage asked them before the epic ran). null when neither is known.
function askedQuestions(entry, batches) {
  const id = batchIdOf(entry);
  if (id === null) return isNumber(entry.open_questions) ? entry.open_questions : null;
  return sumOrNull([entry.open_questions, batches.get(id).review_questions]);
}

function aggregate(entries) {
  const out = { count: entries.length };
  for (const key of NUMERIC) out[key] = mean(entries.map((e) => e[key]));
  out.review_major = mean(entries.map((e) => e.review_rejections && e.review_rejections.major));
  out.review_minor = mean(entries.map((e) => e.review_rejections && e.review_rejections.minor));
  const batches = batchFigures(entries);
  out.batches = batches.size;
  out.review_totals = {};
  for (const key of BATCH_FIELDS) {
    const values = [...batches.values()].map((b) => b[key]);
    out[key] = mean(values);
    out.review_totals[key] = sumOrNull(values);
  }
  // Review figures on a line without batch_id cannot be counted once per batch: left out, and said.
  out.review_unbatched = entries.filter((e) => batchIdOf(e) === null && BATCH_FIELDS.some((k) => isNumber(e[k]))).length;
  const asked = entries.map((e) => askedQuestions(e, batches)).filter((q) => q !== null);
  out.zero_question_share = asked.length === 0 ? null : Math.round((asked.filter((q) => q === 0).length / asked.length) * 100) / 100;
  out.downstream_defects = mean(entries.map((e) => sumOrNull([e.needs_context_spec, e.iteration_cap_spec, e.blocked_spec])));
  out.tokens = mean(entries.map((e) => (e.tokens && typeof e.tokens === "object" ? (e.tokens.input || 0) + (e.tokens.output || 0) : null)));
  out.outcomes = entries.reduce((acc, e) => ({ ...acc, [e.outcome || "unknown"]: (acc[e.outcome || "unknown"] || 0) + 1 }), {});
  return out;
}

function sumOrNull(values) {
  const nums = values.filter((v) => typeof v === "number");
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

// The §6.5 reading rules, applied where they are mechanical.
function reading(gate, baseline) {
  const notes = [];
  if (gate.count === 0) {
    notes.push("Sin epics con gate todavía: no hay lectura. Las líneas `baseline` esperan la comparación.");
    return notes;
  }
  if (baseline.count === 0) notes.push("Sin baseline: correr `metrics-report.js --baseline --write` sobre los epics previos al gate para comparar.");
  const before = baseline.downstream_defects;
  const after = gate.downstream_defects;
  if (before !== null && after !== null) {
    if (after < before) notes.push(`Bajan needs_context/iteration_cap/blocked por epic (${before} → ${after}): el gate atrapa ambigüedad real — objetivo del release cumplido.`);
    else if (gate.zero_question_share !== null && gate.zero_question_share >= 0.8) notes.push(`No bajan (${before} → ${after}) y ${gate.batches > 0 ? "preguntas (open_questions + review_questions de su tanda)" : "open_questions"} ≈ 0 en el ${Math.round(gate.zero_question_share * 100)} % de los epics: el planner no pregunta (R1). Corregir el planner (criterio de escalado, escenarios 1 y 5), no agregar validación.`);
    else notes.push(`No bajan (${before} → ${after}) aunque el planner pregunta: revisar los OPEN_QUESTIONS convertidos y los C7 antes de tocar el gate.`);
  }
  if (gate.reviewer_rejected_major_spec_defect !== null) {
    const b = baseline.reviewer_rejected_major_spec_defect;
    if (b !== null && gate.reviewer_rejected_major_spec_defect > b) notes.push(`reviewer_rejected_major_spec_defect sube (${b} → ${gate.reviewer_rejected_major_spec_defect}): decisión A6 — mantener dims 1-6 por spec, no consolidar en un dispatch de set.`);
    else if (b !== null) notes.push(`reviewer_rejected_major_spec_defect no sube (${b} → ${gate.reviewer_rejected_major_spec_defect}): A6 puede consolidar dims 1-6 en el dispatch de set cuando haya ~10 epics.`);
  }
  if (gate.c7_rejections !== null && gate.c7_rejections >= 1) notes.push(`c7_rejections alto sostenido (${gate.c7_rejections} por epic): el planner cita mal — endurecer su Step 4.`);
  if (typeof gate.planner_redispatch_after_approved === "number" && gate.planner_redispatch_after_approved > 0) {
    notes.push(`planner_redispatch_after_approved > 0 (${gate.planner_redispatch_after_approved} por epic): el coordinador reabre APROBADOS — lo aprobado no vuelve al planner; las observaciones van a GATE_NOTES o DIFERIDOS.`);
  }
  if (typeof gate.gate_rounds === "number" && gate.gate_rounds >= GATE_ROUNDS_CEILING) {
    notes.push(`gate_rounds ≥ ${GATE_ROUNDS_CEILING} sostenido (${gate.gate_rounds} por epic): revisar criterio del validador antes de agregar validación.`);
  }
  if (gate.review_unbatched > 0) {
    notes.push(`${gate.review_unbatched} línea(s) con métricas de revisión (review_*) sin batch_id: no se cuentan por tanda ni suman a R1 — el coordinador escribe batch_id en cada epic de una tanda revisada.`);
  }
  if (gate.tokens !== null && baseline.tokens !== null) {
    notes.push(gate.tokens > baseline.tokens ? `Tokens por epic suben (${baseline.tokens} → ${gate.tokens}): si los defectos bajan menos de lo que cuesta, ajustar 4a (más fast path mecánico) antes de tocar el gate.` : `Tokens por epic no suben (${baseline.tokens} → ${gate.tokens}).`);
  } else {
    notes.push("Regla de tokens: juicio del usuario (sin harness de medición; el campo `tokens` es opcional).");
  }
  return notes;
}

// Compliance records summed: how much the reviews found and what the user did with it.
function complianceSummary(records) {
  const sum = (pick) => records.reduce((n, r) => n + (isNumber(pick(r)) ? pick(r) : 0), 0);
  const findings = { BLOCKER: sum((r) => r.findings && r.findings.BLOCKER), IMPORTANT: sum((r) => r.findings && r.findings.IMPORTANT), NIT: sum((r) => r.findings && r.findings.NIT) };
  const triage = { corregir: sum((r) => r.triage && r.triage.corregir), diferir: sum((r) => r.triage && r.triage.diferir), no_aplica: sum((r) => r.triage && r.triage.no_aplica) };
  const decided = triage.corregir + triage.diferir + triage.no_aplica;
  return {
    count: records.length,
    findings,
    triage,
    corrected: sum((r) => r.corrected),
    not_corrected: sum((r) => r.not_corrected),
    no_aplica_share: decided === 0 ? null : Math.round((triage.no_aplica / decided) * 100) / 100
  };
}

function summarize(projectRoot, opts) {
  const { exists, entries, compliance, skipped } = readMetrics(projectRoot);
  const selected = opts.last ? entries.slice(-opts.last) : entries;
  const gate = aggregate(selected.filter((e) => e.source !== "baseline"));
  const baseline = aggregate(selected.filter((e) => e.source === "baseline"));
  const complianceAgg = complianceSummary(compliance || []);
  const notes = exists ? reading(gate, baseline) : [];
  if (complianceAgg.no_aplica_share !== null && complianceAgg.no_aplica_share >= 0.5) {
    notes.push(`La mitad o más de los hallazgos de cumplimiento se marcaron "no aplica" (${Math.round(complianceAgg.no_aplica_share * 100)} %): revisar las reglas que los originan — una regla que casi nunca aplica es ruido para el implementer y el revisor.`);
  }
  return { file: METRICS_FILE.replace(/\\/g, "/"), exists, total: entries.length, shown: selected.length, skipped, entries: selected, gate, baseline, compliance: complianceAgg, complianceRecords: compliance || [], reading: notes };
}

function renderSummary(result) {
  if (!result.exists) return `metrics-report: no metrics yet (${result.file} does not exist) — the build coordinator appends one line per epic; \`--baseline --write\` reconstructs the epics before the gate.\n`;
  const out = [];
  out.push(`metrics-report: ${result.file} — ${result.total} epic(s)${result.shown !== result.total ? `, showing last ${result.shown}` : ""}${result.skipped ? `, ${result.skipped} malformed line(s) skipped` : ""}`);
  out.push("");
  // `rev` = the line's review_questions (its batch's figure; the aggregate counts it once per batch).
  out.push("epic | source | specs | Q | rev | R | c7 | mech | val | rnd | nctx | cap | blk | spec_def | rej m/M | sup | sup-loop | outcome");
  for (const e of result.entries) {
    const v = (x) => (x === null || x === undefined ? "-" : x);
    const rr = e.review_rejections || {};
    out.push(`${e.epic} | ${e.source || "gate"} | ${v(e.specs)} | ${v(e.open_questions)} | ${v(e.review_questions)} | ${v(e.resolved_alone)} | ${v(e.c7_rejections)} | ${v(e.mech_check_failures)} | ${v(e.validator_dispatches)} | ${v(e.gate_rounds)} | ${v(e.needs_context_spec)} | ${v(e.iteration_cap_spec)} | ${v(e.blocked_spec)} | ${v(e.reviewer_rejected_major_spec_defect)} | ${v(rr.minor)}/${v(rr.major)} | ${v(e.supersessions)} | ${v(e.supersede_loops)} | ${v(e.outcome)}`);
  }
  out.push("");
  for (const [label, agg] of [["gate", result.gate], ["baseline", result.baseline]]) {
    out.push(`${label}: ${agg.count} epic(s) · defectos aguas abajo/epic ${agg.downstream_defects ?? "-"} · spec_defect/epic ${agg.reviewer_rejected_major_spec_defect ?? "-"} · open_questions=0 en ${agg.zero_question_share === null ? "-" : Math.round(agg.zero_question_share * 100) + " %"} · c7/epic ${agg.c7_rejections ?? "-"} · tokens/epic ${agg.tokens ?? "-"}`);
    if (agg.batches > 0) {
      out.push(`${label} revisión: ${agg.batches} tanda(s) · preguntas/tanda ${agg.review_questions ?? "-"} (total ${agg.review_totals.review_questions ?? "-"}) · filtradas/tanda ${agg.review_filtered ?? "-"} · contactos/tanda ${agg.review_human_contacts ?? "-"} · late/tanda ${agg.late_questions ?? "-"} · premisas falsas/tanda ${agg.premises_false ?? "-"} · aparcados/epic ${agg.parked ?? "-"}`);
    }
  }
  if (result.compliance && result.compliance.count > 0) {
    const c = result.compliance;
    out.push(`cumplimiento: ${c.count} revisión(es) de milestone · hallazgos BLOCKER ${c.findings.BLOCKER} · IMPORTANT ${c.findings.IMPORTANT} · NIT ${c.findings.NIT} · triage corregir ${c.triage.corregir} / diferir ${c.triage.diferir} / no aplica ${c.triage.no_aplica} · corregidos ${c.corrected} · no corregidos ${c.not_corrected}`);
  }
  out.push("");
  out.push("Lectura (§6.5):");
  for (const note of result.reading) out.push(`- ${note}`);
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Baseline reconstruction
// ---------------------------------------------------------------------------

function gitLog(projectRoot, since) {
  try {
    const range = since ? [`${since}..HEAD`] : [];
    const out = execFileSync("git", ["log", "--format=%H%x09%cI%x09%s", ...range], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { ok: true, commits: lines(out).filter(Boolean).map((l) => { const [sha, date, ...subject] = l.split("\t"); return { sha, date, subject: subject.join("\t") }; }) };
  } catch {
    return { ok: false, commits: [] };
  }
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

function reviewsFor(projectRoot, epicSlug) {
  const files = walk(projectRoot, "docs/07-reviews").filter((rel) => path.posix.basename(rel).startsWith(`review-${epicSlug}-`) && rel.endsWith(".md"));
  return files.map((rel) => {
    const text = readText(projectRoot, rel) || "";
    const base = path.posix.basename(rel, ".md");
    // `review-<epic>-<spec>-pN-<fecha>.md` keeps an earlier pass of the same spec (EPIC_LOOP
    // Step 6): it counts for <spec>.
    const task = base.slice(`review-${epicSlug}-`.length).replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/-p\d+$/, "");
    const status = (text.match(REVIEW_STATUS) || [])[1] || null;
    const cause = (text.match(REVIEW_CAUSE) || [])[1] || null;
    const date = (base.match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || null;
    return { rel, task, status, cause: cause ? cause.toLowerCase() : null, date, text };
  });
}

// Distinct (spec, loop layer) pairs — one supersession-only loop per spec and per layer.
function distinctPairs(pairs) {
  return new Set(pairs.map(([a, b]) => `${a}\u0000${b}`)).size;
}

// `compilación` / `compilacion` / `Runtime` → one spelling per layer.
function loopLayer(value) {
  return String(value || "").toLowerCase().replace("compilacion", "compilación");
}

function planningCounters(projectRoot, epicSlug) {
  const text = readText(projectRoot, `docs/05-specs/${epicSlug}/_planning.md`);
  if (text === null) return null;
  const headers = parseVerdictHeaders(text);
  const rounds = headers.map((h) => h.ronda).filter((r) => typeof r === "number");
  const loops = parseSupersessionRegister(text).filter((r) => r.kind === "supersede" && r.loop);
  return {
    open_questions: countMatches(text, /^\s*-\s*Q-\d+\b/gm),
    resolved_alone: countMatches(text, /^\s*-\s*R-\d+\b/gm),
    mech_check_failures: countMatches(text, /MECH_CHECK:\s*FAIL\b/g),
    // No verdict header at all → not recorded (null), not zero.
    validator_dispatches: headers.length === 0 ? null : headers.filter((h) => !h.loop).length,
    validator_dispatches_loop: headers.length === 0 ? null : headers.filter((h) => h.loop).length,
    gate_rounds: rounds.length === 0 ? null : Math.max(...rounds),
    supersede_loops: distinctPairs(loops.map((r) => [r.slug, loopLayer(r.loop)])),
    c7_rejections: countMatches(text, /aclaraci[oó]n sin sustento/gi),
    validator_verdict: /STATUS:\s*\**\s*APPROVED/.test(text) ? "APPROVED" : null
  };
}

// `test(supersede): <epic>/<spec> — loop[:] <compilación|runtime> — …` subjects → distinct
// (spec, layer) pairs. A supersede commit without `loop` precedes the RED: it is no loop.
function supersedeLoopsFromGit(commits) {
  const pairs = [];
  for (const c of commits) {
    if (!/^test\(supersede\)/.test(c.subject) || !/\bloop\b/i.test(c.subject)) continue;
    const target = (c.subject.match(/^test\(supersede\):\s*(\S+)/) || [])[1] || "";
    const layer = (c.subject.match(/\bloop\b\s*:?\s*(compilaci[oó]n|runtime)?/i) || [])[1] || "";
    pairs.push([target, loopLayer(layer)]);
  }
  return distinctPairs(pairs);
}

// Both sources undercount (the register may predate v2.2, a loop may share a commit): the
// larger one wins; null only when neither could be read.
function maxOrNull(values) {
  const nums = values.filter((v) => typeof v === "number");
  return nums.length === 0 ? null : Math.max(...nums);
}

function reconstructEpic(projectRoot, epicSlug, epicState, commits, gitOk, pluginVersion) {
  const reviews = reviewsFor(projectRoot, epicSlug);
  const perTask = reviews.reduce((acc, r) => ({ ...acc, [r.task]: (acc[r.task] || 0) + 1 }), {});
  const major = reviews.filter((r) => r.status === "REJECTED_MAJOR");
  const specDefect = major.filter((r) => r.cause === "spec_defect");
  const heuristic = major.filter((r) => r.cause === null && /\bspec\b/i.test(r.text));
  const mine = commits.filter((c) => c.subject.includes(epicSlug));
  const planning = planningCounters(projectRoot, epicSlug);
  const specs = walk(projectRoot, `docs/05-specs/${epicSlug}`).filter((rel) => rel.endsWith(".spec.md")).length;
  const dates = reviews.map((r) => r.date).filter(Boolean).sort();
  const line = {
    ts: dates.length ? `${dates[dates.length - 1]}T00:00:00Z` : new Date().toISOString(),
    source: "baseline",
    plugin: pluginVersion || null,
    epic: epicSlug,
    specs: specs || null,
    planner_dispatches: null,
    open_questions: planning ? planning.open_questions : null,
    resolved_alone: planning ? planning.resolved_alone : null,
    c7_rejections: planning ? planning.c7_rejections : null,
    mech_check_failures: planning ? planning.mech_check_failures : null,
    validator_dispatches: planning ? planning.validator_dispatches : null,
    validator_dispatches_loop: planning ? planning.validator_dispatches_loop : null,
    gate_rounds: planning ? planning.gate_rounds : null,
    validator_verdict: planning ? planning.validator_verdict : null,
    needs_context_spec: null,
    iteration_cap_spec: Object.values(perTask).filter((n) => n >= 3).length,
    blocked_spec: gitOk ? mine.filter((c) => /^Revert "test\(/.test(c.subject)).length : null,
    reviewer_rejected_major_spec_defect: specDefect.length + heuristic.length,
    review_rejections: { minor: reviews.filter((r) => r.status === "REJECTED_MINOR").length, major: major.length },
    supersessions: gitOk ? mine.filter((c) => /^test\(supersede\)/.test(c.subject)).length : null,
    supersede_loops: maxOrNull([planning ? planning.supersede_loops : null, gitOk ? supersedeLoopsFromGit(mine) : null]),
    // v2.2.0 fields no artefact records before the gate ran: not reconstructible.
    gate_human_contacts: null,
    exec_human_contacts: null,
    planner_redispatch_after_approved: null,
    planner_dispatches_loop: null,
    supersede_tests: null,
    j9_regressions: null,
    exec_blocked_compile: null,
    exec_blocked_runtime: null,
    baseline_failures: null,
    late_findings: null,
    // v2.3.0 review-stage fields: the epic ran before any batch review.
    batch_id: null,
    review_rounds: null,
    review_questions: null,
    review_filtered: null,
    review_human_contacts: null,
    late_questions: null,
    parked: null,
    park_class: null,
    premises_false: null,
    outcome: epicState === "done" ? "DONE" : epicState === "in-progress" ? "ESCALATED" : "unknown",
    tokens: null
  };
  if (heuristic.length > 0) line.heuristic = true;
  return line;
}

function epicSlugsFor(projectRoot) {
  const roadmapText = readText(projectRoot, "docs/04-roadmap/ROADMAP.md");
  const roadmap = roadmapText === null ? { epics: [] } : parseRoadmap(roadmapText);
  const dirs = [...new Set(walk(projectRoot, "docs/05-specs").map((rel) => rel.split("/")[2]).filter((d) => d && !d.startsWith("_") && !d.endsWith(".md")))];
  return dirs.map((slug) => {
    const id = (slug.match(/(\d+\.\d+)/) || [])[1];
    const epic = id ? roadmap.epics.find((e) => e.id === id) : null;
    return { slug, state: epic ? epic.state : "unknown" };
  });
}

function baseline(projectRoot, opts, pluginVersion) {
  const git = gitLog(projectRoot, opts.since);
  const epics = epicSlugsFor(projectRoot).filter((e) => e.state === "done");
  const reconstructed = epics.map((e) => reconstructEpic(projectRoot, e.slug, e.state, git.commits, git.ok, pluginVersion));
  const existing = readMetrics(projectRoot).entries.map((e) => e.epic);
  const fresh = reconstructed.filter((line) => !existing.includes(line.epic));
  let written = 0;
  if (opts.write && fresh.length > 0) {
    const abs = path.join(projectRoot, METRICS_FILE);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.appendFileSync(abs, fresh.map((l) => JSON.stringify(l)).join("\n") + "\n");
    written = fresh.length;
  }
  return { gitOk: git.ok, epics: reconstructed, alreadyPresent: reconstructed.length - fresh.length, write: Boolean(opts.write), written, wouldWrite: opts.write ? 0 : fresh.length };
}

function renderBaseline(result) {
  const out = [`metrics-report --baseline: ${result.epics.length} closed epic(s) reconstructed${result.gitOk ? "" : " (git unavailable — git-derived fields are null)"}`];
  for (const e of result.epics) {
    const rr = e.review_rejections;
    out.push(`- ${e.epic}: specs ${e.specs ?? "-"} · Q ${e.open_questions ?? "-"} · R ${e.resolved_alone ?? "-"} · rej ${rr.minor}/${rr.major} · spec_defect ${e.reviewer_rejected_major_spec_defect}${e.heuristic ? " (heurístico)" : ""} · cap ${e.iteration_cap_spec} · blk ${e.blocked_spec ?? "-"} · sup ${e.supersessions ?? "-"} · ${e.outcome}`);
  }
  out.push(result.write ? `${result.written} line(s) appended to ${METRICS_FILE.replace(/\\/g, "/")} (${result.alreadyPresent} already present)` : `${result.wouldWrite} line(s) would be appended (${result.alreadyPresent} already present) — add --write to append`);
  return out.join("\n") + "\n";
}

if (require.main === module) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exit(2);
  }
  const projectRoot = opts.project ? path.resolve(opts.project) : findProjectRoot(process.cwd()) || process.cwd();
  let pluginVersion = null;
  try {
    pluginVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "plugin.json"), "utf8")).version;
  } catch {
    // optional
  }
  const result = opts.baseline ? baseline(projectRoot, opts, pluginVersion) : summarize(projectRoot, opts);
  if (!opts.baseline && result.skipped) process.stderr.write(`metrics-report: ${result.skipped} malformed line(s) skipped\n`);
  process.stdout.write(opts.json ? JSON.stringify(result, null, 2) + "\n" : opts.baseline ? renderBaseline(result) : renderSummary(result));
  process.exit(0);
}

module.exports = { METRICS_FILE, readMetrics, aggregate, reading, summarize, baseline, reconstructEpic, parseArgs };
