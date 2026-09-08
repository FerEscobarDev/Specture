> **Estado: IMPLEMENTADO en v1.15.0 (2026-08-28).** Decisiones de §7 cerradas por el usuario
> el mismo día: A1 `settings.yml` · A2 `start` solo avisa · A3 catálogo completo, content
> solo agendado · A4 snippet de CI documentado (README, "Configuración por Proyecto") ·
> A5 doctor antes del gate. Implementación: `scripts/doctor.js`, `hooks/lib/doctor/`,
> `hooks/lib/settings.js`, `migrations/`, `skills/doctor/SKILL.md`. Diferencias respecto a
> este diseño: el catálogo se ordena por `since` con orden declarado en empates; el gate de
> release es un **manifest de hashes** (`migrations/schema-manifest.json`) en vez de un diff
> por commit; `--verify <id>` es el único camino que registra una migración asistida como
> aplicada. Se conserva como audit trail del diseño.
>
> Origen: el usuario, tras `docs/psikora-scale-review.md`, observó que `specture:doctor`
> podría además **validar que la estructura Specture del proyecto cumple con la versión
> instalada del plugin** — porque Psikora se configuró antes de `_current/`, §12/§13,
> `structure`, `api`, `profile`… y "a pesar de actualizar el plugin, nunca se generó nada
> que lo activara". Este documento nombra el hueco, lo prueba con la historia de Psikora,
> y propone el mecanismo. Sigue la disciplina `write-skill` para implementarse.

# Diseño: `specture:doctor` — diagnóstico del corpus + migraciones de esquema del proyecto

## 1. El hueco, en una frase

**Specture versiona el framework (`plugin.json`) pero no el proyecto.** No existe
`schema_version` en `.specture/`, no existe un catálogo de "qué cambia del lado del
proyecto en cada release", y cada skill asume la estructura **más reciente**. La
"backward-compat" de todos los diseños previos se definió como *"sin X, comportamiento
anterior"* — un **no-op silencioso**: el usuario actualiza el plugin creyendo que tiene
la capacidad, y no la tiene. Peor: cuando un skill aguas abajo sí asume X, el proyecto
recibe la mitad de la feature.

## 2. Evidencia: Psikora migró a mano tres veces y sigue atrás

| Fecha | Evento | Versión plugin | Resultado |
|---|---|---|---|
| 2026-05-14 | `.specture/` creado | ~v1.1-1.2 | esquema inicial |
| 2026-05-24 | `857dc998` hooks + `build.max_parallel_epics: 3` | v1.5 | toggle que v1.8 eliminó — quedó 3 meses |
| 2026-07-20 | `7e2fe74b` **ADR-030** "reconfiguración v1.12.0": `structure`, `api`, `profile`, `knowledge.enabled`, §12, §13 | v1.12 | hecho **a mano diffeando contra el template** ("única versión cacheada del plugin"); **`_current/` diferido** como "migración de contenido sustancial, tarea aparte" |
| 2026-08-21 | `fb0530da` "pone al día para v1.13.0": sintaxis parseable de `Dependencias`, retiro de `max_parallel_epics` | v1.13 | 2 meses después de v1.9 |
| 2026-08-27 | lápidas "adoptadas a medias"; el intento del 08-22 **perdió 94 IDs de epic** | v1.14 | lápidas apuntan a `archive/`, no a `_current/` (inexistente) |
| **nunca** | v1.6 **"Capacidades de Frontera"** + marca `Exposición` en HU (0 ocurrencias en `business_requirements.md`) | — | la Dimensión 6 del validator (cobertura bidireccional) **jamás pudo correr**; `conventions.md` §14 documenta el resultado: el contrato describía el 0 % de las respuestas durante meses |
| **nunca** | v1.7 gitignore de `docs/.specture-meta/` | — | `learn-history.jsonl` está trackeado *(desde v1.18.0 la forma es `docs/.specture-meta/*` + `!build-metrics.jsonl`: las métricas del build sí se trackean — migración `1.18-metrics-tracked`)* |

