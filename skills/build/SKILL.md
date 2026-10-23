---
name: build
description: 'Use when `docs/04-roadmap/ROADMAP.md` exists and contains epics marked `[ ]` (pending) or `[/]` (in progress), or when the user says "construyamos", "sigamos con el roadmap", "implementemos el siguiente epic". Orchestrates a strict per-epic loop: spec → architecture validation → tests → implementation → review → verification → mark complete. Dispatches specialized agents (tdd-test-writer, implementer or ux-implementer for UI, code-reviewer). Frontend epics add a design-system-first order and a human visual-approval gate.'
---

# 04 — Iterative Build (The Build Loop)

You are the **Coordinator** of the build phase. You do NOT write code, tests, reviews, or specs directly. Your job is to:

1. Build the queue of ready epics and, **review the batch with the user in one sitting** (`build/REVIEW_STAGE.md`) before executing it; then lock one epic at a time.
2. Run the **Spec Planning Gate** per epic for an epic the review did not cover: dispatch the `spec-planner`, resolve its open questions with the user (one budget of two rounds), validate by rounds, commit the specs + `_planning.md`.
3. Dispatch one fresh **epic coordinator** per epic (`build/EPIC_COORDINATOR.md`): it refreshes and seals the specs, dispatches the **epic-agent** (`build/EPIC_LOOP.md`: TDD → review → verification), runs every loop its reports need — the **supersession loop** included, which fixes old tests broken by design without asking the user — releases the seal and writes the metrics, and hands you back a short `EPIC_REPORT`. It never asks: what needs the user comes back to you.
4. Process each `EPIC_REPORT` before starting the next epic.
5. Run the post-epic steps (8.5 learnings, 8.7 reconciliation).

This skill **fuses** what was previously split into "planificación", "ejecución", and "auditoría". The split was artificial — for AI, those are one tight loop per epic. The file split is coordinator (`SKILL.md`, this file) vs epic loop (`EPIC_LOOP.md`): the epic-agent receives **only** the second, so it never sees queue mechanics it must not run.

## How this skill is organised (read lazily)

This file holds what every session needs: inputs, preconditions, the execution model, the
frontend policy and the anti-patterns. The procedures live in companions you open **when you
reach them**, not before — each one says at its top when it applies:

| File | Open it when |
|---|---|
| `build/QUEUE.md` | You are about to process epics: the queue loop, the epic coordinator dispatch, `EPIC_REPORT` processing, crash recovery of a `[/]`, Steps 8.5 / 8.7, the metrics line. **Always, before the first epic.** |
| `build/PLANNING_GATE.md` | The queue hands you an epic that no `CLOSED` review register covers (QUEUE step 5.3). |
| `build/REVIEW_STAGE.md` | The queue has epics without a `CLOSED` register and the batch sitting runs (QUEUE step 4.5). |
| `build/EPIC_COORDINATOR.md` | Only to run it **inline** (no nested subagents). Otherwise you dispatch it and never read it. |
| `build/EPIC_LOOP.md` | Never in this chat — the epic-agent's procedure. The resolvers it defines (Rules, Docs Index, Design Surface) are cited from here by name. |

## Required Inputs (Read Once at Start)

