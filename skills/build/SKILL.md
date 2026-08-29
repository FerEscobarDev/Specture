---
name: build
description: 'Use when `docs/04-roadmap/ROADMAP.md` exists and contains epics marked `[ ]` (pending) or `[/]` (in progress), or when the user says "construyamos", "sigamos con el roadmap", "implementemos el siguiente epic". Orchestrates a strict per-epic loop: spec → architecture validation → tests → implementation → review → verification → mark complete. Dispatches specialized agents (tdd-test-writer, implementer or ux-implementer for UI, code-reviewer). Frontend epics add a design-system-first order and a human visual-approval gate.'
---

# 04 — Iterative Build (The Build Loop)

You are the **Coordinator** of the build phase. You do NOT write code, tests, reviews, or specs directly. Your job is to:

1. Build the queue of ready epics and lock one at a time.
2. Dispatch one fresh **epic-agent** per epic, whose complete procedure is `build/EPIC_LOOP.md` (spec generation → validation → TDD → review → verification).
3. Process each epic-agent's report before starting the next.
4. Mark progress in `ROADMAP.md` and release the seal.
5. Run the post-epic steps (8.5 learnings, 8.7 reconciliation) and keep your own context O(n_epics).

This skill **fuses** what was previously split into "planificación", "ejecución", and "auditoría". The split was artificial — for AI, those are one tight loop per epic. The file split is coordinator (`SKILL.md`, this file) vs epic loop (`EPIC_LOOP.md`): the epic-agent receives **only** the second, so it never sees queue mechanics it must not run.

## Required Inputs (Read Once at Start)

- `.specture/stack.yml` — for routing decisions and to know testing framework, language, etc.
- `.specture/conventions.md` — for context to pass to agents.
- `.specture/decisions/` — all ADRs.
- `docs/01-requirements/business_requirements.md` — ground truth for business rules.
- `docs/02-architecture/architecture.md` — boundaries.
- `docs/04-roadmap/ROADMAP.md` — what to build next.

## Preconditions (what degrades when an artifact is missing)

| Artifact | If missing |
|---|---|
| `docs/05-specs/_current/` (once ≥ 1 milestone is closed) | Current-State Resolution passes `[]` — validator and reviewer never see the component's current behaviour; Step 8.7 has nothing to merge into. |
| `.specture/docs-index.yml` with `docs_index.enabled` | Docs Index Resolution passes `[]`. |
| The contract file (`stack.yml.api.contract_file`) + its readable companion `docs/02-architecture/api-contract.md` | Validator Dimension 6 cannot run; frontend epics cannot slice the contract. |
| `.specture/settings.yml` | Toggles are read from the legacy `conventions.md` §10; if absent there too, defaults apply (hooks off, knowledge off). |

**Zero silent fallbacks.** Every resolver (in this file and in `build/EPIC_LOOP.md`) keeps its fallback behaviour, but the **first** time in a session it returns empty because the artifact is missing, print one line and continue:

> ⚠ Specture: `<artefacto>` no inicializado — corré `/specture:doctor`

`/specture:doctor check` reports all of these mechanically; `migrate` initialises what can be initialised.

## Cross-Platform Subagent Initialization (Mandatory)

Before proceeding, you must ensure specialized agents are registered in your environment. Check your available tools:
- **If you have the `define_subagent` tool (Antigravity CLI):** You MUST dynamically register the subagents before doing anything else. Read the `name`, `description`, and content (`system_prompt`) of the `AGENT.md` files located in the `agents/` directory (for `architecture-validator`, `tdd-test-writer`, `implementer`, `ux-implementer`, and `code-reviewer`), and call `define_subagent` for each one to make them available to this session.
- **If you do NOT have the `define_subagent` tool (Claude Code):** The agents are already statically registered by the system. You may proceed directly.

## Execution Model — Sequential Queue

There is **one** execution model. This chat is **coordinator only**: it does NOT generate specs, dispatch the 4 workers, or run tests. It builds a queue of epics and dispatches **one fresh epic-agent at a time** (concurrency = 1), processing each report before starting the next. The coordinator's context stays O(n_epics) (only checkboxes + reports), never O(total work) — specs, tests, agent outputs and reviews live inside each epic-agent and are discarded when it finishes.

### How many epics to run (batch size N)

Read **N** from the user's request at the start of the session:

- A number ("ejecuta 3", "construí 2 epics") → **N = that number**.
- No number ("construyamos", "sigamos con el roadmap", "el siguiente") → **N = 1**.
- "todas" / "todo el roadmap" / "hasta terminar" → **N = all pending epics**.

N bounds the session: the coordinator builds a queue of up to N ready epics and **stops when the queue drains** — it does NOT spill over into the rest of the ROADMAP.

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

### The queue loop (in this coordinator chat)

1. Read **only the epic checkbox + `Dependencias` lines** of `ROADMAP.md` (not the whole doc).
2. Build the **queue**: walk the ROADMAP in stable order (earliest epics first) and collect the first **N** epics that will be runnable in dependency order — an epic whose only unmet dependency is an earlier queue member is eligible (it simply runs after it).
3. If no epic is ready and none can be made ready within the queue → dependency cycle, or everything is blocked by an escalated epic. Stop and escalate to the user.
4. `TaskCreate` **one task per queued epic** (subject `<epic-slug>`, `activeForm` "queued"). This is the visible queue; each epic-agent's internal step tracking is discarded with its context.
5. **Process the queue one epic at a time** (never concurrently). For each epic, in order:
   1. Mark the epic `[/]` in `ROADMAP.md`; commit. Only ONE epic is `[/]` at any moment.
   2. Set that epic's task `in_progress`.
   3. Assemble the **base context** (`.specture/stack.yml`, `.specture/conventions.md`, all ADRs, `docs/01-requirements/business_requirements.md`, `docs/02-architecture/architecture.md`, `templates/SPEC_TEMPLATE.md`, and the full text of `build/EPIC_LOOP.md` — **never** this coordinator file) and dispatch one fresh **epic-agent** (below). Wait for its report.
   4. Process the report (below) before starting the next epic.
