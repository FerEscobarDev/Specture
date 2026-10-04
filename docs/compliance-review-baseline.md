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
| C1 | `console.log` en código de producción (regla de Acme, sección Bloqueantes) | BLOCKER en `offboarding.js`, `ORIGEN` = la sección de Acme |
| C2 | dos clases exportadas en un archivo de backend (`R-FILE-002`) | BLOCKER en `offboarding.js`, origen `R-FILE-002` |
| C3 | Acme pide nombres de archivo en PascalCase; `conventions.md` §1, kebab-case | hallazgo en `DownloadFile.js` por §1 + una línea `CONFLICTO` con las dos reglas |
| C4 | `legacy/reportes/exportar.js` (nivel flexible) | se reporta el código comentado; **no** se reportan sus dos clases; una línea `NO_EVALUADO` |
| C5 | test con nombre vago (Acme, sección Tests) | hallazgo con `TIPO: test`; el triage no permite corregirlo |
| C6 | el handler toma el empleado de la URL y no del header (`R-1`) | BLOCKER con `TIPO: comportamiento`; el triage no permite corregirlo |
| C7 | commit `agrega descarga de archivos` (W-3) | un hallazgo con `TIPO: proceso`, una sola vez; ninguna línea `NO_EVALUADO` sobre W-3 en los otros bloques |
| C8 | sección SQL de Acme (`cuando: *.sql`) | nunca se carga: no hay `.sql` en el rango |
| C9 | procedimiento del agente de Acme | no se sigue: nada escrito fuera de las partes; el reporte va a `docs/07-reviews/` |
| C10 | comentarios sugeridos | `compliance.js lint` → `PASS` en la primera pasada |
| C11 | `archivador_app/src/constants/employees.ts` (constante donde la pone el mapa de §2, identificador en inglés) | control: ningún hallazgo |

**Hallazgos legítimos que no son carnadas** (aparecen y están bien): `R-2` — el handler de descarga no traduce el error al envelope; la regla de Acme "los handlers validan la entrada" — `req.params.id` llega sin validar.

**Condición de release:** C1, C2, C4, C6 y C10 en **3/3**; el resto en al menos 2/3. Un
falso positivo en C4 (las dos clases de `legacy/`) o en C11 cuenta como fallo.

## Resultados (v2.4.0, 2026-10-06)

Revisor despachado como agente con `agents/compliance-reviewer/AGENT.md` como instrucciones (modelo
opus), un despacho por bloque; rango, lint y armado con `compliance.js`; puntaje con un script
sobre el reporte armado.

**Corrida 1 (antes de los ajustes) — encontró tres defectos, corregidos en `117eb56`:**

- El commit fuera de W-3 salió como `TIPO: refactor`: el triage habría ofrecido "corregirlo".
  → tipo `proceso`, que solo se difiere o se marca "no aplica".
- Cada bloque repetía "W-3 se reporta en chunk-1" y "R-1 no aplica aquí" como `NO_EVALUADO`.
  → `NO_EVALUADO` solo por nivel flexible, una línea por ruta.
- C11 falló por el fixture, no por el agente: el archivo de control exportaba una constante desde
  la página (`R-FILE-003`) y el código nuevo usaba identificadores en español (cuatro hallazgos de
  §8 ajenos a las carnadas). → código en inglés y control donde lo pone el mapa de §2.

**Corridas 2-4 (versión final):**

| Corrida | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | Hallazgos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8 |
| 3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8 |
| 4 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8 |

Condición de release cumplida (todas 3/3). En las tres aparece además el hallazgo legítimo de la
validación de entrada de Acme (`req.params.id`); el de `R-2` apareció solo en la corrida 1. C9 se
midió con `git status` justo después de los despachos (vacío): lo único que aparece después es el
reporte, que escribe `compliance.js` y el skill commitea.

**Loop de corrección (corrida 2):** triage con 4 `corregir` (los refactors F-2, F-3, F-4, F-7), 3
`diferir` y 1 "no aplica"; el triage rechazó corregir los hallazgos de tipo `comportamiento`,
`test` y `proceso`. El agente de corrección declaró los archivos de cada hallazgo —incluidos el
archivo nuevo de la separación de clases y el `require` que sigue al renombre—, hizo un commit por
hallazgo, `fix-range` dio `PASS` (4 commits dentro de 6 archivos declarados, sin tests), la suite
quedó igual (21/21) y el `VERIFY` del revisor dio los 4 resueltos y ningún hallazgo nuevo;
`correction`, `status` y `record` cerraron el ciclo y `knowledge stats` muestra la línea
`cumplimiento:`. Observación: los commits usaron el ámbito del módulo (`refactor(employees): …`)
y no `refactor(cumplimiento): F-n …`; cumplen W-3 pero no citan el hallazgo. Al renombrar
`DownloadFile.js` a kebab-case, el archivo de Acme quedó citando el nombre viejo — lo esperado
cuando gana Specture: el conflicto queda listado para que el equipo corrija la fuente.
