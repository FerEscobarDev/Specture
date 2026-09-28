> **Estado: ANÁLISIS — 2026-09-27. No implementado.** Evalúa dos ideas del usuario para
> que el framework concentre sus interacciones en una sola etapa y luego ejecute una
> milestone entera, un epic a la vez, sin detenerse salvo que su intervención sea
> estrictamente necesaria: **(1)** no limitar el contexto de quien planifica y define specs;
> **(2)** al entrar una milestone, pasar de inmediato a planificar sus specs usando el Plan
> mode oficial de Claude Code, y decidir si se ejecuta de inmediato. Complementa y corrige
> `docs/spec-gate-convergence-design.md`. **Solo lectura sobre Psikora.** Método: 5
> investigadores (fundamentos del diseño, capacidades oficiales de Plan mode, viabilidad
> sobre la milestone HC-IHCE, efecto de leer código al planificar, práctica externa) → una
> síntesis → 3 escépticos (demasiado conservador, demasiado optimista, ajuste al objetivo).
> Las cifras marcadas *(inferencia)* son estimaciones; el resto sale de transcripciones,
> `git` y documentación oficial.

# Análisis: una sola etapa de decisiones por milestone y ejecución desatendida

## 0. Veredicto

**Ninguna de las dos ideas funciona tal como está formulada, pero juntas y corregidas sí
logran lo que buscas.**

- **La IDEA 2 es la que ataca el costo dominante** y es viable en esta forma: **decidir todo
  al entrar la milestone, escribir y sellar cada spec justo antes de ejecutar su epic**. Lo
  que no es viable es escribir y sellar por adelantado los specs de toda la milestone.
- **La IDEA 1 tiene la mitad de razón.** Acierta en que planificar necesita poder **leer**
  todo, incluido el código: la prohibición costó premisas falsas, decisiones de
  implementación inventadas y 2 de las 3 decisiones de negocio tardías de HC-IHCE.5. Se
  equivoca en el **volumen**: el problema fue el exceso de contexto, no la falta (el planner
  llegó a 674k tokens sin abrir un solo archivo de código). La regla correcta es "el
  planificador lee lo que necesite, pero el código nunca decide", y cada agente se despacha
  fresco desde disco.
- **Plan mode sirve como disparador, no como contenedor.** Su valor real es el cierre:
  aprobar → limpiar el contexto → ejecutar en auto mode. No sirve para escribir specs ni
  para contener la sesión de decisiones, porque mientras está activo no se puede escribir a
  disco.
- **Para no detenerse hacen falta tres piezas más** que ninguna de las dos ideas trae:
  1. sacar del gate la completitud de supersesiones (o fijarlo como política);
  2. un **coordinador por epic en subagente**, para que no tengas que reabrir la sesión cada
     1–5 epics;
  3. políticas cerradas para lo que hoy termina en pregunta.
  Sin la segunda, la mayor interrupción restante serías tú reabriendo sesiones.

## 1. Lo que buscas y lo que hoy lo impide (datos)

- En los gates de HC-IHCE.1/.3/.4/.5 hubo **30 puntos de decisión humana**. **Ninguno
  necesitó que un epic previo estuviera ejecutado.** 19 eran de negocio, legales o de modelo;
  5 eran políticas de proceso repetidas; 4 no debieron preguntarse.
- La **espera humana** en esos 4 gates sumó ≈**1.096 min**. Contigo presente respondes en
  0,1–10,5 min, pero la primera pregunta llegó 24–52 min después de tu "continúa", cuando ya
  no estabas. De esos minutos, 421 fueron UNA escalada por tope (HC-1) y 446 las 6 preguntas
  de HC-3/4, que respondiste las 6 con la recomendada.
- Hoy hay ≈**25 contactos en 4 epics** (≈6 por epic) *(extrapolado: ≈125 en una milestone
  de 20 epics)*.
- **Psikora ya "planificó la milestone" en Plan mode**: diseño de 75 KB, 14 ADR, un plan de
  42 KB aprobado. Pero esa sesión tuvo **solo 2 preguntas**, y la §10 del diseño se titula
  "Decisiones tomadas por defecto, revisables". Nunca hubo una sesión de decisiones a nivel
  spec: los gates reabrieron valores por defecto que eligió el modelo y que tú no
  deliberaste. **Eso respalda la IDEA 2; no demuestra que fracasara.**

## 2. IDEA 1 — "no limitar el contexto para planificar"

"Limitar el contexto" mezcla tres cosas distintas:

