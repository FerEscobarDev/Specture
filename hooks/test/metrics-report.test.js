const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");
const report = require("../lib/metrics-report");

const scriptPath = path.resolve(__dirname, "..", "lib", "metrics-report.js");
const temporaryDirectories = [];

function write(root, rel, text) {
  const abs = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function createProject(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-metrics-"));
  temporaryDirectories.push(root);
  write(root, ".specture/stack.yml", "schema: 1\n");
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  return root;
}

function run(root, ...args) {
  const result = spawnSync(process.execPath, [scriptPath, "--project", root, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json: args.includes("--json") ? JSON.parse(result.stdout) : null };
}

function git(root, ...args) {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t.local", ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const line = (epic, extra = {}) =>
  JSON.stringify({
    ts: "2026-09-07T10:00:00Z", source: "gate", plugin: "1.18.0", epic, specs: 2, planner_dispatches: 2, open_questions: 1, resolved_alone: 6,
    c7_rejections: 0, mech_check_failures: 1, validator_dispatches: 3, validator_verdict: "APPROVED", needs_context_spec: 0, iteration_cap_spec: 0,
    blocked_spec: 0, reviewer_rejected_major_spec_defect: 0, review_rejections: { minor: 1, major: 0 }, supersessions: 0, outcome: "DONE", tokens: null, ...extra
  });

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("summary: per-epic table, aggregates split by source, --last, --json", () => {
  const root = createProject({
    "docs/.specture-meta/build-metrics.jsonl": [line("epic-0.9-old", { source: "baseline", open_questions: null, blocked_spec: 2, reviewer_rejected_major_spec_defect: 1 }), line("epic-1.1-a"), line("epic-1.2-b", { open_questions: 0 })].join("\n") + "\n"
  });
  const text = run(root);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /3 epic\(s\)/);
  assert.match(text.stdout, /^epic-1\.1-a \| gate \| 2 \| 1 \| - \| 6/m);
  assert.match(text.stdout, /^gate: 2 epic\(s\)/m);
  assert.match(text.stdout, /^baseline: 1 epic\(s\)/m);
  assert.match(text.stdout, /Bajan needs_context\/iteration_cap\/blocked por epic \(2 → 0\)/);

  const last = run(root, "--last", "1");
  assert.match(last.stdout, /showing last 1/);

  const { json } = run(root, "--json");
  assert.equal(json.gate.count, 2);
  assert.equal(json.baseline.count, 1);
  assert.equal(json.gate.downstream_defects, 0);
  assert.equal(json.baseline.downstream_defects, 2);
  assert.equal(json.gate.zero_question_share, 0.5);
  assert.ok(json.reading.length >= 2);
});

test("fail-open: no file → exit 0 with 'no metrics yet'; a malformed line is skipped with a warning", () => {
  const empty = run(createProject());
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /no metrics yet/);

  const root = createProject({ "docs/.specture-meta/build-metrics.jsonl": line("epic-1.1-a") + "\nnot json\n" });
  const { status, stderr, json } = run(root, "--json");
  assert.equal(status, 0);
  assert.match(stderr, /1 malformed line\(s\) skipped/);
  assert.equal(json.skipped, 1);
  assert.equal(json.total, 1);
});

test("reading rules: planner-does-not-ask (R1) and A6 (spec_defect rising) fire from the aggregates", () => {
  const gate = { count: 10, downstream_defects: 2, zero_question_share: 0.9, reviewer_rejected_major_spec_defect: 0.5, c7_rejections: 0.2, tokens: null };
  const baseline = { count: 10, downstream_defects: 2, reviewer_rejected_major_spec_defect: 0.1, tokens: null };
  const notes = report.reading(gate, baseline).join("\n");
  assert.match(notes, /el planner no pregunta \(R1\)/);
  assert.match(notes, /A6 — mantener dims 1-6 por spec/);
  assert.match(notes, /Regla de tokens: juicio/);
  assert.match(report.reading({ count: 0 }, baseline).join("\n"), /Sin epics con gate/);
});

// The v2.2.0 additive fields (all numeric) — a line may carry them or not.
const V22_FIELDS = [
  "gate_rounds", "gate_human_contacts", "exec_human_contacts", "planner_redispatch_after_approved",
  "validator_dispatches_loop", "planner_dispatches_loop", "supersede_loops", "supersede_tests", "j9_regressions",
  "exec_blocked_compile", "exec_blocked_runtime", "baseline_failures", "late_findings"
];

test("v2.2 fields: averaged like the other numeric fields; `effort` as an object does not break; old lines still work", () => {
  const v22 = (value) => Object.fromEntries(V22_FIELDS.map((k) => [k, value]));
  const root = createProject({
    "docs/.specture-meta/build-metrics.jsonl": [
      line("epic-0.9-old"),
      line("epic-1.1-a", { ...v22(2), gate_rounds: 2, supersede_loops: 1, effort: { planner: "high", validator: "medium" } }),
      line("epic-1.2-b", { ...v22(4), gate_rounds: 4, supersede_loops: 0 })
    ].join("\n") + "\n"
  });
  const { status, json, stderr } = run(root, "--json");
  assert.equal(status, 0, stderr);
  assert.equal(json.skipped, 0);
  assert.equal(json.gate.count, 3);
  for (const key of V22_FIELDS) assert.ok(key in json.gate, `aggregate carries ${key}`);
  assert.equal(json.gate.gate_rounds, 3, "the old line has no gate_rounds: it does not count as 0");
  assert.equal(json.gate.supersede_loops, 0.5);
  assert.equal(json.gate.late_findings, 3);
  assert.equal(json.gate.validator_dispatches, 3, "the v1.18 fields keep their mean");
  assert.deepEqual(json.entries[1].effort, { planner: "high", validator: "medium" });
  assert.ok(!("effort" in json.gate), "effort is not numeric: it is not averaged");

  const onlyOld = run(createProject({ "docs/.specture-meta/build-metrics.jsonl": line("epic-0.9-old") + "\n" }), "--json");
  assert.equal(onlyOld.status, 0);
  for (const key of V22_FIELDS) assert.equal(onlyOld.json.gate[key], null, key);
});

test("summary: the table gains the `rev`, `rnd` and `sup-loop` columns; old lines print `-`", () => {
  const root = createProject({
    "docs/.specture-meta/build-metrics.jsonl": [line("epic-0.9-old"), line("epic-1.1-a", { gate_rounds: 3, supersede_loops: 2, batch_id: "2026-09-29-cobros", review_questions: 5 })].join("\n") + "\n"
  });
  const { status, stdout } = run(root);
  assert.equal(status, 0);
  assert.match(stdout, /^epic \| source \| specs \| Q \| rev \| R \| c7 \| mech \| val \| rnd \| nctx \| cap \| blk \| spec_def \| rej m\/M \| sup \| sup-loop \| outcome$/m);
  assert.match(stdout, /^epic-1\.1-a \| gate \| 2 \| 1 \| 5 \| 6 \| 0 \| 1 \| 3 \| 3 \| 0 \| 0 \| 0 \| 0 \| 1\/0 \| 0 \| 2 \| DONE$/m);
  assert.match(stdout, /^epic-0\.9-old \| gate \| 2 \| 1 \| - \| 6 \| 0 \| 1 \| 3 \| - \| 0 \| 0 \| 0 \| 0 \| 1\/0 \| 0 \| - \| DONE$/m);
});

// The v2.3.0 review-stage fields. The six of the register's `## MÉTRICAS` line are per batch
// (every epic line of a batch may repeat them); `parked` / `park_class` are per epic.
const BATCH_FIELDS = ["review_rounds", "review_questions", "review_filtered", "review_human_contacts", "late_questions", "premises_false"];
const batchMetrics = (batch, values) => ({ batch_id: batch, ...Object.fromEntries(BATCH_FIELDS.map((k) => [k, values[k] ?? 0])) });

test("v2.3 review fields: counted once per batch_id (two epics of one batch with review_questions 6 count 6, not 12)", () => {
  const cobros = batchMetrics("2026-09-29-cobros", { review_rounds: 2, review_questions: 6, review_filtered: 1, review_human_contacts: 2, late_questions: 1, premises_false: 1 });
  const oneBatch = report.aggregate([
    JSON.parse(line("epic-2.1-a", { ...cobros, parked: 0 })),
    JSON.parse(line("epic-2.2-b", { ...cobros, parked: 1, park_class: "datos" }))
  ]);
  assert.equal(oneBatch.batches, 1);
  assert.equal(oneBatch.review_totals.review_questions, 6, "the batch counts once");
  assert.equal(oneBatch.review_questions, 6, "per batch, not per epic");
  assert.equal(oneBatch.review_totals.review_human_contacts, 2);

  // The first line of each batch carries its figures; per-batch mean 4 (6, 2), not the
  // per-epic mean 4.67 (6, 6, 2).
  const agenda = batchMetrics("2026-10-05-agenda", { review_rounds: 1, review_questions: 2, review_human_contacts: 1 });
  const root = createProject({
    "docs/.specture-meta/build-metrics.jsonl": [
      line("epic-0.9-old"),
      line("epic-2.1-a", { ...cobros, parked: 0 }),
      line("epic-2.2-b", { ...cobros, parked: 1, park_class: "datos" }),
      line("epic-3.1-c", { ...agenda, parked: 0 })
    ].join("\n") + "\n"
  });
  const { status, json, stderr } = run(root, "--json");
  assert.equal(status, 0, stderr);
  assert.equal(json.skipped, 0);
  assert.equal(json.gate.count, 4);
  assert.equal(json.gate.batches, 2);
  assert.equal(json.gate.review_questions, 4);
  assert.equal(json.gate.review_rounds, 1.5);
  assert.deepEqual(json.gate.review_totals, { review_rounds: 3, review_questions: 8, review_filtered: 1, review_human_contacts: 3, late_questions: 1, premises_false: 1 });
  assert.equal(json.gate.parked, 0.33, "per epic, over the lines that carry it");
  assert.equal(json.entries[2].park_class, "datos", "carried, never averaged");
  assert.ok(!("park_class" in json.gate) && !("batch_id" in json.gate));

  const text = run(root).stdout;
  assert.match(text, /^gate revisión: 2 tanda\(s\) · preguntas\/tanda 4 \(total 8\) · filtradas\/tanda 0\.5 · contactos\/tanda 1\.5 · late\/tanda 0\.5 · premisas falsas\/tanda 0\.5 · aparcados\/epic 0\.33$/m);

  // Lines written before v2.3.0: nothing breaks, no batch, the fields read null.
  const onlyOld = run(createProject({ "docs/.specture-meta/build-metrics.jsonl": line("epic-0.9-old") + "\n" }), "--json");
  assert.equal(onlyOld.status, 0);
  assert.equal(onlyOld.json.gate.batches, 0);
  for (const key of [...BATCH_FIELDS, "parked"]) assert.equal(onlyOld.json.gate[key], null, key);
  for (const key of BATCH_FIELDS) assert.equal(onlyOld.json.gate.review_totals[key], null, key);
  assert.doesNotMatch(run(createProject({ "docs/.specture-meta/build-metrics.jsonl": line("epic-0.9-old") + "\n" })).stdout, /revisión:/);
});

test("R1 (el planner no pregunta) counts open_questions + review_questions when the line carries batch_id", () => {
  const base = { open_questions: 0, blocked_spec: 2 };
  const baselineLine = line("epic-0.9-old", { source: "baseline", blocked_spec: 2 });
  const summary = (...gateLines) => report.summarize(createProject({ "docs/.specture-meta/build-metrics.jsonl": [baselineLine, ...gateLines].join("\n") + "\n" }), {});

  const noReview = summary(line("epic-2.1-a", base), line("epic-2.2-b", base));
  assert.equal(noReview.gate.zero_question_share, 1);
  assert.match(noReview.reading.join("\n"), /el planner no pregunta \(R1\)/);

  // The review stage asked the questions: the batch's review_questions count for each of its
  // epics — also for a line of the batch that does not repeat the figure.
  const reviewed = summary(line("epic-2.1-a", { ...base, batch_id: "2026-09-29-cobros", review_questions: 6 }), line("epic-2.2-b", { ...base, batch_id: "2026-09-29-cobros" }));
  assert.equal(reviewed.gate.zero_question_share, 0);
  assert.doesNotMatch(reviewed.reading.join("\n"), /el planner no pregunta/);
  assert.match(reviewed.reading.join("\n"), /aunque el planner pregunta/);

  // review_questions without batch_id is not a review-stage line: only open_questions counts.
  const loose = summary(line("epic-2.1-a", { ...base, review_questions: 6 }), line("epic-2.2-b", base));
  assert.equal(loose.gate.zero_question_share, 1);
  assert.match(loose.reading.join("\n"), /el planner no pregunta \(R1\)/);
  assert.equal(loose.gate.batches, 0);
  assert.match(loose.reading.join("\n"), /1 línea\(s\) con métricas de revisión \(review_\*\) sin batch_id/, "never dropped silently");
  assert.doesNotMatch(reviewed.reading.join("\n"), /sin batch_id/);

  // A batch whose review asked nothing and whose planner asked nothing is still R1.
  const silent = summary(line("epic-2.1-a", { ...base, batch_id: "2026-09-29-cobros", review_questions: 0 }), line("epic-2.2-b", { ...base, batch_id: "2026-09-29-cobros", review_questions: 0 }));
  assert.equal(silent.gate.zero_question_share, 1);
  assert.match(silent.reading.join("\n"), /el planner no pregunta \(R1\)/);
  assert.match(silent.reading.join("\n"), /open_questions \+ review_questions/);
});

test("reading rules: a planner re-dispatch after APPROVED and sustained gate rounds >= 3 fire", () => {
  const baseline = { count: 10, downstream_defects: 2, reviewer_rejected_major_spec_defect: 0.1, tokens: null };
  const gate = { count: 4, downstream_defects: 1, zero_question_share: 0.2, reviewer_rejected_major_spec_defect: 0.1, c7_rejections: 0, tokens: null, planner_redispatch_after_approved: 0.25, gate_rounds: 3.5 };
  const notes = report.reading(gate, baseline).join("\n");
  assert.match(notes, /planner_redispatch_after_approved > 0 \(0\.25 por epic\): el coordinador reabre APROBADOS/);
  assert.match(notes, /gate_rounds ≥ 3 sostenido \(3\.5 por epic\): revisar criterio del validador/);

  const calm = report.reading({ ...gate, planner_redispatch_after_approved: 0, gate_rounds: 2 }, baseline).join("\n");
  assert.doesNotMatch(calm, /reabre APROBADOS/);
  assert.doesNotMatch(calm, /criterio del validador/);
  const legacy = report.reading({ ...gate, planner_redispatch_after_approved: null, gate_rounds: null }, baseline).join("\n");
  assert.doesNotMatch(legacy, /reabre APROBADOS|criterio del validador/, "lines without the fields fire nothing");
});

test("--baseline: _planning.md separates gate from loop dispatches, takes the max round and counts (slug, loop) pairs", () => {
  const root = createProject({
    "docs/04-roadmap/ROADMAP.md": "### Milestone 1: M\n\n- [x] **Epic 1.1:** A\n  - **Dependencias:** Ninguna\n",
    "docs/05-specs/epic-1.1-a/01-x.spec.md": "# SPEC\n",
    "docs/05-specs/epic-1.1-a/02-y.spec.md": "# SPEC\n",
    "docs/05-specs/epic-1.1-a/_planning.md": [
      "# Planning",
      "",
      "## SUPERSESIONES",
      "- tests/a.test.js::t1 — motivo: BR-1 — spec: 01-x — commit: 1a2b3c4 — loop: runtime",
      "- tests/a.test.js::t2 — motivo: BR-1 — spec: 01-x — commit: 1a2b3c4 — loop: runtime",
      "- tests/b.test.js::t3 — motivo: BR-2 — spec: 02-y — commit: 5d6e7f8 — loop: compilación",
      "- tests/b.test.js::t4 — motivo: BR-2 — spec: 01-x — commit: 9a8b7c6 — loop: compilación",
      "- tests/c.test.js::t5 — motivo: BR-2 — spec: 02-y — commit: pendiente",
      "",
      "## VEREDICTOS",
      "### set — dispatch 1 — ronda 1 — 2026-09-28T10:00:00Z — tree aaaaaaaaaaaa — head bbbbbbbbbbbb",
      "```\nSTATUS: REJECTED\n```",
      "### set — dispatch 2 — ronda 2 — 2026-09-28T11:00:00Z — tree cccccccccccc — head dddddddddddd — delta",
      "```\nSTATUS: APPROVED\n```",
      "### 01-x — dispatch 3 — ronda 1 — 2026-09-29T09:00:00Z — tree eeeeeeeeeeee — head ffffffffffff — loop",
      "```\nSTATUS: APPROVED\n```",
      "### 02-y — dispatch 1 — 2026-09-24 (loop de corrección)",
      "```\nSTATUS: APPROVED\n```",
      ""
    ].join("\n")
  });
  const { json } = run(root, "--baseline", "--json");
  const e = json.epics[0];
  assert.equal(e.validator_dispatches, 2, "only the gate dispatches");
  assert.equal(e.validator_dispatches_loop, 2, "`— loop` and the legacy `(loop de corrección)`");
  assert.equal(e.gate_rounds, 2);
  assert.equal(e.supersede_loops, 3, "01-x/runtime, 02-y/compilación, 01-x/compilación");

  const legacy = createProject({
    "docs/04-roadmap/ROADMAP.md": "### Milestone 1: M\n\n- [x] **Epic 1.1:** A\n",
    "docs/05-specs/epic-1.1-a/01-x.spec.md": "# SPEC\n",
    "docs/05-specs/epic-1.1-a/_planning.md": "# Planning\n\n## VEREDICTOS\n### set — dispatch 1 — 2026-09-01\n```\nSTATUS: APPROVED\n```\n"
  });
  const old = run(legacy, "--baseline", "--json").json.epics[0];
  assert.equal(old.validator_dispatches, 1);
  assert.equal(old.validator_dispatches_loop, 0);
  assert.equal(old.gate_rounds, null, "legacy headers carry no round");
});

test("--baseline: supersede_loops from `test(supersede): … — loop …` subjects; a `-pN` review counts for its spec", () => {
  const root = createProject({
    "docs/04-roadmap/ROADMAP.md": "### Milestone 1: M\n\n- [x] **Epic 1.1:** A\n",
    "docs/05-specs/epic-1.1-a/01-x.spec.md": "# SPEC\n",
    "docs/07-reviews/review-epic-1.1-a-01-x-2026-09-01.md": "# Review\n\n**STATUS: REJECTED_MINOR**\n**CAUSE:** implementation\n",
    "docs/07-reviews/review-epic-1.1-a-01-x-p2-2026-09-01.md": "# Review\n\n**STATUS: REJECTED_MINOR**\n**CAUSE:** implementation\n",
    "docs/07-reviews/review-epic-1.1-a-01-x-2026-09-02.md": "# Review\n\n**STATUS: APPROVED**\n**CAUSE:** none\n"
  });
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "test(epic-1.1-a): RED 01-x");
  const commit = (file, subject) => {
    write(root, file, `// ${subject}\n`);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", subject);
  };
  commit("tests/a.test.js", "test(supersede): epic-1.1-a/01-x — tests/old.test.js::t (BR-1)");
  commit("tests/b.test.js", "test(supersede): epic-1.1-a/01-x — loop: runtime — tests/old.test.js::u (BR-1)");
  commit("tests/c.test.js", "test(supersede): epic-1.1-a/01-x — loop: runtime — tests/old.test.js::v (BR-1)");
  commit("tests/d.test.js", "test(supersede): epic-1.1-a/01-x — loop: compilación — tests/old.test.js::w (BR-1)");

  const e = run(root, "--baseline", "--json").json.epics[0];
  assert.equal(e.supersessions, 4);
  assert.equal(e.supersede_loops, 2, "01-x/runtime and 01-x/compilación");
  assert.equal(e.iteration_cap_spec, 1, "01-x has 3 reviews once `-p2` is folded into it");
  assert.deepEqual(e.review_rejections, { minor: 2, major: 0 });
});

