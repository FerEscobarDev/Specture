---
name: build
description: Use when `docs/04-roadmap/ROADMAP.md` exists and contains epics marked `[ ]` (pending) or `[/]` (in progress), or when the user says "construyamos", "sigamos con el roadmap", "implementemos el siguiente epic". Orchestrates a strict per-epic loop: spec → architecture validation → tests → implementation → review → verification → mark complete. Dispatches 4 specialized agents.
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

## The Loop

```
For each epic where state is [ ] or [/]:
   1. Lock the epic           → mark as [/]
   2. Generate spec(s)        → SPEC_TEMPLATE.md → docs/05-specs/<epic>/<task>.spec.md
   3. Validate architecture   → dispatch architecture-validator (REQUIRED)
   4. Write tests             → dispatch tdd-test-writer; agent commits RED → capture RED_SHA
   5. Implement               → dispatch implementer (separate commits, MUST NOT touch tests)
 5.5. TDD Honesty Gate        → git diff RED_SHA..HEAD -- <test-globs> MUST be empty
   6. Review                  → dispatch code-reviewer (REQUIRED, 4 dimensions inc. TDD Honesty)
   7. If REJECTED             → loop back to step 5 (max 3 iterations, then escalate)
   8. Verify                  → run tests fresh, see them pass, see no warnings
   9. Mark epic as [x]        → update ROADMAP.md
  10. Context reset           → instruct user to clear chat / reset session before next epic
```

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

Before passing the spec to the validator, check:

- [ ] No `TBD`, `TODO`, or "fill in later".
- [ ] All business rules cited from `business_requirements.md`.
- [ ] Acceptance criteria are concrete and testable (not "should work well").
- [ ] No code examples present.
- [ ] Inputs, outputs, error conditions, and side effects all listed.

## Step 3 — Architecture Validation (mandatory gate)

Dispatch the `architecture-validator` agent (`agents/architecture-validator/AGENT.md`).

**Context to pass (restricted)**:
- The new `.spec.md` content.
- `.specture/stack.yml`.
- `.specture/decisions/` (all ADRs).
- The relevant section of `architecture.md`.

**Expected output**: `APPROVED` or `REJECTED` with a list of violations.

If `REJECTED`:
- Either fix the spec (most common) and re-dispatch.
- Or, if the rejection reveals a flaw in the architecture itself, escalate to the user and consider a `reconfigure` (new ADR).

## Step 4 — Write Tests (TDD RED phase)

Dispatch the `tdd-test-writer` agent (`agents/tdd-test-writer/AGENT.md`).

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

If any post-check fails, do NOT proceed to Step 5.

## Step 5 — Implement (TDD GREEN phase)

Dispatch the `implementer` agent (`agents/implementer/AGENT.md`).

**Context to pass**:
- The `.spec.md`.
- The test files just written (as content reference — the implementer must NOT edit them).
- The `RED_SHA` value, with an explicit instruction: *"The tests committed at `<RED_SHA>` are the sealed contract. You must NOT modify, delete, skip, rename, or move any of those test files. The TDD Honesty Gate will run `git diff <RED_SHA>..HEAD -- <test-globs>` after your work and any change will abort the spec."*
- `.specture/stack.yml`, `.specture/conventions.md`, all ADRs.
- The relevant existing source files the implementer needs to modify (NOT the whole codebase — pick the minimum).

**Expected output**: minimal code to make tests pass; agent commits implementation in commits **separate from the RED commit**; reports status `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`, plus the `HEAD_SHA` after the last implementation commit.

Handle each status per the implementer's protocol.

## Step 5.5 — TDD Honesty Gate (mandatory, automated)

Before dispatching the code-reviewer, the orchestrator runs the gate itself. This is a mechanical check — no agent involved.

```
git diff <RED_SHA>..<HEAD_SHA> -- <test-path-globs>
```

**Interpretation**:

- **Empty output** → ✅ Tests untouched between RED and HEAD. Proceed to Step 6.
- **Non-empty output** → ❌ TDD violation. The implementer modified the sealed test contract. Do NOT proceed to review.

**On violation, the orchestrator MUST**:

1. Show the diff to the user verbatim. No paraphrasing.
2. Classify the violation:
   - **Test assertion weakened / removed / replaced**: this is the prototypical violation. Treat as `REJECTED_MAJOR`.
   - **Test skipped (`it.skip`, `xit`, `@Disabled`, etc.)**: same severity.
   - **Test renamed / moved**: same — even no-op renames break the contract identifier.
   - **New test file added by implementer (not present at RED)**: investigate. May be legitimate (test helper) or a smokescreen.
3. Options for recovery (escalate to user):
   - **Revert the test changes** (`git checkout <RED_SHA> -- <test-paths>`) and re-dispatch the implementer with a stronger reminder.
   - **If the implementer was right that the test was wrong** (rare but possible): revert, then re-run `tdd-test-writer` with the implementer's concern as input. Get a new RED commit. Restart Step 5 with the new `RED_SHA`.
   - **Abort the spec entirely** if the violation suggests a fundamental spec/implementation mismatch.

The gate exists because TDD violations are invisible if you only look at the implementation diff. Without this gate, the code-reviewer might APPROVE code whose tests were silently softened.

## Step 6 — Code Review (mandatory gate)

Dispatch the `code-reviewer` agent (`agents/code-reviewer/AGENT.md`).

**Context to pass**:
- `RED_SHA` and `HEAD_SHA` (the code-reviewer's Dimension 4 uses these to verify TDD honesty independently — defense in depth even after Step 5.5).
- The test path globs (so the reviewer can run the same `git diff` check).
- The `.spec.md`.
- `.specture/stack.yml`, `.specture/conventions.md`, all ADRs.
- The architecture sections relevant to the touched modules.

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

If anything is red, you cannot mark the spec complete. See `skills/verify/SKILL.md` — same iron law applies here.

## Step 8 — Mark Epic Complete

After all specs in the epic are APPROVED + verified:

- Update `ROADMAP.md`: change the epic from `[/]` to `[x]`.
- Commit the ROADMAP update.

## Step 9 — Context Reset Between Epics

This is **non-negotiable**. Acumulated context across epics is the #1 source of degraded quality in AI development.

Announce to the user:
> "Epic [N] completado. **Por favor, inicia una nueva conversación** antes de continuar con el siguiente epic. Si tu interfaz no permite limpiar el chat, dímelo y forzaremos un reset mental."

If the user can't reset (or refuses): start the next epic with a hard reminder to yourself:
> "RESET: ignoro toda conversación previa. Mi único contexto válido para el próximo epic es: el spec activo, los archivos que el spec referencia, y `.specture/`."

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
