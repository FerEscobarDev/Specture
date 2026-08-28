> **Estado: ROADMAP CONSOLIDADO — 2026-08-28.** Reúne en una sola lista, ordenada por
> valor para el framework, **todos** los features y fixes definidos en cuatro documentos:
> `spec-planning-gate-design.md` (diseño del gate, D1-D21), `spec-planning-gate-review.md`
> (revisión: C-1…C-9, M1-M7, G1-G12), `psikora-scale-review.md` (N1-N10) y
> `doctor-and-migrations-design.md` (doctor, catálogo de migraciones, principios). Cada
> ítem cita su fuente; las definiciones son las de origen, no reinterpretaciones. Ningún
> ítem está implementado. Las **decisiones abiertas** que condicionan el orden están en el
> Apéndice A. **Solo contiene ajustes del framework**: las acciones sobre el proyecto
> Psikora viven en su propio repo (`C:\Proyectos\Psikora\PLAN-SANEAMIENTO-SPECTURE-2026-08-28.md`).

# Roadmap del framework Specture — v1.14.1 → v1.19

## Principio de orden

1. **Primero lo que mide y lo que evita "media feature"** (higiene + `doctor`): sin CI el
   repo no verifica sus propios releases; sin `doctor` cualquier feature nueva llega a
   los proyectos existentes a medias (Psikora recibió v1.6, v1.7 y v1.9 incompletas).
2. **Después los prerrequisitos** que hacen al gate más barato y mecánico (IDs estables,
   ROADMAP validado, `build` partido, techo de spec).
3. **Luego el Spec Planning Gate en dos etapas**, y por último las mejoras de escala y
   las que requieren medición previa.

Convención por ítem: **título** · definición · `Fuente` · `Esfuerzo` · `Depende de`.
Estado: `[ ]` pendiente · `[/]` en curso · `[x]` hecho.

---

## Milestone 0 — Higiene del framework (v1.14.1 · horas)

*Objetivo: que el repo del framework vuelva a verificar sus propias afirmaciones y que
las instrucciones del hot path no contengan texto obsoleto ni reglas que fabrican
errores.*

- [x] **1. CI + sincronización de versiones + changelog obligatorio (G1)** · hecho 2026-08-28, v1.14.1 (`package.json`, `scripts/bump-version.js`, `hooks/test/release-contract.test.js`, `.github/workflows/{ci,release}.yml`, `docs/release-process.md`)
  El test `hooks/test/copilot-plugin-contract.test.js` falla en HEAD (`1.14.0 !== 1.13.0`):
  `plugin.json` = 1.14.0, `.claude-plugin/plugin.json` / `.github/plugin/marketplace.json` /
  `copilot/compatibility-matrix.json` = 1.13.0; README sin changelog v1.13/v1.14; sin
  `package.json` ni workflow. Definición: `package.json` con script `test`
  (`node --test hooks/test/*.test.js` — pasar el directorio falla en Node 24/Windows);
  workflow de GitHub Actions; `scripts/bump-version.js` que toca los 4 manifiestos; test
  que exige `### v<versión actual>` en el README.
  `Fuente: gate-review G1` · `Esfuerzo: horas` · `Depende de: —`

- [x] **2. Limpieza de texto obsoleto y config muerta (G10, G11, G12)** · hecho 2026-08-28, `a3906c4` (`required_test_coverage_percent` eliminado, no cableado)
  `start/SKILL.md:102-104` "Context Hygiene Rule" (pre-v1.8.0, el modelo secuencial lo
  hizo automático); `build/SKILL.md` Step 1 (`:165-170`) y Step 2.5 (`:197-214`) con
  residuos de los 3 modos; `hooks/session-start.js` muerto desde v1.5.0;
  `stack.template.yml:77` `quality.required_test_coverage_percent` que nadie lee (cablear a
  Step 7 / Dim 3 o eliminar); README "Los 5 Agentes" (hay 6), árbol sin `hooks/`,
  `copilot/`, `hooks.json`; `antigravity_plugin_plan.md` suelto en la raíz → `docs/`.
  `Fuente: gate-review G10-G12` · `Esfuerzo: horas` · `Depende de: —`

- [x] **3. Política de anclas: prohibido `doc.md:NNN` hacia documentos vivos (N4)** · hecho 2026-08-28, `c05315a` (la verificación mecánica queda para el ítem 5)
  Código: `path@SHA:línea` o `path::símbolo`. Documentos vivos (ROADMAP, specs, mapping,
  ledger, conventions): **solo** ID estable (`AC-n`, `RN-nnn`, `ADR-nnn §título`,
  `operationId`, ancla de encabezado). Cambiar la instrucción "Cite file:line" de
  `code-reviewer:274` y "citing exact line" de `architecture-validator:92`. Psikora tiene
  5.229 citas por línea; la retrospectiva §3.2 documenta cuatro citas sucesivas todas
  correctas en su momento y todas falsas después. El ítem 5 (`doctor`) lo verifica en
  documentación nueva.
  `Fuente: psikora-review N4, retrospectiva P-1` · `Esfuerzo: trivial` · `Depende de: —`

- [x] **4. Reglas de escritura para reviewers y agentes concurrentes (N9)** · hecho 2026-08-28, `d0d2d54`
  Anti-patterns nuevos en `build`: un reviewer solo escribe **su** archivo en
  `docs/07-reviews/`; nunca `git add -A` ni `--amend`; validación por mutación solo con
  snapshot previo a scratch y restauración byte a byte (`git hash-object`), nunca
  `git checkout` para restaurar (P-2); commitear todo arreglo de producción antes de abrir
  un bucle de mutación (P-3); prohibido despachar dos agentes que escriban al mismo
  checkout (P-5). Cierra los tres incidentes de la retrospectiva (`git add -A` que capturó
  15 archivos ajenos, `--amend` sobre commit de un tercero, 4 arreglos destruidos).
  `Fuente: psikora-review N9 / §2.10, retrospectiva P-2/P-3/P-5` · `Esfuerzo: trivial` · `Depende de: —`

---

## Milestone 1 — `specture:doctor` + migraciones de esquema (v1.15.0)

*Objetivo: que el proyecto tenga versión de esquema, que cada release embarque su
migración, que ningún fallback sea silencioso, y que el corpus documental tenga un
verificador mecánico. Sin esto, cada feature siguiente llega "a medias" a los proyectos
existentes.*

