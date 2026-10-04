> **Estado: baseline TDD-for-docs del coordinador por epic (v2.7.0). Prueba de anidamiento,
> RED y GREEN corridos el 2026-10-04; REFACTOR aplicado (`b15a5c5`).** RED contra las
> definiciones de `v2.6.0` (copias congeladas de `skills/build/{SKILL,REVIEW_STAGE}.md`); GREEN
> contra las de v2.7.0 congeladas antes del REFACTOR (`skills/build/{SKILL,EPIC_COORDINATOR,
> REVIEW_STAGE}.md`). Metodología: `skills/write-skill/SKILL.md`. Origen: ítem 72 de
> `docs/framework-roadmap.md` y la medición de la tanda HC-IHCE.9–.11 de Psikora. Lo mecánico
> vive en los tests (`hooks/test/metrics-report.test.js`).

# Baseline del coordinador por epic — anidamiento y sondas de conducta

## La condición que lo disparó (medición real)

Tanda HC-IHCE.9–.11 de Psikora con el plugin 2.3.0, sesión nueva tras `/clear`, tres epics (dos
regulatorios). Contexto del coordinador, medido por turno desde la transcripción (entrada + caché):

| Momento | Contexto |
|---|---|
| Durante la sentada de revisión | 401k |
| Al empezar el epic 1 (.9) | 570k |
| Al empezar el epic 2 (.10) | 687k |
| En medio del epic 2 | 961k → compactación automática |
| Al empezar el epic 3 (.11) | 176k (tras la compactación) |

