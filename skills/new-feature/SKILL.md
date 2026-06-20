---
name: new-feature
description: Use when the user asks to add functionality not present in the original ROADMAP — phrases like "quiero agregar X", "necesito una nueva funcionalidad", "ahora también queremos…". Performs Impact Ripple Analysis against existing specs, updates the ROADMAP with the new milestone/epic, and routes to the build phase.
---

# Transversal — New Feature

The project already exists (or has parts implemented). The user wants to add a feature that was not in the original ROADMAP. Your job is to integrate it cleanly, without breaking what's built.

## Required Inputs

- `.specture/stack.yml`, `conventions.md`, `decisions/` — to understand constraints.
- `docs/01-requirements/business_requirements.md` — to align with existing rules.
- `docs/02-architecture/architecture.md` — to know the boundaries.
- `docs/04-roadmap/ROADMAP.md` — to know what's done and what's pending.
- `docs/05-specs/_current/` — **living behavior per component** (primary input for impact analysis: reconciled, present-tense truth — not historical snapshots). Drill into the immutable `docs/05-specs/<epic>/` specs only when deep history is needed.

## Step 1 — Mini-Discovery for the New Feature

Apply Phase 1 (`skills/discover/SKILL.md`) Socratic technique, but scoped to this feature only:

- Purpose of the feature.
- Actors involved (existing or new?).
- User stories.
- Business rules and edge cases.
- Out of scope.

Do NOT ask about technology — the stack is already locked.

Output: a temporary doc `docs/01-requirements/feature-<slug>.md` (or append to a "New Features" section in the main requirements doc — ask the user which they prefer).

## Step 2 — Impact Ripple Analysis (UNIQUE TO SPECTURE)

This is the core differentiator. Before planning the feature, identify ripples through completed work.

**Before producing any analysis output, enter Plan mode**: invoke `EnterPlanMode`. The plan file is the impact analysis itself — write the full structure described below (architecture impact, spec impact, ADR impact, output document) into the plan and call `ExitPlanMode` to request user approval. Until the user approves the plan, you cannot run `Edit`, `Write`, modify `ROADMAP.md`, or create ADRs — Plan mode enforces this mechanically.

This converts Step 3 (User Validation) from "ask politely" into a system-level gate: the user cannot be skipped, the analysis cannot be acted upon before they see it, and the eventual write of `docs/05-specs/_impact-analysis-<feature-slug>.md` happens only after the plan is approved.

### Architecture impact

For each architectural component in `architecture.md`:
- Does this feature touch it?
- Does it require changing the contract / interface?
- Does it require a new component?

Output a list:
```
- AuthModule        → unchanged
- UsersModule       → new endpoint, no breaking change
- BillingModule     → schema change in Subscription entity (BREAKING)
- (new) AuditModule → required, doesn't exist yet
```

### Behavior impact (the ripple)

Read `docs/05-specs/_current/<component>.md` for each component the feature touches — this is the **current behavior**, consolidated and present-tense, so you don't replay historical specs. For each touched component:
- Does the feature change a business rule (BR) that is vigente there?
- Does it conflict with a current acceptance criterion (AC) or the consolidated contract behavior?
- Does it touch the same operations the component already implements?

Cross-reference entities mentioned in the feature against the vigente behavior in `_current/`. List the affected components and the specific BR/AC explicitly. If `_current/` does not exist yet (no milestone has reconciled), fall back to scanning `docs/05-specs/<epic>/` directly.

### ADR impact

Does this feature contradict any `Accepted` ADR? If yes, you must:
- Either reject the feature as incompatible with current architecture.
- Or create a new ADR superseding the old one (and flag this clearly to the user).

### Output

A document `docs/05-specs/_impact-analysis-<feature-slug>.md` with:
- Affected components.
- Affected components (the vigente behavior in `_current/` that ripples) + the immutable specs behind them.
- Affected ADRs.
- Migration risks (data shape changes, breaking API changes, breaking UI changes).

## Step 3 — User Validation

Present the impact analysis to the user. Be honest about cost:
> "Esta feature requiere modificar [3 specs ya completados] y agregar 1 ADR nuevo. Esto significa retrabajo en código existente. ¿Aceptas el costo o prefieres replantear el alcance?"

Wait for explicit approval before continuing.

## Step 4 — Update ROADMAP and (if needed) Architecture

Once approved:

- Add a new **Milestone** or **Epic** to `ROADMAP.md` with state `[ ]`. Position it with explicit dependencies.
- If components changed: update `docs/02-architecture/architecture.md` accordingly. Run the change through the `architecture-validator` agent (`agents/architecture-validator/AGENT.md`).
- If ADRs changed: create new ADR file(s) in `.specture/decisions/` per the ADR rules (never delete, supersede explicitly).

## Step 5 — Route to Build

Once the ROADMAP, architecture, and ADRs are aligned:

> "ROADMAP actualizado con la nueva funcionalidad. Listo para construirla. Voy a invocar `skills/build/SKILL.md` para empezar el primer epic de la feature."

Hand off to `skills/build/SKILL.md`.

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Skip impact analysis "porque parece chiquito" | The whole point is that small features ripple. The analysis is cheap insurance. |
| Add the feature inline in an existing epic | Impossible to track separately, ROADMAP becomes a lie. |
| Modify completed specs in-place without trace | Specs are immutable artifacts. If they change, it's a new spec or a deprecation. |
| Decide architecture changes alone | If the new feature requires architectural change, the user must approve and an ADR must record it. |

> Comportamiento observable con Plan mode activo: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
