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

## Mode A — Bootstrap (empty project)

The user is starting from scratch. You will create the configuration through an interactive wizard.

### Steps

1. **Greet and explain** (in Spanish):
   > "Detecté un proyecto nuevo. Voy a hacerte preguntas para configurar Specture. Tus respuestas se guardarán en `.specture/stack.yml` y `.specture/conventions.md` y serán la fuente de verdad para todas las fases."

2. **Ask in groups of 2-3 questions** (never more at once). Suggested order:
   - Tipo de proyecto y propósito en una línea.
   - Lenguaje principal del backend (o "ninguno" si es solo frontend).
   - Framework backend, ORM/driver de base de datos, base de datos.
   - Si tiene frontend: framework, librería UI, estilos.
   - Patrón arquitectónico (sugiere uno apropiado al stack y deja al usuario validar).
   - **Apps del proyecto (estructura de carpetas raíz):** qué apps tendrá — backend/API, web público, app/SPA/móvil, landing. Determina qué entradas de `structure.apps` quedan en `stack.yml` (ver paso 4).
   - Convenciones de naming, organización por feature/layer, patrones permitidos/prohibidos.
   - **Mapa de ubicaciones (`conventions.md` §2) — obligatorio preguntarlo:** dónde vive cada cosa: componentes · types e interfaces · constantes · hooks/composables · servicios/casos de uso · tests. Cada slot admite un patrón de ruta (`src/components/<Nombre>/<Nombre>.tsx`), `co-localizado`, `no aplica` o `sin definir`. **`sin definir` es una respuesta legítima y visible**: deja constancia de que la decisión está pendiente. Nunca lo rellenes vos — la regla `R-FILE-003` lee esta tabla, y una ubicación inventada por la IA se vuelve una convención que nadie eligió y nadie recuerda haber elegido. Bastan dos o tres preguntas: no hace falta cerrar los seis slots en el arranque.
   - **Invariantes (`.specture/rules.yml`, opcional — desde v1.19.0):** reglas que nunca cambian (ej. "DTOs inmutables", naming de métodos), **una línea cada una** (`rule` ≤ 240 caracteres) con `tags` (módulo / componente / `backend`·`frontend`·`mobile` — el coordinador de `build` inyecta solo las que cruzan con el spec), `severity` y `source` (ADR o debug log con la historia). **Workflow (§13 de `conventions.md`, opcional):** de dónde nace cada rama por tipo de trabajo, formato de commit. Si el usuario no tiene reglas propias, el archivo se queda **solo con el núcleo** (los ejemplos del template van comentados) y §13 con sus filas de ejemplo — sin reglas de rama, `build` no crea ramas. `conventions.md` §12 es solo un puntero.
   - **Núcleo obligatorio (`framework-core`) — no se pregunta, se informa:** `rules.template.yml` ships con `R-FILE-001` (un componente por archivo), `R-FILE-002` (una clase o servicio exportado por archivo), `R-FILE-003` (types, interfaces, constantes y hooks fuera del archivo del componente o de la clase, donde diga el mapa de §2) y `R-SOLID-001` (SOLID en frontend y backend). Son obligatorias en todo proyecto Specture. El usuario **puede endurecerlas** (subir una severidad, añadir tags, precisar el texto) y añadir las suyas; **no puede quitarlas ni bajarles la severidad** — el doctor lo reporta como ERROR (`rules-core-missing`, `rules-core-weakened`). Decíselo en una línea al presentar las convenciones; no lo escondas.
   - **Perfil de capacidades (`.specture/settings.yml` → `profile`):** `lean` (huella mínima — hooks on, docs-index/knowledge/context7 off), `full` (todo on), o `custom` + toggles individuales. Si el usuario no opina, `custom` con los defaults del template (comportamiento conservador).

3. **Validate coherence** before writing files. Examples of incoherence to flag:
   - Stack móvil (Flutter) + ORM relacional como EF Core.
   - Solo frontend declarado pero pidiendo configurar database.
   - DDD declarado para un proyecto CRUD trivial → preguntar si realmente lo necesita (YAGNI).

