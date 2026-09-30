# Preguntas frecuentes sobre `/specture:build`

> Desde v2.2.0 (la etapa de revisión, desde v2.3.0). Responde a lo que más se pregunta cuando un
> epic tarda en arrancar, cuando la ejecución toca tests de epics anteriores o cuando la tanda
> empieza por una sentada de decisiones. El detalle técnico está en `skills/build/SKILL.md`,
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
personales, contrato o modelo. En vez de interrumpirte a mitad de la tanda, el coordinador lo
devuelve de `[/]` a `[ ]` con una línea en su bloque del ROADMAP:

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
y reporta `BLOCKED: debug <spec>`. No invoca la skill `debug` por su cuenta porque esa skill
trabaja en Plan mode, que necesita tu aprobación: invocarla dentro de la cola dejaría todo
esperando sin que nadie lo sepa. El coordinador te lo muestra y te ofrece `/specture:debug`.

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
