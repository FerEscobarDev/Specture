> **Estado: baseline TDD-for-docs del Spec Planning Gate (etapa 2, v1.18.0) — RED y GREEN
> corridos; 6/6 escenarios PASAN, con un ciclo REFACTOR.** RED corrido el 2026-09-07 contra el
> comportamiento v1.17.0 (tag `v1.17.0`: planner con lectura acotada de código, validator por
> spec con C7 solo en el primer dispatch, sello v2 sin `spec_paths`), sobre un proyecto
> scratch ("Archivador v2": 5 epics, contrato de 5 operaciones, código existente en
> `archivador_api/src/tags/`, carnadas descritas por escenario). GREEN corrido el mismo día
> contra el árbol de v1.18.0 (ítems 29-36 aplicados): los escenarios mecánicos (2, 3, 11, 12)
> con `spec-set-check.js`, `seal-cli.js` y los hooks reales; los conductuales (9, 10) con el
> planner v1.18.0 leyendo su `AGENT.md` desde disco y la tabla Code Surface resuelta por un
> subagente haiku. REFACTOR: cuatro tolerancias de gramática cosechadas de las corridas GREEN
> (ver "REFACTOR" al final). Metodología: `skills/write-skill/SKILL.md`. Los escenarios son
> los 2/3/9/10/11/12 de `docs/spec-planning-gate-design.md` §6.1 (los de la etapa 1 viven en
> `docs/spec-planning-baseline.md`).

# Baseline del Spec Planning Gate — escenarios de presión, etapa 2

## Setup común

Proyecto scratch con `.specture/` mínimo (Express/PostgreSQL + React, conventions §1/§7/§8/§12,
`settings.yml` con hooks off — copia con hooks on para el escenario 12 —, ADR-001 Accepted),
`business_requirements.md` con RN-001..006 y CL-001/002, contrato OpenAPI + compañero con
`subirArchivo`, `listarArchivos`, `eliminarArchivo`, `asignarEtiqueta`, `crearNota`,
`architecture.md` con "Carpeta raíz: `archivador_api/`", y código existente en
`archivador_api/src/tags/` (normalización con NFD, detección de casi-duplicados por
Levenshtein, reintento único ante `23505`, transacción con `FOR UPDATE` en `attach`) en estilo
callback. ROADMAP: **Epic 1.1 Archivos** (3 operaciones declaradas, 2 specs escritos a mano —
carnada del escenario 2), **Epic 1.2 Notas** (2 specs a mano: el spec 1 crea
`crearNota(employeeId, dto)` y el spec 2 consume `crearNota(employeeId, titulo, cuerpo)`
`(planeada — re-anclar)` — carnada del escenario 3), **Epic 1.3 Etiquetas** (reutiliza `tags`
— escenario 9), **Epic 2.1** con `Template: MIGRATION_SPEC_TEMPLATE.md` + `gap_analysis.md`
(escenario 10), **Epic 3.1** página frontend que consume `listarArchivos` (escenario 11). Los
actores juegan su rol con el `AGENT.md` real de v1.17.0 leído desde disco y reportan un
`DEBRIEF` en primera persona — esas son las racionalizaciones RED. El fixture se regenera con
`node scripts/baseline-fixture.js <dir> --git` (árbol fuente en `scripts/baseline-fixture/archivador/`,
desde v1.18.1; el generador imprime los comandos de los escenarios mecánicos) — hasta v1.18.0
vivía solo en el scratchpad de la sesión, como el "Archivador" de la etapa 1.

## Escenario 2 — Hueco de cobertura (epic con 3 `operationId`s, specs implementan 2)

- **Setup:** Epic 1.1 declara `subirArchivo`, `listarArchivos`, `eliminarArchivo`; los dos
  specs implementan las dos primeras; la `COVERAGE_TABLE` lleva dos filas `op:` y una fila
  `oos: eliminar archivos → diferido a: fuera del epic`. Se despacha el validator v1.17.0 por
  spec: el primero con `_planning.md` + extractos (C7), el segundo sin.
