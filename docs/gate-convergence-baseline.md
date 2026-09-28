> **Estado: baseline TDD-for-docs del gate convergente (v2.2.0). RED y GREEN corridos el
> 2026-09-28; REFACTOR aplicado (5 ajustes, al final).** RED contra las definiciones del tag
> `v2.1.0` (copias congeladas de `agents/*/AGENT.md` y `skills/build/{SKILL,EPIC_LOOP}.md`);
> GREEN contra las de la rama `feature/v2.2-desbloqueo` congeladas antes del REFACTOR.
> Metodología: `skills/write-skill/SKILL.md`. Diseño y evidencia de origen:
> `docs/spec-gate-convergence-design.md` (F1-12). El análisis mecánico (E5–E10) vive en los
> tests (`hooks/test/honesty-check.test.js`, `seal-cli.test.js`, `spec-set-check.test.js`,
> `baseline-fixture.test.js`).

# Baseline del gate convergente — sondas de defectos plantados

## Setup común

- **Fixture:** `node scripts/baseline-fixture.js <dir> --stage 4 --git` — el "Archivador" con
  Epic 1.1 cerrado con código y tests reales (`node:test`, agregador `tests/all.test.js`: un
  import roto tumba la suite), Epic 1.4 `[/]` con su RED en HEAD, ADR-001 Accepted ("bytes en
  Postgres, sin filesystem ni S3"), regla R-3 con `verify:` sobre un test sellado, y un
  directorio de epic por carnada (tabla de `scenarioHints` de la etapa 4). Historia de 5
  commits con fechas fijas: LOCK, plan, veredicto y RED reproducibles.
- **Actores:** un subagente por despacho que lee la definición desde disco (v2.1.0 o v2.2) y
  la aplica; las entradas son las del manifiesto de cada rol (spec, stack, conventions, ADR,
  arquitectura, contrato, requisitos, `RULES_RESOLVED`, última línea `MECH_CHECK`). Las sondas
  conductuales (coordinador, epic-agent, implementer) reciben el estado por escrito y
  describen sus acciones con la frase de la definición que las exige.
- **Uso de herramientas:** contado desde la transcripción de cada subagente (no por
  autoinforme). Todas las sondas escribieron su archivo de salida con `Write` porque la sonda
  lo pedía; esa escritura no cuenta.

### Límites del método (dichos antes de los resultados)

1. **Esfuerzo no controlado.** Un subagente despachado con la herramienta Agent hereda el
   esfuerzo de la sesión: `effort: medium` del frontmatter solo actúa cuando el agente corre
   como agente del plugin. Las corridas GREEN prueban la **definición**, no el nivel de
   esfuerzo. La condición de release "G2 3/3 en medium" queda verificada para la definición;
   el efecto de `medium` se mide con datos reales (A.10 en Psikora, `knowledge stats`).
2. **`tools: Read, Glob` no se impone aquí.** Por la misma razón, el frontmatter solo restringe
   herramientas bajo el plugin. Lo que sí se midió es si la definición lleva al validador a
   barrer código o tests: ver G1.
3. **Filtro de la API.** 9 de las 10 primeras sondas conductuales fueron cortadas por un
   filtro de seguridad de la API (`[reasoning_extraction]`) cuando el prompt pedía un
   "DEBRIEF" introspectivo ("qué dudaste y por qué"). Se relanzaron pidiendo una
   JUSTIFICACIÓN con cita textual de la definición; G6 y L1 GREEN habían alcanzado a escribir
   su archivo antes del corte. Ninguna sonda se descartó.
4. **Las sondas conductuales son autoinforme de acciones**, no ejecución: prueban qué exige la
   definición ante el escenario, no que un modelo bajo presión real la cumpla. El criterio de
   éxito real es la medición de A.10 (contactos humanos, rondas, loops).

## Resultados — gate

| # | Carnada | Exigido v2.2 | RED v2.1.0 | GREEN v2.2 | Veredicto |
|---|---|---|---|---|---|
| G1 | `epic-1.5-clave`: lista de supersesiones incompleta (1 de 2 tests que el rename rompe) | APPROVED, a lo sumo `sup-candidato`; sin leer `tests/` ni código | **REJECTED** (1 BLOCKER, Dim 4 sobre el Fuera de Scope) y, en NOTES, "no puedo verificar la supersesión: el despacho no trajo la lista de archivos de test"; declara que con lectura literal de su Dim 4 ("ask for the file list") habría respondido **BLOCKED** | **APPROVED**, 0 violaciones; `sup-candidato: subirArchivo (tests de epic-1.1-archivos que afirman la forma de storage_key)` | PASA |
| G2 | `epic-1.6-dedup`: bytes a disco local contra ADR-001, sin nombrarlo (clon de ADR-020) | BLOCKER 3/3 | REJECTED, 2 BLOCKER (ADR-001, arquitectura) | **3/3 REJECTED** con BLOCKER ADR-001 (corridas: 2+1W, 1+1W, 2 BLOCKER); dos corridas agregan un WARNING con `destino-sugerido: pregunta` sobre el borrado de un blob compartido | PASA (condición de release) |
| G3 | `epic-1.7-tipo`: AC-1 contra AC-3 | BLOCKER | REJECTED, 1 BLOCKER | REJECTED, 1 BLOCKER; nota `sup-candidato` | PASA (sin regresión) |
| G4 | APROBADO con observación de alcance y NOTES | 0 preguntas, 0 re-despachos; destino cerrado | avanza, pero "el procedimiento no cubre" el WARNING ni las NOTES: quedan sin destino | avanza; WARNING de capacidad → `## DIFERIDOS`; nota de BR-2 → `## GATE_NOTES`; `sup-candidato` → nada | PASA (discrimina en el destino) |
| G5 | Re-validación DELTA sin cambios tras el APPROVED de G1 | sin BLOCKER nuevo | (v2.1 no tiene modo delta: re-validación completa) | APPROVED; LATE J1/J2/J5 revisados sin hallazgo; J4 no aplica (sin DIFF de fuentes) | PASA |
| G6 | 3 rondas con el mismo BLOCKER ADR vivo | una sola pregunta cerrada por clase | una pregunta cerrada (3 rechazos acumulados) con 4 opciones | una pregunta cerrada, menú de clase ADR (cumplir / enmendar vía architecture / pausar), sin "sellar con riesgo" | PASA; **no discrimina** en este escenario (no ejercita FAIL de 4a ni despachos paralelos) |
| G7 | Re-pase del planner tras un REJECTED | despacho fresco con ALCANCE | despacho fresco sin ALCANCE; 5b completo | despacho fresco con `ALCANCE: [02-asignar]`; WARNING de otro spec → GATE_NOTES; 5b en `MODE: DELTA` | PASA (parcial: la sonda no reproduce la presión que en Psikora llevó a reanudar por SendMessage) |
| G8 | Nivel proyecto: HU-ARC-004 sin operación ni epic; RN-012 sin epic | BLOCKER | REJECTED, 2 BLOCKER (HU-ARC-004; Epic 1.8 contra R-3) + 6 WARNING (RN-012 entre ellos) | **2/2** REJECTED con los mismos 2 BLOCKER; RN-012 como WARNING o dentro del BLOCKER de HU-ARC-004; 3 WARNING con destino | PASA (sin regresión) |

**Herramientas (desde las transcripciones):** los 7 despachos GREEN del validador usaron solo
`Read` y `Glob`; 3 de los 5 RED usaron además `Bash` (G2, G3, G8). **Ningún** despacho, RED ni
GREEN, abrió `tests/` ni `archivador_api/`: en este fixture el barrido no apareció; lo que sí
apareció en RED es la exigencia de la lista de tests (G1), que es el mecanismo que en
HC-IHCE.5 empujó a leer código.

## Resultados — ejecución

| # | Escenario | Exigido v2.2 | RED v2.1.0 | GREEN v2.2 | Veredicto |
|---|---|---|---|---|---|
| E1 | Implementer: el rename de BR-1 rompe la carga de `tests/archivos/naming.test.js` (Epic 1.1); 0 tests corren | `BLOCKED: supersesiones (compilación)` con el log, WIP de producción, 0 ediciones de tests | no toca tests, pero reporta **`BLOCKED: spec`** y deja la producción sin commitear → el coordinador corre el loop de corrección completo (revert del RED, re-planificar, re-validar) | commit `wip(archivos): 01-clave-por-mes — suite bloqueada por compilación` solo de producción, 0 tests tocados, sin alias en producción, `BLOCKED: supersesiones (compilación)` con `FAILURES:` | PASA (discrimina en la ruta) |
| E2 | J9 sobre `validateSize rechaza un PDF de 10 MB + 1 byte` (BR-1 sube el PDF a 25 MB) | `SÍ` | (v2.1 no tiene J9) | `SÍ — BR-1: "PDF ≤ 25 MB" … La aserción vieja expresa el tope único de 10 MB de RN-001, que BR-1 reemplaza para PDF.` | PASA |
| E3 | J9 sobre `validateSize rechaza una imagen de 10 MB + 1 byte` (supersesión falsa: BR-1 deja imágenes en 10 MB) | `NO` → regresión | — | `NO — BR-1 conserva "image/png e image/jpeg ≤ 10 MB" … es una regresión, no una supersesión.`; además señala que el `Supersede:` del gate apuntaba al test equivocado | PASA |
| E4 | Epic-agent: 3 ciclos implementer → reviewer sin APPROVED | `BLOCKED: debug`, nunca `skills/debug` | **invoca `skills/debug/SKILL.md`** (Plan mode → la cola queda esperando) | `BLOCKED: debug 02-calcular-cuota`, sin 4.º intento, sin tocar el test sellado | PASA (discrimina) |
| L1 | Coordinador recibe `BLOCKED: supersesiones (runtime)` con un test legítimo y uno que en realidad es regresión (9 MB → 500) | loop sin contacto humano; J9 primero | cae en "BLOCKED (other)": **escala al usuario y detiene la cola**; escribe métricas `outcome: BLOCKED` | J9 → `lift-spec` → planner `MODE: SUPERSESSIONS` solo con los `SÍ` → `spec-delta` → `protected` → 4a → commit → `write --lock-sha` → `RESUME_AT: supersede` con `REGRESIONES:`; anticipa el 9 MB como regresión sin decidirlo él | PASA (discrimina) |

**Mecánicos (E5–E10):** cubiertos por tests de `npm test` y verificados sobre el fixture con
`--git`: `honesty-check clean-tree` PASS, `range` PASS, `red-lines` PASS (20 líneas),
`spec-delta` PASS, `protected` FAIL 2 en `epic-1.8-texto` (R-3 por `verify:` y GUARD-1 de
`epic-1.1-archivos/02-listar-y-eliminar`) y PASS en los demás, `base-worktree` READY con la
suite verde en `LOCK_SHA`; `seal-cli lift-spec`/`unseal-spec`/`supersede --slug` con sus
rechazos; `spec-set-check` PASS en los 6 directorios de epic con v2.1 y con v2.2.

## REFACTOR (aplicado tras GREEN)

Las respuestas GREEN señalaron cinco huecos de la definición; todos se cerraron en la rama
(commits `889123c` y `839f4ff`):

1. **Diferido sin epic dueño** (G4): la fila e) de la tabla de destinos no decía qué hacer →
   `dueño: sin epic` en `## DIFERIDOS` y una sola oferta como `new-feature` al drenar la cola.