test("--baseline reconstructs a closed epic from reviews, _planning.md and git; --write appends once", () => {
  const root = createProject({
    "docs/04-roadmap/ROADMAP.md": "### Milestone 1: M\n\n- [x] **Epic 1.1:** A\n  - **Dependencias:** Ninguna\n- [ ] **Epic 1.2:** B\n",
    "docs/05-specs/epic-1.1-a/01-x.spec.md": "# SPEC\n",
    "docs/05-specs/epic-1.1-a/02-y.spec.md": "# SPEC\n",
    "docs/05-specs/epic-1.2-b/01-z.spec.md": "# SPEC\n",
    "docs/05-specs/epic-1.1-a/_planning.md":
      "# Planning\n\n## OPEN_QUESTIONS\n- Q-1 — afecta: AC-1\n\n## RESOLVED_ALONE\n- R-1 — a\n- R-2 — b\n\n## MECH_CHECK\n- MECH_CHECK: FAIL aaa — 1\n- MECH_CHECK: PASS bbb — 2\n\n## VEREDICTOS\n### set — dispatch 1 — 2026-09-01\n```\nSTATUS: REJECTED\n- aclaración sin sustento\n```\n### set — dispatch 2 — 2026-09-01\n```\nSTATUS: APPROVED\n```\n",
    "docs/07-reviews/review-epic-1.1-a-01-x-2026-09-01.md": "# Review\n\n**STATUS: REJECTED_MAJOR**\n**CAUSE:** spec_defect\n",
    "docs/07-reviews/review-epic-1.1-a-01-x-2026-09-02.md": "# Review\n\n**STATUS: REJECTED_MAJOR**\n\nThe spec contradicts itself.\n",
    "docs/07-reviews/review-epic-1.1-a-01-x-2026-09-03.md": "# Review\n\n**STATUS: APPROVED**\n**CAUSE:** none\n",
    "docs/07-reviews/review-epic-1.1-a-02-y-2026-09-03.md": "# Review\n\n**STATUS: REJECTED_MINOR**\n**CAUSE:** implementation\n"
  });
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "test(epic-1.1-a): RED 01-x");
  write(root, "tests/x.test.js", "// red\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", 'Revert "test(epic-1.1-a): RED 01-x"');
  write(root, "tests/y.test.js", "// supersede\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "test(supersede): epic-1.1-a/02-y — tests/old.test.js::t (BR-1)");

  const { json } = run(root, "--baseline", "--json");
  assert.equal(json.gitOk, true);
  assert.equal(json.epics.length, 1, "only [x] epics");
  const e = json.epics[0];
  assert.equal(e.epic, "epic-1.1-a");
  assert.equal(e.source, "baseline");
  assert.equal(e.specs, 2);
  assert.equal(e.open_questions, 1);
  assert.equal(e.resolved_alone, 2);
  assert.equal(e.mech_check_failures, 1);
  assert.equal(e.validator_dispatches, 2);
  assert.equal(e.c7_rejections, 1);
  assert.equal(e.validator_verdict, "APPROVED");
  assert.deepEqual(e.review_rejections, { minor: 1, major: 2 });
  assert.equal(e.reviewer_rejected_major_spec_defect, 2, "one explicit CAUSE + one heuristic");
  assert.equal(e.heuristic, true);
  assert.equal(e.iteration_cap_spec, 1, "01-x has 3 reviews");
  assert.equal(e.blocked_spec, 1);
  assert.equal(e.supersessions, 1);
  assert.equal(e.outcome, "DONE");
  assert.equal(e.tokens, null);
  assert.equal(e.planner_dispatches, null);
  assert.equal(json.wouldWrite, 1);

  const first = run(root, "--baseline", "--write");
  assert.match(first.stdout, /1 line\(s\) appended/);
  const second = run(root, "--baseline", "--write");
  assert.match(second.stdout, /0 line\(s\) appended to .*build-metrics\.jsonl \(1 already present\)/);
  const stored = fs.readFileSync(path.join(root, "docs", ".specture-meta", "build-metrics.jsonl"), "utf8").trim().split("\n");
  assert.equal(stored.length, 1);
  assert.equal(JSON.parse(stored[0]).epic, "epic-1.1-a");

  const summary = run(root, "--json");
  assert.equal(summary.json.baseline.count, 1);
  assert.equal(summary.json.gate.count, 0);
});
