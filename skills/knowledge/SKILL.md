---
name: knowledge
description: 'Use to keep the project''s knowledge healthy. Four modes: `capture` (alias `/specture:learn`) — after an epic closes, a root cause is confirmed or on demand, turn session discoveries into durable artifacts (docs-index entries, ADR drafts, rules.yml entries, conventions patches), max 3 drafts with granular approval; `audit` (alias `/specture:audit-knowledge`) — detect docs-index drift (orphans, stale, duplicates, uncovered), read-only; `stats` — read the per-epic build metrics and apply the gate reading, read-only; `reconcile --component <slug>` / `characterize` — the living-behaviour file of one component from its [x] specs or from the code, Plan-mode approval. Never writes Claude''s personal memory.'
---

# Transversal — Knowledge Hygiene (capture + audit + stats + reconcile)

You manage the project's durable knowledge. Four modes, one domain (the `docs-index`, the repo's documentation truth, the living behaviour in `docs/05-specs/_current/`, and the evidence the build leaves behind):

- **`capture`** — convert ephemeral session knowledge into durable artifacts without polluting the repo with low-signal noise. (Was `/specture:learn`.)
- **`audit`** — detect and report the drift the index accumulates as docs are added/renamed/deleted. (Was `/specture:audit-knowledge`.)
- **`stats`** — read `docs/.specture-meta/build-metrics.jsonl` (one line per epic, tracked) and turn it into the gate's §6.5 reading.
- **`reconcile --component <slug>`** — build the living-behaviour file of **one** component from its `[x]` specs (lazy backfill of `_current/`, roadmap item 38); its variant **`characterize`** does it from the code when the component has no specs.

## Shared Iron Rules (all modes)

```
1. NEVER write to Claude's personal memory (~/.claude/projects/*/memory/).
   Personal-preference candidates are LISTED for the user, never written.
2. NEVER create or promote an ADR to Status: Accepted. AI-drafted ADRs are
   always `Proposed — awaiting team confirmation`; Proposed stays Proposed.
3. NEVER promote a docs-index entry `ai_categorized` → `user_confirmed`.
   Only a human does that.
4. Telemetry is FAIL-OPEN: if writing a .jsonl under docs/.specture-meta/
   fails, never fail the skill — note it and continue.
5. Restricted + budgeted: read the minimal artifact set. Capture caps at
   ~30K tokens per invocation.
```

## Mode selection

| Invoked as | Mode |
|---|---|
| `/specture:knowledge capture`, alias `/specture:learn`, "capturemos aprendizajes", build Step 8.5, debug Phase 4.5 exit, `--teach <concept>` | **capture** |
| `/specture:knowledge audit`, alias `/specture:audit-knowledge`, "audita el índice" | **audit** |
| `/specture:knowledge stats`, "¿cómo viene el gate?", "métricas del build" | **stats** |
| `/specture:knowledge reconcile --component <slug>`, "reconciliá el componente X", the warning `build` (Current-State Resolution) or `new-feature` prints, doctor `current-state-missing` / `current-state-partial` | **reconcile** |
| `/specture:knowledge characterize --component <slug>`, "caracterizá X desde el código" (Adopt / inherited code, no specs) | **reconcile** (variant `characterize`) |
| `/specture:knowledge` with no mode | Ask: *"¿capture (guardar lo aprendido), audit (revisar la salud del índice), stats (métricas del build) o reconcile (verdad viva de un componente)?"* |

---

## Where each mode lives (read lazily)

| Mode | File | Open it when |
|---|---|---|
| `capture` | `knowledge/CAPTURE.md` | The selection above resolved to capture |
| `audit` | this file, § "Mode: audit" | — |
| `stats` | this file, § "Mode: stats" | — |
| `reconcile` / `characterize` | `knowledge/RECONCILE.md` | The selection above resolved to reconcile |

The Shared Iron Rules and the Tone below apply to every mode, wherever its procedure lives.
---

# Mode: audit — periodic docs-index audit

You are an **Index Auditor**. The `docs-index.yml` accumulates drift silently as docs change. Catch it before it pollutes agent dispatches.

## Audit Iron Rules (additional to the shared rules)

```
1. READ-ONLY by default. Report findings; never mutate the index.
2. NEVER delete entries automatically. The user confirms.
```

