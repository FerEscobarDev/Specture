# Specture for GitHub Copilot CLI

Specture ships a Copilot CLI plugin alongside its Claude Code plugin. The
clients use separate manifests and agent profiles, while sharing Specture's
state machine, `.specture/` configuration, specs, ROADMAP, templates, and TDD
discipline.

## Prerequisites

- GitHub Copilot CLI with plugin support.
- Node.js available on `PATH` for the opt-in TDD Honesty Gate.
- PowerShell 7+ on Windows when the gate is enabled.

## Installation

After adding the Specture marketplace:

```shell
copilot plugin marketplace add FerEscobarDev/Specture
copilot plugin install specture@specture
```

For development, start Copilot with the repository as a local plugin source:

```shell
copilot --plugin-dir <path-to-Specture>
```

The `copilot plugin install` command in some CLI releases accepts only
marketplace, GitHub repository, or URL specifications. Use `--plugin-dir` for
unpublished local changes in those releases.

## Using Specture

Select `specture:specture-router` through `/agent` when starting or resuming
Specture work, then ask to start or continue. The router loads the `start`
skill and routes by filesystem state. Specture remains opt-in.

Skills retain their existing names (`start`, `setup`, `build`, `debug`, and
so on). Copilot may infer the relevant skill from a direct request. Explicitly
name the skill or router when deterministic routing is important.

## Compatibility guarantees

- Claude Code artifacts under `.claude-plugin/`, `agents/`, `skills/`,
  `settings.json`, and its original hook remain untouched.
- Copilot agents live in `copilot/agents/` and use the `.agent.md` format.
- The TDD Honesty Gate is declared in root `hooks.json` and executes the
  Copilot-specific wrapper. It uses the same `.specture/state/build-locked.json`
  state and `hooks.enabled` opt-in as Claude.
- `ROADMAP.md` remains the cross-session source of truth. Copilot task
  tracking is visibility only.

## Hook behavior

Copilot command `preToolUse` hooks fail closed when a command exits with an
error. Specture's wrapper catches evaluation failures and exits successfully
without a decision, preserving the framework's deliberate fail-open recovery
policy. The build-loop `git diff` gate remains defense in depth.

## Troubleshooting

Use `/env` to confirm the plugin, its agents, skills, and hooks are loaded.
If an identically named project or personal agent/skill is present, Copilot's
first-found precedence can hide Specture's plugin component. Rename or remove
the higher-precedence component before retrying.
