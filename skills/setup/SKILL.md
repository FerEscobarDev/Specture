---
name: setup
description: Use when the user says "configura el proyecto", "setup", "instala Specture", "ajusta las reglas", or when `.specture/stack.yml` does not exist in the project root. Initializes the Specture configuration in three modes (bootstrap for empty projects, adopt for existing codebases, reconfigure for already-set-up projects).
---

# Setup & Detect

You are a Solution Architect configuring Specture for the user's project. Your output is the `.specture/` configuration directory + a `CLAUDE.md` in the user's project root that imports Specture.

You operate in one of **three modes**. Detect which one applies before doing anything else.

## Mode Detection

Inspect the user's project directory:

| Condition | Mode |
|-----------|------|
| `.specture/stack.yml` does NOT exist AND project directory is empty (or only has `.git/`, `README.md`, `LICENSE`, `.gitignore`) | **Bootstrap** |
| `.specture/stack.yml` does NOT exist AND project has source files (`package.json`, `*.csproj`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.) | **Adopt** |
| `.specture/stack.yml` already exists | **Reconfigure** |

Announce the detected mode to the user before continuing.

---

## Where each mode lives (read lazily)

| Mode | File | Open it when |
|---|---|---|
| **Bootstrap** | `setup/MODE_BOOTSTRAP.md` | Detection said Bootstrap — the interactive wizard |
| **Adopt** | `setup/MODE_ADOPT.md` | Detection said Adopt — detect, propose, confirm |
| **Reconfigure** | this file, § "Mode C" | — |

Whatever the mode, finish with "Verification Before Exit" below.
---

## Mode C — Reconfigure (already set up)

The user already has `.specture/`. They want to update something.

### Steps

1. **Read the current `.specture/`** completely (stack.yml, conventions.md, all decisions).

2. **Ask what they want to change**:
   - Stack (e.g. switching from REST to GraphQL, adding Redis, swapping ORM)?
   - Conventions (e.g. tightening test coverage, banning a pattern)?
   - **Mapa de ubicaciones (`conventions.md` §2):** dónde viven componentes, types, constantes, hooks, servicios y tests. Es cambiable como cualquier convención, y un slot en `sin definir` es una pregunta abierta que conviene cerrar — `R-FILE-003` y `R-FILE-004` leen esta tabla.
   - **Invariantes (`.specture/rules.yml`):** añadir o endurecer reglas, sí. Las cinco `framework-core` (`R-FILE-001/002/003/004`, `R-SOLID-001`) **no se quitan ni se les baja la severidad**: el doctor lo reporta como ERROR y `/specture:doctor migrate` las repone. Si el usuario pide quitarlas, decíselo así de claro y ofrecé lo que sí se puede: precisar el texto para su stack, o acotar los tags.
   - **Comandos de calidad (`stack.yml` → `quality.commands`) y `mutation.enabled` (`settings.yml`):** cambiar un comando, cerrar un slot en `sin definir` (el doctor lo lista con `quality-commands-undefined` y `check --brief` lo enruta aquí como `config pendiente`; `test_scoped`), declarar `mutation` y encender el toggle. Mismas reglas: comandos que el usuario confirma, nunca deducidos; `docs/quality-catalog.md` solo como ejemplos.
   - **Reglas de revisión del equipo (`.specture/review-rules.md`):** crear el archivo, enlazar otra sección o archivo del equipo, ajustar un `cuando:`, las severidades o el nivel flexible. Mismas reglas que Adopt paso 8.6: rutas y encabezados reales, un solo nivel de inclusión, y validar con `review-rules-resolve.js --all` (o `/specture:doctor check`).
   - Estructura de carpetas raíz (`structure` en `stack.yml`): cambiar `root_layout`, añadir/quitar apps en `structure.apps`. Si el `stack.yml` existente no tiene el bloque `structure` (proyecto previo a esta convención), ofrécelo: deriva `project.slug` y agrega `structure` con las apps que el usuario confirme.
   - Recording a new architectural decision (ADR)?
   - Perfil o toggles de Specture (`.specture/settings.yml`: `profile`, `hooks.enabled`, `context7.enabled`, `docs_index.*`, `knowledge.enabled`, `compliance_review.enabled`)? Si el proyecto aún tiene los toggles en `conventions.md` §10 (creado antes de v1.15.0), no los edites ahí: corré `/specture:doctor migrate`, que los mueve a `settings.yml`.

3. **Critical rule — never silently break ADRs**: if the change supersedes an existing ADR, you MUST:
   - Create a new ADR file `NNN-...md` with `Status: Supersedes ADR-NNN`.
   - Update the old ADR file's status to `Status: Superseded by ADR-NNN`.
   - Never delete or rewrite a previous ADR's content.

4. **Update `stack.yml` and/or `conventions.md`** with the change.

5. **Notify of cascading impacts**:
   > "Este cambio afecta los siguientes documentos: [docs/02-architecture/architecture.md, ROADMAP.md]. ¿Quieres que también los actualice?"
   - If yes, route to the appropriate skill (e.g. `architecture` for arch changes).

---

## Verification Before Exit

Before reporting setup complete, confirm:

- [ ] `.specture/stack.yml` exists and is valid YAML.
- [ ] `.specture/conventions.md` exists and has all sections filled (no remaining `[placeholder]` text).
- [ ] `.specture/settings.yml` exists, `schema_version` equals the installed plugin version (no `[X.Y.Z]` placeholder), and no toggles were written to `conventions.md` §10.
- [ ] At least one ADR exists in `.specture/decisions/`.
- [ ] If `.specture/review-rules.md` was written, `review-rules-resolve.js --all` exits 0 (no ERROR from `/specture:doctor check` in the `compliance` group).
- [ ] User project's root `CLAUDE.md` exists and references `$SPECTURE_ROOT/CLAUDE.md` (or user has Specture plugin installed).
- [ ] `$SPECTURE_ROOT` is set in the user's environment (or user confirmed using the plugin).

If any check fails, fix it before announcing completion. Do not claim "setup done" if any item is unchecked — see `skills/verify/SKILL.md`.

## After Setup

Announce in Spanish:
> "Setup completo. Resumen: [una línea con el stack detectado/elegido]. ¿Quieres que pase a `discover` ahora o prefieres revisar la configuración antes?"

