---
name: start
description: Use at the start of every conversation under Specture, when the user says "continue", "sigamos", "continuemos con el roadmap", asks to resume work, or whenever the current phase of the project is unclear. Detects project state and routes to the correct phase skill.
---

# Using Specture (Entry Point & Router)

<EXTREMELY-IMPORTANT>
If you are operating under Specture, you cannot skip this skill. Your job here is NOT to do work — it is to detect what state the project is in and route to the correct phase. Do not write code, do not run setup, do not start brainstorming until you have completed the routing logic below.
</EXTREMELY-IMPORTANT>

## Mental Model

Specture is a **state machine**. The state of the user's project is determined by which files exist on disk, not by chat history. Always trust the filesystem over conversation memory.

## Routing Algorithm

Run these checks **in order**. Stop at the first match and invoke the indicated skill.

> **Cost rule (mandatory):** routing is a filesystem state machine, not a comprehension task. **Never read full file contents for routing.** Use existence checks for Steps 1-3; read only the single `frontend.framework` field for Step 4; read only the epic checkbox lines for Step 5. For Step 2's docs-index fallback, grep for `tags:.*requirements` lines only — do NOT load the full index. Opening `stack.yml`, `business_requirements.md`, or `docs-index.yml` in full here is wasted context.

### Step 1 — Setup detection

Check whether `.specture/stack.yml` exists in the user's project root.

- **No** → invoke `./skills/setup/SKILL.md`. Stop.
- **Yes** → continue to Step 2.

### Step 2 — Discovery detection

Check whether `docs/01-requirements/business_requirements.md` exists.

- **Yes** → continue to Step 3.
- **No** → check the fallback path: does `.specture/docs-index.yml` exist AND does it contain at least one entry with the tag `requirements`? (Grep for lines matching `tags:.*requirements` — single pass, no full parse.)

  - **Index exists with requirements entries** → the team already has requirements documented in a preexisting docs folder; do NOT route to `discover` (that would re-extract knowledge that already exists). Ask the user:

    > "Detecté que el proyecto tiene documentación preexistente indexada (`.specture/docs-index.yml`) con `<N>` entradas categorizadas como `requirements`, pero no existe el archivo puente `docs/01-requirements/business_requirements.md`. Opciones:
    >
    > (a) Generar el puente automáticamente desde el índice (recomendado — invoca `setup-docs-bridge`).
    > (b) Ir a `discover` para levantar requerimientos desde cero (descartando lo indexado).
    > (c) Continuar sin bridge (no recomendado — algunas skills no encontrarán el archivo)."

    Route based on the user's answer:
    - `(a)` → invoke `./skills/setup-docs-bridge/SKILL.md` (bridge-only refresh: skip Phase 1 detection — the user has already accepted; resume from Phase 2 with the index's `source_of_truth_dir` as input). Stop.
    - `(b)` → invoke `./skills/discover/SKILL.md`. Stop.
    - `(c)` → continue to Step 3, but warn that downstream skills may fail their input checks.

  - **No index OR index has no requirements entries** → invoke `./skills/discover/SKILL.md`. Stop. (Original behavior preserved.)

### Step 3 — Architecture & Plan detection

Check whether `docs/04-roadmap/ROADMAP.md` exists.

- **No** → invoke `./skills/architecture/SKILL.md`. Stop.
- **Yes** → continue to Step 4.

### Step 4 — UX detection (only if frontend exists)

Read **only the `frontend.framework` field** of `.specture/stack.yml` (not the whole file). If it is set and not `none`/`null`:

Check whether **both** `docs/03-ux-ui/navigation_map.md` **and** `docs/03-ux-ui/design_system.md` exist (both are universal deliverables since v1.6.0).

- **Either missing** → invoke `./skills/ux-design/SKILL.md`. Stop.
- **Both present (or no frontend)** → continue to Step 5.

### Step 5 — Iterative Build detection

Read **only the epic checkbox lines** of `docs/04-roadmap/ROADMAP.md` (grep the `[ ]`/`[/]`/`[x]` markers — do not load the whole document).

| State | Action |
|-------|--------|
| Any epic marked `[ ]` (pending) or `[/]` (in progress) | Invoke `./skills/build/SKILL.md` |
| All epics marked `[x]` (complete) | Ask the user: "El ROADMAP está 100% completo. ¿Quieres (a) auditar el código completo, (b) agregar una nueva funcionalidad, o (c) finalizar?" Then route to the chosen path. |

## Transversal Skills

These are NOT routed by state — they are activated by symptoms during any phase:

| Symptom | Invoke |
|---------|--------|
| Test fails 2+ times in a row, or implementer is stuck guessing | `./skills/debug/SKILL.md` |
| User wants to add a feature not in the original ROADMAP | `./skills/new-feature/SKILL.md` |
| About to claim "done", "complete", "passing", "fixed" | `./skills/verify/SKILL.md` |
| User wants to create or modify a Specture skill | `./skills/write-skill/SKILL.md` |
| User has a design handoff (Claude Design / v0 / Lovable) to convert into the stack | `./skills/handoff-ingest/SKILL.md` |
| Frontend & backend are out of sync (wrong URLs, shapes the backend doesn't return) in an existing project | `./skills/contract-sync-audit/SKILL.md` |
| User wants to capture session learnings, or audit the docs-index (opt-in / periodic) | `./skills/knowledge/SKILL.md` — modes `capture` / `audit` (aliases `/specture:learn`, `/specture:audit-knowledge`) |

## Red Flags — STOP

If you find yourself thinking any of the following, you are violating Specture discipline:

| Thought | Reality |
|---------|---------|
| "Es un cambio pequeño, lo codifico directo" | Every code change must be backed by a `.spec.md`. |
| "Asumo esta regla de negocio para avanzar" | Forbidden. Ask the user. |
| "Voy a leer todo el repo para tener contexto" | Token waste. Read only the active spec and the files it references. |
| "El test falló, voy a cambiar el test para que pase" | Iron Law: zero fixes without root cause. Invoke `debug/SKILL.md`. |
| "Sé qué fase tocaría aunque no haya verificado los archivos" | Trust the filesystem, not your memory. Run the routing algorithm. |

## Context Hygiene Rule

When transitioning between phases (especially between specs in iterative-build), you MUST mentally reset. If your interface allows clearing chat history, do it. If not, force yourself to ignore prior conversation and treat the next spec/file as the only valid context. Do NOT pull information from memory of earlier work unless it is explicitly referenced in the current spec.

## After You Route

Announce to the user (in Spanish, since the user-facing language is Spanish):

> "Detecté que el proyecto está en la fase **[NOMBRE]**. Voy a usar el skill `[ARCHIVO]` para continuar."

Then invoke that skill and follow its instructions. Do not perform additional analysis or commentary before invoking.
