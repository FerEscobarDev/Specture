---
name: build
description: Use when `docs/04-roadmap/ROADMAP.md` exists and contains epics marked `[ ]` (pending) or `[/]` (in progress), or when the user says "construyamos", "sigamos con el roadmap", "implementemos el siguiente epic". Orchestrates a strict per-epic loop: spec → architecture validation → tests → implementation → review → verification → mark complete. Dispatches specialized agents (tdd-test-writer, implementer or ux-implementer for UI, code-reviewer). Frontend epics add a design-system-first order and a human visual-approval gate.
---

# 04 — Iterative Build (The Build Loop)

You are the **Orchestrator** of the build phase. You do NOT write code, tests, or reviews directly. Your job is to:

1. Pick the next epic.
2. Generate the spec.
3. Dispatch the right agent at the right time with the right (restricted) context.
4. Verify each step before moving on.
5. Mark progress in `ROADMAP.md`.
6. Reset context between epics.

This skill **fuses** what was previously split into "planificación", "ejecución", and "auditoría". The split was artificial — for AI, those are one tight loop per epic.

## Required Inputs (Read Once at Start)

- `.specture/stack.yml` — for routing decisions and to know testing framework, language, etc.
- `.specture/conventions.md` — for context to pass to agents.
- `.specture/decisions/` — all ADRs.
- `docs/01-requirements/business_requirements.md` — ground truth for business rules.
- `docs/02-architecture/architecture.md` — boundaries.
- `docs/04-roadmap/ROADMAP.md` — what to build next.

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

### The queue loop (in this coordinator chat)

1. Read **only the epic checkbox + `Dependencias` lines** of `ROADMAP.md` (not the whole doc).
2. Build the **queue**: walk the ROADMAP in stable order (earliest epics first) and collect the first **N** epics that will be runnable in dependency order — an epic whose only unmet dependency is an earlier queue member is eligible (it simply runs after it).
3. If no epic is ready and none can be made ready within the queue → dependency cycle, or everything is blocked by an escalated epic. Stop and escalate to the user.
4. `TaskCreate` **one task per queued epic** (subject `<epic-slug>`, `activeForm` "queued"). This is the visible queue; each epic-agent's internal step tracking is discarded with its context.
5. **Process the queue one epic at a time** (never concurrently). For each epic, in order:
   1. Mark the epic `[/]` in `ROADMAP.md`; commit. Only ONE epic is `[/]` at any moment.
   2. Set that epic's task `in_progress`.
   3. Assemble the **base context** (`.specture/stack.yml`, `.specture/conventions.md`, all ADRs, `docs/01-requirements/business_requirements.md`, `docs/02-architecture/architecture.md`, `templates/SPEC_TEMPLATE.md`, and the full text of this `build/SKILL.md`) and dispatch one fresh **epic-agent** (below). Wait for its report.
   4. Process the report (below) before starting the next epic.
6. **Stop when the queue drains** (N epics processed) or a report escalates. Do not pull epics beyond N.

### Dispatch the epic-agent

Dispatch a general-purpose agent with a self-contained prompt — **do NOT inherit this chat's history**:

~~~
You are the build-loop orchestrator for ONE epic of a Specture project.

Execute Steps 2 through 8 of build/SKILL.md (Generate Spec → ... → Verify)
for this single epic. SKIP these:
- "Execution Model" — you build exactly this one epic.
- Step 1 (Pick & Lock) — the epic is already marked [/].
- Step 9 (Context Reset) — N/A, your context is discarded when you finish.
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

