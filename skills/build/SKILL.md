---
name: build
description: 'Use when `docs/04-roadmap/ROADMAP.md` exists and contains epics marked `[ ]` (pending) or `[/]` (in progress), or when the user says "construyamos", "sigamos con el roadmap", "implementemos el siguiente epic". Orchestrates a strict per-epic loop: spec → architecture validation → tests → implementation → review → verification → mark complete. Dispatches specialized agents (tdd-test-writer, implementer or ux-implementer for UI, code-reviewer). Frontend epics add a design-system-first order and a human visual-approval gate.'
---

# 04 — Iterative Build (The Build Loop)

You are the **Coordinator** of the build phase. You do NOT write code, tests, reviews, or specs directly. Your job is to:

1. Build the queue of ready epics and lock one at a time.
2. Run the **Spec Planning Gate** per epic: dispatch the `spec-planner`, resolve its open questions with the user, validate per spec, commit the specs + `_planning.md`.
3. Dispatch one fresh **epic-agent** per epic, whose complete procedure is `build/EPIC_LOOP.md` (TDD → review → verification over the validated specs).
4. Process each epic-agent's report before starting the next.
5. Mark progress in `ROADMAP.md` and release the seal.
6. Run the post-epic steps (8.5 learnings, 8.7 reconciliation) and keep your own context O(n_epics).

This skill **fuses** what was previously split into "planificación", "ejecución", and "auditoría". The split was artificial — for AI, those are one tight loop per epic. The file split is coordinator (`SKILL.md`, this file) vs epic loop (`EPIC_LOOP.md`): the epic-agent receives **only** the second, so it never sees queue mechanics it must not run.

## Required Inputs (Read Once at Start)

- `.specture/stack.yml` — for routing decisions and to know testing framework, language, etc.
- `.specture/conventions.md` — for context to pass to agents.
- `.specture/rules.yml` — the project invariants `R-*` (since v1.19.0); never passed whole — resolved per dispatch by "Rules Resolution" (`build/EPIC_LOOP.md`) into a `RULES_RESOLVED` block. Absent = `RULES_RESOLVED: []`.
- `.specture/decisions/` — all ADRs.
- `docs/01-requirements/business_requirements.md` — ground truth for business rules.
- `docs/02-architecture/architecture.md` — boundaries.
- `docs/04-roadmap/ROADMAP.md` — what to build next.
- The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` — to slice each epic's `operationId`s for the `spec-planner`.
- `templates/SPEC_TEMPLATE.md` / `templates/MIGRATION_SPEC_TEMPLATE.md` — handed to the `spec-planner` per the epic's `Template:` field.
- `templates/PLANNING_TEMPLATE.md` — the grammar of `docs/05-specs/<epic>/_planning.md` (`COVERAGE_TABLE`, `MECH_CHECK`, verdicts, `SPEC_SHA`); handed to the `spec-planner` and parsed by `hooks/lib/spec-set-check.js`.

## Preconditions (what degrades when an artifact is missing)

| Artifact | If missing |
|---|---|
| `docs/05-specs/_current/` (once ≥ 1 milestone is closed) | Current-State Resolution passes `[]` — validator and reviewer never see the component's current behaviour; Step 8.7 has nothing to merge into. Backfill: `/specture:knowledge reconcile --component <slug>` (lazy, one component at a time; `characterize` for a component without specs) — `hooks/lib/current-state.js components` names the components that have `[x]` specs and no file. |
| `.specture/docs-index.yml` with `docs_index.enabled` | Docs Index Resolution passes `[]`. |
| `.specture/rules.yml` (v1.19.0+) | Rules Resolution passes `RULES_RESOLVED: []` — implementer and reviewer see no project invariants (Dimension 7 no-op). A project whose `conventions.md` §12 still holds the old table is not migrated: the resolver injects those rules whole (unfiltered, as before v1.19.0) and warns; `/specture:doctor migrate` (`1.19-rules-file`) moves them and turns the tag filter on. |
| The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` | Validator Dimension 6 cannot run; frontend epics cannot slice the contract. |
| `.specture/settings.yml` | Toggles are read from the legacy `conventions.md` §10; if absent there too, defaults apply (hooks off, knowledge off). |
| Node ≥ 22 on `PATH` | Gate step 4a falls back to the three `grep` checks (`MECH_CHECK: MANUAL`); the seal cannot be written (`seal-cli.js`) — and the hooks, node scripts themselves, are inert anyway — so the epic runs without mechanical denies: the `git diff <RED_SHA>..HEAD` of Step 5.5, the `git diff <SPEC_SHA>..HEAD` of report processing and reviewer Dimension 1 remain the defenses; `metrics-report.js` cannot run (the metrics line is still appended by hand). Say it once: *"Node ≥ 22 no disponible — sin sello ni chequeo mecánico; quedan los git diff"*. |
| `templates/PLANNING_TEMPLATE.md` (framework file) | The planner cannot write `_planning.md` with the parseable grammar → 4a `UNVERIFIABLE`. A missing framework template is a broken install — reinstall the plugin; never hand-write the grammar. |

**Zero silent fallbacks.** Every resolver (in this file and in `build/EPIC_LOOP.md`) keeps its fallback behaviour, but the **first** time in a session it returns empty because the artifact is missing, print one line and continue:

> ⚠ Specture: `<artefacto>` no inicializado — corré `/specture:doctor`

`/specture:doctor check` reports all of these mechanically; `migrate` initialises what can be initialised.

