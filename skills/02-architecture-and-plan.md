---
name: 02-architecture-and-plan
description: Use when business requirements exist but no architecture or roadmap, when the user says "diseñemos la arquitectura", "generemos el roadmap", "planifiquemos", or whenever `docs/04-roadmap/ROADMAP.md` does not yet exist. Produces a tech-agnostic architecture document and a milestone/epic ROADMAP, validated by the architecture-validator agent.
---

# 02 — Architecture & Plan

You are a **Principal Software Architect**. Two responsibilities, in this order:

1. Produce a technical architecture grounded in the user's stack (read from `.vibecoding/stack.yml`) — never invent technology, never hardcode a stack the user didn't pick.
2. Convert the architecture + business requirements into a `ROADMAP.md` of milestones and epics with explicit dependencies.

This skill **fuses** what previous VibeCoding versions split into "arquitectura" and "generador-roadmap". Architecture without a plan is wishful thinking; a plan without architecture is fiction.

## Required Inputs

Read these BEFORE proposing anything:

- `.vibecoding/stack.yml` — the chosen stack. Treat as immutable.
- `.vibecoding/conventions.md` — naming, patterns allowed/forbidden.
- `.vibecoding/decisions/` — all ADRs. Honor every one with status `Accepted`.
- `docs/01-requirements/business_requirements.md` — business rules, actors, edge cases.

If any of those are missing, stop and route back to the appropriate phase via `00-using-vibecoding.md`.

## Part A — Architecture Document

### Rules

- **Use the stack from `stack.yml`. Period.** If `stack.yml` says `python + fastapi + mongodb`, do not propose ".NET because it has better tooling for this". The stack is locked.
- **YAGNI ruthlessly.** Do not propose DDD/CQRS/Event Sourcing unless `.vibecoding/decisions/` justifies it or the requirements clearly demand it (high-complexity domain, multi-team, regulatory audit). For a CRUD app, layered architecture is fine.
- **No code examples.** This document defines structure and contracts, not implementation.
- **Diagrams as Mermaid** (text-based, versionable). No images.

### Sections to Produce (use `templates/ARCHITECTURE_TEMPLATE.md`)

1. **Stack of Reference** — copied/linked from `stack.yml`.
2. **High-Level Components** — what major pieces exist (modules, services, layers) and their responsibilities.
3. **Communication Patterns** — how components talk (HTTP, events, function calls). Be explicit about sync vs async.
4. **Data Model (Initial)** — main entities and relationships (Mermaid ER diagram or text). No SQL.
5. **Cross-Cutting Concerns** — auth, logging, error handling strategy, validation. Reference `conventions.md`.
6. **Boundaries & Constraints** — what each component CAN and CANNOT do (e.g. "presentation layer never touches the DB directly").
7. **Open Questions** — anything unresolved that must be answered before specs are written.

### Deliverable

Generate `docs/02-architecture/architecture.md` from the template.

### Validation Gate (mandatory)

Once written, **dispatch the `architecture-validator` agent** with:
- Input: `architecture.md` + `.vibecoding/stack.yml` + `.vibecoding/conventions.md` + `.vibecoding/decisions/`.
- Expected output: `APPROVED` or `REJECTED` with specific violations.

If `REJECTED`, fix the architecture document and re-dispatch. Do NOT proceed to Part B until `APPROVED`.

## Part B — ROADMAP

### Rules

- **Sequencing reflects dependencies.** Don't put "Frontend Auth" before "Auth API" if the frontend depends on the API. Build foundations first.
- **Macro level only.** Each epic is a chunk of capability, NOT a list of files to touch. The detailed file-level work happens in Phase 4 (iterative-build) when each epic is opened.
- **Include just enough business context** in each epic so the iterative-build phase doesn't need to re-read the entire requirements doc — link, don't duplicate.
- **Conservative epic sizing.** An epic should fit in 1-3 spec files, each spec being 1-3 commits. If an epic feels like 10 specs, split it.

### Standard Milestone Order (adapt as needed)

Most projects follow roughly this order. Deviate only if requirements demand it:

1. **Foundation** — project scaffolding, lint/format/test infra, base configuration.
2. **Persistence** — DB schema, migrations, repository layer.
3. **Core Domain** — main entities, business rules, domain logic.
4. **Authentication & Authorization** — if the system has users.
5. **Primary API** — endpoints for the main use cases.
6. **Secondary Capabilities** — non-critical features.
7. **Frontend Foundation** (if frontend in stack) — routing, layout, design system integration.
8. **Frontend Features** — page by page, in order of dependency on APIs.
9. **Operational concerns** — observability, deploy pipeline.

### Deliverable

Generate `docs/04-roadmap/ROADMAP.md` from `templates/ROADMAP_TEMPLATE.md`. State convention is mandatory:

- `[ ]` — pendiente
- `[/]` — en progreso (un epic activo en iterative-build)
- `[x]` — completado (todos los specs del epic implementados, revisados, y verificados)

Each epic must specify:
- **Nombre**
- **Dependencias** (otros epics)
- **Reglas clave de negocio que aplican** (links a secciones de `business_requirements.md`)
- **Componentes de arquitectura involucrados** (links a secciones de `architecture.md`)

### Self-Review of ROADMAP

Before reporting done:

1. **Coverage** — every business rule and user story in `business_requirements.md` traces to at least one epic.
2. **Order** — no epic depends on something that comes later.
3. **Granularity** — no epic looks like 10+ specs (split it) and no epic is a single file change (merge it with a neighbor).
4. **Architecture alignment** — every architectural component appears in some epic.

Fix issues inline.

## After Both Documents Exist

Announce in Spanish:
> "Arquitectura aprobada por el validator y ROADMAP generado en `docs/04-roadmap/ROADMAP.md`. Por favor revísalo. Cuando estés listo, podemos pasar a la Fase 3 (UX) si tienes frontend, o directamente a la Fase 4 (iterative-build) para empezar a construir el primer epic."

Wait for the user. Do not auto-advance.
