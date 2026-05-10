---
name: transversal-new-feature
description: Use when the user asks to add functionality not present in the original ROADMAP — phrases like "quiero agregar X", "necesito una nueva funcionalidad", "ahora también queremos…". Performs Impact Ripple Analysis against existing specs, updates the ROADMAP with the new milestone/epic, and routes to the iterative-build phase.
---

# Transversal — New Feature

The project already exists (or has parts implemented). The user wants to add a feature that was not in the original ROADMAP. Your job is to integrate it cleanly, without breaking what's built.

## Required Inputs

- `.vibecoding/stack.yml`, `conventions.md`, `decisions/` — to understand constraints.
- `docs/01-requirements/business_requirements.md` — to align with existing rules.
- `docs/02-architecture/architecture.md` — to know the boundaries.
- `docs/04-roadmap/ROADMAP.md` — to know what's done and what's pending.
- `docs/05-specs/` — completed specs (for impact analysis).

## Step 1 — Mini-Discovery for the New Feature

Apply Phase 1 (`01-discovery.md`) Socratic technique, but scoped to this feature only:

- Purpose of the feature.
- Actors involved (existing or new?).
- User stories.
- Business rules and edge cases.
- Out of scope.

Do NOT ask about technology — the stack is already locked.

Output: a temporary doc `docs/01-requirements/feature-<slug>.md` (or append to a "New Features" section in the main requirements doc — ask the user which they prefer).

## Step 2 — Impact Ripple Analysis (UNIQUE TO VIBECODING)

This is the core differentiator. Before planning the feature, identify ripples through completed work.

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

### Spec impact (the ripple)

For each completed spec in `docs/05-specs/`:
- Does the new feature change a business rule that this spec implemented?
- Does it touch a file that this spec also touched?
- Does it conflict with an acceptance criterion?

Cross-reference entities mentioned in the new feature against entities in completed specs. List the affected specs explicitly.

### ADR impact

Does this feature contradict any `Accepted` ADR? If yes, you must:
- Either reject the feature as incompatible with current architecture.
- Or create a new ADR superseding the old one (and flag this clearly to the user).

### Output

A document `docs/05-specs/_impact-analysis-<feature-slug>.md` with:
- Affected components.
- Affected specs (likely needing modification or deprecation).
- Affected ADRs.
- Migration risks (data shape changes, breaking API changes, breaking UI changes).

## Step 3 — User Validation

Present the impact analysis to the user. Be honest about cost:
> "Esta feature requiere modificar [3 specs ya completados] y agregar 1 ADR nuevo. Esto significa retrabajo en código existente. ¿Aceptas el costo o prefieres replantear el alcance?"

Wait for explicit approval before continuing.

## Step 4 — Update ROADMAP and (if needed) Architecture

Once approved:

- Add a new **Milestone** or **Epic** to `ROADMAP.md` with state `[ ]`. Position it with explicit dependencies.
- If components changed: update `docs/02-architecture/architecture.md` accordingly. Run the change through the `architecture-validator` agent.
- If ADRs changed: create new ADR file(s) in `.vibecoding/decisions/` per the ADR rules (never delete, supersede explicitly).

## Step 5 — Route to Iterative Build

Once the ROADMAP, architecture, and ADRs are aligned:

> "ROADMAP actualizado con la nueva funcionalidad. Listo para construirla. Voy a invocar `04-iterative-build` para empezar el primer epic de la feature."

Hand off to `04-iterative-build.md`.

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Skip impact analysis "porque parece chiquito" | The whole point is that small features ripple. The analysis is cheap insurance. |
| Add the feature inline in an existing epic | Impossible to track separately, ROADMAP becomes a lie. |
| Modify completed specs in-place without trace | Specs are immutable artifacts. If they change, it's a new spec or a deprecation. |
| Decide architecture changes alone | If the new feature requires architectural change, the user must approve and an ADR must record it. |
