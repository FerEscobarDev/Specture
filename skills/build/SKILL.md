---
name: build
description: 'Use when `docs/04-roadmap/ROADMAP.md` exists and contains epics marked `[ ]` (pending) or `[/]` (in progress), or when the user says "construyamos", "sigamos con el roadmap", "implementemos el siguiente epic". Orchestrates a strict per-epic loop: spec → architecture validation → tests → implementation → review → verification → mark complete. Dispatches specialized agents (tdd-test-writer, implementer or ux-implementer for UI, code-reviewer). Frontend epics add a design-system-first order and a human visual-approval gate.'
---

# 04 — Iterative Build (The Build Loop)

You are the **Coordinator** of the build phase. You do NOT write code, tests, reviews, or specs directly. Your job is to:

1. Build the queue of ready epics and, since v2.3.0, **review the batch with the user in one sitting** (`build/REVIEW_STAGE.md`) before executing it; then lock one epic at a time.
2. Run the **Spec Planning Gate** per epic for an epic the review did not cover: dispatch the `spec-planner`, resolve its open questions with the user (one budget of two rounds), validate by rounds, commit the specs + `_planning.md`.
3. Dispatch one fresh **epic coordinator** per epic (`build/EPIC_COORDINATOR.md`, since v2.7.0): it refreshes and seals the specs, dispatches the **epic-agent** (`build/EPIC_LOOP.md`: TDD → review → verification), runs every loop its reports need — the **supersession loop** included, which fixes old tests broken by design without asking the user — releases the seal and writes the metrics, and hands you back a short `EPIC_REPORT`. It never asks: what needs the user comes back to you.
4. Process each `EPIC_REPORT` before starting the next epic.
5. Run the post-epic steps (8.5 learnings, 8.7 reconciliation).

This skill **fuses** what was previously split into "planificación", "ejecución", and "auditoría". The split was artificial — for AI, those are one tight loop per epic. The file split is coordinator (`SKILL.md`, this file) vs epic loop (`EPIC_LOOP.md`): the epic-agent receives **only** the second, so it never sees queue mechanics it must not run.

## Required Inputs (Read Once at Start)

- `.specture/stack.yml` — for routing decisions and to know testing framework, language, etc.
- `.specture/conventions.md` — for context to pass to agents.
- `.specture/rules.yml` — the project invariants `R-*` (since v1.19.0); never passed whole — resolved per dispatch by "Rules Resolution" (`build/EPIC_LOOP.md`) into a `RULES_RESOLVED` block. Absent = `RULES_RESOLVED: []`.
- `.specture/review-rules.md` — the team's custom review criteria (since v2.4.0, opt-in); never passed whole — resolved per dispatch by "Custom Rules Resolution" (`build/EPIC_LOOP.md`) into a `CUSTOM_RULES` block. Absent = `CUSTOM_RULES: []`.
- `.specture/decisions/` — all ADRs.
- `docs/01-requirements/business_requirements.md` — ground truth for business rules.
- `docs/02-architecture/architecture.md` — boundaries.
- `docs/04-roadmap/ROADMAP.md` — what to build next.
- The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` — to slice each epic's `operationId`s for the `spec-planner`.
- `templates/SPEC_TEMPLATE.md` / `templates/MIGRATION_SPEC_TEMPLATE.md` — handed to the `spec-planner` per the epic's `Template:` field.
- `templates/PLANNING_TEMPLATE.md` — the grammar of `docs/05-specs/<epic>/_planning.md` (`COVERAGE_TABLE`, `MECH_CHECK`, verdicts, `SPEC_SHA`); handed to the `spec-planner` and parsed by `hooks/lib/spec-set-check.js`.
- `templates/BATCH_REVIEW_TEMPLATE.md` + `build/REVIEW_STAGE.md` — the batch review register (`docs/05-specs/_reviews/<id>.md`, read by `hooks/lib/review.js`) and the procedure of the review stage (queue step 4.5, since v2.3.0).
- `build/EPIC_COORDINATOR.md` — the procedure of one epic from lock to `[x]` (since v2.7.0): you dispatch it as a subagent, or run it inline when nested subagents are unavailable.

**Read lazily (v2.7.0).** With nested subagents this chat only needs what it runs: the queue reads checkbox + `Dependencias` lines; the review stage and the per-epic gate read the sources they name when they run; an epic of a `CLOSED` register needs none of them here — the epic coordinator reads its own. Read `build/EPIC_COORDINATOR.md` only to run it inline.

## Preconditions (what degrades when an artifact is missing)

| Artifact | If missing |
|---|---|
| `docs/05-specs/_current/` (once ≥ 1 milestone is closed) | Current-State Resolution passes `[]` — validator and reviewer never see the component's current behaviour; Step 8.7 has nothing to merge into. Backfill: `/specture:knowledge reconcile --component <slug>` (lazy, one component at a time; `characterize` for a component without specs) — `hooks/lib/current-state.js components` names the components that have `[x]` specs and no file. |
| `.specture/docs-index.yml` with `docs_index.enabled` | Docs Index Resolution passes `[]`. |
| `.specture/rules.yml` (v1.19.0+) | Rules Resolution passes `RULES_RESOLVED: []` — implementer and reviewer see no project invariants (Dimension 7 no-op). A project whose `conventions.md` §12 still holds the old table is not migrated: the resolver injects those rules whole (unfiltered, as before v1.19.0) and warns; `/specture:doctor migrate` (`1.19-rules-file`) moves them and turns the tag filter on. |
| `.specture/review-rules.md` (v2.4.0+, opt-in) | Custom Rules Resolution passes `CUSTOM_RULES: []` and the compliance review checks Specture's rules only. Opt-in, so its absence prints **no** warning. A file with errors stops the dispatch (resolver exit 1) — `/specture:doctor check` names the line. |
| The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` | Validator Dimension 6 cannot run; frontend epics cannot slice the contract. |
| `.specture/settings.yml` | Toggles are read from the legacy `conventions.md` §10; if absent there too, defaults apply (hooks off, knowledge off). |
| Node ≥ 22 on `PATH` | Gate step 4a falls back to the three `grep` checks (`MECH_CHECK: MANUAL`); the seal cannot be written (`seal-cli.js`) — and the hooks, node scripts themselves, are inert anyway — so the epic runs without mechanical denies: the `git diff <RED_SHA>..HEAD` of Step 5.5, the `git diff <SPEC_SHA>..HEAD` of report processing and reviewer Dimension 1 remain the defenses; `metrics-report.js` cannot run (the metrics line is still appended by hand). Say it once: *"Node ≥ 22 no disponible — sin sello ni chequeo mecánico; quedan los git diff"*. |
| `templates/PLANNING_TEMPLATE.md` (framework file) | The planner cannot write `_planning.md` with the parseable grammar → 4a `UNVERIFIABLE`. A missing framework template is a broken install — reinstall the plugin; never hand-write the grammar. |