Tres instancias de "mitad de feature = peor que nada":
1. **Lápidas sin `_current/`**: `ROADMAP_TEMPLATE.md` manda apuntar la lápida a `_current/`;
   sin ese directorio, el puntero cuelga y el primer archivado rompió la resolución de
   dependencias (IDs perdidos).
2. **Validator sin contrato legible ni Capacidades de Frontera**: aprobó specs con
   `docs_index_resolved: []` y sin Dim 6 durante meses; nadie lo supo.
3. **Reviewer sin `_current/`**: la "Current-State Resolution" (v1.9) devolvió `[]` en
   cada dispatch de Psikora desde julio — el reviewer nunca vio comportamiento vigente.

Un `ADR-030` para "reconfigurar Specture" es en sí el síntoma: los ADRs son para
arquitectura del producto, no para el tooling. El framework le pidió al usuario que
hiciera de sistema de migraciones.

## 3. Principios

1. **El proyecto tiene versión de esquema.** `specture.schema_version` escrito por
   `setup` y avanzado por cada migración aplicada.
2. **Detectar por filesystem, no solo por número.** La versión dice qué migraciones
   *considerar*; un predicado mecánico por migración dice cuáles están *pendientes*.
   Psikora aplicó varias a mano: el doctor debe reconocerlas como hechas, no rehacerlas.
   Idempotente.
3. **Tres niveles, los de siempre.** `mechanical` (script aplica), `assisted` (un
   dispatch + Plan mode, el usuario aprueba), `content` (juicio sobre mucho texto —
   se agenda con dueño; nunca automático).
4. **Cero no-op silencioso.** Toda rama "si X no existe, comportamiento anterior" de
   todo skill emite **una línea** (una vez por sesión): *"X no inicializado — corré
   `/specture:doctor`"*. La degradación se ve.
5. **Inmutables intactos.** Las migraciones tocan `.specture/`, ROADMAP, requerimientos,
   arquitectura, `.gitignore`. Nunca specs `[x]`, reviews ni debug logs.
6. **Toda release que cambie estructura del proyecto embarca su migración.** Un test lo
   exige (ver §6).
7. **Sin ADR por upgrade.** El registro es `.specture/migrations.log` (trackeado).

## 4. Diseño

### 4.1 Tres modos de `/specture:doctor`

| Modo | Qué hace | Escribe |
|---|---|---|
| `check` (default) | (a) **lint del corpus** — N5 de `psikora-scale-review.md`: rutas citadas inexistentes, paths con `...`, ADR con número duplicado o `Status` no parseable, reviews sin `STATUS:`, specs sin `AC/BR/EC` con ID, specs sobre el techo de tamaño, `doc.md:NNN` en docs nuevos; (b) **drift de esquema** — `schema_version` vs `plugin.json` → migraciones pendientes por nivel; (c) **estado** — sello con epic no `[/]`, >1 epic `[/]`, `_current/` ausente con milestones cerrados, `docs-index.yml` vs toggle, residuos `.claude/worktrees`. Salida: tabla con severidad + comando sugerido. | nada |
| `migrate` | Aplica las pendientes: `mechanical` directo (con `git diff` mostrado); `assisted` vía Plan mode (un plan con todos los deltas, aprobación atómica, como `knowledge capture`); `content` → lista con dueño y skill destino, no aplica. Avanza `schema_version` **solo** hasta la última versión cuyas migraciones no-content estén todas hechas. | `.specture/`, ROADMAP, docs de fase, `.gitignore`, `migrations.log` |
| `sync` | `check` + `migrate` de solo las `mechanical` — para CI y para el Step 0 de `start`. | mínimo |

### 4.2 Catálogo de migraciones (en el framework)

`migrations/<version>-<slug>.js` (node, misma infraestructura que los hooks) con:

```
id, since (versión que la introdujo), kind: mechanical|assisted|content,
detect(projectRoot) → pending|done|n/a,      // predicado sobre el filesystem
apply(projectRoot) | plan(projectRoot) → delta // mechanical | assisted
verify(projectRoot) → ok,                     // post-condición
owner_skill                                   // content: a qué skill se agenda
```

Catálogo inicial (lo que Psikora necesitaría hoy):

