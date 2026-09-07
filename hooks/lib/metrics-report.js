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

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { lines, readText, walk, parseRoadmap } = require("./doctor/project");
const { REVIEW_STATUS } = require("./doctor/checks/corpus");
const { findProjectRoot } = require("./specture-guard");

const METRICS_FILE = path.join("docs", ".specture-meta", "build-metrics.jsonl");
const REVIEW_CAUSE = /CAUSE:\s*\**\s*(none|implementation|spec_defect|architecture)/i;
const NUMERIC = [
  "specs", "planner_dispatches", "open_questions", "resolved_alone", "c7_rejections", "mech_check_failures",
  "validator_dispatches", "needs_context_spec", "iteration_cap_spec", "blocked_spec",
  "reviewer_rejected_major_spec_defect", "supersessions"
];

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
  if (text === null) return { exists: false, entries: [], skipped: 0 };
  const entries = [];
  let skipped = 0;
  for (const line of lines(text)) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === "object" && obj.epic) entries.push(obj);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { exists: true, entries, skipped };
}

function mean(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  return nums.length === 0 ? null : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function aggregate(entries) {
  const out = { count: entries.length };
  for (const key of NUMERIC) out[key] = mean(entries.map((e) => e[key]));
  out.review_major = mean(entries.map((e) => e.review_rejections && e.review_rejections.major));
  out.review_minor = mean(entries.map((e) => e.review_rejections && e.review_rejections.minor));
  const withQuestions = entries.filter((e) => typeof e.open_questions === "number");
  out.zero_question_share = withQuestions.length === 0 ? null : Math.round((withQuestions.filter((e) => e.open_questions === 0).length / withQuestions.length) * 100) / 100;
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
    else if (gate.zero_question_share !== null && gate.zero_question_share >= 0.8) notes.push(`No bajan (${before} → ${after}) y open_questions ≈ 0 en el ${Math.round(gate.zero_question_share * 100)} % de los epics: el planner no pregunta (R1). Corregir el planner (criterio de escalado, escenarios 1 y 5), no agregar validación.`);
    else notes.push(`No bajan (${before} → ${after}) aunque el planner pregunta: revisar los OPEN_QUESTIONS convertidos y los C7 antes de tocar el gate.`);
  }
  if (gate.reviewer_rejected_major_spec_defect !== null) {
    const b = baseline.reviewer_rejected_major_spec_defect;
    if (b !== null && gate.reviewer_rejected_major_spec_defect > b) notes.push(`reviewer_rejected_major_spec_defect sube (${b} → ${gate.reviewer_rejected_major_spec_defect}): decisión A6 — mantener dims 1-6 por spec, no consolidar en un dispatch de set.`);
    else if (b !== null) notes.push(`reviewer_rejected_major_spec_defect no sube (${b} → ${gate.reviewer_rejected_major_spec_defect}): A6 puede consolidar dims 1-6 en el dispatch de set cuando haya ~10 epics.`);
  }
  if (gate.c7_rejections !== null && gate.c7_rejections >= 1) notes.push(`c7_rejections alto sostenido (${gate.c7_rejections} por epic): el planner cita mal — endurecer su Step 4.`);
  if (gate.tokens !== null && baseline.tokens !== null) {
    notes.push(gate.tokens > baseline.tokens ? `Tokens por epic suben (${baseline.tokens} → ${gate.tokens}): si los defectos bajan menos de lo que cuesta, ajustar 4a (más fast path mecánico) antes de tocar el gate.` : `Tokens por epic no suben (${baseline.tokens} → ${gate.tokens}).`);
  } else {
    notes.push("Regla de tokens: juicio del usuario (sin harness de medición; el campo `tokens` es opcional).");
  }
  return notes;
}

function summarize(projectRoot, opts) {
  const { exists, entries, skipped } = readMetrics(projectRoot);
  const selected = opts.last ? entries.slice(-opts.last) : entries;
  const gate = aggregate(selected.filter((e) => e.source !== "baseline"));
  const baseline = aggregate(selected.filter((e) => e.source === "baseline"));
  return { file: METRICS_FILE.replace(/\\/g, "/"), exists, total: entries.length, shown: selected.length, skipped, entries: selected, gate, baseline, reading: exists ? reading(gate, baseline) : [] };
}