| Lectura | Qué significa | Veredicto |
|---|---|---|
| **Fuentes** | Que quien planifica pueda leer código, tests, historial | **Sí, con guardas** |
| **Volumen** | Más contexto acumulado en una ventana | **No** |
| **Lugar** | Que decidir ocurra donde estás tú y todo el conocimiento (chat principal) | **Sí** |

**A favor (fuentes y lugar):**
- El planner, sin acceso a código, pidió en 7 de sus 9 pases datos que solo el código tiene,
  e inventó "Decisiones de implementación" que sostenían 82 de 112 descartes. Una de ellas
  (`RefreshToken.Revoked` derivada) causó un BLOCKER que el propio planner había intuido 2 h
  51 min antes, sin poder verificarlo.
- **2 de las 3 decisiones de negocio tardías de HC-5 nacieron de leer código**. Wompi salió de
  descubrir que los enlaces nacen sin expiración, y la cita anonimizada editable salió de
  `Cita.Reprogramar`. El código también es fuente de **preguntas** de negocio, no solo de
  premisas. En eso tu premisa es más correcta de lo que parece.
- La prohibición no eliminó la influencia del código: la desvió. 11 de 86 aclaraciones citan
  "despacho del coordinador", un canal que nadie audita.
- Q-5 se preguntó aunque el código la respondía.
- La doc oficial ubica la entrevista con el humano en la conversación principal y la
  ejecución en una sesión fresca. Los subagentes no tienen `AskUserQuestion`, lo que explica
  en parte por qué el planner se reanudó 9 veces.

**En contra:**
- **Volumen:** el planner llegó a **673.855 tokens en su primer pase con 0 lecturas de
  código** y a 941k (con compactación) por reanudarlo; el coordinador llegó a 791k. Todas
  tus sesiones principales ya rondan 600k–960k. Hay más degradación con contexto largo
  (context rot), y tras compactar solo se re-inyectan ≈5k tokens por skill.
- **Leer código no hace converger la causa principal del atasco.** El validador sí leía
  tests (hasta 27 por despacho, 18 scripts propios) y aun así osciló: el spec 01 pasó de
  "faltan" a "sobran 13", y el 03 de APPROVED a BLOCKER con el mismo texto. El recall
  estático fue del 30 %. El replay de HC-5 con lectura libre y el resto del gate igual ahorra
  solo ≈35 min de 427.
- **Riesgo de sesgo:** quien lee el código tiende a recomendar el statu quo. En HC-5 el
  coordinador leyó `RegistrarReenvio` y cambió la recomendada a "conservar el reinicio — el
  comportamiento actual no cambia". Tú la rechazaste, así que el filtro humano funcionó.
  Pero aceptas la recomendada casi siempre (6/6 en HC-3/4, 11/12 clics en HC-5), así que una
  recomendada sesgada en un tema menos visible pasaría.
- El tdd-test-writer lee el spec completo. Si el spec se contamina con prosa derivada del
  código, los tests pierden independencia.
- El único defecto de contenido real del día (una RN sin el doble factor de ADR-020) lo
  escribió el actor con contexto completo (el coordinador), y lo atrapó el validador
  restringido.

**Cómo quedaría:**
1. Durante la etapa de planificación, un **investigador de código** (subagente fresco, sin
   Bash) responde preguntas explícitas y reporta hallazgos del código que abren decisiones
   de negocio ("los enlaces Wompi no expiran → ¿qué pasa con un pago tardío?"). Todo sale con
   `path:línea`, y la cita literal la verifica un script.
2. El **código es fuente de premisas y de preguntas, nunca de decisiones**. Cada BR, AC y EC
   necesita al menos una fuente que no sea código. La opción de statu quo se etiqueta como
   tal. La recomendada lleva un "porque" de negocio. Las opciones del planner llegan tal
   cual.
3. El spec **no describe cómo funciona el código**, y el tdd-test-writer recibe una
   proyección mecánica del spec (Objetivo, Contrato, Reglas, AC, EC, Guards, Fuera de Scope,
   firmas), nunca prosa de Superficie.
4. **El volumen no se libera:** los agentes son frescos, se despachan por path, y la memoria
   vive en disco.

## 3. IDEA 2 — "entra la milestone y pasamos de inmediato a planificar sus specs"

Tres formas de hacerlo:

