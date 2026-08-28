> **Estado: ANÁLISIS DE VIABILIDAD — no implementado.** Documento solicitado por el
> usuario el 2026-07-29: "empezar a implementar worktree para la ejecución de las
> epics, haciendo que cada worktree maneje ramas para evitar los conflictos de
> merge de ramas, pensando en un flujo mínimo por default cuando se configure un
> proyecto." Antes de tocar código se hizo la revisión a fondo pedida. Este
> documento es el reporte — **no un plan aprobado**. Requiere decisión explícita
> del usuario en la sección "Preguntas abiertas" antes de pasar a implementación.

# Reporte de viabilidad: Worktrees por epic en el build loop

## 1. Contexto del pedido

La idea: cuando el coordinador de `build/SKILL.md` ejecuta epics, cada epic corre
en su propio **git worktree** con su propia **rama**, para evitar conflictos de
merge. Se pide además diseñar el **flujo mínimo por default** que `setup` debería
dejar configurado en un proyecto nuevo para que esto funcione correctamente.

Antes de diseñar nada, hay que confrontar esto con dos decisiones **ya tomadas y
cerradas** en este mismo framework, porque el pedido las toca directamente.

## 2. Historia previa (crítico — esto ya se intentó)

### 2.1 — v1.5.0: worktrees por epic en paralelo ("Modo Olas")

En v1.5.0 se introdujo un tercer modo de ejecución: el coordinador calculaba el
"ready set" (epics `[ ]` con dependencias `[x]`), despachaba hasta
`build.max_parallel_epics` epic-agents **concurrentes**, cada uno en un **git
worktree aislado**, con un gate de integración secuencial (cada epic DONE se
mergeaba de a uno, corriendo la suite completa antes de marcar `[x]`).

### 2.2 — v1.8.0: removido

Ese modo se **eliminó por completo** en v1.8.0 (`docs/agent-per-epic-design.md:31`,
`README.md:609-621`). La razón documentada **no fue una falla técnica de los
worktrees** — fue presupuesto de contexto/tokens: *"los epics suelen ser
suficientemente grandes como para agotar el límite de tokens si se corren dos al
mismo tiempo."* Se volvió a un único modo: **cola secuencial, concurrencia = 1**.

**Importante:** esto significa que el mecanismo de worktrees en sí ya fue
construido, usado y retirado una vez en este framework. No es territorio nuevo —
es territorio que se abandonó por una razón específica que sigue vigente si el
objetivo ahora también fuera reintroducir paralelismo.

### 2.3 — v1.10.0 (rules-registry): rama por sesión, explícitamente NO por epic

Independiente del punto anterior, cuando se diseñó `conventions.md` §13
(Workflow/Proceso, W-*) se cerró esta decisión derivada
(`docs/rules-registry-design.md`, tabla de decisiones):

> **granularidad de rama** → *"Por sesión de build (el batch/feature), no por
> epic — evita stacked-branches con dependencias; todos los epics encolados
> commitean a la misma rama, en orden."*

Y `build/SKILL.md` (sección "Branching (W-\*)") lo implementa así hoy: la rama se
crea **una vez por sesión**, antes del loop de la cola, y *"todos los epics
encolados commitean a esta **una** rama en orden de dependencia (no ramas por
epic → no hay problema de ramas apiladas)"*.

Esta decisión es la que el pedido actual **revierte directamente**: pasar de
"una rama por sesión" a "una rama por epic" es exactamente el escenario de
*stacked branches* que esa decisión existe para evitar, porque los epics de una
misma cola casi siempre tienen dependencias entre sí (Epic 1.2 depende de Epic
1.1, etc.) — si Epic 1.2 arranca su rama/worktree antes de que Epic 1.1 se haya
mergeado a la base, su rama nace "apilada" sobre una rama que todavía no es
canónica.

**No es un impedimento — es información que hay que tener sobre la mesa.** Se
puede resolver (ver §5), pero el pedido no llega a un terreno neutral: pisa dos
decisiones ya cerradas con razones documentadas.

## 3. ¿Qué problema real hay que resolver?

Con el modelo actual (concurrencia = 1, una rama por sesión), **no existen
conflictos de merge entre epics dentro de una sesión** — corren de a uno, en
orden, sobre la misma rama, así que no hay dos escrituras concurrentes que
puedan chocar. El pedido, entonces, tiene dos lecturas posibles y son
**arquitecturalmente muy distintas**:

**(A) Aislamiento para ejecución secuencial más segura** (lo que interpreto como
la lectura más probable dado que no se pidió reintroducir paralelismo):
- Batches largos (`N` alto o "todas") mantienen la rama de sesión viva mucho
  tiempo → si la rama base (`develop`/`main`) avanza mientras tanto (otro
  desarrollador, otro proceso), el conflicto aparece **una sola vez, al final,
  con todo el batch acumulado** — el peor momento posible para resolverlo.
- Si un epic termina `BLOCKED`/`REJECTED_MAJOR` a mitad de un batch, sus commits
  parciales quedan mezclados en la misma rama que los epics ya `DONE` — hoy se
  resuelve manualmente con `git revert`/`reset` de un rango, funciona pero no es
  limpio.
- Un worktree+rama por epic, mergeado a la rama de sesión **inmediatamente**
  después de cada `DONE` (merge pequeño y frecuente en vez de uno grande al
  final), reduce la ventana de drift y aísla el descarte de un epic fallido sin
  tocar los anteriores.

**(B) Reintroducir paralelismo real** (epics corriendo simultáneamente en
worktrees distintos): esto es literalmente el modo "Olas" de v1.5.0, retirado en
v1.8.0 por presupuesto de tokens. Si esta es la intención real, el problema de
fondo no es git — es que dos epic-agents grandes corriendo a la vez agotan
contexto, y worktrees no resuelven eso.

Este documento asume **(A)** como objetivo, porque es lo que el pedido describe
("evitar conflictos de merge", no "correr más rápido" o "en paralelo"). Si la
intención es (B), hace falta resolver primero el problema de presupuesto de
tokens que motivó el retiro de v1.8.0 antes de que valga la pena diseñar nada de
git — ver "Preguntas abiertas".

## 4. Viabilidad técnica

### 4.1 — El mecanismo nativo ya existe y es más barato que lo que Specture construiría a mano

Claude Code expone dos primitivas de worktree a nivel de herramienta, no hace
falta que Specture orqueste `git worktree add/remove` manualmente con Bash:

- **`EnterWorktree`/`ExitWorktree`** — nivel de sesión interactiva. Crea el
  worktree bajo `.claude/worktrees/`, rama nueva desde `origin/<default-branch>`
  o `HEAD` según `worktree.baseRef`, cambia el cwd de la sesión. `ExitWorktree`
  hace `keep` o `remove` (con protección: rechaza `remove` si hay cambios sin
  commitear salvo `discard_changes: true`).
- **`Agent(..., isolation: "worktree")`** — nivel de despacho de subagente
  (también disponible dentro de `Workflow`). Crea un worktree efímero para esa
  llamada puntual, se auto-elimina si no hubo cambios. Pensado para "agentes que
  mutan archivos en paralelo y chocarían si no", exactamente la categoría que
  v1.5.0 intentó y v1.8.0 retiró — **no da control fino sobre el nombre de rama
  ni sobre mergearla de vuelta con una estrategia específica**, así que no
  alcanza tal cual para lo que se necesita aquí (una rama por epic, nombrada
  según W-1/W-2, mergeada explícitamente a la rama de sesión).

Conclusión: para (A), lo correcto es que el **coordinador** (no un flag del
`Agent` tool) gestione el ciclo de vida worktree+rama por epic con
`EnterWorktree`/`git worktree` explícito, porque necesita control sobre nombre
de rama, base, y el merge final — el `isolation: "worktree"` del Agent tool es
para el otro problema (paralelismo real, opción B).

### 4.2 — Compatibilidad con el mecanismo de gates existente: buena, verificada

Revisé el hook `hooks/pre-tool-use-tdd-gate.js` y su guard compartido
(`hooks/lib/specture-guard.js`):

- `findProjectRoot()` sube por el filesystem buscando `.specture/stack.yml` —
  **no depende de git ni de `process.cwd()` relativo al repo principal**. Como
  `stack.yml`/`conventions.md` están trackeados, cada worktree los tiene en la
  misma ruta relativa → el hook resuelve el root correctamente **sin cambios**
  dentro de cualquier worktree.
- `.specture/state/build-locked.json` (el sello del contrato TDD) está en
  `.gitignore` (paso 4.5 de `setup`) — es un archivo **no trackeado**, así que
  cada worktree tiene su propia copia física, aislada de las demás. Esto
  **encaja bien** con un modelo de worktree-por-epic: el estado de sellado de un
  epic no puede filtrarse ni pisarse con el de otro, porque literalmente viven
  en directorios distintos en disco.

No hace falta tocar el hook. Esto es un punto a favor real, no solo teórico.

### 4.3 — Fricciones específicas de Windows (entorno real del usuario: win32)

- **Locks de archivo**: si un editor/antivirus mantiene abierto un handle dentro
  de un worktree, `git worktree remove` (o `ExitWorktree` con `remove`) puede
  fallar. Hay que decidir la política de fallback (reintentar, dejar el
  worktree "huérfano" para limpieza manual, o degradar a `keep` + advertencia).
