---
name: architecture
description: Use when business requirements exist but no architecture or roadmap, when the user says "diseñemos la arquitectura", "generemos el roadmap", "planifiquemos", or whenever `docs/04-roadmap/ROADMAP.md` does not yet exist. Produces a tech-agnostic architecture document, an API contract (OpenAPI + readable companion) as the single source of truth for the backend/frontend interface, and a milestone/epic ROADMAP — all validated by the architecture-validator agent.
---

# 02 — Architecture & Plan

You are a **Principal Software Architect**. Three responsibilities, in this order:

1. Produce a technical architecture grounded in the user's stack (read from `.specture/stack.yml`) — never invent technology, never hardcode a stack the user didn't pick.
2. **Produce the API Contract** — the single source of truth for the backend↔frontend (and any external-consumer) interface, as an OpenAPI document plus a readable companion. This eliminates the #1 cause of frontend/backend drift: each side inventing its own URLs and shapes.
3. Convert the architecture + contract + business requirements into a `ROADMAP.md` of milestones and epics with explicit dependencies.

This skill **fuses** what previous versions split into "arquitectura" and "generador-roadmap", and adds the contract that binds the two implementation tracks. Architecture without a plan is wishful thinking; a plan without architecture is fiction; **two tracks without a shared contract is two divergent truths**.

## Required Inputs

Read these BEFORE proposing anything:

- `.specture/stack.yml` — the chosen stack. Treat as immutable.
- `.specture/conventions.md` — naming, patterns allowed/forbidden.
- `.specture/decisions/` — all ADRs. Honor every one with status `Accepted`.
- `docs/01-requirements/business_requirements.md` — business rules, actors, edge cases.

If any of those are missing, stop and route back to the appropriate phase via `./skills/start/SKILL.md`.

## Part A — Architecture Document

### Rules

- **Use the stack from `stack.yml`. Period.** If `stack.yml` says `python + fastapi + mongodb`, do not propose ".NET because it has better tooling for this". The stack is locked.
- **YAGNI ruthlessly.** Do not propose DDD/CQRS/Event Sourcing unless `.specture/decisions/` justifies it or the requirements clearly demand it (high-complexity domain, multi-team, regulatory audit). For a CRUD app, layered architecture is fine.
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

**Pre-flight: Docs Index Resolution.** If `.specture/docs-index.yml` exists and `docs_index.enabled` is not `false`, resolve up to `docs_index.max_entries_per_dispatch` entries (default 3) whose tags intersect with the high-level components and architectural concerns of the document. Use the same algorithm documented in `skills/build/SKILL.md` § "Docs Index Resolution". The resolved entries become additional input to the validator (informational context, not binding — only `Accepted` ADRs bind validation).

Once written, **dispatch the `architecture-validator` agent** (`agents/architecture-validator/AGENT.md`) with:
- Input: `architecture.md` + `.specture/stack.yml` + `.specture/conventions.md` + `.specture/decisions/` + the resolved docs-index entries (with their content; pass `docs_index_resolved: []` if empty).
- Expected output: `APPROVED` or `REJECTED` with specific violations.

If `REJECTED`, fix the architecture document and re-dispatch. Do NOT proceed to Part B until `APPROVED`.

## Part B — API Contract

> The contract is the **single source of truth for every HTTP/REST boundary** the system exposes (backend↔frontend, and any external consumer). Generated here, *after* the architecture is approved and *before* the ROADMAP, so the ROADMAP can sequence epics by contract dependency.

### When to produce it

- **Produce it** when `stack.yml` declares both a backend and a frontend, OR a backend that exposes an API to any external consumer. This is the common case.
- **Skip it** (and say so explicitly) only when there is no network boundary at all — e.g. a single CLI, a library, or a desktop app with no API. A pure-backend service that exposes endpoints still needs the contract.
- **GraphQL / RPC:** if `stack.yml` `api.style` (or the architecture) is GraphQL or gRPC, produce the equivalent schema-first source of truth (SDL / `.proto`) plus the readable companion, following the same `operationId`-as-stable-identifier discipline. OpenAPI is the default for REST.

### Rules

- **The `Capacidades de Frontera` section of `business_requirements.md` is the deterministic input.** Every capability listed there (the user stories marked `UI` or `API-externa` in discovery) must become **at least one** operation in the contract. This is the forward derivation; do not invent operations that trace to no capability, and do not drop a boundary capability.
- **One stable identifier per operation.** Every operation gets an `operationId` that never changes once an epic consumes it. Renaming it later is a breaking change requiring an ADR.
- **No shapes invented downstream.** The request/response/error shapes live here as `components/schemas`. Specs (backend and frontend) and the navigation map *reference* `operationId`s — they never redefine a shape.
- **One error envelope** for the whole contract.
- **Each operation traces both ways:** *up* to the business capability / user story (`HU-...`) that originates it, and *across* to the component in `architecture.md` that owns its data. Record the upward trace in the contract's Traceability section. An operation with no originating capability is over-design; a capability with no operation is a coverage hole.
- **If `Capacidades de Frontera` is "Ninguna"** (a pure library/CLI with no boundary), skip the contract entirely and note it — there is nothing to contract.

