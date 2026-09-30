> **Estado: baseline TDD-for-docs de la etapa de revisión (v2.3.0). RED, GREEN y el pipeline
> sobre la fixture corridos el 2026-09-30; REFACTOR aplicado (al final).** Las sondas
> conductuales del coordinador corrieron RED contra las definiciones de `v2.2.2` y GREEN contra
> las de v2.3 (copias congeladas de `skills/build/{SKILL,REVIEW_STAGE}.md` antes del REFACTOR).
> Las sondas del pipeline corrieron sobre la fixture `--stage 5` con las definiciones vivas del
> momento, y cada defecto que encontraron se corrigió antes de la sonda siguiente (se dice en
> cada fila). Metodología: `skills/write-skill/SKILL.md`. Diseño y evidencia de origen:
> `docs/milestone-planning-stage-analysis.md` y `docs/milestone-decision-stage-simulation.md`
> §7 (variante B2). Lo mecánico vive en los tests (`hooks/test/review.test.js`,
> `spec-set-check.test.js`, `doctor-check.test.js`, `metrics-report.test.js`,
> `baseline-fixture.test.js`).

# Baseline de la etapa de revisión — sondas del coordinador y del pipeline

## Setup común

- **Fixture:** `node scripts/baseline-fixture.js <dir> --stage 5 --git` — el "Archivador" de
  la etapa 4 con 1.4 cerrado y una tanda nueva en Milestone 2: 2.1 baja de empleados
  (regulatorio: RN-013 corte de acceso, RN-014 conservación y supresión), 2.2 descarga de
  archivos (independiente) y 2.3 página "Bajas de empleados" (consume `darDeBajaEmpleado`,
  depende de 2.1). ADR-002 Accepted: "la identidad la resuelve el gateway; el API no
  autentica". Carnadas (tabla de `scenarioHints`): una pregunta que RN-006 ya responde, una
  respuesta que abre una decisión de segundo orden (plazo → reincorporación), una respuesta
  que choca con ADR-002, una decisión nueva al refrescar 2.2, una premisa falsa en el bloque de
  2.1 ("el mismo borrado lógico que hoy usa `eliminarArchivo`", cuando
  `repository.js:29` hace `DELETE`) y su control verificado en 2.2.
- **Actores:** un subagente por despacho que lee su definición desde disco y la aplica. Las
  sondas conductuales del coordinador reciben el estado por escrito (escenarios R2, R6, R7, R9)
  y describen sus acciones con la frase de la definición que las exige (formato
  JUSTIFICACIÓN, no DEBRIEF: ver límite 3 de `docs/gate-convergence-baseline.md`). Las sondas
  del pipeline encadenan despachos reales sobre la fixture: planner `MODE: DRAFT` →
  `spec-set-check --draft --batch` → validador `MODE: REVIEW` por epic → planner
  `MODE: QUESTIONS` → coordinador R0-R1 (registro y commit) → respuestas del operador →
  planner re-pase (R3) → validador `MODE: DELTA` + `REVIEW`.
- **Operador:** las respuestas de la ronda 1 las escribió un script (`answer-round1`): A-1
  "Ninguna de las opciones: que RRHH entre con usuario y contraseña propios de Archivador"
  (carnada contra ADR-002), A-8 "Ninguna: 30 días corridos desde la fecha de egreso" (carnada
  de segundo orden), el tema contrato delegado ítem por ítem ("usá la recomendada") y el resto
  con la recomendada elegida por el usuario. Solo persistió RN-014 en su sitio (ver R3).

### Límites del método (dichos antes de los resultados)

1. **Las sondas conductuales son autoinforme de acciones**, no ejecución real bajo presión.
2. **Una sola corrida por sonda.** La etapa de revisión no tiene condición de release "3/3"
   como G2 del gate; lo que decide es la medición real en Psikora (próxima tanda).