- **Rutas largas**: `.claude/worktrees/<nombre>/<estructura-del-proyecto>` puede
  acercarse al límite de longitud de ruta en Windows si el proyecto ya tiene
  paths profundos (ej. monorepos .NET con `by-app-suffix`). Mitigable con
  nombres de worktree cortos, pero es una superficie de fallo nueva que hoy no
  existe (todo corre en un solo working directory).
- **Procesos en background**: Step 6/7 de `build` ya lanza linter/type-checker/
  test-runner con `Bash run_in_background: true` en el cwd compartido. Con
  worktrees por epic, cada uno de esos comandos necesita ejecutarse **con el cwd
  del worktree del epic activo**, no el cwd de la sesión coordinadora — hay que
  auditar cada punto de `build/SKILL.md` que hoy asume "un solo cwd" (Steps 4,
  5, 6, 7 todos lo asumen implícitamente).

Ninguno de estos es bloqueante, pero todos son trabajo real, no config.

### 4.4 — El problema de las dependencias entre epics (la razón del punto 2.3)

La cola procesa epics **en orden de dependencia**, uno a la vez. Si Epic 1.2
depende de Epic 1.1:

- Su worktree **no puede** crearse desde la rama base original — tiene que
  crearse desde el punto donde Epic 1.1 ya fue mergeado de vuelta a la rama de
  sesión. Esto es manejable (crear el worktree del epic N+1 recién después de
  mergear el epic N), pero significa que el ciclo por epic pasa de "commitear
  in-place" (hoy) a un ciclo de 4 pasos: **crear worktree+rama desde tip actual
  → despachar epic-agent con cwd fijado ahí → verificar → mergear (fast-forward
  idealmente) a la rama de sesión → eliminar worktree**. Es exactamente la
  granularidad que 2.3 decidió NO hacer, por este motivo puntual.
- Si el merge no es fast-forward (algo tocó la rama de sesión entre medio —
  poco probable en concurrencia 1, pero posible si el usuario edita algo a mano
  durante el batch), aparece un conflicto real que hay que resolver con el
  mismo criterio que hoy (escalar / `debug`), solo que ahora acotado a un epic
  en vez de a todo el batch — **esta es la ganancia real de (A)**, no elimina
  conflictos, los acota.

## 5. Alternativas más simples que resuelven el mismo dolor (sin worktrees)

Antes de comprometerse al costo de §4, vale contrastarlo con opciones que
atacan el mismo síntoma (drift de rama larga / rollback sucio de un epic
fallido) sin agregar una nueva máquina de estados de filesystem:

1. **Sync periódico de la rama de sesión contra la base** durante batches
   largos (`N` alto o "todas"): antes de cada epic, `git merge`/`rebase` la
   rama de sesión contra su base. Reduce el drift sin cambiar el modelo de
   ramas — cero cambio en `setup`, cero worktree.
2. **Rollback por rango de commits, sin rama separada**: como ya se sabe qué
   commit abre cada epic (Step 1 lo marca `[/]` y commitea), un epic
   `BLOCKED`/`REJECTED_MAJOR` se puede descartar con `git revert
   <primer-commit-del-epic>..HEAD` sobre la misma rama — mismo resultado
   (aislar el daño de un epic fallido) sin crear ni mergear una rama nueva.
3. **Rama por epic sin worktree físico**: cortar y mergear una rama por epic
   (mismo `git branch`/`merge` que en §4.4) pero **sin** `git worktree` —
   seguir trabajando en el mismo directorio, solo cambiando de rama. Resuelve
   el "conflicto acotado por epic" sin la fricción de filesystem de Windows
   (§4.3), a costa de perder el aislamiento físico (no se puede tener dos
   epics con archivos "en progreso" simultáneamente, pero eso tampoco pasa hoy
   porque la concurrencia ya es 1).

