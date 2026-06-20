# Convenciones del Proyecto

> Este archivo describe las convenciones específicas que el equipo (humano + IA) debe seguir en este proyecto. Es leído por todos los skills y agentes de Specture antes de generar código, specs o reviews. Cuando una convención aquí entra en conflicto con una regla genérica del framework, **gana esta convención**.

## 1. Naming

- **Variables y funciones:** [ej. camelCase | snake_case]
- **Clases / tipos:** [ej. PascalCase]
- **Constantes globales:** [ej. UPPER_SNAKE_CASE]
- **Archivos:** [ej. kebab-case.ts | PascalCase.cs | snake_case.py]
- **Tests:** [ej. `*.test.ts` | `*_test.go` | `test_*.py`]
- **Carpetas:** [ej. kebab-case | snake_case]

## 2. Organización de Archivos

- **Estructura por:** [feature | layer | módulo de dominio]
- **Co-localización:** [tests junto al código | tests en carpeta separada]
- **Tamaño máximo de archivo (líneas):** [ej. 300]
- **Ejemplos de jerarquía esperada:**
  ```
  [Pegar aquí un árbol de carpetas representativo del proyecto]
  ```

## 3. Patrones Permitidos (Allow-list)

- [ej. Repository pattern para acceso a datos]
- [ej. Dependency Injection vía constructor]
- [ej. Pure functions en la capa de dominio]
- [ej. Result type para errores recuperables]

## 4. Patrones Prohibidos (Deny-list)

> Estas son cosas que **explícitamente no queremos** en este proyecto, aunque el lenguaje las permita o sean comunes en otros proyectos.

- [ej. Repositorios genéricos `Repository<T>`]
- [ej. Singletons mutables]
- [ej. Excepciones para flujo de control]
- [ej. Lógica de negocio en controllers]
- [ej. Acceso directo a la base desde la capa de presentación]

## 5. Estilo de Código

- **Indentación:** [ej. 2 espacios | 4 espacios | tabs]
- **Comillas:** [ej. simples | dobles]
- **Punto y coma:** [ej. obligatorios | opcionales]
- **Longitud máxima de línea:** [ej. 100]
- **Comentarios:** [ej. solo para "por qué", no para "qué hace"]

## 6. Manejo de Errores

- **Estrategia primaria:** [ej. Result<T,E> | exceptions | error-as-value]
- **Logging obligatorio en:** [ej. boundary errors, integraciones externas]
- **Política con `null`/`undefined`:** [ej. prohibido en tipos públicos | usar Option/Maybe]

## 7. Testing

- **Política TDD:** [Estricta (test antes de código) | Recomendada | Test-After permitido]
- **Niveles requeridos:** [unit | integration | e2e]
- **Mocks:** [ej. permitidos solo para integraciones externas]
- **Setup/teardown:** [ej. usar fixtures | builder pattern para datos de prueba]

## 8. Idioma del Código

- **Identificadores (variables, clases, funciones):** [ej. inglés]
- **Comentarios:** [ej. español | inglés]
- **Mensajes de commit:** [ej. inglés con conventional commits]
- **Documentación pública (READMEs, ADRs):** [ej. español]

## 9. Reglas Específicas del Equipo / Cliente

> Espacio libre para cualquier regla que no encaje en las anteriores.

- [Regla 1]
- [Regla 2]

## 10. Specture / Claude Code Integration

> Toggles opt-in para las capacidades nativas de Claude Code que Specture integra. Por defecto todos quedan en `false`: Specture funciona como en v1.1.0 (skill-based, sin hooks, sin MCP externo). Activá lo que quieras usar.

- **hooks.enabled**: [true | false]      # activa el TDD Honesty Gate (bloqueo mecánico de edits a tests durante GREEN). Nota: desde v1.5.0 el routing NO es automático — se entra a Specture invocando `/specture:start`; el antiguo hook SessionStart fue deregistrado.
- **context7.enabled**: [true | false]   # permite consultas a Context7 MCP en code-reviewer (Dimension 5: stack idiomaticity) y en modernize (gap analysis con docs vivas)- **docs_index.enabled**: [true | false]  # cuando `.specture/docs-index.yml` existe, el orquestador (build, architecture) resuelve hasta N entradas relevantes por dispatch y las pasa como contexto adicional a architecture-validator y code-reviewer. Default true cuando el archivo existe. Los agentes nunca leen el índice directamente.
- **docs_index.max_entries_per_dispatch**: 3  # tope duro de docs pasadas a UN dispatch del orquestador. Más entradas = más contexto = más caro y menos enfocado. Subí solo si el promedio de hits relevantes por spec supera 3 (medible en `docs/.specture-meta/index-usage.jsonl`).
- **learn.enabled**: [true | false]  # habilita los prompts opcionales de captura post-epic (build Step 8.5) y post-debug (debug Phase 4.5). Default false. Activá cuando el proyecto sea maduro y la documentación esté empezando a quedar atrás del código.
- **learn.min_session_threshold_minutes**: 30  # umbral para invocaciones MANUALES de `/specture:learn` sin trigger automático. Si la sesión fue más corta, learn solo corre con --force. Default 30. Las invocaciones desde build/debug ignoran este umbral.
- **learn.max_drafts_per_invocation**: 3  # tope duro de drafts propuestos en una invocación de learn. Mantenelo en 3 — bajarlo puede dejar capturas fuera, subirlo genera ruido. Default 3.
- **learn.write_human_report**: [true | false]  # si true, además del log estructurado en learn-history.jsonl, learn escribe un reporte humano-legible usando templates/LEARN_OUTPUT_TEMPLATE.md. Default false. Útil si el equipo audita aprendizajes periódicamente.

