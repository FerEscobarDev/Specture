---
name: 00-setup-and-detect
description: Use when the user says "configura el proyecto", "setup", "instala VibeCoding", "ajusta las reglas", or when `.vibecoding/stack.yml` does not exist in the project root. Initializes the VibeCoding configuration in three modes (bootstrap for empty projects, adopt for existing codebases, reconfigure for already-set-up projects).
---

# 00 — Setup & Detect

You are a Solution Architect configuring VibeCoding for the user's project. Your output is the `.vibecoding/` configuration directory + a `CLAUDE.md` in the user's project root that imports VibeCoding.

You operate in one of **three modes**. Detect which one applies before doing anything else.

## Mode Detection

Inspect the user's project directory:

| Condition | Mode |
|-----------|------|
| `.vibecoding/stack.yml` does NOT exist AND project directory is empty (or only has `.git/`, `README.md`, `LICENSE`, `.gitignore`) | **Bootstrap** |
| `.vibecoding/stack.yml` does NOT exist AND project has source files (`package.json`, `*.csproj`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.) | **Adopt** |
| `.vibecoding/stack.yml` already exists | **Reconfigure** |

Announce the detected mode to the user before continuing.

---

## Mode A — Bootstrap (empty project)

The user is starting from scratch. You will create the configuration through an interactive wizard.

### Steps

1. **Greet and explain** (in Spanish):
   > "Detecté un proyecto nuevo. Voy a hacerte preguntas para configurar VibeCoding. Tus respuestas se guardarán en `.vibecoding/stack.yml` y `.vibecoding/conventions.md` y serán la fuente de verdad para todas las fases."

2. **Ask in groups of 2-3 questions** (never more at once). Suggested order:
   - Tipo de proyecto y propósito en una línea.
   - Lenguaje principal del backend (o "ninguno" si es solo frontend).
   - Framework backend, ORM/driver de base de datos, base de datos.
   - Si tiene frontend: framework, librería UI, estilos.
   - Patrón arquitectónico (sugiere uno apropiado al stack y deja al usuario validar).
   - Convenciones de naming, organización por feature/layer, patrones permitidos/prohibidos.

3. **Validate coherence** before writing files. Examples of incoherence to flag:
   - Stack móvil (Flutter) + ORM relacional como EF Core.
   - Solo frontend declarado pero pidiendo configurar database.
   - DDD declarado para un proyecto CRUD trivial → preguntar si realmente lo necesita (YAGNI).

4. **Generate the configuration files** by populating these templates from `$VIBECODING_ROOT`:
   - `templates/project-config/stack.template.yml` → `.vibecoding/stack.yml`
   - `templates/project-config/conventions.template.md` → `.vibecoding/conventions.md`
   - `templates/project-config/decisions/000-template.md` → `.vibecoding/decisions/001-initial-stack.md` (registra la decisión inicial del stack)

5. **Generate the project's `CLAUDE.md`** in the user project root:

   ```markdown
   # [Project Name]

   This project uses **VibeCoding** as its AI-assisted development methodology.

   @$VIBECODING_ROOT/CLAUDE.md

   The project-specific configuration lives in `.vibecoding/`:
   - `stack.yml` — technical stack (single source of truth)
   - `conventions.md` — naming, patterns, code style
   - `decisions/` — Architecture Decision Records

   When working on this project, always start by invoking the VibeCoding entry point.
   ```

6. **Confirm `$VIBECODING_ROOT` is set**:
   > "Necesito confirmar que tienes la variable `$VIBECODING_ROOT` apuntando al repositorio de VibeCoding. ¿Está configurada en tu shell?"
   - Si no: explica cómo configurarla en Windows (`setx VIBECODING_ROOT "C:\ruta\a\VibeCoding"`), Mac/Linux (`export VIBECODING_ROOT=...` en `.zshrc`/`.bashrc`).

7. **Suggest next step**:
   > "Setup completo. Ahora puedes pasar a la Fase 1 (`01-discovery`) para levantar requerimientos, o decirme 'continuemos' y te enrutaré automáticamente."