- [ ] **5. `doctor check` — lint mecánico del corpus + drift de esquema + estado (N5)**
  Modo por defecto, solo lectura, node (misma infraestructura que los hooks), corre en CI
  y en el Step 0 de `start`. **(a) Lint del corpus:** rutas `docs/**` y
  `.specture/decisions/**` citadas que no existen; paths con `...` sin rellenar; ADRs con
  número duplicado o `Status` no parseable; reviews sin bloque `STATUS:`; specs sin
  `AC-n`/`BR-n`/`EC-n` con ID; specs sobre el techo de tamaño (ítem 16); `doc.md:NNN` en
  docs nuevos (ítem 3). **(b) Drift de esquema:** `schema_version` vs `plugin.json` →
  migraciones pendientes por nivel. **(c) Estado:** sello `build-locked.json` cuyo epic no
  está `[/]`; >1 epic `[/]`; `_current/` ausente con milestones cerrados;
  `docs-index.yml` presente vs toggle; residuos `.claude/worktrees`. Salida: tabla con
  severidad + comando sugerido. En Psikora habría atrapado 24 rutas rotas, un sello
  huérfano, dos `ADR-012` y 26 reviews sin veredicto — el 13 % de los hallazgos de agosto
  del reviewer son sobre prosa: está haciendo de linter.
  `Fuente: psikora-review N5, doctor §4.1` · `Esfuerzo: bajo (1-2 días)` · `Depende de: —`

