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

### Step 1 — Setup detection

Check whether `.specture/stack.yml` exists in the user's project root.

- **No** → invoke `./skills/setup/SKILL.md`. Stop.
- **Yes** → continue to Step 2.

### Step 2 — Discovery detection

Check whether `docs/01-requirements/business_requirements.md` exists.

- **No** → invoke `./skills/discover/SKILL.md`. Stop.
- **Yes** → continue to Step 3.

### Step 3 — Architecture & Plan detection

Check whether `docs/04-roadmap/ROADMAP.md` exists.

- **No** → invoke `./skills/architecture/SKILL.md`. Stop.
- **Yes** → continue to Step 4.

### Step 4 — UX detection (only if frontend exists)

Read `.specture/stack.yml`. If `frontend.framework` is set and is not `none`/`null`:

Check whether either `docs/03-ux-ui/navigation_map.md` or `docs/03-ux-ui/design_system.md` exists.

- **No** → invoke `./skills/ux-design/SKILL.md`. Stop.
- **Yes (or no frontend)** → continue to Step 5.

### Step 5 — Iterative Build detection

Read `docs/04-roadmap/ROADMAP.md` and look at the epic checkboxes.

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
