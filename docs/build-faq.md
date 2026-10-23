# Preguntas frecuentes sobre `/specture:build`

> Desde v2.2.0 (la etapa de revisión, desde v2.3.0; el coordinador por epic, desde v2.7.0).
> Responde a lo que más se pregunta cuando un epic tarda en arrancar, cuando la ejecución toca
> tests de epics anteriores o cuando la tanda empieza por una sentada de decisiones. El detalle
> técnico está en `skills/build/SKILL.md`, `skills/build/QUEUE.md`, `skills/build/PLANNING_GATE.md`, `skills/build/EPIC_COORDINATOR.md`,
> `skills/build/EPIC_LOOP.md`, `skills/build/REVIEW_STAGE.md` y `docs/tdd-honesty-reference.md`;
> la guía de la revisión, en [`docs/review-stage-guide.md`](review-stage-guide.md); la evidencia
> que motivó los cambios, en `docs/spec-gate-convergence-design.md` y
> `docs/milestone-decision-stage-simulation.md`.

## ¿Por qué se validan los specs antes de ejecutar?

Porque un spec es el contrato que siguen el test-writer, el implementer y el reviewer: si está
mal, los tres trabajan bien sobre algo equivocado y el error aparece tarde y caro. El validador
revisa lo que **el autor del spec puede ver** y que sería costoso descubrir después:

- que no contradiga un ADR aceptado ni una regla del proyecto (`rules.yml`);
- que respete el contrato de la API (operaciones, formas, errores);
- que las reglas de negocio citadas existan y digan lo que el spec dice;
- que no haya contradicciones internas (dos criterios de aceptación que se excluyen);
- que cada cosa que queda "fuera de alcance" tenga dueño.

Lo mecánico (cobertura de operaciones, firmas, rutas, que los tests nombrados existan) lo
revisa un script en menos de un segundo, sin gastar un agente.

## ¿Por qué ya no se valida en el gate la lista de tests viejos que un spec rompe?

Porque nadie en el gate la puede conocer. El planner no lee código a propósito (para que el
código existente no sesgue los criterios), así que tenía que adivinar qué tests de epics
anteriores se romperían. En un epic real eso costó tres de cuatro rechazos y un día entero de
gate, y aun así el gate solo acertó el 30 % de esos tests; la ejecución encontró el resto en
minutos.

Ahora el planner declara solo lo que las fuentes dejan ver (una regla que cambió, un spec viejo
que queda contradicho), y el validador ya no rechaza por "lista incompleta". Los demás tests
los descubre la ejecución corriendo la suite, y los resuelve el **loop de supersesiones**, sin
preguntarte.

## ¿Cuántas veces me va a preguntar el gate?

Desde v2.3.0, si la tanda pasó por la **etapa de revisión**, el gate de cada epic no te pregunta:
las decisiones se toman antes, en una sola sentada (dos rondas como mucho), y en su turno cada
epic se refresca y se sella sin preguntas. Los únicos contactos previstos durante la ejecución
son la mini-revisión anunciada de los epics regulatorios, una revisión corta si el bloque de un
epic o sus RN cambiaron desde la sentada, y los casos de la lista de abajo. Cómo funciona:
[`docs/review-stage-guide.md`](review-stage-guide.md).

Para un epic que no pasó por una revisión, como mucho **dos rondas** de preguntas por epic,
vengan de donde vengan (dudas del planner, dudas de contrato de la validación, tamaño del
epic), con hasta 4 preguntas cada una. Las
opciones que ves son las del planner, tal cual, con las decisiones que cada una abriría
(`derivadas:`), para que la segunda ronda sea opcional.

Además:

- Un veredicto **APROBADO avanza**: sus observaciones se guardan como notas para el
  implementer y el reviewer, o como "diferidos" en el epic al que pertenecen, pero no generan
  otra pasada ni otra pregunta.
- Si el gate llega a tres rondas sin aprobar, te hace **una sola** pregunta cerrada con
  opciones según el tipo de problema (enmendar un ADR, cumplirlo al pie de la letra, partir el
  epic, pausarlo…).
- Después del sello, el epic corre sin preguntarte salvo casos que solo tú puedes decidir:
  aprobación visual del design system, entorno roto, un test protegido por una regla del
  proyecto, un spec atascado en el tope de iteraciones (`BLOCKED: debug`) o un rechazo mayor
  del reviewer. Un spec inejecutable (`BLOCKED: spec`) vuelve al gate por el loop de
  corrección; solo te pregunta si ese gate lo necesita, dentro del mismo presupuesto.

## ¿Puedo delegar decisiones?

