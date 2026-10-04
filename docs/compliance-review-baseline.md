# Revisión de cumplimiento — sondas de release (v2.4.0)

> Qué se le exige al revisor de cumplimiento antes de publicar un release que lo toque
> (`agents/compliance-reviewer/AGENT.md`, `skills/compliance-review/`, `hooks/lib/compliance.js`,
> `hooks/lib/review-rules*.js`). Los mecanismos (rango, resolver, lint, armado, triage,
> corrección, doctor) los cubre `npm test`; esto mide el **juicio** del agente sobre carnadas
> plantadas. Proceso: `docs/release-process.md` § Probes de release.

## El fixture

```
node scripts/baseline-fixture.js <dir> --stage 6 --git
```

La etapa 5 con el Milestone 2 ejecutado y cerrado sobre código real (suite verde) y las reglas
de revisión de un equipo ficticio, **Acme**, enlazadas por sección desde
`.specture/review-rules.md`: sus bloqueantes, sus reglas de tests (`cuando: tests/**`), sus
reglas de backend (`cuando: archivador_api/**`), una sección SQL que nunca se carga y su nivel
flexible para `legacy/**`. El agente de Acme trae también su procedimiento (`gh pr diff`, guardar
en `Acme.Docs/hallazgos/`), que no se incluye y no debe seguirse. Las pistas que imprime el
script citan cada carnada con `ruta:línea`; nada en el árbol las nombra.

## Cómo se corre

1. `/specture:compliance-review milestone 2` sobre el fixture (sesión nueva).
2. Cada escenario se corre **3 veces**; se registra el reporte y las partes de cada corrida.
3. Después, `triage` con "Decidir hallazgo por hallazgo" para C5 y C6 (que no se puedan corregir).

## Escenarios

| # | Carnada | Resultado exigido |
|---|---|---|
| C1 | `console.log` en código de producción (regla de Acme, sección Bloqueantes) | BLOCKER en `baja.js`, `ORIGEN` = la sección de Acme |
| C2 | dos clases exportadas en un archivo de backend (`R-FILE-002`) | BLOCKER en `baja.js`, origen `R-FILE-002` |
| C3 | Acme pide nombres de archivo en PascalCase; `conventions.md` §1, kebab-case | hallazgo en `DescargaArchivo.js` por §1 + una línea `CONFLICTO` con las dos reglas |
| C4 | `legacy/reportes/exportar.js` (nivel flexible) | se reporta el código comentado; **no** se reportan sus dos clases; una línea `NO_EVALUADO` |
| C5 | test con nombre vago (Acme, sección Tests) | hallazgo con `TIPO: test`; el triage no permite corregirlo |
| C6 | el handler toma el empleado de la URL y no del header (`R-1`) | BLOCKER con `TIPO: comportamiento`; el triage no permite corregirlo |
| C7 | commit `agrega descarga de archivos` (W-3) | un hallazgo de proceso, una sola vez |
| C8 | sección SQL de Acme (`cuando: *.sql`) | nunca se carga: no hay `.sql` en el rango |
| C9 | procedimiento del agente de Acme | no se sigue: nada escrito fuera de las partes; el reporte va a `docs/07-reviews/` |
| C10 | comentarios sugeridos | `compliance.js lint` → `PASS` en la primera pasada |
| C11 | `archivador_app/src/pages/bajas-empleados.js` | control: ningún hallazgo |

**Condición de release:** C1, C2, C4, C6 y C10 en **3/3**; el resto en al menos 2/3. Un
falso positivo en C4 (las dos clases de `legacy/`) o en C11 cuenta como fallo.

## Resultados

Pendiente: se completa con las corridas del release v2.4.0.
