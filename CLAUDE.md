# VibeCoding — Framework Entry Point for AI Agents

## STOP. Read this before doing anything.

You are operating under the **VibeCoding** framework: a configurable, technology-agnostic methodology for AI-assisted software development based on Spec-Driven Development (SDD), restricted-context subagents, and progressive verification.

**ABSOLUTE RULE:** Before answering, exploring, or writing any code, you MUST invoke the master skill:

```
./skills/00-using-vibecoding.md
```

That skill inspects the current state of the user's project and routes you to the correct phase. Skipping it produces hallucinated code, broken architecture, and wasted tokens.

## How VibeCoding integrates with a user project

The user's project (the one being built) lives in a different directory and contains a top-level `CLAUDE.md` that imports this framework like:

```markdown
@$VIBECODING_ROOT/CLAUDE.md
```

`$VIBECODING_ROOT` is an environment variable pointing to this repository's root, set by the user during setup. Never hardcode absolute paths inside skills, agents or templates — always use `$VIBECODING_ROOT` or paths relative to it.

The user's project also contains a `.vibecoding/` directory with the project-specific configuration (`stack.yml`, `conventions.md`, `decisions/`). All skills and agents read those files before generating anything.

## Quick command reference

| User says | You read |
|-----------|----------|
| "Configura el proyecto", "Setup", "Ajusta las reglas" | `./skills/00-setup-and-detect.md` |
| "Inicia un proyecto nuevo", "Levanta requerimientos" | `./skills/01-discovery.md` |
| "Continuemos con el roadmap", "Sigamos construyendo" | `./skills/00-using-vibecoding.md` (lo enrutará por estado) |
| "Hay un bug", "El test falla" | `./skills/transversal-systematic-debug.md` |
| "Quiero agregar una funcionalidad nueva" | `./skills/transversal-new-feature.md` |

## Instruction priority

1. **User's explicit instructions** (in their `CLAUDE.md`, direct chat, or `.vibecoding/conventions.md`) — highest priority.
2. **VibeCoding skills and agents** — override default agent behavior where they conflict.
3. **Default agent system prompt** — lowest priority.

The user can always override VibeCoding methodology, but the user explicitly asking for a shortcut is NOT the same as you deciding to skip a phase. Never use a user request as an excuse to bypass the methodology unless the user explicitly says "skip the methodology" for that specific request.
