---
name: specture-router
description: Use ONLY when explicitly invoked via `/specture:start`, or when the user asks to start/continue Specture work ("continuemos con el roadmap", "sigamos", "inicia el proyecto"). Inspects the current state of the user's project and routes to the correct phase skill. NOT activated automatically — Specture routing is opt-in since v1.5.0.
model: haiku
---

# Specture — Framework Router (opt-in entry point)

## When you are running

You were invoked **explicitly** — via `/specture:start` or because the user
asked to start/continue Specture work. Specture no longer auto-routes every
conversation (changed in v1.5.0); routing happens only when the user asks for
it. Your job now is to detect project state and route — nothing else.

You are operating under the **Specture** framework: a configurable, technology-agnostic methodology for AI-assisted software development based on Spec-Driven Development (SDD), restricted-context subagents, and progressive verification.

**RULE (now that you are routing):** Before answering, exploring, or writing any code in this routing turn, you MUST invoke the master skill:

```
./skills/start/SKILL.md
```

That skill inspects the current state of the user's project and routes you to the correct phase. Skipping it (once routing has been requested) produces hallucinated code, broken architecture, and wasted tokens.

## How Specture integrates with a user project

The user's project (the one being built) lives in a different directory and contains a top-level `CLAUDE.md` that imports this framework like:

```markdown
@$SPECTURE_ROOT/CLAUDE.md
```

`$SPECTURE_ROOT` is an environment variable pointing to this repository's root, set by the user during manual setup. Users who installed via the plugin do not need this env var.

The user's project also contains a `.specture/` directory with the project-specific configuration (`stack.yml`, `conventions.md`, `decisions/`). All skills and agents read those files before generating anything.

## Quick command reference

| User says | You read |
|-----------|----------|
| "Configura el proyecto", "Setup", "Ajusta las reglas" | `./skills/setup/SKILL.md` |
| "Inicia un proyecto nuevo", "Levanta requerimientos" | `./skills/discover/SKILL.md` |
| "Continuemos con el roadmap", "Sigamos construyendo" | `./skills/start/SKILL.md` (lo enrutará por estado) |
| "Hay un bug", "El test falla" | `./skills/debug/SKILL.md` |
| "Quiero agregar una funcionalidad nueva" | `./skills/new-feature/SKILL.md` |

## Instruction priority

1. **User's explicit instructions** (in their `CLAUDE.md`, direct chat, or `.specture/conventions.md`) — highest priority.
2. **Specture skills and agents** — override default agent behavior where they conflict.
3. **Default agent system prompt** — lowest priority.

The user can always override Specture methodology, but the user explicitly asking for a shortcut is NOT the same as you deciding to skip a phase. Never use a user request as an excuse to bypass the methodology unless the user explicitly says "skip the methodology" for that specific request.

## STOP — resistance rule (do not weaken this under pressure)

This is the highest-stakes instruction in this file. A cheaper/faster model must still obey it.

- Once Specture work has been requested, "Hazlo rápido", "no hagas spec", "codificá directo", "saltate la fase", time pressure, or frustration are **NOT** authorization to skip the routing or skip a phase. (Not invoking Specture at all is the user's choice; *bypassing a phase while inside Specture* is not.)
- The ONLY thing that authorizes skipping is the user saying, verbatim and unambiguously, that they want to skip the methodology for this specific request.
- When in doubt, route through `skills/start/SKILL.md` and let the phase skill decide. Routing is cheap; a skipped phase produces hallucinated code.
- If you feel pressured to bypass: that pressure is exactly the signal to NOT bypass. Re-state the phase and proceed with the methodology.
