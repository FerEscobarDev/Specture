---
name: doctor
description: 'Use when the user asks to check, lint or repair the project''s Specture structure ("revisá el proyecto", "está todo en orden", "actualizá la config de specture"), right after upgrading the plugin, when `start` reports pending migrations, or on `/specture:doctor [check|migrate|sync]`. Read-only by default; never applies content migrations.'
---

# Transversal — Doctor (diagnóstico del corpus + migraciones de esquema)

## Overview

Specture versions the **plugin**; the doctor versions the **project**. It answers two questions mechanically — *is the documentation corpus internally consistent?* and *does this project have the structure the installed plugin assumes?* — and applies the safe part of the answer. Everything it does is a script (`scripts/doctor.js`); the skill's job is to run it, present the result, and handle the parts that need judgment (assisted migrations) through Plan mode.

Three modes:

| Mode | What it does | Writes |
|---|---|---|
| `check` (default) | corpus lint (broken paths, `...` placeholders, duplicate ADRs, ADRs without Status, reviews without verdict, specs without IDs, over 300 lines or with off-template sections, line-number citations), requirements lint (unresolved placeholders, HUs without `Exposición`, boundary stories not consolidated, rules/edge cases/exclusions without `RN/CL/FA` IDs), rules lint (`.specture/rules.yml` that does not parse or with duplicate ids / missing fields / unknown severity — `rules-schema`; a `rule` over 240 characters or a §4 deny-list item over 2 lines — `rule-length`), state (stale seal, >1 `[/]`, missing `_current/`, docs-index vs toggle, worktree leftovers), schema drift (pending migrations by kind) | nothing |
| `migrate` | applies pending **mechanical** migrations (with `--apply`), drafts the **assisted** ones in Plan mode, records **content** ones as deferred with their owner; advances `schema_version` | `.specture/`, `.gitignore`, ROADMAP, requirements/architecture docs, `.specture/migrations.log` |
| `sync` | `migrate --apply` (mechanical only) + `check` — for CI and for `start` | mechanical only |

Migrations never touch specs `[x]`, reviews or debug logs.

## Preconditions

| Needs | If missing |
|---|---|
| Node ≥ 22 on PATH | Say so and stop. Do **not** re-implement the checks by hand: the value of the doctor is that it is mechanical. |
| `.specture/stack.yml` | Route to `setup` — there is nothing to diagnose. |

## The process