**Zero silent fallbacks.** Every resolver (in this file and in `build/EPIC_LOOP.md`) keeps its fallback behaviour, but the **first** time in a session it returns empty because the artifact is missing, print one line and continue:

> ⚠ Specture: `<artefacto>` no inicializado — corré `/specture:doctor`

`/specture:doctor check` reports all of these mechanically; `migrate` initialises what can be initialised.

## Cross-Platform Subagent Initialization (Mandatory)

Before proceeding, you must ensure specialized agents are registered in your environment. Check your available tools:
- **If you have the `define_subagent` tool (Antigravity CLI):** You MUST dynamically register the subagents before doing anything else. Read the `name`, `description`, and content (`system_prompt`) of the `AGENT.md` files located in the `agents/` directory (for `spec-planner`, `architecture-validator`, `tdd-test-writer`, `implementer`, `ux-implementer`, `code-reviewer`, and `compliance-reviewer`), and call `define_subagent` for each one to make them available to this session.
- **If you do NOT have the `define_subagent` tool (Claude Code):** The agents are already statically registered by the system. You may proceed directly.
- **Script paths:** every `node "${CLAUDE_PLUGIN_ROOT}/…"` in this file and in `build/EPIC_LOOP.md` (`hooks/lib/spec-set-check.js`, `hooks/lib/seal-cli.js`, `hooks/lib/metrics-report.js`, `scripts/doctor.js`) is `${PLUGIN_ROOT}` on Copilot / Antigravity and `$SPECTURE_ROOT` in manual `@import` setups — the same rule as `start` Step 0.

## Execution Model — Sequential Queue