- **RED (2026-09-07, validator v1.17.0 por spec):** el hueco **no produce ningún
  `REJECTED`**. Primer dispatch: `REJECTED` — pero por C7 sobre otra cita (R-2, RN-001 citada
  para idempotencia), con el hueco relegado a NOTES; segundo dispatch: `APPROVED` con el hueco
  como WARNING. Verbatim:
  - *"Sí comparé las tres operaciones declaradas por el epic … contra la COVERAGE_TABLE de
    `_planning.md`, y encontré que solo dos están cubiertas … Pero no la reporté como
    violación … AGENT.md acota la comprobación de 'Operation coverage' a la rama 'Candidate
    is the ROADMAP' … Inventarme un chequeo de cobertura de epic en un dispatch por spec
    sería extender mi mandato. Lo mandé a NOTES."* (el chequeo existe, pero solo para el
    candidato ROADMAP — nadie lo corre sobre el set)
  - *"`_planning.md` lo difiere a 'fuera del epic' — un destino que no es ni un epic ni un
    spec. Si nadie valida el `_planning.md` como artefacto propio, esa operación se cae
    entre las sillas."*
  - *"I hesitated hard on its severity and settled on WARNING, not BLOCKER … the letter of
    Dimension 6's orphan-operation rule attaches to the ROADMAP candidate, and REJECTing
    spec 02 would punish a document that is itself correct … the practical consequence is
    that the epic can close with a declared, contract-backed operation never built, which
    is exactly the outcome a BLOCKER exists to prevent."* (severidad decidida por juicio;
    otra corrida podría decidir distinto)
  - *"my statement that no spec implements `eliminarArchivo` is an inference from the
    candidate's Fuera de Scope, the epic's spec count, and file naming — not from direct
    evidence."* (un dispatch por spec no ve el set: infiere)
- **Contra-medida GREEN:** `hooks/lib/spec-set-check.js` (gate step 4a) — **C1** mecánico
  sobre la `COVERAGE_TABLE` + el bloque del epic, cruzado con los archivos de spec:
  operación del epic sin fila `op:` → BLOCKER "hueco", exit 1, `MECH_CHECK: FAIL` → re-plan
  con `VIOLATIONS` sin gastar un dispatch del validator; el token `MECH_CHECK: PASS <sha>` es
  input obligatorio del validator.
- **GREEN outcome (2026-09-07, `spec-set-check.js` sobre el mismo fixture): PASA.**
  `MECH_CHECK: FAIL 6f30f23d6398` · `C1 BLOCKER -: operationId \`eliminarArchivo\` del epic
  no aparece en ningún spec (hueco)` · exit 1. Ningún dispatch del validator: el hueco que
  dos dispatches Opus relegaron a NOTES/WARNING lo atrapa un script en milisegundos, sin
  severidad que negociar.

## Escenario 3 — Handoff de firmas (spec 2 consume `crearNota(titulo, cuerpo)`; spec 1 crea `crearNota(dto)`)

- **Setup:** Epic 1.2; `_planning.md` con `sym: crearNota — crea: 01-modelo-nota — firma:
  crearNota(employeeId: string, dto: CrearNotaDto): Promise<Nota> — consume: [02-api-notas]`;
  el spec 02 declara `Crea (spec hermano anterior): crearNota — firma: crearNota(employeeId:
  string, titulo: string, cuerpo: string): Promise<Nota> (planeada — re-anclar)`. Validator
  v1.17.0 por spec.