6. **Stop when the queue drains** (N epics processed) or a report escalates. Do not pull epics beyond N. If a session branch was created (§13), announce it now and suggest the merge/PR per `W-4` — Specture does not merge for you.

### Dispatch the epic-agent

Dispatch a general-purpose agent with a self-contained prompt — **do NOT inherit this chat's history**:

~~~
You are the epic-agent for ONE epic of a Specture project.

Execute Steps 2 through 8 of build/EPIC_LOOP.md (Generate Spec → ... → Mark
Epic Complete) for this single epic. That file is your complete procedure;
the epic is already locked [/] by the coordinator.
Run Step 2.5 (TaskCreate) only for your own internal tracking; the
coordinator owns the user-visible epic task.
Honor every gate: Dispatch Manifest, architecture-validator, RED commit,
TDD Honesty Gate (Step 5.5), code-reviewer, verification.

## Epic
[paste the full epic block from ROADMAP.md]

## Base context
[paste the assembled base context]

## Required final report
Report exactly one of: DONE | BLOCKED | REJECTED_MAJOR
Plus: which specs were built, which tests pass, what remains.
If DONE: update ROADMAP.md to [x] for this epic and commit BEFORE reporting.
~~~

### Coordinator processes the report

- **DONE** → verify the epic is `[x]` in `ROADMAP.md` and the commit landed (don't trust the report — `git log`/read the checkbox). **Release the seal yourself**: delete `.specture/state/build-locked.json` if it still exists and confirm it is gone — do not rely on the epic-agent's Step 8 (a leftover seal blocks the next epic's tests; the hook only fails open on it once no epic is `[/]`). Mark that epic's task `completed`. Continue with the next queued epic.
- **BLOCKED** / **REJECTED_MAJOR** → escalate to the user with the report summary before continuing. Do not auto-retry.
- **BLOCKED: insufficient context** → the epic is too large for one agent. Escalate to the user to consider splitting it before re-dispatching.

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

If a page epic becomes "ready" before the design-system epic is approved, it is **not** actually ready — treat the design-system approval as an implicit dependency of every page epic.

> The per-epic execution of this policy — the design-system epic procedure, the page-epic rules,
> the `ux-implementer` dispatch and the visual approval gate — lives in `build/EPIC_LOOP.md`
> § "Frontend Epics — execution". The epic-agent receives it as part of its procedure.

## Step 1 — Pick & Lock the Epic

Done by the **coordinator** in the queue loop (5.1): when an epic-agent starts, its epic is already `[/]` and committed. Epic-agents never run this step. If more than one epic is `[/]`, that is a stale state — the coordinator asks the user which one to continue before dispatching anything.

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
   - Merge: add the new BR/AC/EC + contract behavior; move any behavior this milestone supersedes (same `operationId` or same rule subject) down to "Historial / supersesiones"; refresh "Specs de origen" and "Última reconciliación".
   - If a supersession overlap is ambiguous, do a **full rebuild** of that component (re-read every spec listed in "Specs de origen" + the new ones).
   - Create `docs/05-specs/_current/` lazily if absent. It is **tracked truth — never gitignored**. If other milestones were already closed **before** `_current/` existed, reconcile only this milestone's components and print once: *⚠ Specture: `_current/` no cubre los milestones cerrados antes — corré `/specture:doctor`* (the backfill is a content migration owned by `knowledge reconcile`; never consolidate every past spec here).
4. **Deferred ROADMAP collapse**: collapse to a tombstone any **closed** milestone that is no longer among the **~2 most-recent closed** milestones (fixed threshold, no toggle). Tombstone format + archived-dependency resolution: see `templates/ROADMAP_TEMPLATE.md`.
5. **Commit**: `docs: reconcile <component(s)> + archive milestone <N>`.

> **Why the coordinator**: reconciliation spans the whole milestone's specs (not one epic), so it lives in the coordinator, which transiently loads the milestone's specs. Epic-agents stay focused on their single epic.
> **Backward-compat**: a project that has never reconciled simply has no `_current/` yet; the first milestone closure creates it. Collapse only fires once ≥3 milestones are closed (the ~2 most-recent stay expanded).

## Step 9 — Context Reset Between Epics

In the sequential-queue model this is **automatic**: each epic runs in a fresh epic-agent whose context is discarded when it finishes, and the coordinator only ever holds checkboxes + queued epic blocks + reports (O(n_epics)). There is no cross-epic accumulation to clear — the structural isolation **is** the reset.

For a very large batch (high N) processed in a single coordinator session, the user may optionally start a fresh coordinator session between batches to keep the coordinator lean. No manual reset is needed between individual epics.

## Anti-Patterns

The full Anti-Patterns table travels with the epic-agent in `build/EPIC_LOOP.md`. The
git-safety rows bind **this coordinator too**: never `git add -A` or `git commit --amend`;
never restore with `git checkout -- <archivo>` after a mutation (snapshot to scratch first,
verify with `git hash-object`); never run two writing agents against the same checkout.

## After Loop Completion

If the ROADMAP reaches 100% `[x]`, route back to `skills/start/SKILL.md` which will offer the user options (audit, new feature, finalize).

> Comportamiento observable con hooks/Context7 activos: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
