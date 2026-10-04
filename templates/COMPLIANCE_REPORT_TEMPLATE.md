# Revisión de cumplimiento — gramáticas

> Archivo del framework (desde v2.4.0). Documenta las dos gramáticas de la revisión de
> cumplimiento. La autoridad es el parser de `hooks/lib/compliance.js` (`parsePart`,
> `parseReport`); este archivo es su referencia legible. Nadie edita el reporte a mano:
> lo arma `compliance.js assemble` y lo completan `triage` y `correction`.

## 1. Parte — la escribe el agente `compliance-reviewer`, una por bloque

Ruta: `.specture/state/compliance/<id>/part-<chunk-id>.md` (estado local, ignorado por git).
Una clave por línea, sin valores de varias líneas. Las líneas en blanco no cuentan.

```
PARTE: chunk-1
RESUMEN: <1-2 frases sobre lo que hace el código de este bloque>
BIEN: <algo concreto que está bien>                    (0..n)
HALLAZGO
SEV: BLOCKER | IMPORTANT | NIT
TIPO: refactor | comportamiento | test | proceso
TITULO: <título corto>
UBICACION: <ruta>:<línea>
SIMBOLO: <ruta>::<símbolo>                             (o "-")
FRAGMENTO: <una línea del código tal como está>
ORIGEN: <ID de regla · archivo § encabezado · conventions.md §n · ADR-nnn>
POR_QUE: <qué pasa y por qué importa, en lenguaje claro>
COMENTARIO: <comentario sugerido para quien escribió el código>
FIN
GENERAL: <comentario general sugerido, no atado a una línea>      (0..n)
CONFLICTO: <regla del equipo> ⟂ <regla de Specture> — <cuál se aplicó>   (0..n)
NO_EVALUADO: <ruta flexible> — nivel flexible: <familias de reglas omitidas>   (0..n)
```

- `TIPO` decide qué se puede corregir en el triage: solo `refactor` (no cambia el
  comportamiento). `comportamiento` necesita un spec; `test` lo cambia quien escribe los tests;
  `proceso` (un `W-*`: mensaje de commit, nombre de rama) no se corrige con código.
- `NO_EVALUADO` es solo para lo que el nivel flexible hizo omitir — no para una regla que no
  aplica al bloque ni para las reglas de proceso, que se reportan una vez en `chunk-1`.
- `COMENTARIO` y `GENERAL` se entienden **sin documentos internos**: nunca un ID de regla, un
  ADR, un archivo de configuración del framework, `§` ni la ruta de un archivo incluido.
  `compliance.js lint` los rechaza. Se permiten términos de código.
- `ORIGEN` sí cita la fuente: es para quien hace el triage, no para el autor del código.

## 2. Reporte — lo arma `compliance.js assemble`

Ruta: `docs/07-reviews/cumplimiento-milestone-<N>-<YYYY-MM-DD>[-pK].md`.

```
# Revisión de cumplimiento — <título del milestone>

**Fecha:** YYYY-MM-DD
**Revisor:** compliance-reviewer (agente) · armado por compliance.js
**Milestone:** <N>
**Rango:** milestone-<N>-<fecha>
**HEAD:** <sha>

## Veredicto

**STATUS: APPROVED | REJECTED_MINOR | REJECTED_MAJOR | BLOCKED**
**TRIAGE:** PENDIENTE | HECHO <fecha> | NO REQUERIDO
**Hallazgos:** BLOCKER n · IMPORTANT n · NIT n

## Resumen
## Lo que está bien
## Hallazgos
### F-1 [BLOCKER] <título>
- **Ubicación:** `<ruta>:<línea>` @<sha> · `<ruta>::<símbolo>`
- **Fragmento:** `<línea>`
- **Tipo:** refactor
- **Origen:** <fuente>
- **Por qué:** <explicación>
- **Comentario sugerido:** <comentario>
## Comentarios generales sugeridos
## Reglas en conflicto
## Alcance y nivel flexible
## TRIAGE
- F-1 — corregir | diferir | no aplica[ — <motivo>]
## DIFERIDOS
- F-n — <título> — dueño: sin epic[ — <motivo>]
## CORRECCIÓN
- F-n — corregido — <sha> | no corregido — <motivo>
```

STATUS: cualquier BLOCKER → `REJECTED_MAJOR`; solo IMPORTANT → `REJECTED_MINOR`; NIT o nada →
`APPROVED`; `BLOCKED` cuando el rango o las partes no fueron confiables (`compliance.js stub`).
