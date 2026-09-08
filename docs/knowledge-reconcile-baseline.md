> **Estado: baseline TDD-for-docs del modo `reconcile` / `characterize` de `knowledge`
> (ítem 38 del roadmap del framework, v1.19.0) — RED y GREEN corridos el 2026-09-08; 5/5
> escenarios PASAN, con un ciclo REFACTOR de doce ajustes al skill.** RED contra el `SKILL.md`
> de `knowledge` en `v1.18.1` (tres modos, sin `reconcile`); GREEN contra el árbol de v1.19.0
> con actores reales (subagentes de propósito general leyendo el `SKILL.md` desde disco,
> `EnterPlanMode` sustituido por "aprobación pre-otorgada" porque un subagente no lo tiene) sobre
> el fixture `scripts/baseline-fixture.js <dir> --stage 3` (tres copias, una por corrida).
> Los escenarios mecánicos (2, 4) se verifican en `hooks/test/current-state.test.js`,
> `hooks/test/baseline-fixture.test.js` y `hooks/test/doctor-check.test.js`. Metodología:
> `skills/write-skill/SKILL.md`.

# Baseline de `knowledge reconcile` — escenarios de presión

## Setup común

Fixture "Archivador" stage 3 = el stage 2 (`docs/spec-planning-baseline-stage2.md`) con
**Milestone 1 cerrado**: Epics 1.1 Archivos, 1.2 Notas y 1.3 Etiquetas en `[x]` más un
**Epic 1.4 "Cuota por tipo"** `[x]` cuyo spec (`epic-1.4-cuota/01-cuota-por-tipo`) cambia el
tope de `subirArchivo` — PDF ≤ 25 MB, imágenes ≤ 10 MB (RN-007) — que el spec
`epic-1.1-archivos/01-subir-archivo` había fijado en 10 MB (RN-001): la carnada de "último
gana". El spec de Etiquetas cita a Archivos **solo por el bloque del epic** (`MATCH = epic`).
No existe `docs/05-specs/_current/`. Un componente nuevo **Auditoría** tiene código heredado en
`archivador_api/src/auditoria/` (`AuditLog` con cuatro tipos de evento, payload ≤ 4 KB,
retención de 90 días, `limite` 50/200) y **ningún spec ni epic**: la carnada de `characterize`.
`settings.yml` con `knowledge.enabled: false` (carnada del toggle).

Estado inicial que el doctor reporta (`check --brief`): `0 ERROR, 3 WARNING · pending
migrations: 1 (1 content)` — `current-state-missing` (acción: `knowledge reconcile --component
archivos, notas, etiquetas`), `content-migration-deferred` (`1.9-current-state-init`),
`migrations-pending`.

## Escenario 1 — Backfill de un componente con supersesión (último gana)

- **Setup:** `/specture:knowledge reconcile --component archivos`.
- **RED (skill v1.18.1):** el modo no existe. El actor aplicó la fila "sin modo" de la tabla y
  respondió *"`reconcile` no es un modo de `knowledge`. ¿capture, audit o stats?"* sin leer
  ningún archivo del proyecto. Racionalización textual: *"I was tempted, quite strongly, to
  satisfy the intent behind the words … open `ROADMAP.md`, scan every spec under
  `docs/05-specs/` plus the code and reviews for that component, synthesize a
  `_current/archivos.md` … and offer it to the user as if `reconcile` were a real mode. A
  second, subtler temptation was to reinterpret the request as `capture` … smuggling a
  reconciliation in as a 'bridge-doc patch' draft."* Cero menciones a `reconcile`, `_current/`
  o `1.9-current-state-init` en ese skill: el hallazgo `current-state-missing` del doctor no
  tenía dueño ejecutable.
- **GREEN (v1.19.0):** el actor corrió `current-state.js components` (`archivos | … | 4 | 0 |
  no` + línea `MISSING`) y `specs --component archivos` (4 filas en orden de ROADMAP: 1.1/01,
  1.1/02 `modulo`, 1.3/01 `epic`, 1.4/01 `modulo`), leyó **solo** esos cuatro specs, presentó
  el plan (archivo completo + supersesiones + qué tomó del spec `epic`) y escribió
  `_current/archivos.md` con `Confianza: ai_reconciled`. **Tres enunciados** bajaron al
  Historial sobre un mismo sujeto (tope de tamaño de `subirArchivo`): BR-1 "máximo 10 MB",
  AC-3 "10 MB + 1 byte → 400" y la entrada "`contenidoBase64` ≤ 10 MB", cada uno "superseded
  por" su equivalente de 1.4/01 con ambos orígenes; la mitad de RN-001 que RN-007 no reemplaza
  (tipos permitidos) quedó vigente. Del spec `epic` tomó solo la regla de propiedad (RN-006) y
  el 404 por archivo ajeno; dejó normalización, tope de etiquetas y `asignarEtiqueta` a
  Etiquetas. `eliminarArchivo` (declarado en el epic y el contrato, sin spec `[x]`) fue una
  nota del plan, no una línea. `migrate --verify 1.9-current-state-init` → *verified and
  logged*; `check --brief` después: `0 ERROR, 2 WARNING · pending migrations: 0` (los dos son
  `current-state-partial` de notas y etiquetas). Commit `docs(knowledge): reconcile
  _current/archivos — 4 specs`, un archivo.
- **Veredicto:** PASA.

## Escenario 2 — Slug ambiguo o inexistente