- [ ] **6. `schema_version` + `.specture/settings.yml` + `migrations.log` (N8, doctor §3/§4.5)**
  El proyecto gana versión de esquema, escrita por `setup` (`= plugin.version`) y avanzada
  por cada migración aplicada. Nuevo `.specture/settings.yml` (dueño = framework):
  `schema_version`, los toggles hoy en `conventions.md` §10 y el perfil — `stack.yml` y
  `conventions.md` quedan enteramente del usuario (en Psikora el §10 real es "Consumo del
  API real" y los toggles viven en un bloque "Settings" improvisado). Lectura tolerante del
  §10 viejo durante un release. `.specture/migrations.log` trackeado, append-only:
  `<fecha> <id> <kind> <applied|skipped|deferred> <by>`. **Sin ADR por upgrade** (el
  ADR-030 de Psikora es el síntoma). *Decisión abierta A1: `settings.yml` vs
  `stack.yml.specture.*`.*
  `Fuente: doctor §3.1/§3.7/§4.5, psikora-review N8` · `Esfuerzo: bajo` · `Depende de: —`

- [ ] **7. Catálogo de migraciones `migrations/<version>-<slug>.js` (doctor §4.2)**
  Cada migración: `id`, `since`, `kind: mechanical|assisted|content`,
  `detect(projectRoot) → pending|done|n/a` (predicado sobre el filesystem — reconoce lo
  migrado a mano, idempotente), `apply()` (mechanical) o `plan()` (assisted → Plan mode),
  `verify()`, `owner_skill` (content). Catálogo inicial: `1.2-state-gitignore` (mech);
  `1.6-boundary-capabilities` (assisted: derivar "Capacidades de Frontera" y marcas
  `Exposición` desde HU + traza inversa `operationId → HU`); `1.6-contract-companion`
  (assisted: generar `api-contract.md` desde el OpenAPI); `1.7-meta-gitignore` (mech);
  `1.8-drop-parallel-toggle` (mech); `1.9-dependencies-syntax` (assisted);
  `1.9-current-state-init` (**content**: agenda el backfill lazy, ítem 33);
  `1.9-tombstones` (mech: **script que colapsa preservando IDs por construcción**, apunta a
  `_current/` solo si existe, si no a la carpeta de specs con marca `pending:_current`);
  `1.10-rules-sections` (mech); `1.11-profile-and-knowledge` (mech);
  `1.12-structure-block` (assisted); `1.15-settings-file` (mech); `1.15-schema-version`
  (mech: inferir por `detect()` de todas las anteriores). Las migraciones tocan
  `.specture/`, ROADMAP, requerimientos, arquitectura, `.gitignore`; **nunca** specs `[x]`,
  reviews ni debug logs.
  `Fuente: doctor §3.2/§3.3/§3.5/§4.2` · `Esfuerzo: medio` · `Depende de: 6`

- [ ] **8. `doctor migrate` y `doctor sync` (doctor §4.1)**
  `migrate`: aplica pendientes — `mechanical` directo con `git diff` mostrado; `assisted`
  vía Plan mode (un plan con todos los deltas, aprobación atómica, como `knowledge
  capture`); `content` → lista con dueño y skill destino, **no aplica**. Avanza
  `schema_version` solo hasta la última versión cuyas migraciones no-content estén todas
  hechas. `sync`: `check` + solo las `mechanical` — para CI y `start`. *Decisión abierta
  A4: `doctor sync` como job de CI (falla en ERROR, avisa en WARNING).*
  `Fuente: doctor §4.1` · `Esfuerzo: bajo` · `Depende de: 5, 7`

- [ ] **9. Step 0 en `start` + precondiciones declaradas por skill + "cero no-op silencioso" (doctor §3.4/§4.3/§4.4)**
  `start` lee `schema_version` (un campo); si `< plugin.version` anuncia *"Hay N
  migraciones pendientes (M mecánicas, K asistidas, C de contenido). ¿Corro
  `/specture:doctor migrate` antes de enrutar?"* — **no bloquea**, salvo precondición dura
  del skill destino (ej. `build` con milestones cerrados y `1.9-current-state-init`
  pendiente → advertir). Cada skill lista sus precondiciones estructurales en una tabla al
  inicio (`build` 8.7 → `_current/` inicializado o milestones cerrados = 0; `architecture`
  Part B → "Capacidades de Frontera"; validator Dim 6 → `api.contract_file` + compañero).
  Toda rama "si X no existe, comportamiento anterior" de **todo** skill emite una línea, una
  vez por sesión: *"X no inicializado — corré `/specture:doctor`"*. *Decisión abierta A2:
  avisar vs bloquear.*
  `Fuente: doctor §3.4, §4.3, §4.4` · `Esfuerzo: bajo-medio (toca build, architecture, validator, reviewer, new-feature)` · `Depende de: 6`

- [ ] **10. Skills leen `stack.yml.api.contract_file` en vez de nombres fijos (N8)**
  Los skills citan `api-contract.md` y `api-contract.openapi.yaml`; Psikora declara
  `api-contract.openapi.json` sin compañero `.md` → 2 rutas rotas y, más grave, el validator
  nunca tuvo el input de la Dimensión 6 (el contrato describía el 0 % de las respuestas
  durante meses — `conventions.md` §14 de Psikora). Los skills leen `contract_file` y
  derivan el compañero legible (o lo declaran opcional).
  `Fuente: psikora-review N8 / §2.8` · `Esfuerzo: bajo` · `Depende de: —`

- [ ] **11. Sello multi-spec y liberación verificada por el coordinador (N7)**
  Schema `build-locked.json` con `specs: [{slug, red_sha, test_paths}]` (hoy un solo
  `red_sha` por epic; Psikora inventó `red_sha_spec_01`, `red_fix_note`). El hook **falla
  abierto con aviso** si el epic sellado no está `[/]` en el ROADMAP (grep de una línea).
  El coordinador borra el sello al procesar `DONE` — no confía en el epic-agent (Step 8
  hoy delega el borrado); `doctor` lo reporta si sobrevive. Psikora tiene un sello del
  2026-08-21 para un epic `[x]` que bloquea 8 tests con hooks activos. Embarca su
  migración (cambio de schema).
  `Fuente: psikora-review N7 / §2.7` · `Esfuerzo: bajo` · `Depende de: 7`

- [ ] **12. Verificación del doctor: fixtures por versión, invariante setup↔migraciones, gate de release (doctor §6)**
  (1) `migrations/test/fixtures/<version>/` con `.specture/` + `docs/` mínimos "como los
  dejaba `setup` en esa versión": `migrate` desde cada fixture llega al esquema actual;
  todas las `detect()` devuelven `done` después; correr dos veces no cambia nada.
  (2) `setup` fresco a la versión N ⇒ todas las migraciones ≤ N detectan `done`. (3)
  **Gate de release**: un commit que cambia `templates/project-config/**`,
  `ROADMAP_TEMPLATE.md`, `SPEC_TEMPLATE.md` o los "Required Inputs" de un skill **sin**
  agregar/modificar un archivo en `migrations/` hace fallar el test. (4) Test de aceptación
  real: `doctor check` sobre un clon de Psikora reporta exactamente la tabla de doctor §2.
  (5) Escenarios de racionalización (baseline sin skill): "el proyecto ya funciona, no
  migro"; "aplico la de contenido yo mismo"; "marco `done` sin `verify()`".
  `Fuente: doctor §6` · `Esfuerzo: medio` · `Depende de: 5-9`

---

## Milestone 2 — Prerrequisitos del Spec Planning Gate (v1.16.0 · cada uno con su migración)

*Objetivo: que el gate encuentre IDs estables, un ROADMAP validado, un `build` corto y
specs con techo. Ninguno depende del gate; todos lo abaratan.*

- [ ] **13. `templates/BUSINESS_REQUIREMENTS_TEMPLATE.md` + IDs estables `RN/CL/FA` + chequeo mecánico de salida de `discover` (G3, C-4)**
  Es el único entregable de fase sin template. `discover` produce `HU-…` estables pero
  las reglas de negocio se citan por "§X" (`SPEC_TEMPLATE:29`, `ROADMAP_TEMPLATE:46`), así
  que la Dim 4 del validator, el chequeo C2 del gate y la trazabilidad de `_current/` son
  juicio, no mecánica. Definición: template con `RN-nnn` (reglas), `CL-nnn` (casos límite),
  `FA-nnn` (fuera de alcance); chequeo mecánico de salida de `discover` (placeholders; toda
  HU con `Exposición`; toda HU `UI`/`API-externa` en "Capacidades de Frontera"; toda RN con
  ID). Psikora ya inventó `RN-SEG-007`, `RN-PAGO-006` (50 únicos): confirma la necesidad.
  `Fuente: gate-review G3 / C-4` · `Esfuerzo: 1-2 días` · `Depende de: 7 (migración)`

- [ ] **14. Gate del `architecture-validator` sobre el ROADMAP — Part C (G4)**
  Part A y Part B de `architecture` tienen gate; Part C (`:136-146`) solo self-review, y el
  validator **ya tiene** escrito el chequeo ("When the ROADMAP is also in scope",
  `architecture-validator:82`) sin que nadie lo invoque. Definición: un dispatch por
  proyecto con ROADMAP + contrato + BR + arquitectura; verifica sintaxis parseable de
  `Dependencias`, cobertura `operationId` → exactamente un epic backend, BR → epic,
  sizing (1-3 specs). El ROADMAP es el input directo del planner: garbage-in evitado. En
  Psikora el orden numérico dejó de ser el orden de construcción y una auditoría encontró
  11 huecos sin dueño.
  `Fuente: gate-review G4` · `Esfuerzo: medio día` · `Depende de: —`

- [ ] **15. Partir `build/SKILL.md` en coordinador + `build/EPIC_LOOP.md` (M3, G2, C-3)**
  `build/SKILL.md:79` pasa **el archivo completo** (512 líneas) al epic-agent; ~200 son solo
  del coordinador (Execution Model, cola, Branching, Steps 8.5/8.7/9, prosa del gate
  visual) e invitan a ejecutar pasos prohibidos. El gate sumaría +80-120 líneas netas
  (no "≈ 0" como afirma el diseño). Definición: `build/SKILL.md` = coordinador (cola,
  branching, Spec Planning Gate, procesamiento de reportes, 8.5, 8.7);
  `build/EPIC_LOOP.md` = Steps 4-8 + Manifest + resoluciones + gate 5.5 + Iteration Cap +
  anti-patterns; el epic-agent recibe **solo** el segundo. Reduce el riesgo "erosión del
  procedimiento".
  `Fuente: gate-review M3 / G2 / C-3` · `Esfuerzo: 1 día` · `Depende de: 2`

- [ ] **16. Techo y forma del spec + sección de guards (N2)**
  Verificación mecánica (vía `doctor`, ítem 5): spec > 300 líneas ⇒ WARNING "split o
  mover narrativa"; secciones fuera del template ⇒ WARNING con destino sugerido (decisión
  del usuario → `_planning.md`; deuda → ROADMAP; divergencia handoff →
  `handoff-mapping.md`; supersesión de tests → ítem 30). Template: sección explícita
  **"Guards de no-regresión (nacen verdes)"** — se declaran, no cuentan como RED, el gate
  los excluye. En Psikora los specs pasaron de 100-230 líneas a 398 promedio / 994 máx.,
  con "🔴 Decisión de usuario", "🔴 Deuda que NO salda", "🔴 Supersesión de tests
  sellados", "🟢 AC que nacen verdes". **Condición para el gate**: sin esto,
  `_planning.md` es un quinto lugar donde escribir lo mismo.
  `Fuente: psikora-review N2 / §2.2 / §6` · `Esfuerzo: bajo` · `Depende de: 5`

- [ ] **17. Router: salida estricta, nunca ejecuta fases (G6)**
  `README:72` documenta `/agent specture:specture-router`; `specture-router/AGENT.md:18`
  ordena invocar `start`, y `start:112` "invoke that skill and follow its instructions" —
  nada impide que un subagente Haiku sin `AskUserQuestion` termine corriendo `build` o
  `discover`. `usage-cost-analysis.md` midió "subagentes bajo start = 19 %". Definición:
  el agente devuelve `PHASE: <name> · SKILL: <path>` y se detiene; el chat principal invoca
  el skill. O eliminar el agente (los skills ya son slash commands).
  `Fuente: gate-review G6` · `Esfuerzo: medio día` · `Depende de: —`

