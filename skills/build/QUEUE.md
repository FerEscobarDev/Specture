# Build — The Queue (coordinator chat)

Companion of `skills/build/SKILL.md`. Read it **before processing the first epic** of a session:
it is the procedure this chat runs — build the queue, dispatch one epic coordinator at a time,
process each `EPIC_REPORT`, write the metrics line when the coordinator cannot. The per-epic
planning of an unreviewed epic is `build/PLANNING_GATE.md`; everything between an epic's lock
and its `[x]` is `build/EPIC_COORDINATOR.md` (dispatched, never run here).

## Contents

| Section | When you need it |
|---|---|
| The queue loop | Start of the session: N, dependencies, review stage, lock, drain order |
| Epic execution — the epic coordinator | The dispatch prompt, waiting without polling, inline mode |
| Processing the `EPIC_REPORT` | `DONE` · `PARKED` · `MINI_REVIEW` · `VISUAL_PENDING` · `STOPPED` · `NESTING_UNAVAILABLE` |
| Step 1 — Pick & Lock · Resuming a `[/]` epic | An orphaned `[/]` from a dead session, before building the queue |
| Step 8.5 — Capture Learnings | After an epic's `[x]` (opt-in; once per batch when N > 1) |
| Step 8.7 — Milestone Reconciliation | The epic just closed its milestone |
| Metrics | The JSON line schema (`build-metrics.jsonl`) |
| Why this model | Rationale — read once |

## The queue loop (in this coordinator chat)

1. Read **only the epic checkbox + `Dependencias` lines** of `ROADMAP.md` (not the whole doc).
2. Build the **queue**: walk the ROADMAP in stable order (earliest epics first) and collect the first **N** epics that will be runnable in dependency order — an epic whose only unmet dependency is an earlier queue member is eligible (it simply runs after it).
3. If no epic is ready and none can be made ready within the queue → dependency cycle, or everything is blocked by an escalated epic. Stop and escalate to the user.
4. `TaskCreate` **one task per queued epic** (subject `<epic-slug>`, `activeForm` "queued"). This is the visible queue; each epic-agent's internal step tracking is discarded with its context.
4.5. **Review stage for the batch** — `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review.js" status`. Unless a `CLOSED` register already covers every queued epic, run `build/REVIEW_STAGE.md` for the queue **before** executing anything: one sitting (two rounds at most) where the user takes every decision the machine can foresee; then the queue runs without questions. An epic the review did not cover (a register from before v2.3.0, or the user declined the review for it) goes through the per-epic Spec Planning Gate (`build/PLANNING_GATE.md`), unchanged.
5. **Process the queue one epic at a time** (never concurrently). For each epic, in order:
   1. Mark the epic `[/]` in `ROADMAP.md`; commit (`docs(roadmap): <epic-slug> en curso [/]`, only `ROADMAP.md`). Only ONE epic is `[/]` at any moment. That commit is the epic's **`LOCK_SHA`**: it is recorded as `- LOCK_SHA: <sha> — <ISO-8601>` under `## SPEC_SHA` of `_planning.md` — by you as soon as the file exists in the per-epic gate, by the epic coordinator otherwise.
   2. Set that epic's task `in_progress`.
   3. If the epic is in a `CLOSED` review register → dispatch the **epic coordinator** (below) with `ENTRY: refresh` — it refreshes, seals and executes without questions; otherwise run the **Spec Planning Gate** (`build/PLANNING_GATE.md`) and, when it completes (specs committed, `SPEC_SHA` recorded), dispatch it with `ENTRY: sealed`. Its `BASE_CONTEXT` is the paths of `.specture/stack.yml`, `.specture/conventions.md`, the ADRs, `docs/01-requirements/business_requirements.md` and `docs/02-architecture/architecture.md` — it reads them and assembles the epic-agent's context itself. Wait for its `EPIC_REPORT` (never poll).
   4. Process the `EPIC_REPORT` (below) before starting the next epic.
6. **Stop when the queue drains** (N epics processed) or a report escalates. Do not pull epics beyond N. Then, **in this order** (each one once, for the whole batch — never between epics):
   1. List the **parked** epics with their pending decision and mark `ESTADO: EJECUTADA` in the review register when every epic is `[x]` or parked.
   2. The `## DIFERIDOS` lines with `dueño: sin epic` (each one a possible `new-feature`).
   3. **Compliance triage** — `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" status`; `PENDING` and no epic `[/]` → run `skills/compliance-review/SKILL.md` in `triage` mode (the user decides each finding; the chosen refactors are corrected by its correction agent — never by you). An epic `[/]` (an escalation stopped the queue) leaves it `PENDIENTE` for the next drain.
   4. Step 8.5 (knowledge capture), when N > 1.
   5. If a session branch was created (§13), announce it **last** — so it includes the compliance corrections — and suggest the merge/PR per `W-4`. Specture does not merge for you.

