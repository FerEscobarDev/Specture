> **Estado: IMPLEMENTADO en v1.4.0.** Este es el documento de diseño de R4
> (modo agente-por-epic). El plan se realizó en `skills/build/SKILL.md` con tres
> secciones: "Execution Mode Selection", "Modo: Agentes por Epic" y
> "Modo: Inline (The Loop)". La implementación se reconcilió con features
> posteriores al plan original (TaskCreate de v1.2.0, Dispatch Manifest de
> v1.3.0): el coordinador es dueño de la única tarea TaskCreate visible por
> epic, y el epic-agent honra Dispatch Manifest + TDD Honesty Gate + todos los
> gates internamente. Se conserva como audit trail del diseño.

---

# Plan: Modo de Ejecución con Agentes por Epic en `build/SKILL.md`

## Context

El skill `build/SKILL.md` actúa como orquestador del loop de construcción. Actualmente corre **enteramente en el chat principal**, lo que significa que por cada epic se acumula: generación de spec, outputs de agentes, resultados de tests, revisiones, etc. En proyectos con 5-10+ epics, el contexto se llena antes de terminar, degradando la calidad y forzando resets manuales incómodos.

La solución: al inicio del build loop, ofrecer al usuario la elección explícita entre ejecutar en el chat principal (comportamiento actual) o despachar un agente-orquestador fresco por cada epic (contexto limpio).

## Análisis de viabilidad

**Viable.** El mecanismo ya existe:
- Claude Code provee la herramienta `Agent` para despachar subagentes con contexto aislado.
- El skill `build/SKILL.md` ya despacha 4 agentes especializados. El cambio mueve el **orquestador mismo** a un subagente, no solo los workers.

**Esfuerzo**: modificar un único archivo — `skills/build/SKILL.md`.

## Alternativas descartadas

- **Specs en paralelo dentro del epic**: los specs del mismo epic son semánticamente dependientes (Spec 1 define el modelo, Spec 2 construye el servicio, Spec 3 expone el API). Correrlos en paralelo genera implementaciones que no encajan aunque pasen sus tests individualmente. Descartado.
- **Epics en paralelo con worktrees**: viable técnicamente pero los epics suelen ser suficientemente grandes como para agotar el límite de tokens si se corren dos al mismo tiempo. Descartado. **(REVERTIDO en v1.5.0 — ver addendum abajo y `docs/parallel-epic-design.md`.)**

## Implementación

### Archivo a modificar
`skills/build/SKILL.md`

### Cambio 1 — Agregar `## Execution Mode Selection`

Insertar entre `## Required Inputs` y `## The Loop`. Presenta al usuario la elección entre Agentes por Epic (recomendado, 4+ epics) e Inline (1-3 epics).

### Cambio 2 — Agregar `## Modo: Agentes por Epic`

El chat principal es solo coordinador. Por epic: lee checkboxes del ROADMAP, bloquea el epic `[/]`, prepara contexto base, despacha un epic-agent fresco (sin heredar historial) que corre Steps 2-8, y procesa el reporte (DONE/BLOCKED/REJECTED_MAJOR) verificando contra el filesystem.

El prompt del epic-agent incluye tres instrucciones de omisión: saltar "Execution Mode Selection" (ya está en ese modo), saltar Step 1 (epic ya bloqueado), saltar Step 9 (context reset N/A — su contexto se descarta).

### Cambio 3 — Renombrar `## The Loop` → `## Modo: Inline (The Loop)`

Mismo loop de Steps 1-9 sin cambios funcionales, con una nota de que el contexto acumula y se recomienda solo para 1-3 epics.

## Verificación

1. Leer el archivo modificado de principio a fin y confirmar coherencia de estructura.
2. Verificar que el skill presenta la elección antes de hacer cualquier work.
3. Verificar que el modo inline funciona exactamente igual (solo cambió el nombre de la sección y se agregó una nota).
4. Verificar que el prompt del epic-agent incluye las tres instrucciones de omisión (mode selection, Step 1, Step 9).
5. **Reconciliación post-plan:** confirmar que el coordinador posee la tarea TaskCreate visible y que el epic-agent honra Dispatch Manifest + TDD Honesty Gate.

---

## Addendum v1.5.0 — Paralelo revertido del "descartado"

La objeción original al paralelismo era doble: **(a)** agotamiento de tokens al correr dos epics grandes a la vez, y **(b)** implícitamente, conflictos de working tree / git. v1.5.0 las neutraliza, no las ignora:

- **(a) Token budget** → tope configurable `build.max_parallel_epics` (default 3, `1` = secuencial). El coordinador sigue O(n_epics) en contexto (solo checkboxes + reportes); el consumo simultáneo queda acotado por diseño, no librado al azar.
- **(b) Conflictos** → cada epic-agent corre en un **git worktree aislado** (`isolation: "worktree"`); no comparten working tree. El coordinador es único escritor de `ROADMAP.md`. Un **gate de integración secuencial** mergea de a un epic y corre la suite completa antes de marcar `[x]`: el acoplamiento no declarado entre epics paralelos aflora ahí (conflicto de merge o fallo post-merge → `debug`), nunca se shippea en silencio.

La decisión "specs en paralelo dentro del epic: descartado" **se mantiene** — los specs de un mismo epic siguen siendo semánticamente dependientes. El paralelismo de v1.5.0 es estrictamente **a nivel epic**. Diseño completo: `docs/parallel-epic-design.md`. Implementación: sección "Modo: Agentes por Epic en Paralelo (Olas)" en `skills/build/SKILL.md`.