## Required Inputs

- `.specture/docs-index.yml` (must exist — if not: *"No hay índice que auditar. Para generar uno, corré `/specture:setup-docs-bridge`."* and stop).
- `.specture/conventions.md` §11 `source_of_truth_dir` (fallback to the field inside the index).
- File-system access to walk the source-of-truth dir.

## Phase 1 — Load and Parse the Index

Read `.specture/docs-index.yml` once, full. Build `concept → entry`.

## Phase 2 — Detect Drift (4 checks)

- **Check 1 — Orphan:** `entry.file` missing on disk → **ORPHAN** (moved/renamed/deleted, index not updated).
- **Check 2 — Stale:** age = today − `last_verified`. >180d → **STALE**; >365d → **VERY STALE**. Missing/malformed `last_verified` → **UNKNOWN_AGE**.
- **Check 3 — Duplicate:** group by `tags` (frozenset) AND first 8 words of `read_when`. ≥2 in a group → **DUPLICATE_CANDIDATE** (user confirms).
- **Check 4 — Uncovered:** walk the source-of-truth dir for `.md`; a file matching no `entry.file` → **UNCOVERED**.

## Phase 3 — Severity (fixed)

| Finding | Severity |
|---|---|
| ORPHAN | HIGH (agents may read missing files) |
| DUPLICATE_CANDIDATE | MEDIUM (wastes context budget) |
| VERY STALE (>365d) | MEDIUM |
| STALE (>180d) | LOW |
| UNCOVERED | LOW (invisible to agents) |
| UNKNOWN_AGE | LOW |

## Phase 4 — Generate Reports

**Machine log** — append to `docs/.specture-meta/audit-history.jsonl` (create dir; fail-open):
```json
{"ts":"<ISO-8601>","total_entries":N,"orphans":[{"concept":"...","file":"..."}],"duplicates":[{"group":[...]}],"stale":{"180d":[...],"365d":[...]},"uncovered":["..."],"unknown_age":[...],"health_score":<0..100>}
```
`health_score = 100 − (orphans*10 + duplicates*5 + very_stale*3 + stale*1 + uncovered*2)`, floored at 0.

**Human report** — overwrite `docs/.specture-meta/last-audit.md`: a `# Knowledge Index Audit — YYYY-MM-DD` with the health score, a Resumen (counts per finding type), and an "Acciones sugeridas" section per severity (HIGH orphans → delete entry or fix path; MEDIUM duplicates → consolidate manually with `superseded_by`; stale → re-read, validate `read_when`/`tags`, refresh `last_verified`; uncovered → run `knowledge capture` or add manually; unknown age → add `last_verified`). Close with: if health <70, suggest a `/specture:setup-docs-bridge` refresh; if many uncovered, suggest `knowledge capture`. **Never auto-apply any of these.**

## Phase 5 — Report to User

```
Audit completo. Health: <N>/100.
  Orphans (HIGH):      <K>    Duplicates (MEDIUM): <M>
  Stale:               <S> (<a> >365d, <b> >180d)
  Uncovered:           <U>    Unknown age:        <X>
Reporte: docs/.specture-meta/last-audit.md · Log: audit-history.jsonl
Acción:  >85 "índice saludable, re-correr en 1-3 meses" · 60-85 "limpieza menor (HIGH+MEDIUM)" · <60 "drift significativo → refresh con /specture:setup-docs-bridge"
```

## Audit — Verification Before Exit

- [ ] `last-audit.md` written + `audit-history.jsonl` appended (or fail-open noted).
- [ ] **NO changes to `.specture/docs-index.yml`** (read-only by contract). **NO ADR status changes.**
- [ ] Summary reported with health score.

## Audit — What this mode does NOT do

- ❌ Auto-fix orphans / auto-consolidate duplicates / re-index uncovered (use `knowledge capture` or `setup-docs-bridge`).
- ❌ Promote `ai_categorized` → `user_confirmed` · refresh `last_verified` itself (only humans) · touch source-of-truth files.

---

# Mode: stats — build metrics reader (roadmap item 34)

Read-only. Turns the per-epic telemetry the build coordinator appends to
`docs/.specture-meta/build-metrics.jsonl` (tracked in git) into the reading
the Spec Planning Gate was designed to be judged by (`docs/spec-planning-gate-design.md`
§6.5).

