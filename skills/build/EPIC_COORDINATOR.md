# 04d — Epic Coordinator (one epic, from refresh to `[x]`, without asking)

Read by the **epic coordinator**: the subagent the build coordinator dispatches once per epic
(Claude Code, v2.7.0). When nesting is unavailable — Copilot, Antigravity, or an
`EPIC_REPORT: NESTING_UNAVAILABLE` — the build coordinator runs this same file **inline**, in its
own chat, exactly as written. The epic-agent never sees it.

Why it exists: the build coordinator used to run every epic's refresh, seal, epic-agent reports
and loops in its own chat. In a real batch of three epics its context was 401k tokens during the
review sitting, 570k when the first epic started, 687k at the second and 961k — auto-compacted —
in the middle of the second. Here each epic gets a fresh context, and the build coordinator only
receives a short `EPIC_REPORT`.

Iron rules:

- **You never ask the user anything.** Every human decision goes back to the build coordinator as
  an `EPIC_REPORT` (below); it asks, persists the answer and dispatches you again.
- **One writing agent at a time.** You wait for each dispatch before the next one; the build
  coordinator waits for you. Never two writers on the same checkout.
- **Nested dispatches are asynchronous**: the result arrives as a message. Wait for it — **never
  poll** ("sigo esperando", status checks every minute): each poll re-reads your whole context.
- **What you read**: this file; `build/SKILL.md` § "Spec Planning Gate" — the Code Surface
  pre-flight and steps **2, 4, 4a, 5 and 7 only** (the queue, steps 3 and 6, the review stage and
  the Visual Approval Gate belong to the build coordinator, because they talk to the user);
  `build/REVIEW_STAGE.md` § "The announced mini-review" only; `build/EPIC_LOOP.md` only to run it
  inline (Step 4). Everything else lives on disk: `ROADMAP.md`, the review register,
  `_planning.md`, the seal, `build-metrics.jsonl`.
- Your last message is the `EPIC_REPORT`, **at most 40 lines** — it is the only thing that grows
  in the build coordinator's chat.

## Step 0 — Nesting check

If you do not have the Agent tool, answer `EPIC_REPORT: NESTING_UNAVAILABLE — sin herramienta
Agent` **immediately, touching nothing**: the build coordinator then runs this file inline.
(Inline, skip this step.)

## Dispatch inputs

```
ENTRY: refresh | sealed | resume | mini-review-answers | visual-adjust
EPIC: <full epic block from ROADMAP.md>
LOCK_SHA: <sha of the commit that marked the epic [/]>
REVIEW_REGISTER: docs/05-specs/_reviews/<id>.md | none
REGULATORIO: sí | no
SPEC_SHA: <sha>                       (ENTRY: sealed)
GATE_METRICS: <the per-epic gate counters> (ENTRY: sealed — the build coordinator ran the gate)
ANSWERS: <A-n — respuesta — fuente>   (ENTRY: mini-review-answers; already persisted and committed)
VISUAL_FEEDBACK: <user's words>       (ENTRY: visual-adjust)
HUMAN_CONTACTS: <n>                    (contacts the build coordinator already had for this epic)
DECISION: <the user's answer>          (ENTRY: resume after a STOPPED — gate | decisión; already persisted)
BASE_CONTEXT: <paths the epic-agent needs: stack.yml, conventions.md, ADRs, business_requirements.md, architecture.md>
```

