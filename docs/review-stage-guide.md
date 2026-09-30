# Cómo funciona la revisión antes de ejecutar (v2.3.0)

> Guía para quien usa `/specture:build`. El procedimiento completo está en
> `skills/build/REVIEW_STAGE.md`; el registro, en `docs/05-specs/_reviews/<fecha>-<tanda>.md`
> (plantilla `templates/BATCH_REVIEW_TEMPLATE.md`). La evidencia que llevó a este diseño está en
> `docs/milestone-decision-stage-simulation.md` §7 y en las mediciones de HC-IHCE.5 y HC-IHCE.6.

## La idea en una frase

Antes de ejecutar una tanda de epics te sientas **una vez** —dos rondas como mucho— y tomas
todas las decisiones que la máquina puede prever. Después la tanda corre sin preguntarte; una
decisión que nadie previó **aparca** el epic en vez de interrumpirte.

## Qué pasa, paso a paso

1. **Preparación, sin ti.** Para cada epic de la tanda el planner escribe borradores (ciego al
   código, como siempre) y el validador los revisa **leyendo el código**: busca lo que te obliga
   a decidir (dinero, datos personales, qué ve y hace cada rol, vencimientos, estados) y
   **verifica cada premisa** sobre el sistema actual. Una premisa falsa ("hoy el login rechaza a
   un asistente borrado" cuando no lo hace) aparece aquí, no a mitad de la ejecución.
2. **Ronda 1, contigo.** Te llegan las preguntas **agrupadas por tema**, cerradas, con la opción
   recomendada y su porqué, y con el dato verificado cuando una premisa la respalda. Primero te
   digo cuántas son y cuánto tiempo llevan. También confirmas siete políticas de la tanda
   (P-1…P-7: tests viejos rotos, fallos preexistentes, datos de pruebas, acciones destructivas,
   rama, qué hacer con una decisión nueva tras el sello…); si ya las respondiste en una tanda
   anterior, solo confirmas.
3. **Reescritura, sin ti.** Los borradores se reescriben con tus respuestas y el validador revisa
   solo lo que cambió.
4. **Ronda 2, solo si hace falta.** Solo llegan preguntas **nacidas de tus respuestas** (una
   respuesta abre una sub-decisión) o **tardías** (una respuesta choca con un ADR, una regla o el
   contrato). No hay tercera ronda.
5. **Cierre.** Te muestro qué se decidió, qué preguntas se filtraron y por qué, qué premisas se
   verificaron o resultaron falsas, y qué epics tendrán una mini-revisión anunciada. Después
   decides si se ejecuta ya o más tarde.

## Qué te preguntará y qué nunca

- **Sí:** decisiones de negocio, dinero, datos personales, contrato, ciclo de vida y roles que
  ninguna fuente resuelve; las siete políticas de la tanda.
- **Nunca:** cómo implementar, qué tests viejos se rompen (eso lo resuelve la ejecución con el
  loop de supersesiones), ni nada que una RN, un ADR, el contrato o una respuesta anterior ya
  decide.
- **La recomendada nunca se aplica sola.** Si quieres delegar, dilo por ítem o por tema ("en los
  de roles usá la recomendada"): queda registrado como delegación tuya, ítem por ítem.
- **"Ninguna de las opciones"** siempre está disponible: escribes tu regla y queda registrada tal
  cual.

## Preguntas filtradas

Una pregunta que las fuentes ya responden no te llega, pero **no desaparece**: queda en
`## FILTRADAS` del registro con la cita que la resuelve. Si no estás de acuerdo con una, dilo
("inclúyela") y entra a la ronda en curso.

## Varias sentadas

Si la tanda trae más de unas 40 preguntas, te ofrezco partirla en dos sentadas o achicar la
tanda; y como mucho tres epics regulatorios por sentada. Si la sesión se corta, nada se pierde:
cada respuesta se escribe en el registro al momento, y `/specture:start` retoma solo lo pendiente.

## Epics regulatorios: la mini-revisión anunciada

Los epics que tocan datos personales, salud, dinero o consentimiento legal se marcan como
**regulatorios** en el registro. Justo antes de ejecutar cada uno —ya con sus specs escritos en
detalle— el validador los relee contra el código buscando lo que ningún barrido previo ve: qué
puede hacer cada rol en cada pantalla o endpoint y qué datos personales entran por superficies
públicas. Si no encuentra nada nuevo, el epic corre sin preguntarte; si encuentra algo, es **una**
sentada corta que ya sabías que podía llegar, porque te la anuncié al cerrar la revisión.

## Epics aparcados

Si al refrescar un epic (no regulatorio) aparece una decisión nueva de dinero, legal, datos,
contrato o modelo, el epic **se aparca**: vuelve a `[ ]` con una línea
`**Aparcado:** <fecha> — <clase> — <motivo> — tanda <id>` en el ROADMAP, y la cola sigue con los
epics que no dependen de él. Al terminar la tanda te listo los aparcados con su decisión
pendiente, para la próxima sentada. Límite honesto: si los epics dependen casi todos unos de
otros, aparcar uno suele detener el resto.

## Qué pasa si no estás

Nada se decide por ti. La revisión espera en el estado en que quedó (`/specture:doctor check` lo
muestra como `review-open`); la ejecución, si ya empezó, sigue con lo que no requiere decisiones y
aparca lo demás.

## Cómo auditar una tanda

El registro `docs/05-specs/_reviews/<fecha>-<tanda>.md` es la evidencia: agenda con cada
respuesta y su fuente, filtradas con su cita, premisas con `path:línea`, dónde quedó persistida
cada decisión, la huella (`SCOPE`) de cada epic —si el bloque del epic o sus RN cambian después,
ese epic vuelve a una revisión corta— y el estado de ejecución. `node hooks/lib/review.js status`
resume dónde está la tanda.