## Stats — Inputs

- `docs/.specture-meta/build-metrics.jsonl` — may not exist yet (that is a valid answer, not an
  error).
- Optional: `--last N` (only the last N epics), `--baseline` (see below).

## Stats — Procedure

1. Run the reader and print its output **verbatim**:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/metrics-report.js" --project . [--last N]
   ```
   It prints one row per epic, the aggregates split by `source` (`gate` vs `baseline`) and
   the §6.5 reading: defects downstream (`needs_context_spec` + `iteration_cap_spec` +
   `blocked_spec`) falling → the gate catches real ambiguity; not falling with
   `open_questions ≈ 0` → the planner does not ask (fix the planner, not the validation);
   `reviewer_rejected_major_spec_defect` rising → keep validating per spec (decision A6);
   `c7_rejections` high → harden the planner's Step 4; tokens → the user's judgment (no
   harness; the `tokens` field is optional). It also reads the convergent gate:
   `gate_rounds` (≥3 sustained → review the validator's criteria, not the planner),
   `planner_redispatch_after_approved > 0` (the coordinator is reopening APPROVED verdicts —
   a process defect), gate vs loop dispatches (`validator_dispatches` /
   `validator_dispatches_loop`), `supersede_loops` and `supersede_tests` (supersessions found
   in execution instead of in the gate — expected, and cheap), `j9_regressions` (old tests
   the loop sent back to the implementer), `exec_blocked_compile` / `exec_blocked_runtime`,
   `baseline_failures`, and `gate_human_contacts` vs `exec_human_contacts` (the goal is
   contacts in the gate only). It also reads the review stage
   (`build/REVIEW_STAGE.md`): lines of a reviewed batch carry `batch_id`, and the register's
   figures — `review_rounds`, `review_questions`, `review_filtered`, `review_human_contacts`,
   `late_questions`, `premises_false` — are counted **once per batch** (a `gate revisión:` line
   with the per-batch means and the question total; the table's `rev` column is the batch's
   `review_questions` repeated on each of its epics); `parked` / `park_class` are per epic
   (`aparcados/epic`). R1 counts `open_questions + review_questions` on a line with `batch_id`:
   under the review stage the questions are asked in the sitting, not in the epic's gate. Review
   figures on a line without `batch_id` are not counted and the reading says so. It also reads the compliance reviews: one `kind: "compliance"` record per milestone report
   (written by `compliance.js record` after the triage) — never an epic, never a malformed line —
   summed into a `cumplimiento:` line (findings by severity, the user's triage, corrected and not
   corrected). When half or more of the decided findings were "no aplica", the reading flags it:
   the rules behind them are noise for the implementer and the reviewer. Each epic
   line carries `coordinator_mode` (`subagent` | `inline`; a line without it is unknown, not
   inline — the table's `mode` column, a `gate modo del coordinador:` line with the count per
   mode) and `epic_coordinator_dispatches` (averaged per epic), and `parked` is always written (0|1).
2. **No file yet** → say so and offer the baseline: *"No hay métricas todavía. ¿Reconstruyo
   el baseline de los epics cerrados antes del gate (`--baseline --write`)?"* On yes:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/metrics-report.js" --project . --baseline --write
   ```
   It reconstructs one `source: "baseline"` line per `[x]` epic from what is mechanical —
   review verdicts and `CAUSE:` in `docs/07-reviews/`, `_planning.md` counters when present,
   RED / revert / `test(supersede)` commits — with `null` for what cannot be recovered and
   `heuristic: true` when an old review's `spec_defect` was inferred from its text. Commit
   the file (`docs(metrics): baseline — N epics`).
3. Close with one recommendation per firing rule, in the user's words. Never edit the file
   by hand, never "fix" a line; a suspicious line is reported, not rewritten.

## Stats — What this mode does NOT do

- ❌ Write metrics for gate epics (only the build coordinator appends those) · ❌ delete or
  rewrite lines · ❌ decide A6 by itself (it reports the signal; the user decides).

---

---

## Tone (all modes)

Direct, concrete, file-path/numeric-citing. No fluff. In capture, make the Plan-mode preview crisp; in audit, surface drift and let the user act; in reconcile, the proposed file **is** the preview — show it whole, then the supersessions.