- **DONE** → verify the epic is `[x]` in `ROADMAP.md` and the commit landed (don't trust the report — `git log`/read the checkbox). Mark that epic's task `completed`. Continue with the next queued epic.
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

### The Design System Foundation epic

When the locked epic is the design-system foundation:

1. **Generate the spec(s)** as usual (Step 2), sourced from `docs/03-ux-ui/design_system.md`. The spec covers: token definitions (color/type/spacing/radii/shadows in the stack's token mechanism), the base components the navigation map implies (with variants/states/a11y), and the dev showcase route.
2. **Dispatch the `ux-implementer` agent** (`agents/ux-implementer/AGENT.md`), NOT the generic `implementer`. Pass it: the spec, `design_system.md`, the relevant tokens/brand rules, any failing tests (component logic / a11y), and — if a Claude Design handoff was ingested — the fidelity checklist from `handoff-ingest`.
3. The agent builds tokens + components + a **`/dev/design-system` page** (guarded so it only mounts in development) that renders every component in every variant/state, the full token palette, and type/spacing scales.
4. **Visual Approval Gate (mandatory human gate):**
   - If Playwright MCP is available in the session, navigate to the running `/dev/design-system` route and capture screenshots so the user can review without leaving the chat. If it is not available, instruct the user how to run the app and open the route.
   - Present the showcase to the user and ask explicitly: *"¿Apruebas el design system para construir las páginas sobre esta base, o quieres ajustes?"*
   - **Do not mark the epic `[x]`, and do not start any page epic, until the user approves.** Approval is a human decision; Claude never self-certifies visual quality.
   - Iterate on adjustments through the `ux-implementer` until approved.
5. The standard gates still run on the logic/code: architecture-validator on the spec, RED/GREEN for any tested logic, TDD Honesty Gate, code-reviewer (with the frontend dimension), verification. The visual approval is **in addition to**, not instead of, these.

### Page epics

For each page/screen epic (after the design-system gate passed):

- **Dispatch `ux-implementer`**, not the generic `implementer`.
- The UI consumes the backend strictly through the **typed API client generated from `api-contract.openapi.yaml`** — never hand-written URLs. The spec declares which `operationId`s the page consumes (Step 2).
- Tests (RED) cover the page's logic and contract binding: it calls the right operations, handles loading/empty/error states, enforces role-based visibility, and meets a11y assertions the framework can check. They do **not** assert pixel aesthetics.
- The code-reviewer runs its frontend dimension (token adherence, a11y, contract adherence, brand-rule fidelity).
- A lightweight visual check (screenshot via Playwright if available) is encouraged per page but the binding gate was the design-system approval; per-page screenshots are for catching regressions, surfaced to the user when notable.

## Step 1 — Pick & Lock the Epic

- Read `ROADMAP.md`.
- Find the first epic with state `[ ]` whose dependencies are all `[x]`. (Don't break dependency order.)
- If multiple epics with state `[/]` exist, that's a stale state — ask the user which one to continue.
- Update the chosen epic to `[/]`. Commit `ROADMAP.md`.

## Step 2 — Generate Spec(s)

For the chosen epic, decompose into 1-3 specs. Each spec must be:

- **Granular**: implementable in 1-3 commits, ~1 AI session.
- **Code-free**: zero code examples, zero language-specific snippets. Only rules, contracts, and test descriptions.
- **Self-contained**: contains all the info the implementer needs without re-reading the requirements doc.

Use `templates/SPEC_TEMPLATE.md`. Write to `docs/05-specs/<epic-slug>/<task-slug>.spec.md`.

### Spec self-review

Before passing the spec to the validator, check against the `SPEC_TEMPLATE.md` slots:

- [ ] Every template slot filled — no `[placeholder]`, no `TBD`, no "fill in later".
- [ ] Every AC / BR / EC has a stable ID (`AC-1`, `BR-1`, `EC-1`...).
- [ ] Contract table complete: entradas, salidas (éxito), salidas (error), efectos secundarios, idempotencia.
- [ ] "Superficie de Código Existente" filled with **exact signatures** of every existing symbol the implementation will call (not "see the code"). This is what lets the implementer skip exploration.
- [ ] "Fuera de Scope" explicit (the test-writer uses it to bound test generation).
- [ ] All business rules cited from `business_requirements.md`.
- [ ] Acceptance criteria are concrete and testable (not "should work well").
- [ ] Zero implementation code; business prose in Spanish, identifiers/signatures in the `conventions.md` §8 language.

## Step 2.5 — Create Visible Tasks (TaskCreate)

After the specs for the epic are generated (Step 2), create one `TaskCreate` per spec so the user has live visibility into the loop. Subject format: `<epic-slug> / <task-slug>` with a brief description summarizing what the spec implements. Start each task as `pending`.

The lifecycle of each task mirrors the orchestrator's progress through the remaining steps for that spec:

| Internal step | Task status / `activeForm` |
|---------------|----------------------------|
| Step 3 — architecture-validator dispatch | `in_progress` — "validating architecture" |
| Step 4 — tdd-test-writer dispatch | `in_progress` — "writing tests (RED)" |
| Step 5 — implementer dispatch | `in_progress` — "implementing (GREEN)" |
| Step 5.5 — TDD Honesty Gate | `in_progress` — "verifying TDD honesty" |
| Step 6 — code-reviewer dispatch | `in_progress` — "code review" |
| Step 7 — verify (fresh test run + lint) | `in_progress` — "running verification" |
| Step 8 — epic marked [x] | `completed` |
| Any `REJECTED_MAJOR` / `BLOCKED` | `in_progress` with an `activeForm` that surfaces the blocker (e.g. "blocked: spec ambiguity") |

**Rule of authority**: `ROADMAP.md` is the source of truth across conversations. TaskCreate is **intra-conversation visibility only** — when the user closes the session, the tasks disappear. If ROADMAP and TaskCreate diverge for any reason, ROADMAP wins. Never mark an epic `[x]` in ROADMAP based on TaskCreate state; mark tasks completed only after the ROADMAP update lands.

## Dispatch Manifest (mandatory pre-flight)

Before Step 4 (tdd-test-writer) and Step 5 (implementer), the orchestrator MUST assemble and pass this manifest. The dispatched agent validates it as its first action (its Step 0) and returns `NEEDS_CONTEXT` immediately if any item is missing — a cheap turn-1 failure instead of an expensive partial-work round-trip.

**For tdd-test-writer:**
- [ ] Spec with every slot filled (no `[placeholder]`, no `TBD`)
- [ ] Every AC / BR / EC has a stable ID
- [ ] `stack.yml`: testing_framework + language present
- [ ] `conventions.md`: testing + naming + file-org + §8 (identifier language) present
- [ ] Existing fixtures/helpers paths listed (so tests don't duplicate them)
- [ ] Relevant docs from `docs-index.yml` resolved (see "Docs Index Resolution" below) — empty list is valid if the index does not exist or no entries match the spec

**For implementer:**
- [ ] Spec (same completeness as above)
- [ ] RED test file contents + test path globs + `RED_SHA`
- [ ] Spec's "Superficie de Código Existente" section carries the **exact signatures** of every existing symbol the implementation will call
- [ ] `stack.yml` + `conventions.md` + all ADRs
- [ ] Relevant docs from `docs-index.yml` resolved (see "Docs Index Resolution" below)

If the orchestrator cannot fill an item, it resolves it BEFORE dispatch (read the file, extract the signature). Dispatching with an incomplete manifest is the #1 cause of `NEEDS_CONTEXT` round-trips — each one wastes a full agent cycle.

## Docs Index Resolution (pre-flight, reusable)

When `.specture/docs-index.yml` exists, the orchestrator MUST resolve relevant entries and pass the resulting documents as input to `architecture-validator` (Step 3) and `code-reviewer` (Step 6). Optionally also to `tdd-test-writer` and `implementer` if their dispatch manifest item resolves a non-empty list.

> **Doctrine — preserve restricted-context principle**: the agents NEVER read `docs-index.yml` themselves. The orchestrator resolves the index and hands the agents the final list of documents as part of their input. This keeps agents cache-friendly, deterministic, and auditable.

### Resolution algorithm

1. **Check existence**: if `.specture/docs-index.yml` does not exist, the resolved list is **empty**. Continue without docs-index input. Do NOT block dispatch.

2. **Check toggle**: if `.specture/conventions.md` Section 10 has `docs_index.enabled: false`, resolved list is empty. Continue without input.

3. **Read cap**: read `docs_index.max_entries_per_dispatch` from `.specture/conventions.md` Section 10. Fallback to **3** if absent or unparseable. This is the hard maximum number of entries passed to a single agent dispatch.

4. **Extract spec signals**: from the current spec, derive:
   - **Tags**: union of (a) the touched module name(s), (b) the architectural component(s) cited, (c) `backend` / `frontend` / `mobile` derived from the spec's contract section, (d) any explicit `tags` field if the spec template includes one.
   - **Concepts** (optional): any explicit concept slugs the spec author wrote.

5. **Filter entries** in `docs-index.yml`:
   - Drop entries with `superseded_by` set to a non-null value.
   - Score each remaining entry by: `+2 per tag intersection`, `+3 per explicit concept match`, `+1 if confidence is user_confirmed`.
   - Drop entries with score 0.

6. **Rank and cap**: sort by score descending. Take top `max_entries_per_dispatch`. **Prefer `user_confirmed` over `ai_categorized`** when scores tie.

7. **Read the resolved files**: for each surviving entry, read its `file` and prepare for dispatch. If the file does not exist (drift between index and disk), log a warning and skip that entry; the next `/specture:audit-knowledge` run will report the drift.

8. **Log the resolution** to `docs/.specture-meta/index-usage.jsonl` (create the directory if absent, append-only, never block dispatch on log failure). One JSON object per line:

   ```json
   {"ts":"<ISO-8601>","skill":"build","step":"3|6","epic":"<slug>","spec":"<slug>","agent":"architecture-validator|code-reviewer","queried_tags":["..."],"queried_concepts":["..."],"resolved":[{"concept":"...","file":"...","confidence":"...","score":N}],"total_in_index":N}
   ```

### When the resolved list is empty

- For `architecture-validator` and `code-reviewer`: dispatch normally. The agents already work correctly without docs-index input — it's strictly additive context.
- The Dispatch Manifest item is satisfied by **"empty list — no matching entries"** (explicitly state this in the dispatch payload so the agent knows the resolver ran and found nothing, vs being silently dropped).

## Step 3 — Architecture Validation (mandatory gate)

Dispatch the `architecture-validator` agent (`agents/architecture-validator/AGENT.md`).

**Pre-flight**: run "Docs Index Resolution" (see section above) for this spec. Capture the resolved entries list (may be empty).

**Context to pass (restricted)**:
- The new `.spec.md` content.
- `.specture/stack.yml`.
- `.specture/decisions/` (all ADRs).
- The relevant section of `architecture.md`.
- **Resolved docs from `docs-index.yml`** (the list from pre-flight, including each entry's `concept`, `file`, `read_when`, `tags`, `confidence`, and the file's content). If the list is empty, pass the explicit marker `docs_index_resolved: []` so the agent knows the resolver ran. Treat `ai_categorized` entries as informational context — the validator only binds against `Accepted` ADRs, not against indexed docs.

**Expected output**: `APPROVED` or `REJECTED` with a list of violations.

If `REJECTED`:
- Either fix the spec (most common) and re-dispatch.
- Or, if the rejection reveals a flaw in the architecture itself, escalate to the user and consider a `reconfigure` (new ADR).

## Step 4 — Write Tests (TDD RED phase)

Dispatch the `tdd-test-writer` agent (`agents/tdd-test-writer/AGENT.md`).

**First assemble the Dispatch Manifest** (see "Dispatch Manifest" section above). Do not dispatch until every tdd-test-writer item is checked.

**Context to pass (restricted)**:
- The validated `.spec.md`.
- `.specture/stack.yml` (specifically `testing_framework` for backend or frontend, depending on what the spec covers).
- `.specture/conventions.md` testing section.
- **NOT** any existing implementation files. The agent must be blind to implementation to avoid biasing tests toward existing behavior.

**Expected output**: test file(s) at the path indicated by conventions, all currently failing (RED), **committed by the agent in a single RED commit**, and the SHA of that commit reported as `RED_SHA`.

**Orchestrator post-checks (all mandatory)**:

1. **Verify failure reason**: run the tests yourself and confirm they fail for the right reason ("function not defined" / "wrong return value"), not because of syntax errors or missing dependencies.
2. **Verify the RED commit exists and is clean**:
   ```
   git show --stat <RED_SHA>
   ```
   The commit MUST contain only test files (paths matching `conventions.md` test globs). If the commit touches any production code, abort — re-dispatch `tdd-test-writer` with a clear instruction to commit tests in isolation.
3. **Capture `RED_SHA`** for use in Step 5.5 and Step 6. This is now the immutable reference point for the test contract.
4. **Capture the test path globs** from `conventions.md` (e.g. `**/*.test.ts`, `tests/**/*.py`). Both Step 5.5 and the code-reviewer need them.
5. **Seal the test contract via state file** (enables the TDD Honesty Gate hook). Write `.specture/state/build-locked.json`:
   ```json
   {
     "epic": "<epic-slug>",
     "red_sha": "<RED_SHA>",
     "test_paths": ["<glob1>", "<glob2>"],
     "locked_at": "<ISO-8601 timestamp>"
   }
   ```
   If the user opted in to hooks (`hooks.enabled: true` in `.specture/conventions.md`), `hooks/pre-tool-use-tdd-gate.js` will use this file to deny any Edit/Write that targets a sealed test path until the epic is marked complete. The orchestrator-side `git diff` check in Step 5.5 still runs as defense-in-depth.

If any post-check fails, do NOT proceed to Step 5.

## Step 5 — Implement (TDD GREEN phase)

Dispatch the `implementer` agent (`agents/implementer/AGENT.md`).

> **Frontend epics:** dispatch `agents/ux-implementer/AGENT.md` instead, and follow "Frontend Epics — Design-System-First + Visual Approval Gate" above. The design-system epic adds the visual approval gate; page epics consume the typed API client generated from the contract. Everything else in this step (manifest, sealed tests, separate commits, status protocol) applies identically.

**First assemble the Dispatch Manifest** (see "Dispatch Manifest" section above). Do not dispatch until every implementer item is checked.

**Context to pass**:
- The `.spec.md`.
- The test files just written (as content reference — the implementer must NOT edit them).
- The `RED_SHA` value, with an explicit instruction: *"The tests committed at `<RED_SHA>` are the sealed contract. You must NOT modify, delete, skip, rename, or move any of those test files. The TDD Honesty Gate will run `git diff <RED_SHA>..HEAD -- <test-globs>` after your work and any change will abort the spec."*
- `.specture/stack.yml`, `.specture/conventions.md`, all ADRs.
- The **exact signatures** of existing symbols the implementation will call — already captured in the spec's "Superficie de Código Existente" section (do not make the implementer rediscover an API by reading files) — PLUS the minimum set of source files to actually modify (NOT the whole codebase).

**Expected output**: minimal code to make tests pass; agent commits implementation in commits **separate from the RED commit**; reports status `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`, plus the `HEAD_SHA` after the last implementation commit.

Handle each status per the implementer's protocol.

## Step 5.5 — TDD Honesty Gate (mandatory, automated)

Before dispatching the code-reviewer, the orchestrator runs the gate itself — a mechanical check, no agent involved:

```
git diff <RED_SHA>..<HEAD_SHA> -- <test-path-globs>
```

- **Empty output** → ✅ Tests untouched. Proceed to Step 6.
- **Non-empty output** → ❌ TDD violation. Do NOT proceed to review. You **MUST** read `docs/tdd-honesty-violations.md` and follow its classification + recovery procedure (it also covers the hook-active vs hook-inactive interpretation). Show the diff to the user verbatim before acting.

This gate is non-negotiable: TDD violations are invisible if you only look at the implementation diff.

## Step 6 — Code Review (mandatory gate)

Dispatch the `code-reviewer` agent (`agents/code-reviewer/AGENT.md`).

**Pre-flight**: run "Docs Index Resolution" (see section above) for this spec. Capture the resolved entries list (may be empty).

**Context to pass**:
- `RED_SHA` and `HEAD_SHA` (for citing the reviewed range).
- **The Step 5.5 gate result** (clean | violation + details). The reviewer's Dimension 4 consumes this instead of re-running the diff.
- The `.spec.md`.
- `.specture/stack.yml`, `.specture/conventions.md`.
- **Only the ADRs relevant to the module(s) the spec touches.** Safety rule: if you are unsure whether an ADR applies, include it — err toward inclusion, never toward omission. (Passing every ADR of a mature project is the bulk of this dispatch's cost and most are irrelevant to a given spec.)
- The architecture sections relevant to the touched modules.
- **Resolved docs from `docs-index.yml`** (the list from pre-flight, including each entry's `concept`, `file`, `read_when`, `tags`, `confidence`, and the file's content). If the list is empty, pass `docs_index_resolved: []`. When an entry has `confidence: ai_categorized`, the reviewer should treat its content as informational and prefer findings rooted in `Accepted` ADRs / `conventions.md`; if a finding depends ONLY on an `ai_categorized` entry, note that in the review report.
- **Frontend epics:** also pass `docs/03-ux-ui/design_system.md`, the relevant slice of `api-contract.md` (the `operationId`s the page consumes), and — if a handoff was ingested — the fidelity checklist. This activates the code-reviewer's **Dimension 6 (Frontend Fidelity)**: token adherence, accessibility, contract adherence, brand-rule fidelity.

**Parallelism (wall-clock optimization)**: the `code-reviewer` dispatch is independent of the linter and the type-checker — they all read the diff but produce orthogonal outputs. Launch them concurrently to compress wall-clock:

- The `code-reviewer` dispatch via `Agent` tool.
- The linter (whatever `conventions.md` / `stack.yml` declares — e.g. `eslint`, `ruff`, `golangci-lint`) via `Bash` with `run_in_background: true`.
- The type-checker (if applicable — e.g. `tsc --noEmit`, `mypy`, `dotnet build`) via `Bash` with `run_in_background: true`.

Do NOT proceed to Step 7 until all three have reported. Use the `Monitor` tool (or wait-on-completion semantics) to gather the background outputs. If the reviewer needs the linter/type-checker output as evidence for its own findings, attach those once both are available — concurrency saves time but does not weaken any check.

**Expected output**: a structured review at `docs/07-reviews/review-<epic>-<spec>-<date>.md` with status:

- `APPROVED` → proceed to Step 7 (verification).
- `REJECTED_MINOR` → loop back to Step 5 with the issues; implementer fixes; re-review.
- `REJECTED_MAJOR` → either large fix needed (loop with fresh context) or architectural issue (escalate to user).

### Iteration Cap

If you've looped Step 5 → Step 6 **3 times** for the same spec without `APPROVED`, **STOP**. This is a sign of either:
- A spec problem (ambiguous or contradictory) → fix the spec, restart from Step 3.
- An architecture problem → escalate to user, possibly add an ADR.
- Stuck in a debugging loop → invoke `skills/debug/SKILL.md`.

Do NOT do a 4th naive retry.

## Step 7 — Verification (mandatory)

Before declaring the spec done:

```
[Run the test command yourself — not the agents]
[Read the full output]
[Confirm: 0 failures, 0 errors, no unexpected warnings]
[Run linter / type-checker if conventions.md requires]
```

**Parallelism**: the fresh test-suite run can be launched via `Bash` with `run_in_background: true` while the orchestrator prepares the `ROADMAP.md` update payload for Step 8. Do NOT commit the ROADMAP update until the background test run has completed and its output has been read in full. The verification gate is non-negotiable; concurrency only reduces wall-clock, never the rigor of the check.

If anything is red, you cannot mark the spec complete. See `skills/verify/SKILL.md` — same iron law applies here.

## Step 8 — Mark Epic Complete

After all specs in the epic are APPROVED + verified:

- Update `ROADMAP.md`: change the epic from `[/]` to `[x]`.
- Commit the ROADMAP update.
- **Release the test contract**: delete `.specture/state/build-locked.json` if it exists. Without this, the next epic's edits to its own files could be blocked by stale test globs.

## Step 8.5 — Capture Learnings (opt-in)

Before context reset, offer to capture durable knowledge from this epic. This is the natural moment: the diff is fresh, the review is fresh, the user remembers what was discovered.

**Toggle gate**: read `learn.enabled` from `.specture/conventions.md` §10. If `false` (or absent and the user hasn't explicitly enabled it), skip this step entirely.

**Prompt to user (default no)**:

> "Epic `<slug>` completado. ¿Querés correr `/specture:learn` para capturar aprendizajes (ADRs implícitos, entradas de docs-index, patches a conventions)? Es opcional y no toca código. (s/N)"

- **Sí** → invoke `./skills/learn/SKILL.md` passing:
  - Trigger: `epic`
  - Trigger ID: `<epic-slug>`
  - Review files: `docs/07-reviews/review-<epic-slug>-*.md`
  - Epic block from `ROADMAP.md`
  - Epic diff range: `git log --oneline <epic-start-sha>..HEAD`

  When `learn` returns, continue with Step 9. Even if `learn` rejected all drafts, the result is logged to `learn-history.jsonl` — that's value.

- **No** (default) → skip directly to Step 9.

> **Why opt-in default-no**: Specture's value is in the build loop, not in documentation overhead. Most epics don't yield generalizable learnings worth durable capture. The user knows when a session produced "aha" moments — they say yes those times. Forcing learn on every epic would create exactly the noise problem the skill is designed to avoid.

> **Coordinator vs epic-agent**: the epic-agent does NOT run Step 8.5. The coordinator runs it after marking the epic `[x]`, with the epic-agent's report as additional input. This is consistent with the existing rule that only the coordinator marks `[x]`.

## Step 9 — Context Reset Between Epics

In the sequential-queue model this is **automatic**: each epic runs in a fresh epic-agent whose context is discarded when it finishes, and the coordinator only ever holds checkboxes + queued epic blocks + reports (O(n_epics)). There is no cross-epic accumulation to clear — the structural isolation **is** the reset.

For a very large batch (high N) processed in a single coordinator session, the user may optionally start a fresh coordinator session between batches to keep the coordinator lean. No manual reset is needed between individual epics.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Pasar al implementer la conversación entera | Pasarle solo: spec + tests + archivos a tocar + .specture/ + RED_SHA |
| Saltar la validación de arquitectura "porque es un spec simple" | Siempre validar. Es barato y atrapa errores caros. |
| Permitir que el `tdd-test-writer` deje los tests sin commitear | Sin RED commit no hay TDD Honesty Gate. Aborta y re-dispatcha exigiendo el commit. |
| Permitir que el implementer commitee tests junto con código en un solo commit | RED y GREEN deben estar en commits separados. El test commit es el de tdd-test-writer; el implementer NO commitea tests. |
| Saltarse Step 5.5 "porque el implementer dijo que no tocó tests" | El gate es mecánico (`git diff`), no de confianza. Siempre se corre. |
| Aceptar `DONE_WITH_CONCERNS` sin leer las concerns | Lee y decide: ¿bloquea? ¿es nota para futuro? |
| Reescribir el spec a mitad de implementación | Si el spec está mal, abortar el epic, fix spec, restart desde paso 3 |
| Marcar epic `[x]` sin haber corrido tests fresh | Verification gate (verify/SKILL.md) lo prohibe |
| Omitir el review porque "el implementer ya hizo self-review" | Self-review ≠ review independiente. Ambos son necesarios. |

## After Loop Completion

If the ROADMAP reaches 100% `[x]`, route back to `skills/start/SKILL.md` which will offer the user options (audit, new feature, finalize).

> Comportamiento observable con hooks/Context7 activos: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