There is **one** execution model. This chat is **coordinator only**: it authors specs exclusively through the `spec-planner` dispatch of the Spec Planning Gate (never by hand), and does NOT dispatch the epic-agent's workers or run tests. It builds a queue of epics, holds the review sitting, and dispatches **one fresh epic coordinator at a time** (concurrency = 1) — which dispatches the epic-agent, which dispatches the workers: three levels of nested subagents, Claude Code's default limit — processing each `EPIC_REPORT` before starting the next. Refresh, seal, loops, tests, implementation and reviews live inside the epic coordinator and are discarded when it finishes; here accumulate only the sitting, the per-epic gates of unreviewed epics and the reports (in a real batch of three epics, running them here took this chat from 570k to 961k tokens before the third one). **Declared checkpoint:** everything that matters lives on disk (`ROADMAP.md`, `_planning.md`, the seal, `.specture/state/gate/`, `build-metrics.jsonl`), so after any epic the user can close the session and continue with `/specture:start` — for a long batch, starting a fresh session when this chat gets heavy is the intended use, not a failure.

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
- **Never** build tables of how tests use the code (usage greps over `tests/`) for the
  planner or the validator: which old tests a spec breaks is not a gate question — the
  execution loop finds it mechanically.

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
2. **Stage and fingerprint, don't commit.** After each planner pass: `git add
   docs/05-specs/<epic-slug>/` and `git write-tree --prefix=docs/05-specs/<epic-slug>/` —
   that sha is the pass's **TREE** (comparable with `git rev-parse
   <SPEC_SHA>:docs/05-specs/<epic-slug>` on resumption; the delta re-validation diffs two
   TREEs). Then compare `git status --porcelain --untracked-files=all --
   docs/05-specs/<epic-slug>/` with the pass's `ALCANCE`: a spec modified outside it is
   restored from the previous TREE (`git show <tree_prev>:<file> > <path>` — the declared
   exception to the "never restore after a mutation" anti-pattern); a new file outside it is
   reported, never deleted without asking.
3. **Questions — one human budget per gate.** At most **2 rounds** of `AskUserQuestion`
   (Copilot / Antigravity: closed questions in chat, same rules) **whatever their origin** —
   the planner's `OPEN_QUESTIONS`, C7 conversions, a validator warning routed to `pregunta`,
   sizing — at most **4 questions per round**, 2-4 options each, one `(recomendada)`. The
   resumption question and the single closed question of the cap (step 5) do not count.
   Contract doubts still open after round 2 mean the epic is under-discovered → offer a
   scoped `discover` instead of a third round.
   - **The planner's options go verbatim**, with their `derivadas:` — ask the derived
     sub-decisions of the likely answers in the same round, so round 2 stays optional. You
     may add one line `Dato verificado: <hecho> (<path>)` under a question; if you disagree
     with an option, hand it back to the planner as `CONCERNS` before asking — never rewrite
     it.
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
     ADR. **Commit** those source edits (`docs(requirements): aclaraciones Epic X.Y`) before
     re-dispatching — the delta re-validation diffs them by commit. Record every question,
     answer and `fuente:` in `_planning.md`.
4. **Re-dispatch a fresh planner** — never resume it with `SendMessage` (a resumed planner
   reached 941k tokens of context in a real epic) — with `SPECS_DIR`, `ALCANCE: [task-slugs]`
   (the specs the answers or violations touch) and the `ANSWERS` / `VIOLATIONS` verbatim; it
   edits minimally. **A re-dispatch needs at least one BLOCKER or one user answer** — never
   a WARNING or a NOTE of an APPROVED verdict. **Echo the `CHANGELOG`** to the chat ("así
   quedó — …") without waiting for confirmation. Contrast `git diff --
   docs/05-specs/<epic-slug>/` against the `CHANGELOG`: a diff that exceeds it is a finding
   → re-dispatch with "revertí lo no listado".
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
     finding lines verbatim (step 4). No validator dispatch is spent on evident errors, and
     **FAILs do not count toward the cap** of step 5. The same FAIL line on two passes in a
     row goes back with `CONCERNS: 4a repetido`; a third identical FAIL is `BLOCKED: gate`
     (a framework or grammar defect — escalate with the lines). A `C5 WARNING` is the
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
     is rejected by rule ID before any test is written. A 5b of a spec with `Supersede:` lines
     also carries the ROADMAP checkbox line of each `epic origen` (Dimension 4 checks it is
     closed) — never the test files.
   - **Rounds.** A round is the set of validator dispatches you launch together after a
     planner pass (5a and/or the 5b's — parallel dispatches count **one** round).
   - On `REJECTED` (5a or 5b) → re-dispatch the planner with `VIOLATIONS` (step 4) → 4a →
     **delta re-validation**: 5a again only if the `CHANGELOG` touched `COVERAGE_TABLE`,
     `RESOLVED_ALONE`, a "Fuera de Scope" or a Superficie; 5b only for the specs the
     `CHANGELOG` touched; each one a fresh dispatch in `MODE: DELTA` (validator "Modes")
     with its `PRIOR_VERDICT` verbatim, `DIFF_SPECS` = `git diff <tree_prev> <tree>`,
     `DIFF_SOURCES` = `git diff <sha_prev>..HEAD -- docs/01-requirements/business_requirements.md
     .specture/decisions/` and `LATE_USED` (at most one LATE finding per epic). Keep the
     PRIOR and DIFF files under `.specture/state/gate/<epic-slug>/` for resumption. If `git
     cat-file -e <tree_prev>` fails, validate in full.
   - **APPROVED means advance.** An APPROVED target is never re-validated, re-planned or
     turned into a question because of its WARNINGs or NOTES. Route each observation with
     this closed table (the validator's `destino-sugerido` is a hint; the table decides):

     | Observation | Destination |
     |---|---|
     | a) Form or traceability (C7, C8, IDs) | `## GATE_NOTES` of `_planning.md`, verbatim |
     | b) A "how" on a path the Superficie already declares | `GATE_NOTES` (the sealed path is executed as is; the implementer decides only what does not move `allowed_paths`). Visual and brand (MK-nnn) never go here — reviewer Dim 6 or the visual gate |
     | c) Observable contract doubt | round 2 of step 3 if the budget allows; otherwise the cap menu |
     | d) Missing EC or guard of money, legal or personal data **in the epic's own operations** | contractual — the validator must raise it as BLOCKER; if it came as a warning, it enters round 2 or the next pass. Never deferred |
     | e) Scope outside the epic block | `## DIFERIDOS` of `_planning.md` + a `**Diferidos heredados:**` line on the block of the epic that **owns** it (by component or RN), which its own gate receives as a C3 candidate. **No epic owns it** → `dueño: sin epic` in `## DIFERIDOS`, and offer it **once**, when the queue drains, as a `new-feature` route — never as a question mid-queue |
     | f) `sup-candidato:` | nothing — execution finds it |

   - **Anti-cascade**: if C7 rejects the **same item a second time**, convert it into an
     `OPEN_QUESTION` (back to step 3) — no third attempt between two models arguing over a
     plausible quote.
   - **Cap: 3 rounds without the epic APPROVED** (only BLOCKERs `NOT ADDRESSED` or new keep a
     round alive; 4a FAILs never count) → **one** closed `AskUserQuestion`, its options
     pre-built from the class of each live BLOCKER: ADR → amend the ADR via `architecture` |
     comply literally; contract → `BLOCKED: contrato`; BR vs RN or an internal contradiction
     → scoped `discover` | pick one of the two rules; sizing → split the epic; always →
     pause the epic. "Sellar con riesgo declarado" is offered only for non-semantic classes
     (form, traceability) and is never the recommended option.
   - Record every verdict verbatim under `## VEREDICTOS` with the header
     `### <set | task-slug> — dispatch N — ronda R — <ISO-8601 with time> — tree <sha12> —
     head <sha12> [— delta] [— loop] [— J9]` (parsed by `metrics-report.js` and the
     resumption below).