| Forma | Qué es | Veredicto |
|---|---|---|
| **(A)** | Escribir y **sellar** todos los specs de la milestone al entrar | **No viable** |
| **(B)** | **Decidir** todo al entrar; escribir cada spec justo antes de su epic | Viable, insuficiente |
| **(B+)** | (B) + un **borrador no sellado** del comportamiento de cada epic y **un pase de validación** para cosechar las preguntas que solo aparecen al escribir y validar | **Recomendada** |

**A favor:**
- Las decisiones se pueden adelantar: ninguna de las 30 dependía de un epic ejecutado, y el
  registro de decisiones pesa 4–11 KB por epic.
- **Ataca el costo dominante**, que no es cómputo sino espera humana dispersa: 51 % del día
  de HC-5 y 71–86 % de los gates de HC-3/4.
- Es el patrón externo dominante. BMAD, AWS AI-DLC, Shape Up y spec-kit fijan decisiones y
  contratos arriba y detallan cada unidad al llegar su turno. Ninguno escribe specs
  detallados de todo el release por adelantado.
- Da coherencia entre epics: los diferidos llegan al epic que los recibe.
- Permite fijar **una vez** las políticas de proceso que hoy son preguntas repetidas
  (salida del tope, supersesiones al loop, fallos preexistentes, datos de Pruebas): ≈9 de
  30 interrupciones.

**En contra de (A):**
- **Volumen:** los specs de los 20 epics pendientes ocuparían 2,2–7,9 MB *(inferencia)*.
- **Código que no existe todavía:** 13 símbolos núcleo que usarán los epics de construcción
  (`IAuditContext`, `TextoCifrado`, `ICatalogoService`…) no existen en HEAD. Ahí la
  Superficie no se puede escribir antes de tiempo. Es la razón original de D1, y sigue en
  pie.
- **Herencias durante la ejecución:** los bloques de .6 y .7 duplicaron su tamaño por
  "Hereda de" escritos al ejecutar .3–.5. El gate de HC-4 incluso añadió a .6 una decisión
  de datos nueva (FK RESTRICT vs SET NULL).
- Las supersesiones solo aparecen al ejecutar, y un sello por lote se bloquearía entero por
  un solo defecto.

**Matiz a favor de (A) que el análisis inicial exageraba en contra:** de los 20 epics
pendientes, en el backend 12 no cambiaron en 6 días y 4 solo recibieron añadidos. Los 4
cambios sustractivos (y 2 retiros) vinieron de **tu giro del frontend**, que habría
invalidado igual un registro de decisiones. Por eso el **núcleo de comportamiento** sí se
puede borradorear por adelantado. Lo que debe esperar a su turno es la Superficie, las
supersesiones y el sello.

**Por qué (B) sola no alcanza:** solo el 58 % de las decisiones de negocio salió de la
primera ronda de preguntas del planner. En HC-5 **el 49 % de la espera humana (≈107 min)
vino de preguntas que nacieron del validador sobre specs ya escritos** (Wompi, estado
"Vencido", cita anonimizada). Además, en 2 de esas 3 te apartaste de la recomendada, así que
delegarlas habría decidido mal. Un barrido que solo genera preguntas no las ve. Un borrador
más un pase de validación sí. Cuesta cómputo, no tu tiempo, y puede correr mientras no estás.

## 4. Plan mode

**Hechos (doc oficial y transcripciones):**
- Bloquea Edit/Write hasta aprobar. `AskUserQuestion` y los agentes de investigación de solo
  lectura sí funcionan dentro, en el chat principal.
- Al aprobar se ofrece "Yes, and use auto mode", "Yes, manually approve edits" o "No, keep
  planning". Existe además una opción que aprueba, **limpia el contexto y arranca "from the
  plan alone"**.
- El plan file vive por defecto fuera del repo (configurable con `plansDirectory`) y se
  re-inyecta tras compactar. La aprobación es atómica.
- Los subagentes no tienen `AskUserQuestion`, `EnterPlanMode` ni `ExitPlanMode`. Los
  subagentes de plugin ignoran `permissionMode` y heredan el modo principal, así que **con el
  chat en Plan mode los agentes de Specture no pueden escribir specs**.
- No existe en Copilot CLI ni en Antigravity; allí se degrada a "propuesta cerrada en el chat
  + aprobación explícita".
- Un `ExitPlanMode` de Psikora esperó 564 min de noche. Las instrucciones de Plan mode empujan
  a "explorar a fondo el codebase".

**Dónde sirve:** como **puerta de lanzamiento** al final de la etapa de decisiones. Un plan
corto apunta al registro de decisiones ya commiteado, las políticas, la delegación y el
horizonte. Se aprueba con "limpiar contexto + auto mode" y la ejecución arranca limpia. Eso
es exactamente tu "decidir si se ejecuta de inmediato".