- [ ] **18. Requerimientos: fusión, no acumulación (N10, generaliza D18)**
  `new-feature` Step 1 **fusiona por sección** en `business_requirements.md` (marcador
  `(añadido por feature X, fecha)`), borra el `feature-*.md` al aprobar el ROADMAP;
  prohibidas las "Adendas" apendizadas; el epic-agent recibe siempre el archivo único. En
  Psikora la verdad de negocio está en 17 archivos (BR con "Adenda v1.2/v1.3" + 16
  `feature-*.md`) y `build` solo entrega el primero.
  `Fuente: psikora-review N10 / §2.9, gate-design D18` · `Esfuerzo: bajo` · `Depende de: 13`

---

## Milestone 3 — Spec Planning Gate · etapa 1: el autor y las preguntas (v1.17.0)

*Objetivo: un autor especializado del spec (el contrato sellado de toda la cadena es hoy
el único artefacto sin autor especializado ni canal al usuario) que separa lo resuelto con
cita textual de lo que solo el usuario puede decidir. El validator sigue por spec; sin
script de set, sin sello, sin overlay. Escenarios 1, 4, 5, 6, 7, 8 del diseño §6.1.*

- [ ] **19. Agente `spec-planner` (`agents/spec-planner/AGENT.md`, `model: opus`) (D4, D11, D21)**
  Traduce **un** epic en 1-3 specs code-free, self-contained y ordenados por dependencia;
  los escribe a disco **sin commitear** (el coordinador hace `git add` — diffeable — y
  commitea tras `APPROVED`); no despacha ni toca nada fuera de `docs/05-specs/<epic-slug>/`.
  **Required Inputs** (falta uno → `NEEDS_CONTEXT`): bloque completo del epic;
  `business_requirements.md` (secciones enlazadas + Capacidades de Frontera); secciones de
  `architecture.md` de los componentes (incl. "Carpeta raíz"); slice del contrato con los
  `operationId`s; `stack.yml`, `conventions.md` (§8, §12, file-org), ADRs `Accepted`;
  `_current/` y docs-index resueltos; la plantilla (`SPEC_TEMPLATE.md` o
  `MIGRATION_SPEC_TEMPLATE.md` si el epic declara `Template:`); rutas raíz del componente;
  condicionales frontend (`design_system.md`, `navigation_map.md`, fidelity/mapping) y
  migración (`gap_analysis.md`, `stack.yml.migration`); en re-dispatch, los specs
  anteriores + `ANSWERS`/`VIOLATIONS`. **Contexto restringido**: sin memoria, sin Context7,
  sin historial; lectura de código acotada a símbolos nombrados, **firmas y paths, nunca
  comportamiento** (una "Superficie" con prosa de comportamiento sesga al test-writer).
  **Proceso**: Step 0 manifest → Step 1 mapear cobertura (cada `operationId`, BR,
  capacidad) → Step 2 descomponer en 1-3 specs (>3 ⇒ `BLOCKED: sizing`) → Step 3 llenar
  plantilla aplicando el "Spec self-review" (que **se muda** desde `build` Step 2) → Step 4
  pasada de ambigüedad por AC/BR/EC/celda de contrato/Fuera de Scope → Step 5
  `COVERAGE_TABLE` + pre-chequeo → Step 6 escribir. **Output estricto**: `STATUS`, `SPECS`
  (paths, no contenido), `COVERAGE_TABLE` (`op:`, `br:`, `sym:`, `oos:`), `OPEN_QUESTIONS`,
  `RESOLVED_ALONE`, `CHANGELOG`, `CONCERNS`. `BLOCKED` para sizing, contrato (shape u
  operación inexistente — es cambio de arquitectura) o contradicción entre fuentes.
  **Re-dispatch = edición mínima** (D12): edita los archivos existentes, IDs `AC/BR/EC` y
  slugs estables, `CHANGELOG` que el coordinador contrasta con `git diff` — un diff que
  excede el `CHANGELOG` es hallazgo. Con el juicio movido al planner, el epic-agent queda
  procedural → **pinnear `model: sonnet`** y medir (M7).
  `Fuente: gate-design §4.2, D4, D11, D12, D21; gate-review M7` · `Esfuerzo: alto` · `Depende de: 13, 14, 15, 16`