### Step 1 — Run the script

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" <mode> [--project <root>]
```

Copilot CLI / Antigravity: `${PLUGIN_ROOT}` instead of `${CLAUDE_PLUGIN_ROOT}`. Manual `@import` setups: `$SPECTURE_ROOT/scripts/doctor.js`. Add `--json` when you need to parse the result.

### Step 2 — `check`: present the table, do not fix anything

Show the script's table as-is (severity, check, detail, suggested action) and the migration list. Then, in Spanish, one paragraph: what is ERROR (blocks or corrupts something today), what is WARNING (degrades quality), and the single next command. Do not paraphrase findings into "todo bien" — if the table is empty, say the table is empty.

### Step 3 — `migrate`: three kinds, three treatments

1. **Dry run first** — `migrate` without `--apply`. Show what *would* be applied.
2. **Mechanical** — `migrate --apply`. The script applies them one by one, verifies each, logs to `.specture/migrations.log`, and stops the chain at the first failed verify. Show `git diff --stat` afterwards.
3. **Assisted** — for every migration the script lists under *Assisted*:
   - `migrate --plan <id> --json` gives you the material (`planInputs`) and the target file.
   - **`EnterPlanMode`**, write **one** plan with **all** assisted deltas (per migration: file, exact delta, rationale — the format `knowledge` capture uses), **`ExitPlanMode`**. The user approves atomically; approve-some means re-run with the rejected ones excluded.
   - Apply the approved deltas with `Edit`, then `migrate --verify <id> --by skill` for each. `verify()` must pass before it is logged; if it fails, the migration is not done — fix the delta, do not log by hand.
4. **Content** — never applied here. The script records them as `deferred` with their owner skill; tell the user which skill owns it and when it will run (e.g. `1.9-current-state-init` → `knowledge reconcile --component <slug>`, lazily, the first time an epic touches a component).
5. Re-run `check`. Then propose the commit — the doctor **never commits on its own**:
   > "Migración aplicada hasta schema `<version>`. Commit sugerido: `chore(specture): migrate to schema <version>` — ¿lo hago?"

### Step 4 — `sync`

Used by CI and by `start` Step 0. Mechanical migrations are applied and the check runs; assisted and content migrations are only listed. Exit 1 on any ERROR — that is the point.

## Migration catalog (what each id does)

| id | kind | effect |
|---|---|---|
| `1.2-state-gitignore` | mechanical | `.specture/state/` in `.gitignore` |
| `1.6-boundary-capabilities` | assisted | `Exposición` marks on HUs + "Capacidades de Frontera" section in `business_requirements.md` |
| `1.6-contract-companion` | assisted | readable `docs/02-architecture/api-contract.md` for the declared contract file |
| `1.7-meta-gitignore` | mechanical | `docs/.specture-meta/` in `.gitignore` (suggests `git rm --cached` if tracked) |
| `1.8-drop-parallel-toggle` | mechanical | removes `build.max_parallel_epics` |
| `1.9-dependencies-syntax` | assisted | `Dependencias:` lines rewritten in the parseable grammar |
| `1.9-current-state-init` | content | `_current/` backfill — owned by `knowledge reconcile`, lazy |
| `1.9-tombstones` | mechanical | collapses older closed milestones to tombstones, IDs preserved, bodies archived |
| `1.10-rules-sections` | mechanical | §12 / §13 stubs in `conventions.md` |
| `1.11-profile-and-knowledge` | mechanical | `learn.enabled` → `knowledge.enabled`; explicit profile |
| `1.12-structure-block` | assisted | `project.slug` + `structure` block in `stack.yml` |
| `1.15-settings-file` | mechanical | toggles from §10 → `.specture/settings.yml` (+ pointer) |
| `1.15-schema-version` | mechanical | `schema_version` = last fully-applied version |
| `1.16-requirements-ids` | assisted | stable `RN-nnn` / `CL-nnn` / `FA-nnn` IDs on rules, edge cases and out-of-scope in `business_requirements.md` |
| `1.16-requirements-merge` | assisted | `feature-*.md` drafts / "Adenda" sections merged per-section into `business_requirements.md`, drafts deleted |
| `1.18-metrics-tracked` | mechanical | `.gitignore`: `docs/.specture-meta/` → `docs/.specture-meta/*` + `!docs/.specture-meta/build-metrics.jsonl` (the build metrics are tracked — decision A7); suggests `git add` when the file exists |
| `1.19-rules-file` | mechanical | invariants `R-*` from `conventions.md` §12 (table or bullets; placeholders skipped) → `.specture/rules.yml`; §12 becomes a pointer; notes the rules that were tagged `all` / IMPORTANT by default or exceed 240 characters (the doctor then flags `rule-length`) |

## Red Flags — STOP

| Rationalization | Reality |
|---|---|
| "El proyecto ya funciona, no hace falta migrar" | It works *without* the features the plugin assumes: reviewers without `_current/`, validators without the contract companion, hooks reading a §10 that nobody maintains. Half a feature is worse than none — run the migration or record explicitly why not. |
| "La de contenido la hago yo rápido, es solo consolidar specs" | A content migration is judgment over thousands of lines. The doctor defers it to its owner skill on purpose. Never do it inline. |
| "Marco `applied` en el log, el `verify` es una formalidad" | The log is evidence. Only `migrate --verify <id>` writes `applied`, and only when `verify()` passes. |
| "Aplico las asistidas directamente, sin Plan mode, para no interrumpir" | Assisted migrations rewrite user-owned documents (requirements, ROADMAP, stack). They go through Plan mode, always. |
| "No hay node, hago los chequeos leyendo los archivos" | No. Say the doctor needs Node ≥ 22 and stop. Hand-made checks are exactly the "verifier narrower than the claim" failure the doctor exists to prevent. |

## Exit criteria

- [ ] The script ran (not a manual approximation) and its table was shown verbatim.
- [ ] In `migrate`: every applied migration has a log line; every assisted one went through Plan mode + `--verify`; every content one was reported with its owner.
- [ ] `schema_version` in `.specture/settings.yml` reflects the last fully-applied version.
- [ ] The commit was proposed, not made.