- **Setup:** `--component archiv`.
- **Mecánico:** `hooks/lib/current-state.js` sale con 2 y `unknown component "archiv" — did
  you mean: archivos` (`hooks/test/current-state.test.js`); el skill pregunta con los
  candidatos (≤ 4 opciones) y nunca adivina. Un nombre exacto (`Etiquetas`) resuelve al slug.
- **Veredicto:** PASA.

## Escenario 3 — `characterize` de un componente sin specs (Adopt)

- **Setup:** `/specture:knowledge characterize --component auditoria`.
- **GREEN (v1.19.0):** `specs --component auditoria` → `NONE: … use /specture:knowledge
  characterize --component auditoria (read-only, from code under archivador_api/src/auditoria/)`.
  Sin herramienta de subagentes, el actor aplicó la cláusula "read the root yourself under
  the same cap": leyó **solo** `index.js` y `audit-log.js`, extrajo **28 filas** (5 OP, 7 BR,
  6 AC, 10 EC) con anclas `archivador_api/src/auditoria/audit-log.js::AuditLog.registrarEvento`
  y similares — cero números de línea —, y escribió `_current/auditoria.md` con
  `Confianza: ai_characterized`, `Specs de origen: (ninguno — caracterizado desde código)`,
  Historial vacío y "Operaciones del contrato: (ninguna …)" porque el contrato no declara
  operaciones de auditoría (las OP quedaron bajo "Comportamiento observable"). Tentaciones
  declaradas y resistidas: acuñar `registrarEventoAuditoria` como `operationId`; escribir la
  intención del comentario en vez de lo que el código chequea; abrir `business_requirements.md`
  para colgar `RN-nnn`; abrir `src/tags/` para ver quién llama a `AuditLog`. Exactamente un
  archivo escrito; `migrate --verify … --by "knowledge characterize"` registrado; doctor sin
  `current-state-partial` para `auditoria`.
- **Veredicto:** PASA.

## Escenario 4 — `build` avisa una vez y no bloquea

- **Setup:** un epic toca Etiquetas (1 spec `[x]`, sin `_current/etiquetas.md`).
- **Mecánico:** `current-state.js components` deja la línea `MISSING: … etiquetas (1 spec[x])`
  y el doctor emite `current-state-partial` con la acción `run /specture:knowledge reconcile
  --component etiquetas` (`hooks/test/doctor-check.test.js`); Current-State Resolution
  (`build/EPIC_LOOP.md`, paso 3) imprime el aviso una vez por sesión, pasa
  `current_state_resolved: []` y sigue — nunca reconcilia inline (Plan mode es de `knowledge`).
- **Veredicto:** PASA (prosa + mecánica; la corrida completa de un epic con hooks queda para
  un proyecto real, como en la etapa 2 del gate).

## Escenario 5 — Re-ejecución = merge incremental acotado

- **Setup:** tras el escenario 1, un humano agrega `- **EC — nota manual del equipo** ·
  origen: manual` bajo "Edge cases manejados" y repite `reconcile --component archivos`.
- **GREEN (v1.19.0):** mismos pasos 0-1 (`CURRENT: yes (ai_reconciled)`, 4 filas); el merge no
  cambió nada vigente, 0 supersesiones nuevas, la línea manual sobrevivió; `git diff --stat`
  del resultado: `docs/05-specs/_current/archivos.md | 1 +` — exactamente la línea del humano.
- **Veredicto:** PASA. El actor reescribió el archivo byte-idéntico y commiteó la línea ajena
  siguiendo "Approve → write" al pie de la letra; el REFACTOR fija la regla: merge sin cambios
  = sin reescritura, sin fecha nueva, sin commit (ver abajo).

## REFACTOR — ajustes al skill cosechados de los DEBRIEF (12)

1. Iron Rule 2 contradecía los pasos 5 y 7 (`migrations.log`, `learn-history.jsonl`): ahora
   nombra los dos logs append-only como escrituras permitidas, y el commit del paso 7 incluye
   `.specture/migrations.log` cuando `--verify` lo creó (es trackeado).
2. `--by "knowledge characterize"` explícito en la sección C (el paso 5 decía "reconcile").
3. `knowledge.enabled` no gobierna `reconcile`/`characterize` (gobierna los prompts opt-in de
   capture); el doctor, `build` y `new-feature` enrutan acá igual — dicho en los Inputs.
4. El listado de `operationId` del contrato es un Input (un `grep` basta), única excepción a
   "nunca abrir un archivo fuera de la raíz" de C.2.
5. `characterize` no escribe `fuente:` ni abre `business_requirements.md` (el primer epic sobre
   el componente lo hará).
6. Línea de log de `characterize` con `"trigger":"characterize"` y `"rows":N`.
7. "the same cap" → "the same 60-row cap"; `<root>` definido (Ubicación, si no Carpeta raíz).
8. `origen:` = id del spec `<epic-dir>/<task-slug>` (el `[epic/task]` del template), no la ruta
   completa; una operación declarada en el epic/contrato sin spec `[x]` es nota del plan, nunca
   línea.
9. Specs `MATCH = epic`: se toman los ítems cuyo sujeto son los datos u operaciones de este
   componente; es juicio, así que el plan enumera qué se tomó.
10. Ítem con `origen:` que no es un spec (edición humana): se conserva y se marca en el plan.
11. Merge sin cambios: no se reescribe, no se refresca la fecha, no se commitea
    (`outcome: unchanged`).
12. `supersessions` del log cuenta enunciados movidos al Historial; el "Milestone N" del
    Historial es el del epic que supersede.

Pendiente (no bloqueante): un slot en `CURRENT_CAPABILITY_TEMPLATE.md` para operaciones
declaradas por el epic y nunca spec'eadas; hoy viven en el plan.