- `.specture/stack.yml` — for routing decisions and to know testing framework, language, etc.
- `.specture/conventions.md` — for context to pass to agents.
- `.specture/rules.yml` — the project invariants `R-*`; never passed whole — resolved per dispatch by "Rules Resolution" (`build/EPIC_LOOP.md`) into a `RULES_RESOLVED` block. Absent = `RULES_RESOLVED: []`.
- `.specture/review-rules.md` — the team's custom review criteria (opt-in); never passed whole — resolved per dispatch by "Custom Rules Resolution" (`build/EPIC_LOOP.md`) into a `CUSTOM_RULES` block. Absent = `CUSTOM_RULES: []`.
- `.specture/decisions/` — all ADRs.
- `docs/01-requirements/business_requirements.md` — ground truth for business rules.
- `docs/02-architecture/architecture.md` — boundaries.
- `docs/04-roadmap/ROADMAP.md` — what to build next.
- The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` — to slice each epic's `operationId`s for the `spec-planner`.
- `templates/SPEC_TEMPLATE.md` / `templates/MIGRATION_SPEC_TEMPLATE.md` — handed to the `spec-planner` per the epic's `Template:` field.
- `templates/PLANNING_TEMPLATE.md` — the grammar of `docs/05-specs/<epic>/_planning.md` (`COVERAGE_TABLE`, `MECH_CHECK`, verdicts, `SPEC_SHA`); handed to the `spec-planner` and parsed by `hooks/lib/spec-set-check.js`.
- `templates/BATCH_REVIEW_TEMPLATE.md` + `build/REVIEW_STAGE.md` — the batch review register (`docs/05-specs/_reviews/<id>.md`, read by `hooks/lib/review.js`) and the procedure of the review stage (queue step 4.5).
- `build/EPIC_COORDINATOR.md` — the procedure of one epic from lock to `[x]`: you dispatch it as a subagent, or run it inline when nested subagents are unavailable.

**Read lazily.** With nested subagents this chat only needs what it runs: the queue reads checkbox + `Dependencias` lines; the review stage and the per-epic gate read the sources they name when they run; an epic of a `CLOSED` register needs none of them here — the epic coordinator reads its own. Read `build/EPIC_COORDINATOR.md` only to run it inline.

## Preconditions (what degrades when an artifact is missing)

| Artifact | If missing |
|---|---|
| `.specture/docs-index.yml` with `docs_index.enabled` | Docs Index Resolution passes `[]`. |
| `.specture/rules.yml` | Rules Resolution passes `RULES_RESOLVED: []` — implementer and reviewer see no project invariants (Dimension 7 no-op). A project whose `conventions.md` §12 still holds the old table is not migrated: the resolver injects those rules whole (unfiltered, as before v1.19.0) and warns; `/specture:doctor migrate` (`1.19-rules-file`) moves them and turns the tag filter on. |
| `.specture/review-rules.md` (opt-in) | Custom Rules Resolution passes `CUSTOM_RULES: []` and the compliance review checks Specture's rules only. Opt-in, so its absence prints **no** warning. A file with errors stops the dispatch (resolver exit 1) — `/specture:doctor check` names the line. |
| The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` | Validator Dimension 6 cannot run; frontend epics cannot slice the contract. |
| `.specture/settings.yml` | Toggles are read from the legacy `conventions.md` §10; if absent there too, defaults apply (hooks off, knowledge off). |
| `stack.yml` → `quality.commands` with `test` / `test_scoped` `sin definir` | The epic-agent, the writer and the implementer run the narrowest test run their runner offers and report it as `SKIPPED`; `red-check commands`, `LINT_REPORT` and `MUTATION_REPORT` are `SKIPPED` / `(none)`. With `test` defined, the full suite runs only via `quality.js run test --log` at Step 3.9 / 7 (with hooks, the Suite Guard denies it elsewhere). Say it **once per batch, before the first epic**: *"`quality.commands` sin definir (<slots>) — corré `/specture:setup` (reconfigure) o completalos en `stack.yml`; hasta entonces los chequeos mecánicos quedan SKIPPED"* — `scripts/doctor.js check --brief` lists the slots under `config pendiente`. |
| Node ≥ 22 on `PATH` | Gate step 4a falls back to the three `grep` checks (`MECH_CHECK: MANUAL`); the seal cannot be written (`seal-cli.js`) — and the hooks, node scripts themselves, are inert anyway — so the epic runs without mechanical denies: the `git diff <RED_SHA>..HEAD` of Step 5.5, the `git diff <SPEC_SHA>..HEAD` of report processing and reviewer Dimension 1 remain the defenses; `metrics-report.js` cannot run (the metrics line is still appended by hand). Say it once: *"Node ≥ 22 no disponible — sin sello ni chequeo mecánico; quedan los git diff"*. |
| `templates/PLANNING_TEMPLATE.md` (framework file) | The planner cannot write `_planning.md` with the parseable grammar → 4a `UNVERIFIABLE`. A missing framework template is a broken install — reinstall the plugin; never hand-write the grammar. |

**Zero silent fallbacks.** Every resolver (in this file and in `build/EPIC_LOOP.md`) keeps its fallback behaviour, but the **first** time in a session it returns empty because the artifact is missing, print one line and continue:

> ⚠ Specture: `<artefacto>` no inicializado — corré `/specture:doctor`

`/specture:doctor check` reports all of these mechanically; `migrate` initialises what can be initialised.

## Cross-Platform Subagent Initialization (Mandatory)