Condición del ítem 72: "un contexto del coordinador >~400k antes del epic 3" — cumplida en la
primera tanda de tres epics. La compactación no rompió nada visible, pero cada turno releía casi
1M de tokens y, después de compactar, el coordinador gastó ~10 turnos sondeando ("sigo
esperando") mientras corría un review. La misma tanda dio 0 contactos después del sello, y un
corte por límite de uso de la API se retomó bien desde disco.

## Prueba de anidamiento (2026-10-04)

| Variante | Cadena | Resultado |
|---|---|---|
| A — la cadena real | principal → general (L1) → general `model: sonnet` (L2) → `specture:architecture-validator` (L3) | los tres niveles corren; L3 con sus herramientas declaradas (`Read`, `Glob`) |
| B — el límite | principal → general → general → general → … (hasta 5) | L1 y L2 tienen la herramienta Agent; **L3 no** → tres niveles de subagentes bajo el principal |

Coincide con la documentación oficial de Claude Code: profundidad máxima 3 por defecto,
configurable con `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Todo despacho anidado fue
**asíncrono** aunque se pidiera en primer plano: el resultado llega como mensaje. El resumen de
la documentación afirmaba que los subagentes en segundo plano no tienen la herramienta Agent; la
prueba lo contradice (todos corrieron en segundo plano y L1/L2 la tenían) — por eso el
procedimiento no lo supone: lo comprueba al empezar (paso 0 del coordinador del epic y del
epic-agent).

Consecuencia de diseño: principal → coordinador del epic (L1) → epic-agent (L2) → workers (L3).
Cabe justo — ningún worker despacha subagentes. Sin margen, por eso existen las dos salidas:
`NESTING_UNAVAILABLE` (el coordinador del epic sin Agent: el principal corre el mismo archivo en
línea) y `BLOCKED: nesting` (el epic-agent sin Agent: el coordinador del epic corre `EPIC_LOOP`).

## Resultados — sondas de conducta (RED v2.6.0 · GREEN v2.7.0)

Escenarios en el scratchpad de la sesión (`probes/scenarios-v27.md`); formato JUSTIFICACIÓN con
cita textual. C2, C3, C6 y C7 son del rol nuevo: no tienen RED (en v2.6 ese rol no existe).

| # | Escenario | Exigido v2.7 | RED v2.6.0 | GREEN v2.7.0 | Veredicto |
|---|---|---|---|---|---|
| C1 | Principal, tanda de 3 con registro CERRADA | despacha un coordinador del epic, procesa solo el `EPIC_REPORT` | hace él mismo el Refresh & seal (Code Surface, planner REFRESH, 4a, validadores DELTA, commit, sello), despacha el epic-agent y procesa su reporte: todo queda en su contexto | marca `[/]`, despacha el coordinador del epic con `ENTRY: refresh`, espera sin consultar y procesa el `DONE` (git log, sello, tarea) | PASA (discrimina) |
| C2 | Coordinador del epic: `BLOCKED: supersesiones (runtime)` | loop completo sin preguntar y sin volver al principal | — | chequeo del sello, J9, lift-spec, planner SUPERSESSIONS, spec-delta, protected, 4a, commit, re-sello, epic-agent `RESUME_AT: supersede`; devuelve `EPIC_REPORT: DONE` al principal | PASA |
| C3 | Coordinador del epic: mini-revisión con 2 decisiones nuevas | commit sin sellar + `MINI_REVIEW` con las preguntas textuales; no pregunta | — | planner `MODE: QUESTIONS`, commit "pendiente de mini-revisión", `EPIC_REPORT: MINI_REVIEW` sin métricas; ni sella ni aparca ni pregunta | PASA |
| C4 | Principal recibe `MINI_REVIEW` | pregunta (reglas de R2), persiste, re-despacha | pregunta y después hace él mismo el re-refresco (planner REFRESH, 4a, DELTA, commit, sello) y despacha el epic-agent | pregunta por tema sin aplicar la recomendada, persiste en el registro y en la RN, commitea y re-despacha con `ENTRY: mini-review-answers` y `HUMAN_CONTACTS + 1` | PASA (discrimina) |
| C5 | Principal tras un límite de uso: `[/]` con `lifted_spec_paths` | re-despacha con `ENTRY: resume` | retoma él mismo el loop de supersesiones desde su paso 4 — y señala que no sabe de dónde sacar el veredicto J9 tras el corte | despacha `ENTRY: resume`, no toca la edición del planner, no re-planifica ni pregunta | PASA (discrimina) |
| C6 | Coordinador del epic sin herramienta Agent | `NESTING_UNAVAILABLE` sin tocar nada | — | responde de inmediato `NESTING_UNAVAILABLE — sin herramienta Agent` | PASA |
| C7 | Coordinador del epic: `BLOCKED: entorno` | `STOPPED` con el log; no pregunta | — | chequeo del sello, métricas `ESCALATED`, `STOPPED — entorno` con un extracto del log; sin reintentos ni `skills/debug` | PASA |
| C8 | Principal esperando un despacho 20 min | no sondea | espera en pasivo | espera la notificación sin sondear | PASA; **no discrimina** (el sondeo de Psikora apareció bajo presión real, tras una compactación; el escenario escrito no lo reproduce) |

## REFACTOR (aplicado tras GREEN, `b15a5c5`)

1. **Nada se pierde en un corte**: el veredicto J9 y los `FAILURES:` se escriben en
   `## VEREDICTOS` apenas llegan (C5-RED no sabía dónde recuperarlos), y una línea
   `- LOOP: supersesiones | corrección` dice a la reanudación qué loop tenía el spec liberado.
2. **Lectura perezosa** del principal: un epic de registro `CERRADA` no necesita las fuentes en su
   chat (C1-GREEN señaló que "Required Inputs" las pedía igual).
3. **Despacho**: ruta del plugin en el prompt, en segundo plano, sin sondeo; si el usuario
   escribe, se le responde; un despacho que no vuelve se retoma con `ENTRY: resume`.
4. **Commit de bloqueo** solo con `ROADMAP.md`; la línea `LOCK_SHA` la escribe el coordinador del
   epic; `REGULATORIO` sale del registro; `HUMAN_CONTACTS` empieza en 0.
5. **Escalaciones**: cuáles escriben la línea de métricas (las que cierran la corrida) y cuáles no
   (las que esperan una respuesta: `scope-changed`, `gate`, `decisión`, `reanudación`); el sello
   y el `[/]` se quedan; el log va recortado a 10 líneas.
6. **Mini-revisión**: su veredicto se registra; una decisión que el registro ya resuelve es una
   `VIOLATION`, no una pregunta; la numeración `A-n` sigue la del registro, con la marca
   `(aclarado en revisión <id>, <fecha>)`, `DECISIONES PERSISTIDAS` y un commit propio.
7. **Reanudación y N**: un epic reanudado se termina antes de armar la cola y no cuenta para N.

## Qué no prueba este baseline

- Que el principal llegue al epic 3 por debajo de ~400k en una tanda real: la sentada de revisión
  sigue en su chat (401k en la tanda medida) y no se redujo. Lo mide la próxima tanda N≥3
  (`coordinator_mode: subagent` en `knowledge stats`, y el contexto desde la transcripción).
- Que un coordinador del epic bajo presión real no sondee ni pregunte: C8 no discrimina.
- El costo en tokens de la capa extra (un despacho más por epic) frente al ahorro de no releer
  ~1M por turno: no hay cifra de tokens en `build-metrics.jsonl` (`tokens: null`).
