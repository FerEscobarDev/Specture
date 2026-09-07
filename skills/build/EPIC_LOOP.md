# 04b — Epic Loop (the epic-agent's procedure)

You are the **epic-agent** for exactly ONE epic of a Specture project. The coordinator
(`build/SKILL.md`) picked and locked the epic (it is already `[/]` in `ROADMAP.md`),
assembled your base context, and dispatched you with this file as your **complete procedure**.
You never see the coordinator's queue, and your context is discarded when you finish.

Ground rules:

- Execute **Steps 4 through 8** below, in order, for this single epic. The specs were
  already authored by `spec-planner` and validated by `architecture-validator` under the
  coordinator's Spec Planning Gate — you receive them sealed, with their `SPEC_SHA` and
  the verbatim `APPROVED` verdict. **Never regenerate or edit a spec.** If a spec turns
  out to be unexecutable, report `BLOCKED: spec <AC-n/BR-n/EC-n>` with the affected ID.
  With hooks on, `.specture/state/build-locked.json` (written by the coordinator via
  `seal-cli.js`, schema v3) makes the hook **deny** three kinds of edit: a sealed test path,
  a sealed spec path, and — when the seal carries `allowed_paths` — any production write
  outside the `Crea:`/`Modifica:` paths of the specs. A denied write is never worked
  around: it is a `BLOCKED: spec <ID>` naming the file. Without hooks, the coordinator runs
  `git diff <SPEC_SHA>..HEAD -- '<specs>'` on your report and treats any diff as
  `REJECTED_MAJOR`.
- The specialized subagents (`tdd-test-writer`, `implementer`, `ux-implementer`,
  `code-reviewer`) are already registered by the coordinator — dispatch them by name with
  the restricted context each step defines.
- Do not touch `ROADMAP.md` except Step 8's `[/]` → `[x]` flip for **your** epic. Never
  pick, unlock, or modify another epic.
- When you finish, report exactly one of `DONE | BLOCKED | REJECTED_MAJOR` in the shape the
  dispatch prompt defines (`BLOCKED: spec <ID>` is the sub-form for an unexecutable spec —
  the coordinator runs the spec-correction loop).

## Frontend Epics — execution (design-system epic and page epics)

Applies when the epic touches UI and `stack.yml.frontend.framework` is set and not `none`.
TDD certifies logic, not look-and-feel: behavior is still tested, but **visual quality is gated
by a human**. The queue-level ordering (design system first, pages only after its approval)
was already enforced by the coordinator — your job is the per-epic execution below.

### The Design System Foundation epic

When the locked epic is the design-system foundation:

1. **The spec(s) were already planned by the gate**, sourced from `docs/03-ux-ui/design_system.md`. They cover: token definitions (color/type/spacing/radii/shadows in the stack's token mechanism), the base components the navigation map implies (with variants/states/a11y), and the dev showcase route.
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
- The UI consumes the backend strictly through the **typed API client generated from the contract file (`stack.yml.api.contract_file`)** — never hand-written URLs. The spec declares which `operationId`s the page consumes (declared by the `spec-planner`).
- Tests (RED) cover the page's logic and contract binding: it calls the right operations, handles loading/empty/error states, enforces role-based visibility, and meets a11y assertions the framework can check. They do **not** assert pixel aesthetics.
- The code-reviewer runs its frontend dimension (token adherence, a11y, contract adherence, brand-rule fidelity).
- A lightweight visual check (screenshot via Playwright if available) is encouraged per page but the binding gate was the design-system approval; per-page screenshots are for catching regressions, surfaced to the user when notable.

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
- [ ] Spec's "Superficie de Código Existente" section carries the **exact signatures** of every existing symbol the implementation will call — for symbols marked `(planeada — re-anclar)`, verified by the **signature re-read** below
- [ ] `stack.yml` + `conventions.md` + all ADRs
- [ ] Relevant docs from `docs-index.yml` resolved (see "Docs Index Resolution" below)

If the orchestrator cannot fill an item, it resolves it BEFORE dispatch (read the file, extract the signature). Dispatching with an incomplete manifest is the #1 cause of `NEEDS_CONTEXT` round-trips — each one wastes a full agent cycle.

### Signature re-read (defensive overlay — before the Manifest of spec k+1)

The planned signature of a `Crea:` symbol is an **obligation of the implementer of spec k**:
the `code-reviewer`'s Dimension 1 verifies, at spec k's review, that every `Crea:` symbol exists
at `HEAD_SHA` with the declared signature (roadmap item 32 — that is the correction mechanism).
This re-read is the cheap defense behind it, not a second mechanism:

1. Before assembling the Manifest of spec k+1, open **only** the files spec k declared under
   `Crea:` and extract the real signatures of the symbols spec k+1 marks
   `(planeada — re-anclar)`.
2. Identical → pass a confirming `FIRMAS_REALES: <símbolo> → <firma>` block to the implementer
   (it restates the spec; it never overrides it — the spec is sealed).
3. Divergent → the reviewer of spec k missed it: treat as `REJECTED_MINOR` on spec k —
   re-dispatch its implementer with the divergence, re-run Step 5.5 and Step 6 for spec k
   (this loop counts toward the Iteration Cap) — then continue with spec k+1. Never edit the
   spec, never "adapt" spec k+1's tests to the real signature.
4. Report in your final `CONCERNS`: `firma re-read: N verified, M corrected`.

## Docs Index Resolution (pre-flight, reusable)

When `.specture/docs-index.yml` exists, the orchestrator MUST resolve relevant entries and pass the resulting documents as input to `code-reviewer` (Step 6), and optionally to `tdd-test-writer` and `implementer` if their dispatch manifest item resolves a non-empty list. (The coordinator's Spec Planning Gate runs this same resolution for its `spec-planner` and `architecture-validator` dispatches.)

> **Doctrine — preserve restricted-context principle**: the agents NEVER read `docs-index.yml` themselves. The orchestrator resolves the index and hands the agents the final list of documents as part of their input. This keeps agents cache-friendly, deterministic, and auditable.

### Resolution algorithm

1. **Check existence**: if `.specture/docs-index.yml` does not exist, the resolved list is **empty**. Continue without docs-index input. Do NOT block dispatch. (No notice needed: the index is optional — only Adopt projects with external docs have one.)

2. **Check toggle**: if `docs_index.enabled` is `false` in `.specture/settings.yml` (or in `conventions.md` §10 for projects not yet migrated), resolved list is empty. Continue without input.

3. **Read cap**: read `docs_index.max_entries_per_dispatch` from `.specture/settings.yml` (fallback: `conventions.md` §10). Fallback to **3** if absent or unparseable. This is the hard maximum number of entries passed to a single agent dispatch.

4. **Extract spec signals**: from the current spec, derive:
   - **Tags**: union of (a) the touched module name(s), (b) the architectural component(s) cited, (c) `backend` / `frontend` / `mobile` derived from the spec's contract section, (d) any explicit `tags` field if the spec template includes one.
   - **Concepts** (optional): any explicit concept slugs the spec author wrote.

5. **Filter entries** in `docs-index.yml`:
   - Drop entries with `superseded_by` set to a non-null value.
   - Score each remaining entry by: `+2 per tag intersection`, `+3 per explicit concept match`, `+1 if confidence is user_confirmed`.
   - Drop entries with score 0.

6. **Rank and cap**: sort by score descending. Take top `max_entries_per_dispatch`. **Prefer `user_confirmed` over `ai_categorized`** when scores tie.

7. **Read the resolved files**: for each surviving entry, read its `file` and prepare for dispatch. If the file does not exist (drift between index and disk), log a warning and skip that entry; the next `knowledge` audit run will report the drift.

8. **Log the resolution** to `docs/.specture-meta/index-usage.jsonl` (create the directory if absent, append-only, never block dispatch on log failure). One JSON object per line:

   ```json
   {"ts":"<ISO-8601>","skill":"build","step":"3|6","epic":"<slug>","spec":"<slug>","agent":"architecture-validator|code-reviewer","queried_tags":["..."],"queried_concepts":["..."],"resolved":[{"concept":"...","file":"...","confidence":"...","score":N}],"total_in_index":N}
   ```

### When the resolved list is empty

- For `architecture-validator` and `code-reviewer`: dispatch normally. The agents already work correctly without docs-index input — it's strictly additive context.
- The Dispatch Manifest item is satisfied by **"empty list — no matching entries"** (explicitly state this in the dispatch payload so the agent knows the resolver ran and found nothing, vs being silently dropped).

## Current-State Resolution (pre-flight, reusable)

When `docs/05-specs/_current/` exists, the orchestrator resolves the living-behavior file(s) for the component(s) the current spec touches and passes them to `code-reviewer` (Step 6) — the coordinator's Spec Planning Gate runs the same resolution for its dispatches — so those agents see the **current behavior** of the component and can flag regressions or conflicts with what is already built.

> **Doctrine — same as Docs Index Resolution**: the agents NEVER read the `_current/` directory themselves. The orchestrator resolves the relevant files and hands them over in the dispatch. Restricted context preserved.

### Resolution algorithm

1. **Check existence**: if `docs/05-specs/_current/` does not exist (no milestone has reconciled yet), the resolved list is **empty**. Continue; do NOT block dispatch. If the ROADMAP already has closed milestones, this is a missing initialisation, not a young project — print once: *⚠ Specture: `docs/05-specs/_current/` no inicializado — corré `/specture:doctor`* (migration `1.9-current-state-init`).
2. **Identify component(s)**: from the spec header's `Módulo` ref and the epic's "Componentes de arquitectura involucrados" — these are the `<component-slug>`s.
3. **Resolve files**: for each component, read `docs/05-specs/_current/<component-slug>.md` if it exists. A missing file means that component has no reconciled behavior yet — skip it, not an error.
4. **Cap**: pass only the files for the components the spec actually touches (usually 1-2), never the whole `_current/` directory.

When empty, dispatch normally and pass `current_state_resolved: []` so the agent knows the resolver ran — it is strictly additive context.

## Step 4 — Write Tests (TDD RED phase)

Dispatch the `tdd-test-writer` agent (`agents/tdd-test-writer/AGENT.md`).

**First assemble the Dispatch Manifest** (see "Dispatch Manifest" section above). Do not dispatch until every tdd-test-writer item is checked.

**Context to pass (restricted)**:
- The validated `.spec.md`.
- `.specture/stack.yml` (specifically `testing_framework` for backend or frontend, depending on what the spec covers).
- `.specture/conventions.md` testing section.
- **NOT** any existing implementation files. The agent must be blind to implementation to avoid biasing tests toward existing behavior.
- **Declared supersessions** (spec section "Supersesiones de tests sellados", roadmap item 35): the list of `Supersede: <path>::<test> — motivo: BR-n` lines, verbatim. Before dispatching, with hooks on, lift the test deny for exactly those paths: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" supersede --paths "<path1>,<path2>"`. **Abort with `BLOCKED: spec <ID>`** if any superseded path is inside a sibling spec's `test_paths` of this epic's seal — a same-epic contradiction is the spec-correction loop, never a supersession.

**Expected output**: test file(s) at the path indicated by conventions, all currently failing (RED), **committed by the agent in a single RED commit**, and the SHA of that commit reported as `RED_SHA`. When supersessions were declared: a separate, **earlier** commit `test(supersede): <epic>/<task-slug> — <path>::<test> (BR-n)` touching only the declared files, reported as `SUPERSEDE_SHA`.

**Orchestrator post-checks (all mandatory)**:

1. **Verify failure reason**: run the tests yourself and confirm they fail for the right reason ("function not defined" / "wrong return value"), not because of syntax errors or missing dependencies. **Exception — guards**: tests declared in the spec's "Guards de no-regresión (nacen verdes)" section are born green by definition — verify they PASS, and that they don't count toward the RED tally.
2. **Verify the RED commit exists and is clean**:
   ```
   git show --stat <RED_SHA>
   ```
   The commit MUST contain only test files (paths matching `conventions.md` test globs). If the commit touches any production code, abort — re-dispatch `tdd-test-writer` with a clear instruction to commit tests in isolation.
3. **Capture `RED_SHA`** for use in Step 5.5 and Step 6. This is now the immutable reference point for the test contract.
3b. **Supersessions, if declared**: `git show --stat <SUPERSEDE_SHA>` touches **only** the declared paths and is an ancestor of `RED_SHA` (`git merge-base --is-ancestor`); the superseded tests are now RED and count in the tally like any other; then `seal-cli.js supersede --clear` (the exemption lived only for the dispatch) and include the superseded files in this spec's `--test-paths` below — they are part of this spec's contract from now on. Report them in your final `SUPERSESSIONS:` lines (`<path>::<test> → <SUPERSEDE_SHA>`).
4. **Capture the test path globs** from `conventions.md` (e.g. `**/*.test.ts`, `tests/**/*.py`). Both Step 5.5 and the code-reviewer need them.
5. **Seal the test contract via state file** (enables the TDD Honesty Gate hook). **Merge this spec's entry** into `.specture/state/build-locked.json` through the only sanctioned writer — never by hand, never overwriting the coordinator's epic-level fields (`spec_sha`, `spec_paths`, `allowed_paths`) or a sibling's `red_sha`:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" merge-spec --slug <task-slug> --red-sha <RED_SHA> --test-paths "<file1>,<file2>" --epic <epic-slug>
   ```
   `--test-paths` is the **explicit list of test files of the RED commit** (`git show --stat <RED_SHA>`, project-relative) — not the conventions-wide globs: a glob would seal the next spec's tests before they exist (and, from v1.18.0, would sweep a closed epic's tests into this seal). The resulting file (schema v3, `hooks/README.md`):
   ```json
   {
     "epic": "<epic-slug>", "sealed_at": "<ISO-8601 of the first seal>",
     "spec_sha": "<SPEC_SHA>", "spec_paths": ["docs/05-specs/<epic-slug>/*.spec.md"],
     "test_globs": ["<conventions globs>", "<test root>/**"], "allowed_paths": ["<Crea:/Modifica: paths>"],
     "specs": [ { "slug": "<task-slug>", "red_sha": "<RED_SHA>", "test_paths": ["<file1>", "<file2>"] } ]
   }
   ```
   (The legacy single-`red_sha` form and v2 are still read.) If the user opted in to hooks (`hooks.enabled: true` in `.specture/settings.yml` — or in `conventions.md` §10 for projects not yet migrated), the PreToolUse hook denies any Edit/Write that targets a sealed test path, a sealed spec path, or production code outside `allowed_paths`, until the coordinator releases the seal. The orchestrator-side `git diff` check in Step 5.5 still runs as defense-in-depth.

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
- The explicit instruction: *"Write only to the paths the spec declares under `Crea:` / `Modifica:` (and the tests you were given). With hooks on, a write anywhere else is denied by the Allowed Paths gate — a denied write means the spec is incomplete: stop and report `BLOCKED: spec <ID>` naming the file, never work around it."*

**Expected output**: minimal code to make tests pass; agent commits implementation in commits **separate from the RED commit**; reports status `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`, plus the `HEAD_SHA` after the last implementation commit.

Handle each status per the implementer's protocol.

## Step 5.5 — TDD Honesty Gate (mandatory, automated)

Before dispatching the code-reviewer, the orchestrator runs the gate itself — a mechanical check, no agent involved:

```
git diff <RED_SHA>..<HEAD_SHA> -- <test-path-globs>
```

- **Empty output** → ✅ Tests untouched. Proceed to Step 6.
- **Non-empty output** → ❌ TDD violation. Do NOT proceed to review. You **MUST** read `$SPECTURE_ROOT/docs/tdd-honesty-reference.md` (from the plugin: `${CLAUDE_PLUGIN_ROOT}/docs/tdd-honesty-reference.md` — **never** a `docs/tdd-honesty-*.md` of the project's own cwd) and follow its classification + recovery procedure (it also covers the hook-active vs hook-inactive interpretation). Show the diff to the user verbatim before acting.

**Guards de no-regresión**: the tests declared in the spec's "Guards de no-regresión (nacen verdes)" section are born green by declaration — the gate never treats a passing guard as "a test that failed to fail". They are still sealed like every other test in the RED commit: editing one after `RED_SHA` IS a violation.

**Supersesiones declaradas**: a `test(supersede)` commit is applied **before** `RED_SHA`, so the range never contains it — excluded by declaration, not by exception. A superseded path that shows up in `git diff <RED_SHA>..<HEAD_SHA>` **is** a violation like any other, and so is any edit to a closed epic's test the spec did not declare.

This gate is non-negotiable: TDD violations are invisible if you only look at the implementation diff.

## Step 6 — Code Review (mandatory gate)

Dispatch the `code-reviewer` agent (`agents/code-reviewer/AGENT.md`).

**Pre-flight**: run "Docs Index Resolution" (see section above) for this spec. Capture the resolved entries list (may be empty).

**Pre-flight 2**: run "Current-State Resolution" (see section above) for this spec's component(s). Capture the resolved `_current/` file(s) (may be empty).

**Context to pass**:
- `RED_SHA` and `HEAD_SHA` (for citing the reviewed range).
- **The Step 5.5 gate result** (clean | violation + details). The reviewer's Dimension 4 consumes this instead of re-running the diff.
- **The declared supersessions** (the spec's `Supersede:` lines) + `SUPERSEDE_SHA`, or "none" — Dimension 4 checks the range never touches them and that nothing undeclared touched a closed epic's test.
- The `.spec.md`.
- `.specture/stack.yml`, `.specture/conventions.md`.
- **Only the ADRs relevant to the module(s) the spec touches.** Safety rule: if you are unsure whether an ADR applies, include it — err toward inclusion, never toward omission. (Passing every ADR of a mature project is the bulk of this dispatch's cost and most are irrelevant to a given spec.)
- The architecture sections relevant to the touched modules.
- **Resolved docs from `docs-index.yml`** (the list from pre-flight, including each entry's `concept`, `file`, `read_when`, `tags`, `confidence`, and the file's content). If the list is empty, pass `docs_index_resolved: []`. When an entry has `confidence: ai_categorized`, the reviewer should treat its content as informational and prefer findings rooted in `Accepted` ADRs / `conventions.md`; if a finding depends ONLY on an `ai_categorized` entry, note that in the review report.
- **Resolved `_current/` behavior** (from Current-State Resolution): the living-behavior file(s) for the component(s) this spec touches, so the reviewer can flag regressions against already-built behavior. If empty, pass `current_state_resolved: []`.
- **Frontend epics:** also pass `docs/03-ux-ui/design_system.md`, the relevant slice of `api-contract.md` (the `operationId`s the page consumes), and — if a handoff was ingested — the fidelity checklist. This activates the code-reviewer's **Dimension 6 (Frontend Fidelity)**: token adherence, accessibility, contract adherence, brand-rule fidelity.

**Parallelism (wall-clock optimization)**: the `code-reviewer` dispatch is independent of the linter and the type-checker — they all read the diff but produce orthogonal outputs. Launch them concurrently to compress wall-clock. This is safe only because none of them writes to the working tree except the reviewer, which writes only its report under `docs/07-reviews/` — never run two writing agents against the same checkout:

- The `code-reviewer` dispatch via `Agent` tool.
- The linter (whatever `conventions.md` / `stack.yml` declares — e.g. `eslint`, `ruff`, `golangci-lint`) via `Bash` with `run_in_background: true`.
- The type-checker (if applicable — e.g. `tsc --noEmit`, `mypy`, `dotnet build`) via `Bash` with `run_in_background: true`.

Do NOT proceed to Step 7 until all three have reported. Use the `Monitor` tool (or wait-on-completion semantics) to gather the background outputs. If the reviewer needs the linter/type-checker output as evidence for its own findings, attach those once both are available — concurrency saves time but does not weaken any check.

**Expected output**: a structured review at `docs/07-reviews/review-<epic>-<spec>-<date>.md` with status:

- `APPROVED` → proceed to Step 7 (verification).
- `REJECTED_MINOR` → loop back to Step 5 with the issues; implementer fixes; re-review.
- `REJECTED_MAJOR` → either large fix needed (loop with fresh context) or architectural issue (escalate to user). With `CAUSE: spec_defect` the problem is the sealed spec, not the code: report `BLOCKED: spec <ID>` (the coordinator runs the correction loop) instead of re-dispatching the implementer.
- **Tally every review's `STATUS` + `CAUSE`** (`none | implementation | spec_defect | architecture`): the `METRICS` block of your final report sums `review_rejections` minor/major and `spec_defect` per epic — a review without a parseable `CAUSE:` line is incomplete, ask the reviewer for it.

### Iteration Cap

If you've looped Step 5 → Step 6 **3 times** for the same spec without `APPROVED`, **STOP**. This is a sign of either:
- A spec problem (ambiguous or contradictory) → report `BLOCKED: spec <AC-n/BR-n/EC-n>`; the **coordinator** runs the spec-correction loop (re-plan → re-validate → revert the affected RED → resume from that spec). Never edit the sealed spec yourself.
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
- **Release the seal**: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" release` (deletes `.specture/state/build-locked.json` — sealed tests, sealed specs and allowed paths alike). Without this, the next epic's edits to its own files could be blocked by stale rules. (The coordinator releases it again when it processes your `DONE` — belt and braces; neither side trusts the other.)

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Pasar al implementer la conversación entera | Pasarle solo: spec + tests + archivos a tocar + .specture/ + RED_SHA |
| Saltar la validación de arquitectura "porque es un spec simple" | Siempre validar. Es barato y atrapa errores caros. |
| Permitir que el `tdd-test-writer` deje los tests sin commitear | Sin RED commit no hay TDD Honesty Gate. Aborta y re-dispatcha exigiendo el commit. |
| Permitir que el implementer commitee tests junto con código en un solo commit | RED y GREEN deben estar en commits separados. El test commit es el de tdd-test-writer; el implementer NO commitea tests. |
| Saltarse Step 5.5 "porque el implementer dijo que no tocó tests" | El gate es mecánico (`git diff`), no de confianza. Siempre se corre. |
| Aceptar `DONE_WITH_CONCERNS` sin leer las concerns | Lee y decide: ¿bloquea? ¿es nota para futuro? |
| Reescribir el spec a mitad de implementación | El spec está sellado. Reportá `BLOCKED: spec <ID>`; el coordinador corre el loop de corrección. |
| Editar o regenerar un spec sellado dentro del epic-agent | Los specs los autoriza el gate (planner + validator). Un spec inejecutable se reporta, no se arregla en silencio. Con hooks, el sello (`spec_paths`) lo deniega; sin hooks, el coordinador lo detecta con `git diff <SPEC_SHA>..HEAD`. |
| Escribir fuera de la Superficie "porque hacía falta un archivo de wiring" (router, registro DI, barrel, config) | Es un hueco del spec, no una licencia: `BLOCKED: spec <ID>` nombrando el archivo; el planner agrega la línea `Modifica:` y el epic se reanuda. Con hooks, el gate Allowed Paths lo deniega antes. |
| Editar `.specture/state/build-locked.json` a mano | `seal-cli.js merge-spec` / `release` son los únicos escritores: preservan los campos del coordinador (`spec_sha`, `spec_paths`, `allowed_paths`) y las entradas de los specs hermanos. |
| Marcar epic `[x]` sin haber corrido tests fresh | Verification gate (verify/SKILL.md) lo prohibe |
| Omitir el review porque "el implementer ya hizo self-review" | Self-review ≠ review independiente. Ambos son necesarios. |
| Usar `git add -A` o `git commit --amend` durante un epic | `git add <paths explícitos>` y commits nuevos. Un `add -A` captura trabajo en vuelo de otro agente; un `--amend` puede reescribir el commit de un tercero. |
| Restaurar un archivo con `git checkout -- <archivo>` después de mutarlo (p. ej. para comprobar que un test detecta el cambio) | `git checkout` restaura a HEAD, no al árbol previo: destruye arreglos sin commitear. Snapshot a scratch **antes** de mutar, restaurar desde el snapshot y verificar con `git hash-object`. Y commitear todo arreglo de producción antes de abrir un bucle de mutación. |
| Despachar dos agentes que escriban al mismo checkout | Uno a la vez. La concurrencia de Step 6 es válida solo porque linter y type-checker no escriben, y el reviewer escribe únicamente su archivo en `docs/07-reviews/`. |

> Comportamiento observable con hooks/Context7 activos: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