## Epic execution — the epic coordinator

Everything that happens to one epic between its lock and its `[x]` — Refresh & seal, the
announced mini-review, parking, the epic-agent and every report it sends back (the supersession
loop, the spec-correction loop, the red-fix), the seal release and the metrics line — is
`build/EPIC_COORDINATOR.md`. You do not run it in this chat: you dispatch it.

**Dispatch** (Claude Code) a general-purpose agent with **`model: opus`, `effort: medium`** (it orchestrates — dozens of tool calls per epic, each paying the effort; the judgement lives in the
workers it dispatches, which carry their own `effort`) and this prompt, nothing of this chat's
history:

~~~
You are the epic coordinator for ONE epic of a Specture project. Your complete procedure is
${CLAUDE_PLUGIN_ROOT}/skills/build/EPIC_COORDINATOR.md (read it whole). You never ask the user anything: every human decision
goes back to me as an EPIC_REPORT of at most 40 lines.
ENTRY: refresh | sealed | resume | mini-review-answers | visual-adjust
EPIC: <full epic block>
LOCK_SHA: <sha> · REVIEW_REGISTER: <path | none> · REGULATORIO: <sí | no>
SPEC_SHA / GATE_METRICS (ENTRY: sealed) · ANSWERS (mini-review-answers) · VISUAL_FEEDBACK (visual-adjust) · DECISION (resume after STOPPED — gate | decisión)
HUMAN_CONTACTS: <n> · BASE_CONTEXT: <paths>
~~~

Launch it as a **foreground** `Agent` call when you can (one turn, the `EPIC_REPORT` in its reply) or in the background and **wait for its notification — never poll, never `sleep`, and never give it a time budget**: a dispatch has no time limit, and a coordinator told to "cut at ~55 min" re-dispatched itself ten times for one epic (Psikora HC-IHCE.14), each time re-reading the planning file. One epic coordinator at a time, and nothing else writes while it runs. If the user writes meanwhile, answer them (a read-only look at `git log` is fine). A dispatch that never comes back — the user says it stalled, or the session was cut — is resumed with `ENTRY: resume`, never by running its steps here.

**Inline mode.** When the session has no nested subagents (Antigravity without `invoke_subagent`), or when the epic coordinator
answers `NESTING_UNAVAILABLE`, run `build/EPIC_COORDINATOR.md` yourself, here, exactly as written
(skip its Step 0; `coordinator_mode: inline`). It is the v2.6 behaviour with the procedure in its
own file: one source of truth, two possible runners. Say it once per batch: *"sin subagentes
anidados — el coordinador de cada epic corre en este chat"*.

## Processing the EPIC_REPORT

The report is short on purpose; the evidence is on disk. Do not re-read the epic's verdicts or
diffs unless the status below asks for it.

- **`DONE`** → confirm the `[x]` with `git log -1 -- docs/04-roadmap/ROADMAP.md` and that
  `.specture/state/build-locked.json` is gone; mark the epic's task `completed`; relay the
  `SUMMARY` in two or three lines; run Step 8.7 if the epic closed its milestone; next epic.
- **`PARKED`** → relay the pending decision in one line; continue the queue with the epics that do
  not depend on it (the honest limit: in an almost linear chain, parking one epic usually stops
  the rest). The parked epics are listed again when the queue drains.