Before proceeding, you must ensure specialized agents are registered in your environment. Check your available tools:
- **If you have the `define_subagent` tool (Antigravity):** register the subagents before doing anything else. For each of `spec-planner`, `architecture-validator`, `tdd-test-writer`, `implementer`, `ux-implementer`, `code-reviewer` and `compliance-reviewer`, read `name`, `description` and the body (`system_prompt`) of `agents/<name>/AGENT.md` and call `define_subagent` with the flags below — they default to `false`, and a writer without `enable_write_tools` cannot create a test file or run a suite:

  | Agent | `enable_write_tools` | `enable_mcp_tools` | `enable_subagent_tools` |
  |---|---|---|---|
  | `architecture-validator`, `specture-router` | false | false | false |
  | `spec-planner`, `tdd-test-writer`, `implementer`, `code-reviewer`, `compliance-reviewer` | true | false | false |
  | `ux-implementer` | true | true (only if the project uses a design canvas or Playwright MCP) | false |
  | the epic coordinator (a general-purpose agent running `build/EPIC_COORDINATOR.md`) | true | false | true — it dispatches the epic-agent, which dispatches the workers |

  The frontmatter `tools` and `effort` do not travel with `define_subagent`: the validator is held to read-only by the rule in its body, and nobody runs at `effort: medium` unless the session sets it.
- **If you do NOT have `define_subagent` (Claude Code):** the agents are registered by the plugin. Proceed.
- **Script paths:** every `node "${CLAUDE_PLUGIN_ROOT}/…"` in this file and in `build/EPIC_LOOP.md` (`hooks/lib/spec-set-check.js`, `hooks/lib/seal-cli.js`, `hooks/lib/metrics-report.js`, `scripts/doctor.js`) is `${PLUGIN_ROOT}` on Antigravity and `$SPECTURE_ROOT` in manual `@import` setups — the same rule as `start` Step 0. (On Antigravity the variable exists inside hook processes only: in `run_command` resolve the plugin root from the path of the `SKILL.md` you just read — two directories up — or from `~/.gemini/config/plugins/specture`.)

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

## Frontend Epics — Design-System-First + Visual Approval Gate

This section is **cross-cutting**: it applies within the sequential-queue model whenever the epic being built is a **frontend epic** (it touches UI and `stack.yml.frontend.framework` is set and not `none`). It does not replace Steps 1-9 — it specializes how they run for UI work, because TDD certifies logic, not look-and-feel.

### Why frontend is different

"Tests pass" never means "it looks and feels right". For frontend, behavior/logic is still tested (component logic, hooks, the typed-client wiring, accessibility assertions where the test framework supports them), but **visual quality is gated by a human, not by tests**. Trying to assert aesthetics in unit tests is wasted effort. So the discipline shifts from "RED→GREEN proves it" to "RED→GREEN proves the logic + the user approves the look".

### Hard ordering (non-negotiable)

Frontend epics must be built in this order — the ROADMAP should already encode it (see `architecture/SKILL.md` Part C, milestone order 7-8):

1. **Design System Foundation epic** — tokens as code + base component library + the **`/dev/design-system` showcase route** (dev-only). Built FIRST.
2. **Visual Approval Gate** — the user approves the showcase. **No page epic may start until this gate passes.**
3. **Page epics** — one screen (or cluster) at a time, each built only **after** the backend epic implementing the `operationId`s it consumes is `[x]`.

If a page epic becomes "ready" before the design-system epic is approved, it is **not** actually ready. That dependency is no longer implicit: `spec-set-check.js` check **C-design** blocks a `Tipo: pagina` epic whose `Tipo: design-system` epic has no `VISUAL_APPROVAL` line in its `_planning.md`. It anchors on the approval record, never on the `[x]` checkbox — the epic-agent writes its own checkbox, so a checkbox proves nothing about the human gate.

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
> `build/QUEUE.md` § "Processing the EPIC_REPORT".

## Step 9 — Context Reset Between Epics

Execution resets by construction: each epic runs in a fresh epic coordinator (and its epic-agent) whose context is discarded when it finishes. This chat grows with the review sitting, the per-epic gates and one `EPIC_REPORT` per epic; in inline mode (Antigravity without `invoke_subagent`, `NESTING_UNAVAILABLE`) it grows with every epic's whole run, so for a long batch the reset is the declared checkpoint of the Execution Model: after an epic closes, the user may end the session and continue with `/specture:start` — the queue, the review register, the gate state and the seal are all on disk.

## Anti-Patterns

The full Anti-Patterns table travels with the epic-agent in `build/EPIC_LOOP.md`, and the epic
coordinator's in `build/EPIC_COORDINATOR.md`. Rows that bind **this coordinator**: never
hand-edit `.specture/state/build-locked.json` (`seal-cli.js` is the only writer — `write` /
`merge-spec` / `lift-spec` / `unseal-spec` / `supersede` / `release`). The epic coordinator adds four: never run its steps here while nested subagents work — refresh, loops and
report processing belong to it (inline only without nested subagents or on `NESTING_UNAVAILABLE`);
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