**Dónde no sirve:**
- **Como contenedor de la sesión de decisiones:** mientras está activo no se pueden escribir
  ni commitear el registro, las RN ni los ADR. Si el cierre limpia el contexto, el ejecutor
  arranca solo con el plan, y entonces el plan tendría que contener todo, con aprobación
  atómica.
- **Para escribir specs.**
- **Por epic dentro de la cola:** bloquea la tanda, que es lo que D3 quería evitar.
- **Como contrato portable.**

## 5. El flujo recomendado

**Etapa 0 — Entrada de la milestone** *(ya existe: new-feature/architecture en Plan mode)*.
Se aprueba el alcance. En vez de enrutar directo a build, enruta a la Etapa 1 y declara el
horizonte: la milestone completa, excluyendo la parte marcada como volátil (en HC-IHCE, el
frontend).

**Etapa 1 — Barrido (desatendido; puede correr mientras no estás).** Un subagente fresco por
epic, **en paralelo en lotes de 4–6** para cuidar el límite de uso. Cada uno:
- lee el bloque del epic, RN, ADR, `_current/` y contrato;
- consulta al investigador de código para premisas y hallazgos;
- escribe un **borrador no sellado** del núcleo de comportamiento y sus OPEN_QUESTIONS, cada
  una con opciones, recomendada con "porque" de negocio, derivadas, premisa verificada y
  `depende de <epic>`.

Luego, **un pase del validador** por epic en modo borrador, que busca diseño, ADR, contrato y
dinero/legal/datos, **no supersesiones**. El coordinador solo maneja listas:
- deduplica y descarta lo que el código o una decisión ya aprobada responde;
- corre la suite una vez para fijar la línea base de fallos preexistentes;
- arma la **agenda por tema**, no por epic.

**Etapa 2 — Sesión de decisiones (la única obligatoria contigo).** En modo normal, **no en Plan
mode**, escribiendo y commiteando por tema. Puede partirse en varias sentadas, todas antes de
ejecutar; para temas regulatorios pesados, ≤3 epics regulatorios por sentada. Contenido:
1. Decisiones de negocio, legales y de modelo, con sus derivadas en la misma ronda. Un tema
   que no cierra pasa a `discover --decision` ahí mismo y escribe la RN o el ADR.
2. Políticas del horizonte:
   - salida por defecto del tope;
   - supersesiones al loop sin preguntar;
   - fallos preexistentes excluidos;
   - datos de Pruebas;
   - alcance nuevo a Diferidos salvo "inclúyelo";
   - rama;
   - reanudación por defecto;
   - espera automática ante el límite de uso.
3. Autorizaciones nombradas para acciones destructivas o de producción, o la decisión de
   agendar esos epics (p. ej. HC-IHCE.7, que destruye y recrea bases) con tu presencia.
4. Contraste de las respuestas con los ADR antes de cerrar.
5. **Delegación persistida** para el horizonte ("usa la recomendada"), que excluye contrato,
   legal, dinero y modelo no cubiertos.
6. **Cierre:** Plan mode como puerta de lanzamiento (Claude Code) o propuesta cerrada en el
   chat (Copilot/Antigravity): "ejecutar ya" o "más tarde".

**Resultado en disco:** un **registro de decisiones** versionado por milestone
(`docs/05-specs/<milestone>-decisiones.md`). Cada entrada lleva su Q-n, la respuesta, las
derivadas, las premisas con blob sha y el hash de los campos de decisión del epic
(descripción, RN, dependencias; **no** las líneas "Hereda de/Nota"). A eso se suman las RN y
ADR actualizados, las políticas y la delegación.

**Etapa 3 — Ejecución desatendida, un epic a la vez.** El chat principal despacha **un
coordinador de epic en subagente** por epic y solo recibe su reporte. La profundidad cabe en
el límite oficial: por defecto un subagente puede anidar hasta **3 niveles** bajo la
conversación principal (principal → coordinador de epic → planner/validador/epic-agent →
workers). Funciona precisamente porque, con el registro, el gate ya no necesita
`AskUserQuestion`.

Dentro de cada coordinador de epic:
1. **Lock.** Si cambiaron los campos de decisión o una premisa, se hace un re-barrido delta
   resuelto por política.
2. **Code Surface del momento.**
3. **Planner fresco** que convierte el borrador en spec usando el registro como respuestas
   citables, **sin preguntar**.