| id | kind | detect | acción |
|---|---|---|---|
| `1.2-state-gitignore` | mechanical | `.specture/state/` ∉ `.gitignore` | agregar |
| `1.6-boundary-capabilities` | assisted | `business_requirements.md` sin "Capacidades de Frontera" / HU sin `Exposición` | proponer la sección derivándola de las HU + las operaciones del contrato (traza inversa `operationId → HU`) |
| `1.6-contract-companion` | assisted | `api.contract_file` existe y no hay compañero legible | generar `api-contract.md` desde el OpenAPI (tabla de operaciones + trazabilidad vacía para completar) |
| `1.7-meta-gitignore` | mechanical | ni `docs/.specture-meta/` ni `docs/.specture-meta/*` ∈ `.gitignore` | agregar (+ `git rm --cached` propuesto, no ejecutado); no re-agrega la forma directorio sobre la forma glob de 1.18 |
| `1.8-drop-parallel-toggle` | mechanical | `build.max_parallel_epics` presente | eliminar la línea |
| `1.9-dependencies-syntax` | assisted | líneas `Dependencias:` que no parsean | proponer reescritura línea a línea |
| `1.9-current-state-init` | **content** | `_current/` ausente ∧ milestones `[x]` > 0 | agendar backfill **lazy por componente** (N1) — el doctor lo reporta con dueño y, desde v1.19.0, nombra los componentes (`current-state-missing` / `current-state-partial`); lo ejecuta `knowledge reconcile --component <slug>` y `migrate --verify` lo registra |
| `1.9-tombstones` | mechanical | milestones cerrados > 2 sin lápida, o lápidas sin IDs | script que colapsa **preservando IDs por construcción** y apunta a `_current/` solo si existe (si no, a la carpeta de specs, con marca `pending:_current`) |
| `1.10-rules-sections` | mechanical | sin §12/§13 | insertar stubs del template |
| `1.11-profile-and-knowledge` | mechanical | `learn.enabled` presente / `specture.profile` ausente | renombrar / agregar |
| `1.12-structure-block` | assisted | `stack.yml` sin `structure` | proponer `slug` + `apps` desde las carpetas existentes que calcen `{slug}_<rol>` |
| `1.15-settings-file` | mechanical | toggles en `conventions.md` §10 o "Settings" | mover a `.specture/settings.yml` (N8); dejar puntero |
| `1.15-schema-version` | mechanical | sin `schema_version` | inferir por `detect()` de todas las anteriores y escribir |
| `1.16-requirements-ids` *(v1.16.0)* | assisted | reglas/casos/exclusiones sin `RN/CL/FA-nnn` | proponer los IDs estables en Plan mode |
| `1.16-requirements-merge` *(v1.16.0)* | assisted | `feature-*.md` o secciones "Adenda" | fusionar por sección en `business_requirements.md`, borrar borradores |
| `1.18-metrics-tracked` *(v1.18.0)* | mechanical | `.gitignore` sin `docs/.specture-meta/*` + `!docs/.specture-meta/build-metrics.jsonl` | reescribir la entrada (git no re-incluye bajo un directorio ignorado) y sugerir `git add` del archivo si existe |
| `1.19-rules-file` *(v1.19.0)* | mechanical | `conventions.md` existe y no hay `.specture/rules.yml` | mover las filas reales de §12 (tabla o bullets) a `rules.yml` (una regla por línea, `tags`/`severity`/`source`), dejar §12 como puntero; anotar las reglas con tags/severidad por defecto o > 240 caracteres |

### 4.3 Enganche en `start` (Step 0, una lectura de un campo)

Antes del Step 1 actual: leer `schema_version`; si `< plugin.version` → anunciar
*"Hay N migraciones pendientes (M mecánicas, K asistidas, C de contenido). ¿Corro
`/specture:doctor migrate` antes de enrutar?"* **No bloquea** — salvo que el skill al
que va a enrutar tenga una precondición dura pendiente (ej. `build` con milestones
cerrados y `1.9-current-state-init` pendiente → advertir que la reconciliación y el
reviewer trabajarán sin verdad viva). El usuario puede seguir; la advertencia queda en
el transcript.

### 4.4 Precondiciones declaradas por skill (cero no-op silencioso)

