# Setup — Mode A: Bootstrap (empty project)

Companion of `skills/setup/SKILL.md`. Read it when Mode Detection resolved to **Bootstrap**: the
project has no `.specture/stack.yml` and no source files yet, so the configuration comes from an
interactive wizard, never from detection. Finish with the "Verification Before Exit" checklist of
`SKILL.md`.

## Contents

| Step | What it does |
|---|---|
| 1 — Greet and explain | Set expectations, in Spanish |
| 2 — Ask in groups of 2-3 questions | Stack, architecture, conventions, profile — never more at once |
| 3 — Validate coherence | Flag contradictions before writing anything |
| 4 / 4.5 — Generate the configuration files · `.gitignore` | Templates → `.specture/`, settings, the ignore lines (runtime state, telemetry, reviews, debug logs) |
| 5 — Generate the project's `CLAUDE.md` | The import of Specture |
| 6 — Confirm `$SPECTURE_ROOT` | Manual `@import` setups only |
| 7 — Suggest next step | Route to `discover` |

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
   - **Mapa de ubicaciones (`conventions.md` §2) — obligatorio preguntarlo:** dónde vive cada cosa: componentes · types e interfaces · constantes · hooks/composables · servicios/casos de uso · tests. Cada slot admite un patrón de ruta (`src/components/<Nombre>/<Nombre>.tsx`), `co-localizado`, `no aplica` o `sin definir`. **`sin definir` es una respuesta legítima y visible**: deja constancia de que la decisión está pendiente. Nunca lo rellenes vos — las reglas `R-FILE-003` y `R-FILE-004` leen esta tabla, y una ubicación inventada por la IA se vuelve una convención que nadie eligió y nadie recuerda haber elegido. Bastan dos o tres preguntas: no hace falta cerrar los seis slots en el arranque.
   - **Invariantes (`.specture/rules.yml`, opcional):** reglas que nunca cambian (ej. "DTOs inmutables", naming de métodos), **una línea cada una** (`rule` ≤ 240 caracteres) con `tags` (módulo / componente / `backend`·`frontend`·`mobile` — el coordinador de `build` inyecta solo las que cruzan con el spec), `severity` y `source` (ADR o debug log con la historia). **Workflow (§13 de `conventions.md`, opcional):** de dónde nace cada rama por tipo de trabajo, formato de commit. Si el usuario no tiene reglas propias, el archivo se queda **solo con el núcleo** (los ejemplos del template van comentados) y §13 con sus filas de ejemplo — sin reglas de rama, `build` no crea ramas. `conventions.md` §12 es solo un puntero.
   - **Núcleo obligatorio (`framework-core`) — no se pregunta, se informa:** `rules.template.yml` ships con `R-FILE-001` (un componente por archivo), `R-FILE-002` (una clase o servicio exportado por archivo), `R-FILE-003` (types e interfaces fuera del archivo del componente o de la clase, donde diga el mapa de §2), `R-FILE-004` (frontend/mobile: hooks y constantes compartidas fuera del archivo del componente; una constante local no exportada puede quedarse) y `R-SOLID-001` (SOLID en frontend y backend). Son obligatorias en todo proyecto Specture. El usuario **puede endurecerlas** (subir una severidad, añadir tags, precisar el texto) y añadir las suyas; **no puede quitarlas ni bajarles la severidad** — el doctor lo reporta como ERROR (`rules-core-missing`, `rules-core-weakened`). Decíselo en una línea al presentar las convenciones; no lo escondas.
   - **Comandos de calidad (`stack.yml` → `quality.commands`) — obligatorio preguntarlos:** los seis comandos que el framework **ejecuta** tal cual (`test` — la suite completa, que solo corre en la línea base y en el Step 7 —, `test_scoped` — solo los tests de `{files}` / `{names}`, lo que corren writer, implementer y post-checks —, `type_check`, `lint`, `format_check`, `mutation`), con `{files}` donde la herramienta acepte rutas y `{names}` donde filtre por clase o nombre de test. El framework es agnóstico: nunca deduzcas un comando del nombre de la herramienta ni lo inventes — `sin definir` es una respuesta legítima y visible (el check queda `SKIPPED` y el doctor avisa), `none` significa "no aplica". Si la pila coincide con una entrada de `$SPECTURE_ROOT/docs/quality-catalog.md`, **proponé** sus comandos y, si el usuario quiere mecanizar `R-FILE-*`, la configuración de linter del catálogo en Plan mode, archivo por archivo — cada archivo se escribe solo con su confirmación explícita. Mencioná en una línea `mutation.enabled` (`settings.yml`, default off): con él, el Step 6 del build corre `mutation` sobre los archivos del spec y el reviewer deja de mutar a mano.
   - **Perfil de capacidades (`.specture/settings.yml` → `profile`):** `lean` (huella mínima — hooks on, docs-index/knowledge/context7 off), `full` (todo on), o `custom` + toggles individuales. Si el usuario no opina, `custom` con los defaults del template (comportamiento conservador). La **revisión de cumplimiento** al cerrar cada milestone (`compliance_review.enabled`) viene activa en cualquier perfil; decíselo en una línea y apagala solo si lo pide.
   - **Nivel de TDD (`tdd.level`):** una sola pregunta cerrada con default `strict`: *¿`strict` (TDD completo: un test por AC/BR/EC, sello, gate de honestidad, suite completa — para producción), `essential` (un test por AC, sin variantes ni mutación — proyectos chicos o internos) o `none` (sin RED: spec → implementar → revisar → verificar con type-check y lint — experimentos; no es TDD, el reviewer es el único verificador)?* Vale en cualquier perfil y se congela por epic al abrirlo. Si el usuario no opina, `strict`.
   - **Reglas de revisión del equipo (`.specture/review-rules.md`, opcional):** ¿el equipo ya tiene criterios de revisión escritos (una guía, un checklist, un agente de review)? Si sí, el archivo los **enlaza** por ruta y sección en vez de copiarlos — el implementer recibe los que aplican a cada spec y la revisión de cumplimiento los verifica al cerrar cada milestone. Si no, no se crea: su ausencia es el estado normal. Las reglas de **ubicación** de archivos no van ahí sino en el mapa de §2, que también ve quien planifica.