### Deliverables

Generate both, from the templates in `$SPECTURE_ROOT/templates/`:

- `docs/02-architecture/api-contract.openapi.yaml` — from `templates/api-contract.openapi.template.yaml`. **Machine-readable source of truth.**
- `docs/02-architecture/api-contract.md` — from `templates/API_CONTRACT_TEMPLATE.md`. Readable companion (operation table + shared DTOs + traceability). If the two ever disagree, the `.yaml` wins; keep them in sync.

### Validation Gate (mandatory)

**Pre-flight: Docs Index Resolution.** If `.specture/docs-index.yml` exists and `docs_index.enabled` is not `false`, resolve entries with tags like `external-integration`, `security`, or any `backend`/`frontend` tag relevant to the contract's boundary capabilities. Cap at `docs_index.max_entries_per_dispatch` (default 3). Use the algorithm in `skills/build/SKILL.md` § "Docs Index Resolution".

Dispatch the `architecture-validator` agent with:
- Input: `api-contract.openapi.yaml` + `api-contract.md` + `architecture.md` + **the `Capacidades de Frontera` section of `business_requirements.md`** + `.specture/stack.yml` + `.specture/conventions.md` + `.specture/decisions/` + the resolved docs-index entries (pass `docs_index_resolved: []` if empty).
- Expected output: `APPROVED` or `REJECTED`. The validator checks contract conformance: **every boundary capability maps to ≥1 operation and every operation traces back to a capability** (bidirectional coverage), every operation traces to a component that owns it, the error envelope is uniform, no technology outside `stack.yml`, and (once the ROADMAP exists) every `operationId` traces to an epic.

If `REJECTED`, fix the contract and re-dispatch. Do NOT proceed to Part C until `APPROVED`.

## Part C — ROADMAP

### Rules

- **Sequencing reflects dependencies.** Don't put "Frontend Auth" before "Auth API" if the frontend depends on the API. Build foundations first.
- **Contract-driven sequencing (when a contract exists).** Each backend epic declares the `operationId`s it **implements**; each frontend page epic declares the `operationId`s it **consumes**. A frontend page epic **depends on** the backend epic(s) that implement the operations it consumes — encode that in its `Dependencias`. This is the structural fix for "the frontend expected endpoints the backend never built".
- **Macro level only.** Each epic is a chunk of capability, NOT a list of files to touch. The detailed file-level work happens in Phase 4 (build) when each epic is opened.
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
7. **Frontend Foundation** (if frontend in stack) — routing, layout, **design system as code** (tokens + base components), and the **`/dev/design-system` showcase route** that the user approves before any page is built (see `skills/build/SKILL.md` "Modo: Frontend"). Also the generated typed API client from `api-contract.openapi.yaml`.
8. **Frontend Features** — page by page, ordered so each page comes *after* the backend epic that implements the `operationId`s it consumes. The design-system approval gate precedes all of them.
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
- **Operaciones del contrato** (cuando aplique): los `operationId` que el epic **implementa** (backend) o **consume** (frontend), referenciando `api-contract.md`.

### Self-Review of ROADMAP

Before reporting done:

1. **Coverage** — every business rule and user story in `business_requirements.md` traces to at least one epic.
2. **Order** — no epic depends on something that comes later.
3. **Granularity** — no epic looks like 10+ specs (split it) and no epic is a single file change (merge it with a neighbor).
4. **Architecture alignment** — every architectural component appears in some epic.
5. **Contract coverage (when a contract exists)** — every `operationId` in `api-contract.md` is implemented by exactly one backend epic and (if it's consumed by the UI) consumed by at least one frontend epic. No orphan operations; no frontend page consuming an operation no epic implements.

Fix issues inline.

## After All Documents Exist

Announce in Spanish:
> "Arquitectura aprobada por el validator, contrato de API generado en `docs/02-architecture/api-contract.openapi.yaml` (+ versión legible) y ROADMAP generado en `docs/04-roadmap/ROADMAP.md`. Por favor revísalos. Cuando estés listo, podemos pasar a la Fase 3 (UX) si tienes frontend, o directamente a la Fase 4 (build) para empezar a construir el primer epic."

Wait for the user. Do not auto-advance.