4. **Generate the configuration files** by populating these templates from `$SPECTURE_ROOT`:
   - `templates/project-config/stack.template.yml` → `.specture/stack.yml`
   - `templates/project-config/conventions.template.md` → `.specture/conventions.md`
   - `templates/project-config/rules.template.yml` → `.specture/rules.yml` — copiá el template **entero, con sus cuatro reglas `framework-core` intactas**, y anexá después las invariantes `R-*` del usuario (una por línea, con `tags`/`severity`/`source`). Si no declaró ninguna, el archivo queda con el núcleo y nada más — nunca con `rules: []`. Nunca escribas reglas en `conventions.md` §12 (puntero desde v1.19.0).
   - `templates/project-config/decisions/000-template.md` → `.specture/decisions/001-initial-stack.md` (registra la decisión inicial del stack)
   - `templates/project-config/settings.template.yml` → `.specture/settings.yml` — el archivo **del framework**: `schema_version` = la versión del plugin instalado (leé `version` de `${CLAUDE_PLUGIN_ROOT}/plugin.json`, o de `$SPECTURE_ROOT/plugin.json` en setup manual; nunca dejes el placeholder `[X.Y.Z]`), `profile` y toggles según lo que respondió el usuario. Los toggles **no** van en `conventions.md` §10 (esa sección es solo un puntero desde v1.15.0).

   **Al poblar `stack.yml`:**
   - **Deriva `project.slug`** desde `project.name`: minúsculas, espacios y guiones → `_`, elimina cualquier carácter fuera de `[a-z0-9_]`, colapsa `_` repetidos y recorta `_` de los extremos. Ej. "Mi Proyecto-X" → `mi_proyecto_x`. **Muéstraselo al usuario para confirmar** antes de escribir.
   - **Rellena `structure`** con `root_layout: by-app-suffix` por defecto y, en `structure.apps`, deja **solo las entradas de las apps que el usuario describió** (paso 2) — comenta o borra las demás. Para CLI/librería sin apps desplegables, usa `root_layout: flat` y omite `apps`.

4.5. **Add these four lines to `.gitignore`** — `.specture/state/`, `docs/.specture-meta/*`, `!docs/.specture-meta/build-metrics.jsonl` and `!docs/.specture-meta/design-metrics.jsonl`. The first directory holds runtime state used by Specture hooks (e.g. `build-locked.json`); the second holds local telemetry (e.g. `index-usage.jsonl`, `learn-history.jsonl`) that is user-specific and must not be committed — **except** `build-metrics.jsonl` (per-epic build metrics) and `design-metrics.jsonl` (per-run Phase 03 metrics), which are process evidence and are tracked (the negation re-includes it; git cannot re-include a file under an ignored directory, hence the `/*` form). If a `.gitignore` does not exist, create one with the four lines. If it exists, add whichever line is missing. Idempotent (this is exactly what migrations `1.2-state-gitignore`, `1.7-meta-gitignore`, `1.18-metrics-tracked` and `1.20-design-metrics-tracked` enforce on existing projects).

5. **Generate the project's `CLAUDE.md`** in the user project root:

   ```markdown
   # [Project Name]

   This project uses **Specture** as its AI-assisted development methodology.

   @$SPECTURE_ROOT/CLAUDE.md

   The project-specific configuration lives in `.specture/`:
   - `stack.yml` — technical stack (single source of truth)
   - `conventions.md` — naming, patterns, code style
   - `decisions/` — Architecture Decision Records

   To work with Specture on this project, invoke `/specture:start`
   (plugin) or ask to "continuar con el roadmap" / "iniciar el proyecto".
   Specture routing is opt-in — it does not run automatically.
   ```

6. **Confirm `$SPECTURE_ROOT` is set** (only needed for @import manual setup; plugin users can skip):
   > "Si estás usando el plugin de Specture, no necesitas esta variable. Si usas la instalación manual, necesito confirmar que tienes `$SPECTURE_ROOT` apuntando al repositorio de Specture. ¿Está configurada?"
   - Si no: explica cómo configurarla en Windows (`setx SPECTURE_ROOT "C:\ruta\a\Specture"`), Mac/Linux (`export SPECTURE_ROOT=...` en `.zshrc`/`.bashrc`).

7. **Suggest next step**:
   > "Setup completo. Cuando quieras avanzar, invoca `/specture:start` (o dime 'continuemos con el roadmap') y te enrutaré a la fase correcta — empezando por la Fase 1 (`discover`) para levantar requerimientos. El routing no es automático: se activa solo cuando lo pides."

---

## Mode B — Adopt (existing project)

The user has an existing codebase. You will **detect** the stack from files and propose a configuration. **Never invent values** — if something can't be detected, mark it as `unknown` and ask the user.

### Steps

1. **Greet and explain**:
   > "Detecté un proyecto existente con código. Voy a analizarlo para proponerte una configuración Specture. Después la valides o la corrijas."

2. **Detection scan** — read these files if they exist (use Glob/Read tools):

   | File | Infer |
   |------|-------|
   | `package.json` | Node.js, framework (Express/NestJS/Next.js/etc.), test framework, dependencies |
   | `*.csproj`, `*.sln`, `Directory.Packages.props` | .NET version, EF Core, packages |
   | `requirements.txt`, `pyproject.toml`, `Pipfile` | Python version, framework (Django/FastAPI/Flask), test framework |
   | `go.mod` | Go version, modules |
   | `Cargo.toml` | Rust version, dependencies |
   | `pom.xml`, `build.gradle` | Java/Kotlin, Spring Boot, etc. |
   | `Gemfile` | Ruby, Rails |
   | `composer.json` | PHP, Laravel/Symfony |
   | `pubspec.yaml` | Flutter/Dart |
   | `tsconfig.json`, `.eslintrc*`, `.prettierrc*` | TypeScript, lint/format conventions |
   | `docker-compose.yml`, `Dockerfile` | Containerization, possibly DB engine (postgres/mysql/redis) |
   | `prisma/schema.prisma`, `migrations/`, `*.dbcontext.cs` | ORM in use |