3. **Validate coherence** before writing files. Examples of incoherence to flag:
   - Stack móvil (Flutter) + ORM relacional como EF Core.
   - Solo frontend declarado pero pidiendo configurar database.
   - DDD declarado para un proyecto CRUD trivial → preguntar si realmente lo necesita (YAGNI).

4. **Generate the configuration files** by populating these templates from `$SPECTURE_ROOT`:
   - `templates/project-config/stack.template.yml` → `.specture/stack.yml`
   - `templates/project-config/conventions.template.md` → `.specture/conventions.md`
   - `templates/project-config/rules.template.yml` → `.specture/rules.yml` — copiá el template **entero, con sus cinco reglas `framework-core` intactas**, y anexá después las invariantes `R-*` del usuario (una por línea, con `tags`/`severity`/`source`). Los `tags` tienen que ser de los que resuelven — `all` (estilo, estructura, naming que aplican siempre), `backend`/`frontend`/`mobile`, o el slug de un componente de `architecture.md` para una regla de dominio —: un tag conceptual (`dto`, `naming`) no coincide con ningún spec y la regla nunca llega al implementer (el doctor avisa `rules-tag-unreachable`). Si no declaró ninguna, el archivo queda con el núcleo y nada más — nunca con `rules: []`. Nunca escribas reglas en `conventions.md` §12 (puntero).
   - `templates/project-config/decisions/000-template.md` → `.specture/decisions/001-initial-stack.md` (registra la decisión inicial del stack)
   - `templates/project-config/settings.template.yml` → `.specture/settings.yml` — el archivo **del framework**: `schema_version` = la versión del plugin instalado (leé `version` de `${CLAUDE_PLUGIN_ROOT}/plugin.json`, o de `$SPECTURE_ROOT/plugin.json` en setup manual; nunca dejes el placeholder `[X.Y.Z]`), `profile` y toggles según lo que respondió el usuario. Los toggles **no** van en `conventions.md` §10 (esa sección es solo un puntero).
   - `templates/project-config/review-rules.template.md` → `.specture/review-rules.md` — **solo si el usuario lo pidió** en el paso 2: copiá el template y completá sus secciones con lo que el usuario indicó (rutas y encabezados reales, nunca inventados). Validalo antes de seguir: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review-rules-resolve.js" --project . --all` debe salir con 0.

   **Al poblar `stack.yml`:**
   - **Deriva `project.slug`** desde `project.name`: minúsculas, espacios y guiones → `_`, elimina cualquier carácter fuera de `[a-z0-9_]`, colapsa `_` repetidos y recorta `_` de los extremos. Ej. "Mi Proyecto-X" → `mi_proyecto_x`. **Muéstraselo al usuario para confirmar** antes de escribir.
   - **Rellena `structure`** con `root_layout: by-app-suffix` por defecto y, en `structure.apps`, deja **solo las entradas de las apps que el usuario describió** (paso 2) — comenta o borra las demás. Para CLI/librería sin apps desplegables, usa `root_layout: flat` y omite `apps`.

4.5. **Add these lines to `.gitignore`** — `.specture/state/`, `docs/.specture-meta/*`, `!docs/.specture-meta/build-metrics.jsonl`, `!docs/.specture-meta/design-metrics.jsonl`, `docs/07-reviews/review-*.md`, `docs/07-reviews/cumplimiento-pr-*.md`, `docs/07-reviews/cumplimiento-rama-*.md` and `docs/06-debug-logs/`. Code reviews, PR/branch compliance reports and debug logs are read while the epic is open and deleted when its milestone closes — nothing depends on them afterwards, so they are never versioned (the milestone compliance reports `cumplimiento-milestone-*.md` are: the triage reads them). The first directory holds runtime state used by Specture hooks (e.g. `build-locked.json`); the second holds local telemetry (e.g. `index-usage.jsonl`, `learn-history.jsonl`) that is user-specific and must not be committed — **except** `build-metrics.jsonl` (per-epic build metrics) and `design-metrics.jsonl` (per-run Phase 03 metrics), which are process evidence and are tracked (the negation re-includes it; git cannot re-include a file under an ignored directory, hence the `/*` form). If a `.gitignore` does not exist, create one with the four lines. If it exists, add whichever line is missing. Idempotent (this is exactly what migrations `1.2-state-gitignore`, `1.7-meta-gitignore`, `1.18-metrics-tracked` and `2.0-design-metrics-tracked` enforce on existing projects).

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