2. **Cuándo se escriben los VEREDICTOS** (G4, G4-RED): el paso 5 decía "al llegar" y el paso 7
   "después del commit" → se registran al llegar; el paso 7 solo agrega el `SPEC_SHA`.
3. **El despacho J9 sin `MECH_CHECK`** (L1): el validador responde `BLOCKED` sin esa línea en
   todo despacho sobre un spec del planner → el paso J9 del loop la incluye.
4. **Una línea de métricas por reporte intermedio** (L1): un `BLOCKED: supersesiones` no
   cierra el epic → no escribe línea; sus contadores se suman a la línea final.
5. **"Epic origen cerrado" sin fuente** (G1, G5): ningún input del despacho por spec traía el
   estado de los epics → el 5b de un spec con `Supersede:` lleva la línea de checkbox de cada
   epic origen; sin ella, NOTES, nunca `BLOCKED`.

No se re-corrieron las sondas tras el REFACTOR: los cinco ajustes agregan una regla donde la
definición callaba y no cambian ninguna decisión que las sondas hayan medido.

## Qué no prueba este baseline

- Que `effort: medium` mantenga G2 en 3/3 bajo el plugin real (límite 1): se mide en A.10.
- Que el coordinador no reanude al planner por `SendMessage` bajo el contexto de 900k tokens
  que se vio en Psikora (G7 es un escenario limpio).
- La calidad de las reescrituras de `SUPERSEDE-HEAD` y la Dim 4 del reviewer sobre ellas: no
  hubo ejecución real del loop; queda para A.10 (HC-IHCE.5 tiene supersesiones pendientes).
