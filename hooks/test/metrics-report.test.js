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
  assert.match(text.stdout, /^epic-1\.1-a \| gate \| 2 \| 1 \| 6/m);
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