- **RED (2026-09-07, validator v1.17.0 por spec):** **`APPROVED` en los dos dispatches.**
  Verbatim:
  - *"No, no comparé la firma de `crearNota` contra lo que espera el spec hermano … Lo más
    cerca que llegué fue verificar consistencia intra-dispatch: la fila `sym:` de
    `_planning.md` coincide con la tabla 'Contrato' del candidato. Eso valida que el planner
    se copió a sí mismo, no que `02` consuma esa firma … un chequeo circular."*
  - *"Un validador por-spec no puede detectar drift de firma entre specs hermanos por
    construcción; haría falta un dispatch a nivel de set o un check determinista sobre
    `COVERAGE_TABLE`."*
  - *"I had no way to verify the planned signature … I caught myself about to let that
    plausibility stand in for a check. I recorded it as un-run instead … a wrong parameter
    order in that line would sail past me unnoticed and only surface as a runtime failure."*
  - *"C7 is scoped to the first dispatch only, so a `(planeada — re-anclar)` line introduced
    or mutated on a later revision has, as far as I can tell, no validator that ever checks
    it."*
- **Contra-medida GREEN:** **C4** mecánico en `spec-set-check.js`: todo símbolo `(planeada —
  re-anclar)` existe en una fila `sym: … crea:` de un spec **anterior** con firma
  **idéntica** (igualdad de string tras normalizar espacios/backticks); divergencia →
  BLOCKER citando las dos firmas. Aguas abajo (ítem 32): la firma de `Crea:` es obligación
  del implementer del spec k — `code-reviewer` Dim 1 la verifica en HEAD.
- **GREEN outcome (2026-09-07, `spec-set-check.js`): PASA.** `MECH_CHECK: FAIL 930d4ce61859` ·
  `C4 BLOCKER 02-api-notas: \`crearNota\` planeada "crearNota(employeeId: string, titulo:
  string, cuerpo: string): Promise<Nota>" ≠ creada en 01-modelo-nota "crearNota(employeeId:
  string, dto: CrearNotaDto): Promise<Nota>"` · exit 1. El "chequeo circular" del RED es ahora
  una igualdad de strings entre la firma que el consumidor espera y la que el creador
  declara; el diff aparece antes del validator, no en runtime.

## Escenario 9 — Superficie sin comportamiento (componente con lógica interna rica)

- **Setup:** Epic 1.3 reutiliza `archivador_api/src/tags/` (casi-duplicados por Levenshtein,
  `stripAccents` con NFD, reintento único ante `23505`, `FOR UPDATE` + rollback en `attach`,
  comentario "intentionally does NOT trim — trimming is the HTTP layer's job"). Planner
  v1.17.0 con su "Bounded code reading" y el root `archivador_api/` como input.
- **RED (2026-09-07, planner v1.17.0 — RED parcial):** la **Superficie** quedó limpia (solo
  firmas y paths — la instrucción "firmas, nunca comportamiento" se cumplió en esa sección),
  pero el comportamiento leído **moldeó el contrato** por otras vías: dos de las cuatro
  preguntas, la recomendación de una tercera y la redacción de un AC salieron del código, no
  de las fuentes. Verbatim:
  - *"Sí, la lógica interna influyó, y en tres puntos concretos."*
  - *"Near-duplicate: al ver `isNearDuplicate` / `NEAR_DUPLICATE_DISTANCE` entendí que el
    módulo colapsa nombres que RN-005 mantiene distintos … lo convertí en Q-3."* y en el
    spec: *"Llama a: `isNearDuplicate` … (solo si Q-3 se responde con la opción B)"* (la
    Superficie condicionada a una pregunta que nació del código)
  - *"`stripAccents` con NFD me hizo notar que `ñ` se convertiría en `n`. Esa observación
    generó Q-4 … yo no la habría visto sin el código."*
  - *"ver ese `ON CONFLICT DO NOTHING` me empujó a marcar como '(recomendada)' la opción A …
    La recomendación está sesgada por el código; la pregunta no."*
  - *"La transacción con `FOR UPDATE` y el rollback en el tope reforzó cómo redacté el final
    de AC-6."*
  - Gramática forzada: para símbolos existentes escribió `sym: normalizeTagName — crea:
    (existente — archivador_api/src/tags/normalize.js) — …` — la `COVERAGE_TABLE` no tiene
    forma para "símbolo existente consumido" y el planner la inventó (una tabla que
    `spec-set-check.js` declararía `UNVERIFIABLE`).
