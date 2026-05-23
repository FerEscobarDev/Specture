---
name: contract-sync-audit
description: Use on an existing project where the frontend and backend are out of sync — the frontend calls URLs the backend doesn't expose, expects response shapes the backend doesn't return, or uses different paths/methods. Statically extracts backend routes and frontend API calls, diffs them, and emits a reconciliation report against a canonical source (an existing API contract, or one chosen side). Does NOT auto-fix — it reports and proposes, then routes to build/new-feature/debug. Also use before copying a design handoff into a codebase whose API is already drifting.
---

# Contract Sync Audit — Reconcile Backend & Frontend

You are an **integration auditor**. The project already has both a backend and a frontend, and they disagree about the API. Your job is to find every disagreement deterministically, decide a canonical source of truth, and produce a reconciliation report. You do **not** apply fixes — you make the gap visible and propose how to close it.

## When this applies

- The user reports "the frontend expects things the backend doesn't return", wrong URLs, 404s on calls that "should work", or shape mismatches.
- An existing project is adopting Specture (`setup` Adopt) and needs its back/front interface reconciled before building further.
- Before `handoff-ingest` copies a design handoff into a codebase whose API is already drifting — audit first so the new UI is wired to a coherent contract.

## Required Inputs

- `.specture/stack.yml` — `backend.framework`, `frontend.framework`, languages. Drives how routes/calls are extracted.
- `.specture/conventions.md`.
- `docs/02-architecture/api-contract.openapi.yaml` (+ `.md`) **if it exists** — the natural canonical source.
- Read access to the backend route definitions and the frontend API-calling code.

## Step 0 — Choose the canonical source

Before diffing, decide what "correct" means:

1. **An existing `api-contract.openapi.yaml`** → it is canonical. Both sides are audited against it.
2. **No contract, backend is authoritative** (common when the backend is stable and the frontend drifted) → extract a contract from the backend; the frontend is audited against it.
3. **No contract, frontend is authoritative** (the UI defines the desired interface) → the backend is audited against the frontend's expectations.
4. **No contract, neither is fully right** → produce a *proposed reconciled* contract and audit both sides against it.

Ask the user which case applies if it isn't obvious. The canonical choice determines the direction of every proposed fix.

## Step 1 — Extract backend routes (deterministic where possible)

Prefer the most authoritative source available, in this order:

1. **A live/served OpenAPI/Swagger** the backend already exposes (FastAPI `/openapi.json`, NestJS Swagger, Spring springdoc, ASP.NET Swashbuckle) → parse it directly. Most reliable.
2. **Static route extraction** per `backend.framework`:
   - Express/Fastify: `app.get/post/...` and `router.*` calls.
   - NestJS / Spring: controller decorators (`@Get`, `@Post`, `@RequestMapping`, `@GetMapping`).
   - FastAPI/Flask: `@app.get`/`@router.post`/`@app.route` decorators.
   - ASP.NET: `[HttpGet]`/`[Route]` attributes + controller route prefixes.
   - Go (gin/echo/chi), Rails routes, Laravel routes — analogous.

For each endpoint capture: **method, full path (with prefix), and the response type/shape** if the language is typed (DTO/return type) or serializer is declared.

## Step 2 — Extract frontend API calls

Find every backend call in the frontend per `frontend.framework`:

- `fetch(...)`, `axios.*`, Angular `HttpClient.*`, generated SDK calls, React Query / SWR hooks.
- Capture: **method, URL/path** (resolve base-URL constants and template literals as far as statically possible), and the **expected response shape** — from the TypeScript type the call is annotated/destructured with, or the way the result is consumed.

Note where a path is fully dynamic (built at runtime) — flag it as "not statically resolvable" rather than guessing.

## Step 3 — Diff and classify

Produce findings in these categories:

| Category | Meaning |
|---|---|
| **Missing endpoint** | Frontend calls an operation the backend does not expose (404 in production). |
| **URL/path mismatch** | Same intent, different path (e.g. `/psicologos/{slug}/disponibilidad` vs `/api/v1/availability`). |
| **Method mismatch** | Same path, different HTTP method. |
| **Shape mismatch** | Frontend expects fields/types the backend response doesn't provide (or vice versa). Only assertable where both sides are typed. |
| **Orphan endpoint** | Backend exposes an operation no frontend call uses (dead or undocumented). |
| **Auth mismatch** | Frontend sends/omits auth differently than the endpoint requires. |
| **Unresolved** | Path or shape couldn't be statically determined — needs manual confirmation. |

Each finding cites `file:line` on **both** sides where possible.

## Step 4 — Emit the reconciliation report

Write `docs/02-architecture/contract-sync-report.md`:

- **Canonical source** chosen (Step 0) and why.
- A table of findings: category, frontend evidence (`file:line`), backend evidence (`file:line`), and the **proposed change** stated against the canonical source ("change the frontend call to `GET /api/v1/...`" or "add backend endpoint `...` returning `...`").
- A **coverage summary**: N endpoints, N matched, N mismatched, N orphan, N unresolved.
- If no contract existed, attach a **proposed `api-contract.openapi.yaml`** (from `$SPECTURE_ROOT/templates/api-contract.openapi.template.yaml`) reflecting the canonical interface, so the project gains the source of truth it was missing.

## Step 5 — Route the fixes (do NOT auto-apply)

This skill reports; it does not edit application code. Based on the findings:

- Each proposed change becomes work for the build pipeline: route to `skills/new-feature/SKILL.md` (missing endpoints / new operations) or `skills/build/SKILL.md` (align an existing epic), each backed by a spec referencing the now-canonical contract.
- If a mismatch is a genuine bug with unclear cause, route to `skills/debug/SKILL.md`.
- Once the contract exists, the frontend should regenerate its typed client from it so the class of "hand-written divergent URL" bugs cannot recur.

## Step 6 — Hand-off

Announce in Spanish:
> "Auditoría de sincronización lista en `docs/02-architecture/contract-sync-report.md`. Fuente canónica: **[contrato existente / backend / frontend / contrato reconciliado propuesto]**. Resumen: [N matched, N mismatched, N orphan, N unresolved]. [Si generé contrato: 'Dejé un `api-contract.openapi.yaml` propuesto como nueva fuente de verdad.'] Los cambios propuestos NO se aplicaron — cada uno necesita su spec. ¿Quieres que enrute los arreglos a `build`/`new-feature`, o revisas el reporte primero?"

Wait for the user. Do not auto-apply changes.

## Honest Limits (state these)

- **Dynamically-typed backends** (plain JS, untyped Python) expose no response types to compare → shape mismatches there are heuristic at best (inferred from serialization code). URL/method diffs remain reliable; shape diffs get marked `Unresolved` when types are absent.
- **Runtime-built paths** (URLs assembled from variables) can't be fully resolved statically — they're flagged, not guessed.
- **The audit never auto-fixes.** Choosing which side bends to the other is a design decision (the canonical source); applying it goes through specs and the normal gates.
- **An exposed OpenAPI from the backend is the most reliable input** — recommend the project add one if it lacks both a contract and served schema.
