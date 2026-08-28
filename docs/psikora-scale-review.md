> **Estado: REVISIÓN A ESCALA — 2026-08-28.** Reporte solicitado por el usuario tras
> observar en Psikora (`C:\Proyectos\Psikora`, proyecto real sobre Specture) que la
> documentación crece sin control, conserva decisiones ya cambiadas, produce errores
> de mención a documentos/reglas y coincide con una baja en la calidad de las
> entregas. Pregunta: ¿hay oportunidades de mejora nuevas, o ya estaban cubiertas en
> `docs/spec-planning-gate-review.md`? **Solo lectura sobre Psikora; no se modificó
> nada allí.** Toda cifra sale de `git`, `wc`, `grep` sobre HEAD `ed88b99d` (develop).

# Revisión a escala: Specture en Psikora (4,5 meses · 2.296 commits · 379 specs)

## 0. Resumen ejecutivo

1. **Tu diagnóstico es correcto y es medible.** En Psikora hay más commits de
   documentación (`docs:` 730 + `spec:` 60) que de código (`feat:` 390 + `fix:` 231 +
   `refactor:` 24). El corpus de Specture del proyecto suma **~100.000 líneas de
   markdown** (46,6k reviews · ~69k specs según el propio ROADMAP · 9,5k de un
   ledger · 4,5k de ROADMAP+archivo · 4,2k de ADRs) para un producto de tres apps.
   En agosto el 32 % de los reviews con veredicto fueron `REJECTED` (19 % en junio),
   y **el 13 % de los hallazgos de agosto son sobre prosa** —citas invertidas, notas
   del ROADMAP que no existen, ledger que transcribe mal— no sobre código.
2. **La causa no es "escribir mucho": son cinco mecanismos que el framework habilita y
   no contiene** (§2): (a) la verdad viva `_current/` **nunca se materializó** —todo
   quedó histórico y cada análisis de impacto re-deriva la verdad—; (b) el spec
   absorbió lo que no tiene hogar (decisiones del usuario, deuda, divergencias,
   inventarios de supersesión, presupuestos: specs de 400-994 líneas); (c) las reglas
   se escriben con biografía (`conventions.md` 518 líneas, entregadas enteras a cada
   worker); (d) 5.229 citas por número de línea a documentos vivos; (e) no existe
   ningún verificador mecánico del corpus documental — los errores de mención solo
   los atrapa un reviewer Opus leyendo.
3. **Cobertura respecto a la revisión anterior:** ~40 % de lo observado ya estaba
   cubierto (G3 IDs estables, G4 gate del ROADMAP, G7 métricas, M1 `_planning.md`,
   spec-planner). Pero **la mayor parte del crecimiento es un problema nuevo** que
   esa revisión no vio porque miraba el diseño del gate, no un proyecto maduro: hay
   **10 oportunidades nuevas** (§4), y la más barata y de mayor impacto es un
   **lint mecánico del repo documental** (`specture doctor`) que habría atrapado 24
   rutas rotas, un sello huérfano, un ADR duplicado y 26 reviews sin veredicto.
4. **Advertencia sobre el Spec Planning Gate:** Psikora demuestra que **agregar un
   artefacto sin retirar otro empeora el problema**. El gate solo es neto positivo si
   `_planning.md` **reemplaza** las secciones narrativas que hoy viven dentro de los
   specs (§6). Y confirma la necesidad del planner: el usuario ya se había construido
   uno fuera del framework (`pm-spec-writer`, con 15 ambigüedades en memoria
   persistente, hoy obsoletas).

---

## 1. Los números