## Cross-Platform Subagent Initialization (Mandatory)

Before proceeding, you must ensure specialized agents are registered in your environment. Check your available tools:
- **If you have the `define_subagent` tool (Antigravity CLI):** You MUST dynamically register the subagents before doing anything else. Read the `name`, `description`, and content (`system_prompt`) of the `AGENT.md` files located in the `agents/` directory (for `spec-planner`, `architecture-validator`, `tdd-test-writer`, `implementer`, `ux-implementer`, and `code-reviewer`), and call `define_subagent` for each one to make them available to this session.
- **If you do NOT have the `define_subagent` tool (Claude Code):** The agents are already statically registered by the system. You may proceed directly.
- **Script paths:** every `node "${CLAUDE_PLUGIN_ROOT}/…"` in this file and in `build/EPIC_LOOP.md` (`hooks/lib/spec-set-check.js`, `hooks/lib/seal-cli.js`, `hooks/lib/metrics-report.js`, `scripts/doctor.js`) is `${PLUGIN_ROOT}` on Copilot / Antigravity and `$SPECTURE_ROOT` in manual `@import` setups — the same rule as `start` Step 0.

## Execution Model — Sequential Queue

There is **one** execution model. This chat is **coordinator only**: it authors specs exclusively through the `spec-planner` dispatch of the Spec Planning Gate (never by hand), and does NOT dispatch the epic-agent's workers or run tests. It builds a queue of epics and dispatches **one fresh epic-agent at a time** (concurrency = 1), processing each report before starting the next. The coordinator's context stays O(n_epics) (only checkboxes + reports), never O(total work) — specs, tests, agent outputs and reviews live inside each epic-agent and are discarded when it finishes.

### How many epics to run (batch size N)

Read **N** from the user's request at the start of the session:

- A number ("ejecuta 3", "construí 2 epics") → **N = that number**.
- No number ("construyamos", "sigamos con el roadmap", "el siguiente") → **N = 1**.
- "todas" / "todo el roadmap" / "hasta terminar" → **N = all pending epics**.

N bounds the session: the coordinator builds a queue of up to N ready epics and **stops when the queue drains** — it does NOT spill over into the rest of the ROADMAP.

**Channel probe — once, when you build the queue.** If `stack.yml` declares `frontend.design_channel` and the queue contains any frontend epic, check the channel is reachable **before** dispatching the first one. If it is not (no session authorisation, the design project is not listed, the capability is absent), degrade **the whole batch** to the local spine with one explicit line — *"canal `<x>` no disponible: <razón>. La tanda corre con el material que ya está en `docs/03-ux-ui/`."* — and continue.

Never probe per epic: a `construí 6` would then stop at an authorisation prompt at an unpredictable point, and the coordinator would receive a generic `BLOCKED` indistinguishable from an unexecutable spec. And never conclude a channel is absent without saying why: a listing that returns nothing because the design project belongs to someone else looks exactly like a missing channel, and silently designing from scratch over an existing design is the worst outcome available.

**Cap for the design-system foundation epic: if it enters the queue, N = 1 for that batch.** Its Visual Approval Gate waits on a human, and the epic stays `[/]` until they answer. With N > 1 the rest of the queue would sit trapped behind a chat question — or the coordinator would be pushed to flip `[x]` "provisionally" and start the page epics, which is exactly the failure the gate exists to prevent. Announce the cap when you build the queue.

### Dependency parsing (deterministic)

For each epic read **only** its checkbox line and its `**Dependencias:**` line:

- `Ninguna` ⇒ no dependencies.
- `Epic X.Y, Epic Z.W` ⇒ depends on exactly those epic IDs.
- `Milestone N completo` ⇒ expand to **all** epic IDs under Milestone N.
- Combinations are the union of the above.

An epic is **ready** iff its state is `[ ]` and every dependency epic is `[x]`. Do not load the full ROADMAP — checkbox + dependency lines only.

### Branching (W-*) — once per session, before the queue loop

If `.specture/conventions.md` §13 (Workflow/Proceso) defines branch rules, create the working branch **once** before processing the queue:

1. **Work type**: default `feature`/epic; `hotfix`/bug if the user said so or this came from a bug/debug flow.
2. **Read the matching `W-*` row**: its base branch and name template. Fill `<slug>` from the work identifier available (the feature name if via `new-feature`, the milestone if the batch sits within one, else the first queued epic's slug).
3. **Create the branch** from the base (e.g. `git switch -c feature/<slug> develop`). If already on an appropriate branch, confirm and reuse it — don't create a second.
4. All queued epics commit to this **one** branch in dependency order (no per-epic branches → no stacked-branch problem).

**If §13 defines no branch rules, skip this entirely — create no branch** (default behavior). Specture **never auto-merges**.

### Spec Planning Gate (per epic — run by the coordinator)

Every epic is **fully planned before any execution**: the `spec-planner` authors the 1-3
specs, only the questions the sources cannot answer reach the user, the
`architecture-validator` approves per spec, and the epic-agent then receives sealed,
validated specs — never the job of writing them. The evidence lives on disk in
`docs/05-specs/<epic-slug>/_planning.md` (tracked). Run these steps for the epic just
locked `[/]`:

**Pre-flight — Code Surface Resolution** (roadmap item 33; third application of the doctrine
"the orchestrator resolves, the agent never reads" — see Docs Index Resolution and
Current-State Resolution in `build/EPIC_LOOP.md`). The planner **does not open source
files**: you hand it a table `SYMBOL | PATH | SIGNATURE` of the component's existing code.
- **Roots**: the "Carpeta raíz" of every involved component in `architecture.md`, backed by
  `stack.yml.structure`; "n/a" → the dirs of `structure.apps`; no code yet (greenfield) →
  `CODE_SURFACE: (vacío — componente sin código)`.
- **Method A (preferred)**: dispatch a general-purpose subagent with `model: haiku` (sonnet if
  haiku is unavailable), read-only tools (Read/Glob/Grep), this prompt and nothing else:
  ~~~
  Read ONLY files under: <roots>. Do not read anything else. Do not describe behavior.
  List every exported/public symbol (functions, classes, methods of exported classes,
  constants, types) as rows, one per line, strict format, no prose, max 80 rows,
  alphabetical by PATH then SYMBOL:
  SYMBOL | PATH | SIGNATURE
  SIGNATURE = the declaration line as written (name, parameters with types, return type).
  No bodies, no comments. If there are no exported symbols, output exactly: NONE
  ~~~
- **Method B (no subagent tool)**: `grep` the exports of the language declared in
  `stack.yml` — TS/JS `^export\s+(async\s+)?(function|class|const|let|interface|type|enum)\s+\w+`,
  Python `^(def|class)\s+\w+`, C#/Java `^\s*public\s+[^=]*?\b\w+\s*\(`, Go
  `^func\s+(\([^)]*\)\s*)?\w+\(`; SIGNATURE = the matched line, trimmed.
- **Output**: pass the table to the planner as a `CODE_SURFACE:` block (transient — not
  persisted) and append one summary line to `## CODE_SURFACE` of `_planning.md`
  (`roots · símbolos: N · método · fecha`). Both methods failing → `CODE_SURFACE: UNAVAILABLE`:
  the planner writes only `Crea:`/`Modifica:` lines and raises `CONCERNS`; the validator's C8
  sees the summary line.

1. **Dispatch the `spec-planner`** (`agents/spec-planner/AGENT.md`) with its Required
   Inputs manifest, assembled by you: the full epic block; the linked
   `business_requirements.md` sections + Capacidades de Frontera; the `architecture.md`
   sections of the involved components (incl. "Carpeta raíz"); the contract slice with the
   epic's `operationId`s; `stack.yml`, `conventions.md` (§8, file-org), `Accepted`
   ADRs; the `RULES_RESOLVED` block (run "Rules Resolution" of `build/EPIC_LOOP.md` with
   the epic's component slugs + `backend`/`frontend`/`mobile` as tags — the planner cites
   the rules a spec must honor, never the whole registry); resolved docs-index and
   `_current/` files (run "Docs Index Resolution" and "Current-State Resolution" as
   defined in `build/EPIC_LOOP.md` — same algorithms, you have the file); **for a frontend
   epic, the `design_surface_resolved` block** (run "Design Surface Resolution" —
   without it the planner has to fill the `Crea:` surface of the Code Surface seal for
   components it is forbidden to read and whose inventory nobody hands it, which is exactly
   the gap the inventory exists to close); the template
   per the epic's `Template:` field plus
   `templates/PLANNING_TEMPLATE.md` (the `_planning.md` grammar); the **Code Surface
   table** from the pre-flight above (`(vacío)` / `UNAVAILABLE` are valid and explicit — the
   planner never reads code); the frontend/migration conditionals. A missing item costs a
   `NEEDS_CONTEXT` round-trip.
2. **Stage, don't commit**: `git add docs/05-specs/<epic-slug>/` after each planner pass,
   so re-dispatches stay diffeable.
3. **Questions.** If `OPEN_QUESTIONS` is non-empty, ask the user via `AskUserQuestion`
   (Copilot / Antigravity: closed questions in chat, same rules): at most **4 questions per
   round**, 2-4 options each, one `(recomendada)`, at most **2 rounds per epic**. Contract
   doubts still open after 2 rounds mean the epic is under-discovered → offer a scoped
   `discover` instead of a third round.
   - **Vague pressure never suppresses contract questions** ("hazlo rápido", "no me
     preguntes" — same resistance rule as the router). **Explicit delegation** ("si hay
     dudas usá la recomendada") is honored: answer each question with its recommended
     option, recording `fuente: delegado por el usuario <fecha>`. Delegation scope = the
     named epic (the whole batch only if said **before** starting it); it never survives
     the session and is never inferred from a previous one. It does NOT authorize touching
     the contract or the architecture — a missing shape stays `BLOCKED: contrato`.
   - **Persist the answers.** If an answer creates or changes a business rule, edit the
     rule **in place** in `business_requirements.md` with the marker `(aclarado en Epic
     X.Y, <fecha>)` — never per-epic addendum subsections — BEFORE re-dispatching, so the
     spec can cite it and validator Dimension 4 finds it. An architectural answer → new
     ADR. Record every question, answer and `fuente:` in `_planning.md`.
4. **Re-dispatch with `ANSWERS`** (or `VIOLATIONS`); the planner edits minimally. **Echo
   the `CHANGELOG`** to the chat ("así quedó — …") without waiting for confirmation.
   Contrast `git diff -- docs/05-specs/<epic-slug>/` against the `CHANGELOG`: a diff that
   exceeds it is a finding → re-dispatch with "revertí lo no listado".
4a. **Mechanical set check — after every planner pass, before any validator dispatch**
   (no agent involved; roadmap item 29):
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js" docs/05-specs/<epic-slug> --roadmap docs/04-roadmap/ROADMAP.md --epic <X.Y>
   ```
   It reads the `COVERAGE_TABLE` of `_planning.md` (grammar: `templates/PLANNING_TEMPLATE.md`)
   plus the epic block and cross-checks the spec files: **C1** every `operationId` of the
   epic in exactly one spec (hole / overlap; a consumed op needs its backend epic `[x]`),
   **C2** every linked `RN-nnn` cited by ≥1 spec, **C4** every `(planeada — re-anclar)`
   symbol created by an *earlier* spec with a string-identical signature, **C5** ≤3 specs /
   ≤15 IDs per spec (WARNING), **C6** no consumer before its creator, plus `C-path` (every
   `Crea:`/`Modifica:` carries `en <path>`), `C-gap` (migration epics) and `C-sup`
   (declared supersessions). The first stdout line is the **token**:
   - `MECH_CHECK: PASS <sha>` → append the line to `## MECH_CHECK` of `_planning.md` (date +
     run number). The sha covers only the table rows: answers and verdicts never invalidate
     it, any table edit does.
   - `MECH_CHECK: FAIL <sha>` (exit 1) → re-dispatch the planner with `VIOLATIONS` = the
     finding lines verbatim (step 4). No validator dispatch is spent on evident errors; each
     FAIL counts toward the 3-rejection cap of step 5. A `C5 WARNING` is the
     `BLOCKED: sizing` escalation below.
   - `MECH_CHECK: UNVERIFIABLE <reason>` (exit 2) → a malformed table is a planner defect →
     `VIOLATIONS`; a missing input is yours to fix. Only if it stays unverifiable, append the
     line as-is: the validator then runs its C2 fallback.
   - No node available → the same three checks by hand with `grep` (epic ops vs `op:` rows,
     `RN-nnn` vs `br:` rows, `(planeada — re-anclar)` vs `sym:` rows) and append
     `MECH_CHECK: MANUAL <fecha>`; the validator accepts it with a note.
5. **Validate — the set first, then each spec** (roadmap item 30; decision A6: dims 1-6 stay
   per spec, the set gets one extra dispatch — the metrics decide later whether to merge
   them). **Every** validator dispatch of the gate carries the **last `MECH_CHECK:` line** of
   `_planning.md` verbatim — a required input: without it the validator answers `BLOCKED`.
   - **5a — one `SPEC_SET` dispatch per epic** of the `architecture-validator` (its Dimension
     7: **C3** every "Fuera de Scope" item has an owner in the `oos:` rows, **C7**
     "aclaraciones sin sustento", **C8** Superficie with signatures and paths only, **C2
     fallback** when 4a was `UNVERIFIABLE`/`MANUAL`) with: the epic block, **all** the specs
     in path order, the contract slice, `_planning.md` (`COVERAGE_TABLE`, `RESOLVED_ALONE`,
     last `MECH_CHECK:`), the source excerpts cited in `RESOLVED_ALONE`, and the
     `CODE_SURFACE` table. It runs first because a C3/C7 rejection reshuffles content across
     specs — the per-spec dispatches then run once, on the stabilized set.
   - **5b — one dispatch per spec** (dims 1-6, unchanged; **never** `_planning.md` — Dimension
     7 does not run per spec). Both 5a and 5b carry the `RULES_RESOLVED` block of the gate
     (Rules Resolution with the epic's tags) so a spec that contradicts a `BLOCKER` invariant
     is rejected by rule ID before any test is written.
   - On `REJECTED` (5a or 5b) → re-dispatch the planner with `VIOLATIONS` (step 4) → 4a →
     5a again only if the `CHANGELOG` touched `COVERAGE_TABLE`, `RESOLVED_ALONE`, a "Fuera
     de Scope" or a Superficie → 5b only for the specs the `CHANGELOG` touched.
     **Anti-cascade**: if C7 rejects the **same item a second time**, convert it into an
     `OPEN_QUESTION` (back to step 3) — no third attempt between two models arguing over a
     plausible quote. **3 accumulated rejections** (4a FAILs + 5a + 5b) for the epic →
     escalate to the user. Record every verdict verbatim under `## VEREDICTOS`
     (`### set — dispatch N` / `### <task-slug> — dispatch N`).
6. **Summary — always, before committing**: the specs in order, AC/BR/EC counts,
   `operationId`s covered, and **every** `RESOLVED_ALONE` decision with its quote.
   **Review mode** (only if the user explicitly asked this session, e.g. "construí con
   revisión de specs"): stop here and wait for confirmation in chat. There is no toggle,
   and Plan mode is not used.
7. **Commit** `docs(specs): plan <epic-slug> — N specs validados` (specs +
   `_planning.md`). Before committing, run `spec-set-check.js <epic-dir> --hash-only`: its
   sha must equal the last `MECH_CHECK: PASS` line — a different sha means a planner pass
   was never re-checked → back to 4a. Then append to `_planning.md` the validator verdicts
   **verbatim** (`## VEREDICTOS`) and the commit's `SPEC_SHA` (`## SPEC_SHA`); that append
   rides with the epic's next commit. `_planning.md` ownership is split
   (`templates/PLANNING_TEMPLATE.md`): the planner wrote `COVERAGE_TABLE` /
   `OPEN_QUESTIONS` / `RESOLVED_ALONE` / `SUPERSESIONES`; you write the sections marked
   *(coordinador)* — answers, `CODE_SURFACE`, `MECH_CHECK`, `VEREDICTOS`, `SPEC_SHA` —
   sequential writers, never concurrent.
   **Seal the specs** (roadmap items 31/36 — `hooks/README.md` schema v3), right after the
   commit, through the only sanctioned writer:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" write --epic <epic-slug> --spec-sha <SPEC_SHA> \
     --spec-paths "docs/05-specs/<epic-slug>/*.spec.md" \
     --test-globs "<conventions.md test globs>,<test root, e.g. tests/**>" \
     --allowed-paths "$(node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js" docs/05-specs/<epic-slug> --allowed-paths | paste -sd,)"
   ```
   `spec_paths` makes the validated specs immutable during the epic (hook deny "Spec Seal");
   `allowed_paths` (the union of every `Crea:`/`Modifica:` path — 4a's `C-path` guaranteed
   each one has a path) makes writes outside the declared surface a deny "Allowed Paths"
   (zero code without spec, item 36). `test_globs` must include the conventions test globs
   **and** the test root directory so RED-phase helpers stay writable. No `Crea:`/`Modifica:`
   at all (docs-only epic) → omit `--allowed-paths` and say so in one line. Never hand-edit
   `build-locked.json`. The epic-agent later **merges** its `specs[]` entries into this file.
8. **`TaskCreate` one task per spec** (subject `<epic-slug> / <task-slug>`, start
   `pending`) — user-visible progress for the epic-agent's Steps 4-8; `ROADMAP.md`
   remains the source of truth.
9. **Dispatch the epic-agent** (below) with the validated specs, the `SPEC_SHA` and the
   verbatim verdict.

**When the planner reports `BLOCKED`** — `sizing` (>3 specs): escalate the suggested
split to the user (it touches `ROADMAP.md`); `contrato`: the epic needs a contract change
→ `architecture`/ADR, never a spec; `contradicción`: escalate for an ADR.

**Human contacts** (one is routine on any project with a frontend — the Visual Approval Gate;
a doubt-free backend epic still runs to `[x]` without interruption):
**`DONE: pendiente de aprobación visual`** (the design-system foundation epic — you run the gate) ·
`OPEN_QUESTIONS` (incl. C7 conversions) · 3 accumulated validator rejections ·
`BLOCKED: sizing` · `BLOCKED: contrato` · resumption with unvalidated specs ·
`BLOCKED` / `REJECTED_MAJOR` downstream · review mode on request.

### The queue loop (in this coordinator chat)

1. Read **only the epic checkbox + `Dependencias` lines** of `ROADMAP.md` (not the whole doc).
2. Build the **queue**: walk the ROADMAP in stable order (earliest epics first) and collect the first **N** epics that will be runnable in dependency order — an epic whose only unmet dependency is an earlier queue member is eligible (it simply runs after it).
3. If no epic is ready and none can be made ready within the queue → dependency cycle, or everything is blocked by an escalated epic. Stop and escalate to the user.
4. `TaskCreate` **one task per queued epic** (subject `<epic-slug>`, `activeForm` "queued"). This is the visible queue; each epic-agent's internal step tracking is discarded with its context.
5. **Process the queue one epic at a time** (never concurrently). For each epic, in order:
   1. Mark the epic `[/]` in `ROADMAP.md`; commit. Only ONE epic is `[/]` at any moment.
   2. Set that epic's task `in_progress`.
   3. Run the **Spec Planning Gate** (above) for this epic. When it completes (specs committed, `SPEC_SHA` recorded), assemble the epic-agent's base context (`.specture/stack.yml`, `.specture/conventions.md`, all ADRs, `docs/01-requirements/business_requirements.md`, `docs/02-architecture/architecture.md`, the validated specs, and the full text of `build/EPIC_LOOP.md` — **never** this coordinator file) and dispatch one fresh **epic-agent** (below). Wait for its report.
   4. Process the report (below) before starting the next epic.
6. **Stop when the queue drains** (N epics processed) or a report escalates. Do not pull epics beyond N. If a session branch was created (§13), announce it now and suggest the merge/PR per `W-4` — Specture does not merge for you.

### Dispatch the epic-agent

Dispatch a general-purpose agent **with `model: sonnet`** (the epic-agent is procedural now that spec authorship lives in the planner — gate-review M7; measured per epic in `docs/.specture-meta/build-metrics.jsonl`, read with `knowledge stats`) and a self-contained prompt — **do NOT inherit this chat's history**:

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
VALIDATOR VERDICT (verbatim):
[paste the APPROVED verdict block]
SEAL: written (spec_sha=<SPEC_SHA>; allowed_paths: <N> | none) — merge your specs[]
entries with seal-cli.js merge-spec; the hook denies sealed tests, sealed specs and
writes outside the declared surface.

## Epic
[paste the full epic block from ROADMAP.md]

## Base context
[paste the assembled base context]

## Required final report
Report exactly one of: DONE | BLOCKED | REJECTED_MAJOR
(BLOCKED: spec <AC-n/BR-n/EC-n> when a sealed spec is unexecutable.
 DONE: pendiente de aprobación visual — design-system foundation epic only; include the dev
 command and the showcase route so the coordinator can run the gate.)
Plus: which specs were executed, which tests pass, what remains.
METRICS (mandatory — the coordinator appends them to build-metrics.jsonl):
  needs_context_spec: N · iteration_cap_spec: N · blocked_spec: N ·
  review_rejections: minor N / major N (spec_defect N — from the reviewer's CAUSE:) ·
  supersessions: N · firma re-read: N verified / M corrected
SUPERSESSIONS: <none | one line per declared test: <path>::<test> → <SUPERSEDE_SHA>>
If DONE: update ROADMAP.md to [x] for this epic and commit BEFORE reporting.
If DONE: pendiente de aprobación visual: do NOT touch the checkbox — leave the epic [/].
The coordinator flips it after the user approves the showcase.
~~~

### Coordinator processes the report

- **First, for any status — the spec-seal check (mirror of gate 5.5, hooks or not):**
  ```
  git diff <SPEC_SHA>..HEAD -- 'docs/05-specs/<epic-slug>/*.spec.md'
  ```
  (`_planning.md` is excluded — it legitimately grows.) Non-empty → a validated spec was
  edited during the epic: treat the report as **`REJECTED_MAJOR`**, show the diff verbatim
  and escalate to the user. No automatic action — a `[x]` commit that already landed is
  reverted only on the user's decision. Empty → process the status below.
- **`DONE: pendiente de aprobación visual`** (design-system foundation epic) → **you run the Visual Approval Gate.** The epic-agent is non-interactive, so it built the showcase, left the epic `[/]` on purpose and handed the gate to you. In order:
  1. **Show it.** If the Playwright MCP is available in this session, start the app with the dev command the report names, navigate to the showcase route and capture screenshots so the user reviews without leaving the chat. If it is not available, give the user the command and the route and ask them to open it.
  2. **Ask, verbatim:** *"¿Apruebas el design system para construir las páginas sobre esta base, o quieres ajustes?"* Ask this **before** surfacing any advisory finding (screenshot critique, lint warnings). A list of defects presented alongside the question turns advice into a veto — advisory output goes after an approval, as the next epic's to-do list.
  3. **Adjustments** → re-dispatch a **fresh epic-agent** for the same epic with the user's feedback verbatim as the change request (you never dispatch `ux-implementer` yourself — see "Execution Model"). Repeat from 1, counting the rounds.
  4. **On approval** → append `VISUAL_APPROVAL: <fecha> <sha>` to the epic's `_planning.md` (the one-line-per-run mould of `MECH_CHECK`; `<sha>` is HEAD at approval), flip the epic to `[x]` in `ROADMAP.md`, and commit both in one commit. Then release the seal and mark the task `completed` exactly as in the **DONE** branch below. In the metrics line record `outcome: DONE` plus `visual_approval_rounds: N`.
  5. **Outright rejection** (the user wants a different direction, not adjustments) → that is a Phase 03 decision, not an epic defect: leave the epic `[/]`, stop the queue and escalate to `ux-design`.
- **DONE** → verify the epic is `[x]` in `ROADMAP.md` and the commit landed (don't trust the report — `git log`/read the checkbox). **Release the seal yourself**: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" release` and confirm `.specture/state/build-locked.json` is gone — do not rely on the epic-agent's Step 8 (a leftover seal blocks the next epic's tests; the hook only fails open on it once no epic is `[/]`). Mark that epic's task `completed`. **Supersessions** (roadmap item 35): if the report lists any, fill the `commit:` of each line of `## SUPERSESIONES` in `_planning.md` with its `SUPERSEDE_SHA` and append one line to `docs/05-specs/_supersessions.md` (create it lazily; it is an index, one line per epic, never a narrative): `- <epic-slug> (<fecha>) — N tests supersedidos — ver docs/05-specs/<epic-slug>/_planning.md § SUPERSESIONES`. Continue with the next queued epic.
- **BLOCKED: spec <AC-n/BR-n/EC-n>** (also the Iteration Cap's spec-problem exit) → run the **spec-correction loop**, in this order:
  1. **Unseal only that spec's TDD entry**: `seal-cli.js unseal-spec --slug <task-slug>` removes the affected spec's `{slug, red_sha, test_paths}` object from `specs[]` — never delete the whole file (that unseals the sibling specs and the spec seal), never leave the entry (the hook would deny the re-written RED). The epic-level `spec_paths` stay in place until step 4 re-seals.
  2. Re-dispatch the `spec-planner` with `VIOLATIONS` naming the affected ID (minimal edit; `CHANGELOG` contrasted against `git diff` as in the gate).
  3. Run the mechanical set check (gate step 4a) and, on `PASS`, re-validate: the `SPEC_SET` dispatch (5a) again only if the `CHANGELOG` touched `COVERAGE_TABLE`, `RESOLVED_ALONE`, a "Fuera de Scope" or a Superficie; then the per-spec dispatch (5b) of the corrected spec, with the new `MECH_CHECK:` line.
  4. Commit the corrected spec, append the **new `SPEC_SHA`** + verdict to `_planning.md`, and re-seal: `seal-cli.js write` again with the new `--spec-sha` (and the recomputed `--allowed-paths`) — it keeps the sibling `specs[]` entries.
  5. **`git revert`** the affected spec's RED commit — never `reset`: history is append-only.
  6. Re-dispatch the epic-agent **from the affected spec**, not from spec 1, with the new `SPEC_SHA` + verbatim verdict.
- **BLOCKED** (other) / **REJECTED_MAJOR** → escalate to the user with the report summary before continuing. Do not auto-retry.
- **BLOCKED: insufficient context** → the epic is too large for one agent. Escalate to the user to consider splitting it before re-dispatching.
- **Metrics — after processing any report** (roadmap item 34, gate design §6.5; never blocks): append **one JSON line** to `docs/.specture-meta/build-metrics.jsonl` (create the directory if absent; fail-open, like `index-usage.jsonl`) with your own gate counters — `planner_dispatches`, `open_questions` (asked), `resolved_alone` (rows), `c7_rejections`, `mech_check_failures`, `validator_dispatches`, `validator_verdict` (`APPROVED` | `ESCALATED`) — plus the report's `METRICS` values (`needs_context_spec`, `iteration_cap_spec`, `blocked_spec`, `reviewer_rejected_major_spec_defect`, `review_rejections`, `supersessions`), `specs`, `outcome` (`DONE` | `BLOCKED` | `REJECTED_MAJOR` | `ESCALATED`), `source: "gate"`, `plugin`, `ts`, and `tokens: null` unless the user handed you a figure (`{input, output, source}`). Line schema and reader: `hooks/lib/metrics-report.js` (`/specture:knowledge stats`). The file is **tracked** (decision A7): `git add docs/.specture-meta/build-metrics.jsonl` and commit `docs(metrics): <epic-slug> — <outcome>` — the same commit carries the epic's `_planning.md` appends (verdicts, `SPEC_SHA`, supersession SHAs).

### Why this model

The coordinator only ever holds: ROADMAP checkboxes + the queued epic blocks + agent reports. Specs, tests, agent outputs and reviews stay inside each epic-agent and are discarded when it finishes. One epic runs at a time in fresh isolated context, so quality never degrades from accumulation — and the bounded batch size N lets the user run a defined set ("ejecuta 3") without committing to the whole ROADMAP.


## Frontend Epics — Design-System-First + Visual Approval Gate

This section is **cross-cutting**: it applies within the sequential-queue model whenever the epic being built is a **frontend epic** (it touches UI and `stack.yml.frontend.framework` is set and not `none`). It does not replace Steps 1-9 — it specializes how they run for UI work, because TDD certifies logic, not look-and-feel.

### Why frontend is different

"Tests pass" never means "it looks and feels right". For frontend, behavior/logic is still tested (component logic, hooks, the typed-client wiring, accessibility assertions where the test framework supports them), but **visual quality is gated by a human, not by tests**. Trying to assert aesthetics in unit tests is wasted effort. So the discipline shifts from "RED→GREEN proves it" to "RED→GREEN proves the logic + the user approves the look".

### Hard ordering (non-negotiable)

Frontend epics must be built in this order — the ROADMAP should already encode it (see `architecture/SKILL.md` Part C, milestone order 7-8):

1. **Design System Foundation epic** — tokens as code + base component library + the **`/dev/design-system` showcase route** (dev-only). Built FIRST.
2. **Visual Approval Gate** — the user approves the showcase. **No page epic may start until this gate passes.**
3. **Page epics** — one screen (or cluster) at a time, each built only **after** the backend epic implementing the `operationId`s it consumes is `[x]`.

If a page epic becomes "ready" before the design-system epic is approved, it is **not** actually ready. Since v1.20.0 that dependency is no longer implicit: `spec-set-check.js` check **C-design** blocks a `Tipo: pagina` epic whose `Tipo: design-system` epic has no `VISUAL_APPROVAL` line in its `_planning.md`. It anchors on the approval record, never on the `[x]` checkbox — the epic-agent writes its own checkbox, so a checkbox proves nothing about the human gate.

### Contract drift — block only what it touches

Before dispatching a **page** epic, check whether the contract moved under a design that was approved against the old one:

```
git diff <sha of the epic's VISUAL_APPROVAL>..HEAD -- <stack.yml api.contract_file>
```

- **Empty** → dispatch normally.
- **Non-empty** → read which `operationId`s the diff touches, and intersect them with the operations the epic's screens declare in `navigation_map.md` §1.
  - **They intersect** → **BLOCKER**. Escalate to the user: the design was approved against data that no longer exists. Name the operation and what changed (a new enum member needs a badge variant; a removed field needs the screen re-planned). Either the design or the page is updated before this epic runs.
  - **They do not intersect** → one WARNING line and continue. A change elsewhere in the contract is not this page's problem.

Proportional to the real damage: a new endpoint nobody renders must not stop the queue, and a new enum member on a screen that renders that enum must.

> The per-epic execution of this policy — the design-system epic procedure, the page-epic rules
> and the `ux-implementer` dispatch — lives in `build/EPIC_LOOP.md` § "Frontend Epics —
> execution"; the epic-agent receives it as part of its procedure. **The Visual Approval Gate
> itself does not live there**: it needs a channel to the user, which a subagent does not have.
> The epic-agent stops at it and reports `DONE: pendiente de aprobación visual`; you run the
> gate in § "Coordinator processes the report".

## Step 1 — Pick & Lock the Epic

Done by the **coordinator** in the queue loop (5.1): when an epic-agent starts, its epic is already `[/]` and committed. Epic-agents never run this step. If more than one epic is `[/]`, that is a stale state — the coordinator asks the user which one to continue before dispatching anything.

### Resuming a `[/]` epic (crash recovery — evidence on disk, not inference)

The queue only takes `[ ]` epics, so an orphaned `[/]` from a dead session is resumed
here, by evidence, before building the queue:

- **Exactly one `[/]`, AND `docs/05-specs/<epic-slug>/_planning.md` records `APPROVED`
  verdicts for the set (5a) and for every spec (5b) AND a `MECH_CHECK: PASS` whose sha
  equals `spec-set-check.js <epic-dir> --hash-only`, AND the specs are committed** → skip planning: dispatch the epic-agent
  (Steps 4-8) with the recorded `SPEC_SHA` + verbatim verdict. A stale or missing
  `MECH_CHECK` → run gate step 4a first (and re-validate only if it fails). If
  `.specture/state/build-locked.json` is missing (gitignored — a fresh clone never has it),
  rewrite it with `seal-cli.js write` from the recorded `SPEC_SHA` before dispatching.
- **One `[/]` with specs only in staging / the working tree** (planning was interrupted
  before the commit) → they are not validated. **Ask the user**: discard and re-plan, or
  resume from the validation step with what is there. Never discard files without asking.
- **One `[/]` with no specs** → run the Spec Planning Gate from step 1.
- **Several `[/]`** → ask the user which one to continue (rule above).

## Step 8.5 — Capture Learnings (opt-in)

Before context reset, offer to capture durable knowledge from this epic. This is the natural moment: the diff is fresh, the review is fresh, the user remembers what was discovered.

**Toggle gate**: read `knowledge.enabled` from `.specture/settings.yml` (the `profile` expands it; `conventions.md` §10 only for projects not yet migrated). If `false` (or absent and the user hasn't explicitly enabled it), skip this step entirely.

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

## Step 8.7 — Milestone Reconciliation (when a milestone closes)

Run by the **coordinator** (not the epic-agent), only when the epic just marked `[x]` was the **last** of its milestone. This is the reconciliation event: drain from intent (ROADMAP) → reconcile into reality (living behavior).

1. **Detect milestone closure**: after marking the epic `[x]`, check whether **all** epics under its milestone are now `[x]` (read only that milestone's epic checkbox lines). If not, skip this step.
2. **Touched components**: the union of "Componentes de arquitectura involucrados" across the milestone's epics.
3. **Reconcile (incremental)**: for each touched component, update `docs/05-specs/_current/<component-slug>.md` from `templates/CURRENT_CAPABILITY_TEMPLATE.md`:
   - Read the existing `_current/<component>.md` (if any) plus the milestone's specs that touch the component.
   - Merge: add the new BR/AC/EC + contract behavior; move any behavior this milestone supersedes (same `operationId` or same rule subject) down to "Historial / supersesiones"; refresh "Specs de origen" and "Última reconciliación"; set the header `Confianza: spec_reconciled` (a file `knowledge` wrote earlier as `ai_reconciled` / `ai_characterized` is upgraded here — the milestone's validated specs are now its source; `user_confirmed` is left alone).
   - If a supersession overlap is ambiguous, do a **full rebuild** of that component (re-read every spec listed in "Specs de origen" + the new ones).
   - Create `docs/05-specs/_current/` lazily if absent. It is **tracked truth — never gitignored**. If other milestones were already closed **before** `_current/` existed, reconcile only this milestone's components and print once: *⚠ Specture: `_current/` no cubre los milestones cerrados antes — corré `/specture:knowledge reconcile --component <slug>` por cada componente que `/specture:doctor check` liste* (the backfill is a content migration owned by `knowledge reconcile`, one component at a time with Plan-mode approval; never consolidate every past spec here).
4. **Deferred ROADMAP collapse**: collapse to a tombstone any **closed** milestone that is no longer among the **~2 most-recent closed** milestones (fixed threshold, no toggle). Tombstone format + archived-dependency resolution: see `templates/ROADMAP_TEMPLATE.md`.
5. **Commit**: `docs: reconcile <component(s)> + archive milestone <N>`.

> **Why the coordinator**: reconciliation spans the whole milestone's specs (not one epic), so it lives in the coordinator, which transiently loads the milestone's specs. Epic-agents stay focused on their single epic.
> **Backward-compat**: a project that has never reconciled simply has no `_current/` yet; the first milestone closure creates it. Collapse only fires once ≥3 milestones are closed (the ~2 most-recent stay expanded).

## Step 9 — Context Reset Between Epics

In the sequential-queue model this is **automatic**: each epic runs in a fresh epic-agent whose context is discarded when it finishes, and the coordinator only ever holds checkboxes + queued epic blocks + reports (O(n_epics)). There is no cross-epic accumulation to clear — the structural isolation **is** the reset.

For a very large batch (high N) processed in a single coordinator session, the user may optionally start a fresh coordinator session between batches to keep the coordinator lean. No manual reset is needed between individual epics.

## Anti-Patterns

The full Anti-Patterns table travels with the epic-agent in `build/EPIC_LOOP.md`. Two rows
bind **this coordinator** specifically: never hand-edit `.specture/state/build-locked.json`
(`seal-cli.js` is the only writer — `write` / `unseal-spec` / `release`); never skip the
`git diff <SPEC_SHA>..HEAD` spec-seal check when processing a report. The git-safety rows
bind the coordinator too: never `git add -A` or `git commit --amend`;
never restore with `git checkout -- <archivo>` after a mutation (snapshot to scratch first,
verify with `git hash-object`); never run two writing agents against the same checkout.

## After Loop Completion

If the ROADMAP reaches 100% `[x]`, route back to `skills/start/SKILL.md` which will offer the user options (audit, new feature, finalize).

> Comportamiento observable con hooks/Context7 activos: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