Sí, pero solo de forma explícita. La opción recomendada **nunca se aplica sola**: en la
simulación con decisiones reales coincidió con lo que el usuario eligió solo en 3 de 11 y en 5
de 12 casos. Si quieres delegar, dilo por ítem o por tema ("en los de roles usá la
recomendada"). En la etapa de revisión esa delegación vale solo para lo que nombraste y queda
escrita en el registro de la tanda, ítem por ítem, como `fuente: delegado por el usuario
<fecha>`; como está escrita, el refresco de cada epic la cita aunque ejecutes en otra sesión.
Nada se infiere: la presión vaga ("hazlo rápido, no preguntes") no es delegación.

Si ninguna opción te sirve, responde "ninguna de las opciones" y escribe tu regla: queda
registrada tal cual. En el gate de un epic que no pasó por una revisión rige la regla de
siempre: la delegación vale para el epic nombrado, o para la tanda entera si lo dices antes de
arrancarla, no sobrevive la sesión y nunca autoriza tocar el contrato.

## ¿Qué es un epic aparcado?

Un epic (no regulatorio) que la cola dejó para la próxima sentada porque, al refrescarlo en su
turno, apareció una decisión que nadie previó en la revisión: de dinero, legal, datos
personales, contrato o modelo. En vez de interrumpirte a mitad de la tanda, el coordinador del
epic lo devuelve de `[/]` a `[ ]` con una línea en su bloque del ROADMAP:

```
- **Aparcado:** <fecha> — <clase> — <motivo> — tanda <id>
```

En un epic regulatorio esa decisión va a su mini-revisión anunciada; solo lo que esa sentada
deja abierto lo aparca. No es un estado nuevo: el epic queda pendiente y la cola sigue con los
epics que no dependen de él. Al terminar la tanda, el coordinador te lista los aparcados con su decisión pendiente;
la siguiente sentada de revisión la toma y borra la línea, y el epic vuelve a la cola.
`/specture:doctor check` los muestra como `epic-parked`. Límite honesto: si los epics dependen
casi todos unos de otros, aparcar uno suele detener el resto.

## ¿Por qué dos rondas y una mini-revisión?

Porque es lo que capturó las decisiones reales cuando se probó a ciegas, antes de construirlo
(`docs/milestone-decision-stage-simulation.md`):

- **Una sola ronda no alcanza.** En el epic regulatorio, un barrido previo anticipó 11 de 12
  preguntas de primera ronda, pero no las de segundo orden: las que nacen de tus propias
  respuestas, las que el coordinador descubre después y las que el validador solo ve sobre
  specs ya escritos.
- **La ronda 2 captura lo que nace de tus respuestas.** En el experimento "ronda 2" (tres
  corridas independientes sobre un epic regulatorio real), la decisión que en la realidad nació
  de seguir dos respuestas salió completa en 2 de 3 corridas. Por eso la ronda 2 solo trae
  preguntas derivadas de tus respuestas o que chocan con un ADR, una regla o el contrato.
- **Leer código en la ronda 1 adelanta los huecos de dinero.** El hueco de los enlaces de pago
  sin vencimiento, que en la realidad apareció tarde, salió en la ronda 1 en las 3 corridas
  (completo en una, parcial en dos).
- **Lo que solo aparece con el spec escrito en detalle no llega a ninguna de las dos.** Las
  acciones de un rol sobre una cita anonimizada en el dashboard y la autorización en un portal
  público solo se rozaron: el tema aparece, pero no la elección concreta. Para eso está la
  **mini-revisión**: justo antes de ejecutar un epic regulatorio, con sus specs ya escritos, el
  validador los relee contra el código, mirando qué puede hacer cada rol en cada pantalla o
  endpoint y qué datos personales entran por superficies públicas. Si no encuentra nada nuevo, el
  epic corre sin preguntarte; si encuentra algo, es una sola sentada corta, que se te anunció al
  cerrar la revisión.

No hay tercera ronda: lo que siga abierto después de la segunda se resuelve con un `discover`
acotado o se difiere explícitamente, con dueño. Y la mini-revisión es solo para los
regulatorios porque en los epics de infraestructura o de esquema la simulación ya mostró que el
barrido previo captura casi todo (5 o 6 de 6 decisiones, con 0 o 1 paradas tardías).

## ¿Esto debilita el TDD?

Cambia una cosa y la compensa con controles mecánicos. Antes, un test viejo solo podía
cambiarse antes del commit RED del spec, así que quedaba fuera del rango que audita el TDD
Honesty Gate por construcción. Ahora un test viejo puede cambiarse **después** del RED, cuando
la ejecución descubre que una regla del spec lo vuelve falso. Lo que protege el contrato:

- **Otro agente juzga cada caso con datos** (J9): recibe la aserción vieja y el primer error,
  y responde si una regla del spec la vuelve falsa. Si no, es una regresión y vuelve al
  implementer. El implementer nunca decide solo "esto es por diseño".
- **El spec solo cambia en su sección de supersesiones**: un script compara byte a byte con la
  versión sellada; cualquier otro cambio manda el epic al loop completo, con RED nuevo.
- **Los tests protegidos quedan fuera**: los que nombra un `verify:` de `rules.yml` o un GUARD
  de otro epic nunca entran al loop; eso lo decides tú.
- **La reescritura es ciega**: el test-writer no ve los valores que devuelve el código, solo la
  regla.
- **El RED original sobrevive**: cada línea que agregó el commit RED sigue en HEAD.
- **Lista blanca de commits**: todo commit que toca tests después del RED tiene que estar
  registrado por su SHA, con exactamente sus archivos; nada sin commitear puede colarse.
- **RED retroactivo**: para las aserciones reescritas, los tests nuevos tienen que fallar en el
  commit que bloqueó el epic y pasar en HEAD; si pasan en ambos, no expresan la regla.
- **Revisión independiente**: el code-reviewer lee cada reescritura contra su regla; una
  reescritura más débil que la regla es BLOCKER.

**Riesgo residual:** si el juez J9 y el reviewer aceptan a la vez una lectura demasiado
generosa de una regla, un test puede quedar más flojo de lo que debería. Ese es el precio de no
preguntarte por cada test viejo. No es invisible: cada loop deja en disco sus líneas de
registro, su veredicto J9 y sus commits.

## Fallaron tests de epics anteriores durante un epic. ¿Qué pasó y cómo lo audito?

Pasó una de dos cosas, y el registro dice cuál:

1. **Una regla del epic nuevo los volvió falsos** → los reescribió el loop de supersesiones.
   Aparecen en `docs/05-specs/<epic>/_planning.md`, sección `## SUPERSESIONES`, con
   `loop: compilación | runtime`, `j9: SÍ` y el SHA del commit `test(supersede): … — loop …`.
2. **Eran regresiones** (J9 dijo `NO`) → el implementer arregló el código de producción; el
   test no se tocó.

Para auditarlo a mano:

```
git log --oneline <red_sha_orig>..HEAD -- <globs de test>
```

Cada SHA de esa lista tiene que aparecer en `## SUPERSESIONES` del epic. `red_sha_orig` está en
`.specture/state/build-locked.json` mientras el epic corre, y en el commit `test(...)... (RED)`
del spec después.

Los fallos que ya existían antes de que el epic empezara quedan en `## BASELINE_FALLOS`: no
bloquean el epic, pero se reportan, nunca se esconden.

## ¿Qué es `BLOCKED: debug` y por qué la cola no invoca `debug` sola?

Cuando un spec agota sus tres intentos de implementación y revisión, el epic-agent se detiene
y reporta `BLOCKED: debug <spec>`. No invoca la skill `debug` por su cuenta (ni el coordinador
del epic) porque esa skill trabaja en Plan mode, que necesita tu aprobación: invocarla dentro de
la cola dejaría todo esperando sin que nadie lo sepa. El coordinador te lo muestra y te ofrece
`/specture:debug`.

## Actualicé a v2.2.0 con un epic a medio planificar. ¿Qué hago?

1. Corre `/specture:doctor migrate` (registra el `schema_version`; no hay migración de
   contenido).
2. `/specture:doctor check` te avisa con `gate-legacy-rejection` si un epic `[/]` quedó
   rechazado por supersesiones con la versión anterior: se re-valida en modo delta y esos
   hallazgos quedan retirados.
3. Si habías agregado a tu `CLAUDE.md` un bloque temporal de instrucciones para el gate, el
   doctor lo señala (`claude-md-gate-overrides`): v2.2.0 ya lo incorpora y puedes quitarlo.
4. Continúa con `/specture:start`.

## ¿Por qué el build me pidió autorizar `unseal-spec` a mitad de un epic?

No lo pidió el framework: lo pidió el **modo auto** de Claude Code. Su clasificador de
permisos puede leer `seal-cli.js unseal-spec` como "quitar tests de seguridad" y negarlo; el
coordinador entonces te pregunta. Desde v2.2.2 el build ya no necesita `unseal-spec`: un test
del RED que hay que corregir se abre con `supersede --shared-with-red` y se reescribe en un
commit `test(red-fix)` registrado, sin revertir nada. Y puedes evitar la pregunta dejando correr los
scripts de Specture sin revisión: reglas estrechas en `permissions.allow` del proyecto y, para
el modo auto, una entrada `autoMode.allow` en `~/.claude/settings.json`. El detalle y el texto
exacto están en `hooks/README.md` § Permisos; `/specture:doctor check` te avisa
(`specture-script-permissions`) si no hay ninguna.

## La sesión del coordinador se volvió muy larga. ¿Pierdo algo si la cierro?

No. Todo lo que importa vive en disco: el ROADMAP, el registro de la revisión de la tanda, el
`_planning.md` de cada epic, el sello y `build-metrics.jsonl`. Después de cualquier epic puedes cerrar la sesión y seguir con
`/specture:start`; para una tanda larga es lo recomendado.

Desde v2.7.0 en Claude Code crece mucho menos: cada epic corre en su propio subagente y aquí
solo vuelve un reporte corto por epic. Lo que sigue pesando en el chat principal es la sentada
de revisión (unos 400k tokens en una tanda de tres epics regulatorios). En Antigravity
el epic sigue corriendo en el chat principal, así que ahí el consejo de cerrar entre epics vale
igual que antes.

## ¿Por qué un coordinador por epic?

Porque el chat principal no aguantaba una tanda de tres epics. Hasta v2.6 corría en su propio
contexto todo lo que le pasa a cada epic: el refresco y el sello, cada reporte del epic-agent y
cada loop. En la primera tanda real de tres epics con etapa de revisión (HC-IHCE.9–.11 de
Psikora, con v2.3.0) el contexto del coordinador fue 401k tokens durante la sentada, 570k al
empezar el primer epic, 687k al empezar el segundo y llegó a 961k en medio del segundo, donde se
compactó solo; el tercero arrancó en 176k, después de la compactación. Lo demás funcionó: ningún
contacto después del sello en los tres epics, la única interrupción fue la mini-revisión
anunciada del HC-IHCE.11, y un corte por límite de uso se retomó bien desde disco. Pero después
de compactarse el coordinador gastó unos diez turnos preguntando por un despacho en curso ("sigo
esperando"), y cada uno de esos turnos relee todo el contexto.

Desde v2.7.0 cada epic corre en su propio **coordinador del epic**, un subagente con contexto
fresco que hace el refresco, el sello, el epic-agent, los loops y las métricas, y al chat
principal le devuelve un reporte de 40 líneas como máximo; la evidencia queda en disco. Para ti
casi nada cambia: el coordinador del epic **nunca te pregunta**. Lo que necesita de ti (la
mini-revisión de un epic regulatorio, un problema que solo tú puedes decidir, la aprobación
visual del design system) vuelve al chat principal, que te pregunta igual que antes y lo
despacha de nuevo con tu respuesta. Mientras un epic corre puedes escribir en el chat y se te
responde; el chat espera el aviso de que el epic terminó, sin consultar a cada rato. En Antigravity, que no tienen subagentes anidados, el mismo procedimiento corre en el chat
principal, como en v2.6.

## ¿Qué pasa si la sesión se corta a mitad de un epic?

Nada se pierde y nada se re-planifica. Corre `/specture:start`: `build` encuentra el epic `[/]`,
lo termina antes de armar la cola nueva (no cuenta para el tamaño de la tanda) y despacha su
coordinador del epic con `ENTRY: resume`. Ese coordinador no supone dónde había quedado: lo
decide por la evidencia en disco.

- **Un loop a medias** (un spec liberado del sello): la última línea `- LOOP:` del
  `_planning.md` dice cuál era, y lo retoma desde el último paso que dejó rastro.
- **Specs sellados y aprobados**: el epic-agent sigue desde el primer spec que no estaba
  aprobado y verificado. Si falta el sello (no viaja en git), lo reescribe desde el `SPEC_SHA` y
  el `LOCK_SHA` registrados.
- **Un refresco "pendiente de mini-revisión"** sin tus respuestas en el registro: te vuelve a
  llegar la misma mini-revisión, con las mismas preguntas.
- **Un refresco sin commitear**: lo chequea y lo re-valida; no descarta nada.
- **Solo los borradores de la revisión**: empieza el refresco.
- **Algo que no puede atribuir** (varios epics `[/]`, archivos que no sabe de dónde salen): se
  detiene y el chat principal te pregunta por dónde seguir.

Cuesta un despacho, nunca un re-plan. Un epic que no pasó por una revisión y quedó con specs sin
commitear sigue la regla de siempre: te pregunta si se descartan o se retoman, y nunca borra
nada sin preguntarte. En la tanda HC-IHCE.9–.11 (todavía con v2.3.0) un corte por límite de uso
de la API se retomó bien desde disco; `ENTRY: resume` lleva ese mismo principio al coordinador
del epic.

## Se cerró un milestone y la tanda terminó con una pregunta sobre "cumplimiento". ¿Qué es?

Desde v2.4.0, cuando un milestone se cierra, un revisor recorre todo su código contra **todas**
las reglas del proyecto —también las que la revisión por spec no veía y los criterios que tu
equipo enlazó en `.specture/review-rules.md`— y deja un reporte en
`docs/07-reviews/cumplimiento-milestone-<N>-<fecha>.md`. Eso pasa sin preguntarte, en el medio de
la tanda. La pregunta llega al final: ves los hallazgos con una propuesta y decides qué se corrige
(solo lo que no cambia comportamiento, y nunca tests), qué se difiere y qué no aplica. Si cierras
la sesión antes, el reporte queda `TRIAGE: PENDIENTE` y se te pregunta en el próximo vaciado (o
con `/specture:compliance-review triage`). No publica nada en GitHub ni en Azure DevOps. Para
apagarlo: `compliance_review.enabled: false` en `.specture/settings.yml`. Guía completa:
[`docs/compliance-review-guide.md`](compliance-review-guide.md).

## El RED se volvió a despachar "por red-check". ¿Qué es eso?

Desde v2.8.0, antes de sellar el RED de cada spec el epic-agent corre `hooks/lib/red-check.js`:
tres hechos mecánicos que en Psikora y CEAgenda explicaban la mayoría de los `test(red-fix)`
posteriores. `files`: todo archivo del commit RED es un test o está declarado en la Superficie
del spec (`Crea:` / `Fixtures disponibles:`) — un helper fuera de eso es un hueco del spec y sale
como `BLOCKED: spec` ahora, no como un hook denegando a mitad del GREEN; y desde v3.0.0 ningún
archivo del RED puede nombrar una ruta de documentación (`docs/`, `.specture/`, un `*.md`): ver
la pregunta siguiente. `coverage`: cada
`AC/BR/EC` del spec aparece una vez en el `COVERAGE_MAP` del test-writer (que ahora también lo
escribe en `docs/.specture-meta/coverage/<slug>.map`) y cada test citado existe. `commands`: los
comandos `type_check` / `lint` / `format_check` que declaraste en `stack.yml` →
`quality.commands`, sobre los archivos del RED. Un FAIL re-despacha al writer **una** vez con los
hallazgos; el segundo es `BLOCKED: red-fix`. Si un slot está `sin definir`, ese check queda
`SKIPPED` y el doctor te lo recuerda (`quality-commands-undefined`): el framework nunca inventa
un comando a partir del nombre de una herramienta.

## ¿Qué son `quality.commands` y `mutation.enabled`?

`stack.yml` guardaba nombres (`linter: eslint`) que nadie podía ejecutar. Desde v2.8.0 el bloque
`quality.commands` guarda los comandos que el build **corre** tal cual — `test`, `type_check`,
`lint`, `format_check`, `mutation` — con `{files}` donde la herramienta acepte rutas; `none`
cuando no aplica. Es agnóstico de lenguaje: `docs/quality-catalog.md` trae ejemplos por pila, y
solo son ejemplos. Con ellos el Step 6 lanza lint y type-check en background y le entrega el
resultado al reviewer como `LINT_REPORT`: el reviewer cita lo que la herramienta reportó y no
re-inspecciona formato a ojo (la revisión de cumplimiento igual). `mutation.enabled: true` en
`settings.yml` añade el comando `mutation` sobre los archivos de producción del spec; su salida
llega al reviewer como `MUTATION_REPORT` y cada mutante sobreviviente es un hallazgo de fuerza de
tests o se descarta con una línea — el reviewer deja de mutar a mano, que era lento y frágil.
Necesita la herramienta instalada en tu proyecto (Stryker, Infection, mutmut, Pitest… la que sea).
Desde v3.2.0, `mutation.scope` decide **cuándo** corre: `spec` (default) una vez por spec en el
Step 6; `epic` una vez por epic en el Step 7.5 (ver más abajo).

## ¿Qué es `mutation.scope: epic`?

Stryker tardaba ~20 minutos por spec en Psikora y corría en serie con el reviewer. Con
`mutation.scope: epic` en `settings.yml` la mutación corre **una vez por epic**, después del Step 7
de la última spec y antes del `[x]` (Step 7.5 de `EPIC_LOOP.md`): sobre la unión de los
`Crea:`/`Modifica:` de todos los specs, con el log en `docs/.specture-meta/runs/`. Los
sobrevivientes los juzga el `code-reviewer` en `MODE: MUTATION` (acotado, `effort: medium`): cada
uno se descarta con una razón o es un hallazgo con spec dueño e ID; los hallazgos vuelven al
`tdd-test-writer` como `RED-FIX` de ese spec (nunca se debilita una aserción), y si el test
reforzado encuentra un bug real, el implementer lo arregla y ese spec repite su Step 7. Máximo dos
rondas; un BLOCKER que persiste es la salida del Iteration Cap, un IMPORTANT va a `DIFERIDOS`. En
un epic de tres specs ahorra ~40 minutos; el costo es detectar un test débil una spec más tarde.
Los reviewers de cada spec reciben `MUTATION_REPORT: (none — mutation.scope epic: Step 7.5)` y
juzgan la fuerza de los tests leyendo. Migración mecánica `3.2-mutation-scope` deja `spec` escrito
en proyectos existentes: nada cambia hasta que escribas `epic`.

## ¿Qué es `MODE: RE-REVIEW`?

Tras un `REJECTED_MINOR` el reviewer volvía a revisar las siete dimensiones desde cero, a
esfuerzo alto. Desde v2.8.0 la segunda ronda es acotada: recibe el reporte anterior, la lista de
hallazgos, el diff entre el HEAD anterior y el nuevo y un `LINT_REPORT` del delta, y responde por
hallazgo `RESUELTO` / `PERSISTE` / `RESUELTO_CON_REGRESIÓN`, con `effort: medium`. No reabre lo
aprobado salvo que el delta lo toque. Un `REJECTED_MAJOR` o una tercera ronda vuelven a ser una
revisión completa con contexto fresco.

## ¿Por qué cada agente tiene ahora un `effort` y a veces un modelo distinto por modo?

Porque heredar el esfuerzo del chat principal hacía que un orquestador con decenas de llamadas a
herramientas (el coordinador del epic) pagara `high` en cada turno, y que un re-despacho acotado
(un `RED-FIX`, una re-validación `DELTA`) costara lo mismo que el trabajo original. Desde v2.8.0:
`tdd-test-writer` sonnet `high` (la calidad del RED evita red-fix; `medium` en `RED-FIX` y
`SUPERSEDE-HEAD`), `implementer` / `ux-implementer` sonnet `medium`, `code-reviewer` opus `high`
(`medium` en `RE-REVIEW`), `architecture-validator` opus `medium` (sonnet `medium` en `DELTA` y
`J9`), coordinador del epic opus `medium`. La métrica `effort` de `build-metrics.jsonl` registra
lo efectivamente despachado para que `knowledge stats` pueda leer el efecto. En Antigravity el frontmatter no viaja (brecha documentada en `docs/antigravity-cli-plugin.md`).

## El hook me denegó un `sleep`. ¿Por qué?

Porque un agente que duerme no trabaja: está esperando a otro. Medido en Psikora HC-IHCE.14
(2026-10-14), el epic-agent pasó 222 de sus 510 minutos en `sleep 90; echo tick` y
`until grep -q DONE …; do sleep 20; done` esperando a sus writers, y el coordinador se puso un
reloj con `sleep 3060` por una regla de "corte a los 55 minutos" que no está en el framework ni la
dio nadie. Cada uno de esos turnos relee el contexto entero del agente (200K–600K tokens) y, como
la caché de prompts dura 5 minutos, el 97 % de los turnos tras una pausa larga fueron cache miss
(la caché entera reescrita a precio completo). Desde v2.9.0 el Wait Guard (`PreToolUse` sobre
Bash/PowerShell, opt-in por `hooks.enabled`) deniega un `sleep` de 30 s o más y cualquier
`sleep` dentro de un bucle. La vía correcta: despachar al worker con una llamada al Agent **en
primer plano** (vuelve cuando termina) o, en background, esperar su notificación o el `Monitor`.
Ningún despacho de Specture tiene límite de tiempo; una pausa corta fuera de un bucle y un
`timeout 590 dotnet test` (un límite sobre trabajo real) siguen permitidos.

## ¿Por qué el implementer ya no corre la suite completa?

Porque la corría en cada paso: 38 veces en un epic de Psikora (66 minutos de una suite de 20–40
minutos), y cada vuelta volvía con la caché vencida. Desde v2.9.0 `quality.commands` tiene dos
slots de test: `test` (la suite completa) corre **solo dos veces por spec** — la línea base del
Step 3.9 y la verificación del Step 7, ambas del epic-agent — y `test_scoped` (solo los tests de
`{files}` / `{names}`) es lo que corren el writer, el implementer y los post-checks. Si en el
Step 7 fallan tests viejos de otros epics, el epic-agent despacha al implementer una vez en
`MODE: REGRESIONES` con esa lista (producción se arregla, el test nunca; un test que una regla del
spec vuelve falso va a `FAILURES:` y al loop de supersesiones como siempre), vuelve a correr el
gate y una `RE-REVIEW` acotada, y repite el Step 7. Es agnóstico: el proyecto declara cómo acotar
(`pytest -q {files}`, `npx vitest run {files}`, un `--filter` por `{names}` en .NET — ejemplos en
`docs/quality-catalog.md`). Con `test_scoped` en `sin definir` el agente corre lo más acotado que
ofrezca su runner sobre esos archivos y lo dice como `SKIPPED`; nunca la suite.

Desde v3.2.0 la regla también es mecánica: el sello lleva la **fase** del epic (`baseline` · `red`
· `green` · `verify` · `mutation`, `seal-cli.js phase --set`) y, con hooks, la **Suite Guard**
deniega el comando de `test` fuera de `baseline` y `verify`. Y de las dos corridas completas suele
quedar una: la línea base se reutiliza del Step 7 del epic anterior cuando el árbol de código no
cambió (siguiente pregunta).

## ¿Por qué este epic no corrió la línea base?

Porque ya existía. El Step 7 del epic anterior corrió la suite completa sobre el mismo árbol de
código y registró sus fallos (`quality.js runs record-failures`). Antes de despachar al
epic-agent, el coordinador corre `quality.js runs reusable`: si hay un log de `test` completo,
tomado con el árbol limpio, con su `.failures` registrado, y `git diff` entre su commit y HEAD no
muestra cambios fuera de `docs/` y `.specture/` (los commits del lock y del plan solo tocan
`docs/`), pasa `BASELINE_LOG` y `BASELINE_FALLOS` y el Step 3.9 se salta — verás *"Línea base:
reutilizada de <log>"* en el chat y `— reutilizado de <log>` en cada línea de `BASELINE_FALLOS`.
Cualquier cambio de código, un árbol sucio o un log sin fallos registrados la invalidan y la suite
corre como siempre (*"Línea base: corre en Step 3.9 (<motivo>)"*). Son ~20 minutos por epic en una
suite como la de Psikora.

## ¿Por qué el Step 7 corre en paralelo con el review?

Porque durante el Step 6 nadie escribe en el árbol: lint, type_check y la mutación solo leen, y el
reviewer escribe únicamente su informe en `docs/07-reviews/`. En cuanto el gate de honestidad del
Step 5.5 pasa, el epic-agent pone la fase `verify` y lanza la suite completa en background junto a
las herramientas; cuando llega el `APPROVED` la corrida suele estar terminada. El Step 7 la acepta
solo si el `sha` de su encabezado sigue siendo HEAD, `clean-tree` pasa, el árbol estaba limpio al
correr y el log tiene trailer; un `REJECTED_MINOR` la vuelve stale (el implementer va a commitear):
el epic-agent espera o detiene la corrida antes de despacharlo y la relanza después del nuevo gate.
Mismo rigor, ~20 minutos menos por spec. En .NET `type_check` y `test` comparten `obj/`, así que
`type_check` arranca primero y el resto al terminar (`docs/quality-catalog.md` § 2.1). En
Antigravity, sin shell en background, las herramientas corren en primer plano, luego el reviewer y
la suite después del veredicto.

## ¿Dónde quedó la salida de la suite?

En `docs/.specture-meta/runs/<inicio>-<slot>-<sha7>.log`, entera, con un encabezado (`# sha`,
`# tree`, `# phase`, `# command`, `# start`) y un trailer (`# end`, `# duration_s`, `# exit`). La
corrida se lanza con `quality.js run test --log`, que imprime una sola línea de resumen y la vía:
**grep en el log, nunca volver a correr**. En Psikora la segunda corrida de 30 minutos del Step 7
existió solo porque el agente había guardado un `tail` y no sabía qué tests habían fallado. Los
fallos que el agente lee los registra con `runs record-failures --log <path> --from-file <lista> |
--none` en el sidecar `<log>.failures` (gramática de `BASELINE_FALLOS`); el framework no parsea la
salida de tu runner. El directorio está gitignoreado; `runs prune --keep 20` en el Step 8 borra
los viejos. `quality.js runs` los lista; `runs summary --since <LOCK_SHA>` suma corridas y minutos
(las métricas `full_suite_runs` / `full_suite_minutes`, que `knowledge stats` lee: una suite de más
de 10 min por corrida es trabajo del proyecto, no del framework).

## El hook me denegó `dotnet test` (o `pytest`, `npm test`). ¿Por qué?

Porque el epic está en una fase donde la suite completa no corre. El mensaje lo dice: *"runs the
full suite (`quality.commands.test`) while the epic is in phase `green`"*. En `green` (el
implementer está trabajando) y `red` (el writer) solo corre `test_scoped` sobre los archivos en
obra: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/quality.js" expand test_scoped --files …`. Una corrida
acotada pasa — la Suite Guard la reconoce por los tokens que tu `test_scoped` tiene y tu `test` no
(`--filter`, `--tests`) o, cuando `test_scoped` es `test` + `{files}`, por un argumento con ruta
(`pytest -q tests/a.py`). Si tu `test` y tu `test_scoped` son idénticos no puede distinguirlos:
declará un `test_scoped` distinguible en `stack.yml`. Si sos el epic-agent en el Step 3.9 o 7,
primero `seal-cli.js phase --set baseline|verify`. Un sello huérfano (ningún epic `[/]`) permite el
comando y lo dice. Apagarlo es decisión del proyecto: `hooks.enabled: false`.

## El gate bloqueó un spec de 31 IDs

Desde v3.2.0 `spec-set-check` C5 es **BLOCKER** por encima de 30 AC/BR/EC (2× el umbral de 15 que
sigue siendo WARNING). En Psikora la spec 01 de HC-IHCE.17 tenía 60 IDs, el aviso se aceptó tres
veces en la tanda, y el RED costó 46 minutos: el tiempo del writer y del implementer crece lineal
con el conteo. El FAIL vuelve al planner como `VIOLATIONS` y debe dividir la spec dentro del epic
(≤ 3 specs); si no puede, reporta `BLOCKED: sizing` y la división te llega a vos. Aplica también a
los borradores de la etapa de revisión: dividir temprano es el punto.

## Corrí `doctor migrate` y nadie me avisó de que `quality.commands` seguía sin definir

Pasó de verdad: la migración `2.8-quality-commands` escribió los slots en `sin definir`, `start`
solo mostraba el conteo de WARNING y el chat del coordinador resumió el resto. El proyecto corrió
una tanda entera con `red-check commands`, `LINT_REPORT` y los tests acotados en `SKIPPED`.
Desde v2.9.0 el hallazgo `quality-commands-undefined` lleva una **ruta**: `check --brief` y el
final de `migrate --apply` imprimen `config pendiente: quality-commands-undefined →
/specture:setup (reconfigure) → quality.commands`, `start` lo dice en una línea antes de enrutar
y `build` lo repite una vez por tanda antes del primer epic. La respuesta es la misma de
siempre: `/specture:setup` (reconfigure) pregunta los seis comandos, o los completás a mano con
`docs/quality-catalog.md` como ejemplo.

## El red-check falló porque un test "lee documentación". ¿Por qué no puedo leer un .md en un test?

Porque la documentación no es comportamiento del sistema. Un documento se reescribe, se mueve o se
poda sin que el software cambie, y un test atado a él convierte cada poda en un CI rojo: en Psikora
(septiembre-octubre de 2026) 41 archivos de test leían `.md` — specs, el handoff mapping, secciones
de `design_system.md`, una ADR — y una limpieza del corpus los dejó en `ENOENT` durante un mes, con
el deploy bloqueado y cero fallos de producto. Desde v3.0.0 la regla es mecánica y no tiene
excepciones: `red-check files` da FAIL sobre cualquier archivo del RED que nombre `docs/`,
`.specture/`, un `*.md` o la carpeta de documentación del equipo (`docs-index.yml` →
`source_of_truth_dir`); los comentarios no cuentan. Da igual que la documentación sea de Specture
o del propio proyecto.

Lo que el spec obliga a documentar va en su sección **Entregables documentales** con un ID `DOC-n`:
no lleva test, `coverage` no lo exige, y el `code-reviewer` comprueba contra el diff que el
documento quedó como el spec dice. Si tu proyecto ya tiene tests así, `/specture:doctor check` los
lista (`doc-reading-test`: WARNING, y ERROR cuando la ruta ya no existe); los borrás o los
reescribís contra el comportamiento del código — el doctor nunca edita tests.

## Se cerró un milestone y desaparecieron sus specs, reviews y debug logs. ¿Es normal?

Sí, desde v3.0.0. Specture es un framework de trabajo, no una dependencia del proyecto: si borrás
`docs/` y `.specture/` el proyecto compila y su suite pasa igual. Al cerrar una milestone se queda
lo que es **decisión** — ADRs, `rules.yml`, `conventions.md`, requerimientos, contrato, ROADMAP,
los registros de la sentada en `docs/05-specs/_reviews/` y el reporte de cumplimiento de la
milestone — y se borra lo que fue **proceso**: los specs y `_planning.md` de sus epics, sus
`review-*`, los debug logs que los citan y los coverage maps. La verdad de lo construido es el
código y sus tests; no hay un resumen intermedio (el `_current/` de versiones anteriores se retiró).

Lo hace `hooks/lib/milestone-close.js --milestone <N>`, que el coordinador corre primero en
dry-run y después con `--apply`, **por ruta exacta** y solo bajo cuatro familias
(`docs/05-specs/epic-<id>-*/`, `docs/07-reviews/review-<epic>-*`, los debug logs que citan el
epic, `docs/.specture-meta/coverage/`) — nunca un glob sobre `docs/`, donde suele vivir la
documentación del equipo. Antes de borrar, `guards.js promote` convierte los `GUARD-n` de los
specs en reglas `R-G-<n>` de `rules.yml`, así los tests que protegían siguen protegidos. La
aprobación visual del design system queda registrada en `design_system.md`, por eso los epics de
página de la milestone siguiente no se bloquean. Las milestones que ya estaban cerradas al
actualizar no se borran solas: corré el script cuando quieras.

## El TDD me parece demasiado para este proyecto. ¿Puedo bajarlo?

Sí, desde v3.1.0, por proyecto y de forma explícita: `tdd.level` en `.specture/settings.yml`.
`strict` es el loop de siempre (producción). `essential` mantiene el loop pero con menos tests —
un test por AC, sin positivo/negativo por BR, sin test por caso borde salvo que el spec declare un
guard, sin mutación — para un proyecto chico o interno. `none` quita el RED entero: el implementer
construye a partir del spec sellado, el `code-reviewer` verifica cada AC/BR/EC leyendo el código y
Step 7 corre `type_check` / `lint` y la suite que ya tengas como regresión. `none` no es TDD: el
reviewer queda como único verificador, y por eso es para experimentos.

Dos cosas que no cambian con el nivel: el **sello** sigue protegiendo el spec y los `allowed_paths`
(un write fuera de la superficie declarada es `BLOCKED: spec` en cualquier nivel), y la regla de que
**ningún test lee documentación**. Y una que te va a sorprender: el nivel se **congela al abrir el
epic** (`TDD_LEVEL` en `_planning.md`). Si lo cambiás a mitad de un epic, aplica al siguiente — así
nadie baja el rigor para escapar de un rojo. Cada línea de métricas lleva `tdd_level`; antes de
dejar un proyecto en `essential` o `none` para siempre, mirá con `/specture:knowledge stats` si los
defectos aguas abajo y los rechazos del reviewer subieron respecto a los epics en `strict`.