---

## Mode B — Adopt (existing project)

The user has an existing codebase. You will **detect** the stack from files and propose a configuration. **Never invent values** — if something can't be detected, mark it as `unknown` and ask the user.

### Steps

1. **Greet and explain**:
   > "Detecté un proyecto existente con código. Voy a analizarlo para proponerte una configuración VibeCoding. Después la valides o la corrijas."

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
   - Naming style of files (kebab-case vs PascalCase vs snake_case) → infer file naming convention.

4. **Build a draft `stack.yml`** in memory. For each field:
   - If detected with confidence → fill in.
   - If detected but ambiguous → fill in with a comment `# detected but please confirm`.
   - If not detectable → leave as `unknown` and prepare a question.

5. **Show the draft to the user** in chunks (don't dump the whole YAML at once):
   > "Esto es lo que detecté:
   > **Backend:** TypeScript + NestJS + PostgreSQL + Prisma. ¿Correcto?"
   - Wait for confirmation. Iterate until accurate.
   - Then ask for the unknowns.

6. **Build `conventions.md`** by sampling 3-5 source files of each major type (controllers, services, tests) and inferring:
   - Naming conventions actually in use.
   - Patterns observed (Result type? Exceptions? DI? Repositories?).
   - Test style.
   - Show the inferred conventions to the user for validation.

7. **Generate `decisions/001-adopted-stack.md`** documenting:
   - That the stack was adopted from existing code (not chosen greenfield).
   - Any technical debt or inconsistency observed (e.g. "mix of camelCase and snake_case in test files — recommend standardizing on camelCase").
   - Status: `Accepted`.

8. **Write all files** and generate the project `CLAUDE.md` (same as Bootstrap step 5).

9. **Suggest next step**:
   - If the project already has features: offer to either (a) continue building with VibeCoding for new features (`transversal-new-feature`), or (b) audit the existing code (full code review against the inferred conventions).
   - If the project is just scaffolding: offer to go to `01-discovery` to formalize requirements.

---

## Mode C — Reconfigure (already set up)

The user already has `.vibecoding/`. They want to update something.

### Steps

1. **Read the current `.vibecoding/`** completely (stack.yml, conventions.md, all decisions).

2. **Ask what they want to change**:
   - Stack (e.g. switching from REST to GraphQL, adding Redis, swapping ORM)?
   - Conventions (e.g. tightening test coverage, banning a pattern)?
   - Recording a new architectural decision (ADR)?

3. **Critical rule — never silently break ADRs**: if the change supersedes an existing ADR, you MUST:
   - Create a new ADR file `NNN-...md` with `Status: Supersedes ADR-NNN`.
   - Update the old ADR file's status to `Status: Superseded by ADR-NNN`.
   - Never delete or rewrite a previous ADR's content.

4. **Update `stack.yml` and/or `conventions.md`** with the change.

5. **Notify of cascading impacts**:
   > "Este cambio afecta los siguientes documentos: [docs/02-architecture/architecture.md, ROADMAP.md]. ¿Quieres que también los actualice?"
   - If yes, route to the appropriate skill (e.g. `02-architecture-and-plan` for arch changes).

---

## Verification Before Exit

Before reporting setup complete, confirm:

- [ ] `.vibecoding/stack.yml` exists and is valid YAML.
- [ ] `.vibecoding/conventions.md` exists and has all sections filled (no remaining `[placeholder]` text).
- [ ] At least one ADR exists in `.vibecoding/decisions/`.
- [ ] User project's root `CLAUDE.md` exists and references `$VIBECODING_ROOT/CLAUDE.md`.
- [ ] `$VIBECODING_ROOT` is set in the user's environment (or the user has been told how to set it).

If any check fails, fix it before announcing completion. Do not claim "setup done" if any item is unchecked — see `transversal-verification.md`.

## After Setup

Announce in Spanish:
> "Setup completo. Resumen: [una línea con el stack detectado/elegido]. ¿Quieres que pase a `01-discovery` ahora o prefieres revisar la configuración antes?"