4. Validador en re-validación delta; APROBADO avanza.
5. Sello por epic.
6. Epic-agent: test-writer ciego, implementer, reviewer; las roturas de tests viejos se
   resuelven en lote sin contacto.
7. `[x]` y checkpoint en disco.

**Política cerrada para lo imprevisto:**
- derivable del registro → se cita;
- cubierto por la delegación → recomendada, y se registra;
- dinero, legal o datos del propio epic no previsto → estado **PARKED** (el epic vuelve a
  `[ ]` con motivo, sin romper la regla de un solo `[/]`), notificación, y la cola sigue con
  los epics independientes;
- resto → Diferidos.

**Cierre de la tanda:** un solo resumen (Diferidos, notas, deudas), una sola captura de
knowledge y el PR para tu revisión.

## 6. Qué te seguirá interrumpiendo

| Clase | ¿Estrictamente necesaria? | Cómo se adelanta o reduce |
|---|---|---|
| Sesión de decisiones (Etapa 2) | **Sí** | Barrido previo, agenda por tema, derivadas en la misma ronda, políticas fijadas una vez |
| Decisión nueva de dinero, legal o datos que el barrido no vio | **Sí** | Borrador + validación en la Etapa 1; si aparece, PARKED + notificación. Honesto: en HC-IHCE la cadena es casi lineal (.6←.5, .7←.6), así que aparcar suele equivaler a parar |
| Herencias que crean decisiones nuevas (p. ej. FK RESTRICT vs SET NULL) | A veces | Clasificar cada "Hereda de" al escribirse: por política / delegable / humana; las humanas se juntan en una mini-sesión en el borde del tramo |
| Acciones destructivas o de producción | **Sí** | Autorización nombrada en la Etapa 2, o agendar ese epic con tu presencia. Según la doc, auto mode las bloquea por defecto y se pausa tras varios bloqueos |
| Aprobación visual del design system | **Sí** | El epic de design system cierra un horizonte; las páginas van en el siguiente |
| Reabrir la sesión porque el contexto se agotó | **No** | Coordinador de epic en subagente (o un driver que abre una sesión fresca por epic) |
| Escalada por tope | **No** | Política de salida fijada en la sesión; con F1-01 casi desaparece |
| Supersesiones de tests viejos | **No** | Van al loop sin contacto (HC-3/4 ya drenaron ≈150 así, con 0 contactos) |
| Debug en Plan mode, escalada de arquitectura, violación TDD del propio spec | Sí, pero raras | PARKED + notificación; no detienen la cola de epics independientes |
| Límite de uso | No es un contacto | Espera automática fijada como política |
| Revisión y merge del PR | Tuya, al final | Fuera de la tanda |

**Estimación por milestone de 20 epics** *(inferencia sobre 3 epics ejecutados)*:

| Escenario | Contactos |
|---|---|
| Hoy (extrapolado) | ≈125 |
| Solo con las dos ideas, sin el resto | ≈15–35 |
| Con el flujo completo | ≈4–8 (1 etapa de apertura en 1+ sentadas, 2–6 paradas, 1 cierre) |
| Realista hasta medirlo | 1 etapa de apertura + ≈1 parada tardía por epic regulatorio |

**Cero paradas no es alcanzable**, y ningún framework externo lo promete.

## 7. Qué cambia en las decisiones de diseño y en la propuesta Gate Convergente

**Decisiones de diseño del gate:**
- **D1** (planificar por epic, justo a tiempo). **Se mantiene** para la Superficie de código,
  las supersesiones y el sello. **Se modifica** para decidir y para borradorear el núcleo de
  comportamiento: el alcance pasa a la milestone.
- **D2** (sin gate humano obligatorio). **Se mantiene** contra la aprobación por epic. Una
  sesión deliberada por milestone no es un gate por epic: es el presupuesto humano
  consolidado.
- **D3** (sin Plan mode). **Se modifica:** Plan mode entra solo como puerta de lanzamiento
  de la ejecución, una vez, contigo presente. Nunca por epic ni como contenedor.
- **D19** (la delegación nunca sobrevive la sesión). **Se modifica:** la delegación queda
  **escrita en el registro** y sobrevive a sesiones y limpiezas de contexto mientras no
  cambien el sha del registro y los campos de decisión del epic. Se sigue sin inferirla de
  nada que no esté escrito.
- **D21/M4** (el planner no lee código). **Se modifica:** el código es fuente de premisas y
  de preguntas, nunca de decisiones. La protección antisesgo pasa de la entrada a la salida
  (fuente no-código obligatoria, statu quo etiquetado, spec sin prosa de implementación,
  proyección para el test-writer). Se mide con `status_quo_recommended` y
  `recommended_overridden`.