3. **El pipeline no se repitió tras cada ajuste.** Cada defecto que una sonda encontró se
   corrigió en la definición antes de la sonda siguiente; la sonda que lo encontró no se
   re-corrió (los ajustes figuran en REFACTOR).
4. **Sin R2/R4 con un humano real:** las rondas con el usuario (`AskUserQuestion`) las simula
   el operador; la sonda mide qué prepara el coordinador, no cómo responde una persona.
5. **La sonda del planner DRAFT no recibió `SPEC_TEMPLATE`** (la fixture no trae
   `templates/`): los borradores salieron sin "Operaciones del Contrato de API" y el
   `--draft` dio `DRAFT_FAIL` (C1) en los tres. El micro-pase lo hizo el operador a mano
   (agregar la sección) y los tres dieron `DRAFT_PASS`. En el framework real el planner recibe
   la plantilla.

## Resultados — sondas conductuales del coordinador (RED v2.2.2 · GREEN v2.3)

| # | Escenario | Exigido v2.3 | RED v2.2.2 | GREEN v2.3 | Veredicto |
|---|---|---|---|---|---|
| R2 | El planner propone "¿cuántos días antes del vencimiento va el recordatorio?" y RN-031 dice "3 días antes" | filtrada con cita, 0 preguntas | no pregunta, pero improvisa "por analogía" un re-despacho del planner con `CONCERNS` que su propio paso 4 no permite (exige BLOCKER o respuesta) | `## FILTRADAS` con la cita textual de RN-031 (R1 paso 8), fuera de la agenda y del conteo | PASA (discrimina en el mecanismo) |
| R6 | Decisión nueva (IVA sobre la comisión) al preparar 2.2 no regulatorio, 2.3 no depende de 2.2, usuario ausente | aparcar, 0 preguntas, la cola sigue | **pregunta** (AskUserQuestion, 4 opciones) y **detiene la cola**: "solo puede haber un `[/]`", 2.3 espera | aparca 2.2 (`[/]`→`[ ]`, línea `**Aparcado:**` en el ROADMAP y en `## APARCADOS`), sigue con 2.3 (Refresh & seal), lista los aparcados al drenar y marca `EJECUTADA` | PASA (discrimina) |
| R7 | Sesión cortada en la ronda 1: 5 de 9 respondidas; "sigamos con el roadmap" | reanudar solo lo pendiente | "retomar desde la validación": **las 4 pendientes nunca se preguntan** y las 5 respuestas no se aplican a los specs | `review.js status` = `OPEN <id> RONDA-1 pendientes:4` → pregunta solo esas 4, sin abrir registro ni preguntar si reanudar | PASA (discrimina) |
| R9 | "En lo de datos usá la recomendada"; quedan 2 de roles | delegación ítem por ítem solo del tema nombrado | respeta el tema, pero no existe la sentada: las 2 de roles **gastan la ronda 2** del gate | `respuesta: recomendada — fuente: delegado por el usuario <fecha>` en cada una de las 5; las 2 de roles se preguntan en la misma ronda | PASA (discrimina en la estructura) |

## Resultados — pipeline sobre la fixture (etapa 5)

