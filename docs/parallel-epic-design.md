> **Estado: IMPLEMENTADO en v1.5.0.** Documento de diseño del modo de ejecución
> "Agentes por Epic en Paralelo (Olas)". La implementación vive en
> `skills/build/SKILL.md` (sección homónima). Revierte la decisión "Epics en
> paralelo con worktrees: descartado" de `docs/agent-per-epic-design.md`.

---

# Plan: Modo de Ejecución Paralelo por Olas en `build/SKILL.md`

## Context

El modo "Agentes por Epic" (v1.4.0) resolvió el crecimiento de contexto del coordinador despachando un epic-agent fresco por epic — pero **uno a la vez**. En ROADMAPs anchos donde varios epics no tienen dependencias entre sí (típico en milestones de "foundation" o features paralelas), ejecutarlos en serie desperdicia throughput: el wall-clock crece linealmente con el número de epics aunque sean independientes.

La solución: el coordinador computa el conjunto de epics "listos" (dependencias satisfechas) y despacha una **ola** de hasta N epic-agents concurrentes, cada uno aislado en su propio git worktree, e integra los resultados de a uno detrás de un gate de verificación completa.

## Análisis de viabilidad

**Viable.** Mecanismos ya disponibles:
- La herramienta `Agent` acepta `isolation: "worktree"`: cada subagente trabaja sobre una copia aislada del repo en su propia rama; el worktree se limpia solo si no hubo cambios, o devuelve rama/path si los hubo.
- Múltiples llamadas `Agent` en un solo mensaje del asistente corren concurrentemente.
- El coordinador de agent-per-epic ya solo retiene checkboxes + reportes (contexto O(n_epics)); el paralelismo no cambia eso.

**Esfuerzo**: principalmente un archivo — `skills/build/SKILL.md` (nueva sección + ampliación de Execution Mode Selection). Más: toggle en `conventions.template.md`, sintaxis de dependencias parseable en `ROADMAP_TEMPLATE.md`, notas en `hooks/README.md`.

## Objeciones del diseño original y cómo se neutralizan

`docs/agent-per-epic-design.md` descartó el paralelismo por **agotamiento de tokens**. Implícito quedaba el riesgo de **conflictos de git/working tree**. Ambas se resuelven sin debilitar ningún gate:

| Objeción | Mitigación v1.5.0 |
|----------|-------------------|
| Dos epics grandes en paralelo agotan tokens | `build.max_parallel_epics` (default 3, `1` = secuencial). Consumo simultáneo acotado por diseño. Coordinador sigue O(n_epics). |
| Conflictos de working tree entre epic-agents | `isolation: "worktree"` por epic-agent. No comparten working tree. |
| Escritura concurrente de `ROADMAP.md` | El coordinador es **único escritor** de `ROADMAP.md`; los epic-agents tienen prohibido tocarlo. |
| Colisión de `.specture/state/build-locked.json` | Un archivo por worktree; el hook resuelve project root por cwd. Sin colisión. |
| Tests por-epic pasan pero los epics no componen | **Gate de integración secuencial**: merge de a uno + suite completa sobre el árbol integrado antes de marcar `[x]`. |

## Alternativas descartadas (se mantienen del diseño previo)

- **Specs en paralelo dentro del epic**: los specs de un mismo epic son semánticamente dependientes (modelo → servicio → API). Correrlos en paralelo produce piezas que no encajan aunque pasen sus tests. **Sigue descartado.** El paralelismo de v1.5.0 es estrictamente a nivel epic.
- **Merge en bloque de toda la ola**: mergear todos los worktrees juntos esconde qué par de epics rompió la integración. Se prefiere merge secuencial con verificación tras cada uno.

## Implementación

### Archivo principal
`skills/build/SKILL.md` — `## Modo: Agentes por Epic en Paralelo (Olas)`.

### Loop del coordinador
1. Computar ready set (epics `[ ]` con todas sus dependencias `[x]`), parseando solo checkbox + línea `Dependencias`.
2. Tomar hasta `build.max_parallel_epics` en orden estable.
3. Marcar `[/]` y commitear `ROADMAP.md` (un commit por ola). `TaskCreate` una tarea por epic.
4. Despachar la ola: una llamada `Agent` por epic, todas en el mismo mensaje, cada una con `isolation: "worktree"`, prompt self-contained con dos reglas extra (no tocar `ROADMAP.md`; reportar rama + SHAs).
5. Esperar toda la ola; recolectar reportes.
6. **Gate de integración** (en orden de dependencia): merge → suite completa → `[x]` + commit, o escalar (conflicto / fallo → `debug`), dejando el epic `[/]`.
7. Recomputar ready set → siguiente ola, hasta agotar pendientes.

### Sin pérdida de gates
Cada epic-agent corre el loop completo dentro de su worktree: Dispatch Manifest, architecture-validator, RED commit, TDD Honesty Gate (Step 5.5), code-reviewer, verificación. El coordinador añade el gate de integración por encima. Inline y secuencial quedan sin cambios funcionales.

## Edge cases

- **Acoplamiento de archivos no declarado** entre dos epics ready: detectado en el gate de integración (conflicto de merge o fallo post-merge). Recomendación al usuario: declarar la dependencia en el ROADMAP y re-serializar ese par.
- **Fallo aislado**: un epic `BLOCKED`/`REJECTED_MAJOR`/en conflicto no aborta a sus hermanos de la ola; solo su progreso (y el de sus dependientes transitivos) se detiene hasta que el usuario lo resuelva.
- **Ready set vacío con pendientes restantes**: ciclo de dependencias o todos bloqueados por un epic escalado → detener y escalar.

## Verificación

1. Leer `skills/build/SKILL.md` completo: los 3 modos coexisten; Inline y secuencial sin cambios funcionales.
2. El prompt del epic-agent paralelo incluye omisiones (mode selection, Step 1, Step 8 — lo marca el coordinador, Step 9) + reglas paralelas (no ROADMAP; reportar rama/SHAs).
3. Sintaxis de `Dependencias` en `ROADMAP_TEMPLATE.md` parseable de forma determinística; convención de estados consistente con multi-`[/]`.
4. `conventions.template.md` sección 10: `build.max_parallel_epics` con default y semántica claros.
5. Smoke test en proyecto destino: ROADMAP con ≥2 epics independientes → modo Olas → despacho concurrente en worktrees → merge + verificación secuencial → `[x]` solo tras integración limpia.