La opción 3 en particular logra el objetivo declarado ("cada epic en su propia
rama, evitar que un batch grande genere un conflicto gigante al final") con una
fracción del costo de implementación y sin las fricciones de Windows del §4.3.
**El worktree solo aporta valor adicional real si además se quiere aislamiento
físico** — por ejemplo, para que el usuario pueda seguir trabajando en el
directorio principal mientras un epic corre, o para permitir que un
`BLOCKED` deje evidencia física intacta para inspección sin afectar el checkout
principal.

## 6. Propuesta de flujo mínimo por default (si se decide seguir adelante)

Diseño tentativo, **no implementado**, siguiendo el patrón de toggles opt-in ya
usado en el framework (`docs_index.enabled`, `knowledge.enabled`: aditivos,
apagados por defecto, no rompen proyectos existentes):

- **Nuevo toggle** en `conventions.md` §10: `build.epic_isolation: none |
  worktree`. Default **`none`** — comportamiento actual intacto (rama única por
  sesión, sin worktrees). Esto preserva compatibilidad total con proyectos
  existentes y con la decisión 2.3 como default.
- **Nueva fila en §13 (W-*)**, solo relevante si `epic_isolation: worktree`:
  nombre de rama por epic (ej. `<rama-de-sesión>/epic-<slug>`), estrategia de
  merge (fast-forward preferido; `--no-ff` si se quiere preservar el punto de
  bifurcación en el historial), y política de limpieza (`remove` en `DONE`,
  `keep` en `BLOCKED`/`REJECTED_MAJOR` para inspección).
- **`build/SKILL.md`, sección "Branching (W-\*)"**: cuando el toggle está en
  `worktree`, el ciclo por epic (dentro del loop de la cola) pasa a ser: crear
  worktree+rama del epic desde el tip actual de la rama de sesión → dispatch
  del epic-agent con su cwd fijado a ese worktree → Steps 2-7 corren ahí →
  verificado y `DONE` → merge fast-forward a la rama de sesión → eliminar
  worktree. En `BLOCKED`/`REJECTED_MAJOR`, **no se mergea**, se deja el worktree
  intacto y se escala al usuario (igual que hoy, pero con evidencia física
  aislada en vez de commits sueltos en la rama compartida).
- **`setup/SKILL.md`**: al preguntar §13 (Bootstrap paso 2, Adopt paso 6), sumar
  una pregunta opcional: *"¿Los batches de epics suelen ser largos (muchas
  epics en una sola invocación, o `N`/`todas` frecuente) y trabajás con una
  rama base que otros también mueven? Si es así, `epic_isolation: worktree`
  acota el riesgo de conflicto a un epic en vez de a todo el batch."* Default
  sin opinar del usuario = `none` (mismo criterio conservador que el resto de
  §10).

Este toggle deja el comportamiento actual (validado, simple, cero fricción)
como default universal, y activa la máquina nueva solo para el perfil de
proyecto que realmente la necesita — igual que el resto de capacidades
opcionales de Specture.

## 7. Preguntas abiertas (requieren tu decisión antes de implementar)

1. **¿(A) o (B)?** — ¿el objetivo es acotar conflictos dentro del modelo
   secuencial actual (este documento asume esto), o es reabrir la puerta a
   ejecución paralela de epics? Si es (B), el bloqueador de fondo es
   presupuesto de tokens (v1.8.0), no git — worktrees no lo resuelven solos.
2. **¿Vale el costo físico del worktree**, dado que la alternativa 3 del §5
   (rama por epic sin worktree) logra el mismo resultado declarado —"evitar
   conflictos de merge de ramas"— con mucho menos superficie nueva y sin las
   fricciones de Windows del §4.3? ¿Hay un motivo adicional (trabajar en el
   directorio principal mientras un epic corre, dejar evidencia física de un
   `BLOCKED`) que sí justifique el worktree físico y no solo la rama?
3. **¿A partir de qué tamaño de batch se activa** — ¿siempre que el toggle esté
   en `worktree`, o solo cuando `N` supera un umbral (batches chicos, que son
   el caso más común — "sigamos con el roadmap" → `N=1` — no tienen nada que
   aislar)?
4. Si se aprueba, la implementación debería seguir la disciplina de
   `write-skill` (baseline → cambio → verify) como el resto de cambios a
   `build/SKILL.md`, dado que es el archivo más caliente del framework.

## 8. Recomendación

**Viable técnicamente**, sin bloqueantes duros — las primitivas nativas de
Claude Code (`EnterWorktree`/`ExitWorktree`) y el diseño actual de los hooks
(resolución por filesystem, estado no trackeado) lo soportan sin fricción de
diseño. Pero el pedido, tal como está planteado, revierte dos decisiones
cerradas con razones documentadas (§2), y la alternativa 3 del §5 (rama por
epic **sin** worktree físico) logra el objetivo declarado con una fracción del
costo y sin las fricciones de Windows del §4.3.

Mi recomendación: **resolver la Pregunta 1 primero** (confirmar que es (A), no
(B)) y, si es (A), **evaluar la alternativa 3 antes de comprometerse al
worktree físico** — el worktree solo se justifica si necesitás el aislamiento
de filesystem en sí (trabajar en paralelo con el checkout principal, o
preservar evidencia física de un epic fallido), no solo "una rama por epic".
