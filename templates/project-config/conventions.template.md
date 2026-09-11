# Convenciones del Proyecto

> Este archivo describe las convenciones específicas que el equipo (humano + IA) debe seguir en este proyecto. Es leído por todos los skills y agentes de Specture antes de generar código, specs o reviews. Cuando una convención aquí entra en conflicto con una regla genérica del framework, **gana esta convención** — con una excepción: las reglas `framework-core` de `.specture/rules.yml` (§12) son obligatorias en todo proyecto Specture y sólo se pueden **endurecer**, nunca quitar ni ablandar.

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

### Mapa de ubicaciones

> **Dónde vive cada cosa.** Lo exige `R-FILE-003` del núcleo: interfaces, types, constantes y
> hooks viven fuera del archivo del componente o de la clase, y este mapa es el que dice dónde.
> Un slot con `sin definir` **no es un hueco que el agente pueda rellenar por su cuenta**: es la
> señal de que hay que preguntarle al equipo. Rellenarlo solo convierte una decisión sin tomar en
> una convención invisible que después nadie recuerda haber elegido.
>
> Valores válidos: un patrón de ruta · `co-localizado` (junto al archivo que lo usa, con su propio
> archivo) · `no aplica` · `sin definir`.

| Qué | Dónde | Ejemplo |
|---|---|---|
| Componentes | [patrón] | `src/components/<Nombre>/<Nombre>.tsx` |
| Types e interfaces | [patrón · `co-localizado`] | `src/components/<Nombre>/<Nombre>.types.ts` |
| Constantes | [patrón · `co-localizado`] | `src/constants/<dominio>.ts` |
| Hooks / composables | [patrón · `co-localizado`] | `src/hooks/use<Nombre>.ts` |
| Servicios / casos de uso | [patrón] | `src/<modulo>/application/<Nombre>Service.ts` |
| Tests | [patrón · `co-localizado`] | `src/**/<Nombre>.test.ts` |

- **Ejemplos de jerarquía esperada:**
  ```
  [Pegar aquí un árbol de carpetas representativo del proyecto]
  ```

## 2.1 Estructura de Carpetas Raíz (apps)

> Cómo se nombran las carpetas raíz de cada app del proyecto. La **fuente de verdad operativa** es `stack.yml.structure` (la leen `architecture` y `build`); esta sección es la versión legible para humanos. Aplica cuando `structure.root_layout: by-app-suffix`; con `flat`/`custom` esta convención no rige.

- **Prefijo:** `project.slug` (snake_case lowercase, derivado del nombre en `/setup`).
- **Patrón:** `{slug}_<rol>`. Solo existen las carpetas de los roles que el proyecto realmente tenga.

| Rol del componente | Carpeta raíz | Se crea si… |
|--------------------|--------------|-------------|
| Backend / API | `{slug}_api` | hay backend |
| Frontend web público (SSR / sitio marketing-app) | `{slug}_web` | existe ese componente |
| App autenticada / SPA / móvil | `{slug}_app` | existe ese componente |
| Landing de marketing | `{slug}_landing` | existe ese componente |

> Ej. con `project.slug: mi_app` y backend + web: `mi_app_api/`, `mi_app_web/`. Cada componente de app en `architecture.md` declara su carpeta resuelta en el campo "Carpeta raíz"; los componentes lógicos internos (no desplegables) llevan "n/a".

## 3. Patrones Permitidos (Allow-list)

- [ej. Repository pattern para acceso a datos]
- [ej. Dependency Injection vía constructor]
- [ej. Pure functions en la capa de dominio]
- [ej. Result type para errores recuperables]

## 4. Patrones Prohibidos (Deny-list)

> Estas son cosas que **explícitamente no queremos** en este proyecto, aunque el lenguaje las permita o sean comunes en otros proyectos.
>
> Cada ítem ocupa **≤ 2 líneas**: el patrón prohibido y, si hace falta, el enlace a la historia (ADR o debug log). El relato del bug de origen nunca va inline — el doctor lo marca (`rule-length`).

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

> **Desde v1.15.0 la configuración del framework vive en `.specture/settings.yml`** (perfil `lean | full | custom`, toggles `hooks.enabled`, `context7.enabled`, `docs_index.enabled`, `docs_index.max_entries_per_dispatch`, `knowledge.enabled`, y `schema_version`). Es un archivo del framework: lo escribe `/specture:setup` y lo migra `/specture:doctor`. Esta sección es solo un **puntero** — no declares toggles aquí.
>
> Proyectos creados antes de v1.15.0 pueden conservar aquí el bloque viejo de toggles (`- **hooks.enabled**: true`, …); el framework lo sigue leyendo hasta que `/specture:doctor migrate` lo mueva a `settings.yml`.

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

> **Núcleo obligatorio (`framework-core`), desde v2.0.0.** Cuatro invariantes vienen con el framework y son obligatorias en todo proyecto Specture: `R-FILE-001` (un componente por archivo), `R-FILE-002` (una clase o servicio exportado por archivo), `R-FILE-003` (types, interfaces, constantes y hooks fuera del archivo del componente o de la clase, en la ubicación que declara el mapa de §2) y `R-SOLID-001` (SOLID en frontend y backend). Se pueden **endurecer** —subir la severidad, añadir tags, precisar el texto— y el proyecto puede añadir las suyas; quitar un id o bajar una severidad es ERROR del doctor (`rules-core-missing`, `rules-core-weakened`) y `/specture:doctor migrate` lo repone. Es la única excepción a la regla de precedencia de la cabecera de este archivo.

> **Desde v1.19.0 las invariantes viven en `.specture/rules.yml`** — una entrada por regla (`id`, `tags`, `rule` ≤ 240 caracteres, `verify`, `severity`, `source`). El coordinador de `build` inyecta en cada dispatch **solo** las reglas cuyos tags cruzan con el spec (Rules Resolution, `hooks/lib/rules-resolve.js`); las **aplica** el `implementer`/`ux-implementer` y las **enforça** el `code-reviewer` (Dimensión 7) citándolas por ID. La historia de cada regla (el bug, el incidente, el porqué) vive en un ADR o debug log **enlazado** desde `source`, nunca inline — el doctor marca `rule-length`. Esta sección es solo un **puntero** — no declares reglas aquí; `/specture:knowledge capture` las escribe en `rules.yml`. Para patrones de más alto nivel usá §3 (allow-list) / §4 (deny-list). Sin reglas en `rules.yml`, la Dimensión 7 del reviewer no encuentra nada (no-op) — comportamiento por defecto.
>
> Proyectos creados antes de v1.19.0 pueden conservar aquí la tabla `| ID | Ámbito (tag) | Regla | … |` (o bullets `- **R-n:** …`); `/specture:doctor migrate` (`1.19-rules-file`) la mueve a `rules.yml` y deja este puntero.

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