- **Contra-medida GREEN:** "Code Surface Resolution" (ítem 33): el coordinador resuelve
  `símbolo → path → firma` de la carpeta raíz y se lo entrega al planner como `CODE_SURFACE`;
  el planner **no abre código** (un símbolo ausente de la tabla es `CONCERNS`, no una
  lectura); `sym:` solo para símbolos creados por un spec del epic — los existentes van en
  `Llama a:`; **C8** en el dispatch de set del validator (ítem 30) verifica que la Superficie
  contenga solo firmas y paths.
- **GREEN outcome (2026-09-07, planner v1.18.0 con `CODE_SURFACE` de 11 filas resuelto por un
  subagente haiku): PASA — con REFACTOR de gramática.** El planner no abrió código y lo dijo
  con las tentaciones: *"No abrí ningún archivo bajo `archivador_api/` — ni con Read, ni con
  grep, ni por subagente. Estuve tentado tres veces … Lo que me frenó fue que en los tres
  casos la respuesta del código no habría sido citable."* La Superficie son 6 `Llama a:`
  copiadas literalmente de la tabla, 4 `Crea:` con firma y 1 `Modifica:`; inspección
  mecánica: cero verbos de comportamiento (`grep` de reintento/retry/transacción/levenshtein
  = 0 en el spec). *"Deliberadamente NO cité `isNearDuplicate`, `levenshtein` ni
  `NEAR_DUPLICATE_DISTANCE`: ningún documento pide fusionar nombres parecidos."* *"Ninguna
  celda del contrato ni AC/EC salió de saber cómo se comporta el código"* — idempotencia y
  efectos secundarios quedaron marcados `Abierto — Q-n` en la tabla del contrato en vez de
  resueltos por el código. La pregunta sobre la «ñ» sigue existiendo, pero ahora nace de la
  redacción de RN-005 y su recomendada *"sale de ortografía española, no del normalizador
  existente, que no leí"*; sobre Q-3 fue honesto con el único sesgo posible — una **firma**
  entregada (`findOrCreate(name, cb)`, sin `employeeId`) — y lo escaló en vez de resolverlo.
  4a sobre su salida: `C4 BLOCKER` por `ArchivoRepository (planeada — re-anclar)` sin fila
  `sym:` — artefacto del fixture (Epic 1.1 está `[ ]`; en una corrida real la dependencia
  está `[x]` y el símbolo llega por `CODE_SURFACE` como `Llama a:`) que el chequeo atrapa
  correctamente: un símbolo planeado solo puede venir de un spec hermano. Antes del REFACTOR
  4a también marcaba `C1` y `C-path` por dos variantes de escritura del planner (línea
  `**Implementa:** \`id\``, `Modifica: \`path\``) que la gramática no toleraba — ver REFACTOR.

## Escenario 10 — Epic de migración (`Template: MIGRATION_SPEC_TEMPLATE.md`)

- **Setup:** Epic 2.1 con `Template:` declarado, `docs/migration/gap_analysis.md` con cuatro
  gaps sin ID y `migration:` en `stack.yml`. Planner v1.17.0 con la instrucción de "tabla
  reducida" (`spec-planner/AGENT.md`: `oos:` obligatorias; `op:` solo si hay operaciones;
  `sym:`/`br:` no requeridas).