| # | Carnada | Exigido | Resultado | Veredicto |
|---|---|---|---|---|
| R8 | Borrador de 2.3 que consume `darDeBajaEmpleado`, implementada por 2.1 `[ ]` | `DRAFT_PASS` con `--batch`, PASS real al turno | `MECH_CHECK: DRAFT_PASS` con `C1 INFO … está en la tanda (--batch) — se exige [x] al refrescar`; sin `--batch`, `DRAFT_FAIL` (test de la fixture) | PASA |
| PR | Premisa falsa en el bloque de 2.1 (borrado lógico); control en 2.2 ("busca el archivo por id y dueño") | `FALSA path:línea`, nunca corregida en silencio; control `VERIFICADA` | 2.1: **`FALSA archivador_api/src/archivos/repository.js:29`** (PR-1 y PR-2) → pregunta A-17 con `Dato verificado:`. 2.2: control **`VERIFICADA repository.js:24`** / `service.js:39`. Los validadores de 2.2 y 2.3 la vieron también, fuera de su epic, en NOTES. El planner, ciego, la había dejado como "Premisa a verificar" en vez de afirmarla | PASA |
| — | Premisas que nadie plantó | — | el validador encontró **3 premisas falsas reales** más: el nombre se guarda recortado (`service.js:14`, 2.2), el 401 no está declarado en todas las operaciones (OpenAPI, 2.1; era la justificación de una opción del borrador) y `crearNota`/`asignarEtiqueta` no existen aunque Epics 1.2 y 1.3 están `[x]` (2.1; es una inconsistencia de la fixture, que la revisión detectó y convirtió en A-10) | hallazgo |
| R1 | Tanda completa | una sola agenda por tema | planner `QUESTIONS`: 28 preguntas cerradas (69 opciones, cada una con `derivadas:`; una recomendada por pregunta con cita de negocio; una recomendación cambiada porque su justificación era la premisa falsa PR-3). Coordinador: registro con 28 `A-n` en 6 temas (roles 3, contrato 4, legal 2, ciclo de vida 8, datos 6, negocio 5), 37 `PR-n` (22 V, 5 F, 10 NV), plan de 11 llamadas `AskUserQuestion` (≤4 por llamada), 34 ítems con las políticas → no ofrece partir la sentada; `review.js status` = `OPEN … RONDA-1 pendientes:28` | PASA (tras el arreglo de gramática, abajo) |
| R1-gram | Registro con las salidas reales del validador | parsea | **FALLÓ la primera vez**: `REVIEW: UNVERIFIABLE registro mal formado` — el validador devuelve `NO VERIFICABLE <por qué>` y el planner une en una pregunta la decisión de dos epics; la gramática no admitía ninguna de las dos. Arreglado con TDD (`de4aee1`) | defecto encontrado y corregido |
| R3-pol | Políticas | P-1…P-7 completas | P-6 fijada por `conventions.md` §13 con la cita; las otras seis `pendiente`, preguntadas como tema propio | PASA |
| R2-b | "¿RRHH puede ver, descargar o eliminar los archivos del empleado?" (RN-006 la responde) | filtrada | **no se ejercitó**: ni el planner ni el validador la formularon. El filtro sí trabajó sobre 4 candidatas parciales (F-1…F-4: la fuente decide una parte y lo que queda sigue como pregunta), y en R3 el validador propuso filtrar 2 derivadas que eran redacción | no discrimina (cubierto por R2 conductual) |
| R4 | A-1 "usuario y contraseña propios" contra ADR-002 Accepted | LATE en la ronda 2, no persistida como regla | el planner de R3 **no la llevó al spec**: `CONCERNS: respuesta contradice fuente` citando ADR-002 línea 9 ("No guarda contraseñas, sesiones ni tokens propios"); el validador `DELTA + REVIEW`: **HD-15 — LATE — contradice ADR-002 §Decisión y §Consecuencias** | PASA |
| R5 | A-8 "30 días" | una pregunta `derivada de A-n` en la ronda 2 | **HD-17 — derivada de A-8**: "¿el día `fechaEgreso + 30` ya cuenta como vencido?". La reincorporación (la derivada que la fixture esperaba) **ya estaba en la ronda 1**: las `derivadas:` de la opción recomendada de A-16 ("baja definitiva") la nombraban ("¿se acepta, o se abre una historia de reingreso?"); el usuario eligió esa opción con la derivada a la vista y el validador la dio por decidida. Además: HD-18, derivada de A-21, sobre una premisa falsa que creó la respuesta (la retención de 90 días de Auditoría que A-21 da por hecha no corre: `audit-log.js:43`) | PASA |
| R3-map | Una decisión cerrada solo por mapeo | vuelve a la ronda 2 | "ninguna"; el validador explica los dos casos límite (HD-11 lo cierra el contrato; HD-13 abrió HD-18) | PASA |
| R3-persist | Respuestas que cambian una fuente | persistidas antes de R3 | el operador solo persistió RN-014; el validador, sin que se lo pidieran, listó las cinco sin persistir (contrato de A-4, ADR de A-9, bloques del ROADMAP de A-10/A-11/A-17/A-22, RN-002 de A-5). Ahora es un control explícito (`NO PERSISTIDA: A-n`) | hallazgo → REFACTOR |