function renderSummary(result) {
  if (!result.exists) return `metrics-report: no metrics yet (${result.file} does not exist) — the build coordinator appends one line per epic; \`--baseline --write\` reconstructs the epics before the gate.\n`;
  const out = [];
  out.push(`metrics-report: ${result.file} — ${result.total} epic(s)${result.shown !== result.total ? `, showing last ${result.shown}` : ""}${result.skipped ? `, ${result.skipped} malformed line(s) skipped` : ""}`);
  out.push("");
  out.push("epic | source | specs | Q | R | c7 | mech | val | nctx | cap | blk | spec_def | rej m/M | sup | outcome");
  for (const e of result.entries) {
    const v = (x) => (x === null || x === undefined ? "-" : x);
    const rr = e.review_rejections || {};
    out.push(`${e.epic} | ${e.source || "gate"} | ${v(e.specs)} | ${v(e.open_questions)} | ${v(e.resolved_alone)} | ${v(e.c7_rejections)} | ${v(e.mech_check_failures)} | ${v(e.validator_dispatches)} | ${v(e.needs_context_spec)} | ${v(e.iteration_cap_spec)} | ${v(e.blocked_spec)} | ${v(e.reviewer_rejected_major_spec_defect)} | ${v(rr.minor)}/${v(rr.major)} | ${v(e.supersessions)} | ${v(e.outcome)}`);
  }
  out.push("");
  for (const [label, agg] of [["gate", result.gate], ["baseline", result.baseline]]) {
    out.push(`${label}: ${agg.count} epic(s) · defectos aguas abajo/epic ${agg.downstream_defects ?? "-"} · spec_defect/epic ${agg.reviewer_rejected_major_spec_defect ?? "-"} · open_questions=0 en ${agg.zero_question_share === null ? "-" : Math.round(agg.zero_question_share * 100) + " %"} · c7/epic ${agg.c7_rejections ?? "-"} · tokens/epic ${agg.tokens ?? "-"}`);
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
    const task = base.slice(`review-${epicSlug}-`.length).replace(/-\d{4}-\d{2}-\d{2}$/, "");
    const status = (text.match(REVIEW_STATUS) || [])[1] || null;
    const cause = (text.match(REVIEW_CAUSE) || [])[1] || null;
    const date = (base.match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || null;
    return { rel, task, status, cause: cause ? cause.toLowerCase() : null, date, text };
  });
}

function planningCounters(projectRoot, epicSlug) {
  const text = readText(projectRoot, `docs/05-specs/${epicSlug}/_planning.md`);
  if (text === null) return null;
  return {
    open_questions: countMatches(text, /^\s*-\s*Q-\d+\b/gm),
    resolved_alone: countMatches(text, /^\s*-\s*R-\d+\b/gm),
    mech_check_failures: countMatches(text, /MECH_CHECK:\s*FAIL\b/g),
    validator_dispatches: countMatches(text, /^###\s.*\bdispatch\s+\d+/gm) || null,
    c7_rejections: countMatches(text, /aclaraci[oó]n sin sustento/gi),
    validator_verdict: /STATUS:\s*\**\s*APPROVED/.test(text) ? "APPROVED" : null
  };
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
    validator_verdict: planning ? planning.validator_verdict : null,
    needs_context_spec: null,
    iteration_cap_spec: Object.values(perTask).filter((n) => n >= 3).length,
    blocked_spec: gitOk ? mine.filter((c) => /^Revert "test\(/.test(c.subject)).length : null,
    reviewer_rejected_major_spec_defect: specDefect.length + heuristic.length,
    review_rejections: { minor: reviews.filter((r) => r.status === "REJECTED_MINOR").length, major: major.length },
    supersessions: gitOk ? mine.filter((c) => /^test\(supersede\)/.test(c.subject)).length : null,
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