3. **Structural scan**:
   - Folder layout: `src/`, `app/`, `internal/`, `Modules/`, `domain/`, etc. → infer architecture pattern (layered, modular, hex, DDD).
   - Test folder layout → infer co-location convention.
   - **Mapa de ubicaciones (§2):** mirá dónde viven hoy componentes, types/interfaces, constantes, hooks/composables, servicios/casos de uso y tests, y **proponé** un patrón por slot a partir del código real (`src/components/<Nombre>/<Nombre>.tsx`, `co-localizado`, …). Lo que no puedas inferir con evidencia queda `sin definir` y se **pregunta** en el paso 5 — no se inventa. Una ubicación inferida es una propuesta, nunca la respuesta: el proyecto puede tener tres carpetas `hooks/` y ninguna convención.
   - Naming style of files (kebab-case vs PascalCase vs snake_case) → infer file naming convention.
   - **Existing UI detection:** if the project already ships a frontend with real components/pages (not just scaffolding), set `frontend.ui_defined: true` in the draft `stack.yml`. This tells Phase 3 (`ux-design`) to **reverse-engineer** the design system from the existing code rather than author one from scratch (the "Adopt with UI defined" exception). If the frontend is only scaffolding, leave `ui_defined: false`.
   - **API surface detection:** if the backend exposes HTTP endpoints, note whether a served OpenAPI/Swagger schema exists. Record it for a later `contract-sync-audit` if frontend/backend drift is suspected.

4. **Build a draft `stack.yml`** in memory. For each field:
   - If detected with confidence → fill in.
   - If detected but ambiguous → fill in with a comment `# detected but please confirm`.
   - If not detectable → leave as `unknown` and prepare a question.
   - **`project.slug` y `structure`:** deriva el `slug` igual que en Bootstrap (paso 4). Para `structure`, en modo Adopt la convención de carpetas nueva NO se impone sobre código existente: por defecto deja `root_layout: custom` (refleja el layout que ya tiene el proyecto). Solo si el usuario pide explícitamente adoptar el patrón `by-app-suffix`, mapea las carpetas raíz existentes a `structure.apps`.