- [ ] **20. Criterio de escalado, formato de preguntas y delegación (D9, D19)**
  Una duda va a `OPEN_QUESTIONS` **solo si** (1) cambia el contrato observable (AC, BR,
  EC, celda de la tabla de contrato o Fuera de Scope — dudas de *cómo* implementar las
  resuelven `conventions.md`/ADRs) **y** (2) no es resoluble con las fuentes entregadas; si
  una fuente responde, se cita **textualmente** en `RESOLVED_ALONE` (sin frase que citar,
  no está resuelto; prohibido el tercer estado "asumido sin cita"). Formato: ≤ 4 preguntas
  por tanda, 2-4 opciones, una `(recomendada)`, frases prohibidas de `discover` Rule 5;
  ≤ 2 tandas por epic — si siguen apareciendo dudas de contrato, el epic está
  sub-descubierto → ofrecer `discover` scopeado. **Presión vaga** ("hazlo rápido", "no me
  preguntes") **no suprime** preguntas de contrato; la **delegación explícita** ("si hay
  dudas usá la recomendada") sí se honra, queda registrada como `fuente: delegado por el
  usuario <fecha>`, alcance = el epic nombrado (o el batch solo si se dijo antes de
  arrancarlo), nunca sobrevive la sesión. Plataformas: Claude Code = `AskUserQuestion`;
  Copilot/Antigravity = preguntas cerradas en chat con las mismas reglas.
  `Fuente: gate-design §4.3, §4.11, D9, D19` · `Esfuerzo: bajo (en el coordinador)` · `Depende de: 19`

- [ ] **21. `docs/05-specs/<epic>/_planning.md` trackeado + persistencia de aclaraciones (M1, C-2, D10, D18)**
  Artefacto único por epic con: `COVERAGE_TABLE` (única, machine-readable — es lo que leerá
  `spec-set-check.js`), `OPEN_QUESTIONS` + respuestas + fuente, `RESOLVED_ALONE` con citas,
  resultado del chequeo mecánico, veredicto del validator verbatim, `SPEC_SHA`. Reemplaza
  al diseño original que ponía la evidencia en el commit message, en `build-locked.json`
  (gitignoreado, se borra en Step 8) y "al pie de cada spec" (la coverage table es
  propiedad del *set*). La sección "Aclaraciones" de cada spec queda como puntero. Si una
  respuesta del usuario **crea o cambia una regla de negocio**, el coordinador **edita la
  regla en su lugar** en `business_requirements.md` con marcador `(aclarado en Epic X.Y,
  fecha)` — **no** subsecciones-bitácora — antes de re-despachar al planner, para que el
  spec la cite y la Dim 4 del validator la encuentre; si la respuesta es arquitectónica →
  ADR. Beneficios: reanudación con evidencia en disco, `knowledge capture` tiene un
  artefacto único, el reviewer puede recibirlo, `_current/` gana trazabilidad de decisiones.
  **Con el ítem 16 vigente, `_planning.md` es el único hogar de decisiones** — no un quinto.
  `Fuente: gate-review M1 / C-2; gate-design §4.5, D10, D18; psikora-review §6` · `Esfuerzo: bajo` · `Depende de: 16, 19`

- [ ] **22. Visibilidad sin bloqueo: eco de interpretación, resumen, modo revisión a pedido (D2, D7)**
  Sin gate humano obligatorio (fatiga de aprobación: firma sin leer desde el epic 5;
  "todas" dejaría de ser desatendido) y sin Plan mode (`ExitPlanMode` es bloqueante,
  reintroduce D2 por la puerta de atrás). **Eco** tras cada re-dispatch: el coordinador
  muestra el `CHANGELOG` del planner, no espera confirmación. **Resumen** siempre antes de
  commitear: specs con orden, cantidad de AC/BR/EC, `operationId`s cubiertos, todas las
  `RESOLVED_ALONE` con cita. **Modo revisión** solo por pedido explícito en la sesión
  ("construí con revisión de specs"): el coordinador se detiene y espera confirmación en
  chat. Sin toggle en §10 (D6: sin gate humano no hay motivo para apagarlo, y abre el bypass
  "lo apago para ir rápido"). Mapa de contactos humanos (§4.12): `OPEN_QUESTIONS`, 3
  rechazos acumulados, `BLOCKED: sizing`/C5, `BLOCKED: contrato`, reanudación con specs sin
  validar, `BLOCKED`/`REJECTED_MAJOR` aguas abajo, modo revisión — **ninguno rutinario**.
  `Fuente: gate-design §4.6, §4.12, D2, D3, D6, D7` · `Esfuerzo: bajo` · `Depende de: 19`

- [ ] **23. Cambios en el epic-agent: Steps 4-8 con `SPEC_SHA` + veredicto verbatim (D17, §4.9)**
  El prompt de despacho pasa de "Execute Steps 2 through 8" a "Steps 4 through 8" y
  agrega: *"Steps 2/2.5/3 — los specs ya fueron planificados por `spec-planner` y
  validados; NO los regeneres ni edites. Si un spec resulta inejecutable, reporta
  `BLOCKED: spec` con el ID afectado."* **Evidencia obligatoria** en el prompt: `SPEC_SHA`
  y el veredicto `APPROVED` del validator verbatim — sin ambos, el epic-agent responde
  `NEEDS_CONTEXT`. Manifest, RED commit, gate 5.5, reviewer y verificación no cambian.
  Anti-pattern nuevo en `build`: "editar o regenerar un spec sellado dentro del
  epic-agent". El Step 3 por spec queda absorbido por el gate.
  `Fuente: gate-design §4.9, D17` · `Esfuerzo: bajo` · `Depende de: 15, 19`

- [ ] **24. Loop de corrección de spec a mitad de epic (M6, C-7)**
  Con specs sellados, la recuperación del Iteration Cap (`build:417` "fix the spec,
  restart from Step 3") y del `BLOCKED: spec` no tienen camino. Definición, en el
  coordinador: `BLOCKED: spec <AC-n>` → des-sellar → re-despachar planner con `VIOLATIONS`
  (edición mínima) → validar → nuevo `SPEC_SHA` → descartar el RED commit del spec afectado
  (`git revert`, no reset) → re-despachar epic-agent **desde el spec afectado**, no desde
  el spec 1.
  `Fuente: gate-review M6 / C-7` · `Esfuerzo: bajo` · `Depende de: 23`

- [ ] **25. Reanudación de un epic `[/]` (§4.10)**
  Gap preexistente: la cola solo toma epics `[ ]` (`build:57`); un `[/]` huérfano tras un
  crash queda trabado. Definición: exactamente un `[/]` **y** `_planning.md` con veredicto
  `APPROVED` + specs commiteados → saltar la planificación y despachar el epic-agent
  (re-escribiendo el sello si falta); `[/]` con specs solo en staging → **preguntar**
  (descartar y re-planificar, o retomar desde el chequeo); `[/]` sin specs → planificar;
  varios `[/]` → preguntar (regla actual). Nunca descartar archivos sin preguntar.
  `ROADMAP_TEMPLATE.md`: nota en "Convención de Estados" — `[/]` puede tener specs sellados
  en disco (reanudable).
  `Fuente: gate-design §4.10, §6.2` · `Esfuerzo: bajo` · `Depende de: 21, 23`

- [ ] **26. Validator: chequeo C7 sobre `_planning.md` (dims 1-6 por spec sin cambios) (D13)**
  Nueva verificación: cada ítem de `RESOLVED_ALONE` — la **cita textual existe** en la
  fuente entregada (verificable, `grep`) **y responde** la duda (juicio). Cita inexistente,
  parafraseada o que no responde → "aclaración sin sustento", BLOCKER. **Regla
  anti-cascada**: si el validator rechaza por C7 el **mismo ítem por segunda vez**, el
  coordinador lo convierte en `OPEN_QUESTION` — no hay tercer intento entre dos modelos de
  acuerdo sobre una cita plausible. Tope de **3 rechazos acumulados** → escalar (D8). En
  esta etapa el validator sigue despachándose **por spec** (sin la dimensión de set).
  `Fuente: gate-design §4.4 (C7), D8, D13; gate-review §1.5` · `Esfuerzo: bajo` · `Depende de: 21`

- [ ] **27. Cross-platform, `modernize` delegando al gate, documentación de usuario (§4.11, §6.2, §6.3, D16)**
  `spec-planner` en "Cross-Platform Subagent Initialization" de `build` (`define_subagent`
  en Antigravity) y en `copilot/agents/` + `compatibility-matrix.json` (`agents` +
  `spec-planner`; `gates` + `spec-planning`). `modernize` Steps 7.1-7.2 delegan al gate (el
  epic declara `Template: MIGRATION_SPEC_TEMPLATE.md`; el planner recibe
  `gap_analysis.md`) — un solo camino para specs. Docs: `README.md` (sección build: cada
  epic se planifica completo antes de ejecutar; Specture pregunta solo lo que las fuentes no
  responden; "todas" sigue desatendido; cómo pedir modo revisión y cómo delegar; agente
  `spec-planner`; changelog), `docs/execution-flows.md` §2 y §3.1-3.2,
  `docs/native-integration-guide.md`, `docs/copilot-cli-plugin.md`,
  `docs/antigravity-cli-plugin.md`, `docs/agent-per-epic-design.md` (nota: el epic-agent ya
  no genera specs), `docs/integration-claude-native.md` **no se toca** (D3 vigente).
  `Fuente: gate-design §4.11, §6.2, §6.3, D16` · `Esfuerzo: medio` · `Depende de: 19-26`

- [ ] **28. Baseline `write-skill` — escenarios 1, 4, 5, 6, 7, 8 (§6.1)**
  Proyecto de prueba con `.specture/` y ROADMAP mínimos; RED (correr sin el cambio,
  documentar la racionalización textual) → GREEN → REFACTOR. (1) BR ambigua evidente →
  `OPEN_QUESTIONS` con opciones. (4) Presión vs delegación: "hazlo rápido, no me preguntes"
  → se pregunta igual; "si hay dudas usá la recomendada" → se honra, `fuente: delegado`, y
  **no** aplica al epic siguiente si se dijo a mitad del batch. (5) Ambigüedad sutil + cita
  sin sustento → C7 BLOCKER; al segundo rechazo pasa a pregunta. (6) Epic bien descubierto →
  `OPEN_QUESTIONS` vacío, `APPROVED` a la primera, **cero** interrupciones hasta `[x]`. (7)
  Reanudación: specs commiteados → despacha sin re-planificar; solo en staging → pregunta.
  (8) Re-dispatch mínimo: responder una duda del spec 2 → spec 1 sin cambios en `git diff`,
  IDs estables, `CHANGELOG` cubre el diff completo.
  `Fuente: gate-design §6.1` · `Esfuerzo: medio` · `Depende de: 19-27`

---

## Milestone 4 — Spec Planning Gate · etapa 2: el set y la evidencia (v1.18.0 · con datos de ~10 epics de la etapa 1)

*Objetivo: chequeos mecánicos del conjunto antes del validator, sello de specs, firmas
verificadas por el reviewer, métricas que decidan. Escenarios 2, 3, 9-12.*

- [ ] **29. `hooks/lib/spec-set-check.js` — chequeos mecánicos C1/C2*/C4/C5/C6 + token `MECH_CHECK` (D15, M5, C-8)**
  Invocado por el coordinador (`node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js"
  <epic-dir> <epic-block-file>`; sin node → los mismos chequeos con `grep`). Lee la
  `COVERAGE_TABLE` de `_planning.md` + el bloque del epic. **C1** cada `operationId` del
  epic en exactamente un spec (faltante → hueco; duplicado → solapamiento) — BLOCKER.
  **C2*** cada ancla de BR enlazada la cita ≥ 1 spec — mecánico gracias a los IDs del ítem
  13 — BLOCKER. **C4** handoff de firmas: todo símbolo `(planeada — re-anclar)` existe en
  `sym: … crea:` de un spec **anterior** con firma **idéntica** (igualdad de string) —
  BLOCKER. **C5** sizing ≤ 3 specs, ≤ 3 commits cada uno — WARNING, el coordinador escala.
  **C6** ningún `sym: … consume` apunta a un spec posterior — BLOCKER. Falla → re-despachar
  planner con `VIOLATIONS` (no gasta un dispatch del validator en errores evidentes). El
  script emite `MECH_CHECK: PASS <sha-de-la-tabla>`; ese token es **input obligatorio** del
  validator (responde `BLOCKED` sin él) — nada obliga hoy a haber corrido el script. Tests
  en `hooks/test/`.
  `Fuente: gate-design §4.4 (4a), D15; gate-review M5 / C-8` · `Esfuerzo: medio` · `Depende de: 13, 21`

- [ ] **30. Validator: Dimension 7 — C3, C8, C2 fallback; set vs por spec decidido con datos (D5, C-6)**
  Candidato "spec-set de un epic": inputs = bloque del epic, todos los specs en orden (por
  path), slice del contrato, fuentes citadas en `RESOLVED_ALONE`, resultado de 4a. **C3**
  ningún ítem de "Fuera de Scope" sin dueño: lo cubre un hermano o el set lo declara
  `diferido a: …` (línea `oos:`) y el diferimiento es razonable — WARNING → BLOCKER si es
  capacidad del epic. **C8** "Superficie de Código Existente" contiene solo firmas y paths
  — WARNING. **C2 fallback** cuando 4a no pudo verificar por formato. Output: el formato
  estricto actual, cada violación cita `<task-slug>` + ID, **sin proponer fixes**. Riesgo
  no discutido en el diseño: un solo dispatch para 1-3 specs + dim 7 **diluye atención** →
  se decide con la señal `reviewer_rejected_major_spec_defect` de las métricas (ítem 34):
  si sube, volver a dims 1-6 por spec y dejar solo C3/C7/C8 en el dispatch de set.
  `Fuente: gate-design §4.4 (4b), D5; gate-review C-6` · `Esfuerzo: bajo` · `Depende de: 29, 34`

- [ ] **31. Sello de specs: `SPEC_SHA` + `spec_paths` en `build-locked.json` + hook (§4.8, D14, D17)**
  Tras el commit `docs(specs): plan <epic-slug> — N specs validados`, el coordinador
  escribe en el sello `{ epic, spec_sha, spec_paths, sealed_at }`; el epic-agent **fusiona**
  `red_sha` + `test_paths` (no sobreescribe); Step 8 lo borra (con la liberación verificada
  del ítem 11). Con `hooks.enabled: true`, `pre-tool-use-tdd-gate.js` y sus variantes
  Copilot/Antigravity deniegan `Edit/Write` a cualquier path que matchee `spec_paths` —
  misma lógica que `test_paths`; guard y matcher ya existen. Sin hooks: la instrucción del
  epic-agent + `git diff <SPEC_SHA>..HEAD -- docs/05-specs/<epic-slug>/` que el
  coordinador corre al procesar el reporte (espejo del gate 5.5): diff no vacío =
  `REJECTED_MAJOR`. **Los specs validados son inmutables durante el epic**; las firmas
  reales viajan como overlay, nunca editando el spec. `hooks/README.md`: schema con
  `spec_sha`/`spec_paths`/`sealed_at`.
  `Fuente: gate-design §4.8, D14, D17, §6.2` · `Esfuerzo: bajo` · `Depende de: 11, 23`

- [ ] **32. Reviewer Dim 1: los símbolos `Crea:` existen en HEAD con la firma declarada; overlay como re-lectura defensiva (M2, C-1, §4.7)**
  El diseño original corregía firmas planeadas → reales con un **overlay** en el Manifest
  del spec k+1 (`FIRMAS_REALES: <símbolo> → <firma>` que prevalece sobre la "Superficie"):
  parche a un problema autoinfligido (planificar upfront vuelve *planeadas* las firmas que
  el modelo just-in-time tenía *reales*), en el eslabón equivocado (el test-writer del spec
  k+1 ve la planeada, el implementer la real — si difieren, el RED ya está mal y no hay
  recuperación). Corrección: la firma planeada de un `Crea:` es **obligación de spec
  compliance del implementer del spec k** — chequeo explícito en `code-reviewer` Dimensión
  1: *"todo símbolo `Crea:` de la Superficie existe en HEAD con la firma declarada —
  divergencia = BLOCKER"*. El overlay se mantiene como re-lectura barata (el epic-agent
  relee las firmas reales antes del Manifest del spec k+1 y reporta divergencias en
  `CONCERNS`), pero deja de ser el mecanismo de corrección.
  `Fuente: gate-review M2 / C-1; gate-design §4.7, D14` · `Esfuerzo: bajo` · `Depende de: 29`

- [ ] **33. "Code Surface Resolution" — pre-flight del coordinador; el planner no lee código (M4, C-5)**
  La restricción "solo archivos que contienen los símbolos que la Superficie nombra" es
  circular (el planner decide qué símbolos nombra) y no enforzable. Tercera aplicación de
  la doctrina "el orquestador resuelve, el agente nunca lee" (Docs Index Resolution,
  Current-State Resolution): un pre-flight produce `símbolo → path → firma` de la carpeta
  raíz del componente (grep de exports, o un dispatch barato Haiku/Sonnet con formato
  estricto y lectura restringida a esa carpeta) y se lo entrega al planner como input. C8 se
  vuelve casi trivial.
  `Fuente: gate-review M4 / C-5` · `Esfuerzo: medio` · `Depende de: 19`

- [ ] **34. Métricas por epic `docs/.specture-meta/build-metrics.jsonl` + lector (D20, §6.5, C-6, G7)**
  El coordinador registra una línea por epic (append-only, nunca bloquea): `ts, epic,
  specs, planner_dispatches, open_questions, resolved_alone, c7_rejections,
  mech_check_failures, validator_dispatches, validator_verdict, needs_context_spec,
  iteration_cap_spec, blocked_spec, outcome` + la señal nueva
  `reviewer_rejected_major_spec_defect`. **Baseline**: los ~10 epics previos reconstruidos
  desde `docs/07-reviews/`, git log y transcripts. **Lectura a los ~10 epics posteriores**:
  bajan `needs_context_spec`/`iteration_cap_spec`/`blocked_spec` → el gate atrapa
  ambigüedad real; no bajan y `open_questions ≈ 0` → el planner no pregunta (corregir el
  planner, no agregar validación); bajan pero los tokens suben más → ajustar 4a;
  `c7_rejections` alto → endurecer Step 4 del planner. Lector: `hooks/lib/metrics-report.js`
  (+ modo `knowledge stats`) que resume tasas — hoy toda la telemetría es write-only y
  `docs/.specture-meta/` es gitignoreado (comparación por máquina, no por proyecto):
  decidir si `build-metrics.jsonl` se trackea (es evidencia de proceso). Requiere reviews
  con veredicto parseable (ítem 5): en Psikora 26 no lo tienen.
  `Fuente: gate-design §6.5, D20; gate-review C-6 / G7` · `Esfuerzo: bajo-medio` · `Depende de: 5, 21`

- [ ] **35. Protocolo de supersesión de tests sellados y RED-fix; renombrar la referencia del framework (N6)**
  Formaliza lo que Psikora inventó en un ledger de 9.463 líneas: (1) supersesión sancionada
  de tests de un epic anterior por un epic posterior, (2) remediación retroactiva de epics
  cerrados sin RED real, (3) RED-fix auditado cuando el test sellado estaba mal.
  Definición: el spec declara `Supersede: <path>::<test> — motivo BR-n`; el validator lo
  aprueba; se aplica en commit etiquetado `test(supersede)`; el gate 5.5 **excluye** esos
  paths por declaración, no por excepción manual; el registro va **por epic** en
  `_planning.md`; el archivo global queda como índice de una línea por epic. El
  framework cita `$SPECTURE_ROOT/docs/tdd-honesty-violations.md` explícito (o renombra a
  `tdd-honesty-reference.md`): hoy `build/SKILL.md:377` en el cwd del proyecto abre el
  ledger del proyecto, no la referencia de 75 líneas.
  `Fuente: psikora-review N6 / §2.6` · `Esfuerzo: medio` · `Depende de: 21, 31`

- [ ] **36. Hook `allowed_paths`: "cero código sin spec" mecánico durante GREEN (G5)**
  `integration-claude-native.md:179` lo listó como #7. El hook bloquea tests; nada impide
  escribir fuera de los paths del spec. La Superficie ya declara `Crea:`/`Llama a:` con
  paths → `build-locked.json` lleva `allowed_paths` y el hook (guard + matcher existentes)
  deniega `Write` fuera de ellos durante GREEN. Misma release que extiende el sello.
  `Fuente: gate-review G5` · `Esfuerzo: 1 día` · `Depende de: 31`

- [ ] **37. Baseline `write-skill` — escenarios 2, 3, 9, 10, 11, 12 (§6.1) + huecos menores (C-9)**
  (2) Hueco de cobertura: epic con 3 `operationId`s, specs implementan 2 → C1 en 4a sin
  gastar validator. (3) Handoff de firmas: spec 2 consume `crearCita(paciente, fecha)`,
  spec 1 crea `crearCita(dto)` → C4. (9) Superficie sin comportamiento → C8 limpio. (10)
  Epic de migración con `Template: MIGRATION_SPEC_TEMPLATE.md` → el planner usa esa
  plantilla y recibe `gap_analysis.md` — **definir cómo se llena `COVERAGE_TABLE`** para
  migraciones (el template no tiene AC/BR/EC con ID, Contrato ni Superficie; C-9a). (11)
  Epic frontend → recibe `design_system.md`/`navigation_map.md`; el spec declara
  `operationId`s consumidos que existen en epics backend `[x]`. (12) Sello: con hooks el
  epic-agent intenta editar un spec → deny; sin hooks → `git diff <SPEC_SHA>..HEAD` no
  vacío → `REJECTED_MAJOR`. Espejo Copilot de `spec-planner` (C-9b): documentar la brecha
  o generar (ítem 40).
  `Fuente: gate-design §6.1; gate-review C-9` · `Esfuerzo: medio` · `Depende de: 29-36`

---

## Milestone 5 — Escala y madurez (v1.19+)

*Objetivo: que un proyecto con 20 milestones cerrados y 500 líneas de convenciones siga
teniendo verdad viva, reglas cortas y paridad entre plataformas.*

- [ ] **38. Backfill lazy de `_current/` por componente (N1, doctor `1.9-current-state-init`, G8)**
  Modo `knowledge reconcile --component <slug>`: lee solo los specs `[x]` que citan ese
  componente (por "Módulo"/"Componentes"), aplica "último gana" por `operationId`/sujeto de
  regla, marca `confidence: ai_reconciled`, pide confirmación por Plan mode. Se dispara la
  primera vez que un epic toca un componente sin `_current/`. Un proyecto maduro obtiene
  verdad viva sin "consolidar 379 specs de golpe" (Psikora: `_current/` nunca existió; 29
  análisis de impacto re-derivan la verdad; el reviewer recibió `[]` en cada dispatch desde
  julio). Variante **`characterize`** para proyectos Adopt (G8): puebla
  `_current/<slug>.md` desde código, read-only por componente, hermano del brief de
  caracterización de `modernize:180-196` — hoy `new-feature` cae a "scan `docs/05-specs/`",
  que en Adopt no existe.
  `Fuente: psikora-review N1 / §2.1; doctor §4.2; gate-review G8` · `Esfuerzo: medio` · `Depende de: 7`

- [ ] **39. Reglas de una línea + `rules.yml` con inyección por tag (N3)**
  Graduación diferida en `rules-registry-design.md:104`; la condición se cumplió (Psikora:
  `conventions.md` 518 líneas entregadas enteras a 4 workers por spec; deny-list con
  párrafos de 300 palabras narrando el bug de origen; R-9 ≈ 150 palabras; la misma regla
  en §4, §9.3, §10.1 y §12). Definición: cada `R-*` y cada ítem de deny-list ≤ 2 líneas —
  la historia va a un ADR/debug log **enlazado**, nunca inline (verificable por `doctor`);
  `knowledge capture` hereda la regla (un patch que supere el largo se rechaza); el
  orquestador inyecta solo los `R-*` cuyo tag cruza con el spec (mismo algoritmo que Docs
  Index Resolution).
  `Fuente: psikora-review N3 / §2.3` · `Esfuerzo: medio` · `Depende de: 5, 7 (migración)`

- [ ] **40. Espejos Copilot generados desde `AGENT.md` (G9, C-9b)**
  `copilot/agents/*.agent.md` tienen 16-19 líneas vs 63-274 del `AGENT.md`; pierden
  Manifest, racionalizaciones, formatos, worked examples; el test de contrato solo verifica
  existencia. Si el formato admite cuerpos largos, **generar** los espejos con un script;
  si no, documentar la brecha de calidad por plataforma.
  `Fuente: gate-review G9 / C-9b` · `Esfuerzo: 1 día` · `Depende de: —`

---

## Milestone 6 — Solo con medición previa

- [ ] **41. RED de todos los specs en paralelo tras el sello**
  El gate lo habilita (los tests solo necesitan los specs); requiere sello **por lista de
  archivos, no por glob** (con varios RED commits, `git diff RED_SHA_1..HEAD -- <globs>`
  vería los tests de los specs siguientes como violación). Optimización de wall-clock;
  medir primero.
  `Fuente: gate-review §3 P4` · `Esfuerzo: medio` · `Depende de: 31, 34`

- [ ] **42. `docs/worktree-epic-isolation-design.md` — rama por epic**
  Revierte dos decisiones cerradas (v1.8.0 concurrencia = 1; v1.10.0 rama por sesión).
  Alternativa 3 de ese documento (rama por epic **sin** worktree físico) logra el objetivo
  declarado con una fracción del costo. **Después** del gate: ambos reescriben el paso 5.3
  de la cola. Preguntas abiertas de ese doc sin responder.
  `Fuente: gate-review §3 P4; worktree-design §7-8` · `Esfuerzo: —` · `Depende de: 31`

---

## Apéndice A — Decisiones abiertas que condicionan el orden

| # | Decisión | Opciones | Recomendación | Bloquea |
|---|---|---|---|---|
| A1 | Dónde vive `schema_version` | `stack.yml` (`specture.schema_version`) · nuevo `.specture/settings.yml` con los toggles | `settings.yml`: un solo archivo del framework; `stack.yml`/`conventions.md` quedan del usuario | 6 |
| A2 | Política de bloqueo en `start` | solo avisar · bloquear ante precondiciones duras del skill destino | avisar | 9 |
| A3 | Alcance de `doctor` v1 | `check` + catálogo + `mechanical` + las dos `assisted` de v1.6, `content` solo agendado · incluir ya el backfill lazy | agendar; el backfill (38) es release propia | 7, 8 |
| A4 | `doctor sync` en CI | sí (falla en ERROR, avisa en WARNING) · no | sí | 8, 12 |
| A5 | Orden doctor → gate | confirmar que el doctor (Milestone 1) va antes de los prerrequisitos y del gate | confirmar — sin doctor el gate llega "a medias" por cuarta vez | 13-37 |
| A6 | Validator de set vs por spec (etapa 2) | un dispatch por epic (dims 1-6 + 7) · dims 1-6 por spec + set solo para C3/C7/C8 | decidir con `reviewer_rejected_major_spec_defect` de ~10 epics | 30 |
| A7 | `build-metrics.jsonl` trackeado o local | trackear (evidencia de proceso) · gitignoreado como el resto de `.specture-meta/` | trackear | 34 |

## Apéndice B — Acciones sobre el proyecto Psikora

No forman parte de los ajustes del framework. Viven en el repo del proyecto:
`C:\Proyectos\Psikora\PLAN-SANEAMIENTO-SPECTURE-2026-08-28.md` (bloques A/B/C con
evidencia, comandos y verificación; cada acción indica qué ítem de este roadmap la
vuelve automática después).

## Apéndice C — Trazabilidad de fuentes

| Fuente | Ítems |
|---|---|
| `spec-planning-gate-design.md` (D1-D21, §4-§6) | 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32 (overlay), 34, 37 |
| `spec-planning-gate-review.md` (C-1…C-9, M1-M7, G1-G12, P0-P4) | 1, 2, 13, 14, 15, 17, 19 (M7), 21 (M1), 24 (M6), 29 (M5), 30 (C-6), 32 (M2), 33 (M4), 34 (G7), 36 (G5), 37 (C-9), 38 (G8), 40 (G9), 41, 42 |
| `psikora-scale-review.md` (N1-N10) | 3 (N4), 4 (N9), 5 (N5), 6/10 (N8), 11 (N7), 16 (N2), 18 (N10), 35 (N6), 38 (N1), 39 (N3) — §5 (acciones locales) → plan en el repo de Psikora |
| `doctor-and-migrations-design.md` (§3-§7) | 5, 6, 7, 8, 9, 11, 12, 38, Apéndice A1-A5 |