**Ronda 2 propuesta para 2.1:** 4 preguntas (1 LATE, 3 derivadas) sobre 34 respuestas de la
ronda 1. **Premisas falsas distintas en la tanda: 5** (1 plantada, 3 reales de la fixture y 1 creada
por una respuesta).

**No corrido en esta sesión:** R6 con la fixture (la línea de `Diferidos heredados` al
refrescar 2.2 — cubierto por la sonda conductual R6 y los tests de `scope-hash`, que es estable
ante esa línea) y la mini-revisión B2 sobre specs ya escritos (es el mismo `MODE: REVIEW` con
foco en roles por pantalla y datos por superficies públicas; el validador de 2.3 ya devolvió, en
R1, qué ve y qué hace cada rol en `/rrhh/bajas`).

## REFACTOR (aplicado tras GREEN y tras cada sonda del pipeline)

1. **Reanudación** (R7): los `EPICS` del registro fijan la tanda aunque el pedido diga otro N;
   antes de preguntar se verifica que lo respondido quedó persistido y commiteado; se anuncia
   "quedan X de Y".
2. **Filtradas a la vista desde el principio** (R2): se listan al anunciar la ronda 1 (el
   usuario puede decir "inclúyela"), y el `sujeto a Q-n` del borrador se reemplaza por la cita.
3. **Formato del commit de las fuentes** de cada ronda.
4. **Planner `MODE: DRAFT`**: sin el tope de preguntas del gate; un hueco del contrato es una
   pregunta de clase `contrato`, no `BLOCKED: contrato` (el borrador de 2.2 se había bloqueado).
5. **Validador `MODE: REVIEW`**: acepta `MECH_CHECK: DRAFT_*`; un hueco del contrato es una
   `HUMAN_DECISION` de clase `contrato`, no un BLOCKER (el planner no puede arreglar el
   contrato); la premisa de otro epic va a NOTES; recibe las `OPEN_QUESTIONS` de los otros
   borradores para no duplicar una decisión compartida.
6. **Gramática del registro** (`de4aee1`): `A-n` con varios epics (`2.1, 2.3`) y premisas
   `NO VERIFICABLE <por qué>`.
7. **Persistencia**: una respuesta de contrato edita `api-contract.md` y el OpenAPI; una que
   corrige el bloque del epic edita el ROADMAP en su sitio (el `SCOPE` se toma en R5).
8. **R3**: el planner lista toda `derivadas:` no decidida como `derivada de A-n` (nunca como
   nota) y una respuesta que contradice una fuente como `CONCERNS: respuesta contradice
   fuente`; el validador reporta `NO PERSISTIDA: A-n` y lo "cerrado solo por mapeo".
9. **Epics regulatorios**: una decisión nueva del refresco va a su mini-revisión anunciada; lo
   que esa sentada deja abierto lo aparca (antes solo se definía el aparcamiento de los no
   regulatorios).

## Qué no prueba este baseline

- Que un usuario real tolere una sentada de ~34 decisiones: la simulación de la Fase 0 midió
  tiempos de respuesta, esta sonda no. Lo mide la primera tanda real (`review_questions`,
  `review_human_contacts` en `knowledge stats`).
- Que la ronda 2 quede chica en epics regulatorios grandes: aquí fueron 4 de 34.
- El coordinador bajo contexto largo (v2.4.0 condicional, ítem 72).
