> **Estado: PROPUESTA — 2026-09-27. No implementado.** Análisis pedido por el usuario
> tras observar que la definición y validación de specs se volvió el cuello de botella:
> en Psikora (`C:\Proyectos\Psikora`) el Epic HC-IHCE.5 pasó un día entero en el Spec
> Planning Gate, agotó el tope de 3 rechazos, pidió "una pasada más" y siguió sin llegar
> a ejecución. Pregunta del usuario: ¿es el modelo que piensa demasiado, la comunicación
> entre el que valida y el que ajusta, o falta una skill experta en diseño de specs? Y:
> ¿cómo llegar a que la ejecución arranque sin pedirle acciones, sin perder la calidad de
> specs que evita reprocesos? **Solo lectura sobre Psikora; no se modificó nada allí.**
> Toda cifra sale de las transcripciones de Claude Code de Psikora (sesiones `2d6bf64c`
> = HC-IHCE.5 del 2026-09-27 y `1a3baebc` = HC-IHCE.3/.4 del 2026-09-23/24), de `git`
> sobre Psikora y de `build-metrics.jsonl`. Método: 8 investigadores forenses
> independientes → panel de 5 diseños + 3 jueces + síntesis → 5 verificadores
> adversariales (honestidad TDD, factibilidad contra el código, replay escéptico,
> completitud, seguridad del rescate). Las correcciones de la verificación están
> incorporadas en este texto.
> **Ver también `docs/milestone-planning-stage-analysis.md` (2026-09-27):** evalúa la etapa
> única de decisiones por milestone; fusiona F2-05 + F2-06 + F1-14 en esa etapa y la sube a
> la primera entrega, añade el coordinador de epic en subagente y el estado PARKED, degrada
> F1-09/F1-10 a mejoras (no prerrequisito de autonomía) y modifica D3, D19 y D21/M4.

# Diseño: Gate Convergente — el gate decide el comportamiento, el oráculo decide el impacto, APROBADO significa avanzar

## 0. Resumen ejecutivo

1. **El cuello de botella no es el modelo ni la redacción: el gate no tiene punto fijo.**
   HC-IHCE.5 duró 427 min sin sellar un solo spec. El 51 % (219 min) fue espera o
   conversación con el usuario (14 contactos), el 27 % el planner (9 pases), el 12 % los
   validadores (14 despachos) y el 9 % el coordinador. Hubo 4 REJECTED y 2 escaladas
   por tope. **3 de los 4 rechazos y 4 de los 5 BLOCKER fueron por supersesiones de tests
   sellados que faltaban** — una propiedad que el autor (planner) no puede ver porque
   tiene prohibido leer código, que el revisor (validador) sí ve porque lee tests, y que
   ni siquiera es criterio escrito del validador. El único BLOCKER de contenido real fue
   ADR-020 (doble factor).
2. **El gate intentaba adelantar un dato que la ejecución da exacto y barato.** En
   HC-IHCE.3/.4 el gate acertó solo el **30 %** de las supersesiones (3 % y 43 %); el resto
   lo encontró la suite en ejecución ("65/65 sin huecos ni extras") y cada loop de
   corrección costó 3–8 min de coordinador. En HC-IHCE.5 el 50 % del corpus del gate
   (211 de 422 KB) era contabilidad de supersesiones escrita por triplicado; el
   comportamiento que consumen test-writer e implementer era el 13,8 %. El propio usuario
   terminó eligiendo "que las supersesiones se resuelvan en el bucle de corrección".
3. **Tus tres hipótesis:** **H1 (el modelo piensa demasiado): parcial y secundaria** — la
   sesión corrió en esfuerzo `xhigh` heredado por todos los subagentes; bajarlo ahorra como
   mucho ≈62 min de 427 (15 %) y `xhigh` no bajó los rechazos. Se corrige en una línea de
   frontmatter (`effort:` por agente, verificado en la doc oficial). **H2 (comunicación
   validador↔ajustador): sí, pero es el contrato, no los mensajes** — el crítico juzga lo
   que el autor no ve, re-valida desde cero sin memoria y oscila, y sus observaciones de
   un APROBADO reabren el gate (10 de 14 se volvieron trabajo, una en alcance nuevo).
   **H3 (skill experta de specs): refutada como agente adicional** — la forma ya era
   uniforme (8/8 MECH_CHECK PASS, 0 BLOCKER de forma, 8/9 specs con la misma estructura).
   Lo único que la evidencia respalda es un checklist cerrado de "qué NO escribir / qué NO
   marcar" dentro de los agentes que ya existen, probado con defectos plantados.
4. **La propuesta ("Gate Convergente") en una línea:** cada propiedad la decide quien puede
   verla — el negocio el humano (una vez, en un presupuesto único), la coherencia con ADR,
   contrato y reglas el validador LLM, lo mecánico un script, y el impacto sobre tests
   existentes el compilador y la suite en ejecución, en un lote por spec, con controles
   mecánicos de honestidad TDD. APROBADO significa avanzar; las re-validaciones son delta;
   el tope termina en un menú cerrado, nunca en otra ronda abierta.
5. **Efecto esperado (replay de HC-IHCE.5 con el usuario presente, fase 1):** sello en
   ≈t+142 / 216 / 327 min (optimista / central / pesimista) frente a >427 sin sellar;
   ≤2 rondas humanas frente a 14 contactos; 0 rechazos por supersesiones. Contando gate +
   ejecución (lock→[x]) el ahorro central es ≈106–159 min. **Con el usuario ausente el
   reloj lo sigue dominando la espera**, pero cada contacto eliminado vale 146–432 min de
   noche — por eso la fase 1 incluye también palancas de tanda (§5, F1-14).
6. **Hoy mismo, sin tocar el framework,** HC-IHCE.5 se puede rescatar: la ronda 3 terminó
   con set-6 y spec 02 APROBADOS y un único BLOCKER en el spec 03 (una supersesión de
   comportamiento conocida). La secuencia segura está en §9 — **primero hay que guardar en
   disco los veredictos de la ronda 3, que hoy solo existen en la transcripción.**

## 1. Qué pasó (cifras)

### 1.1 — HC-IHCE.5, 2026-09-27 (15:48 → 22:55 UTC, 426,8 min, 0 specs sellados)

| Cubeta (cada minuto asignado una sola vez) | min | % |
|---|---|---|
| Espera / conversación con el usuario (9 AskUserQuestion + 5 mensajes libres) | 219,0 | 51,3 |
| Cómputo del planner (9 pases; 111 min de trabajo real, el resto parado entre reanudaciones) | 115,3 | 27,0 |
| Cómputo de validadores en camino crítico (14 despachos, 95 min sumados) | 51,6 | 12,1 |
| Trabajo propio del coordinador | 39,1 | 9,2 |
| Otro | 1,8 | 0,4 |

Minutos por causa primaria: decisiones de negocio (Q-1…Q-6, incluido el rediseño del
modelo de habeas data) **141** · violación de ADR/convención **80** (52 de ellos en una
pregunta de ubicación de archivo que solo era WARNING) · supersesiones incompletas **68** ·
alcance nuevo nacido de una observación de un set APROBADO (vencimiento de enlaces Wompi,
RN-PAGO-009) **64** · base obligatoria **71**.

De los 14 contactos humanos: 5 evitables (Q-5 se respondía desde el código; el slot de
constantes era un WARNING), 3 tardíos (refinaban Q-3/Q-4 ya preguntadas a las 16:41), 3
AskUserQuestion rechazadas por el encuadre de las opciones (en Q-1 el coordinador cambió
la recomendada del planner; la respuesta final fue "NINGUNA de las opciones").

El coordinador terminó con **791k de contexto** (el diseño promete O(n_epics)), 143
llamadas Bash y 16 tablas de superficie (2.220 filas, 435 KB) cuando el diseño prevé ≤80
filas. El planner, reanudado 9 veces por `SendMessage`, llegó a **941k y compactó**; sus
handbacks re-emitían 229k caracteres que ya estaban en disco.

Las filas `sup:` crecieron 28 → 119 → 132 → 130 → 167 → 178 → 223 a lo largo de 8 pases,
aunque la tabla de 399 tests candidatos existía a los 7 minutos del inicio. El spec 01
osciló de "faltan supersesiones" (BLOCKER) a "sobran 13" (WARNING).

### 1.2 — HC-IHCE.3 y .4 (esfuerzo medium; sí llegaron a ejecución)

| Epic | Gate (pared) | Espera humana | Cómputo del gate | Ejecución activa | Loops por spec en ejecución |
|---|---|---|---|---|---|
| HC-IHCE.3 | 203 min | 146 min (1 pregunta nocturna) | ≈57 min | 282 min | ≈99 min (4 BLOCKED) |
| HC-IHCE.4 | 350 min | 300 min (1 pregunta nocturna) | ≈50 min | 392 min | ≈108 min (2 REJECTED_MINOR + 1 BLOCKED) |

- El usuario eligió la opción "(recomendada)" en **6/6** preguntas.
- De los 7 loops de corrección en ejecución (≈207 min), **5 (71 %) fueron tests sellados
  rotos no declarados**, 1 un defecto de negocio del spec (separador de scopes), 1 de
  implementación. Lo caro fue redescubrir en serie: 3 BLOCKED por la misma causa raíz en
  HC-3 porque la suite completa corre en Step 7, después del review.
- **Recall del gate sobre supersesiones: 30 %** (2/69 en HC-3, 64/150 en HC-4). ≈67 tests
  (FK/constraints contra fixtures) solo se detectan ejecutando; ≈87 eran detectables por
  símbolo.

### 1.3 — Histórico de Psikora

- Minutos de agente en el gate: HC-IHCE.1 = 97, .3 = 59, .4 = 52, **.5 ≥ 207**. HC-5 es un
  outlier, no la norma: cambió el esfuerzo (xhigh), el tamaño (70 IDs vs 41–43), el alcance
  creció dentro del gate y los validadores se re-despacharon en frío en vez de reanudarse.
- KB por spec: 10,8–16,4 (may–jul, features) → 24,9 (ago) → 23,6–35,8 (HC .1/.3/.4) →
  **65** (HC .5). Superficie + supersesiones pasan del 20–30 % al 40–65 % del spec; la
  sección de AC casi no cambia.
- Commits de supersesión por spec: 0,12 (features) → 0,34 (CONSENT-REDISENO) → **1,67**
  (HC-IHCE). El costo se concentra en **refactors de esquema brownfield con muchos tests
  sellados**.