6. **Summary — always, before committing**: the specs in order, AC/BR/EC counts,
   `operationId`s covered, **every** `RESOLVED_ALONE` decision with its quote, the
   `GATE_NOTES` and the `DIFERIDOS` with their owning epic.
   **Review mode** (only if the user explicitly asked this session, e.g. "construí con
   revisión de specs"): stop here and wait for confirmation in chat. There is no toggle,
   and Plan mode is not used.
7. **Commit** `docs(specs): plan <epic-slug> — N specs validados` (specs +
   `_planning.md`). Before committing, run `spec-set-check.js <epic-dir> --hash-only`: its
   sha must equal the last `MECH_CHECK: PASS` line — a different sha means a planner pass
   was never re-checked → back to 4a. The verdicts are already under `## VEREDICTOS` (step
   5 records each one as it arrives, so an interrupted gate resumes from disk) and ride in
   this commit; after it, append only the commit's `SPEC_SHA` (`## SPEC_SHA`) — that append
   rides with the epic's next commit. `_planning.md` ownership is split
   (`templates/PLANNING_TEMPLATE.md`): the planner wrote `COVERAGE_TABLE` /
   `OPEN_QUESTIONS` / `RESOLVED_ALONE` / `SUPERSESIONES`; you write the sections marked
   *(coordinador)* — answers, `CODE_SURFACE`, `MECH_CHECK`, `VEREDICTOS`, `SPEC_SHA`,
   `GATE_NOTES`, `DIFERIDOS` — sequential writers, never concurrent.
   **Seal the specs** (roadmap items 31/36 — `hooks/README.md` schema v3), right after the
   commit, through the only sanctioned writer:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" write --epic <epic-slug> --spec-sha <SPEC_SHA> \
     --lock-sha <LOCK_SHA> \
     --spec-paths "docs/05-specs/<epic-slug>/*.spec.md" \
     --test-globs "<conventions.md test globs>,<test root, e.g. tests/**>" \
     --allowed-paths "$(node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js" docs/05-specs/<epic-slug> --allowed-paths | paste -sd,)"
   ```
   `spec_paths` makes the validated specs immutable during the epic (hook deny "Spec Seal");
   `allowed_paths` (the union of every `Crea:`/`Modifica:` path — 4a's `C-path` guaranteed
   each one has a path) makes writes outside the declared surface a deny "Allowed Paths"
   (zero code without spec, item 36). `test_globs` must include the conventions test globs
   **and** the test root directory so RED-phase helpers stay writable. No `Crea:`/`Modifica:`
   at all (docs-only epic) → omit `--allowed-paths` and say so in one line. `LOCK_SHA` is
   the commit that marked the epic `[/]` (queue step 5.1) — the base the supersession loop
   runs retroactive REDs against. Never hand-edit `build-locked.json`. The epic-agent later
   **merges** its `specs[]` entries into this file.
8. **`TaskCreate` one task per spec** (subject `<epic-slug> / <task-slug>`, start
   `pending`) — user-visible progress for the epic-agent's Steps 4-8; `ROADMAP.md`
   remains the source of truth.
9. **Dispatch the epic coordinator** (below) with `ENTRY: sealed`, the `SPEC_SHA` and your gate
   counters as `GATE_METRICS` — it dispatches the epic-agent with the verbatim verdict.

**When the planner reports `BLOCKED`** — `sizing` (>3 specs): escalate the suggested
split to the user (it touches `ROADMAP.md`); `contrato`: the epic needs a contract change
→ `architecture`/ADR, never a spec; `contradicción`: escalate for an ADR.

**Human contacts.** With a review stage (v2.3.0) the user's contacts are the batch sitting (rounds 1-2), the announced mini-review of each regulatory epic (an `EPIC_REPORT: MINI_REVIEW` since v2.7.0 — you ask, the epic coordinator never does), the compliance triage at the queue drain (v2.4.0, only when a milestone closed in the batch), and the exceptions listed below; a decision nobody foresaw **parks** the epic instead of asking. Without one, inside the gate there is **one budget**: at most 2 question rounds
(step 3) plus the single closed question of the cap (step 5). After the seal the epic runs
without asking, except for: **`DONE: pendiente de aprobación visual`** (the design-system
foundation epic — you run the gate; routine on any project with a frontend) · `BLOCKED:
sizing` / `contrato` / `contradicción` / `gate` · `BLOCKED: entorno` · `BLOCKED: debug
<slug>` · a protected test in the supersession loop · `BLOCKED` / `REJECTED_MAJOR`
downstream · resumption with unvalidated specs · review mode on request. **An old test
broken by design is not a human contact** — it goes through the supersession loop below.

### The queue loop (in this coordinator chat)

1. Read **only the epic checkbox + `Dependencias` lines** of `ROADMAP.md` (not the whole doc).
2. Build the **queue**: walk the ROADMAP in stable order (earliest epics first) and collect the first **N** epics that will be runnable in dependency order — an epic whose only unmet dependency is an earlier queue member is eligible (it simply runs after it).
3. If no epic is ready and none can be made ready within the queue → dependency cycle, or everything is blocked by an escalated epic. Stop and escalate to the user.
4. `TaskCreate` **one task per queued epic** (subject `<epic-slug>`, `activeForm` "queued"). This is the visible queue; each epic-agent's internal step tracking is discarded with its context.
4.5. **Review stage for the batch (v2.3.0)** — `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review.js" status`. Unless a `CLOSED` register already covers every queued epic, run `build/REVIEW_STAGE.md` for the queue **before** executing anything: one sitting (two rounds at most) where the user takes every decision the machine can foresee; then the queue runs without questions. An epic the review did not cover (a register from before v2.3.0, or the user declined the review for it) goes through the per-epic Spec Planning Gate above, unchanged.
5. **Process the queue one epic at a time** (never concurrently). For each epic, in order:
   1. Mark the epic `[/]` in `ROADMAP.md`; commit (`docs(roadmap): <epic-slug> en curso [/]`, only `ROADMAP.md`). Only ONE epic is `[/]` at any moment. That commit is the epic's **`LOCK_SHA`**: it is recorded as `- LOCK_SHA: <sha> — <ISO-8601>` under `## SPEC_SHA` of `_planning.md` — by you as soon as the file exists in the per-epic gate, by the epic coordinator otherwise.
   2. Set that epic's task `in_progress`.
   3. If the epic is in a `CLOSED` review register → dispatch the **epic coordinator** (below) with `ENTRY: refresh` — it refreshes, seals and executes without questions; otherwise run the **Spec Planning Gate** (above) and, when it completes (specs committed, `SPEC_SHA` recorded), dispatch it with `ENTRY: sealed`. Its `BASE_CONTEXT` is the paths of `.specture/stack.yml`, `.specture/conventions.md`, the ADRs, `docs/01-requirements/business_requirements.md` and `docs/02-architecture/architecture.md` — it reads them and assembles the epic-agent's context itself. Wait for its `EPIC_REPORT` (never poll).
   4. Process the `EPIC_REPORT` (below) before starting the next epic.
6. **Stop when the queue drains** (N epics processed) or a report escalates. Do not pull epics beyond N. Then, **in this order** (each one once, for the whole batch — never between epics):
   1. List the **parked** epics with their pending decision and mark `ESTADO: EJECUTADA` in the review register when every epic is `[x]` or parked.
   2. The `## DIFERIDOS` lines with `dueño: sin epic` (each one a possible `new-feature`).
   3. **Compliance triage (v2.4.0)** — `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" status`; `PENDING` and no epic `[/]` → run `skills/compliance-review/SKILL.md` in `triage` mode (the user decides each finding; the chosen refactors are corrected by its correction agent — never by you). An epic `[/]` (an escalation stopped the queue) leaves it `PENDIENTE` for the next drain.
   4. Step 8.5 (knowledge capture), when N > 1.
   5. If a session branch was created (§13), announce it **last** — so it includes the compliance corrections — and suggest the merge/PR per `W-4`. Specture does not merge for you.

### Epic execution — the epic coordinator (v2.7.0)

Everything that happens to one epic between its lock and its `[x]` — Refresh & seal, the
announced mini-review, parking, the epic-agent and every report it sends back (the supersession
loop, the spec-correction loop, the red-fix), the seal release and the metrics line — is
`build/EPIC_COORDINATOR.md`. You do not run it in this chat: you dispatch it.

**Dispatch** (Claude Code) a general-purpose agent — the session's model — with this prompt and
nothing of this chat's history:

~~~
You are the epic coordinator for ONE epic of a Specture project. Your complete procedure is
${CLAUDE_PLUGIN_ROOT}/skills/build/EPIC_COORDINATOR.md (read it whole). You never ask the user anything: every human decision
goes back to me as an EPIC_REPORT of at most 40 lines.
ENTRY: refresh | sealed | resume | mini-review-answers | visual-adjust
EPIC: <full epic block>
LOCK_SHA: <sha> · REVIEW_REGISTER: <path | none> · REGULATORIO: <sí | no>
SPEC_SHA / GATE_METRICS (ENTRY: sealed) · ANSWERS (mini-review-answers) · VISUAL_FEEDBACK (visual-adjust)
HUMAN_CONTACTS: <n> · BASE_CONTEXT: <paths>
~~~

Launch it in the background — it is asynchronous anyway: **wait for its notification, never poll**. One epic coordinator at a time, and nothing else writes while it runs. If the user writes meanwhile, answer them (a read-only look at `git log` is fine). A dispatch that never comes back — the user says it stalled, or the session was cut — is resumed with `ENTRY: resume`, never by running its steps here.

**Inline mode.** On Copilot and Antigravity (no nested subagents), or when the epic coordinator
answers `NESTING_UNAVAILABLE`, run `build/EPIC_COORDINATOR.md` yourself, here, exactly as written
(skip its Step 0; `coordinator_mode: inline`). It is the v2.6 behaviour with the procedure in its
own file: one source of truth, two possible runners. Say it once per batch: *"sin subagentes
anidados — el coordinador de cada epic corre en este chat"*.

### Processing the EPIC_REPORT

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
  4. **On approval** → append `VISUAL_APPROVAL: <fecha> <sha>` to the epic's `_planning.md` (`<sha>` is HEAD at approval), flip the epic to `[x]` in `ROADMAP.md`, commit both in one commit, release the seal (`seal-cli.js release`) and mark the task `completed`. Then write the epic's metrics line yourself from the counters the last `EPIC_REPORT` carried (the epic coordinator does not write it for a visual-pending epic), with `outcome: DONE` plus `visual_approval_rounds: N`.
  5. **Outright rejection** (the user wants a different direction, not adjustments) → that is a Phase 03 decision, not an epic defect: leave the epic `[/]`, stop the queue and escalate to `ux-design`.
- **`STOPPED — <motivo>`** → escalate to the user with the report's evidence and its closed
  options when it brings them; **stop the queue** until they decide:
  - `scope-changed` → run R1-R5 of `build/REVIEW_STAGE.md` for this one epic (the only case where
    a non-regulatory epic asks), then dispatch again with `ENTRY: refresh`;
  - `gate` (the refresh's cap) → the single closed question of gate step 5 with the options the
    report pre-built;
  - `seal-diff` → show the diff summary; a `[x]` that landed is reverted only on the user's word;
  - `protected` → amending a project invariant is the user's decision;
  - `entorno` → the log; no agent can fix it · `debug <slug>` → offer `/specture:debug` for that
    spec (it needs Plan mode) · `insufficient context` → offer to split the epic ·
    `REJECTED_MAJOR` / other → the summary;
  - `decisión` (a correction loop of a regulatory epic needs a human answer) → ask it with the
    rules of round 2 and dispatch again with `ENTRY: resume`;
  - `reanudación` → the evidence it found; ask which way to continue.
  After the decision, dispatch the epic coordinator again with `ENTRY: resume` (or `refresh`),
  never by running its steps yourself.
- **`NESTING_UNAVAILABLE`** → switch the rest of the batch to inline mode (above) and run this
  epic's `build/EPIC_COORDINATOR.md` from its Step 1 with the same `ENTRY`.
- **A notification that is not an `EPIC_REPORT`** (a late message from a nested dispatch) → it is
  the epic coordinator's business, not yours: note it and keep waiting for the report.

### Metrics

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
`late_findings`, `effort` (`{planner, validator}` as declared, or `null`) — plus the epic-agent
report's `METRICS` values (`needs_context_spec`, `iteration_cap_spec`, `blocked_spec`,
`reviewer_rejected_major_spec_defect`, `review_rejections`, `supersessions`, `supersede_tests`,
`exec_blocked_compile`, `exec_blocked_runtime`, `baseline_failures`), `specs`, `outcome`
(`DONE` | `BLOCKED` | `REJECTED_MAJOR` | `ESCALATED` | `PARKED`),
`source: "gate"`, `plugin`, `batch_id` (an epic of a review register), `parked` (`0`|`1`),
`coordinator_mode` (`subagent` | `inline`), `epic_coordinator_dispatches`, `ts` (ISO-8601 **with
time**), and `tokens: null` unless the user handed you a figure (`{input, output, source}`). For
an epic that went through the per-epic gate above, you pass your gate counters to the epic
coordinator as `GATE_METRICS`. Line schema and reader: `hooks/lib/metrics-report.js`
(`/specture:knowledge stats`). The file is **tracked** (decision A7).

### Why this model

Refresh, seal, loops, tests, implementation and reviews stay inside each epic coordinator and its epic-agent and are discarded when they finish; one epic runs at a time in fresh isolated context, so execution quality never degrades from accumulation. What accumulates in this chat is the review sitting, the per-epic gates of unreviewed epics and one short `EPIC_REPORT` per epic — and everything is written to disk as it goes, so a session can end after any epic (the declared checkpoint above). The bounded batch size N lets the user run a defined set ("ejecuta 3") without committing to the whole ROADMAP.


## Frontend Epics — Design-System-First + Visual Approval Gate

This section is **cross-cutting**: it applies within the sequential-queue model whenever the epic being built is a **frontend epic** (it touches UI and `stack.yml.frontend.framework` is set and not `none`). It does not replace Steps 1-9 — it specializes how they run for UI work, because TDD certifies logic, not look-and-feel.

### Why frontend is different

"Tests pass" never means "it looks and feels right". For frontend, behavior/logic is still tested (component logic, hooks, the typed-client wiring, accessibility assertions where the test framework supports them), but **visual quality is gated by a human, not by tests**. Trying to assert aesthetics in unit tests is wasted effort. So the discipline shifts from "RED→GREEN proves it" to "RED→GREEN proves the logic + the user approves the look".

### Hard ordering (non-negotiable)

Frontend epics must be built in this order — the ROADMAP should already encode it (see `architecture/SKILL.md` Part C, milestone order 7-8):

1. **Design System Foundation epic** — tokens as code + base component library + the **`/dev/design-system` showcase route** (dev-only). Built FIRST.
2. **Visual Approval Gate** — the user approves the showcase. **No page epic may start until this gate passes.**
3. **Page epics** — one screen (or cluster) at a time, each built only **after** the backend epic implementing the `operationId`s it consumes is `[x]`.

If a page epic becomes "ready" before the design-system epic is approved, it is **not** actually ready. Since v2.0.0 that dependency is no longer implicit: `spec-set-check.js` check **C-design** blocks a `Tipo: pagina` epic whose `Tipo: design-system` epic has no `VISUAL_APPROVAL` line in its `_planning.md`. It anchors on the approval record, never on the `[x]` checkbox — the epic-agent writes its own checkbox, so a checkbox proves nothing about the human gate.

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
> The epic-agent stops at it and reports `DONE: pendiente de aprobación visual`; the epic
> coordinator hands it to you as `EPIC_REPORT: VISUAL_PENDING` and you run the gate in
> § "Processing the EPIC_REPORT".

## Step 1 — Pick & Lock the Epic

Done by the **coordinator** in the queue loop (5.1): when an epic-agent starts, its epic is already `[/]` and committed. Epic-agents never run this step. If more than one epic is `[/]`, that is a stale state — the coordinator asks the user which one to continue before dispatching anything.

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
- **One `[/]` outside a review register with no specs** → run the Spec Planning Gate from step 1.
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

## Step 8.7 — Milestone Reconciliation (when a milestone closes)

Run by the **coordinator** (not the epic-agent), only when the epic just marked `[x]` was the **last** of its milestone. This is the reconciliation event: drain from intent (ROADMAP) → reconcile into reality (living behavior).

1. **Detect milestone closure**: after marking the epic `[x]`, check whether **all** epics under its milestone are now `[x]` (read only that milestone's epic checkbox lines). If not, skip this step.
2. **Touched components**: the union of "Componentes de arquitectura involucrados" across the milestone's epics.
3. **Reconcile (incremental)**: for each touched component, update `docs/05-specs/_current/<component-slug>.md` from `templates/CURRENT_CAPABILITY_TEMPLATE.md`:
   - Read the existing `_current/<component>.md` (if any) plus the milestone's specs that touch the component.
   - Merge: add the new BR/AC/EC + contract behavior; move any behavior this milestone supersedes (same `operationId` or same rule subject) down to "Historial / supersesiones"; refresh "Specs de origen" and "Última reconciliación"; set the header `Confianza: spec_reconciled` (a file `knowledge` wrote earlier as `ai_reconciled` / `ai_characterized` is upgraded here — the milestone's validated specs are now its source; `user_confirmed` is left alone).
   - If a supersession overlap is ambiguous, do a **full rebuild** of that component (re-read every spec listed in "Specs de origen" + the new ones).
   - Create `docs/05-specs/_current/` lazily if absent. It is **tracked truth — never gitignored**. If other milestones were already closed **before** `_current/` existed, reconcile only this milestone's components and print once: *⚠ Specture: `_current/` no cubre los milestones cerrados antes — corré `/specture:knowledge reconcile --component <slug>` por cada componente que `/specture:doctor check` liste* (the backfill is a content migration owned by `knowledge reconcile`, one component at a time with Plan-mode approval; never consolidate every past spec here).
3.5. **Compliance review (v2.4.0)** — before the collapse below (a tombstone drops the epic blocks the range is computed from): unless `compliance_review.enabled` is `false` in `.specture/settings.yml` (honoured under every profile), invoke `skills/compliance-review/SKILL.md` in `milestone <N>` mode and **wait for it** (it dispatches the `compliance-reviewer` per chunk — never in parallel with an epic-agent: one writing agent at a time). It commits its report under `docs/07-reviews/` and returns one informational line; it never asks and never blocks the queue — the triage waits for the drain (queue step 6).
4. **Deferred ROADMAP collapse**: collapse to a tombstone any **closed** milestone that is no longer among the **~2 most-recent closed** milestones (fixed threshold, no toggle). Tombstone format + archived-dependency resolution: see `templates/ROADMAP_TEMPLATE.md`.
5. **Commit**: `docs: reconcile <component(s)> + archive milestone <N>`.

> **Why the coordinator**: reconciliation spans the whole milestone's specs (not one epic), so it lives in the coordinator, which transiently loads the milestone's specs. Epic-agents stay focused on their single epic.
> **Backward-compat**: a project that has never reconciled simply has no `_current/` yet; the first milestone closure creates it. Collapse only fires once ≥3 milestones are closed (the ~2 most-recent stay expanded).

## Step 9 — Context Reset Between Epics

Execution resets by construction: each epic runs in a fresh epic coordinator (and its epic-agent) whose context is discarded when it finishes. This chat grows with the review sitting, the per-epic gates and one `EPIC_REPORT` per epic; in inline mode (Copilot, Antigravity, `NESTING_UNAVAILABLE`) it grows with every epic's whole run, so for a long batch the reset is the declared checkpoint of the Execution Model: after an epic closes, the user may end the session and continue with `/specture:start` — the queue, the review register, the gate state and the seal are all on disk.

## Anti-Patterns

The full Anti-Patterns table travels with the epic-agent in `build/EPIC_LOOP.md`, and the epic
coordinator's in `build/EPIC_COORDINATOR.md`. Rows that bind **this coordinator**: never
hand-edit `.specture/state/build-locked.json` (`seal-cli.js` is the only writer — `write` /
`merge-spec` / `lift-spec` / `unseal-spec` / `supersede` / `release`). The epic coordinator
(v2.7.0) adds four: never run its steps here while nested subagents work — refresh, loops and
report processing belong to it (inline only on Copilot, Antigravity or `NESTING_UNAVAILABLE`);
never resume one of its loops yourself after a cut (dispatch it with `ENTRY: resume`); never
poll a dispatch ("sigo esperando") — wait for its notification; never let it ask the user (what
needs the user comes back as an `EPIC_REPORT`). The review stage adds three: never apply a recommended option the user did not choose; never ask during the refresh of a non-regulatory epic (a new decision parks it); never drop a filtered question silently. The compliance review adds two: never fix a compliance finding by dispatching the implementer yourself (its correction agent does, after the user's triage), and never let it ask or stop the queue before the drain. The gate adds three: never resume the planner with `SendMessage` (always a fresh
dispatch per pass); never ask the user or re-plan because of a WARNING or a NOTE of an
APPROVED verdict (route it with the table of step 5); never invoke `skills/debug` from the
queue (it needs Plan mode — report `BLOCKED: debug` and let the user choose). The
git-safety rows bind the coordinator too: never `git add -A` or `git commit --amend`;
never restore with `git checkout -- <archivo>` after a mutation (snapshot to scratch first,
verify with `git hash-object`; the one declared exception is step 2's restore from the
previous TREE); never run two writing agents against the same checkout.

## After Loop Completion

If the ROADMAP reaches 100% `[x]`, route back to `skills/start/SKILL.md` which will offer the user options (audit, new feature, finalize).

> Comportamiento observable con hooks/Context7 activos: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
