> **Estado: DISEÑO DEFINIDO — pendiente de implementación.** Documento iniciado
> el 2026-08-28 a pedido del usuario tras observar "falencias en la forma de
> generar las specs". Las decisiones de diseño se tomaron en conversación ese
> mismo día, y el mismo día se hizo una **revisión crítica** del diseño desde el
> comportamiento real de un LLM bajo estas instrucciones; los 10 cambios que
> produjo están incorporados (D11-D20 en §7). Este documento registra **solo lo
> definido**. La implementación sigue la disciplina de `write-skill` (§6) y NO ha
> comenzado.

# Diseño: Spec Planning Gate en el build loop

## 1. Qué se decidió, en una frase

Antes de ejecutar cualquier spec de un epic, un agente especializado
(**`spec-planner`**) planifica **todos** los specs del epic y los deja en disco
sin commitear, separa lo que resolvió con las fuentes (con **cita textual**) de lo
que **solo el usuario puede decidir**, el coordinador pregunta únicamente eso,
corre un **chequeo mecánico** de cobertura y luego un agente independiente
(**`architecture-validator`**) juzga el set completo contra el epic; si aprueba,
los specs se commitean y sellan, y **la ejecución arranca sin esperar aprobación
humana**. El humano es la **vía de escalación, no un paso del flujo** — el mismo
principio que la cola ya aplica a `BLOCKED`/`REJECTED_MAJOR`.

## 2. Diagnóstico (por qué la falencia es estructural)

### 2.1 — La letra de Step 2 ya dice "1-3 specs", pero no lo garantiza

`build/SKILL.md:174` ("decompose into 1-3 specs") y Step 2.5 (`:199`) asumen que
todos los specs existen antes de ejecutar. Pero Steps 3-7 están redactados para
*"the spec"* en singular, sin loop explícito por spec y **sin gate entre
"generar" y "ejecutar"**. El orquestador queda libre de intercalar (spec 1 →
ejecutar → spec 2), que es el comportamiento observado.

### 2.2 — El spec lo escribe el único actor no especializado del loop

Desde v1.8.0 (`b2fa62d`) el chat es solo coordinador y despacha un **epic-agent
general-purpose** que ejecuta Steps 2-8 con el texto completo de
`build/SKILL.md` en contexto (`:83-110`). Los otros cuatro pasos los hacen
workers con contexto restringido, `Required Inputs`, proceso numerado y formato
de salida estricto. **La escritura del spec — el artefacto que todos los demás
tratan como contrato sellado — es la única fase sin un autor especializado.**
No existe hoy ningún skill ni agente dedicado a specs; solo tres piezas pasivas:
`templates/SPEC_TEMPLATE.md`, el checklist "Spec self-review"
(`build/SKILL.md:184-195`) y la regla de anclaje de paths (`:182`).

### 2.3 — Ese actor no puede hablar con el usuario

Un subagente no puede usar `AskUserQuestion`. Ante una ambigüedad, sus salidas
son **asumir en silencio** o reportar `BLOCKED` → escalación al usuario
(`:112-118`) → **re-despachar el epic completo**. Contradice
`skills/start/SKILL.md:97` (*"Asumo esta regla de negocio para avanzar" →
Forbidden. Ask the user*): la regla existe, el actor no tiene el mecanismo.

### 2.4 — Nadie revisa el conjunto

`architecture-validator` recibe **un spec** por dispatch (dimensiones 1-6).
Nadie verifica que la unión de los specs cubra los `operationId`s y las BR del
bloque de epic, que no se solapen, que el "Fuera de Scope" de uno lo cubra otro,
ni que las firmas que spec 2 consume coincidan con las que spec 1 crea.

### 2.5 — La ambigüedad se detecta tarde y caro

| Dónde aflora hoy | Referencia | Costo |
|------------------|-----------|-------|
| `tdd-test-writer` → `NEEDS_CONTEXT` | `agents/tdd-test-writer/AGENT.md:171` | un dispatch |
| `implementer` → `NEEDS_CONTEXT` | `agents/implementer/AGENT.md:166` | tests RED commiteados + un dispatch |
| Iteration Cap (3 loops GREEN→review) | `build/SKILL.md:414-419` | hasta 3 ciclos implementer + code-reviewer |
| Epic-agent → `BLOCKED` | `build/SKILL.md:112-118` | re-dispatch del epic completo |

### 2.6 — Historia previa

- `docs/prompt-optimization-report.md:26` (v1.3.0, `edd1d24`) ya ubicó la causa
  raíz aguas arriba, en el spec. La remediación (template con IDs + Dispatch
  Manifest) resolvió la **forma** del spec, no su **contenido** ni su
  **coherencia con el epic**.
- `docs/integration-claude-native.md:131` (v1.2.0) decidió **no** integrar Plan
  mode en `build`. Esa decisión **sigue vigente** con este diseño (§7, D3).

## 3. Principios del diseño

1. **Alcance = epic, just-in-time.** Los specs llevan firmas exactas de código
   existente ("Superficie de Código Existente"); las de un epic dependen del
   código que producen los epics anteriores. No se planifica el batch.
2. **Humano solo por escalación.** Un epic sin dudas corre de punta a punta sin
   intervención; "todas" sigue siendo desatendido salvo que aparezca algo que
   solo el usuario puede decidir.
