# Planning — <epic-slug>

> Evidencia en disco del Spec Planning Gate para UN epic (trackeado). **Propiedad partida:**
> el `spec-planner` escribe `COVERAGE_TABLE`, `OPEN_QUESTIONS`, `RESOLVED_ALONE` y
> `SUPERSESIONES`; el coordinador de `build` agrega las respuestas, `CODE_SURFACE`,
> `MECH_CHECK`, `VEREDICTOS` y `SPEC_SHA`. Escritores secuenciales, nunca concurrentes.
> `hooks/lib/spec-set-check.js` lee `COVERAGE_TABLE` (machine-readable: una fila por línea,
> gramática exacta) y `hooks/lib/metrics-report.js` lee los contadores.

## COVERAGE_TABLE
- op: <operationId> → <task-slug> (implementa | consume)
- br: <RN-nnn> → <task-slug> [BR-n]
- sym: <símbolo> — crea: <task-slug> — firma: `<firma exacta>` — consume: [<task-slug>, ...]
- oos: <ítem Fuera de Scope> → cubierto por: <task-slug> | diferido a: <Epic X.Y | fuera del epic>
- gap: <GAP-nnn> → <task-slug>                      (solo epics de migración)
- sup: <path>::<test> → <task-slug> (BR-n)          (solo si el spec declara `Supersede:`)

## OPEN_QUESTIONS
- Q-1 — afecta: <AC-n | BR-n | EC-n | contrato.<celda> | fuera-de-scope>
  pregunta: <cerrada>
  opciones: [A (recomendada), B, C]
  fuentes revisadas sin respuesta: [business_requirements RN-nnn, contrato op Y, ...]
  - respuesta: <opción> — fuente: <usuario <fecha> | delegado por el usuario <fecha>>   (coordinador)

## RESOLVED_ALONE
- R-1 — <decisión> — fuente: <archivo §sección | RN-nnn> — cita: "<frase textual del documento>"

## SUPERSESIONES (omitir si no aplica)
- <path>::<test> — motivo: BR-n — spec: <task-slug> — commit: pendiente | <SUPERSEDE_SHA>

## CODE_SURFACE (coordinador)
- roots: [<carpeta raíz>, ...] · símbolos: N · método: subagent(<model>) | grep | vacío · <fecha>

## MECH_CHECK (coordinador — una línea por corrida; la última es la vigente)
- MECH_CHECK: PASS <sha12> — <ISO-8601> — corrida N (<primera pasada | ANSWERS Q-n | VIOLATIONS>)

## VEREDICTOS (coordinador — verbatim)
### set — dispatch 1 — <fecha>
```
STATUS: ...
```
### <task-slug> — dispatch 1 — <fecha>
```
STATUS: ...
```

## SPEC_SHA (coordinador)
- SPEC_SHA: <sha> — <fecha> — <primer sello | corrección de <task-slug>>