Cuando `hooks.enabled: false`, los scripts del plugin se cargan pero retornan sin actuar. Cuando `context7.enabled: false`, los agentes/skills que lo consultarían omiten esa fuente y marcan secciones afectadas como "needs manual verification" si aplica. Cuando `docs_index.enabled: false`, el orquestador omite la resolución del índice — útil para debug aislado o si el índice está corrupto/obsoleto. Cuando `learn.enabled: false`, los prompts opcionales de captura no se activan; `/specture:learn` sigue siendo invocable manualmente con `--force`.

## 11. Índice de Documentación

> Solo aplica cuando el proyecto tiene documentación preexistente abundante (proyectos modo Adopt). En proyectos greenfield esta sección puede quedar marcada como "No aplica".

- **Estado:** [No aplica | Activo | Skipped intencionalmente]
- **Source of truth dir:** [carpeta donde vive la documentación del equipo — ej. `SGD.Docs/`, `Documentation/`, `docs/`]
- **Index file:** `.specture/docs-index.yml` (con `<N>` entradas)
- **Bridges generados:**
  - `docs/01-requirements/business_requirements.md` [sí | no]
  - `docs/02-architecture/architecture.md` [sí | no]
  - `docs/03-ux-ui/navigation_map.md` [sí | no]
- **Regla de actualización:** cuando se agregue, renombre o elimine un archivo en el source-of-truth dir, **actualizar la entrada correspondiente en `docs-index.yml`** (manualmente o invocando `/specture:setup-docs-bridge` para regenerar). Periódicamente correr `/specture:audit-knowledge` para detectar drift.
- **Política de confidence:** entradas nuevas creadas por la IA nacen con `confidence: ai_categorized`. Promoverlas a `user_confirmed` cuando un humano valide la categorización + el `read_when`.
- **ADRs Proposed pendientes:** si el setup detectó decisiones implícitas y generó ADRs con `Status: Proposed — awaiting team confirmation`, listar aquí los nombres para que el equipo no los olvide:
  - [ ] `.specture/decisions/00X-<slug>.md` — pendiente confirmación del equipo
  - [ ] `.specture/decisions/00Y-<slug>.md` — pendiente confirmación del equipo

## 12. Invariantes del Proyecto (R-*)

> Reglas que **nunca cambian** y aplican en todo el proyecto. Las **aplica** el `implementer`/`ux-implementer` al escribir código; las **enforça** el `code-reviewer` (Dimensión 7), citándolas por ID. Para patrones de más alto nivel usá §3 (allow-list) / §4 (deny-list). Si no hay reglas aquí, la Dimensión 7 del reviewer no encuentra nada (no-op) — comportamiento por defecto.

| ID  | Ámbito (tag) | Regla | Cómo verificar | Severidad | Racional / ADR |
|-----|--------------|-------|----------------|-----------|----------------|
| R-1 | dto, domain  | [ej. Los DTOs son inmutables: sin setters, campos readonly/final] | [ej. sin setters públicos ni mutación post-construcción] | BLOCKER | [ej. DDD — ADR-00X] |
| R-2 | naming       | [ej. Métodos de consulta = sustantivo; comandos = verbo imperativo] | [ej. nombres de métodos nuevos] | IMPORTANT | §1 Naming |

## 13. Workflow / Proceso (W-*)

> Reglas de flujo que **sigue el orquestador de `build`**. No son reglas de código. El `build` crea la rama según estas reglas (**sin auto-merge**); el `implementer` honra el formato de commit. **Sin reglas de rama aquí, `build` NO crea ramas** (comportamiento por defecto).

### Branching — de dónde nace cada rama
| ID  | Tipo de trabajo | Rama base | Nombre |
|-----|-----------------|-----------|--------|
| W-1 | feature / epic  | [ej. `develop`] | [ej. `feature/<slug>`] |
| W-2 | hotfix / bug    | [ej. `main`]    | [ej. `hotfix/<slug>`] |

### Commits
- W-3: [ej. Conventional Commits; el cuerpo cita el spec (`Spec: docs/05-specs/...`)].

### Pull Requests
- W-4: [ej. base de PR = `develop` (features) · `main` (hotfix)]. Specture no crea ni mergea el PR — lo **sugiere** al cerrar la sesión de build.