5. **Show the draft to the user** in chunks (don't dump the whole YAML at once):
   > "Esto es lo que detecté:
   > **Backend:** TypeScript + NestJS + PostgreSQL + Prisma. ¿Correcto?"
   - Wait for confirmation. Iterate until accurate.
   - Then ask for the unknowns.

6. **Build `conventions.md`** by sampling 3-5 source files of each major type (controllers, services, tests) and inferring:
   - Naming conventions actually in use.
   - Patterns observed (Result type? Exceptions? DI? Repositories?).
   - Test style.
   - **Invariants (`.specture/rules.yml`) / §13 Workflow:** create `rules.yml` from the template **as it comes, with its four `framework-core` rules** (`R-FILE-001/002/003`, `R-SOLID-001`) — they are mandatory in every Specture project, they can be tightened but never removed, and the doctor reports their absence as ERROR. Beyond the core, don't invent invariants; a rule you *observe* in the code (e.g. every DTO is immutable) may be proposed to the user as a one-line entry with `tags`, `severity` and `source` pointing at the code convention. For §13 branching, **infer the base branch from git**: if a `develop` branch exists, suggest feature→`develop`; otherwise feature→`main`. With no project rules beyond the core, and an untouched §13, there is no extra enforcement and no auto-branching. `conventions.md` §12 stays a pointer.
   - **An adopted codebase will violate the core on day one** — that is expected and it is not a reason to soften it. Say so plainly: the rules apply to code from here on, the reviewer cites them by id on what the diff touches, and nobody is asking for a repo-wide refactor. Lowering `R-SOLID-001` to fit the current code is exactly the move the core exists to prevent.
   - Show the inferred conventions to the user for validation.

7. **Generate `decisions/001-adopted-stack.md`** documenting:
   - That the stack was adopted from existing code (not chosen greenfield).
   - Any technical debt or inconsistency observed (e.g. "mix of camelCase and snake_case in test files — recommend standardizing on camelCase").
   - Status: `Accepted`.

8. **Write all files** — including `.specture/settings.yml` with `schema_version` = plugin version (same as Bootstrap step 4) — and generate the project `CLAUDE.md` (same as Bootstrap step 5). Also ensure `.specture/state/`, `docs/.specture-meta/*`, `!docs/.specture-meta/build-metrics.jsonl` and `!docs/.specture-meta/design-metrics.jsonl` are listed in `.gitignore` (same rule as Bootstrap step 4.5; `.specture-meta/` holds local telemetry that must not be committed, except the tracked build metrics).

8.5. **Existing documentation detection (mandatory in Adopt mode)**.

Scan for preexisting documentation folders that the team already maintains. Patterns:

- `docs/`, `Documentation/`, `documentation/`, `documents/`, `wiki/`
- `*.Docs/` (.NET convention — e.g. `SGD.Docs/`, `MyProject.Docs/`)
- Any folder containing a `README.md` at its root AND ≥10 `.md` files (recursive count)

For each candidate, count `.md` files recursively. If **at least one** candidate has **≥10 .md files**, the team almost certainly has knowledge that Specture should NOT re-extract from scratch via `discover`.

Announce the finding and offer to bridge:

> "Detecté `<carpeta>` con `<N>` archivos .md mantenidos por el equipo. Specture no debe re-extraer esa información — puedo generar un índice machine-readable (`.specture/docs-index.yml`) y archivos puente para que los agentes la lean de forma dirigida sin duplicar contenido. ¿Procedo? (S/n)"

- **Sí** → invoke `./skills/setup-docs-bridge/SKILL.md` passing the detected folder as `source_of_truth_dir`. When that skill returns, continue with Step 9.
- **No** → continue with Step 9. Add a one-line note in `.specture/conventions.md` Section 11 explaining the user opted out, so a future setup pass doesn't re-prompt.

If no candidate folder reaches ≥10 .md files, skip 8.5 entirely and continue to Step 9.

9. **Suggest next step**:
   - If the project already has features: offer to either (a) continue building with Specture for new features (`new-feature`), or (b) audit the existing code (full code review against the inferred conventions).
   - If the project has **both a frontend and a backend**, also offer (c) `contract-sync-audit` to reconcile their API interface — strongly recommend it if the user has mentioned frontend/backend mismatches.
   - If `frontend.ui_defined: true`, mention that Phase 3 will document the existing design system rather than create a new one.
   - If the project is just scaffolding: offer to go to `discover` to formalize requirements.

---

## Mode C — Reconfigure (already set up)

The user already has `.specture/`. They want to update something.

### Steps

1. **Read the current `.specture/`** completely (stack.yml, conventions.md, all decisions).

2. **Ask what they want to change**:
   - Stack (e.g. switching from REST to GraphQL, adding Redis, swapping ORM)?
   - Conventions (e.g. tightening test coverage, banning a pattern)?
   - **Mapa de ubicaciones (`conventions.md` §2):** dónde viven componentes, types, constantes, hooks, servicios y tests. Es cambiable como cualquier convención, y un slot en `sin definir` es una pregunta abierta que conviene cerrar — `R-FILE-003` lee esta tabla.
   - **Invariantes (`.specture/rules.yml`):** añadir o endurecer reglas, sí. Las cuatro `framework-core` (`R-FILE-001/002/003`, `R-SOLID-001`) **no se quitan ni se les baja la severidad**: el doctor lo reporta como ERROR y `/specture:doctor migrate` las repone. Si el usuario pide quitarlas, decíselo así de claro y ofrecé lo que sí se puede: precisar el texto para su stack, o acotar los tags.
   - Estructura de carpetas raíz (`structure` en `stack.yml`): cambiar `root_layout`, añadir/quitar apps en `structure.apps`. Si el `stack.yml` existente no tiene el bloque `structure` (proyecto previo a esta convención), ofrécelo: deriva `project.slug` y agrega `structure` con las apps que el usuario confirme.
   - Recording a new architectural decision (ADR)?
   - Perfil o toggles de Specture (`.specture/settings.yml`: `profile`, `hooks.enabled`, `context7.enabled`, `docs_index.*`, `knowledge.enabled`)? Si el proyecto aún tiene los toggles en `conventions.md` §10 (creado antes de v1.15.0), no los edites ahí: corré `/specture:doctor migrate`, que los mueve a `settings.yml`.

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
- [ ] User project's root `CLAUDE.md` exists and references `$SPECTURE_ROOT/CLAUDE.md` (or user has Specture plugin installed).
- [ ] `$SPECTURE_ROOT` is set in the user's environment (or user confirmed using the plugin).

If any check fails, fix it before announcing completion. Do not claim "setup done" if any item is unchecked — see `skills/verify/SKILL.md`.

## After Setup

Announce in Spanish:
> "Setup completo. Resumen: [una línea con el stack detectado/elegido]. ¿Quieres que pase a `discover` ahora o prefieres revisar la configuración antes?"