- Enmiendas al spec en ejecución: 0,67/spec con gate vs 0,35 antes (agosto). En este tipo
  de epic el gate no redujo el reproceso, aunque sí evitó reverts de epic completos (0 vs
  el revert entero de CONSENT-REDISENO.7).

## 2. Diagnóstico: por qué el bucle no converge

| # | Mecanismo (dónde vive hoy) | Por qué no converge | Evidencia HC-IHCE.5 |
|---|---|---|---|
| M1 | Completitud de supersesiones juzgada por el validador (`agents/architecture-validator/AGENT.md` Dim 4, que **no** la exige) contra un planner que tiene prohibido leer código (`agents/spec-planner/AGENT.md`) | El autor no ve la propiedad que juzga el revisor. Cada pase del validador descubre una forma de uso nueva (aserciones, helpers, constructores, EF, Moq, SQL crudo) | 3/4 REJECTED, 4/5 BLOCKER; `sup:` 28→223 |
| M2 | Validador fresco por contrato ("Each invocation is fresh"), sin veredicto previo ni alcance delta | Hallazgos nuevos sobre texto no tocado; oscilación | 03: APPROVED en d1 → BLOCKER en d2 por un NOT NULL que ya estaba; 01: "faltan" → "sobran 13"; re-despacho fresco ≈9 min vs ≈1 min reanudado en HC-3/4 |
| M3 | NOTES/WARNING de un APPROVED sin destino (`skills/build/SKILL.md` no menciona NOTES) y sin congelamiento de alcance | Los APPROVED producen re-pases, preguntas y alcance | 10/14 observaciones se volvieron trabajo; RN-PAGO-009 entró tras un set APROBADO; en pleno gate se editaron business_requirements ×10, ROADMAP ×9, conventions ×1, un ADR ×1 |
| M4 | Filas `sup:` dentro de COVERAGE_TABLE, que alimenta el hash de MECH_CHECK y la regla "re-correr 5a si cambió la tabla" | Cada supersesión re-dispara la validación del set | 6 despachos de set donde el diseño preveía 1 |
| M5 | Tope de 3 rechazos que suma 4a + 5a + 5b y escala sin menú | Dos 5b paralelos consumen 2 de golpe; cada rechazo posterior vuelve a escalar | 2 escaladas en 40 min |
| M6 | Límite de 2 rondas de preguntas solo para el planner | Las preguntas del coordinador y las nacidas de NOTES no tienen límite | 9 AskUserQuestion, 5 fuera de las rondas |
| M7 | Code Surface pensado para ≤80 filas de exports | El coordinador se volvió analista de impacto manual; sus hallazgos de código se volvieron fuentes citables | 16 tablas, 2.220 filas; 11/86 R-n citan "despacho del coordinador" |
| M8 | Protocolo de supersesión diseñado para "una regla cambió" (`docs/tdd-honesty-reference.md`) | Aquí son rupturas estructurales en masa, registradas 3 veces (Supersede: + sup: + SUPERSESIONES) más IMPACTO_TESTS_DESCARTADOS (fuera de plantilla) | 91 % "solo fixture"; 212/223 de tests anteriores al corpus; 82/112 descartes dependen de "Decisiones de implementación" que el planner inventa sin ver código |
| M9 | Validador haciendo trabajo de script | 53 % de su tiempo en verificación mecánica (conteos, citas literales, IDs) y barridos de código; síntesis del veredicto 9 % | 18 scripts propios; 12–55 Bash por despacho |
| M10 | C5 (≤15 IDs, WARNING) aceptado en silencio y medido en IDs, no bytes | Specs cada vez más densos que encarecen cada validación | 23/19/27 IDs; spec 02 con 86 KB y el menor número de IDs |

Además: **la garantía TDD real nunca fue por test.** El hook del sello, el paso 3b y el
`git diff RED..HEAD` del Step 5.5 operan por archivo o por rango; ningún control mecánico
usa `path::test`. La lista por test que escribía el LLM no protegía nada que un control
mecánico verificara.

### 2.1 — Supuestos del diseño original que se rompieron

| Supuesto (`docs/spec-planning-gate-design.md`, `skills/build/SKILL.md`) | Realidad en Psikora |
|---|---|
| Validador "1× por epic"; planner "un Opus más, dos con dudas" | 16 / 9 / 14+ validadores; 9 / 8 / 9 planners |
| "Ningún contacto humano es rutinario" | 9 AskUserQuestion; 51 % del día esperando |
| Code Surface ≤80 filas | 2.220 filas |
| Supersesión = un test que contradice una regla cambiada | 223 filas, casi todas estructurales |
| 5b corre una vez sobre el set estabilizado | 5b re-corrido ×2–3; 5a re-corrido por cada cambio de `sup:` |
| 4a ahorra despachos del validador | 8/8 PASS; ningún rechazo evitado |
| Coordinador O(n_epics) | 791k de contexto |

## 3. Respuesta a tus hipótesis