**Ítems de `docs/spec-gate-convergence-design.md`:**
- **F2-05 + F2-06 + F1-14** se fusionan en la **Etapa de decisiones de milestone**, que sube
  a la primera entrega.
- Se añade el **coordinador de epic en subagente**, con el estado **PARKED** y el registro de
  decisiones.
- **F1-04.3** ("premisas no citables") se reemplaza por "premisas citables con `path:línea`
  verificado, nunca como fuente única".
- **F2-03** (Code Surface persistida) sube a la primera entrega.
- **Se mantienen** F1-01, F1-03, F1-06 y F1-08. **F1-09/F1-10 pasan a mejoras de rendimiento
  y honestidad**, no a prerrequisito de la autonomía: HC-3/4 drenaron sus supersesiones en
  ejecución con v2.1.0 y 0 contactos. **F1-01 (o la política equivalente) sí es
  prerrequisito:** sin él, el gate vuelve a atascarse como en HC-5.
- Los topes de preguntas pasan de "2 rondas por epic" a un presupuesto **por sesión y por
  tema**, en las tres plataformas.

## 8. Riesgos y cómo validarlo antes de construir

- **Cobertura del barrido sin medir.** **Experimento previo:** replay sobre HC-IHCE.6–.9,
  comparando "solo preguntas" frente a "borrador + validación". **Criterio de descarte:** si
  captura menos del 60 % de las decisiones reales, o deja más de 1 parada tardía por epic,
  se queda el gate por epic con políticas y delegación.
- **Línea base barata.** Una parte grande del beneficio la da algo mucho más simple:
  políticas + delegación + contestar la primera ronda antes de irte. De los 1.096 min, 421
  eran una escalada por tope y 446 preguntas respondidas con la recomendada. La etapa
  completa aporta sobre todo en los epics regulatorios. Hay que medir su beneficio marginal
  frente a esa línea base.
- **Sesión larga.** HC-5 solo consumió ≈112 min de deliberación en su primera ronda; un tramo
  regulatorio de varios epics puede llevar horas *(inferencia)*. Se parte en sentadas por
  clase de epic, todas antes de ejecutar.
- **Decisiones que caducan.** Tus propios giros (el frontend, 17 h después de aprobar el
  plan) invalidan decisiones. Mitigación: hash por entrada y re-barrido solo del epic
  afectado; no barrer en detalle la parte marcada como volátil.
- **Contexto del chat principal** durante barrido y sesión. Mitigación: la preparación por
  epic va a subagentes que escriben a disco, y el coordinador solo maneja listas.
- **Portabilidad.** Plan mode, `effort` y `tools` no viajan a Copilot/Antigravity. El
  contrato es el registro en disco; el flujo es el mismo con "propuesta cerrada en chat".

## 9. Decisiones que necesito de ti

| # | Decisión | Recomendada |
|---|---|---|
| 1 | Horizonte de la etapa única: milestone completa (excluyendo lo volátil) o tramos de 5–8 epics | **Milestone completa**, en varias sentadas antes de ejecutar; tramos solo si la agenda supera ≈40 preguntas |
| 2 | Etapa 1: solo preguntas, o borrador + un pase de validación | **Borrador + validación** (lo decide el replay) |
| 3 | Lectura de código al planificar: el planner lee con guardas, o un investigador de código separado y recomendación "ciega" | **Investigador separado + recomendación ciega** al inicio; relajar si las métricas de sesgo lo permiten |
| 4 | Plan mode: puerta de lanzamiento opcional (Claude Code), o nunca (mismo flujo en las 3 plataformas) | **Puerta de lanzamiento opcional** |
| 5 | Pregunta tardía de dinero, legal o datos: PARKED y seguir, detener la tanda o diferir | **PARKED y seguir** (diferir no, por el principio de "se decide, no se difiere") |
| 6 | Relanzamiento desatendido: coordinador de epic en subagente, o driver que abre una sesión fresca por epic | **Subagente** (smoke test de los 3 niveles de anidamiento antes) |
| 7 | Orden de entrega | **Primero** etapa de decisiones mínima + F1-01 + política del tope + coordinador de epic; **después** F1-09/F1-10 y el resto; validar con el replay de HC-IHCE.6–.9 |
| 8 | Dónde vive el registro | **Archivo versionado por milestone** en `docs/05-specs/` |