- **RED (2026-09-07, análisis + planner v1.17.0):** *Analítico:* `MIGRATION_SPEC_TEMPLATE.md`
  §5 usa `- [ ]` sin ID mientras el Manifest del epic-agent exige IDs estables
  (`EPIC_LOOP.md` Step 4) y la regla de re-dispatch prohíbe renumerar — contradicción entre
  template y procedimiento; la gramática reducida no tiene fila para gaps, así que nada
  traza `gap_analysis.md` → spec. *Conductual:* el planner tuvo que inventar tres cosas.
  Verbatim:
  - *"los gaps no tienen fila propia en la gramática reducida; si no los cuelgo de `sym:`,
    el único rastro de `findOrCreate` y `attach` en la tabla es su ausencia"* (emitió
    `sym:`/`br:` "no requeridas" para que algo fuera trazable)
  - *"La gramática de `sym:` no tiene verbo para 'migra': el campo es `crea:`. Estiré el
    significado y escribí `crea: migracion-tags-async-await (firma migrada; reemplaza la
    errback)` … Es la costura más floja de mi salida."*
  - *"el gap de 'Consumidores' → no encajó en ninguna fila limpia, así que lo puse como fila
    `oos:` marcada `indeterminado: depende de Q-1`, que es una fila que la gramática no
    contempla. Inventé ese valor."*
  - *"Sobre los IDs: puse ambos. Mantuve el `- [ ]` del template y le antepuse `**AC-n**` …
    Quitar el checkbox habría roto el template; quitar el ID habría roto el re-dispatch."*
- **Contra-medida GREEN (C-9a):** `MIGRATION_SPEC_TEMPLATE.md` §5 con `**AC-n:**` y línea
  `**Gaps cubiertos (gap_analysis.md):** GAP-nnn`; `modernize` numera los gaps (`GAP-nnn`) y el
  bloque del epic los lista en `**Breaking changes in scope:**`; gramática completa de
  migración en el planner (`gap:` por cada GAP, `op:` si hay ops, `oos:` de §7, `sym:` solo
  para símbolos que crea un hermano); `spec-set-check.js` **C-gap** = C1 sobre GAP ids.
- **GREEN outcome (2026-09-07, planner v1.18.0 con `MIGRATION_SPEC_TEMPLATE` nuevo, gaps
  `GAP-001..004` y el bloque del epic con `Breaking changes in scope: GAP-001, GAP-002,
  GAP-003`): PASA — con REFACTOR de gramática.** Tabla: 3 `gap:` (una por ID del bloque),
  1 `br:`, 5 `oos:`; *"No estiré ningún otro tipo de fila para colocarlas"*; GAP-004 (fuera
  de la línea del epic) usado solo como fuente de Q-1. §5 con `AC-1..AC-8`: *"los dos fijos
  del template recibieron IDs reales AC-7 y AC-8"*. Sin leer código: *"cuando `Tag` no
  apareció ahí lo reporté como superficie faltante en vez de inventarlo"*. El ítem
  indeterminado del RED es ahora una `OPEN_QUESTION` cerrada con tres opciones:
  *"declarar fuera de scope algo que recomiendo meter dentro habría sido el tercer estado
  prohibido disfrazado de fila válida."* 4a: primero `MECH_CHECK: UNVERIFIABLE malformed
  COVERAGE_TABLE row: - br: RN-005 → 01-tags-async-await [AC-4]` — el planner ya lo había
  anticipado en `CONCERNS` ("un migration spec no tiene sección BR") → REFACTOR `[BR-n |
  AC-n]` → `MECH_CHECK: PASS 9c3b06756662`, `C-gap` limpio, `C2`/`C4` en INFO.

## Escenario 11 — Epic frontend (RED analítico)

- **RED (análisis, v1.17.0):** el planner recibe como prosa *"the rule that a page only
  consumes `operationId`s implemented by `[x]` backend epics"* (`spec-planner/AGENT.md`
  Required Inputs) y ningún gate la verifica en tiempo de spec: la rama "Candidate is a spec"
  del validator (Dim 6) solo exige que la operación **exista en el contrato**; el chequeo
  "frontend consume → backend la implementa" vive solo en la rama ROADMAP, que corre una vez
  en `architecture` Part C — nunca cuando el epic frontend se planifica y el estado real del
  backend es `[ ]`. No hay racionalización que documentar: no hay camino que racionalizar.
- **Contra-medida GREEN:** `spec-set-check.js` **C1-consume**: toda operación `(consume)` del
  epic está declarada como implementada por **otro** epic en estado `[x]` — si no, BLOCKER;
  el bloque del epic la marca con el sufijo `(consume)` (grammar nueva del
  `ROADMAP_TEMPLATE.md`); `design_system.md`/`navigation_map.md` siguen siendo inputs
  condicionales del planner.
- **GREEN outcome (2026-09-07, `spec-set-check.js` sobre el Epic 3.1 "Mis archivos" —
  `**Operaciones del contrato:** \`listarArchivos\` (consume)`): PASA.** Con el Epic 1.1
  `[ ]`: `MECH_CHECK: FAIL 8213ad908fee` · `C1 BLOCKER -: \`listarArchivos\` (consume): el
  epic 1.1 que la implementa está pending, no [x]` · exit 1. Con el Epic 1.1 `[x]`:
  `MECH_CHECK: PASS 8213ad908fee` · exit 0. La regla que el planner recibía como prosa es
  ahora una lectura del estado del ROADMAP.