**H1 — "el modelo piensa demasiado": parcial y secundaria.** HC-IHCE.5 corrió en `xhigh`
(HC-3/4 en medium), heredado por todos los subagentes porque sus `AGENT.md` solo declaran
`model: opus`. Con `xhigh` el pensamiento por llamada sube ×2,4 (planner) y ×3,2
(validador), y ocupa el 51 % y el 68 % de su tiempo de modelo; la latencia mediana por
turno no cambia (~6 s), crece la cola de turnos >60 s. Techo de ahorro sobre el día:
`xhigh → medium` ≈62 min (15 %); Sonnet en el validador ≈0 min (mismo throughput medido);
scripts para lo mecánico ≈28 min (7 %). `xhigh` **no** bajó los rechazos (4/11 vs 2/17 y
1/7): compró detección previa de defectos que en ejecución se arreglan en minutos. La doc
oficial de Claude Code confirma que el frontmatter de subagentes admite
`effort: low|medium|high|xhigh|max`, que "Overrides the session effort level"
(<https://code.claude.com/docs/en/sub-agents>), también para agentes de plugin. Palanca:
F1-02. No elimina ninguna vuelta.

**H2 — "la comunicación entre el que valida y el que ajusta": sí, pero es el contrato.**
El relevo en sí es rápido (1–3,5 min) y los VIOLATIONS eran claros. Lo que falla es el
reparto de responsabilidades: el crítico rechaza por algo que el autor no puede observar
(M1), revalida desde cero sin memoria (M2), sus observaciones reabren el gate (M3), 5a y
5b se reparten la misma preocupación (M4) y el tope escala sin salida (M5). Palancas:
F1-01, F1-03, F1-05, F1-06, F1-08, F2-02.

**H3 — "una skill experta en diseño de specs": refutada como agente adicional.** El
spec-planner ya es un autor especializado (Opus dedicado, plantilla, checklist de
autorrevisión, tabla de racionalizaciones) y lo que produce ya es uniforme. Ninguno de los
rechazos fue de forma. El problema es **qué se le pide al spec**: un inventario de tests
que dejan de compilar, hecho sin ver el código, más tres copias de cada dato. La práctica
externa (Superpowers midió que un revisor subagente duplicaba el tiempo sin mejorar
calidad; spec-kit y BMAD usan una sola pasada con severidad) respalda una sola versión de
H3: **un checklist cerrado dentro de los agentes existentes** ("qué NO escribir" en el
planner, "qué NO marcar" en el validador) **validado con probes de defectos plantados**
(F1-01, F1-12). No un tercer agente en el bucle.

## 4. Principios

1. **Cada propiedad la decide quien puede verla.** Negocio → humano. Coherencia con ADR,
   RN, contrato, reglas y stack → validador LLM. Forma, citas, IDs, alcance congelado →
   script. Impacto sobre tests existentes → compilador y suite en ejecución. Un revisor
   nunca bloquea por una propiedad que el autor no puede observar con los mismos inputs.
2. **APROBADO significa avanzar.** Toda observación nace con un destino cerrado y nunca
   reabre el gate ni genera una pregunta. Excepción: un EC o guard de dinero, legal o datos
   dentro de las operaciones del propio epic se decide, no se difiere.
3. **Un solo presupuesto humano por epic**, de cualquier origen, en la misma sentada; cada
   tema se agota con sus derivadas; las opciones y la recomendada del planner llegan tal
   cual; lo que el código responde no se pregunta.
4. **Exhaustivo una vez, delta después.** Las re-validaciones reciben el veredicto previo y
   el diff; se cuentan rondas, no despachos.
5. **Sellado = validado.** El tope termina en un menú cerrado; nunca se sella por defecto
   un BLOCKER conocido.
6. **Honestidad TDD por construcción, verificada por máquina.** Todo cambio a un test
   existente va en un commit tipificado, registrado por SHA y verificado en 5.5 con reglas
   que no dependen del juicio del autor del cambio.
7. **Cero fallbacks silenciosos y agnosticismo de stack.** Los scripts emiten
   PASS | FAIL | REVIEW | UNVERIFIABLE; las heurísticas por lenguaje solo pueden subir el
   escrutinio (REVIEW), nunca FAIL; los FAIL se basan en hechos universales (reporte del
   runner, compilador, git).
8. **Estado en disco, agentes efímeros, esfuerzo declarado.** El planner siempre es fresco
   desde disco; los despachos van por path; el esfuerzo se fija por rol.
9. **Entrega incremental y medida.** La fase 1 no cambia la gramática de specs ni exige
   migración de contenido; cada fase se mide antes de la siguiente; cada cambio sale con su
   documentación para el usuario final.

## 5. La propuesta, por fases

> Los efectos por cambio **no se suman** (varios atacan el mismo bucle); el efecto conjunto
> está en el replay (§6).

### Fase 1 — v2.2.0 (minor; sin cambio de gramática de specs; sin migración de contenido)

**F1-01 — Sacar del gate la completitud de supersesiones y el análisis de impacto.** *(S)*
- *Dónde:* `agents/architecture-validator/AGENT.md` (Dim 4, Context Restriction, "What You
  Do NOT Do"); `agents/spec-planner/AGENT.md` (checklist del Step 3, "What You Do NOT
  Do"); `skills/build/SKILL.md` (pre-flight Code Surface, paso 5);
  `hooks/lib/spec-set-check.js` (C-sup).
- *Mecanismo:* (1) Validador: "La COMPLETITUD de la lista de supersesiones no es criterio.
  No abras tests/ ni src/. Una sospecha va, como mucho, en una línea de NOTES
  `sup-candidato: <path|símbolo>`, que nunca es WARNING ni BLOCKER." Lista "qué NO marcar":
  completitud o exceso de supersesiones; decisiones de implementación no contractuales
  (mapeo EF, propiedad derivada vs columna, constructores); lo que certifica MECH_CHECK;
  estilo y longitud; cualquier hecho que requiera leer código. (2) Planner: declara solo
  supersesiones de **comportamiento** (una aserción que un BR-n de este spec vuelve falsa),
  con fuente de la regla vieja (RN, ADR, spec viejo o `_current/`), sin pretensión de
  completitud. Lista "qué NO escribir": enumeraciones de roturas de compilación o fixture;
  IMPACTO_TESTS_DESCARTADOS; "Decisiones de implementación" inventadas para predecir
  roturas; "epic origen" por defecto; prosa en la Superficie; la sección "Aclaraciones"
  cuando solo espeja RESOLVED_ALONE. (3) El coordinador no genera tablas de uso en tests.
  (4) C-sup pasa a verificar mecánicamente que el nombre del test aparezca como cadena en
  el archivo (agnóstico de lenguaje); el validador deja de hacerlo.
- *Ataca:* M1, M7, M8, M9. *Efecto en HC-5:* −3 de 4 REJECTED, −4 de 5 BLOCKER, −2
  escaladas, ≈−210 KB de corpus.

**F1-02 — Validador sin barridos y esfuerzo declarado por rol.** *(S)*
- *Dónde:* frontmatter de `agents/architecture-validator/AGENT.md` (`tools: Read, Glob` +
  `effort: medium`) y de `agents/spec-planner/AGENT.md` (`effort: medium`).
- *Mecanismo:* `Glob` es imprescindible: `Read` no lista directorios y architecture,
  new-feature y modernize le pasan `.specture/decisions/` como directorio. `tools: Read,
  Glob` quita Bash y Grep (los barridos). El release queda condicionado a los probes de
  F1-12: si el validador en medium no detecta 3/3 un clon de la contradicción ADR-020, ni
  3/3 los defectos de nivel proyecto (capacidad sin operación, RN sin epic), se publica en
  `high` y se registra.
- *Plataformas:* `scripts/copilot-mirrors.js` no traslada `effort` ni `tools` de la fuente
  (los tools del espejo salen de `copilot/compatibility-matrix.json`, donde el validador
  tiene `["read","search"]` — con `search` los barridos siguen siendo posibles en Copilot:
  pasar a `["read"]` o documentar la brecha). En Antigravity, smoke test de `tools: Read,
  Glob` antes del release o degradación documentada. Recomendación para ambas: fijar el
  esfuerzo de la sesión en medium para `/specture:build`.
- *Ataca:* H1, M9. *Efecto:* −28/−33 % de latencia por paso; no cambia el número de
  vueltas.

**F1-03 — APROBADO significa avanzar: destinos cerrados, Diferidos con dueño y GATE_NOTES.** *(S/M)*
- *Dónde:* `skills/build/SKILL.md` (paso 5, paso 6, "Human contacts");
  `agents/architecture-validator/AGENT.md` (Output: cada WARNING lleva `destino:`; NOTES ≤3
  líneas y sin propuestas de alcance); `templates/PLANNING_TEMPLATE.md` (línea opcional
  `Acción del coordinador: <destino>`); `skills/build/EPIC_LOOP.md` (Dispatch Manifest:
  implementer, **ux-implementer** y code-reviewer reciben GATE_NOTES; el test-writer no);
  `templates/ROADMAP_TEMPLATE.md` (campo `**Diferidos heredados:**` con gramática).
- *Mecanismo:* ante un APPROVED con WARNING o NOTES, el coordinador no re-despacha ni
  pregunta; escribe el destino según esta tabla:
  - (a) forma o trazabilidad (C7, C8, IDs) → GATE_NOTES verbatim;
  - (b) duda de "cómo" sobre un path ya declarado → GATE_NOTES o deuda de conventions §2.
    **La ruta sellada en la Superficie se ejecuta tal cual** (el sello `allowed_paths` la
    haría denegar); el implementer solo decide lo que no mueve `allowed_paths`. Lo visual y
    la marca (MK-nnn) nunca van por aquí: van a la Dim 6 del reviewer o a la aprobación
    visual;
  - (c) duda de contrato observable → ronda 2 si queda cupo; si no, al menú del tope;
  - (d) EC o guard dentro de las operaciones del propio epic, incluidas las clases dinero,
    legal y datos → contractual: entra en la ronda 2 o en el siguiente pase por BLOCKER;
    **nunca se difiere**;
  - (e) alcance fuera del bloque del epic → "Diferidos" del resumen del paso 6 y registro en
    `**Diferidos heredados:**` del epic **dueño por componente o RN** (no "el siguiente"),
    que su propio gate recibe como candidato C3; una ruta a `new-feature` se pregunta una
    sola vez al drenar la tanda;
  - (f) `sup-candidato` → ejecución.
  Un re-despacho del planner exige al menos un BLOCKER. Congelamiento: tras persistir las
  respuestas, el bloque del epic y sus RN solo cambian para persistir la ronda 2 o por un
  "inclúyelo" explícito del usuario (que cuenta en el presupuesto); lo hace cumplir C-freeze
  (F1-07).
- *Ataca:* M3, M6. *Efecto en HC-5:* −51,8 min (pregunta del slot), −64,2 min si Wompi se
  difiere (el usuario puede traerlo con "inclúyelo", como de hecho quiso), 10/14
  observaciones dejan de volverse trabajo.

**F1-04 — Presupuesto humano único y ledger de contactos.** *(S/M)*
- *Dónde:* `skills/build/SKILL.md` (paso 3, "Human contacts", Step 8.5, reanudación);
  `agents/spec-planner/AGENT.md` (Escalation criteria; campos `derivadas:` y
  `condicionales:` en OPEN_QUESTIONS; casilla "cada BR/AC derivado de un ANSWER respeta los
  ADR Accepted y RULES_RESOLVED"); `skills/debug/SKILL.md` y `docs/execution-flows.md`
  (precedencia, abajo).
- *Mecanismo:*
  1. **Tope de 2 rondas (≤4 preguntas cada una) para TODA AskUserQuestion del gate** —
     planner, coordinador, dudas de contrato de la validación, sizing. No cuentan la
     pregunta de reanudación ni una única escalada cerrada del tope. Una duda de contrato
     que siga abierta después va a un `discover` acotado, nunca a una tercera ronda.
  2. **Opciones del planner tal cual.** El coordinador puede añadir una línea "Dato
     verificado: <hecho> (<path>)"; si discrepa, lo devuelve al planner como CONCERN antes
     de preguntar.
  3. **Filtro previo:** las premisas se verifican con CODE_SURFACE o una sonda de ≤20 filas,
     solo para decidir si se pregunta (esos hechos **no** son citables en RESOLVED_ALONE).
     Una pregunta cuyo `afecta:` no es observable no se hace (Q-5).
  4. **Derivadas y condicionales en la ronda 1:** cada pregunta trae las sub-decisiones que
     dispara cada opción, y la ronda 1 anexa las preguntas condicionales probables del
     borrador de validación, para que la ronda 2 sea opcional si ya se respondió.
  5. **Contraste de respuestas con ADR** antes de cerrar la sentada (el caso ADR-020). El
     validador sigue siendo la captura primaria; esto es una segunda red, no una garantía.
  6. **Un slot `sin definir` de conventions §2** que conventions manda preguntar entra en la
     ronda 1 (era detectable en P1), nunca como pregunta suelta posterior.
  7. **Ledger de contactos del build:** con N>1 el prompt de Step 8.5 (knowledge capture) se
     agrupa en uno solo al drenar la cola; dentro del epic-agent la clasificación de fallos
     de F1-09/F1-10 tiene precedencia sobre los disparadores del skill `debug` ("mismo test
     falla 2×", "implementer BLOCKED") para fallos en tests de epics cerrados.
- *Ataca:* M6, contactos evitables y tardíos. *Efecto en HC-5:* de 14 contactos a 2
  rondas (≈4–5 intercambios, por el rediseño de habeas data, que es inherente).

**F1-05 — Re-validación delta y validación borrador en segundo plano.** *(S/M)*
- *Dónde:* `agents/architecture-validator/AGENT.md` (Context Restriction: "fresco, sin
  historial, salvo PRIOR_VERDICT y DIFF"; formato DELTA); `skills/build/SKILL.md` (paso 5,
  reanudación); `templates/PLANNING_TEMPLATE.md` (encabezado de VEREDICTOS con
  `— <ISO con hora> — tree <sha12> [— borrador]`, que la regex actual de
  `metrics-report.js` ya acepta).
- *Mecanismo:*
  1. Tras cada pase con 4a PASS: `git add docs/05-specs/<epic>/` y
     `git write-tree --prefix=docs/05-specs/<epic>/` (TREE, comparable con
     `git rev-parse <SPEC_SHA>:docs/05-specs/<epic>` en la reanudación).
  2. Re-validación = despacho fresco con PRIOR_VERDICT verbatim + `git diff <tree_prev>
     <tree>` + un segundo DIFF del mismo intervalo sobre `business_requirements.md` y
     `.specture/decisions/`. Salida: `PRIOR V-n: ADDRESSED | NOT ADDRESSED | RETIRADO`
     (RETIRADO = el criterio lo sacó del gate, p. ej. F1-01).
  3. Un BLOCKER nuevo solo puede estar sobre texto del DIFF, o ser **LATE**: violación de
     ADR/regla BLOCKER (J1), de contrato (J2), contradicción interna AC/BR/EC (J5) o BR infiel
     a una RN que el segundo DIFF tocó (J4) — máximo 1 LATE por epic. Un hallazgo con la
     misma clave que un V-n ya ADDRESSED se reporta como NOTE (anti-oscilación). Si
     `git cat-file -e <tree_prev>` falla, validación completa.
  4. **Borrador (solo Claude Code):** tras P1, 4a síncrono (<1 s); si FAIL, micro-pase en
     primer plano; con PASS, se lanzan en segundo plano 5a y los 5b del borrador y **recién
     entonces** se hace la AskUserQuestion. No cuentan para el tope ni autorizan sellar;
     alimentan las VIOLATIONS de P2 y las condicionales de la ronda 1. En Copilot y
     Antigravity (una pregunta en chat termina el turno) se **omite**.
  5. Sellar sigue exigiendo APPROVED no-borrador sobre el texto final.
- *Ataca:* M2. *Efecto:* la primera validación queda oculta en la espera humana; los
  validadores en camino crítico bajan de ≈52 a ≈6–12 min.

**F1-06 — Tope por rondas y salida por menú cerrado.** *(S)*
- *Dónde:* `skills/build/SKILL.md` (paso 5 y 4a — hoy "each FAIL counts toward the cap");
  espejo del Iteration Cap de `EPIC_LOOP.md`.
- *Mecanismo:* se cuentan **rondas** (una ronda con despachos paralelos cuenta 1; el
  borrador no cuenta) y solo BLOCKER NOT ADDRESSED o nuevos. Los FAIL de 4a no cuentan,
  pero la misma línea FAIL dos veces seguidas obliga a CONCERNS y a la tercera es
  `BLOCKED: gate` (defecto del framework). Con 3 rondas sin APPROVED: **una**
  AskUserQuestion cerrada, con opciones pre-armadas por clase de BLOCKER vivo (ADR:
  enmendar el ADR vía architecture | cumplirlo literal; contrato: `BLOCKED: contrato`; BR vs
  RN o contradicción interna: discover acotado | elegir entre las dos reglas; sizing:
  partir; siempre: pausar el epic). "Sellar con riesgo declarado" solo para clases no
  semánticas, nunca por defecto.
- *Ataca:* M5. *Efecto en HC-5:* 0 escaladas (con F1-01 el replay no llega al tope).

**F1-07 — Ampliar 4a: citas, IDs y congelamiento de alcance.** *(M)*
- *Dónde:* `hooks/lib/spec-set-check.js`, `hooks/lib/planning.js`,
  `hooks/test/spec-set-check.test.js`, `skills/build/SKILL.md` 4a, Dim 7 del validador
  (en C7 le queda solo "¿la cita decide la duda?"), `templates/PLANNING_TEMPLATE.md`
  (línea opcional `SCOPE_FREEZE:`), prefijos de cita declarados en las plantillas
  (`rules.yml R-n` vs `_planning R-n`, hoy colisionan).
- *Mecanismo:*
  - **C7m:** el `fuente:` de cada R-n resuelve contra una gramática de fuentes **derivada de
    las familias de ID de los templates** (RN, CL, FA, HU, MK, GAP, ADR §, conventions §,
    rules.yml, operationId, architecture §, epic del ROADMAP, `_current/<slug>.md`, Q-n,
    path del repo, concepto del docs-index) y la `cita:` aparece literal tras normalizar.
    Una fuente no resoluble (p. ej. un artefacto externo que no está en el repo — en HC-5,
    11 citas a la "Revisión del Esquema Psikora") o una familia desconocida → **REVIEW**,
    no FAIL (el juicio vuelve a C7 del validador); "despacho del coordinador" → FAIL. Guía
    al usuario: commitear bajo `docs/` los artefactos externos que se citan.
  - **C-ids:** todo AC/BR/EC/GUARD/R-n/Q-n citado existe; todo RN existe; todo ADR existe y
    está Accepted; todo id de rules.yml existe; todo operationId está en el contrato.
  - **C-freeze:** `--scope-hash` sobre el bloque del epic + el texto de sus RN. Su FAIL va
    **al coordinador** (el planner no puede tocar ROADMAP ni RN): revertir la edición o
    registrar el "inclúyelo". Una aclaración de RN motivada por un BLOCKER J1 (ADR) es una
    excepción registrada que regenera SCOPE_FREEZE sin consumir presupuesto.
  - El hash de MECH_CHECK se extiende a RESOLVED_ALONE y a los `.spec.md` (hoy cubre solo
    las filas de la tabla, así que una edición posterior a un PASS deja C7m/C-ids
    obsoletos sin que `--hash-only` lo vea).
- *Ataca:* M9, M3. *Efecto:* quita del validador ≈450 comprobaciones de cita por epic;
  impide mecánicamente que el alcance crezca después de las respuestas.

**F1-08 — Planner siempre fresco, handback mínimo, alcance del pase controlado.** *(S)*
- *Dónde:* `agents/spec-planner/AGENT.md` (Required Inputs "On re-dispatch", Re-dispatch,
  Output); `skills/build/SKILL.md` pasos 2 y 4 y anti-patrones.
- *Mecanismo:* nunca se reanuda al planner con SendMessage; cada pase es un despacho nuevo
  con rutas, VIOLATIONS/ANSWERS verbatim y `ALCANCE: [slugs]`. El handback lleva STATUS,
  rutas, CHANGELOG, OPEN_QUESTIONS nuevas y CONCERNS (COVERAGE_TABLE y RESOLVED_ALONE se
  leen de disco). El coordinador compara `git status --porcelain --untracked-files=all --
  docs/05-specs/<epic>/` con ALCANCE; un archivo modificado fuera de alcance se restaura
  desde el índice del pase anterior (excepción declarada al anti-patrón "never restore
  with checkout"); un archivo nuevo fuera de alcance se reporta y nunca se borra sin
  preguntar.
- *Ataca:* 941k de contexto, compactación, 229k caracteres de handback, fugas de alcance.

**F1-09 — Ejecución por capas: el oráculo descubre el impacto en un lote por spec.** *(M)*
- *Dónde:* `skills/build/EPIC_LOOP.md` (nuevo Step 5.2; Step 7 pasa a re-verificación);
  `agents/implementer/AGENT.md` y `agents/ux-implementer/AGENT.md` (Step 4: hoy "Run the
  FULL test suite… fix it before reporting done"); `docs/tdd-honesty-reference.md`
  (sección "Clasificación de fallos de tests existentes").
- *Mecanismo:*
  1. **Capa de compilación (pre-GREEN).** Tras el primer build del implementer, si los
     proyectos de test no compilan fuera de los archivos RED del spec (en .NET un test viejo
     roto tumba el ensamblado entero, y con él los RED del spec), el implementer commitea la
     producción como WIP y reporta de inmediato `BLOCKED: spec — supersesiones
     (compilación)` con el log completo, **sin editar ningún test**. Se corre el lote y se
     reanuda en GREEN.
  2. **Capa de runtime.** Tras GREEN, suite completa antes de 5.5 y del review. Cada fallo
     fuera de los tests RED del spec se clasifica (compilación · preparación · aserción ·
     producción · entorno · desconocido) usando el reporte del runner.
  3. **La clasificación solo puede subir el escrutinio:** cualquier marco de producción en
     la cadena de InnerException, o un 5xx en la respuesta, es "producción"; lo desconocido
     va al implementer. Línea base de fallos tomada en el commit del lock (worktree) y
     excluida; los fallos aislados se re-corren 2 veces antes de clasificar (flakes); un
     mismo fallo de inicialización en toda una colección es `entorno` → `BLOCKED: entorno`.
  4. Aserción y producción van primero al implementer ("es regresión salvo que un BR-n lo
     cambie por diseño"); el resto sale en **un solo** `BLOCKED: spec — supersesiones` por
     spec y por capa. El implementer nunca arregla un fallo ajeno tocando tests ni
     doblando producción para contradecir un BR.
- *Ataca:* 3 BLOCKED en serie por una misma causa raíz; la presión sobre el implementer.

**F1-10 — Loop ligero "solo supersesiones", con salvaguardas mecánicas de honestidad TDD.** *(M)*
- *Dónde:* `skills/build/SKILL.md` ("Coordinator processes the report": rama
  `BLOCKED: spec — supersesiones`); `skills/build/EPIC_LOOP.md` (3b, Step 5.5, reanudación);
  `hooks/lib/seal-cli.js` (`supersede --record`, rechazo de paths propios,
  `unseal-spec-paths`); `docs/tdd-honesty-reference.md` (filas :42 y :124-128, paso 3 bis);
  `agents/tdd-test-writer/AGENT.md` (modo supersede sobre HEAD); `agents/code-reviewer/AGENT.md`
  (Dim 4).
- *Mecanismo del loop:* un planner fresco recibe la lista de fallos **como dato** (no lee
  código) y agrega las líneas Supersede/sup/SUPERSESIONES agrupadas por BR-n → 4a →
  validación delta solo sobre las líneas nuevas → commit con SPEC_SHA nuevo → `seal-cli
  write` (conserva `specs[]`) → el epic-agent se reanuda en ese spec; el test-writer hace
  `seal-cli supersede --paths … --record` y commitea `test(supersede): …` sobre HEAD. **Sin
  `unseal-spec` ni `git revert` del RED** (revertir el RED con el GREEN ya en HEAD produce
  un re-RED que pasa enseguida: ese camino era incoherente). Un Supersede declarado cuyo
  test compila y sigue verde se reporta "sin cambio" y no cuenta en el tally.
- *Salvaguardas (la verificación adversarial encontró cómo romper la versión sin ellas):*
  1. **J9 semántico con DATO:** el coordinador extrae del reporte la aserción vieja y la
     primera línea del fallo; el validador responde "¿BR-n hace falsa la expectativa
     vieja?" — "no" o "indeterminable" = BLOCKER y el caso vuelve al implementer como
     regresión. (Sin esto, quien decide "regresión o diseño" es el propio implementer.)
  2. **RED retroactivo en base** para supersesiones de aserción: en un worktree del commit
     del lock se superponen los tests reescritos y se corren solo esos; deben FALLAR en base
     y PASAR en HEAD (pasan en ambos = no discriminan → FAIL; no compilan en base → REVIEW).
     El test-writer nunca recibe los valores reales de la corrida.
  3. **RED-LINES:** toda línea que el commit RED del spec añadió a un archivo declarado
     sobrevive idéntica en HEAD (multiconjunto). `seal-cli supersede` rechaza paths que
     estén en `specs[].test_paths` del propio spec salvo `--shared-with-red` explícito (con
     la convención `[ClaseTesteada]Tests.cs` el RED cae a menudo en archivos existentes).
  4. **RED_ORIG fijo** (`red_sha_orig` en el sello; `merge-spec` nunca lo reemplaza) y 5.5
     como **allowlist de SHAs sobre todos los globs de test**: cada commit en
     `RED_ORIG..HEAD` que toque tests es un SHA registrado (`supersede`, `adapt`, `red-fix`)
     con `show --stat` ⊆ sus paths. Nunca mover el RED_SHA.
  5. **Árbol limpio:** `git status --porcelain --untracked-files=all -- <test-globs>` vacío
     antes de 5.5, de cada despacho de supersede y del Step 7 (evita "lavar" ediciones sin
     commitear dentro del commit registrado).
  6. **El spec solo cambia en su sección de supersesiones:** script que compara el SPEC_SHA
     viejo y el nuevo normalizando todo salvo esa sección; cualquier otro byte → loop
     completo con re-RED.
  7. **PROTECTED_TESTS:** `rules-resolve` emite los tests nombrados en `verify:` de
     `rules.yml` más los guards de conventions; todo supersede/adapt/retiro que los toque es
     FAIL salvo enmienda declarada de la regla o ADR (va al gate, no al loop). Los archivos
     oráculo (snapshots de contrato) se tratan igual: `git diff LOCK..HEAD --
     <contract_file>` solo puede tocar operationIds declarados por el epic.
  8. **Commits estructurales en fase 1** (compilación/fixture, antes de ADAPT): reglas FAIL
     universales (el conjunto de IDs de test del reporte no cambia, no suben los skips, los
     archivos ⊆ fallidos ∪ declarados, los tests pasan) + una línea `HUNK <id>: OK|REJECT —
     razón` del reviewer por hunk, cuyo conteo verifica `metrics-report`.
  9. **Sello coherente:** `unseal-spec-paths --slug` antes de que el planner edite un spec
     sellado (hoy el hook "Spec Seal" lo deniega y `unseal-spec` no lo libera); `supersede
     --clear` + `merge-spec` de los paths supersedidos tras el commit; 5.5 exige
     `supersede_paths == []`.
  10. **Migraciones:** con `Template: MIGRATION_SPEC_TEMPLATE.md`, J9 acepta `AC-n | GAP-nnn`;
      los characterization tests (bajo CHARACTERIZATION_SHA) quedan fuera de este loop y de
      ADAPT salvo que el spec declare el GAP; sus fallos siguen la ruta de modernize.
  11. **Salidas no humanas:** una duda semántica del loop vuelve al implementer como
      regresión por defecto y se registra como deuda; 5.5 solo muestra al usuario
      violaciones sobre tests del propio spec.
- *Efecto:* cada loop cuesta un overhead fijo de 12–25 min + 3,1–7,5 tests/min del
  test-writer, sin contacto humano; desaparece el revert que nadie hacía. **En la fase 1
  sube el número de loops en ejecución y bajan los minutos y los contactos** (§6).

**F1-11 — Métricas que permitan decidir con datos.** *(S/M)*
- *Dónde:* `hooks/lib/metrics-report.js` (+ tests), línea de métricas del coordinador,
  `skills/knowledge/SKILL.md` (stats), EPIC_LOOP Step 6 (conservar el primer
  REJECTED_MINOR como `review-<epic>-<spec>-pN-<fecha>.md` en vez de sobrescribirlo).
- *Mecanismo:* timestamps ISO **con hora y zona** en MECH_CHECK, VEREDICTOS, SCOPE_FREEZE y
  respuestas (hoy solo fecha: los minutos no se pueden calcular). Campos aditivos:
  `gate_rounds`, `gate_human_contacts`, `exec_human_contacts`, `gate_wall_min`,
  `gate_human_min`, `gate_compute_min{planner,validator,coordinator}`, despachos
  separados gate/loop (etiqueta `— loop`), `supersede_loops`, `supersede_tests`,
  `semantic_spec_amendments`, `tests_retired`, `late_findings`,
  `obs_routed{…}`, `planner_redispatch_after_approved` (debe ser 0),
  `coordinator_dispatch_payload_kb`, `effort` por agente, `epics_zero_contact`,
  `batch_unattended_completion`.

**F1-12 — Probes de release con defectos plantados.** *(M)*
- *Dónde:* `scripts/baseline-fixture.js --stage 4` (nuevo: fixture con defectos plantados,
  incluido un stack compilado para el caso de ensamblado compartido), checklist en
  `docs/release-process.md`, disciplina de `skills/write-skill`.
- *Casos* (3 corridas cada uno, en medium y en high si medium falla; condicionan el
  release): contradicción con un ADR Accepted (clon de ADR-020) → BLOCKER 3/3; AC contra AC
  → BLOCKER; lista de supersesiones incompleta → APPROVED + `sup-candidato` y 0 lecturas
  fuera de lo entregado; APPROVED con observación de alcance → Diferidos, sin pregunta ni
  re-pase; respuesta del usuario que contradice un ADR → detectada antes de P2 (probe del
  coordinador); nivel proyecto: capacidad sin operación y RN sin epic → BLOCKER; ejecución:
  ensamblado de tests que no compila → BLOCKED con la lista completa y 0 ediciones de
  tests; supersede sobre un archivo RED propio → FAIL; edición sin commitear o archivo sin
  rastrear → FAIL; Moq relajado en una línea anclada → REVIEW; RED_SHA movido → FAIL;
  retiro de un test de regla → FAIL; null-guard agregado por un mock Loose → REVIEW del
  reviewer. Las corridas son manuales hasta que exista harness.

**F1-13 — Presupuesto de contexto del coordinador.** *(S/M)*
- *Dónde:* `skills/build/SKILL.md` (Execution Model, pasos 1-5, "Why this model").
- *Mecanismo:* planner y validador se despachan **por path** (el validador conserva `Read`),
  con PRIOR y DIFF escritos en `.specture/state/gate/<epic>/`; el coordinador nunca pega en
  el prompt el texto de los specs ni de `_planning.md`. Regla de checkpoint: tras procesar
  cada reporte el estado de la cola queda en disco y, pasado un umbral de contexto, la
  cola continúa en una sesión fresca de forma declarada. Corregir las afirmaciones
  "O(n_epics)" que hoy no se cumplen (ya había 307k de contexto antes del primer barrido).

**F1-14 — Autonomía de tanda, versión barata.** *(S)*
- *Dónde:* `skills/build/SKILL.md` ("How many epics to run", queue loop, Step 8.5).
- *Mecanismo:* (1) con N>1, al armar la cola, **una sola** pregunta de delegación D9
  acotada a la tanda ("si hay dudas usá la recomendada"), que **excluye** contrato, legal,
  dinero y modelo de datos — ya es compatible con D19 porque se dice antes de arrancar; (2)
  notificación (PushNotification donde exista) cuando una pregunta queda pendiente; (3) el
  prompt de Step 8.5 agrupado al drenar la cola. En HC-3/4 el usuario eligió la recomendada
  6/6 y la espera de una sola pregunta nocturna costó 146 y 300 min.

### Fase 2 — v2.3.0

**F2-01 — Modo ADAPT del tdd-test-writer + `honesty-check.js`.** *(M/L)* Las clases
compilación y preparación de F1-09 van a UN despacho ADAPT por spec (Sonnet, ciego a la
implementación; recibe la lista, los errores, las líneas Modifica/Elimina y los archivos),
que commitea `test(adapt): <epic>/<slug> — N tests`. `honesty-check.js --red --commit
--before --after --compiler --spec` emite `HONESTY: PASS | REVIEW n | FAIL`. FAIL por
hechos universales (conjunto de IDs de test del reporte, skips, archivos ⊆ fallidos, tests
que pasan, RED-LINES). REVIEW para todo hunk no anclado a una línea del compilador (con
`-U0`), todo hunk de un fallo en runtime, todo cambio en una línea de aserción, datos
parametrizados o invocación del SUT, y todo literal, lambda o predicado quitado de una
línea anclada. Las tablas de patrones son **por librería declarada** en conventions (en
Psikora: xUnit + FluentAssertions + Moq), no por framework de `stack.yml`; si falta la
tabla de alguna librería, todo hunk es REVIEW. Desenlace **RETIRE** (reporta, nunca edita;
va a F1-10 con J9 semántico; métrica `tests_retired`). Snapshots y golden files nunca van a
ADAPT. Máximo 2 rondas ADAPT por spec. *Efecto HC-5:* ≈230 roturas estructurales en 3 lotes,
≈50–100 min de máquina frente a ≈90–150 en la fase 1.

**F2-02 — Un despacho SPEC_GATE por ronda con checklist binario J1–J9 (cierra A6).** *(M)*
Todos los specs + secciones del planner + manifiesto + CODE_SURFACE + RULES_RESOLVED en un
despacho. J1 ADR / regla BLOCKER / patrones prohibidos · J2 contrato · J3 stack · J4 BR
infiel a su RN o caso que la RN decide y falta · J5 AC/BR/EC imposibles a la vez · J6 AC no
observable · J7 dueño del Fuera de Scope · J8 la cita no decide la duda · J9 supersesión
declarada inválida. J4/J5 salen como BLOCKER solo cuando los probes los calibran (0 falsos
BLOCKER en distractores). Justificación del cierre de A6 con n<10: en HC-5 la división 5a/5b
produjo exactamente el patrón "el set aprueba la consistencia y el spec rechaza la
completitud"; aun así, `metrics-report.js` y la fila A6 de `docs/framework-roadmap.md` se
actualizan y la decisión se revisa con `knowledge stats`.

**F2-03 — Code Surface persistida y C8m.** *(S)* La tabla del pre-flight se escribe en
`.specture/state/code-surface/<epic>.tsv` (gitignored); C8m verifica en 4a que cada
`Llama a:` esté en la tabla con firma idéntica normalizada y que la Superficie respete su
gramática.

**F2-04 — C5 medido en bytes y crecimiento después del congelamiento.** *(S)* Por spec:
IDs ≤15, núcleo (Objetivo…EC + Guards) ≤20 KB, total ≤40 KB (calibrables). Una sola
aceptación registrada; un crecimiento >25 % después de SCOPE_FREEZE es FAIL (solo puede
venir de alcance nuevo, que vuelve a Diferidos).

**F2-05 — Decisiones de modelo y legales antes del gate.** *(S/M)* Campo opcional
`**Decisiones pendientes:**` en el ROADMAP; un epic con el campo no vacío no se bloquea
`[/]` y se enruta a `discover --decision <tema>` (sesión socrática acotada que escribe la
RN en su sitio o un ADR). Incluye un **barrido de los epics `[ ]` existentes** (alternativas
abiertas "X o Y", "p. ej.", prefijos de RN legales) que propone una sola sesión antes de la
tanda — relevante porque Psikora tiene 21 epics pendientes, casi todos legales o
regulatorios. En HC-5 habría sacado del gate las ≈2 h del rediseño de habeas data.

**F2-06 — Sesión única de decisiones por tanda.** *(M)* Con N>1, antes del primer epic, el
coordinador corre **en secuencia** el planner en `MODE: QUESTIONS` de cada epic (solo
lectura; devuelve partición y OPEN_QUESTIONS con derivadas, premisas y `depende de:
<epic>`); una sola sentada cubre la tanda dentro del presupuesto de cada epic; cada gate
hace después un `WRITE` fresco que re-verifica premisas. En HC-3+4 (misma sesión) habría
eliminado la espera de 300 min de HC-4.

**F2-07 — Carril para refactors de esquema brownfield.** *(S)* `Tipo: esquema` declarativo
en el ROADMAP (sin umbrales, solo selecciona política: F2-01 activo, C5 en bytes estricto);
`new-feature` recomienda **expand/contract** (añadir → migrar → retirar) cuando su análisis
de impacto declara cambios de forma de datos sobre entidades con tests sellados.

### Fase 3 — condicionada a métricas

**F3-01 — `impact-hint` previo al RED, solo WARNING.** Para cada símbolo Modifica/Elimina,
cuenta en los globs de test las líneas de aserción que lo nombran y emite
`IMPACT_HINT: <símbolo> · N aserciones · M tests` para que el planner declare supersesiones
de comportamiento antes del RED. Nunca BLOCKER. Se activa si `knowledge stats` muestra más de
1 loop semántico por spec; disponible desde ya para epics de rediseño de comportamiento.

**F3-02 — Registro de supersesiones generado.** El planner escribe solo `Supersede:`; las
filas `sup:` y SUPERSESIONES las genera el coordinador desde los commits; el hash de
MECH_CHECK deja de cubrirlas. Requiere migración mecánica `2.4-supersession-register` para
epics `[/]`. Posiblemente innecesario tras F1-01 + F2-01.

## 6. Replay honesto de HC-IHCE.5

Supuestos centrales (con rangos por componente, no fijos): P1 en medium 27–36 min; ronda 1
humana 63 / ≈100 / ≈116 min (el valor observado fue 106: el rediseño de habeas data es
inherente); ronda 2 10 / 13 / 30 min; P2 fresco 17–28 min; superficie complementaria tras
el rediseño 0–15; 4a con micro-pase 1–9; validación final 6–8; 50 % de probabilidad de un
BLOCKER tardío (ADR-020 no detectado en la sentada, o J4/J5). Ejecución: loops de F1-10 en
capas (compilación y runtime), 5–6 loops. "Actual" = sello proyectado del gate v2.1.0 más la
ejecución que igual habría pagado (aplicar antes del RED las 217 supersesiones declaradas +
1–2 loops residuales). Entre paréntesis, la variante en que el usuario trae Wompi con
"inclúyelo" (su preferencia revelada).

**Usuario presente:**

| Escenario | Sello (fase 1) | Loops de ejecución (fase 1) | Gate + loops (fase 1) | Actual | Neto |
|---|---|---|---|---|---|
| Optimista | t+142 (165) | 72 (83) | 214 (248) | 479 | −265 (−231) |
| Central | t+216 (251) | 144 (162) | 360 (413) | 519 | −159 (−106) |
| Pesimista razonable | t+327 (378) | 223 (248) | 550 (626) | 635 | −85 (−9) |

**Usuario ausente** (patrón real de HC-1/3/4: 146–432 min por espera):

| Espera por contacto | 1 espera (ronda 2 en la misma sentada) | 2 esperas |
|---|---|---|
| 146 min | t+262 | t+395 |
| 300 min | t+416 | t+549 |
| 432 min | t+548 | t+681 |

Lectura:
- **La dirección se sostiene en todos los escenarios emparejados;** la magnitud central es
  ≈15–20 % del lock→[x] con el usuario presente, no el ≈60 % que sugiere comparar solo
  hasta el sello. El cruce peor (fase 1 pesimista con Wompi frente al actual optimista)
  sería +147 min.
- El ahorro de cómputo (≈100–125 min) no depende de la presencia; el de espera sí. **La
  ventaja relativa crece con la ausencia** (de 14 contactos a ≤2 rondas: cada uno vale
  146–432 min de noche), pero el reloj absoluto de un epic con decisiones legales lanzado de
  noche lo sigue dominando la espera. Para eso están F1-14, F2-05 y F2-06.
- Contactos humanos en ejecución: 0 / 0–1 / 1–2 (no garantizado 0).
- La fase 2 (ADAPT) baja los loops de ejecución a ≈50–100 min.

HC-IHCE.3/.4 (que ya convergían): el cómputo del gate baja ≈27 min entre ambos; los loops de
ejecución pasan de ≈207 a ≈150–170 min (fase 1), ≈140–155 (fase 2); con F2-06 desaparece la
espera nocturna de 300 min de HC-4. HC3-L3 no era "producción en el Act": era un borrado en
el Arrange que exige **retiro** (RETIRE en F2-01).

## 7. Calidad: qué se sigue atrapando antes de ejecutar y qué pasa a ejecución

**Se sigue atrapando antes de ejecutar, con igual o mayor fiabilidad:** contradicciones con
ADR Accepted, reglas BLOCKER y patrones prohibidos (la clase de ADR-020, el único BLOCKER de
contenido del día — ahora con el validador enfocado en eso sobre un corpus ≈50 % más chico,
más el contraste de respuestas en la sentada); divergencias con contrato y stack;
infidelidad BR↔RN y contradicciones internas (J4/J5, que hoy quedaban como observación);
cobertura C1/C2/C4/C6/C-path/C-sup; y, nuevo por script, existencia literal de citas, IDs,
congelamiento de alcance y tamaño. Las supersesiones de comportamiento conocidas se
declaran antes del RED y conservan su RED.

**Pasa a ejecución, y es aceptable:** (1) adaptaciones estructurales — el gate acertó el
30 % y en HC-5 seguía fallando en ambos sentidos tras 8 pases, mientras el runner dio 65/65;
(2) fallos que solo aparecen en runtime (FK/constraints contra fixtures), que ningún gate
estático ve; (3) WARNING no contractuales, que viajan como GATE_NOTES en vez de perderse (en
HC-3 una NOTE perdida anticipaba un loop entero).

**Honestidad TDD.** Hoy hay 0 controles mecánicos por test. Con F1-09/F1-10 y sus
salvaguardas: el implementer nunca toca tests; todo cambio a un test existente va en un
commit tipificado con SHA registrado; 5.5 es una allowlist de SHAs sobre todos los globs con
RED_ORIG fijo; RED-LINES protege las líneas del RED propio; el RED retroactivo en base
exige que una supersesión semántica discrimine; PROTECTED_TESTS protege guards y tests de
reglas; árbol limpio antes de cada verificación. **Riesgo residual aceptado a sabiendas:**
una reescritura semántica descubierta después de GREEN pierde su RED original; queda
acotada por el RED retroactivo en base, el J9 semántico con dato, el test-writer ciego y la
Dim 4 del reviewer. Sin las salvaguardas 1–8 de F1-10, la fase 1 sería **más débil** que
v2.1.0: no se publica sin ellas.

## 8. Respuesta directa a "que ejecute sin pedirme acciones"

**El conjunto irreducible de contactos humanos** es: decisiones de negocio que ninguna
fuente responde (legales, de modelo de datos, de contrato), la aprobación visual del design
system, y la única escalada cerrada del tope. Todo lo demás debe correr sin ti.

**Ruta a 0 contactos:**
- **Epics sin decisiones legales/modelo/contrato** (la mayoría de features): delegación D9
  ofrecida una vez al armar la cola (F1-14) + presupuesto único (F1-04) + APROBADO avanza
  (F1-03) + supersesiones en ejecución sin contacto (F1-09/F1-10) → la tanda drena sola.
- **Epics con decisiones legales o de modelo** (HC-IHCE.9–.16, .24): esas decisiones salen
  **antes** de la tanda en una sola sesión deliberada (F2-05 `discover --decision`, F2-06
  sesión de tanda). Mientras tanto, a mano: revisar los bloques de epic buscando "X o Y" y
  decisiones legales, y correr un `discover` acotado de ese tema antes de construir.
- **Qué quedas haciendo:** una sentada al principio (≈15 min + lo que dure una decisión de
  modelo real) y, si no vas a estar, dejar dicho antes de arrancar "para toda esta tanda, si
  hay dudas usá la recomendada" (no autoriza contrato ni arquitectura).

Métricas de autonomía (F1-11): `epics_zero_contact_rate` y `batch_unattended_completion`
(tandas N≥2 que drenan sin intervención).

## 9. Qué hacer HOY en Psikora (sin tocar el framework)

Estado real verificado (solo lectura): rama `feature/hc-ihce-esquema-y-nucleo`, HEAD
`023ff5d6` (lock `[/]` de HC-IHCE.5); los 3 specs y `_planning.md` en staging; sin
commitear, las decisiones del día en `business_requirements.md` (RN-AGE-012, RN-CONSENT-020,
RN-PAQ-008, RN-PAGO-009, RN-PAC-007 aclarada), `ROADMAP.md`, la adenda de ADR-025 y el slot
de conventions §2; `.specture/state/` vacío (no hay sello stale). La ronda 3 terminó: **set-6
APPROVED, 02 d3 APPROVED, 03 d3 REJECTED** con un único BLOCKER — una supersesión de
comportamiento conocida (`EvaluarAbandonoDiarioJobDesregistroIntegrationTests::
Startup_OtherFiveRecurringJobs_…` afirma `HaveCount(5)` mientras AC-11 agrega 3 jobs). Esos
tres veredictos **solo existen en la transcripción**; 01 d2 sigue vigente (texto sin cambios).

Secuencia segura:

0. **No reanudar la sesión `2d6bf64c`** (tiene una notificación encolada y permisos en auto;
   nunca dos escritores sobre el mismo checkout).
1. **Respaldo sin tocar la historia:** `git diff > <scratch>/unstaged.patch` y
   `git diff --cached > <scratch>/staged.patch`; copiar del scratchpad viejo las superficies
   (`surface-*.txt`), `contract-slice-hc5.json` y `rules_resolved_hc5.txt`.
2. **Guardar en disco la ronda 3:** agregar a `_planning.md` § VEREDICTOS, verbatim
   (extraídos por script de los subagentes de la transcripción, no parafraseados), "set —
   dispatch 6", "02 — dispatch 3" y "03 — dispatch 3", con el `git hash-object` de cada spec;
   luego `git add docs/05-specs/hc-ihce-5-…/`.
3. **Commitear las decisiones sin arrastrar los specs no validados:**
   `git commit --only -- .specture/conventions.md .specture/decisions/025-… docs/01-requirements/business_requirements.md docs/04-roadmap/ROADMAP.md`
   (o incluirlas explícitamente en el commit del plan). **Nunca** `git commit` sin rutas
   mientras haya specs en staging; **nunca** `git stash`.
4. **Instrucciones temporales en el `CLAUDE.md` de Psikora** (texto abajo) y, con tu OK,
   enmendar la memoria de Psikora `psikora-supersesiones-barrido-por-simbolo.md`, escrita a
   las 22:10 UTC, que ordena lo contrario (exigir destino para cada fila antes del planner):
   marcarla "SUPERSEDIDA 2026-09-27 por la regla (a) del CLAUDE.md".
5. **Sesión nueva en esfuerzo medium**, `/specture:start`, reutilizando la rama actual
   (**no** crear rama nueva desde develop por W-1: HC-3/4 no están en develop). Reanudar
   "desde la validación, solo el spec 03": set-6, 01 d2 y 02 d3 siguen vigentes. No volver a
   preguntar C5.
6. **Un solo contacto, con recomendación:** (i) declarar **ahora, antes del sello**, la
   supersesión conocida del conteo de jobs en el spec 03 y los helpers `SembrarPadreAsync`,
   `ColumnasHijaParaFilaAsync` y `DefaultColumnsFor` en el spec 02 (recomendado: es de
   comportamiento y hoy no hay sello, así conserva su RED y evita que v2.1.0 aborte en el
   spec 03 porque 02 y 03 supersedean el mismo archivo `IntegridadReferencialTenant…`); (ii)
   RN-PAQ-008 frente a AC-7: recomendado "mientras la compra exista, responde su estado"
   (igual que AC-12 y el handler actual), aclarando la RN en su sitio.
7. Planner fresco con `ALCANCE=[02,03]` y solo esas filas → 4a (corrida 9) → delta de set,
   02 y 03 con el criterio explícito.
8. `spec-set-check --hash-only` igual al último MECH_CHECK → commit del plan → VEREDICTOS y
   SPEC_SHA → `seal-cli write` → verificar `build-locked.json`.
9. **Prompt del epic-agent con overrides explícitos tuyos** (reglas (i)–(k) abajo).

**Texto sugerido para el `CLAUDE.md` de Psikora** (temporal; retirar al actualizar a
Specture v2.2.0):

> **Spec Planning Gate — instrucciones temporales del usuario (retirar al instalar Specture v2.2.0).**
> (a) La completitud de la lista de supersesiones NO es criterio de rechazo del gate. Una
> supersesión estructural (el test deja de compilar o su fixture queda inválido) no
> declarada se resuelve en ejecución, en lote por spec. Una supersesión de comportamiento
> ya conocida (una aserción que un BR del spec vuelve falsa) sí se declara antes del sello.
> (b) El validador no lee tests/ ni src/ ni escribe scripts: juzga diseño, ADR, contrato y
> negocio. El coordinador no le entrega rutas de tests, tablas de uso en tests ni scripts.
> (c) Las re-validaciones son delta: tras cada pase registrá
> `git write-tree --prefix=docs/05-specs/<epic>/` en el encabezado del veredicto y entregá
> al validador su veredicto previo, `git diff <tree_prev> <tree>` y el diff de
> business_requirements y ADRs del mismo intervalo. El validador marca cada hallazgo previo
> ADDRESSED / NOT ADDRESSED / RETIRADO (RETIRADO = la regla (a) lo sacó del gate) y solo abre
> BLOCKER nuevos sobre texto cambiado o por violación de ADR o contrato. Copiá (a)–(c) en
> cada despacho del validador.
> (d) Los WARNING y NOTES de un veredicto APPROVED no generan re-pase ni preguntas: forma o
> trazabilidad → notas para el epic-agent; alcance fuera del bloque del epic → deuda
> declarada en el ROADMAP con su epic dueño. **Excepto:** una duda de contrato observable,
> o un EC o guard de dinero, legal o datos dentro de las operaciones de este epic, se me
> consulta una vez con opción recomendada y nunca se difiere.
> (e) Después de mis respuestas el alcance queda congelado, salvo que yo diga "inclúyelo".
> (f) El planner se despacha siempre fresco, nunca por SendMessage.
> (g) No me preguntes lo que el código responde. Las opciones de mis preguntas son las del
> planner, tal cual. Un slot `sin definir` de conventions §2 se pregunta, pero dentro de la
> misma ronda que las demás preguntas, nunca suelto después.
> (h) Máximo 2 rondas de preguntas por epic, de cualquier origen. No cuentan la pregunta de
> reanudación ni una única escalada cerrada con recomendada al llegar al tope. HC-IHCE.5 ya
> agotó sus rondas.
> (i) Ejecución: si tras el primer build del implementer los proyectos de test no compilan
> por tests de epics cerrados, el implementer se detiene sin tocarlos y reporta BLOCKED con
> el log completo del compilador. Tras GREEN se corre la suite completa y todos los tests de
> epics cerrados que fallen se reportan en UN solo BLOCKED por spec, separando
> compilación/preparación de aserción y de excepción lanzada desde producción (estas dos van
> primero al implementer como posible regresión). Re-corré 2 veces un fallo aislado antes de
> clasificarlo (flakes conocidos).
> (j) Loop "solo supersesiones": sin git revert del RED ni unseal-spec. Antes de que el
> planner edite el spec, re-escribí el sello sin ese spec en `--spec-paths`; después del
> commit, `seal-cli write` con los 3 specs y el SPEC_SHA nuevo. Cada commit
> `test(supersede)` posterior al RED se registra por SHA en `_planning.md`, y 3b, 5.5 y la
> Dim 4 del reviewer lo aceptan solo si su SHA está registrado y su `git show --stat` ⊆ las
> rutas declaradas. Nunca muevas el RED_SHA. Nunca edites specs por Bash para esquivar el
> hook. Nunca modifiques líneas que el commit RED del propio spec añadió. El árbol de tests
> debe estar limpio (`git status --porcelain`) antes de 5.5.
> (k) Un Supersede declarado cuyo test compila y sigue verde se reporta "sin cambio": no se
> edita, no cuenta en el tally RED y no entra en `--test-paths` (aplica a las 13 sobrantes
> del spec 01 de HC-IHCE.5). La regla EPIC_LOOP "abort si el path supersedido está en los
> test_paths de un hermano" no aplica a `IntegridadReferencialTenantIntegrationTests.cs`
> (archivo de HC-IHCE.3, cerrado) si 02 y 03 lo supersedean en ciclos distintos.

**Para las próximas tandas (HC-IHCE.6 en adelante):** si no vas a estar, deja dicha la
delegación D9 antes de arrancar (excluye contrato, legal, dinero y modelo); si vas a estar,
quédate los primeros ≈15 min para la ronda 1. Antes de construir, revisa los bloques de
epic buscando alternativas abiertas y decisiones legales o de modelo, y corre primero un
`discover` acotado de esos temas. No pongas estas reglas en conventions §13: build solo lee
§13 para ramas W-*.

## 10. Métricas de éxito (se miden por separado: cómputo, contactos y espera)

- **Cómputo del gate fuera de la espera humana** ≤60–80 min en un epic tipo HC-5 (base ≈206).
- **Rondas humanas por epic** ≤2 + ≤1 excepción (base 14 contactos); espera humana
  reportada aparte. `planner_redispatch_after_approved = 0` en 5 epics seguidos.
- **Rechazos del gate por supersesiones = 0**; rondas de validación ≤3; escaladas por tope
  = 0 en 5 epics (base 3/4 y 2).
- **Validador** ≤15 min en camino crítico por epic y 0 herramientas fuera de Read/Glob (base
  52 min, 12–55 Bash, 18 scripts).
- **Corpus del gate** ≤200 KB en un epic de esquema brownfield; núcleo de comportamiento
  ≥30 % (base 422 KB y 13,8 %).
- **Ejecución:** 1 loop por causa raíz y por capa; `semantic_spec_amendments` ≤0,4 por spec
  (base 0,67); `supersession_only_loops` reportados aparte con sus minutos y 0 contactos;
  0 reverts del RED.
- **Honestidad TDD:** 0 violaciones no detectadas en los probes; en fase 2 hunks REVIEW
  ≤25 % de los adaptados y 0 `test(adapt)` con FAIL aceptados.
- **Validador en medium:** ADR plantado 3/3; 0 BLOCKER sobre distractores.
- **Autonomía:** `epics_zero_contact_rate` creciente en epics sin decisiones legales/modelo;
  `batch_unattended_completion` en tandas N≥2.
- **Guarda para features** (259 specs may–jul): cómputo y contactos del gate ≤ la base de
  HC-3/4 y 0 reverts de epic. Validar con un replay sobre un CONSENT-REDISENO.

## 11. Migración y compatibilidad

- **Fase 1:** sin cambio de gramática de specs (`Supersede:`, `sup:`, SUPERSESIONES quedan
  iguales; SPEC_TEMPLATE no se toca salvo la lista "qué NO escribir"). PLANNING_TEMPLATE
  solo recibe líneas opcionales (`derivadas:`, `condicionales:`, `SCOPE_FREEZE:`, sufijo
  `tree` en VEREDICTOS, `Acción del coordinador:`) → `npm run schema:sync`. ROADMAP_TEMPLATE
  recibe `**Diferidos heredados:**` opcional. Los parsers actuales aceptan que falten. Con
  v2.2.0, `doctor` emitirá `schema-version-behind` y sugerirá `migrate`, que solo registra la
  versión: decirlo en el changelog. Nuevo check de doctor (WARNING): epic `[/]` sin APPROVED
  y con BLOCKER de la Dim 4 → "re-validar bajo v2.2". `npm run mirrors:sync` por los cambios
  de cuerpo de agentes.
- **Fase 2:** commit `test(adapt)` y línea `adapt:` opcional en SUPERSESIONES; reanudación
  acepta ambos formatos de veredicto (5a/5b legado y "última ronda APPROVED"); si el reporte
  del runner necesita configurarse, clave opcional `testing.report` en `stack.yml` con
  migración mecánica e idempotente `2.3-test-report` (sin reporte estructurado,
  `honesty-check` degrada a UNVERIFIABLE y todo va a REVIEW).
- **Fase 3:** `2.4-supersession-register` para epics `[/]`; los cerrados no se tocan.

## 12. Documentación para el usuario final (parte del Definition of Done de cada fase)

1. **Entrada en README `## Changelog`** (la única fuente de notas de release según
   `docs/release-process.md`) en lenguaje de usuario: qué cambia en lo que se te pregunta,
   qué deja de pasar, qué aparece nuevo en el historial (`test(supersede)` después del RED,
   `test(adapt)`), qué hace `doctor migrate`.
2. **Corregir afirmaciones que dejan de ser ciertas:** README (sección build — "un epic bien
   descubierto corre hasta [x] sin una sola interrupción", delegación, "el validador corre
   dos veces por epic"), diagramas de `docs/execution-flows.md` (5a/5b, "test falla 2× →
   debug"), `docs/native-integration-guide.md` §3.2 (supersede después del RED, `test(adapt)`).
3. **Guía nueva "Cómo funciona el Spec Planning Gate"**: cuándo y cuánto te preguntará; qué
   nunca te preguntará; Diferidos y cómo traer algo con "inclúyelo"; congelamiento de
   alcance; el menú del tope y por qué nunca se sella un BLOCKER sin tu decisión.
4. **"Cuando fallan tests de epics anteriores"**: capas de compilación y runtime, clases de
   fallo, loop ligero sin revert, salvaguardas, cómo auditar a mano con `git log
   RED_ORIG..HEAD -- <tests>`; desde la fase 2, cómo leer HONESTY y los hunks REVIEW.
5. **"Correr una tanda sin estar presente"**: la delegación D9 (frase exacta, alcance, qué no
   autoriza), la notificación, y desde la fase 2 la sesión única de decisiones.
6. **"Reanudar un epic atascado en el gate"**: paso a paso con HC-IHCE.5 anonimizado.
7. **Plataformas** (`docs/copilot-cli-plugin.md`, `docs/antigravity-cli-plugin.md`): `effort` y
   `tools` no viajan; fijar el esfuerzo de sesión en medium; brecha de `search` en Copilot.
8. **Modernize:** nota sobre characterization tests fuera de ADAPT y del loop ligero.
9. **`knowledge stats`:** métricas nuevas y sus reglas de lectura.
10. **FAQ:** ¿por qué el plan ya no enumera todas las supersesiones? ¿se debilita el TDD?
    ¿qué hago si no estoy de acuerdo con un diferido?
11. **Retiro de overrides temporales:** cómo quitar el bloque del `CLAUDE.md` al instalar
    v2.2.0 (y que `doctor check` avise si lo detecta).
12. **Para mantenedores:** addendum de decisiones en `docs/spec-planning-gate-design.md`,
    milestone nuevo y cierre de A6 en `docs/framework-roadmap.md`, probes F1-12 en
    `docs/release-process.md`.
13. **Mensajes en el flujo:** al arrancar el gate, una línea con el presupuesto de preguntas;
    el resumen del paso 6 lista Diferidos y GATE_NOTES.

## 13. Decisiones abiertas (solo tú puedes tomarlas)

| # | Decisión | Opciones | Recomendada |
|---|---|---|---|
| 1 | Rescate de HC-IHCE.5 | (a) hoy, con §9; (b) esperar a v2.2.0; (c) descartar y re-planificar | **(a)** — los specs sirven; set-6, 01 y 02 ya están aprobados |
| 2 | Supersesión conocida del spec 03 y helpers del 02 | (a) declararlas ahora, antes del sello; (b) re-juzgar 03 con RETIRADO y resolver en ejecución | **(a)** — es de comportamiento y conserva su RED |
| 3 | Esfuerzo del validador | medium · high · heredar la sesión | **medium**, condicionado a los probes; si fallan, high |
| 4 | Salida del tope | (a) menú cerrado por clase; (b) sellar con riesgo declarado automático | **(a)** — mantiene "sellado = validado" |
| 5 | Alcance nuevo tras tus respuestas | (a) diferir por defecto, lo traes con "inclúyelo"; (b) preguntarte cada vez | **(a)**, con la excepción de EC de dinero/legal/datos del propio epic |
| 6 | Supersesiones semánticas descubiertas tras GREEN | (a) aceptarlas con RED retroactivo en base + J9 con dato; (b) exigir detección previa al RED ya | **(a)** en fases 1–2; F3-01 si stats lo pide |
| 7 | Delegación de tanda | (a) ofrecerla una vez al armar la cola (fase 1); (b) solo la manual de hoy | **(a)**, excluyendo contrato, legal, dinero y modelo |
| 8 | Partir HC-IHCE.5 (70 IDs, specs de 46/86/60 KB) | (a) no partir; (b) partir en sub-epics | **(a)** — re-planificar cuesta más que ejecutar; para los próximos refactors de esquema, F2-04 + expand/contract |
| 9 | Registro triple de supersesiones | (a) simplificar ya; (b) medir primero | **(b)** — tras F1-01 y F2-01 puede no hacer falta |

## 14. Ideas descartadas (y por qué)

- **Un tercer agente "experto en specs" en el bucle** (H3 literal): la forma ya era uniforme;
  añade otra fuente de variación sin atacar la causa dominante.
- **Sellar con un BLOCKER conocido por defecto al llegar al tope:** rompe "sellado =
  validado", del que dependen la reanudación y el test-writer.
- **Que un script o el coordinador degrade los BLOCKER del validador:** viola la
  independencia; HC-5 se rescata con una re-validación bajo el criterio nuevo.
- **Decisiones provisionales activas por defecto / modo desatendido persistido:** rompe
  "NO THIRD STATE" e introduce contrato y dinero como provisionales. La delegación D9 ya
  cubre el caso, acotada.
- **DSL de políticas de supersesión con sello v4, ya:** migración asistida y parser dual
  para un problema que F1-01 + F2-01 reducen a pocas líneas.
- **Heurísticas por lenguaje como BLOCKER:** contradicen el agnosticismo de stack; sus falsos
  positivos crearían bucles nuevos. Solo REVIEW o WARNING.
- **Hook que inspeccione contenido para hacer append-only los tests:** costoso, frágil entre
  plataformas y deniega ediciones legítimas del RED; la garantía va por SHA registrado y
  scripts en 5.5.
- **Build de sondeo del "cambio ingenuo" en el gate:** exige escribir producción antes del
  RED; la ejecución da el mismo dato exacto y barato.
- **Planificación spec a spec (JIT) con etapa de contrato de epic separada:** costo L en 3
  releases y convierte contradicciones entre hermanos en reaperturas posteriores al RED.
- **Sonnet en el validador para ahorrar tiempo:** mismo throughput medido (≈0 min).
- **Planner en high o heredando xhigh; maxTurns en el validador:** sin respaldo en los datos;
  maxTurns podría cortar validaciones de architecture/ROADMAP.
- **Seguir reanudando el planner por SendMessage:** 941k de contexto, compactación y
  handbacks gigantes.
- **Premisas verificadas por el coordinador como fuente citable:** repite el sesgo de M7.
- **Frenar al validador solo con prosa:** ya existía la regla y hubo 18 scripts y 27
  lecturas de tests en un despacho; hace falta `tools:`.

## 15. Riesgos

- La ejecución descubre por capas; un epic de esquema puede necesitar 2 loops por spec en la
  fase 1. Mitigación: un lote por capa y por causa raíz; ADAPT en fase 2.
- El validador en medium podría dejar pasar un hueco de diseño que xhigh vio (ADR-020). No hay
  A/B propio. Mitigación: probes que condicionan el release y fallback a high.
- La clasificación de fallos depende del reporte del runner; mitigación: solo puede subir el
  escrutinio y la honestidad la decide el oráculo de base, no la clase.
- `honesty-check` puede inflar la cuota de REVIEW en epics con >200 adaptaciones. Mitigación:
  el reviewer recibe resumen + hunks REVIEW y de runtime.
- Los Diferidos pueden olvidarse o no gustarte. Mitigación: registro con gramática y dueño,
  resumen del paso 6, `knowledge stats`, "inclúyelo".
- El coordinador sigue siendo un LLM y puede saltarse la tabla de destinos. Mitigación:
  C-freeze mecánico, métrica `planner_redispatch_after_approved`, probe específico.
- La delta con LATE limitado puede dejar pasar un J4 latente en texto no tocado. Mitigación:
  primera ronda exhaustiva; si aparece en ejecución es un `BLOCKED: spec` de minutos.
- Portabilidad: `effort` y `tools` no llegan a Copilot/Antigravity; allí la palanca de H1 se
  pierde, las demás son portables.
- Con el usuario ausente, el reloj absoluto sigue dominado por la espera; la solución de
  fondo es sacar las decisiones antes de la tanda (F2-05/F2-06).

## Anexo — Fuentes y método

- Transcripciones de Claude Code de Psikora (`~/.claude/projects/C--Proyectos-Psikora/`):
  sesión coordinadora y 17 subagentes de HC-IHCE.5; sesión y ≈40 subagentes de HC-IHCE.3/.4.
  Tiempos por segundo con prioridad usuario > coordinador > planner > validador; minutos de
  agentes reanudados descontando el tiempo parado entre reanudaciones.
- `git` de Psikora (solo lectura): commits de lock, plan, supersede, red-fix, [x]; tamaños de
  specs por época (394 specs); `_planning.md` de HC-IHCE.1/.3/.4/.5;
  `docs/.specture-meta/build-metrics.jsonl` (sus contadores tienen errores de ±1–2 y mezclan
  gate y loop — ver F1-11).
- Documentación oficial de Claude Code (subagentes: `effort`, `tools`, herencia de modelo).
- Práctica externa: GitHub spec-kit (`/analyze`, `/specify` con máx. 3 iteraciones, `/clarify`
  con máx. 5 preguntas), BMAD (validate-next-story, una pasada), Kiro (preguntas binarias,
  SMT), Superpowers (revisor subagente retirado por no mejorar calidad; re-review con
  alcance; circuit breaker), Cloudflare AI code review, Google SWE Book cap. 22 (cambios a
  gran escala: el oráculo descubre el impacto, se aprueba una política), Feathers "lean on the
  compiler", Mikado, Fowler Parallel Change, Huang 2024 / Kamoi 2024 / Tyen 2024
  (autocorrección de LLM sin verdad de terreno), CheckEval (checklists binarios).
- Relacionados: `docs/spec-planning-gate-design.md` (D1–D21), `docs/spec-planning-gate-review.md`,
  `docs/psikora-scale-review.md` (N1–N10), `docs/framework-roadmap.md` (A6, M6),
  `docs/tdd-honesty-reference.md`.
