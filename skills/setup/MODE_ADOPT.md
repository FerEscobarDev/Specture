# Setup — Mode B: Adopt (existing project)

Companion of `skills/setup/SKILL.md`. Read it when Mode Detection resolved to **Adopt**: the
project has source files but no `.specture/stack.yml`. Everything here is **detected and
confirmed**, never invented — a value you cannot detect is a question, not a guess. Finish with the
"Verification Before Exit" checklist of `SKILL.md`.

## Contents

| Step | What it does |
|---|---|
| 1 — Greet and explain | Set expectations |
| 2 — Detection scan · 3 — Structural scan | Read the manifests and the tree |
| 4 — Draft `stack.yml` · 5 — Show it in chunks | Propose, confirm field by field |
| 6 — Build `conventions.md` | Sampled from 3-5 real source files per type |
| 7 — `decisions/001-adopted-stack.md` | The first ADR |
| 8 — Write all files | `.specture/` + settings + `.gitignore` lines |
| 8.5 — Existing documentation detection | Routes to `setup-docs-bridge` when ≥10 `.md` files exist |
| 8.6 — Existing review criteria (opt-in) | `.specture/review-rules.md` from the team's own guides |
| 9 — Suggest next step | Route onward |

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
   - **Invariants (`.specture/rules.yml`) / §13 Workflow:** create `rules.yml` from the template **as it comes, with its five `framework-core` rules** (`R-FILE-001/002/003/004`, `R-SOLID-001`) — they are mandatory in every Specture project, they can be tightened but never removed, and the doctor reports their absence as ERROR. Beyond the core, don't invent invariants; a rule you *observe* in the code (e.g. every DTO is immutable) may be proposed to the user as a one-line entry with `tags`, `severity` and `source` pointing at the code convention — tags that resolve (`all`, a layer, or a component slug of `architecture.md`), never a conceptual one like `dto`. For §13 branching, **infer the base branch from git**: if a `develop` branch exists, suggest feature→`develop`; otherwise feature→`main`. With no project rules beyond the core, and an untouched §13, there is no extra enforcement and no auto-branching. `conventions.md` §12 stays a pointer.
   - **Quality commands (`stack.yml` → `quality.commands`):** detect the commands the repo already runs (`package.json` scripts, `Makefile`, CI workflow steps, `composer.json`, `*.csproj` + CI) and **propose** them slot by slot (`test`, `test_scoped` — only the tests in `{files}` / `{names}` —, `type_check`, `lint`, `format_check`, `mutation`); the user confirms each one — a command you guessed from a tool name never goes in. `sin definir` stays visible; `none` is a decision. Offer the matching entry of `docs/quality-catalog.md` as examples only, and the linter configuration for `R-FILE-*` only in Plan mode, file by file.
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

8.6. **Existing review criteria (opt-in)**. Teams often already keep their review criteria somewhere — an agent or skill used to review pull requests, a review checklist, a contributing guide. Specture can **link** them from `.specture/review-rules.md` instead of copying them, so the implementer follows them and the compliance review checks them.

Look for candidates (read-only): `.claude/agents/*review*`, `.claude/agents/*revis*`, `.claude/skills/*review*/SKILL.md`, `.github/*review*`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, and `*review*` / `*revision*` / `*estandar*` files under the documentation folder of 8.5. None found → skip this step silently.

For each candidate, list its `##`/`###` headings and ask:

> "Encontré criterios de revisión que el equipo ya usa: `<archivo>` (secciones: …). ¿Querés que Specture los tenga en cuenta? Elegí qué secciones incluir — conviene dejar afuera las de procedimiento (cómo obtener el diff, dónde guardar el resultado) y quedarse con las de criterios."

- **Sí** → write `.specture/review-rules.md` from `templates/project-config/review-rules.template.md` with only what the user chose:
  - one `## Incluye` line per chosen section (`<ruta> § <encabezado>`, the heading copied exactly);
  - `— cuando: <globs>` only with evidence — a section named after a technology maps to the paths `stack.yml.structure` (or the code) shows for it; when unsure, no condition;
  - `## Severidades` only with the words the source uses (e.g. "bloqueante", "observación");
  - `## Nivel flexible` only if the source declares legacy paths with reduced criteria — never inferred;
  - when a chosen section is about **where files live**, propose moving that rule to the §2 location map instead (the planner sees §2; the implementer cannot move files a sealed spec placed).

  Validate with `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review-rules-resolve.js" --project . --all` (exit 0) and show the user the `CUSTOM_RULES:` header line. Never include a file the user did not choose; never edit the team's files.
- **No** → continue with Step 9. Nothing is written.

9. **Suggest next step**:
   - If the project already has features: offer to either (a) continue building with Specture for new features (`new-feature`), or (b) audit the existing code (full code review against the inferred conventions).
   - If the project has **both a frontend and a backend**, also offer (c) `contract-sync-audit` to reconcile their API interface — strongly recommend it if the user has mentioned frontend/backend mismatches.
   - If `frontend.ui_defined: true`, mention that Phase 3 will document the existing design system rather than create a new one.
   - If the project is just scaffolding: offer to go to `discover` to formalize requirements.