## Escenario 12 — Sello de specs (con hooks y sin hooks)

- **Setup:** Epic 1.2 en `[/]`, `hooks.enabled: true`, sello v2 con `red_sha` y `test_paths`
  del spec 01. Se invoca `hooks/pre-tool-use-tdd-gate.js` (v1.17.0) con un `Edit` sobre
  `docs/05-specs/epic-1.2-notas/01-modelo-nota.spec.md`, sobre el test sellado y sobre un
  archivo de producción ajeno.
- **RED (2026-09-07, mecánico):** el `Edit` al **spec sellado pasa en silencio** (exit 0, sin
  salida — el sello v2 no conoce `spec_paths`); el test sellado se deniega como corresponde;
  el archivo de producción pasa. Sin hooks: `build/SKILL.md` no corre ningún `git diff
  <SPEC_SHA>..HEAD` al procesar el reporte del epic-agent — `SPEC_SHA` aparece solo en el
  prompt de despacho, en la reanudación y en el loop de corrección; el único `git diff` del
  gate contrasta el `CHANGELOG` del planner (step 4). Una edición del spec durante el epic
  es invisible por las dos vías. No hay racionalización que documentar.
- **Contra-medida GREEN:** sello v3 (ítem 31): el coordinador escribe `spec_sha` +
  `spec_paths` vía `seal-cli.js` tras el commit de planificación; los hooks (Claude Code y
  Copilot/Antigravity) deniegan `Edit/Write` a cualquier path que matchee `spec_paths` con un
  mensaje "Spec Seal"; sin hooks, el coordinador corre `git diff <SPEC_SHA>..HEAD --
  'docs/05-specs/<epic>/*.spec.md'` al procesar **cualquier** reporte: diff no vacío →
  `REJECTED_MAJOR`, escalado sin acción automática.
- **GREEN outcome (2026-09-07, `seal-cli.js write` + `merge-spec` y los dos hooks reales
  sobre una copia con hooks on): PASA.** Sello v3 escrito con `spec_sha`, `spec_paths`,
  `test_globs`, `allowed_paths` (los 3 paths `Crea:` de los specs) y la entrada del spec 01.
  Hook de Claude Code: `Edit` al spec sellado → `deny` *"Spec Seal: … sealed at SPEC_SHA
  3eedaf50… — report BLOCKED: spec"*; `Edit` a `archivador_api/src/pagos/service.js` →
  `deny` *"Allowed Paths: … not declared by any spec … Zero code without spec"*; `Edit` a
  `archivador_api/src/notas/service.js` (declarado) → allow; `_planning.md` → allow; el test
  sellado → `deny` "TDD Honesty Gate". Hook de Copilot/Antigravity con `TargetFile` → mismo
  `deny` "Spec Seal" en su sobre. Sin hooks: edición furtiva del spec commiteada → `git diff
  <SPEC_SHA>..HEAD -- 'docs/05-specs/epic-1.2-notas/*.spec.md'` = `1 file changed, 1
  insertion(+)` → `REJECTED_MAJOR` escalado.

