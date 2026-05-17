# Specture — Framework Entry Point for AI Agents

> **Using the Specture plugin?** You don't need this file — invoke `/specture:start` when you want to begin or continue Specture work. This file exists for users who prefer the manual `@import` approach.

## How Specture is entered (opt-in since v1.5.0)

Specture is a **configurable, technology-agnostic** methodology for AI-assisted software development based on Spec-Driven Development (SDD), restricted-context subagents, and progressive verification.

Routing is **opt-in**: it does NOT run automatically on every message. You enter Specture only when the user asks to start or continue Specture work — e.g. they invoke `/specture:start`, or say "configura el proyecto", "inicia el proyecto", "continuemos con el roadmap", "sigamos construyendo", report a bug, or ask to add a feature.

**RULE — once the user has asked for Specture work:** before answering, exploring, or writing any code for that request, you MUST invoke the master skill:

```
./skills/start/SKILL.md
```

That skill inspects the current state of the user's project and routes you to the correct phase. Skipping it once routing has been requested produces hallucinated code, broken architecture, and wasted tokens. For unrelated questions the user has not framed as Specture work, just answer normally — do not force routing.

## How Specture integrates with a user project

The user's project (the one being built) lives in a different directory and contains a top-level `CLAUDE.md` that imports this framework like:

```markdown
@$SPECTURE_ROOT/CLAUDE.md
```

`$SPECTURE_ROOT` is an environment variable pointing to this repository's root, set by the user during setup. Never hardcode absolute paths inside skills, agents or templates — always use `$SPECTURE_ROOT` or paths relative to it.

The user's project also contains a `.specture/` directory with the project-specific configuration (`stack.yml`, `conventions.md`, `decisions/`). All skills and agents read those files before generating anything.

## Quick command reference

| User says | You read |
|-----------|----------|
| "Configura el proyecto", "Setup", "Ajusta las reglas" | `./skills/setup/SKILL.md` |
| "Inicia un proyecto nuevo", "Levanta requerimientos" | `./skills/discover/SKILL.md` |
| "Continuemos con el roadmap", "Sigamos construyendo" | `./skills/start/SKILL.md` (lo enrutará por estado) |
| "Hay un bug", "El test falla" | `./skills/debug/SKILL.md` |
| "Quiero agregar una funcionalidad nueva" | `./skills/new-feature/SKILL.md` |
| "Quiero migrar a X", "Sube la versión a Y", "Moderniza el stack" | `./skills/modernize/SKILL.md` |

## Instruction priority

1. **User's explicit instructions** (in their `CLAUDE.md`, direct chat, or `.specture/conventions.md`) — highest priority.
2. **Specture skills and agents** — override default agent behavior where they conflict.
3. **Default agent system prompt** — lowest priority.

The user can always override Specture methodology, but the user explicitly asking for a shortcut is NOT the same as you deciding to skip a phase. Never use a user request as an excuse to bypass the methodology unless the user explicitly says "skip the methodology" for that specific request.
