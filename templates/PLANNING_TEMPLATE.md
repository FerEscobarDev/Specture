# Planning — <epic-slug>

> Evidencia en disco del Spec Planning Gate para UN epic (trackeado). **Propiedad partida:**
> el `spec-planner` escribe `COVERAGE_TABLE`, `OPEN_QUESTIONS`, `RESOLVED_ALONE` y
> `SUPERSESIONES`; el coordinador de `build` agrega las respuestas, `CODE_SURFACE`,
> `MECH_CHECK`, `VEREDICTOS`, `GATE_NOTES`, `DIFERIDOS` y `SPEC_SHA`; el epic-agent agrega
> `BASELINE_FALLOS` y completa el `commit:` de las supersesiones de su spec. Escritores
> secuenciales, nunca concurrentes. `hooks/lib/spec-set-check.js` lee `COVERAGE_TABLE`
> (machine-readable: una fila por línea, gramática exacta); `hooks/lib/metrics-report.js`
> lee los contadores y `hooks/lib/honesty-check.js` el registro de `SUPERSESIONES`.

## COVERAGE_TABLE
- op: <operationId> → <task-slug> (implementa | consume)
- br: <RN-nnn> → <task-slug> [BR-n]                 (specs de migración sin sección BR: [AC-n])
- sym: <símbolo> — crea: <task-slug> — firma: `<firma exacta>` — consume: [<task-slug>, ...]
- oos: <ítem Fuera de Scope> → cubierto por: <task-slug> | diferido a: <Epic X.Y | fuera del epic>
- gap: <GAP-nnn> → <task-slug>                      (solo epics de migración)
- sup: <path>::<test> → <task-slug> (BR-n | AC-n | GAP-nnn)   (solo si el spec declara `Supersede:`)

## OPEN_QUESTIONS
- Q-1 — afecta: <AC-n | BR-n | EC-n | contrato.<celda> | fuera-de-scope>
  pregunta: <cerrada>
  opciones: [A (recomendada), B, C]
  derivadas: A → <sub-decisión que abre | ninguna>; B → …
  fuentes revisadas sin respuesta: [business_requirements RN-nnn, contrato op Y, ...]
  - respuesta: <opción> — fuente: <usuario <fecha> | delegado por el usuario <fecha>> — ronda: <1 | 2 | tope>   (coordinador)

## RESOLVED_ALONE
- R-1 — <decisión> — fuente: <archivo §sección | RN-nnn> — cita: "<frase textual del documento>"

## SUPERSESIONES (omitir si no aplica)
> Una línea por test. Las del gate las escribe el planner con `commit: pendiente`; las del
> loop de ejecución llevan `loop:` y `j9:`. El epic-agent completa `commit:` con el
> `SUPERSEDE_SHA` (o `sin cambio`). `honesty-check range` acepta un commit de tests posterior
> al RED solo si su SHA está aquí con exactamente esos paths.
- <path>::<test> — motivo: <BR-n | AC-n | GAP-nnn> — spec: <task-slug> — commit: <pendiente | <SUPERSEDE_SHA> | sin cambio> [— loop: compilación | runtime] [— j9: SÍ] [— acción: reescribir | retirar]
- red-fix: <path> — spec: <task-slug> — commit: <sha>

## CODE_SURFACE (coordinador)
- roots: [<carpeta raíz>, ...] · símbolos: N · método: subagent(<model>) | grep | vacío · <fecha>

## MECH_CHECK (coordinador — una línea por corrida; la última es la vigente)
- MECH_CHECK: PASS <sha12> — <ISO-8601> — corrida N (<primera pasada | ANSWERS Q-n | VIOLATIONS>)

## VISUAL_APPROVAL (coordinador — sólo epics de design system; una línea por aprobación)
> La escribe el coordinador cuando el usuario aprueba el showcase, en el mismo commit que el
> `[x]` del epic. Es el único registro durable del gate visual: sin ella, los epics de página
> no arrancan. Nunca la escribe el epic-agent.
- VISUAL_APPROVAL: <sha12> — <ISO-8601> — rondas: N — ruta: <ruta del showcase>

## VEREDICTOS (coordinador — verbatim)
> Una ronda = los despachos lanzados juntos tras un pase del planner. `delta` = re-validación
> con `PRIOR_VERDICT` + DIFF; `loop` = loop de supersesiones de ejecución; `J9` = juicio por
> test. `tree` es `git write-tree --prefix=docs/05-specs/<epic-slug>/` del pase validado.
### set — dispatch 1 — ronda 1 — <ISO-8601 con hora> — tree <sha12> — head <sha12>
```
STATUS: ...
```
### <task-slug> — dispatch 2 — ronda 2 — <ISO-8601 con hora> — tree <sha12> — head <sha12> — delta
```
STATUS: ...
PRIOR:
- PRIOR V-1: ADDRESSED — ...
```

## GATE_NOTES (coordinador — observaciones de veredictos APROBADOS; las reciben implementer, ux-implementer y code-reviewer)
- <task-slug | set>: <texto verbatim> — origen: dispatch <N> — para: implementer | reviewer | ambos

## DIFERIDOS (coordinador — alcance fuera del epic, con dueño)
- <ítem> — origen: dispatch <N> — dueño: Epic <X.Y> | deuda <ID>

## BASELINE_FALLOS (epic-agent — fallos previos al primer RED; excluidos de toda clasificación)
- <path>::<test> — <primera línea del fallo> — <ISO-8601>

## SPEC_SHA (coordinador)
- LOCK_SHA: <sha> — <ISO-8601>
- SPEC_SHA: <sha> — <fecha> — <primer sello | corrección de <task-slug> | loop <capa> de <task-slug>>