A missing `LOCK_SHA` or `EPIC` → `EPIC_REPORT: STOPPED — falta <input>` and touch nothing (Step 0
goes first). `REGULATORIO` comes from the register's `REGULATORIOS`; `HUMAN_CONTACTS` is `0` on
the first dispatch of a reviewed epic (the sitting is counted once, in the register's metrics).

## Step 1 — Entry

First, under `## SPEC_SHA` of `_planning.md` (once the file exists): add `- LOCK_SHA: <sha> —
<ISO-8601>` if it is not there (the build coordinator's lock commit touches only `ROADMAP.md`),
and append `- EPIC_COORDINATOR: despacho <n> — ENTRY <entry> — <ISO-8601>` (`n` = the previous
such lines + 1; inline, write `en línea` instead of `despacho <n>`). Both ride with your next
commit; Step 6 counts the dispatches from them.

- `refresh` → Step 2.
- `sealed` → Step 4 with `SPEC_SHA` (the per-epic gate already ran in the build coordinator).
- `mini-review-answers` → Step 3.2.
- `visual-adjust` → Step 4: a fresh epic-agent with `VISUAL_FEEDBACK` verbatim as the change
  request (you never dispatch `ux-implementer` yourself).
- `resume` → Step R.

## Step 2 — Refresh & seal (the batch was reviewed — no questions)

The decisions were taken in the batch sitting; you only turn the drafts into sealed specs
against the code as it is **now** (earlier epics of the batch changed it). In order:

1. `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review.js" scope-check --batch <id> --epic <X.Y>` —
   `CHANGED` means the epic block or one of its RN moved since the sitting: answer
   `EPIC_REPORT: STOPPED — scope-changed` (the build coordinator runs a short review of this
   epic and dispatches you again). `MISSING`/`UNVERIFIABLE` → `STOPPED` with the line.
2. Code Surface Resolution (`build/SKILL.md` gate pre-flight) → fresh `spec-planner` in
   `MODE: REFRESH` with the drafts, the register and `CODE_SURFACE`. Stage and fingerprint after
   every pass (gate step 2).
3. Gate step 4a (**real**, not `--draft`) → validator per gate step 5, in `MODE: DELTA` against
   the review's verdicts (an epic reviewed as a draft is revalidated only on what the refresh
   changed). A finding that an answer of the register already settles is a `VIOLATION` citing
   that `A-n`, never a question. Route every WARNING/NOTE with the closed table of gate step 5.
   The cap of gate step 5 (3 rounds without APPROVED) → `EPIC_REPORT: STOPPED — gate` with the
   live BLOCKERs and the closed options that step pre-builds: the build coordinator asks.
4. **Regulatory epic** → Step 3 before sealing.
5. **New decision, non-regulatory epic** → **Parking** (below).
6. Commit (`docs(specs): plan <epic-slug> — refresco de revisión <id>`), `SPEC_SHA`, seal (gate
   step 7, with `--lock-sha <LOCK_SHA>`), mark `- <X.Y>: en curso` under `## EJECUCIÓN` of the
   register, and go to Step 4.

### Parking

A **new** decision of money, legal, personal data, contract or model — the planner's
`CONCERNS: decisión-nueva`, or a validator `HUMAN_DECISION` the register does not cover — in a
non-regulatory epic **parks** it instead of asking: set it back from `[/]` to `[ ]`, add
`- **Aparcado:** <ISO-8601> — <clase> — <motivo> — tanda <id>` to its ROADMAP block and a line to
`## APARCADOS` of the register, release the seal if one was written
(`seal-cli.js release`), commit, write the metrics line (Step 6, `outcome: PARKED`, `parked: 1`)
and answer `EPIC_REPORT: PARKED` with the pending decision in one line. The build coordinator
continues the queue with the epics that do not depend on it.

## Step 3 — The announced mini-review (regulatory epics)

1. After the refresh wrote the specs in detail and before sealing, dispatch the validator in
   `MODE: REVIEW` over the **written** specs, reading code (`build/REVIEW_STAGE.md` § "The
   announced mini-review") and record its verdict under `## VEREDICTOS` (`### set — … —
   mini-revisión`). A `HUMAN_DECISION` an answer of the register already settles is not new: it
   is a `VIOLATION` citing that `A-n` for the planner (as in the DELTA of Step 2). No new
   `HUMAN_DECISIONS` → Step 2 item 6: seal and execute. New
   ones — or a `CONCERNS: decisión-nueva` of the refresh — → a fresh `spec-planner` in
   `MODE: QUESTIONS` turns them into closed questions; commit the refreshed specs **unsealed**
   (`docs(specs): refresco <epic-slug> — pendiente de mini-revisión <id>`) and answer
   `EPIC_REPORT: MINI_REVIEW` with the questions **verbatim** (options, `(recomendada)`,
   `derivadas:`, `Dato verificado:`). You never ask them.
2. `ENTRY: mini-review-answers`: the build coordinator asked them with the rules of round 2,
   recorded them under `### Mini-revisión <X.Y>` of the register and committed the sources. A
   fresh `spec-planner` in `MODE: REFRESH` with the answers as `ANSWERS` → gate step 4a →
   validator `MODE: DELTA` → Step 2 item 6 (seal and execute). A decision still open after the sitting
   parks the epic (**Parking**).

## Step 4 — Dispatch the epic-agent

Dispatch a general-purpose agent **with `model: sonnet`** and the prompt below — self-contained,
**never** your own history. Read the `BASE_CONTEXT` paths and the full text of `build/EPIC_LOOP.md`
and paste them; never this file or `build/SKILL.md`.

~~~
You are the epic-agent for ONE epic of a Specture project.

Execute Steps 4 through 8 of build/EPIC_LOOP.md (Write Tests → ... → Mark
Epic Complete) for this single epic. That file is your complete procedure;
the epic is already locked [/] by the coordinator.
Steps 2/2.5/3 — los specs ya fueron planificados por spec-planner y
validados por architecture-validator; NO los regeneres ni edites. Si un
spec resulta inejecutable, reporta BLOCKED: spec con el ID de AC/BR/EC
afectado.
Honor every gate: Dispatch Manifest, RED commit, TDD Honesty Gate
(Step 5.5), code-reviewer, verification.

## Evidence (mandatory — missing either one → respond NEEDS_CONTEXT)
SPEC_SHA: [sha of the docs(specs) plan commit]
LOCK_SHA: [sha of the commit that marked the epic [/]]
VALIDATOR VERDICT (verbatim):
[paste the APPROVED verdict block]
SEAL: written (spec_sha=<SPEC_SHA>; allowed_paths: <N> | none) — merge your specs[]
entries with seal-cli.js merge-spec; the hook denies sealed tests, sealed specs and
writes outside the declared surface.

## Gate notes (for implementer, ux-implementer and code-reviewer — never the test-writer)
GATE_NOTES: [the epic's ## GATE_NOTES lines, or (ninguna)]

## Resume (only when re-dispatched after a loop — omit otherwise)
RESUME_AT: supersede <task-slug> | regresiones <task-slug> | red-fix <task-slug> | <task-slug>
SUPERSEDE: [<path>::<test> — <rule> — capa, one per line — tests J9 = SÍ]
REGRESIONES: [<path>::<test> — J9 NO/INDETERMINABLE — back to the implementer as regressions]
RED_FIX: [<ID or path::test> — defect or changed rule, one per line — only for RESUME_AT: red-fix]
BASELINE_FALLOS: [the epic's ## BASELINE_FALLOS lines]
CHANGE_REQUEST: [the user's visual feedback verbatim — only after a visual adjustment]

## Epic
[paste the full epic block from ROADMAP.md]

## Base context
[paste the assembled base context]

## Required final report
Report exactly one of: DONE | BLOCKED | REJECTED_MAJOR
(BLOCKED: nesting — you have no Agent tool; report it before touching anything.
 BLOCKED: spec <AC-n/BR-n/EC-n> when a sealed spec is unexecutable.
 BLOCKED: supersesiones (compilación|runtime) <task-slug> — old tests of closed epics
   that a rule of the spec makes false; include the FAILURES: block verbatim.
 BLOCKED: entorno — the suite cannot run for environment reasons; include the log.
 BLOCKED: debug <task-slug> — the Iteration Cap was hit; never invoke skills/debug.
 BLOCKED: red-fix <task-slug> — a test of this spec's RED is mechanically defective (does not
   compile/load, or its setup contradicts a premise the spec states); list test, defect and spec
   line. Never edit a sealed RED test outside EPIC_LOOP Step 5.3 (RESUME_AT: red-fix).
 DONE: pendiente de aprobación visual — design-system foundation epic only; include the dev
 command and the showcase route so the coordinator can run the gate.)
Plus: which specs were executed, which tests pass, what remains.
BASELINE_FALLOS: <none | the lines of Step 3.9>
METRICS (mandatory — the coordinator appends them to build-metrics.jsonl):
  needs_context_spec: N · iteration_cap_spec: N · blocked_spec: N ·
  review_rejections: minor N / major N (spec_defect N — from the reviewer's CAUSE:) ·
  supersessions: N · supersede_tests: N · exec_blocked_compile: N ·
  exec_blocked_runtime: N · baseline_failures: N · firma re-read: N verified / M corrected
SUPERSESSIONS: <none | one line per declared test: <path>::<test> → <SUPERSEDE_SHA>>
If DONE: update ROADMAP.md to [x] for this epic and commit BEFORE reporting.
If DONE: pendiente de aprobación visual: do NOT touch the checkbox — leave the epic [/].
The coordinator flips it after the user approves the showcase.
~~~

**`BLOCKED: nesting`** (the epic-agent has no Agent tool — the depth limit is lower than 3) → run
`build/EPIC_LOOP.md` Steps 4-8 **yourself**, dispatching its workers from here, and continue at
Step 5 with your own result as the report. Record `coordinator_mode: subagent` and say it in the
`EPIC_REPORT` summary.

## Step 5 — Process each epic-agent report

- **First, for any status — the spec-seal check** (mirror of gate 5.5, hooks or not):
  `git diff <SPEC_SHA>..HEAD -- 'docs/05-specs/<epic-slug>/*.spec.md'` (`_planning.md` is
  excluded — it legitimately grows; after a loop the range starts at the loop's new `SPEC_SHA`).
  Non-empty → a validated spec was edited during the epic: `EPIC_REPORT: STOPPED — seal-diff`
  with the `diff --stat` and the first hunks. No automatic action: a `[x]` commit that already
  landed is reverted only on the user's decision.
- **`DONE: pendiente de aprobación visual`** → **no** metrics line: answer `EPIC_REPORT:
  VISUAL_PENDING` with the dev command, the showcase route and your counters as one JSON object
  on the `METRICS:` line (the build coordinator writes the line after the approval). The build coordinator runs the Visual Approval Gate; adjustments come back to you as
  `ENTRY: visual-adjust`.
- **DONE** → verify the epic is `[x]` in `ROADMAP.md` and the commit landed (`git log`, read the
  checkbox — never the report's word). **Release the seal**: `node
  "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" release` and confirm
  `.specture/state/build-locked.json` is gone. **Supersessions**: if the report lists any, fill
  the `commit:` of each line of `## SUPERSESIONES` in `_planning.md` with its `SUPERSEDE_SHA` and
  append one line to `docs/05-specs/_supersessions.md` (create it lazily; an index, one line per
  epic): `- <epic-slug> (<fecha>) — N tests supersedidos — ver docs/05-specs/<epic-slug>/_planning.md § SUPERSESIONES`.
  Mark `- <X.Y>: [x] <ISO-8601>` under `## EJECUCIÓN` of the register. Step 6, then
  `EPIC_REPORT: DONE`.
- **BLOCKED: supersesiones (<capa>) <task-slug>** → the **supersession loop** — no `git revert`,
  no `unseal-spec`, no question. At most **one loop per spec and per layer**; a second report for
  the same spec and layer → `EPIC_REPORT: STOPPED — loop repetido`. A rewrite the code-reviewer
  asks for is **not** a new loop (the epic-agent sends it back to the test-writer itself).
  1. **Judge first, with data.** A fresh `architecture-validator` in `MODE: J9` with the spec,
     the epic block, `RULES_RESOLVED`, the last `MECH_CHECK:` line of `_planning.md` and the
     report's `FAILURES:` lines verbatim. The `SÍ` tests go on; `NO`/`INDETERMINABLE` become
     **regressions** for the implementer (step 8). **Write the J9 verdict to `## VEREDICTOS`
     (`### <task-slug> — dispatch N — ronda R — … — loop — J9`) and the report's `FAILURES:`
     lines under it as soon as it arrives** — a cut after this point loses nothing (Step R).
  2. Append `- LOOP: supersesiones <capa> <task-slug> — <ISO-8601>` under `## SPEC_SHA` of
     `_planning.md` (it tells a resume which loop the lifted spec belongs to), then
     `seal-cli.js lift-spec --slug <task-slug>` — releases only that spec file.
  3. A **fresh** `spec-planner` in `MODE: SUPERSESSIONS` with `SPECS_DIR`, `ALCANCE:
     [<task-slug>]` and only the `SÍ` tests with the rule J9 named.
  4. `honesty-check.js spec-delta --epic-dir docs/05-specs/<epic-slug> --base <SPEC_SHA> --slug
     <task-slug>` — `FAIL` → abandon this loop and run the spec-correction loop below.
  5. `honesty-check.js protected --epic-dir docs/05-specs/<epic-slug> --slug <task-slug>` —
     `FAIL` (a `verify:` test of `rules.yml` or a GUARD of another epic) → `EPIC_REPORT: STOPPED
     — protected`: amending a project invariant is the user's decision.
  6. Gate step 4a must `PASS` (a `FAIL` → the planner again with the lines as `VIOLATIONS`, as in
     gate step 4).
  7. Commit `docs(specs): supersesiones <epic-slug>/<task-slug> — loop <capa>` (the spec and
     `_planning.md`) → the new `SPEC_SHA`; append `- SPEC_SHA: <sha> — <ISO> — loop <capa> de
     <task-slug>` to `_planning.md`, then `seal-cli.js write` with the new `--spec-sha`, the same
     `--lock-sha` and the same `--allowed-paths`.
  8. A fresh epic-agent with `RESUME_AT: supersede <task-slug>`, the `SUPERSEDE:` and
     `REGRESIONES:` blocks, the new `SPEC_SHA` and `BASELINE_FALLOS`. All-`NO` → no spec change:
     skip 2-7 and resume with `RESUME_AT: regresiones <task-slug>`.
- **BLOCKED: spec <AC-n/BR-n/EC-n>** (also the Iteration Cap's spec-problem exit, and a
  supersession loop whose `spec-delta` failed) → the **spec-correction loop** (punctual — no
  `unseal-spec`, no revert):
  1. Append `- LOOP: corrección <task-slug> — <ISO-8601>` under `## SPEC_SHA` of `_planning.md`,
     then `seal-cli.js lift-spec --slug <task-slug>`.
  2. A **fresh** `spec-planner` with `ALCANCE: [<task-slug>]` and `VIOLATIONS` naming the
     affected ID (minimal edit; its `CHANGELOG` is contrasted against `git diff`).
  3. Gate step 4a and, on `PASS`, `MODE: DELTA` re-validation: the `SPEC_SET` dispatch again only
     if the `CHANGELOG` touched `COVERAGE_TABLE`, `RESOLVED_ALONE`, a "Fuera de Scope" or a
     Superficie; then the per-spec dispatch of the corrected spec. A finding that needs a human
     decision (not settled by the register or the sources) → regulatory epic:
     `EPIC_REPORT: STOPPED — decisión` with the closed question; non-regulatory: per the
     register's `P-7` (parking by default — **Parking**).
  4. Commit the corrected spec, append the **new `SPEC_SHA`** + verdict to `_planning.md`, and
     re-seal with the new `--spec-sha`, the same `--lock-sha` and the recomputed
     `--allowed-paths`.
  5. A fresh epic-agent with `RESUME_AT: red-fix <task-slug>` and a `RED_FIX:` block naming the
     changed IDs — the test-writer rewrites or adds **only** their tests on HEAD; nothing is
     reverted (EPIC_LOOP Step 5.3).
- **BLOCKED: red-fix <task-slug>** (a test of this spec's own RED is objectively defective while
  the spec is right) → a fresh epic-agent with `RESUME_AT: red-fix <task-slug>` and the defect
  list as the `RED_FIX:` block — no planner, no revert. Only for **mechanical** defects the report
  proves (does not compile or load; setup contradicts a premise the spec states). A disagreement
  about *what* the test asserts is `BLOCKED: spec`.
- **BLOCKED: entorno · BLOCKED: debug <task-slug> · BLOCKED: insufficient context · BLOCKED**
  (other) **· REJECTED_MAJOR** → Step 6 with `outcome: ESCALATED`, then `EPIC_REPORT: STOPPED —
  <reason>` with the evidence (at most 10 lines of the log, the cap, the reviewer's summary). Never
  retry them yourself; never invoke `skills/debug` (it needs Plan mode, which only the user
  approves). The seal stays and the epic stays `[/]`: the build coordinator resumes it with
  `ENTRY: resume` after the user decides.

## Step 6 — Metrics

After the report that ends the epic's run (DONE, PARKED, and the escalations `STOPPED —
seal-diff | protected | loop repetido | entorno | debug | insufficient context | REJECTED_MAJOR`)
— never after an intermediate `BLOCKED: supersesiones`, never for `VISUAL_PENDING` (Step 5),
`NESTING_UNAVAILABLE` or a `STOPPED` that only waits for an answer (`scope-changed`, `gate`,
`decisión`, `reanudación`: the run continues after it) — append **one JSON line** to
`docs/.specture-meta/build-metrics.jsonl` with the fields of `build/SKILL.md` § "Metrics" (gate
counters: yours for a refresh, the dispatch's `GATE_METRICS` for `ENTRY: sealed`;
`gate_human_contacts` = the dispatch's `HUMAN_CONTACTS`; the report's `METRICS` values) plus
`coordinator_mode: "subagent"` (`"inline"` when the build coordinator runs this file itself),
`epic_coordinator_dispatches` (the `- EPIC_COORDINATOR: despacho` lines of `_planning.md`; `0`
inline), `parked` (`0`|`1`), `batch_id` when the epic belongs to
a review register, and `ts` with time. `git add docs/.specture-meta/build-metrics.jsonl` and
commit `docs(metrics): <epic-slug> — <outcome>` together with the epic's `_planning.md` appends.

## Step R — Resume from disk (`ENTRY: resume`)

A session or a usage limit cut the run. Decide by evidence, never by inference:

- **A seal with `lifted_spec_paths`** → a loop was interrupted; the last `- LOOP:` line of
  `_planning.md` says which. Supersessions: the J9 verdict and the `FAILURES:` are under
  `## VEREDICTOS` — resume from step 4 (`spec-delta`) if the planner's edit is on disk, else from
  step 3. Correction: resume from step 3 (4a + delta validation) if the planner's edit is on
  disk, else from step 2.
- **Specs sealed** (`MECH_CHECK: PASS` equal to `spec-set-check.js <epic-dir> --hash-only`, last
  verdicts `APPROVED`, committed) → Step 4 with the recorded `SPEC_SHA`; the epic-agent resumes at
  the first spec not `APPROVED` + verified (`RESUME_AT: <task-slug>`). If
  `.specture/state/build-locked.json` is missing, rewrite it with `seal-cli.js write` from the
  recorded `SPEC_SHA` and `LOCK_SHA` first. A stale `MECH_CHECK` → gate step 4a first.
- **A refresh commit "pendiente de mini-revisión"** and no `### Mini-revisión <X.Y>` answers in
  the register → answer `EPIC_REPORT: MINI_REVIEW` again with the same questions.
- **Refresh in the working tree, uncommitted** → gate step 4a and the delta validation of
  Step 2.3 (the drafts are reviewed; nothing is discarded).
- **No specs beyond the drafts** → Step 2.
- **A `DECISION:` in the dispatch** answers the `STOPPED` that paused the run (the last
  `### … — STOPPED` note you left under `## VEREDICTOS`): `decisión` → a fresh planner with it as
  `ANSWERS` for the spec that raised it, then the step that stopped (4a and delta validation);
  `gate` → the option the user chose from the menu you pre-built (comply → planner with it as
  `VIOLATIONS` context; pause → `STOPPED — pausado`; amend an ADR or split the epic are
  `architecture`/ROADMAP work → `STOPPED` again naming it). Before answering any `STOPPED` that waits
  for an answer, leave that `### <target> — <ISO-8601> — STOPPED — <motivo>` note with the question.
- Anything else (several `[/]`, files you cannot attribute) → `EPIC_REPORT: STOPPED — reanudación`
  with what you found: the build coordinator asks.

## The EPIC_REPORT

```
EPIC_REPORT: DONE | PARKED | MINI_REVIEW | STOPPED — <motivo> | VISUAL_PENDING | NESTING_UNAVAILABLE
EPIC: <X.Y> · SPEC_SHA: <sha> · HEAD: <sha>
SUMMARY: <≤ 5 lines for the user: what was built or what happened, in plain language>
<status block: DONE → [x] verified, seal released, metrics <sha> · PARKED → clase — motivo —
 decisión pendiente · MINI_REVIEW → the closed questions verbatim + the unsealed refresh commit ·
 STOPPED → reason, minimal evidence, the closed options when the procedure pre-builds them ·
 VISUAL_PENDING → dev command + showcase route · NESTING_UNAVAILABLE → what was missing>
METRICS: <the line was written | not written (why) | VISUAL_PENDING: the counters as one JSON object>
```

Never paste whole verdicts, diffs or logs: the evidence stays on disk and you name where.

## Anti-Patterns

- Asking the user — even "just one quick question": it is always an `EPIC_REPORT`.
- Polling a nested dispatch instead of waiting for its notification.
- Running the epic-agent's workers yourself while the epic-agent can dispatch them (only after
  `BLOCKED: nesting`).
- Skipping the `git diff <SPEC_SHA>..HEAD` spec-seal check; hand-editing
  `.specture/state/build-locked.json` (`seal-cli.js` is the only writer).
- Resuming the planner with `SendMessage` (always a fresh dispatch per pass); re-planning because
  of a WARNING or a NOTE of an APPROVED verdict; invoking `skills/debug`.
- Reading the review stage R0-R5 or the queue section of `build/SKILL.md`, or touching another
  epic's checkbox.
- An `EPIC_REPORT` longer than 40 lines, or one that pastes verdicts and diffs.
- `git add -A`, `git commit --amend`, `git checkout -- <archivo>` after a mutation, or two writing
  agents on the same checkout.