Cada skill lista sus precondiciones estructurales en una tabla corta al inicio (no en
prosa dispersa). `doctor check` las lee para el diagnóstico; el skill las usa para
emitir la línea de aviso cuando falta algo. Ejemplos: `build` 8.7 → `_current/`
inicializado o milestones cerrados = 0; `architecture` Part B → "Capacidades de
Frontera"; validator Dim 6 → `api.contract_file` + compañero.

### 4.5 Registro

- `.specture/settings.yml` (nuevo, dueño = framework): `schema_version`, toggles §10,
  perfil. `stack.yml` y `conventions.md` quedan enteramente del usuario.
- `.specture/migrations.log` (trackeado, append-only): `<fecha> <id> <kind> <applied|skipped|deferred> <by>`.
- `setup` escribe `schema_version = plugin.version` en proyectos nuevos.

## 5. Relación con las revisiones previas

| Este diseño | Absorbe |
|---|---|
| `doctor check` | N5 (lint), N7 (sello huérfano como chequeo), G1 parcial (los tests del doctor corren en CI) |
| `1.9-current-state-init` | N1 (backfill lazy) — el doctor lo **agenda**, N1 lo **hace** (`knowledge reconcile`, v1.19.0) |
| `1.15-settings-file` | N8 |
| `1.9-tombstones` | la mitad mecánica de N1 |
| Principio 4 | cambia **todos** los skills con fallback silencioso (build, architecture, validator, reviewer, new-feature) |

**Reordena el staging del gate:** el Spec Planning Gate trae cambios de estructura
(`_planning.md`, secciones nuevas de template, `spec_paths` en el sello). Sin doctor,
Psikora lo recibiría "a medias" por cuarta vez. Orden propuesto: **P0 (CI) →
doctor + catálogo (v1.15.0) → prerrequisitos P1, cada uno con su migración → gate
(v1.16/1.17)**.

## 6. Verificación (disciplina `write-skill`)

1. **Fixtures de proyecto por versión** en `migrations/test/fixtures/<version>/`: un
   `.specture/` + `docs/` mínimos "como los dejaba `setup` en esa versión". Test: `migrate`
   desde cada fixture llega al esquema actual; `detect()` de todas devuelve `done`
   después; correr `migrate` dos veces no cambia nada (idempotencia).
2. **Invariante setup ↔ migraciones**: `setup` fresco a la versión N produce un esquema
   en el que **todas** las migraciones ≤ N detectan `done`. Si no, o `setup` o el
   catálogo está mal.
3. **Gate de release**: si un commit cambia `templates/project-config/**`,
   `ROADMAP_TEMPLATE.md`, `SPEC_TEMPLATE.md` o la sección "Required Inputs" de un skill
   **sin** agregar/modificar un archivo en `migrations/`, el test falla.
4. **Escenario Psikora**: correr `doctor check` sobre un clon → debe reportar exactamente
   la tabla de §2 (7 pendientes, 2 nunca aplicadas, sello huérfano, ADR duplicado, 24
   rutas). Es el test de aceptación real.
5. Escenarios de racionalización (baseline sin skill): "el proyecto ya funciona, no
   migro"; "aplico la de contenido yo mismo porque es rápido" (→ debe agendar, no
   aplicar); "marco `done` sin correr `verify()`".

## 7. Decisiones abiertas (requieren al usuario)

1. **Dónde vive `schema_version`**: `stack.yml` (`specture.schema_version`) o nuevo
   `.specture/settings.yml` junto con los toggles (N8). *Recomendación: `settings.yml`* —
   un solo archivo del framework; los otros dos quedan del usuario.
2. **Política de bloqueo en `start`**: solo avisar (recomendado) o bloquear ante
   precondiciones duras del skill destino.
3. **Alcance de v1**: `check` + catálogo completo + `mechanical` + las dos `assisted` de
   v1.6, con `content` solo agendado — o incluir ya el backfill lazy de `_current/` (N1).
   *Recomendación: agendar; N1 es release propia.*
4. **Ejecución en CI**: `doctor sync` como job (falla en ERROR, avisa en WARNING) — sí/no.
5. **Orden vs el gate**: confirmar el reordenamiento de §5.