| Dimensión | Valor | Comentario |
|---|---|---|
| Commits / periodo | 2.296 · 2026-04-14 → 08-27 | 861 solo en agosto (mes más intenso) |
| Tipos de commit | `docs` 730 · `test` 566 · `feat` 390 · `fix` 231 · `chore` 191 · `spec` 60 | prosa (790) > código productivo (645) |
| Specs | 205 carpetas · 379 `.spec.md` · ~69k líneas | 6 estilos de nombre de carpeta (`epic-1.2`, `epic-1-4`, `consent-rediseno.21`, `reactividad.9`, `epic-reactividad.4`, `puesta-al-dia.4-openapi-snapshot`) |
| Tamaño medio de spec por época | epic-0/1: 162-178 · epic-fe: 107 · epic-precio: 97 · **consent-rediseno: 398 (máx. 994)** | ×2-4 en la última familia |
| Reviews | 266 archivos · 46.619 líneas | 26 sin veredicto parseable; 21 con nombres fuera de patrón (`independent-review-*`, `self-review-*`, `fidelity-*`, `security-review-*`) |
| Tasa de rechazo (con veredicto) | may 23 % · jun 19 % · jul 0 % (15 sin veredicto) · **ago 32 %** | 20 de 63 en agosto |
| Hallazgos de agosto sobre prosa | 28 de 212 líneas `[BLOCKER|IMPORTANT]` (13 %) | ej.: *"BR-9 rests on a factually inverted citation"*, *"remite a una nota del ROADMAP que no existe"*, *"la cita `ROADMAP.md:4016-4022` no apunta a la deuda que dice citar"*, *"Corrupción de bytes en ROADMAP.md"* |
| Debug logs | 49 · 5.761 líneas | 15 en agosto |
| ADRs | 38 · 4.229 líneas | **`012` duplicado** (dos archivos); `ADR-012` es el más citado del repo (726 menciones); formato de `Status` inconsistente (`## Status` vs `**Status:**`) |
| ROADMAP | 2.303 líneas + `archive/ROADMAP_current.md` 2.165 | **1 epic `[ ]`, 0 `[/]`, 50 `[x]`** — 2.300 líneas para un epic pendiente |
| `_current/` | **no existe** | reconciliación (Step 8.7) nunca corrió; archivado "a medias" el 08-27; un primer intento el 08-22 **perdió 94 IDs de epic** |
| Requerimientos | `business_requirements.md` 695 líneas (+ "Adenda v1.2", "Adenda v1.3" apendizadas) + **16 `feature-*.md`** (3.000 líneas) | la verdad de negocio está en 17 archivos; `build` solo pasa el primero a los agentes |
| `docs/05-specs/` raíz | 31 archivos sueltos: 29 `_impact-analysis-*` (uno de 603 líneas con "adenda" que fija el orden de ejecución), `_open-questions-*`, `_revision-*` | roadmap-sombra |
| `conventions.md` | 518 líneas · §12 con 10 `R-*` (R-9 ≈ 150 palabras) · deny-list con párrafos de 300 palabras y "Origen: debug …" · §14 añadido por un epic | se entrega **entera** a implementer, reviewer y test-writer en cada dispatch |
| `docs/tdd-honesty-violations.md` | **9.463 líneas · 616 encabezados** | ledger global de supersesiones; referenciado por 57 archivos y 36 specs de `consent-rediseno` |
| Citas por número de línea (`x.md:NNN`, `x.tsx:NNN`) | **5.229** en docs + .specture | archivos con más: reviews y specs de agosto (44-59 cada uno) |
| Rutas citadas que no existen | 24 de 469 únicas (5 %) | `api-contract.md`, `api-contract.openapi.yaml` (el proyecto usa `.json`), paths con `...` sin rellenar, `epic-ux-fixes.1/` vs `epic-ux-fixes.1.1/` |
| `.specture/state/build-locked.json` | sellado **2026-08-21** para `consent-rediseno.7` (hoy `[x]`); campos improvisados `red_sha_spec_01`, `red_fix_note` | con `hooks.enabled: true`, 8 paths de test siguen **bloqueados** para cualquier trabajo futuro |
| `.claude/agent-memory/pm-spec-writer/` | agente casero (2026-04-17, pre-Specture) con `AMB-001…015` "sin resolver hasta nueva indicación" | la mayoría ya resueltas por ADR-019…022; conocimiento en memoria, fuera del repo, **obsoleto** |
| Retrospectiva del usuario (2026-08-21) | 83 commits, 56 `docs` (67 %); 12 entradas nuevas al ledger; 4 reviews, todos `REJECTED_MINOR` | causa raíz declarada: *"verificador más estrecho que la afirmación"* + anclas por línea + checkout compartido |

---

## 2. Diagnóstico: los mecanismos de crecimiento y de error

### 2.1 La verdad viva nunca se materializó → todo es histórico, nada es presente