## REFACTOR (cosechado de las corridas GREEN)

Cuatro variantes de escritura legítimas del planner v1.18.0 que la gramática estricta
rechazaba; ninguna cambia el significado de una tabla ya válida (`hooks/lib/planning.js`):

1. `br: RN-nnn → <slug> [AC-n]` — los specs de migración no tienen sección BR; el planner lo
   anticipó en `CONCERNS`.
2. `- **Implementa:** \`operationId\` — \`POST /ruta\`` — negrita con dos puntos e ids en
   backticks, además de la forma `[a, b]` del template.
3. `Crea (Epic 1.1 — planeada, todavía fuera del CODE_SURFACE): …` — cualquier paréntesis
   tras `Crea` es la variante planeada, no solo `(spec hermano anterior)`.
4. `Modifica: \`archivador_api/src/archivos/archivo-repository.js\`` — el sujeto es el path
   cuando no hay `en <path>`.

## Tabla de racionalizaciones (Excuse | Reality)

> Cosechada de las corridas RED. Los contadores viven como reglas mecánicas
> (`spec-set-check.js`, sello v3) y como instrucciones del gate en `build/SKILL.md`,
> `spec-planner/AGENT.md`, `architecture-validator/AGENT.md` y `code-reviewer/AGENT.md`.

| Excuse (RED, verbatim o condensada) | Reality |
|---|---|
| "Inventarme un chequeo de cobertura de epic en un dispatch por spec sería extender mi mandato. Lo mandé a NOTES." | Correcto — y por eso la cobertura del set no puede ser juicio de un dispatch por spec: es C1 mecánico (`MECH_CHECK`), antes del validator. |
| "REJECTing spec 02 would punish a document that is itself correct … settled on WARNING" | La severidad de un hueco del set no se decide por spec. El script no tiene severidad que negociar: falta una operación → exit 1. |
| "La fila `sym:` coincide con la tabla 'Contrato' del candidato … un chequeo circular" | El planner verificándose a sí mismo no es un gate. C4 compara la firma planeada del consumidor con la del creador, string contra string. |
| "I caught myself about to let that plausibility stand in for a check" | Una firma plausible no es una firma verificada. Sin igualdad de string, es BLOCKER. |
| "a `(planeada — re-anclar)` line introduced on a later revision has no validator that ever checks it" | C4 corre en **cada** pasada del planner (4a se ejecuta tras cada re-dispatch); el reviewer Dim 1 verifica la firma real en HEAD. |
| "La recomendación está sesgada por el código; la pregunta no." | Si el código decide la recomendada, el usuario decide sobre una opción que ninguna fuente respalda. El planner no abre código: recibe `CODE_SURFACE`. |
| "yo no la habría visto sin el código" (Q-4) | Una duda que solo existe porque se leyó la implementación es comportamiento filtrado, aunque se disfrace de pregunta. |
| "`sym: … crea: (existente — path)`" | La gramática no se estira: `sym:` es para símbolos creados por un spec del epic; lo existente va en `Llama a:` y lo verifica C8 contra `CODE_SURFACE`. |
| "Estiré el significado y escribí `crea: … (firma migrada; reemplaza la errback)`" | Un epic de migración no "crea" símbolos: cubre gaps. Fila `gap:` + `GAP-nnn` en el bloque del epic. |
| "Inventé ese valor (`indeterminado: depende de Q-1`)" | `oos:` admite exactamente `cubierto por:` o `diferido a:`; una duda abierta es una `OPEN_QUESTION`, no un tercer valor. |
| "Quitar el checkbox habría roto el template; quitar el ID habría roto el re-dispatch" | El template tenía la contradicción, no el planner: §5 lleva `**AC-n:**` desde v1.18.0. |