3. **Gates independientes o mecánicos, nunca self-review.** Lo que un script
   puede verificar lo verifica un script (`write-skill`: "if a regex can enforce
   it, automate it"); lo que requiere juicio lo juzga `architecture-validator`,
   no el coordinador ni el planner.
4. **Contexto restringido.** El `spec-planner` es un worker más: inputs
   explícitos, sin memoria, sin Context7, sin historial. El coordinador carga
   paths, listas y veredictos — **no** el texto de los specs.
5. **Todo lo decidido queda escrito, con cita.** Cada duda resuelta — por el
   usuario o por las fuentes — se persiste con su fuente **textual** (§4.5).
   Nada vive solo en el chat.
6. **Los specs validados son inmutables** durante el epic (sello, §4.8). Las
   firmas reales viajan como overlay, nunca editando el spec.
7. **Evidencia, no confianza.** El epic-agent recibe `SPEC_SHA` y el veredicto
   verbatim; la reanudación solo reconoce specs **commiteados**.
8. **Default para todo proyecto.** Sin toggle en §10 (§7, D6). El release se
   mide (§6.5).

## 4. Diseño

### 4.1 — Flujo por epic (en el coordinador, dentro de la cola secuencial)

Reemplaza el paso 5.3 del "queue loop" actual de `build/SKILL.md`:

```
1. Marcar [/] + commit                                              (como hoy)
2. Despachar spec-planner                                              §4.2
     ──► escribe docs/05-specs/<epic-slug>/*.spec.md (SIN commit)
     ──► devuelve: paths + OPEN_QUESTIONS + RESOLVED_ALONE (cita textual)
                   + COVERAGE_TABLE + CHANGELOG
   Coordinador: `git add docs/05-specs/<epic-slug>/`  (staging, sin commit —
   deja diffeable cada re-dispatch con `git diff -- docs/05-specs/<epic-slug>/`)
3. ¿OPEN_QUESTIONS?
     sí → preguntar (≤4 por tanda, 2-4 opciones, ≤2 tandas)              §4.3
          → persistir BR nuevas/cambiadas en business_requirements.md    §4.5
          → re-despachar spec-planner con ANSWERS (edición mínima,
            IDs estables, CHANGELOG) → `git diff` vs CHANGELOG → `git add`
          → eco de interpretación en el chat, sin esperar confirmación   §4.6
          → volver a 3
     no → seguir
4a. Chequeo MECÁNICO (coordinador, script): C1 C2* C4 C5 C6               §4.4
     falla → re-despachar spec-planner con VIOLATIONS → volver a 4a
             (no gasta un dispatch del validator en errores evidentes)
4b. Despachar architecture-validator (spec-set: dim 1-6 por spec + C3 + C7)
     REJECTED → re-despachar spec-planner con VIOLATIONS → volver a 4a
                C7 sobre el MISMO ítem por 2ª vez → pasa a OPEN_QUESTIONS → 3
                3 rechazos acumulados (4a+4b) → escalar al usuario
     "epic > 3 specs" → escalar al usuario para split (toca ROADMAP)
     APPROVED → seguir
5. Resumen sin bloqueo en el chat                                          §4.6
   [modo revisión a pedido: esperar confirmación aquí]
6. Commit `docs(specs): plan <epic-slug> — N specs validados` → SPEC_SHA
   Sellar: escribir .specture/state/build-locked.json { epic, spec_sha,
   spec_paths }                                                            §4.8
7. TaskCreate por spec                                        (Step 2.5 actual)
8. Despachar epic-agent desde Step 4 con SPEC_SHA + veredicto verbatim     §4.9
   (Manifest → RED → GREEN → gate 5.5 → review → verify → [x])
   overlay de firmas reales en el Manifest del spec k+1                    §4.7
9. Registrar métricas del epic en docs/.specture-meta/build-metrics.jsonl  §6.5
```

Steps 4-8 del epic-agent no cambian. Step 3 (validación por spec) queda
**absorbido** por 4a+4b: no se paga dos veces.

### 4.2 — Agente nuevo: `spec-planner` (`agents/spec-planner/AGENT.md`, `model: opus`)

**Rol.** Traducir **un** epic en 1-3 specs code-free, self-contained y
ordenados por dependencia, escribirlos a disco **sin commitear**, y separar
explícitamente lo que resolvió con las fuentes de lo que requiere al usuario.
**No commitea, no despacha, no toca nada fuera de `docs/05-specs/<epic-slug>/`.**

**Required Inputs (los pasa el coordinador; falta uno → `NEEDS_CONTEXT`).**
- Bloque completo del epic de `ROADMAP.md` (descripción, BR clave, componentes,
  `operationId`s, specs estimados, y el campo `Template:` si existe).
- `docs/01-requirements/business_requirements.md` (secciones enlazadas por el
  epic + "Capacidades de Frontera").
- Secciones de `docs/02-architecture/architecture.md` de los componentes
  involucrados, incluyendo "Carpeta raíz".
- Slice de `api-contract.md` / `.openapi.yaml` con los `operationId`s del epic.
- `.specture/stack.yml`, `.specture/conventions.md` (§8 idioma de
  identificadores, §12 invariantes, file-org), ADRs `Accepted`.
- `docs/05-specs/_current/<componente>.md` resueltos y docs de `docs-index.yml`
  resueltos (con cap), como hoy para el validator.
- La plantilla: `templates/SPEC_TEMPLATE.md`, **o `MIGRATION_SPEC_TEMPLATE.md`
  si el epic declara `Template:`** (epics de `modernize`).
- **Rutas raíz del/los componente(s)** para extraer firmas (ver restricción de
  lectura abajo).
- **Condicionales — epic frontend** (`stack.yml.frontend.framework` set y el
  epic toca UI): `docs/03-ux-ui/design_system.md`, `navigation_map.md`, y si
  hubo handoff `fidelity-checklist.md` + `handoff-mapping.md`; más la regla de
  que una página solo *consume* `operationId`s implementados por epics backend
  `[x]`.
- **Condicionales — epic de migración** (`Template: MIGRATION_SPEC_TEMPLATE.md`):
  `docs/migration/gap_analysis.md` (sección del módulo) y la sección
  `migration:` de `stack.yml`.
- En re-dispatch: los **specs anteriores** (ya en disco) + bloque `ANSWERS`
  (respuestas del usuario o decisiones delegadas) y/o `VIOLATIONS` (del chequeo
  mecánico o del validator).

**Context Restriction.** Sin memoria persistente, sin Context7, sin historial de
conversación. **Lectura de código acotada**: solo archivos bajo la carpeta raíz
del componente que contienen los símbolos que la "Superficie de Código
Existente" nombra; se extraen **firmas y paths, nunca comportamiento**. Una
"Superficie" con prosa de comportamiento ("X internamente hace Y") sesga al
`tdd-test-writer`, que sí ve el spec.

**Re-dispatch = edición mínima.** Con `ANSWERS`/`VIOLATIONS`, el planner **edita
los archivos existentes**: no reestructura, no renumera, mantiene estables los
IDs `AC-n`/`BR-n`/`EC-n` y los slugs (el `COVERAGE_MAP` del test-writer y las
respuestas del usuario dependen de ellos), y emite `CHANGELOG` con cada cambio.
El coordinador contrasta `git diff -- docs/05-specs/<epic-slug>/` con el
`CHANGELOG`; un diff que excede el `CHANGELOG` es un hallazgo (re-despachar con
"revertí lo no listado").

**Proceso.**
- Step 0 — Validar manifest. Faltante → `NEEDS_CONTEXT`, sin trabajo.
- Step 1 — Mapear objetivos de cobertura del epic: cada `operationId`, cada BR
  enlazada, cada capacidad de la descripción.
- Step 2 — Descomponer en 1-3 specs ordenados por dependencia. Si salen >3,
  reportar `BLOCKED: sizing` con la partición sugerida — no forzar.
- Step 3 — Llenar la plantilla por spec aplicando el "Spec self-review" (que
  **se muda** de `build/SKILL.md` Step 2 a este agente). Símbolos que crea un
  spec hermano anterior se referencian con su firma planeada marcada
  `(planeada — re-anclar)`.
- Step 4 — Pasada de ambigüedad sobre cada AC/BR/EC/celda de contrato/Fuera de
  Scope, clasificando con el criterio §4.3: **resuelta con fuente** (→
  `RESOLVED_ALONE`, con **cita textual**) o **abierta** (→ `OPEN_QUESTIONS`).
  Prohibido el tercer estado "asumido sin cita".
- Step 5 — Emitir `COVERAGE_TABLE` (§4.4) y pre-chequear C1-C6 sobre ella.
  Pre-filtro propio; **no reemplaza** 4a ni 4b.
- Step 6 — Escribir/editar los archivos en `docs/05-specs/<epic-slug>/` y
  reportar.

**Output (formato estricto).**
```
STATUS: <DONE | NEEDS_CONTEXT | BLOCKED>

SPECS:                          (paths, en orden de ejecución — NO el contenido)
- docs/05-specs/<epic-slug>/<task-slug>.spec.md — orden N — implementa/consume: [operationIds]

COVERAGE_TABLE:                 (machine-readable; lo consume el chequeo 4a)
- op: <operationId> → <task-slug> (implementa | consume)
- br: <ancla §X de business_requirements.md> → <task-slug> [BR-n]
- sym: <símbolo> — crea: <task-slug> — firma: <...> — consume: [<task-slug>...]
- oos: <ítem Fuera de Scope> → cubierto por: <task-slug> | diferido a: <Epic X.Y | fuera del epic>

OPEN_QUESTIONS:                 (vacío es válido y esperable)
- Q-1 — afecta: <AC-n | BR-n | EC-n | contrato.<celda> | fuera-de-scope>
  pregunta: <cerrada>
  opciones: [A (recomendada), B, C]      (2-4 opciones)
  fuentes revisadas sin respuesta: [business_requirements §X, contrato op Y, ...]

RESOLVED_ALONE:
- R-1 — <decisión> — fuente: <archivo §sección> — cita: "<frase textual del documento>"

CHANGELOG:                      (solo en re-dispatch; vacío en la primera pasada)
- <task-slug>: <qué cambió y por qué (Q-n / VIOLATION id)>

CONCERNS: <opcional>
```
`BLOCKED` se usa para: sizing (>3 specs), contrato (el epic necesita un shape u
operación que **no existe** en el contrato — es cambio de arquitectura, no se
inventa en el spec), o contradicción entre fuentes que ninguna respuesta del
usuario resolvería sin ADR.

**What You Do NOT Do.** Commitear · despachar agentes · tocar archivos fuera de
`docs/05-specs/<epic-slug>/` · incluir código de implementación · describir
comportamiento del código existente · inventar shapes fuera del contrato ·
asumir sin cita textual · reestructurar specs en un re-dispatch · consultar
memoria o Context7.

### 4.3 — Criterio de escalado, formato de preguntas y delegación

**Una duda va a `OPEN_QUESTIONS` solo si cumple las dos condiciones:**
1. **Cambia el contrato observable**: afecta una AC, BR, EC, una celda de la
   tabla de contrato o el "Fuera de Scope". Dudas de *cómo* implementar (nombre
   interno, estructura de archivo) no se preguntan — las resuelven
   `conventions.md`/ADRs.
2. **No es resoluble con las fuentes entregadas**: `business_requirements.md`,
   `architecture.md`, contrato, ADRs `Accepted`, `_current/`, `conventions.md`,
   docs-index resueltos. Si una fuente responde, se cita **textualmente** en
   `RESOLVED_ALONE`. Si no hay una frase que citar, no está resuelto.

**Formato (reglas de `skills/discover/SKILL.md` + límites de la herramienta).**
Máximo **4 preguntas por tanda** con **2-4 opciones** cada una (límite de
`AskUserQuestion`), una `(recomendada)`, frases prohibidas de Rule 5 ("asumo
que…"). Máximo **2 tandas** por epic: si siguen apareciendo dudas de contrato,
el epic está sub-descubierto → el coordinador ofrece `discover` scopeado (como
`new-feature` Step 1) en vez de una tercera tanda.

**Presión vs. delegación.** "Hazlo rápido", "no me preguntes", "no molestes" —
presión vaga — **no** suprime preguntas de contrato (misma regla de resistencia
que `specture-router`). La **delegación explícita** sí se honra: *"si hay dudas,
usá la opción recomendada y seguí"* → el coordinador responde las
`OPEN_QUESTIONS` con la recomendada y cada una queda registrada como
`fuente: delegado por el usuario <fecha>`. **Alcance de la delegación**: el epic
nombrado; o el batch completo **solo si se dijo antes de arrancar el batch**.
Nunca sobrevive la sesión, nunca se infiere de una sesión anterior.

### 4.4 — Chequeos del set: mecánicos (4a) y de juicio (4b)

**4a — Mecánicos, en el coordinador** vía script
`hooks/lib/spec-set-check.js` (misma infraestructura node que el TDD gate;
invocado con Bash: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js"
<epic-dir> <epic-block-file>`). Lee la `COVERAGE_TABLE` de cada spec + el bloque
del epic. Sin node disponible: los mismos chequeos con `grep`, a mano.

| # | Chequeo | Severidad |
|---|---------|-----------|
| C1 | Cada `operationId` del epic aparece en **exactamente un** spec (*Implementa* backend / *Consume* frontend). Faltante → hueco; duplicado → solapamiento. | BLOCKER |
| C2* | Cada ancla de `business_requirements.md` enlazada en "Reglas de negocio clave" la cita ≥1 spec. **Mecánico solo si las referencias usan el formato de ancla del template**; si no, lo cubre 4b. | BLOCKER |
| C4 | Handoff de firmas: todo símbolo `(planeada — re-anclar)` existe en `sym: … crea:` de un spec **anterior** con firma **idéntica** (igualdad de string). | BLOCKER |
| C5 | Sizing: ≤3 specs, cada uno ≤3 commits estimados (`architecture/SKILL.md:105`). | WARNING ("split sugerido"; el coordinador escala) |
| C6 | Orden: ningún `sym: … consume` apunta a un spec posterior. | BLOCKER |

**4b — De juicio, en `architecture-validator`** (candidato "spec-set de un
epic"). Inputs: bloque del epic, todos los specs en orden (**por path**), slice
del contrato, las fuentes citadas en `RESOLVED_ALONE`, y el resultado de 4a.
Corre las dimensiones 1-6 actuales **por spec** más la **Dimension 7**:

| # | Chequeo | Severidad |
|---|---------|-----------|
| C3 | Ningún ítem de "Fuera de Scope" queda sin dueño: lo cubre un hermano o el set lo declara `diferido a: …` (línea `oos:` de la tabla) y ese diferimiento es razonable. | WARNING → BLOCKER si es una capacidad del epic |
| C7 | Cada ítem de `RESOLVED_ALONE`: la **cita textual existe** en la fuente entregada (verificable) **y responde** la duda (juicio). Cita inexistente, parafraseada, o que no responde → "aclaración sin sustento". | BLOCKER |
| C8 | "Superficie de Código Existente" contiene solo firmas y paths — sin prosa de comportamiento del código existente. | WARNING |
| C2 (fallback) | Cuando 4a no pudo verificar C2 por formato de referencias. | BLOCKER |

**Regla anti-cascada de C7**: si el validator rechaza por C7 el **mismo ítem por
segunda vez**, el coordinador lo convierte en `OPEN_QUESTION` y vuelve al paso 3
— no hay tercer intento entre dos modelos de acuerdo sobre una cita plausible.

Output del validator: el formato estricto actual; cada violación cita
`<task-slug>` + ID. Sigue **sin proponer fixes**. Un dispatch por epic
**reemplaza** los 1-3 dispatches por spec actuales.

### 4.5 — Persistencia de aclaraciones

- **En el spec** — nueva sección de `SPEC_TEMPLATE.md`:
  `## Aclaraciones (resueltas en planificación)`, una línea por decisión:
  `Q/R-n: … → decisión — fuente: <usuario 2026-08-28 | delegado por el usuario | business_requirements.md §X "cita" | ADR-00N | _current/<c>.md>`.
  El spec es inmutable tras el sello (§4.8): queda como audit trail.
- **En `business_requirements.md`** — si una respuesta del usuario **crea o
  cambia una regla de negocio**, el coordinador **edita la regla en su lugar**
  (en la sección donde vive, o la agrega a la sección temática correspondiente)
  con el marcador `(aclarado en Epic X.Y, <fecha>)`. **No** se agregan
  subsecciones-bitácora por epic: el documento es verdad viva, no changelog;
  la historia queda en la sección "Aclaraciones" del spec y en git. Esto ocurre
  **antes** de re-despachar al planner, para que el spec cite la regla y la
  Dimension 4 del validator (`architecture-validator/AGENT.md:57`) la encuentre.
- **ADR** — si la respuesta es arquitectónica (regla de `new-feature`: nunca se
  decide arquitectura en silencio).

### 4.6 — Visibilidad sin bloqueo, eco de interpretación y modo revisión

- **Eco de interpretación** (paso 3, tras el re-dispatch): el coordinador
  muestra el `CHANGELOG` del planner en el chat (`"así quedó — BR-3: … /
  EC-2: …"`). No espera confirmación: si el usuario ve algo mal, lo dice y se
  re-despacha; si no dice nada, sigue.
- **Resumen sin bloqueo** (paso 5, siempre): specs con orden, cantidad de
  AC/BR/EC, `operationId`s cubiertos, y **todas** las decisiones de
  `RESOLVED_ALONE` con su cita. Si el usuario está presente, puede frenar; si
  no, queda en el transcript y en el spec commiteado.
- **Modo revisión a pedido** (solo por pedido explícito en la sesión, p. ej.
  *"construí con revisión de specs"*): el coordinador se detiene en el paso 5 y
  espera confirmación **en chat**. Sin Plan mode, sin toggle en §10.

### 4.7 — Re-anclaje de firmas: overlay en el Manifest, spec intacto

En el epic-agent, antes del Dispatch Manifest del spec k+1: releer las firmas
**reales** de los símbolos `(planeada — re-anclar)` que creó el spec k (lectura
puntual del archivo que el spec k declaró crear) y pasarlas al implementer como
**overlay del Manifest** — un bloque `FIRMAS_REALES: <símbolo> → <firma>` que
**prevalece** sobre la "Superficie" del spec. **El archivo del spec no se
edita** (está sellado, §4.8). El ítem del Manifest "la Superficie carga
firmas exactas" se satisface con *spec + overlay*. Si una firma real difiere de
la planeada en algo que un test observaría, el epic-agent lo reporta en su
informe final (`CONCERNS`) — el coordinador decide si es hallazgo para
`knowledge`.

### 4.8 — Sello de specs (`SPEC_SHA` + hook)

Tras el commit del paso 6, el coordinador escribe `.specture/state/build-locked.json`:
```json
{ "epic": "<epic-slug>", "spec_sha": "<SPEC_SHA>",
  "spec_paths": ["docs/05-specs/<epic-slug>/*.spec.md"], "sealed_at": "<ISO-8601>" }
```
El epic-agent, en su Step 4 post-check 5, **fusiona** `red_sha` + `test_paths`
en el mismo archivo (no lo sobreescribe). Step 8 lo borra, como hoy.

Con `hooks.enabled: true`, `hooks/pre-tool-use-tdd-gate.js` (y sus variantes
Copilot/Antigravity) deniega `Edit/Write` a cualquier path que matchee
`spec_paths` — misma lógica que hoy usa para `test_paths`; el guard y el
matcher de globs ya existen. Sin hooks, la defensa es la instrucción del
epic-agent (§4.9) + `git diff <SPEC_SHA>..HEAD -- docs/05-specs/<epic-slug>/`
que el coordinador corre al procesar el reporte (espejo del gate 5.5): un diff
no vacío es una violación y se trata como `REJECTED_MAJOR`.

### 4.9 — Cambios en el epic-agent

El prompt de despacho (`build/SKILL.md:83-110`) pasa de *"Execute Steps 2
through 8"* a *"Execute Steps 4 through 8"* y agrega:
- Las omisiones: *"Steps 2/2.5/3 — los specs ya fueron planificados por
  `spec-planner`, verificados mecánicamente y validados por
  `architecture-validator`; NO los regeneres ni edites. Si un spec resulta
  inejecutable, reporta `BLOCKED: spec` con el ID de AC/BR/EC afectado."*
- **Evidencia obligatoria en el prompt**: `SPEC_SHA` y el veredicto `APPROVED`
  del validator **verbatim**. Sin ambos, el epic-agent responde
  `NEEDS_CONTEXT` (mismo patrón que el Manifest).
- El overlay de firmas (§4.7) como pre-flight del Manifest del spec k+1.

Manifest, RED commit, gate 5.5, code-reviewer y verificación **no cambian**.
Anti-pattern nuevo en la tabla de `build`: *"Editar o regenerar un spec sellado
dentro del epic-agent"*.

### 4.10 — Reanudación de un epic `[/]`

Gap preexistente: la cola solo toma epics `[ ]` (`build/SKILL.md:57`), así que
un `[/]` huérfano tras un crash queda trabado. Con el sello:

- Exactamente un epic `[/]` **y** `docs/05-specs/<epic-slug>/` tiene ≥1
  `.spec.md` **commiteado** → saltar pasos 2-7 y despachar el epic-agent
  (paso 8), re-escribiendo el sello si falta.
- Un epic `[/]` con specs **solo en staging/working tree** (planificación
  interrumpida antes del paso 6) → no están validados. **Preguntar al usuario**:
  descartarlos y re-planificar, o retomar desde 4a con lo que hay. Nunca
  descartar archivos sin preguntar.
- Un epic `[/]` sin specs → planificar desde el paso 2.
- Varios `[/]` → preguntar al usuario (regla actual).

### 4.11 — Cross-platform

El gate se redacta agnóstico en `build/SKILL.md` ("Spec Planning Gate":
planificar → preguntar solo lo abierto → chequeo mecánico → validar set →
sellar → despachar). Mecanismos por plataforma: Claude Code =
`AskUserQuestion` para las tandas; Copilot / Antigravity = preguntas cerradas en
chat con las mismas reglas. `spec-planner` se agrega a la lista de agentes de
"Cross-Platform Subagent Initialization" de `build` (registro vía
`define_subagent` en Antigravity) y a `copilot/agents/`. El script de 4a y el
hook de sello corren en node en las tres plataformas.

### 4.12 — Mapa de contactos humanos (todos excepcionales)

| Cuándo | Qué decide el usuario |
|--------|-----------------------|
| `OPEN_QUESTIONS` no vacío (paso 3), incluidas las que C7 convirtió | Reglas de negocio / contrato que las fuentes no responden |
| 3 rechazos acumulados en 4a/4b | Cómo destrabar (corregir requerimientos, ADR, split) |
| `BLOCKED: sizing` o C5 | Split del epic — toca `ROADMAP.md` |
| `BLOCKED: contrato` (paso 2) | Cambio de contrato → `architecture`/ADR, no spec |
| Reanudación con specs sin validar (§4.10) | Descartar o retomar |
| `BLOCKED` / `REJECTED_MAJOR` aguas abajo | Como hoy |
| Modo revisión a pedido (paso 5) | Confirmación explícita del set — solo si lo pidió |

Ninguno es rutinario. Un epic sin dudas no interrumpe.

## 5. Riesgos residuales (tras la revisión crítica)

| Riesgo | Cómo se comporta el modelo | Mitigación en el diseño | Residual |
|--------|---------------------------|-------------------------|----------|
| **"Asumir citando"** — resolver con una fuente *relacionada* pero no concluyente, y que el validator la acepte por plausible (cascada de confirmación). | Es el sesgo dominante: encontrar §X "relacionado" se siente diligencia. | Cita **textual** (no se puede inventar verbatim; existencia verificable con grep); C7 juzga solo "¿responde?"; segundo rechazo → pregunta (§4.4); escenario 5 (§6.1) con ambigüedades sutiles. | Medio-bajo. Se mide con la tasa de `OPEN_QUESTIONS = 0` sostenida (§6.5). |
| **Churn en re-dispatch** — reestructurar specs que no tenían problema. | No soy determinista; "regenerar" reescribe. | Edición mínima sobre archivos existentes, IDs estables, `CHANGELOG` contrastado con `git diff` (§4.2). | Bajo. |
| **Erosión del procedimiento** — el coordinador se saltea pasos laterales o escribe el spec él mismo. | Con procedimientos largos me salteo los pasos del medio. | Self-review y Step 2 se mudan al planner (crecimiento neto de `build` ≈ 0); `SPEC_SHA` + veredicto verbatim obligatorios en el prompt del epic-agent (§4.9); hook de sello opt-in (§4.8). | Medio sin hooks; bajo con hooks. |
| **Chequeos mecánicos hechos por un LLM** — perder un `operationId` en 500 líneas. | Sí me pasa. | C1/C4/C5/C6 (y C2 cuando el formato lo permite) en script (§4.4); el validator solo juzga. | Bajo. |
| **Docs consistentes pero equivocados** pasan el validator. | Nadie lo atrapa sin leer con cuidado. | Fallo de `discover`, no de `build`; el gate humano obligatorio tampoco lo atraparía en la práctica. Sin regresión respecto a hoy. | Aceptado. |
| **Over-asking.** | Menos frecuente que under-asking, pero ocurre con instrucciones "nunca asumas". | Dos condiciones + ≤4/tanda + ≤2 tandas; escenario 6 (§6.1). | Bajo. |
| **Costo sin retorno** — un Opus más por epic (dos con dudas) antes de cualquier código; ceremonia en epics triviales. | — | 4a evita dispatches del validator por errores evidentes; validator 1× por epic en vez de 1-3×; **métricas antes/después** deciden (§6.5). | Se mide. |
| **Filtrar comportamiento al spec** — el planner sobre-lee y la "Superficie" sesga al test-writer. | Con permiso de leer, exploro de más. | Lectura acotada a símbolos nombrados; C8 (§4.4). | Bajo. |
| **`business_requirements.md` degradado a bitácora.** | — | Edición en lugar con marcador (§4.5). | Bajo. |
| **Delegación que se estira** a todo el batch o a la sesión siguiente. | Generalizo permisos. | Alcance explícito (§4.3). | Bajo. |

## 6. Plan de implementación

### 6.1 — Disciplina `write-skill`: baseline primero

`build/SKILL.md` es el archivo más caliente del framework. RED: correr cada
escenario **sin** el cambio y documentar la racionalización textual → GREEN:
cambio mínimo → REFACTOR: re-correr. Proyecto de prueba con `.specture/` y
ROADMAP mínimos.

1. **BR ambigua evidente.** "Los usuarios pueden subir archivos" sin límite ni
   tipos. Hoy: asume. Esperado: `OPEN_QUESTIONS` Q-1 con opciones.
2. **Hueco de cobertura.** Epic con 3 `operationId`s; los specs implementan 2.
   Hoy: nadie lo atrapa. Esperado: C1 en 4a, sin gastar validator.
3. **Handoff de firmas.** Spec 2 consume `crearCita(paciente, fecha)`; spec 1
   crea `crearCita(dto)`. Esperado: C4 en 4a.
4. **Presión vs. delegación.** (a) "Hazlo rápido, no me preguntes" → las
   preguntas se hacen igual. (b) "Si hay dudas usá la recomendada" → se honra,
   queda `fuente: delegado por el usuario`, y **no** se aplica al epic siguiente
   si se dijo a mitad del batch.
5. **Ambigüedad sutil + cita sin sustento.** Celda "Idempotencia" sin regla en
   ninguna fuente; el planner la resuelve citando una sección sobre validación
   de entradas. Esperado: C7 BLOCKER con la cita textual como evidencia; al
   segundo rechazo, pasa a pregunta.
6. **Epic bien descubierto.** Requerimientos y contrato completos. Esperado:
   `OPEN_QUESTIONS` vacío, 4a limpio, `APPROVED` a la primera, **cero**
   interrupciones hasta el `[x]`.
7. **Reanudación.** (a) Matar la sesión con specs commiteados → la siguiente
   despacha sin re-planificar. (b) Matar con specs solo en staging → pregunta.
8. **Re-dispatch mínimo.** Responder una duda de spec 2. Esperado: spec 1 sin
   cambios en `git diff`, IDs estables, `CHANGELOG` cubre el diff completo.
9. **Superficie sin comportamiento.** Componente con lógica interna rica.
   Esperado: la "Superficie" lista firmas y paths; C8 limpio.
10. **Epic de migración.** Epic con `Template: MIGRATION_SPEC_TEMPLATE.md`.
    Esperado: el planner usa esa plantilla y recibe `gap_analysis.md`.
11. **Epic frontend.** Epic de página. Esperado: el planner recibe
    `design_system.md`/`navigation_map.md` y el spec declara `operationId`s
    consumidos que existen en epics backend `[x]`.
12. **Sello.** Con `hooks.enabled`, el epic-agent intenta editar un spec.
    Esperado: deny del hook. Sin hooks: `git diff <SPEC_SHA>..HEAD` no vacío →
    `REJECTED_MAJOR` al procesar el reporte.

### 6.2 — Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `agents/spec-planner/AGENT.md` | **Nuevo** (§4.2). `model: opus`. Incluye el "Spec self-review" mudado desde `build`. |
| `agents/architecture-validator/AGENT.md` | Candidato "spec-set de un epic" + Dimension 7 (C3, C7, C8, C2 fallback) + inputs (bloque del epic, specs por path, slice del contrato, fuentes de `RESOLVED_ALONE`, resultado de 4a). |
| `skills/build/SKILL.md` | Sección **"Spec Planning Gate"** (§4.1) entre "Branching (W-*)" y "The queue loop"; paso 5.3 del queue loop reemplazado; Step 2 y self-review **se mudan** al planner (no se duplican); Step 2.5 al coordinador; Step 3 absorbido; prompt del epic-agent → Steps 4-8 con `SPEC_SHA` + veredicto (§4.9); overlay de firmas como pre-flight del Manifest (§4.7); sello y fusión de `build-locked.json` (§4.8); `git diff <SPEC_SHA>` al procesar el reporte; reanudación (§4.10); `spec-planner` en "Cross-Platform Subagent Initialization"; anti-pattern nuevo; registro de métricas (§6.5). |
| `skills/modernize/SKILL.md` | Step 7.1-7.2 delegan al Spec Planning Gate de `build` (el epic declara `Template:`; el planner recibe `gap_analysis.md`). Un solo camino para specs. |
| `hooks/lib/spec-set-check.js` | **Nuevo**: chequeos C1/C2*/C4/C5/C6 sobre `COVERAGE_TABLE` + bloque del epic. Tests en `hooks/test/`. |
| `hooks/pre-tool-use-tdd-gate.js` + `copilot-…` + `specture-…` | `spec_paths` en `build-locked.json` → deny, misma lógica que `test_paths`. |
| `hooks/README.md` | Schema de `build-locked.json` con `spec_sha`/`spec_paths`/`sealed_at`; fusión por el epic-agent. |
| `templates/SPEC_TEMPLATE.md` | Sección `## Aclaraciones (resueltas en planificación)`; marcador `(planeada — re-anclar)`; bloque `COVERAGE_TABLE` al pie (machine-readable). |
| `templates/MIGRATION_SPEC_TEMPLATE.md` | Mismos dos agregados. |
| `templates/ROADMAP_TEMPLATE.md` | Nota en "Convención de Estados": `[/]` puede tener specs sellados en disco (reanudable). |
| `copilot/agents/spec-planner.agent.md` | **Nuevo**, espejo. |
| `copilot/agents/architecture-validator.agent.md` | Espejo del cambio. |
| `copilot/compatibility-matrix.json` | `agents` + `spec-planner`; `gates` + `spec-planning`, `spec-seal`. |
| `skills/start/SKILL.md` | Sin cambio funcional; la Red Flag `:97` referencia el gate como mecanismo. |

### 6.3 — Workstream de documentación (qué cambia para el usuario)

- `README.md` — sección `build`: cada epic se planifica completo antes de
  ejecutar; Specture **pregunta solo lo que las fuentes no responden** y sigue
  solo; "todas" sigue siendo desatendido; cómo pedir "modo revisión" y cómo
  delegar; los specs quedan sellados durante el epic. Sección de agentes:
  `spec-planner` (Opus). Sección de hooks: sello de specs. Changelog
  **v1.15.0** (siguiente minor sobre `plugin.json` 1.14.0).
- `docs/execution-flows.md` — §2 (diagrama de agentes: + `spec-planner`),
  §3.1-3.2 (el loop por epic con el gate en el coordinador, 4a/4b, y el
  epic-agent desde Step 4).
- `docs/native-integration-guide.md` — "Comportamiento observable por skill":
  `build` puede hacer preguntas cerradas al inicio de un epic; hook de sello.
- `docs/copilot-cli-plugin.md`, `docs/antigravity-cli-plugin.md` — agente nuevo,
  mecanismo de preguntas por plataforma, script 4a y hook.
- `docs/integration-claude-native.md` — **no se toca**: la decisión de no usar
  Plan mode en `build` sigue vigente.
- `docs/agent-per-epic-design.md` — nota de estado: el epic-agent ya no genera
  specs (desde v1.15.0).
- `docs/usage-cost-analysis.md` — apéndice con la medición antes/después (§6.5)
  cuando exista.

### 6.4 — Versión

Minor bump a **1.15.0**: cambia el comportamiento de `build` para todo proyecto
(default, sin opt-in), agrega un agente y un script, extiende el hook existente
(opt-in como siempre), no rompe artefactos existentes (specs ya escritos siguen
siendo válidos; las secciones nuevas de la plantilla son opcionales).

### 6.5 — Criterio de éxito: métricas antes/después

El coordinador registra una línea por epic en
`docs/.specture-meta/build-metrics.jsonl` (append-only; nunca bloquea; mismo
patrón que `index-usage.jsonl` y `learn-history.jsonl`):

```json
{"ts":"<ISO-8601>","epic":"<slug>","specs":N,"planner_dispatches":N,
 "open_questions":N,"resolved_alone":N,"c7_rejections":N,
 "mech_check_failures":N,"validator_dispatches":N,"validator_verdict":"APPROVED|ESCALATED",
 "needs_context_spec":N,"iteration_cap_spec":N,"blocked_spec":N,"outcome":"DONE|BLOCKED|REJECTED_MAJOR"}
```

**Baseline**: los últimos ~10 epics previos al release, reconstruidos desde
`docs/07-reviews/`, git log y transcripts (mismo método que
`docs/usage-cost-analysis.md`), más el informe de consumo de tokens del
usuario. **Lectura a los ~10 epics posteriores**:

| Señal | Interpretación |
|-------|----------------|
| Bajan `needs_context_spec`, `iteration_cap_spec` y `blocked_spec` | El gate atrapa ambigüedad real. Objetivo del release cumplido. |
| No bajan **y** `open_questions` es casi siempre 0 | R1 materializado: el planner no pregunta. Se corrige en el planner (criterio, escenarios 1 y 5), **no** con más validación. |
| Bajan pero los tokens por epic suben más de lo que ahorran | Costo del gate > retorno. Se ajusta 4a (más fast path mecánico) antes de tocar el gate. |
| `c7_rejections` alto sostenido | El planner cita mal; endurecer Step 4 del planner. |

## 7. Registro de decisiones cerradas (2026-08-28)

| ID | Decisión | Alternativa descartada y por qué |
|----|----------|----------------------------------|
| D1 | Alcance de la planificación = **epic**, just-in-time dentro de la cola. | Planificar el batch: las firmas de "Superficie de Código Existente" dependen del código de epics anteriores. |
| D2 | **Sin gate humano obligatorio.** El humano entra solo por escalación (§4.12). | Aprobación por epic: fatiga de aprobación (firma sin leer desde el epic 5), "todas" dejaba de ser desatendido, y su ganancia marginal (docs consistentes pero equivocados) es un fallo de `discover` que tampoco atraparía en la práctica. |
| D3 | **Sin Plan mode.** `docs/integration-claude-native.md:131` sigue vigente. | Plan mode como gate: `ExitPlanMode` es un diálogo bloqueante sin salida silenciosa — reintroduce D2 por la puerta de atrás y bloquea batches. |
| D4 | Agente nuevo **`spec-planner`**, contexto restringido, **`model: opus`**; **escribe los specs a disco sin commitear** (ver D11). | (a) Que planifique el coordinador: carga código y specs en el chat principal, y deja al spec sin autor especializado. (b) Sonnet: detectar ambigüedad real y citar es juicio; el spec es el contrato sellado de toda la cadena. |
| D5 | Juicio del set (C3, C7, C8, dims 1-6) en **`architecture-validator`**, un dispatch por epic. | Checklist de juicio en el coordinador: pierde la independencia que el framework exige en todos los gates. |
| D6 | **Default para todo proyecto, sin toggle** en §10. | Toggle (on u off): sin gate humano no hay motivo real para apagarlo, y abre el bypass "lo apago para ir rápido" que el escenario 4 cierra. |
| D7 | **Modo revisión solo a pedido explícito** por sesión, confirmación en chat. | Toggle en §10 o Plan mode: ver D3/D6. |
| D8 | **Tope de 3 rechazos** acumulados (4a+4b) → escalar. | Reintentar indefinidamente: espejo del Iteration Cap existente. |
| D9 | **Presión vaga no suprime preguntas; delegación explícita sí**, registrada y con alcance acotado (D19). | Tratar "no me preguntes" como delegación: es la racionalización que el router ya rechaza. |
| D10 | Cada aclaración se **persiste con fuente** (spec + `business_requirements.md` + ADR según corresponda). | Dejarla en el chat: se pierde al cerrar la sesión y la Dimension 4 del validator no puede citarla. |
| D11 | El planner **escribe los specs a disco sin commitear**; el coordinador hace `git add` (diffeable) y commitea tras `APPROVED`. El coordinador carga paths y listas, no el texto. | Devolver el contenido al coordinador: residuo del diseño con Plan mode (D3); reintroducía crecimiento O(trabajo) en el coordinador — la razón de crear el planner. |
| D12 | **Re-dispatch = edición mínima** sobre los archivos existentes, IDs estables, `CHANGELOG` contrastado con `git diff`. | Regenerar el set completo: el modelo no es determinista; reestructura specs sin problema y rompe el mapeo de respuestas e IDs. |
| D13 | `RESOLVED_ALONE` exige **cita textual**; C7 verifica existencia (mecánica) y pertinencia (juicio); **segundo rechazo por C7 del mismo ítem → `OPEN_QUESTION`**. | Cita por referencia (`§X`) juzgada por otro LLM: cascada de confirmación sobre citas plausibles. |
| D14 | Firmas reales como **overlay en el Dispatch Manifest**; **el spec sellado no se edita**. | Re-anclaje editando el spec: rompe inmutabilidad, habilita "otras ediciones de paso", e impide sellar con hook. |
| D15 | **`COVERAGE_TABLE` machine-readable** + chequeo **mecánico** C1/C2*/C4/C5/C6 en script (4a) antes del validator (4b). | Que el validator "determine" cobertura leyendo 500 líneas: un LLM pierde `operationId`s en documentos largos; `write-skill` exige automatizar lo automatizable. |
| D16 | **Inputs condicionales**: frontend (`design_system.md`, `navigation_map.md`, fidelity/mapping) y migración (`Template:` + `gap_analysis.md`). **Los epics de migración pasan por el gate**; `modernize` 7.1-7.2 delegan en `build`. | Dejar a `modernize` su loop inline: dos caminos para el mismo artefacto, y el planner usaría la plantilla equivocada al recoger un epic `[ ]` de migración. |
| D17 | **`SPEC_SHA` + veredicto verbatim** obligatorios en el prompt del epic-agent; **sello** vía `build-locked.json` + hook (opt-in) y `git diff <SPEC_SHA>` al procesar el reporte. | Confiar en la instrucción "no regeneres": con procedimientos largos el modelo se saltea pasos; sin evidencia no se detecta. |
| D18 | `business_requirements.md` se **edita en su lugar** con marcador `(aclarado en Epic X.Y, fecha)`. | Subsecciones-bitácora por epic: degrada la estructura de `discover` y encarece cada dispatch futuro. |
| D19 | **4 preguntas / 2-4 opciones por tanda** (límite de `AskUserQuestion`); delegación con **alcance explícito** (epic, o batch si se dijo antes de arrancarlo; nunca sobrevive la sesión). | "≤5 por tanda": excede la herramienta. Delegación sin alcance: el modelo la generaliza. |
| D20 | **Métricas antes/después** en `build-metrics.jsonl` como criterio de éxito del release (§6.5). | Asumir "neto: menos tokens": es una hipótesis; sin medición no se distingue gate útil de ceremonia. |
| D21 | **Lectura de código acotada** en el planner (solo símbolos nombrados, solo firmas y paths) + C8. | Permiso amplio de lectura: el modelo explora de más y filtra comportamiento al spec, sesgando al `tdd-test-writer`. |