`_current/` no existe. El ROADMAP lo dice con precisión (`ROADMAP.md:39-47`): construirlo
*"exige consolidar 379 specs (~69k líneas) con juicio de supersesión — tarea propia,
todavía sin agendar"*. Consecuencias observables:

- Los 29 `_impact-analysis-*.md` **re-derivan** la verdad cada vez leyendo specs
  históricos (`new-feature:62` cae a "scan `docs/05-specs/`"); el de consentimiento
  tiene 603 líneas y una "adenda" que **fija el orden de ejecución** de 15 epics —
  planificación viviendo fuera del ROADMAP.
- Las decisiones cambiadas siguen visibles con el mismo peso que las vigentes: ADR-017
  (Nager) y ADR-018 (festivos-colombia) coexisten; `psikora-portal.jsx` tiene
  componentes "SUPERSEDED — prohibido portar" explicados en 8 líneas de
  `conventions.md` §9.2 en lugar de una línea en `_current/`.
- El archivado a lápida se hizo **a mano, dos veces, y la primera perdió 94 IDs**.

**Atribución:** framework. La reconciliación (v1.9.0) está diseñada para correr *hacia
adelante* al cerrar cada milestone; **no tiene modo de backfill** para un proyecto que
ya cerró 20. Y el colapso a lápida es prosa ejecutada por un LLM, no un script.
`reconciliation-design.md:131` difirió exactamente esto.

### 2.2 El spec absorbió todo lo que no tiene hogar

Comparar un spec de mayo (`epic-1.2/03`, 350 líneas, secciones del template) con uno de
agosto (`consent-rediseno.21/08`, 994 líneas). El de agosto agrega, fuera del template:
*"🔴 Decisión de usuario que gobierna este spec (no se reabre)"*, *"🔴 Deuda que este
spec NO salda"*, *"🔴 Divergencias frente al handoff — las siete"* (100 líneas),
*"Registro documental"*, *"🔴 Supersesión de tests ya sellados (inventario COMPLETO)"*,
*"🟡 Presupuesto de tiempo"*, *"🟢 AC que nacen verdes"*, y los AC agrupados **por
archivo de test** (`### A. … — __tests__/…test.tsx`). El spec dejó de ser un contrato y
pasó a ser **contrato + acta de decisiones + registro de deuda + plan de tests + ledger**.

Cada sección extra existe porque el framework **no le dio hogar** a esa información:
las decisiones del usuario no tienen artefacto (→ M1 `_planning.md`), la deuda no tiene
dueño formal (→ ROADMAP), las divergencias del handoff no tienen registro (→
`handoff-mapping.md` existe pero el spec las repite), la supersesión de tests no tiene
protocolo (→ §2.6), y los tests que "nacen verdes" contradicen la regla RED sin que el
framework diga qué hacer con guards de no-regresión.

**Atribución:** framework (ausencia de hogares) + práctica (nadie podó). El
`architecture-validator` no tiene dimensión de **tamaño/forma** del spec: aprueba 994
líneas igual que 150.

### 2.3 Reglas con biografía: `conventions.md` como bitácora

`conventions.md` tiene 518 líneas y va **entera** a implementer, ux-implementer,
code-reviewer y tdd-test-writer en cada dispatch (hot path). Dentro:

- Deny-list §4 con entradas de 250-300 palabras que narran el bug de origen
  (*"Origen: BLOCKER real en `epic-colapso-pago.2` — `CancelarCitaPorPacienteCommandHandler`
  asumía que…"*).
- §12 formalizó 10 `R-*` **sin retirar** el texto original (*"el texto original se
  mantiene donde vive; esta tabla es la referencia citable"*): la misma regla vive en
  §4, §9.3, §10.1 y §12 (R-3, R-8).
- §7 con reglas puntuales de Moq y `vi.useFakeTimers` con su historia; §7.1.1 cita
  *"regla §7.1 línea 188"* (una cita por línea dentro del propio documento).
- §14 completo (45 líneas) **añadido por un epic** (`consent-rediseno.19/01`).
- El bloque `Settings` desplazado al inicio porque el §10 real del proyecto es
  "Consumo del API real" — el framework acopla su configuración a un **número de
  sección** de un documento del usuario.

**Atribución:** framework. `rules-registry-design.md:104` difirió *"graduar a
`rules.yml` con inyección selectiva por tag cuando §12 crezca"*; la condición se cumplió
y nadie mide. Y el skill `knowledge` capture **agrega** patches a conventions (7
capturas registradas en `learn-history.jsonl`) sin ninguna regla de **longitud** ni de
**dónde va la historia** (ADR/debug log) vs **dónde va la regla** (una línea).

### 2.4 Anclas frágiles: 5.229 citas por número de línea

El framework **premia** `archivo:línea` (`code-reviewer:274` "Cite file:line";
`architecture-validator:92` "citing exact line"). Para un diff a SHA fijo es correcto;
para ROADMAP, specs, mapping y ledger —que hermanas editan en secuencia— produce
exactamente el caso de la retrospectiva §3.2: cuatro citas sucesivas todas correctas
en su momento y todas falsas después, propagadas a cuatro documentos. Hoy hay 5.229
citas así, y `conventions.md` §7.1.1 cita una línea de sí mismo.

**Atribución:** framework (la instrucción no distingue código-a-SHA de documento vivo).
Cubierto por la retrospectiva (P-1), **no** por `spec-planning-gate-review.md`.

### 2.5 Nadie verifica mecánicamente el corpus documental

Todo lo que el usuario llama "errores de mención" es detectable con `grep` + `test -e`:
24 rutas citadas que no existen, dos `ADR-012`, 26 reviews sin veredicto, paths con
`...` sin rellenar en ROADMAP y reviews, `docs-index.yml` existente mientras §11 dice
que no existe, un sello para un epic cerrado. Hoy el único verificador es un
`code-reviewer` Opus leyendo con el código al lado — y por eso el 13 % de sus hallazgos
son sobre prosa: **está haciendo de linter**.

**Atribución:** framework. `write-skill:51`: *"if a regex can enforce it, automate it"*.
No hay ningún script que lo haga. Es la oportunidad más barata de todo el reporte.

### 2.6 Ledger global, colisión de nombre y tres procedimientos inventados

`docs/tdd-honesty-violations.md` tiene **9.463 líneas**. Es el mismo nombre que el
documento de referencia del framework (`$SPECTURE_ROOT/docs/tdd-honesty-violations.md`,
75 líneas) que `build/SKILL.md:377` ordena leer al fallar el gate — en el cwd del
proyecto, esa instrucción **abre el ledger de 9.463 líneas**. El ledger existe porque el
proyecto necesitó tres cosas que el framework no tiene: (1) **supersesión sancionada**
de tests sellados por un epic posterior (categoría 2), (2) **remediación retroactiva**
de epics cerrados sin RED real (categoría 3), (3) un **RED-fix** auditado cuando el test
sellado estaba mal ("TDD Recovery Opción 2"). Los inventó, los documentó en un archivo
global, y 36 specs lo citan.

**Atribución:** framework. El TDD Honesty Gate solo contempla "el implementer tocó
tests → violación". No tiene camino para "el spec k+1 cambia por diseño el contrato del
spec j" ni para "guards que nacen verdes". El proyecto lo resolvió con prosa acumulativa.

### 2.7 Sello huérfano y schema improvisado

`build-locked.json` sella `consent-rediseno.7` desde el 2026-08-21; el epic está `[x]`;
hay 0 epics `[/]`. Con hooks activos, esos 8 paths quedan denegados para cualquier
trabajo — el próximo epic que toque `CitaModal.adulto-menor.test.tsx` recibirá un
deny inexplicable. El schema tiene `red_sha_spec_01`, `red_sha_spec_01_original`,
`red_fix_note`: el framework define **un** `red_sha` por epic, pero un epic tiene 1-3
specs con RED propio — el proyecto tuvo que inventar campos.

**Atribución:** framework. Step 8 delega el borrado al epic-agent sin verificación del
coordinador; el hook no comprueba que el epic sellado siga `[/]`; el schema no modela
multi-spec (`hooks/README.md:49-58`).

### 2.8 Nombres fijos que el proyecto no usa

Los skills citan `api-contract.md` y `api-contract.openapi.yaml`; Psikora declara
`stack.yml.api.contract_file: docs/02-architecture/api-contract.openapi.json` y no tiene
compañero `.md`. Resultado: 2 de las 24 rutas rotas, y —más grave— el validator nunca
tuvo el input de la Dimensión 6, lo que el proyecto pagó con `conventions.md` §14:
*"describía el 0 % de la superficie de respuesta real (129 de 131 operaciones solo
traían el 200 vacío)"*. El "contrato como fuente de verdad" fue nominal durante meses.

**Atribución:** framework (no lee `contract_file`; asume dos nombres).

### 2.9 Requerimientos fragmentados y sin poda

`business_requirements.md` creció por **adendas apendizadas** (v1.2, v1.3) — el patrón
bitácora que la D18 del gate prohíbe — y `new-feature` produjo 16 `feature-*.md` que
nunca se fusionaron (Step 1 ofrece "temporal o append, preguntá al usuario"). `build`
solo entrega `business_requirements.md`: las reglas de los `feature-*` son invisibles
para los agentes salvo que alguien las pegue a mano en el epic. El proyecto **sí**
inventó IDs estables (`RN-SEG-007`, `RN-PAGO-006`; 50 únicos) — confirma G3.

### 2.10 Concurrencia sobre un checkout compartido

La retrospectiva documenta dos reviewers concurrentes, un `git add -A` que capturó 15
archivos ajenos y un `--amend` sobre el commit de otro agente. El framework fija
concurrencia = 1 **entre epic-agents**, pero `build` Step 6 invita a paralelizar
reviewer ∥ linter ∥ type-checker y nada prohíbe dos reviewers a la vez ni que un
reviewer **mute archivos** (validación por mutación). Relacionado con el diseño de
worktrees pendiente.

---

## 3. ¿Ya estaba cubierto? Mapa contra la revisión anterior y la retrospectiva

| Síntoma en Psikora | Cubierto por | Estado |
|---|---|---|
| Reglas de negocio sin ID estable; citas "§X" | `spec-planning-gate-review.md` **G3/C-4** (template + `RN/CL/FA`) | Cubierto — Psikora lo confirma (ya inventó `RN-*`) |
| ROADMAP con dependencias reescritas a mano, orden numérico ≠ orden real, huecos sin dueño | **G4** (gate del validator sobre el ROADMAP) | Cubierto parcialmente — falta el **script de lápidas** (N1) |
| Decisiones del usuario, deuda y divergencias dentro del spec | **M1** (`_planning.md`) + **C-2** | Cubierto en intención; **falta la regla de poda** (N2) — sin ella M1 suma un artefacto más |
| Ambigüedades resueltas en memoria de agente (`pm-spec-writer`), hoy obsoletas | **spec-planner** (D10/D13: todo escrito con cita, nada en memoria) | Cubierto — Psikora es la prueba de la necesidad |
| Reviews sin veredicto parseable; sin métricas | **G7** (lector de métricas) | Cubierto parcialmente — falta **formato de review enforzado** (N5) |
| `build/SKILL.md` entero a cada epic-agent | **G2/M3** | Cubierto |
| 5.229 citas por número de línea | Retrospectiva **P-1** | **Nuevo para el framework** (N4) |
| Reviewers concurrentes, `git checkout` destructivo | Retrospectiva **P-2/P-3/P-5** | **Nuevo para el framework** (N9) |
| `_current/` nunca construido; archivado manual perdió IDs | — | **Nuevo** (N1) |
| Specs de 400-994 líneas sin techo | — | **Nuevo** (N2) |
| `conventions.md` con biografía, reglas duplicadas, entregado entero | — | **Nuevo** (N3) |
| Sin lint del corpus documental (rutas rotas, ADR duplicado, sello huérfano) | — | **Nuevo** (N5) — el de mayor ROI |
| Ledger de 9,5k líneas + colisión de nombre + supersesión/guards sin protocolo | — | **Nuevo** (N6) |
| Sello huérfano; schema mono-spec | — | **Nuevo** (N7) |
| Config en "§10"; nombres fijos de contrato | — | **Nuevo** (N8) |
| Requerimientos en 17 archivos; adendas | D18 del gate (solo para aclaraciones) | **Nuevo** en su forma general (N10) |

---

## 4. Oportunidades nuevas para el framework (prioridad = impacto ÷ esfuerzo)

| # | Oportunidad | Qué cambia | Esfuerzo |
|---|---|---|---|
| **N5** | **`specture doctor` — lint mecánico del corpus** (node, como los hooks; read-only; corre en CI y en `start`). Chequea: rutas `docs/**` y `.specture/decisions/**` citadas que no existen; paths con `...`; ADRs con número duplicado o `Status` no parseable; reviews sin bloque `STATUS:`; sello `build-locked.json` cuyo epic no está `[/]`; `docs-index.yml` presente vs toggle; specs sin `AC-n`/`BR-n` con ID; **specs que superan el techo de tamaño** (N2). Salida: lista con severidad, sin auto-fix. | Convierte el 13 % de hallazgos-de-prosa del reviewer en fallos de CI a costo cero de tokens. Habría atrapado todo lo de §1 salvo el contenido. | Bajo (1-2 días) |
| **N1** | **Backfill de `_current/` por componente, incremental y lazy** + **colapso a lápida por script**. Modo `knowledge reconcile --component <slug>`: lee solo los specs `[x]` que citan ese componente (por "Módulo"/"Componentes"), aplica "último gana" por `operationId`/sujeto de regla, marca `confidence: ai_reconciled` y pide confirmación por Plan mode. Se dispara la primera vez que un epic toca un componente sin `_current/`. El colapso de lápidas lo hace un script que **preserva IDs por construcción**. | Un proyecto maduro obtiene verdad viva sin "consolidar 379 specs" de una vez; el archivado deja de perder IDs. | Medio |
| **N2** | **Techo y forma del spec.** Validator: nueva verificación mecánica (vía N5) — spec > 300 líneas ⇒ WARNING "split o mover narrativa"; secciones fuera del template ⇒ WARNING con destino sugerido (decisión → `_planning.md`; deuda → ROADMAP; divergencia handoff → `handoff-mapping.md`; supersesión de tests → N6). Template: sección explícita **"Guards de no-regresión (nacen verdes)"** con regla: se declaran, no cuentan como RED, el gate los excluye. | El spec vuelve a ser contrato; M1 **reemplaza** en vez de sumar. | Bajo |
| **N3** | **Reglas de una línea + `rules.yml` con inyección por tag** (graduación diferida en `rules-registry-design.md:104`). Regla de estilo verificable por N5: cada `R-*` y cada ítem de deny-list ≤ 2 líneas; la historia va a un ADR/debug log **enlazado**, nunca inline. `knowledge capture` hereda la regla (un patch a conventions que supere el largo se rechaza). El orquestador inyecta solo los `R-*` cuyo tag cruza con el spec (mismo algoritmo que Docs Index Resolution). | `conventions.md` deja de ser bitácora y deja de pesar 518 líneas × 4 workers × spec. | Medio |
| **N4** | **Política de anclas.** Código: `path@SHA:línea` o `path::símbolo`; documentos vivos: **solo** ID estable (`AC-n`, `RN-nnn`, `ADR-nnn §título`, `operationId`, ancla de encabezado) — **prohibido `doc.md:NNN`**. Cambiar la instrucción de `code-reviewer` y `architecture-validator`; N5 lo verifica en documentación nueva. | Elimina la clase entera de "cita correcta hoy, falsa mañana" (retrospectiva §3.2). | Trivial + N5 |
| **N6** | **Protocolo de supersesión de tests sellados y RED-fix** (formaliza lo que Psikora inventó): el spec declara `Supersede: <path>::<test> — motivo BR-n`; el validator lo aprueba; se aplica en commit etiquetado `test(supersede)`; el gate 5.5 **excluye** esos paths por declaración, no por excepción manual. El registro va **por epic** en `_planning.md`; el archivo global queda como índice de una línea por epic. **Renombrar** la referencia del framework a `$SPECTURE_ROOT/docs/tdd-honesty-violations.md` explícito (o `tdd-honesty-reference.md`) para no colisionar. | Retira el motivo de existir de un ledger de 9,5k líneas y cierra el hueco "cambio legítimo cross-epic". | Medio |
| **N7** | **Sello multi-spec y liberación verificada.** Schema `build-locked.json` con `specs: [{slug, red_sha, test_paths}]`; el hook **falla abierto con aviso** si el epic sellado no está `[/]` en el ROADMAP (grep de una línea); el coordinador borra el sello al procesar `DONE` (no confía en el epic-agent) — N5 lo reporta si sobrevive. | Elimina bloqueos fantasma y campos improvisados. | Bajo |
| **N8** | **Config fuera de la prosa y nombres desde `stack.yml`.** Settings a `.specture/settings.yml` (o bloque `specture:` en `stack.yml`), con lectura tolerante del §10 viejo por un release; skills leen `api.contract_file` y derivan el compañero legible (o lo declaran opcional). | Cero acoplamiento a "§10"; cero rutas rotas por extensión. | Bajo |
| **N9** | **Reglas de escritura para reviewers y agentes concurrentes** (anti-patterns de `build`): un reviewer solo escribe su archivo en `docs/07-reviews/`; nunca `git add -A`/`--amend`; validación por mutación solo con snapshot previo a scratch y restauración byte a byte (P-2/P-3); prohibido despachar dos agentes que escriban al mismo checkout (P-5). | Cierra los tres incidentes de la retrospectiva sin esperar worktrees. | Trivial |
| **N10** | **Requerimientos: fusión, no acumulación.** `new-feature` Step 1 **fusiona por sección** en `business_requirements.md` (marcador `(añadido por feature X, fecha)`), borra el `feature-*.md` al aprobar el ROADMAP; prohibidas las "Adendas"; el epic-agent recibe siempre el archivo único. Generaliza D18. | Una sola verdad de negocio que sí llega a los agentes. | Bajo |

**Orden sugerido:** N5 → N4 → N9 → N7 (una semana, casi todo mecánico) → N2 + N8 →
N1 → N3 → N6 → N10. N5 primero porque **mide** el resto: sin lint no se sabe si N1-N10
funcionan.

---

## 5. Qué hacer en Psikora hoy (sin esperar al framework)

1. **Borrar `.specture/state/build-locked.json`** (epic `consent-rediseno.7` está `[x]`;
   el sello bloquea 8 tests para siempre). Verificar después que ningún deny aparezca.
2. **Resolver el `ADR-012` duplicado** (renumerar uno a `039` con `Supersedes`/nota;
   726 citas apuntan a un ID ambiguo).
3. **Arreglar las 24 rutas rotas** (lista en §1) — 10 minutos con `sed`; y dejar de
   escribir paths con `...`.
4. **Podar `conventions.md`**: mover cada "Origen: …" a su debug log/ADR (ya existen),
   dejar la regla en 1-2 líneas; borrar los duplicados de §4/§9/§10 que §12 ya cubre.
   Objetivo: < 250 líneas.
5. **Partir el ledger por epic**: mover cada entrada de `tdd-honesty-violations.md` a
   `docs/05-specs/<epic>/_ledger.md`; dejar el global como índice. Y renombrar para que
   no colisione con la referencia del framework.
6. **Backfill de `_current/` solo para los componentes que la próxima epic toca**
   (`.16` = infra/backups; probablemente ninguno). No consolidar 379 specs de golpe.
7. **Archivar los `_impact-analysis-*` de features ya construidas** a
   `docs/05-specs/_archive/` — su contenido vigente ya está en el ROADMAP o en specs.
8. **Fusionar los 16 `feature-*.md` en `business_requirements.md`** por sección y
   borrar las "Adendas" como estructura (el contenido queda en su sección temática).
9. **Retirar `.claude/agent-memory/pm-spec-writer/`** (ambigüedades resueltas hace
   meses; conocimiento fuera del repo) — lo que siga vigente va a `business_requirements.md`.
10. **Regla local inmediata** en §12: prohibido `doc.md:NNN`; anclas por ID. Es la
    P-1 de tu retrospectiva; no necesita al framework.

---

## 6. Implicación para el Spec Planning Gate

Psikora **refuerza** la tesis (el usuario construyó su propio planner con lista de
ambigüedades antes de que existiera el diseño; las ambigüedades en memoria rotaron) y
**corrige** una parte del diseño: si `_planning.md` (M1) se suma a specs que ya llevan
decisiones, deuda, divergencias y supersesiones, el gate agrega un quinto lugar donde
escribir lo mismo. Condición para implementarlo: **N2 primero** (techo + destinos por
tipo de contenido), de modo que `_planning.md` sea el **único** hogar de decisiones y
citas, y el spec vuelva al template. Y N5 (`doctor`) antes que las métricas de D20 —
en Psikora esas métricas serían inconstruibles hoy porque 26 reviews no tienen
veredicto parseable.