- **`MINI_REVIEW`** → the announced mini-review of a regulatory epic found new decisions. Ask the
  questions **verbatim** with the rules of round 2 of `build/REVIEW_STAGE.md` (by theme, ≤4 per
  `AskUserQuestion` call, the recommended option never by default); record them under
  `### Mini-revisión <X.Y>` of the register (the `A-n` numbering continues the register's), add
  them to `## DECISIONES PERSISTIDAS`, persist rule/ADR/contract answers in place with
  `(aclarado en revisión <id>, <fecha>)`, commit the sources and the register
  (`docs(requirements): decisiones de la mini-revisión <X.Y> — revisión <id>`), and dispatch the
  epic coordinator again with `ENTRY: mini-review-answers`, the
  `ANSWERS` and `HUMAN_CONTACTS` + 1.
- **`VISUAL_PENDING`** (design-system foundation epic) → **you run the Visual Approval Gate.**
  1. **Show it.** If the Playwright MCP is available in this session, start the app with the dev command the report names, navigate to the showcase route and capture screenshots so the user reviews without leaving the chat. If it is not available, give the user the command and the route and ask them to open it.
  2. **Ask, verbatim:** *"¿Apruebas el design system para construir las páginas sobre esta base, o quieres ajustes?"* Ask this **before** surfacing any advisory finding (screenshot critique, lint warnings). A list of defects presented alongside the question turns advice into a veto — advisory output goes after an approval, as the next epic's to-do list.
  3. **Adjustments** → dispatch the epic coordinator again with `ENTRY: visual-adjust` and the user's feedback verbatim as `VISUAL_FEEDBACK` (it dispatches a fresh epic-agent; you never dispatch `ux-implementer` yourself). Repeat from 1, counting the rounds.
  4. **On approval** → append `VISUAL_APPROVAL: <fecha> <sha>` to the epic's `_planning.md` (`<sha>` is HEAD at approval) **and** set the line `- **Aprobación visual:** <sha12> — <ISO-8601> — epic <X.Y>` under § 1 Dirección of `docs/03-ux-ui/design_system.md` (replace `sin aprobar`; this is the durable record — the `_planning.md` is deleted when the milestone closes, and C-design accepts either), flip the epic to `[x]` in `ROADMAP.md`, commit both in one commit, release the seal (`seal-cli.js release`) and mark the task `completed`. Then write the epic's metrics line yourself from the counters the last `EPIC_REPORT` carried (the epic coordinator does not write it for a visual-pending epic), with `outcome: DONE` plus `visual_approval_rounds: N`.
  5. **Outright rejection** (the user wants a different direction, not adjustments) → that is a Phase 03 decision, not an epic defect: leave the epic `[/]`, stop the queue and escalate to `ux-design`.
- **`STOPPED — <motivo>`** → escalate to the user with the report's evidence and its closed
  options when it brings them; **stop the queue** until they decide:
  - `scope-changed` → run R1-R5 of `build/REVIEW_STAGE.md` for this one epic (the only case where
    a non-regulatory epic asks), then dispatch again with `ENTRY: refresh`;
  - `gate` (the refresh's cap) → the single closed question of step 5 of `build/PLANNING_GATE.md` with the options the
    report pre-built; dispatch again with `ENTRY: resume` and the chosen option as `DECISION:`;
  - `seal-diff` → show the diff summary; a `[x]` that landed is reverted only on the user's word;
  - `protected` → amending a project invariant is the user's decision;
  - `entorno` → the log; no agent can fix it · `debug <slug>` → offer `/specture:debug` for that
    spec (it needs Plan mode) · `insufficient context` → offer to split the epic ·
    `REJECTED_MAJOR` / other → the summary;
  - `decisión` (a correction loop of a regulatory epic needs a human answer) → ask it with the
    rules of round 2, persist it as in `MINI_REVIEW`, and dispatch again with `ENTRY: resume` and
    the answer as `DECISION:`;
  - `reanudación` → the evidence it found; ask which way to continue.
  After the decision, dispatch the epic coordinator again with `ENTRY: resume` (or `refresh`),
  never by running its steps yourself.
- **`NESTING_UNAVAILABLE`** → switch the rest of the batch to inline mode (above) and run this
  epic's `build/EPIC_COORDINATOR.md` from its Step 1 with the same `ENTRY`.
- **A notification that is not an `EPIC_REPORT`** (a late message from a nested dispatch) → it is
  the epic coordinator's business, not yours: note it and keep waiting for the report.

## Step 1 — Pick & Lock the Epic

Done by the **coordinator** in the queue loop (`build/QUEUE.md` step 5.1): when an epic-agent starts, its epic is already `[/]` and committed. Epic-agents never run this step. If more than one epic is `[/]`, that is a stale state — the coordinator asks the user which one to continue before dispatching anything.

### Resuming a `[/]` epic (crash recovery — evidence on disk, not inference)

The queue only takes `[ ]` epics, so an orphaned `[/]` from a dead session is resumed
here, by evidence, before building the queue:

- **A review register `OPEN`** (`review.js status`) → the batch sitting was cut: resume
  `build/REVIEW_STAGE.md` at its state, asking only the pending items.
- **Exactly one `[/]` that belongs to a `CLOSED` review register, or whose specs are sealed**
  (`_planning.md` records `APPROVED` as the last verdict of the set and of every spec, a
  `MECH_CHECK: PASS` and a `SPEC_SHA`), **or a seal with `lifted_spec_paths`** (a loop was
  interrupted) → dispatch the epic coordinator with `ENTRY: resume`: it decides by the evidence
  on disk where to re-enter (its Step R) — a usage limit or a closed session costs one
  dispatch, never a re-plan. Never resume its loops or its epic-agent yourself. A resumed epic
  is finished **before** the queue is built and does not count toward N; with a `CLOSED` register,
  its remaining `EPICS` are the batch.
- **A last verdict `REJECTED` on supersession grounds recorded before v2.2.0** (`doctor`
  flags it as `gate-legacy-rejection`) → re-validate that target in `MODE: DELTA`: its
  supersession findings are `RETIRADO` now.
- **One `[/]` outside a review register with specs only in staging / the working tree**
  (planning was interrupted before the commit) → they are not validated. **Ask the user**:
  discard and re-plan, or resume from the validation step with what is there. Never discard
  files without asking.
- **One `[/]` outside a review register with no specs** → run `build/PLANNING_GATE.md` from step 1.
- **Several `[/]`** → ask the user which one to continue (rule above).

## Step 8.5 — Capture Learnings (opt-in)

Before context reset, offer to capture durable knowledge from this epic. This is the natural moment: the diff is fresh, the review is fresh, the user remembers what was discovered.

**Toggle gate**: read `knowledge.enabled` from `.specture/settings.yml` (the `profile` expands it; `conventions.md` §10 only for projects not yet migrated). If `false` (or absent and the user hasn't explicitly enabled it), skip this step entirely.

**Batch (N > 1)**: never ask between epics — ask **once** when the queue drains, naming the epics of the batch, and run `capture` for the ones the user picks.

**Prompt to user (default no)**:

> "Epic `<slug>` completado. ¿Querés correr `/specture:knowledge` (capture) para capturar aprendizajes (ADRs implícitos, entradas de docs-index, patches a conventions)? Es opcional y no toca código. (s/N)"

- **Sí** → invoke `./skills/knowledge/SKILL.md` in `capture` mode passing:
  - Trigger: `epic`
  - Trigger ID: `<epic-slug>`
  - Review files: `docs/07-reviews/review-<epic-slug>-*.md`
  - Epic block from `ROADMAP.md`
  - Epic diff range: `git log --oneline <epic-start-sha>..HEAD`

  When `knowledge` returns, continue with Step 8.7. Even if it rejected all drafts, the result is logged to `learn-history.jsonl` — that's value.

- **No** (default) → skip directly to Step 8.7.

> **Why opt-in default-no**: Specture's value is in the build loop, not in documentation overhead. Most epics don't yield generalizable learnings worth durable capture. The user knows when a session produced "aha" moments — they say yes those times. Forcing learn on every epic would create exactly the noise problem the skill is designed to avoid.

> **Coordinator vs epic-agent**: the epic-agent does NOT run Step 8.5. The coordinator runs it after marking the epic `[x]`, with the epic-agent's report as additional input. This is consistent with the existing rule that only the coordinator marks `[x]`.

## Step 8.7 — Milestone close (when a milestone closes)

Run by the **coordinator** (not the epic-agent), only when the epic just marked `[x]` was the **last** of its milestone. A closed milestone keeps its **decisions** and loses its **process**: the ADRs, `rules.yml`, `conventions.md`, the requirements, the contract and the ROADMAP stay; the specs, their `_planning.md`, the code reviews, the debug logs and the coverage maps of its epics are deleted. The truth of what was built is the code and its tests — nothing in Specture or in the project reads those artefacts afterwards, and keeping them only grows the repository and tempts agents to treat them as truth (Psikora: 9.4k lines of ledger, tests citing their own spec).

1. **Detect milestone closure**: after marking the epic `[x]`, check whether **all** epics under its milestone are now `[x]` (read only that milestone's epic checkbox lines). If not, skip this step.
2. **Compliance review** — unless `compliance_review.enabled` is `false` in `.specture/settings.yml` (honoured under every profile), invoke `skills/compliance-review/SKILL.md` in `milestone <N>` mode and **wait for it** (it dispatches the `compliance-reviewer` per chunk — never in parallel with an epic-agent: one writing agent at a time). It runs **before** anything is deleted: it reads the epics' reviews and `_planning.md` (`LOCK_SHA`), and it commits its report under `docs/07-reviews/cumplimiento-milestone-<N>-*.md`, which stays tracked until the triage closes it. It never asks and never blocks the queue — the triage waits for the drain (queue step 6).
3. **Dry-run the close** and read the list:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/milestone-close.js" --milestone <N> --project .
   ```
   It prints `PROMOTE` lines (every `GUARD-n` of the milestone's specs that no rule of `rules.yml` protects yet becomes an `R-G-<n>` rule with its `verify:` token, so `honesty-check protected` keeps guarding those tests) and `DELETE` lines — only under `docs/05-specs/epic-<id>-*/`, `docs/07-reviews/review-<epic>-*.md`, the `docs/06-debug-logs/` files that cite the epic and `docs/.specture-meta/coverage/<task>.map`. The script refuses anything outside those four families by construction: a team's own documentation often lives inside `docs/`, and no glob ever touches it. A `REFUSED` (the milestone is not closed) means step 1 was wrong — stop.
4. **Apply**: the same command with `--apply`. It promotes the guards, `git rm`s the tracked files, removes the untracked ones, and commits nothing.
5. **Deferred ROADMAP collapse**: collapse to a tombstone any **closed** milestone that is no longer among the **~2 most-recent closed** milestones (fixed threshold, no toggle). Tombstone format + archived-dependency resolution: see `templates/ROADMAP_TEMPLATE.md`.
6. **Commit**: `docs: archive milestone <N>` — the deletions, the promoted rules and the tombstone, in one commit.

> **Why the coordinator**: the close spans every epic of the milestone, so it lives here; epic-agents never delete anything.
> **What never goes**: `docs/05-specs/_reviews/` (the batch registers), `cumplimiento-milestone-*.md`, the specs of an open milestone, and anything the project put under `docs/` that is not one of the four families. The design-system approval survives in `docs/03-ux-ui/design_system.md` (`**Aprobación visual:**`), so a later page epic still passes C-design.

## Metrics

Written by the epic coordinator (`build/EPIC_COORDINATOR.md` Step 6) after the report that ends
an epic's run — never by you, except after a visual approval (above) (roadmap item 34, gate
design §6.5; never blocks). One **JSON line** in `docs/.specture-meta/build-metrics.jsonl`
(create the directory if absent; fail-open) with the gate counters — `planner_dispatches`,
`open_questions` (asked), `resolved_alone` (rows), `c7_rejections`, `mech_check_failures`,
`validator_dispatches`, `validator_verdict` (`APPROVED` | `ESCALATED`), `gate_rounds`,
`gate_human_contacts`, `exec_human_contacts`, `planner_redispatch_after_approved` (must stay 0:
gate re-dispatches caused by a WARNING or NOTE of an APPROVED verdict — an execution-born
correction, red-fix or supersession loop counts in `planner_dispatches_loop`, never here),
`validator_dispatches_loop`, `planner_dispatches_loop`, `supersede_loops`, `j9_regressions`,
`late_findings`, `effort` (`{planner, validator, coordinator, test_writer, implementer, reviewer}` —
the levels **actually dispatched**: the agent's frontmatter unless the dispatch overrode it, e.g.
`medium` for `MODE: DELTA`, `RED-FIX`, `RE-REVIEW`; `null` only when unknown) — plus the
epic-agent report's `METRICS` values (`needs_context_spec`, `iteration_cap_spec`, `blocked_spec`,
`reviewer_rejected_major_spec_defect`, `review_rejections`, `supersessions`, `supersede_tests`,
`exec_blocked_compile`, `exec_blocked_runtime`, `baseline_failures`, `red_check_failures`), `specs`, `outcome`
(`DONE` | `BLOCKED` | `REJECTED_MAJOR` | `ESCALATED` | `PARKED`),
`source: "gate"`, `plugin`, `batch_id` (an epic of a review register), `parked` (`0`|`1`),
`coordinator_mode` (`subagent` | `inline`), `tdd_level` (`strict` | `essential` | `none` — the level the epic ran under, frozen at its opening), `epic_coordinator_dispatches`, `ts` (ISO-8601 **with
time**), and `tokens: null` unless the user handed you a figure (`{input, output, source}`). For
an epic that went through the per-epic gate (`build/PLANNING_GATE.md`), you pass your gate counters to the epic
coordinator as `GATE_METRICS`. Line schema and reader: `hooks/lib/metrics-report.js`
(`/specture:knowledge stats`). The file is **tracked** (decision A7).

## Why this model

Refresh, seal, loops, tests, implementation and reviews stay inside each epic coordinator and its epic-agent and are discarded when they finish; one epic runs at a time in fresh isolated context, so execution quality never degrades from accumulation. What accumulates in this chat is the review sitting, the per-epic gates of unreviewed epics and one short `EPIC_REPORT` per epic — and everything is written to disk as it goes, so a session can end after any epic (the declared checkpoint of `SKILL.md` § "Execution Model"). The bounded batch size N lets the user run a defined set ("ejecuta 3") without committing to the whole ROADMAP.


