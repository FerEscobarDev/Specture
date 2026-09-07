# Specture Framework

> Una metodología de Vibe Coding para Claude Code basada en SDD (Spec-Driven Development), con configuración agnóstica al stack, agentes especializados con contexto restringido, y disciplina anti-alucinación.

Specture lleva un proyecto **desde la idea hasta el código** en 5 fases consecutivas + capacidades transversales, dispatchando agentes funcionales con contexto restringido. No replica la estructura de un equipo humano: replica las **funciones cognitivas** que la IA hace mejor cuando se le restringe el contexto. Desde v1.6.0 incluye un **contrato de API** como fuente única de verdad backend↔frontend, disciplina de diseño end-to-end (design system → showcase → aprobación → páginas), y herramientas para ingerir handoffs de diseño y auditar la sincronización back/front. Desde v1.7.0 integra documentación preexistente en proyectos Adopt sin duplicarla, captura conocimiento post-sesión con aprobación granular, y audita periódicamente el índice de docs.

---

## Instalación y Uso

### Plugin Claude Code

La forma más simple. Un solo comando en cualquier conversación de Claude Code:

```
/plugin marketplace add https://github.com/FerEscobarDev/Specture.git

/plugin install specture@specture
```

Una vez instalado, los slash commands `/specture:*` quedan disponibles en **todas** tus conversaciones. El routing es **opt-in**: Specture no intercepta nada hasta que invocas `/specture:start` (o pides iniciar/continuar el trabajo).

**Inicializar Specture en un proyecto:**

```
/specture:setup
```

Specture detectará si el proyecto está vacío (Bootstrap), tiene código existente (Adopt), o ya tiene `.specture/` (Reconfigure), y te guiará. En proyectos Adopt con documentación preexistente abundante, el setup ofrece invocar `/specture:setup-docs-bridge` para integrar esos docs sin duplicarlos.

**Usar el router (invocación explícita):**

```
/specture:start
```

O simplemente di "continuemos con el roadmap" — el `specture-router` detecta el estado y enruta.

### Plugin GitHub Copilot CLI

Specture es compatible como plugin de **GitHub Copilot CLI**, funcionando en paralelo sin alterar ni reemplazar la integración de Claude Code o Antigravity. Puedes instalarlo de las siguientes maneras:

#### Opción 1: Instalación Directa / Marketplace (Recomendado)
Añade la fuente del marketplace de Specture e instala el plugin:

```bash
copilot plugin marketplace add https://github.com/FerEscobarDev/Specture.git
copilot plugin install specture@specture
```

O instala directamente especificando la URL del repositorio:

```bash
copilot plugin install https://github.com/FerEscobarDev/Specture.git
```

#### Opción 2: Carga para Desarrollo Local (`--plugin-dir`)
Si estás desarrollando o probando modificaciones locales de Specture, inicia Copilot CLI indicando el directorio del plugin:

- **Linux / macOS**:
  ```bash
  copilot --plugin-dir /ruta/a/Specture
  ```
- **Windows (PowerShell/CMD)**:
  ```powershell
  copilot --plugin-dir C:\Proyectos\VibeCoding
  ```

#### Cómo usar Specture en Copilot CLI
1. En la sesión de Copilot CLI, selecciona el agente de enrutamiento ejecutando:
   ```bash
   /agent specture:specture-router
   ```
2. Una vez seleccionado, pide iniciar o continuar el trabajo (*"inicia el proyecto"*, *"continuemos con el roadmap"*).
3. El router inspecciona el estado del sistema de archivos y responde `PHASE: <fase> · SKILL: <ruta>` — no ejecuta la fase; invocá esa habilidad en el chat principal.

Para más información sobre la arquitectura y la matriz de compatibilidad de Copilot CLI, consulta la guía dedicada en [`docs/copilot-cli-plugin.md`](docs/copilot-cli-plugin.md).

---

### Plugin Google Antigravity CLI (`agy`)

Specture es nativamente compatible como plugin en **Google Antigravity CLI (`agy`)** y en el entorno de Antigravity IDE. Puedes instalarlo con un solo comando usando la URL del repositorio o mediante clonado:

#### Opción 1: Instalación Directa por CLI (Igual que en Claude Code)
Ejecuta directamente el comando de instalación de plugins de Antigravity especificando la URL del repositorio de GitHub:

```bash
agy plugin add https://github.com/FerEscobarDev/Specture.git
```
*(O simplemente `/plugin add https://github.com/FerEscobarDev/Specture.git` dentro de la sesión de `agy`)*.

#### Opción 2: Instalación Global por Git Clone
Si prefieres clonar manualmente en la carpeta de plugins globales de Antigravity:

- **Linux / macOS (Bash/Zsh)**:
  ```bash
  git clone https://github.com/FerEscobarDev/Specture.git ~/.gemini/config/plugins/specture
  ```
- **Windows (PowerShell)**:
  ```powershell
  git clone https://github.com/FerEscobarDev/Specture.git "$env:USERPROFILE\.gemini\config\plugins\specture"
  ```
- **Windows (CMD)**:
  ```cmd
  git clone https://github.com/FerEscobarDev/Specture.git %USERPROFILE%\.gemini\config\plugins\specture
  ```

#### Opción 3: Enlace Local (Modo Desarrollo)
Si ya clonaste Specture localmente en tu equipo y deseas usarlo o modificarlo en tiempo real:

1. Abre tu terminal en la carpeta clonada de Specture y ejecuta:
   ```bash
   agy plugin link ./
   ```
2. O especifica la ruta absoluta desde cualquier ubicación:
   ```bash
   agy plugin link C:\Proyectos\VibeCoding
   ```

#### Cómo usar Specture en Antigravity CLI
Una vez instalado o enlazado el plugin:

1. Abre la terminal en el proyecto que deseas desarrollar e inicia Antigravity:
   ```bash
   agy
   ```
2. Ejecuta el comando slash principal para iniciar el router:
   ```bash
   /specture:start
   ```
   *(También puedes escribir en el chat frases como `"configura el proyecto"`, `"inicia el proyecto"` o `"continuemos con el roadmap"`)*.

3. Specture inspeccionará la raíz de tu proyecto e iniciará la fase adecuada (`setup`, `discover`, `architecture`, `ux-design` o `build`).

Para más detalles sobre la integración de hooks y TDD Honesty Gate en Antigravity, consulta la guía dedicada en [`docs/antigravity-cli-plugin.md`](docs/antigravity-cli-plugin.md).

---

## Filosofía

1. **Configuración, no apertura.** El framework es agnóstico al stack — pero a través de un archivo de configuración por proyecto (`.specture/stack.yml`), no a costa de no opinar de nada.
2. **El contexto es un recurso, no un regalo.** Cada agente recibe SOLO los archivos que necesita. Conversaciones largas degradan calidad.
3. **Cero código sin spec. Cero fix sin causa raíz. Cero "completado" sin verificar.** Tres leyes de hierro que no se negocian.
4. **Las fases existen para controlar el contexto y prevenir alucinación, no para coordinar humanos.** Por eso son menos y más densas que en otros frameworks.

---

## Estructura del Framework

```
$SPECTURE_ROOT/
├── CLAUDE.md                          # Punto de entrada (modo @import manual)
├── settings.json                      # Registra el TDD Honesty Gate (PreToolUse) — Claude Code
├── hooks.json                         # Registro de hooks — Copilot CLI / Antigravity CLI
├── plugin.json                        # Manifiesto del plugin — Copilot CLI / Antigravity CLI
├── .claude-plugin/
│   ├── plugin.json                    # Manifiesto del plugin — Claude Code
│   └── marketplace.json               # Marketplace — Claude Code
├── .github/plugin/marketplace.json    # Marketplace — Copilot CLI
├── .github/workflows/                 # ci.yml (tests ubuntu/windows × node 22/24) · release.yml (GitHub Release desde el changelog)
├── package.json                       # Tooling del repo (no del plugin): npm test · bump · check:release
├── scripts/bump-version.js            # Sincroniza la versión en los 4 manifiestos; --check · --title · --notes
├── scripts/doctor.js                  # CLI del doctor: check · migrate · sync (también usable desde la CI de un proyecto)
├── scripts/schema-manifest.js         # Hash de los archivos que definen el esquema del proyecto (gate de release)
├── migrations/                        # Catálogo de migraciones <since>-<slug>.js + schema-manifest.json + tests
├── hooks/
│   ├── README.md                      # Cómo funcionan, schema de build-locked.json, troubleshooting
│   ├── pre-tool-use-tdd-gate.js       # Gate PreToolUse (Claude Code): tests sellados · specs sellados · allowed paths
│   ├── specture-pre-tool-use-tdd-gate.js  # Mismo gate para Copilot / Antigravity (hooks.json)
│   ├── copilot-pre-tool-use-tdd-gate.js   # Shim de compatibilidad → specture-pre-tool-use-tdd-gate.js
│   ├── lib/specture-guard.js          # Guard compartido (opt-in por hooks.enabled)
│   ├── lib/settings.js                # Lector de .specture/settings.yml (fallback a conventions §10, perfiles)
│   ├── lib/seal.js                    # Sello del build (schema v3: spec_sha/spec_paths/allowed_paths + specs[]; v2/v1 legacy; clasificación de denies)
│   ├── lib/seal-cli.js                # Único escritor del sello: write · merge-spec · unseal-spec · supersede · release · show
│   ├── lib/planning.js                # Parser de _planning.md (COVERAGE_TABLE + hash), del bloque de epic y de los specs
│   ├── lib/spec-set-check.js          # Gate 4a: C1/C2/C4/C5/C6 (+ C-path/C-gap/C-sup) sobre el set de specs → MECH_CHECK token
│   ├── lib/metrics-report.js          # Lector de docs/.specture-meta/build-metrics.jsonl (+ --baseline) — knowledge stats
│   ├── lib/doctor/                    # Chequeos del doctor: corpus · estado · drift · migrate
│   └── test/                          # Tests de contrato del plugin, hooks, settings y doctor
├── copilot/
│   ├── agents/*.agent.md              # Espejos de los agentes para Copilot CLI
│   └── compatibility-matrix.json      # Paridad skills/agentes/gates por plataforma
├── skills/
│   ├── start/SKILL.md                 # Router: detecta el estado y enruta
│   ├── setup/SKILL.md                 # Setup en 3 modos (bootstrap/adopt/reconfigure)
│   ├── setup-docs-bridge/SKILL.md     # Sub-skill: integra docs preexistentes en proyectos Adopt (genera docs-index.yml + bridges + ADRs Proposed)
│   ├── discover/SKILL.md              # Levantamiento socrático de negocio
│   ├── architecture/SKILL.md          # Arquitectura + contrato de API + ROADMAP
│   ├── ux-design/SKILL.md             # UX/UI: nav map + design system (siempre)
│   ├── build/SKILL.md                 # Coordinador de la cola de epics + gates de sesión
│   ├── build/EPIC_LOOP.md             # Procedimiento del epic-agent (Steps 4-8: RED → GREEN → review → verify → [x])
│   ├── handoff-ingest/SKILL.md        # Convierte un handoff de diseño al stack
│   ├── contract-sync-audit/SKILL.md   # Audita sync back/front en proyectos existentes
│   ├── debug/SKILL.md
│   ├── new-feature/SKILL.md
│   ├── verify/SKILL.md
│   ├── write-skill/SKILL.md
│   ├── knowledge/SKILL.md             # Higiene de conocimiento — modos capture (ex-learn) + audit (ex-audit-knowledge)
│   ├── learn/SKILL.md                 # Alias → knowledge (capture), backward-compat
│   ├── audit-knowledge/SKILL.md       # Alias → knowledge (audit), backward-compat
│   ├── modernize/SKILL.md
│   └── doctor/SKILL.md                # Diagnóstico del corpus + migraciones de esquema (check · migrate · sync)
├── agents/
│   ├── specture-router/AGENT.md       # Router (opt-in: se invoca con /specture:start)
│   ├── spec-planner/AGENT.md            # Autor del spec: 1-3 specs por epic + preguntas
│   ├── architecture-validator/AGENT.md  # Valida planes/contrato contra .specture/
│   ├── tdd-test-writer/AGENT.md         # Escribe tests desde el spec (sin ver código)
│   ├── implementer/AGENT.md             # Implementa para pasar tests (backend/lógica)
│   ├── ux-implementer/AGENT.md          # Implementa UI: tokens, a11y, cliente tipado
│   └── code-reviewer/AGENT.md           # Review unificado (spec + arch + quality + front)
├── templates/
│   ├── project-config/                # Plantillas de .specture/ del proyecto destino
│   │   ├── stack.template.yml
│   │   ├── settings.template.yml      # schema_version + perfil + toggles (archivo del framework)
│   │   ├── conventions.template.md
│   │   ├── docs-index.template.yml    # Catálogo machine-readable de docs preexistentes
│   │   └── decisions/000-template.md
│   ├── ARCHITECTURE_TEMPLATE.md
│   ├── API_CONTRACT_TEMPLATE.md
│   ├── api-contract.openapi.template.yaml
│   ├── ROADMAP_TEMPLATE.md
│   ├── SPEC_TEMPLATE.md
│   ├── BUSINESS_REQUIREMENTS_TEMPLATE.md
│   ├── DESIGN_SYSTEM_TEMPLATE.md
│   ├── DEBUG_LOG_TEMPLATE.md
│   └── LEARN_OUTPUT_TEMPLATE.md       # Reporte humano-legible de knowledge capture (opt-in, a pedido)
└── docs/
    ├── original-vision.md             # Visión y requisitos originales del framework
    ├── framework-roadmap.md           # Roadmap consolidado del framework (checklist priorizado)
    ├── release-process.md             # Cómo se versiona y publica el plugin (4 manifiestos, CI, Release)
    └── *-design.md · *-review.md · *-report.md · guías por plataforma
```

---

## Las 5 Fases

| # | Skill | Slash command | Cuándo se activa | Output |
|---|-------|--------------|------------------|--------|
| **0** | `setup` | `/specture:setup` | Sin `.specture/stack.yml` | `.specture/` poblado + `CLAUDE.md` del proyecto |
| **1** | `discover` | `/specture:discover` | Sin `docs/01-requirements/business_requirements.md` | Reglas de negocio, actores y edge cases con IDs estables (`RN/CL/FA`), desde template y con chequeo mecánico de salida |
| **2** | `architecture` | `/specture:architecture` | Sin `docs/04-roadmap/ROADMAP.md` | Arquitectura + **contrato de API (OpenAPI + doc legible)** + ROADMAP de milestones/epics |
| **3** | `ux-design` | `/specture:ux-design` | Frontend declarado + `docs/03-ux-ui/` incompleto | Mapa de navegación + **design system completo (siempre)** + (Ruta 1) specs para IA de diseño externa |
| **4** | `build` | `/specture:build` | ROADMAP con epics `[ ]` o `[/]` | Specs planificados, chequeados mecánicamente como set (`MECH_CHECK`), validados y **sellados** por epic (Spec Planning Gate) + código testeado, revisado, verificado + una línea de métricas por epic |

## Capacidades Transversales

| Skill | Slash command | Activación |
|-------|--------------|-----------|
| `debug` | `/specture:debug` | Test falla 2+ veces, build roto, reviewer rechaza, implementer BLOCKED |
| `new-feature` | `/specture:new-feature` | Usuario pide funcionalidad fuera del ROADMAP original |
| `verify` | `/specture:verify` | Antes de cualquier "completado", "fixed", "passing" |
| `write-skill` | `/specture:write-skill` | Crear o modificar skills del framework |
| `modernize` | `/specture:modernize` | Subir versión de una tecnología o migrar a otro stack |
| `handoff-ingest` | `/specture:handoff-ingest` | Tienes un handoff de diseño (Claude Design/v0/Lovable) para convertir al stack |
| `contract-sync-audit` | `/specture:contract-sync-audit` | Frontend y backend desincronizados en un proyecto existente |
| `setup-docs-bridge` | `/specture:setup-docs-bridge` | Proyecto Adopt con documentación preexistente abundante (≥10 .md). Genera `docs-index.yml` + bridges + ADRs Proposed |
| `knowledge` (capture) | `/specture:knowledge` · alias `/specture:learn` | Captura post-sesión opt-in (post-epic, post-debug, manual). Propone drafts de ADRs/índice/conventions con aprobación granular |
| `knowledge` (audit) | `/specture:knowledge audit` · alias `/specture:audit-knowledge` | Auditoría periódica (1-3 meses) del `docs-index.yml`: detecta orphans, duplicates, stale, uncovered. Read-only |
| `knowledge` (stats) | `/specture:knowledge stats` | Lee `docs/.specture-meta/build-metrics.jsonl` (una línea por epic, trackeada) y aplica la lectura del gate: ¿bajan los defectos aguas abajo? ¿pregunta el planner? ¿sube `spec_defect`? Ofrece reconstruir el baseline de los epics previos al gate. Read-only |
| `doctor` | `/specture:doctor` · `check` \| `migrate` \| `sync` | Después de actualizar el plugin, cuando `start` avisa migraciones pendientes, o para lintear el corpus (rutas rotas, ADRs duplicados, reviews sin veredicto, sello huérfano). `check` es solo lectura; `migrate` aplica las migraciones mecánicas y lleva las asistidas a Plan mode |

---

## Los 7 Agentes

Specture **no** especializa por capa técnica arbitraria (no hay un "Agente Backend" vs "Agente Frontend" partido por dónde vive el archivo — eso es falsa especialización). Especializa por **función cognitiva** con contexto restringido. `implementer` y `ux-implementer` no son "backend vs frontend por capa": son dos funciones cognitivas distintas — *hacer pasar tests de lógica* vs *renderizar con fidelidad al design system, accesibilidad y cliente tipado*. La calidad visual y la adherencia a tokens son una lente cognitiva que el implementer genérico (optimizado para TDD de lógica) no tiene. El sexto, `spec-planner`, es el **autor especializado del spec**: traduce un epic en 1-3 specs validados y separa lo resuelto con cita textual de lo que solo el usuario puede decidir. El séptimo, `specture-router`, no construye nada: solo detecta la fase (opt-in, vía `/specture:start`).

| Agente | Función | Contexto que recibe | Contexto que NO recibe |
|--------|---------|---------------------|-------------------------|
| `specture-router` | Detectar la fase y devolver `PHASE · SKILL` (opt-in; nunca ejecuta la fase) | Existencia de archivos clave + checkboxes del ROADMAP | Contenido de los documentos, historial de chat |
| `spec-planner` | Traducir un epic en 1-3 specs code-free; citar textualmente o preguntar (`OPEN_QUESTIONS`) | Bloque del epic + fuentes enlazadas + slice del contrato + templates + tabla **Code Surface** (`símbolo → path → firma`, resuelta por el coordinador) | Código (no abre archivos fuente), memoria, Context7 |
| `architecture-validator` | Validar que plan/spec/ROADMAP/**contrato** respeta stack, ADRs y el contrato de API; en el dispatch de **set** por epic, C3 (dueño de cada Fuera de Scope) + C7 (citas) + C8 (Superficie sin comportamiento) | Documento + `.specture/` + token `MECH_CHECK` (+ contrato / `_planning.md` + todos los specs en el dispatch de set) | Código de implementación |
| `tdd-test-writer` | Escribir tests desde el spec | Spec + business rules + testing framework | Código de implementación (anti-bias crítico) |
| `implementer` | Hacer que los tests pasen (lógica/backend) | Spec + tests + archivos a tocar | Conversación entera, archivos no relevantes |
| `ux-implementer` | Implementar UI con fidelidad al design system | Spec + design system + slice del contrato + tests + checklist de marca | URLs a mano, valores hardcodeados, código no relacionado |
| `code-reviewer` | Review unificado (spec + arch + quality + TDD + **frontend**); verifica que cada `Crea:` exista en HEAD con la firma declarada; devuelve `CAUSE:` parseable | Diff + spec + `.specture/` + supersesiones declaradas (+ design system/contrato en epics de UI) | Sugerir fixes (solo reporta) |

---

## Referencia de Comandos y Agentes

### Slash Commands (`/specture:*`)

#### `/specture:start`
**Router principal del framework.** Úsalo al iniciar cualquier conversación o cuando no estés seguro de en qué fase está el proyecto. Inspecciona el filesystem (no el historial de chat) para detectar el estado actual y redirige automáticamente al skill correcto. Es una máquina de estados: si falta `.specture/stack.yml` → enruta a `setup`; si falta `business_requirements.md` → a `discover`; si falta el `ROADMAP.md` → a `architecture`; si hay epics pendientes → a `build`.

> Úsalo cuando digas "continuemos", "sigamos con el roadmap", o al empezar una sesión nueva.

---

#### `/specture:setup`
**Configura Specture en el proyecto destino.** Opera en tres modos que detecta automáticamente:
- **Bootstrap** — proyecto vacío: guía un wizard interactivo para definir el stack, naming conventions y primer ADR.
- **Adopt** — proyecto existente con código: lee la estructura actual, infiere el stack, y propone una configuración `.specture/` sin romper nada.
- **Reconfigure** — ya tiene `.specture/`: actualiza stack, conventions o decisiones archivadas.

Output: directorio `.specture/` con `stack.yml`, `conventions.md`, `decisions/` + `CLAUDE.md` en el proyecto.

> Úsalo cuando digas "configura el proyecto", "setup", "ajusta las reglas", o cuando `.specture/stack.yml` no existe.

---

#### `/specture:discover`
**Levantamiento socrático de requerimientos de negocio.** Actúa como Product Architect + Business Analyst. NO habla de tecnología — si el usuario intenta hablar de frameworks, lo redirige. Extrae actores, user stories, reglas de negocio, edge cases y scope mediante preguntas en lotes de 3-5, esperando respuesta antes de seguir.

Output: `docs/01-requirements/business_requirements.md` desde `templates/BUSINESS_REQUIREMENTS_TEMPLATE.md`: reglas (`RN-nnn`), casos límite (`CL-nnn`) y exclusiones (`FA-nnn`) con IDs estables que specs, ROADMAP y `_current/` citan por ID. La salida pasa por un **chequeo mecánico del doctor** (placeholders, `Exposición`, Capacidades de Frontera, IDs) antes de entregarse.

> Úsalo cuando digas "inicia el proyecto", "levanta los requerimientos", "definamos el negocio".

---

#### `/specture:architecture`
**Diseña la arquitectura técnica, el contrato de API y genera el ROADMAP.** Fusiona tres responsabilidades: (1) produce `architecture.md` basado en el stack declarado en `stack.yml` (nunca inventa tecnología); (2) produce el **contrato de API** — `api-contract.openapi.yaml` (fuente de verdad machine-readable) + `api-contract.md` (versión legible) — que es la única fuente de verdad de la interfaz backend↔frontend, eliminando que cada lado invente sus propias URLs y shapes; (3) convierte arquitectura + contrato + requerimientos en un `ROADMAP.md` de milestones/epics con dependencias explícitas, ordenando los epics de frontend tras los de backend que implementan las operaciones que consumen. Valida **los tres documentos** con el agente `architecture-validator` — incluido el ROADMAP: gramática parseable de `Dependencias`, cada `operationId` implementado por exactamente un epic backend, cobertura de `RN-nnn`, sizing de 1-3 specs por epic.

Output: `docs/02-architecture/architecture.md` + `docs/02-architecture/api-contract.openapi.yaml` (+ `.md`) + `docs/04-roadmap/ROADMAP.md`.

> Úsalo cuando digas "diseñemos la arquitectura", "generemos el roadmap", o cuando `ROADMAP.md` no existe.

---

#### `/specture:ux-design`
**Define UX e información arquitectónica antes de escribir UI.** Solo se activa si el proyecto tiene frontend declarado en `stack.yml`. **Ambas rutas producen los mismos dos documentos** (`navigation_map.md` + `design_system.md` completo); la ruta solo decide *quién renderiza el design system a código*:
- **Ruta 1 (Delegada)** — además genera `design_specs_for_ai.md`, un brief para una IA de diseño externa (Claude Design, v0, Lovable) que **exige entregar un design system** con todos los componentes reutilizables. El handoff que vuelva se convierte con `handoff-ingest`.
- **Ruta 2 (Specture renderiza)** — el design system se codifica en los epics de frontend de la Fase 4 (tokens → componentes → página `/dev/design-system` → aprobación del usuario → páginas).

El mapa de navegación referencia las operaciones por `operationId` del contrato — no inventa URLs. No produce código en esta fase. Excepción Adopt-con-UI: el design system se documenta a partir del código existente en vez de diseñarse.

Output: `docs/03-ux-ui/navigation_map.md` + `docs/03-ux-ui/design_system.md` (+ Ruta 1: `design_specs_for_ai.md`).

> Úsalo cuando el frontend esté declarado y `docs/03-ux-ui/` no exista.

---

#### `/specture:build`
**Orquesta el loop de construcción plan → test → código → review por epic.** Es el skill más denso. **Cada epic se planifica completo antes de ejecutar** (Spec Planning Gate): el coordinador despacha al `spec-planner`, que escribe los 1-3 specs y **pregunta solo lo que las fuentes no responden** (≤4 preguntas por tanda, ≤2 tandas, siempre con una recomendada) — un epic bien descubierto corre hasta `[x]` sin una sola interrupción, así que "todas" sigue siendo desatendido. El `architecture-validator` aprueba cada spec (incluidas las citas de `RESOLVED_ALONE`, chequeo C7) y la evidencia queda trackeada en `docs/05-specs/<epic>/_planning.md`. Recién entonces el epic-agent ejecuta: `tdd-test-writer` (RED commit) → `implementer` (GREEN) → `code-reviewer`, con el **TDD Honesty Gate** (`git diff`) en el medio. Marca el epic `[x]` solo cuando el reviewer aprueba y los tests pasan.

**Cómo pedir revisión o delegar:** *"construí con revisión de specs"* frena el gate en el resumen para que confirmes; *"si hay dudas usá la recomendada"* delega las respuestas (quedan registradas como `fuente: delegado por el usuario`, con alcance solo al epic nombrado). La presión vaga ("hazlo rápido, no preguntes") **no** suprime preguntas de contrato.

**Etapa 2 del gate (v1.18.0) — el set y la evidencia.** Antes de gastar un dispatch del validator, el coordinador corre `hooks/lib/spec-set-check.js` sobre el **conjunto** de specs: cada `operationId` del epic en exactamente un spec, cada `RN-nnn` citada, cada firma `(planeada — re-anclar)` idéntica a la que crea el spec anterior, orden de dependencia, tamaño — un hueco o un desajuste vuelve al planner sin pasar por el validator, y el token `MECH_CHECK: PASS <sha>` es input obligatorio del validator. El planner ya **no abre código**: el coordinador le entrega una tabla `símbolo → path → firma` de la carpeta raíz del componente (Code Surface Resolution). El validator recibe además **un dispatch de set** por epic (C3: todo "Fuera de Scope" tiene dueño; C7: citas; C8: Superficie solo firmas y paths). Tras el commit de planificación, los specs quedan **sellados** (`spec_sha` + `spec_paths` en `build-locked.json`, escritos con `hooks/lib/seal-cli.js`): con hooks, editar un spec se deniega; sin hooks, el coordinador corre `git diff <SPEC_SHA>..HEAD` al procesar el reporte y escala cualquier diff como `REJECTED_MAJOR`. Con hooks, el sello también lleva los paths `Crea:`/`Modifica:` de los specs y **deniega cualquier escritura de código fuera de ellos** (cero código sin spec): un archivo que falta no se agrega a escondidas — el implementer reporta `BLOCKED: spec <ID>` y el planner suma la línea `Modifica:`. El `code-reviewer` verifica que cada símbolo `Crea:` exista en HEAD con la firma declarada y devuelve `CAUSE:` (`none | implementation | spec_defect | architecture`). Un test de un epic **cerrado** que el nuevo spec contradice se declara (`Supersede: <path>::<test> — motivo: BR-n`), se aplica en un commit `test(supersede)` previo al RED y queda registrado en `_planning.md` — nunca más un ledger de excepciones. Y cada epic deja una línea en `docs/.specture-meta/build-metrics.jsonl` (trackeado): `/specture:knowledge stats` la lee y te dice si el gate está atrapando ambigüedad real.

**Modo Frontend (v1.6.0):** cuando el epic es de UI, despacha `ux-implementer` en vez del implementer genérico y aplica el orden obligatorio: el epic de **design system** se construye primero (tokens + componentes + ruta `/dev/design-system`) y pasa por un **gate de aprobación visual humana** (Claude puede capturar screenshots con Playwright; el usuario aprueba) antes de que se construya cualquier página. Las páginas consumen el backend solo a través del **cliente tipado generado del contrato**, en orden de dependencia de `operationId`.

Output: código implementado, testeado, revisado, y ROADMAP actualizado.

> Úsalo cuando digas "construyamos", "implementemos el siguiente epic", o cuando el ROADMAP tenga epics `[ ]`.

---

#### `/specture:debug`
**Debug sistemático con causa raíz obligatoria.** Se activa ante cualquiera de estos triggers: un test falla por segunda vez, el build se rompe, el `code-reviewer` devuelve `REJECTED_MAJOR`, el `implementer` reporta `BLOCKED`, o el usuario reporta un bug. Prohíbe fixes sin investigación previa. Obliga a escribir un `DEBUG_LOG.md` con síntoma, hipótesis, experimentos y causa raíz confirmada antes de proponer cualquier solución.

> Úsalo ante cualquier fallo que no se resuelve con el primer intento.

---

#### `/specture:new-feature`
**Integra una funcionalidad nueva que no estaba en el ROADMAP original.** Realiza un mini-discovery socrático scopeado a la nueva feature, luego ejecuta un **Impact Ripple Analysis** — analiza qué specs existentes se ven afectados por la nueva feature, qué contratos cambian, qué tests pueden romperse. Agrega el nuevo milestone/epic al ROADMAP con dependencias explícitas y enruta al build loop.

> Úsalo cuando digas "quiero agregar X", "necesito una nueva funcionalidad", "ahora también queremos…".

---

#### `/specture:verify`
**Gate de verificación antes de cualquier claim de "completado".** Implementa la regla: evidencia antes que afirmaciones. Antes de commitear, crear un PR, o marcar un epic como `[x]`, identifica el comando de verificación relevante (tests, lint, build, type-check), lo ejecuta en el turno actual, lee el output completo, y solo entonces emite el veredicto. No acepta output cacheado ni asume que algo "debería pasar".

> Úsalo antes de cualquier "listo", "completado", "pasan los tests", "fixed".

---

#### `/specture:write-skill`
**Crea o modifica skills y agentes del framework.** Trata a los skills como código: impone TDD para documentación — primero observa cómo Claude falla sin el skill (baseline), luego escribe el skill para corregir ese comportamiento, luego verifica que el comportamiento cambió. Nunca escribe el skill antes de ver el fallo que debe corregir. Aplica las convenciones CSO (`description: Use when...`) y el formato de frontmatter correcto.

> Úsalo cuando quieras crear nuevos skills o modificar el comportamiento del framework.

---

#### `/specture:modernize`
**Modernización tecnológica incremental con red de seguridad.** Cubre dos casos: (1) **Version Upgrade** — misma tecnología, versión mayor (.NET 8 → 10, Angular 6 → 20, Node 18 → 22); (2) **Tech Migration** — cambio de tecnología con función equivalente (AngularJS → React, Express → NestJS, Vue 2 → Vue 3).

Flujo en 8 pasos:
1. **Discovery** — detecta tipo de migración y confirma con el usuario.
2. **Gap Analysis** — documenta breaking changes, APIs deprecadas, mapa de equivalencias, impacto por módulo. Validado por `architecture-validator`.
3. **Migration Strategy** — siempre Strangler Fig (nunca Big Bang); ordena módulos de inside-out; define seams de coexistencia.
4. **stack.yml + ADR** — agrega sección `migration:` al stack.yml y crea ADR de decisión.
5. **Characterization Tests** ← **GATE OBLIGATORIO** — despacha `tdd-test-writer` con brief especial para documentar el comportamiento actual. Todos deben pasar en el stack viejo. Commit → captura `CHARACTERIZATION_SHA`.
6. **Migration ROADMAP** — agrega milestone "Migration: Source → Target" al `ROADMAP.md` con un epic por módulo + cleanup epic al final.
7. **Execution per-epic** — mismo loop de 9 pasos que `/specture:build`, con `MIGRATION_SPEC_TEMPLATE.md`, contexto adicional de gap analysis, y una dimensión extra en el code review: "no mixed tech debt" dentro del módulo migrado.
8. **Completion Gate** — suite completa en nuevo stack, cleanup epic, eliminación de la sección `migration:` del stack.yml.

Output: `docs/migration/gap_analysis.md` + milestone de migración en `ROADMAP.md` + código migrado módulo a módulo + ADR de cierre.

> Úsalo cuando digas "migra a X", "sube la versión a Y", "moderniza el stack", "quiero pasar de A a B".

---

#### `/specture:handoff-ingest`
**Convierte un handoff de diseño en los artefactos del proyecto.** Optimizado para handoffs de **Claude Design** (un paquete con README de design system, archivo de tokens, prototipos por pantalla, ui_kit y a veces un `SKILL.md`). Mapea el handoff, **extrae los tokens de forma determinista** a `design_system.md`, convierte las reglas de marca del README en un `fidelity-checklist.md` verificable, y mapea cada pantalla a su ruta y a las operaciones del contrato (`handoff-mapping.md`). Detecta el modo de conversión: **copia literal** si el stack del handoff coincide con el destino, o **traducción por paridad visual** si difiere (preservando tokens y reglas, re-autorando componentes en el framework destino). No escribe código de producción — eso ocurre en la Fase 4 con `ux-implementer`, tras el gate de aprobación visual.

Output: `docs/03-ux-ui/design_system.md` + `fidelity-checklist.md` + `handoff-mapping.md` + assets copiados.

> Úsalo cuando tengas un handoff de diseño (Claude Design, v0, Lovable) que convertir a tu stack.

---

#### `/specture:contract-sync-audit`
**Audita la sincronización entre frontend y backend en proyectos existentes.** Para cuando "el front espera cosas que el back no devuelve", URLs distintas, o 404 en llamadas que "deberían funcionar". Elige una **fuente canónica** (un contrato existente, el backend, el frontend, o un contrato reconciliado propuesto), extrae estáticamente las rutas del backend y las llamadas del frontend, las diffea (endpoint faltante, mismatch de URL/método/shape, endpoint huérfano, auth) y emite un reporte de reconciliación. **No aplica fixes automáticos** — propone los cambios contra la fuente canónica y enruta a `build`/`new-feature`/`debug`. Si no existía contrato, deja un `api-contract.openapi.yaml` propuesto.

Output: `docs/02-architecture/contract-sync-report.md` (+ contrato propuesto si faltaba).

> Úsalo cuando el frontend y el backend estén desincronizados en un proyecto que ya tiene este problema.

---

#### `/specture:setup-docs-bridge`
**Integra documentación preexistente en proyectos Adopt sin duplicarla.** Sub-skill invocable desde `setup` (Step 8.5) o de forma independiente para refresh. Detecta carpetas con ≥10 archivos `.md` (`SGD.Docs/`, `Documentation/`, `wiki/`, `docs/`, `*.Docs/`), categoriza heurísticamente con path + keywords como **draft mostrado al usuario** (nunca aplicado en silencio), genera bridges referenciales en `docs/01-`, `docs/02-`, `docs/03-` que apuntan a los originales sin copiarlos, y propone ADRs implícitos con `Status: Proposed — awaiting team confirmation`. Escribe `.specture/docs-index.yml` (schema v1, machine-readable) que el orquestador consulta para resolver docs relevantes por epic. Nunca reorganiza ni duplica los docs originales.

Output: `.specture/docs-index.yml` + bridges en `docs/0X-*/` + ADRs Proposed en `.specture/decisions/`.

> Úsalo cuando un proyecto Adopt tenga una carpeta de docs preexistente que Specture deba reconocer sin tocar.

---

#### `/specture:knowledge` (modos `capture` | `audit` | `stats`)
**Higiene de conocimiento del proyecto, unificada en una skill con tres modos** (v1.11.0; `stats` desde v1.18.0). Los aliases `/specture:learn` → `capture` y `/specture:audit-knowledge` → `audit` siguen funcionando.

**Modo `capture`** (ex-`/specture:learn`): captura post-sesión opt-in del conocimiento descubierto. Se activa al final de un epic (build Step 8.5), tras confirmar una causa raíz (debug Phase 4.5), manualmente, o con `--teach <concepto>`. Filtra relevancia, recolecta evidencia, cross-referencia el `docs-index.yml`, y genera hasta **3 drafts** por invocación (entrada de índice `ai_categorized`, ADR `Status: Proposed`, patch a `conventions.md`/bridge, o test de characterization pendiente). El usuario **aprueba en bloque vía Plan mode**. Hard token budget ~30K. **Nunca escribe a la memoria personal de Claude.** Gate: `knowledge.enabled` (§10). Output: drafts + log en `docs/.specture-meta/learn-history.jsonl`.

**Modo `audit`** (ex-`/specture:audit-knowledge`): auditoría periódica read-only del `docs-index.yml`. Detecta **ORPHAN** (HIGH), **DUPLICATE_CANDIDATE** (MEDIUM), **STALE/VERY_STALE** (LOW/MEDIUM), **UNCOVERED** (LOW), **UNKNOWN_AGE** (LOW); calcula un **health score 0-100**. **Nunca auto-corrige** — propone acciones y el usuario decide. Output: `docs/.specture-meta/last-audit.md` + `audit-history.jsonl`.

**Modo `stats`** (v1.18.0): lee `docs/.specture-meta/build-metrics.jsonl` — la línea por epic que el coordinador de `build` anexa y commitea (`planner_dispatches`, `open_questions`, `c7_rejections`, `mech_check_failures`, `needs_context_spec`, `iteration_cap_spec`, `blocked_spec`, `reviewer_rejected_major_spec_defect`, `review_rejections`, `supersessions`, `outcome`, `tokens` opcional) — vía `hooks/lib/metrics-report.js`, y aplica la lectura del diseño del gate: bajan los defectos aguas abajo → el gate atrapa ambigüedad real; no bajan y `open_questions ≈ 0` → el planner no pregunta; sube `spec_defect` → mantener la validación por spec (decisión A6). Si no hay archivo, ofrece `--baseline --write`: reconstruye una línea por epic cerrado desde los veredictos de `docs/07-reviews/`, los contadores de `_planning.md` y el `git log`. Read-only.

> Úsalo (capture) cuando termine un epic / se confirme un root cause / quieras formalizar lo descubierto; (audit) cada 1-3 meses o cuando el índice parezca desfasado; (stats) cada ~10 epics con gate para decidir sobre él con datos.

---

#### `/specture:doctor` (modos `check` | `migrate` | `sync`)
**Diagnóstico mecánico del proyecto y migraciones de esquema.** Specture versiona el plugin; el doctor versiona el **proyecto**. `check` (solo lectura) lintea el corpus documental — rutas citadas que no existen, placeholders `...`, ADRs con número duplicado o sin `Status`, reviews sin veredicto, specs sin `AC/BR/EC`, sobre 300 líneas o con secciones fuera del template, citas por número de línea a documentos vivos —, lintea los requerimientos — placeholders sin resolver, HUs sin `Exposición`, historias de frontera sin consolidar, reglas/casos/exclusiones sin IDs `RN/CL/FA` —, revisa el estado — sello `build-locked.json` huérfano, más de un epic `[/]`, `_current/` ausente con milestones cerrados, `docs-index.yml` vs toggle, residuos de worktrees — y compara `schema_version` (`.specture/settings.yml`) con la versión del plugin para listar las migraciones pendientes por tipo. `migrate` aplica las **mecánicas** (idempotentes, verificadas, registradas en `.specture/migrations.log`), lleva las **asistidas** a Plan mode y registra las de **contenido** con su skill dueño; `sync` = mecánicas + check (para CI). Nunca commitea; nunca toca specs cerrados, reviews ni debug logs.

> Úsalo después de actualizar el plugin, cuando `/specture:start` avise migraciones pendientes, o cuando sospeches referencias rotas. Catálogo de migraciones: `migrations/`; detalle: `skills/doctor/SKILL.md` y `docs/doctor-and-migrations-design.md`.

---

### Agentes

Los agentes de Specture son subagentes con **contexto restringido** — cada uno recibe exactamente los archivos que necesita, no la conversación completa. Esto previene drift y alucinación acumulada.

---

#### `specture-router`
**Router del framework (opt-in, desde v1.5.0; salida estricta desde v1.16.0).** Cuando se lo invoca explícitamente, corre la máquina de estados de `skills/start/SKILL.md` en **solo lectura** y devuelve exactamente `PHASE: <fase> · SKILL: <ruta>` — **nunca ejecuta la fase**: el chat principal invoca el skill. **No intercepta** automáticamente las conversaciones: el routing se activa solo a pedido.

- **Se activa:** invocando `/specture:start`, o cuando el usuario pide iniciar/continuar trabajo de Specture ("continuemos con el roadmap", "inicia el proyecto"). **Nunca automáticamente.**
- **No escribe código, no invoca skills, no despacha subagentes** — solo detecta y nombra la fase.

---

#### `spec-planner`
**Autor especializado del spec (v1.17.0).** Traduce **un** epic en 1-3 specs code-free, self-contained y ordenados por dependencia; los escribe a disco sin commitear y no toca nada fuera de `docs/05-specs/<epic-slug>/`. Su regla de hierro: **no existe el tercer estado** — toda duda que cambie el contrato observable queda `RESOLVED_ALONE` con **cita textual** de una fuente entregada, o va a `OPEN_QUESTIONS` como pregunta cerrada con opciones. En re-dispatch edita mínimamente (IDs y slugs estables, `CHANGELOG` contrastado contra `git diff`).

- **Contexto que recibe:** bloque del epic + secciones enlazadas de requerimientos/arquitectura + slice del contrato + templates (`SPEC_TEMPLATE` o `MIGRATION_SPEC_TEMPLATE` + `PLANNING_TEMPLATE`) + ADRs Accepted + `_current/`/docs-index resueltos + la tabla **Code Surface** (`SYMBOL | PATH | SIGNATURE` de la carpeta raíz del componente, resuelta por el coordinador — v1.18.0).
- **Contexto que NO recibe:** el código (desde v1.18.0 **no abre archivos fuente**: un símbolo ausente de la tabla es un `CONCERNS`, nunca una lectura ni una firma inventada), memoria, Context7, historial.
- **Salida machine-readable:** la `COVERAGE_TABLE` de `_planning.md` (gramática exacta de `templates/PLANNING_TEMPLATE.md`: `op:` / `br:` / `sym:` / `oos:` / `gap:` / `sup:`) la parsea `hooks/lib/spec-set-check.js` — una fila que no parsea vuelve como `VIOLATIONS`.
- **Output:** `STATUS` + `SPECS` + `COVERAGE_TABLE` + `OPEN_QUESTIONS` + `RESOLVED_ALONE` + `CHANGELOG` + `CONCERNS`.
- **Modelo:** Opus (detectar ambigüedad real y citar es juicio; el spec es el contrato sellado de toda la cadena).

---

#### `architecture-validator`
**Revisor independiente de conformidad arquitectónica.** Recibe un documento (plan, spec, o architecture.md) y lo compara contra `.specture/stack.yml`, `conventions.md`, y todos los ADRs aceptados. Devuelve `APPROVED` o `REJECTED` con las violaciones específicas (tecnología no declarada en stack, patrón prohibido, ADR ignorado, naming incorrecto). En el Spec Planning Gate corre dos veces por epic (v1.18.0): **un dispatch de set** (`SPEC_SET`: todos los specs + `_planning.md` + extractos citados + Code Surface) para la Dimensión 7 — C3 todo "Fuera de Scope" tiene dueño, C7 citas verbatim que responden la duda, C8 Superficie solo firmas y paths, C2 fallback si el chequeo mecánico no pudo verificar — y luego **un dispatch por spec** (dims 1-6). Todo spec del planner llega con el token `MECH_CHECK` del chequeo mecánico; sin él responde `BLOCKED`.

- **Contexto que recibe:** documento candidato + `.specture/` completo + `MECH_CHECK` (+ el set y `_planning.md` en el dispatch de set).
- **Contexto que NO recibe:** código de implementación.
- **Output:** `APPROVED` | `REJECTED — [violaciones]` | `BLOCKED — missing input: [qué]`
- **Modelo:** Opus (razonamiento de alta precisión).

---

#### `tdd-test-writer`
**Especialista en fase RED del ciclo TDD.** Traduce un `.spec.md` a tests que fallan. La restricción crítica es que **nunca ve el código de implementación** — si lo recibe, rechaza el contexto activamente. Tests escritos mirando la implementación testean lo que el código hace, no lo que el negocio requiere.

- **Contexto que recibe:** spec validado + business rules + stack (testing framework) + conventions (sección testing) + fixtures existentes (no código de producción).
- **Contexto que NO recibe:** archivos de implementación (anti-bias crítico).
- **Output:** archivos de test que fallan al ejecutarse (RED commit).
- **Modelo:** Sonnet.

---

#### `implementer`
**Ingeniero de implementación con contexto mínimo.** Recibe el spec, los tests fallando, y los archivos fuente relevantes (solo los que debe tocar). Escribe el código mínimo para hacer pasar los tests. Tiene prohibido modificar, saltar, o debilitar los tests recibidos — el **TDD Honesty Gate** del build loop verifica esto con `git diff`. Escribe **solo dentro de la superficie declarada** por el spec (`Crea:`/`Modifica:`): con hooks, una escritura fuera se deniega (Allowed Paths); un archivo que el spec no declara es un hueco del spec → `BLOCKED: spec <ID>`, nunca un rodeo. Si algo falta para proceder, responde `NEEDS_CONTEXT` en lugar de inventar.

- **Contexto que recibe:** spec + tests (RED) + archivos fuente a modificar + `.specture/`.
- **Contexto que NO recibe:** la conversación entera, archivos no relacionados.
- **Output:** código que hace pasar los tests, sin modificar los tests.
- **Modelo:** Sonnet.

---

#### `ux-implementer`
**Ingeniero de frontend con ojo de diseñador.** Contraparte de UI del `implementer`. Hace pasar los tests de lógica/contrato/a11y **y** es fiel al design system: cada color/espaciado/tipografía sale de tokens (cero hardcodes), accede al backend solo por el **cliente tipado generado del contrato** (cero URLs a mano), cumple WCAG AA y las reglas de marca. En el epic de design system construye tokens + componentes + la ruta `/dev/design-system`; la aprobación visual la decide el usuario (el orquestador corre ese gate). Honra el TDD Honesty Gate igual que el implementer.

- **Contexto que recibe:** spec + `design_system.md` + slice del contrato (operationId + ruta del cliente tipado) + tests RED + archivos a tocar + checklist de fidelidad (si hubo handoff).
- **Contexto que NO recibe:** URLs a mano, valores hardcodeados, código no relacionado, conversación entera.
- **Output:** UI que pasa los tests, fiel a tokens/contrato/a11y, sin tocar los tests.
- **Modelo:** Sonnet.

---

#### `code-reviewer`
**Staff Engineer + Lead Reviewer en un solo pase.** Revisa el código implementado en cuatro dimensiones core simultáneas — (1) conformidad con el spec, incluida la **superficie declarada** (cada símbolo `Crea:` existe en HEAD con la firma declarada — BLOCKER si diverge; escrituras fuera de `Crea:`/`Modifica:` son sobre-implementación), (2) conformidad con arquitectura y ADRs, (3) calidad del código, (4) honestidad TDD (incluidas las supersesiones declaradas: la revisión no debe tocarlas y nada no declarado puede tocar un test de un epic cerrado) — más dos opcionales: (5) idiomaticidad del stack vía Context7, y (6) **fidelidad de frontend** en epics de UI (adherencia a tokens, accesibilidad, adherencia al contrato, reglas de marca). No modifica código — produce un reporte estructurado.

- **Contexto que recibe:** diff del implementer + spec + `.specture/` + output de tests + sección relevante de `architecture.md` + supersesiones declaradas (+ design system y slice del contrato en epics de UI).
- **Output:** `APPROVED` | `REJECTED_MINOR — [lista de fixes]` | `REJECTED_MAJOR — [razón crítica]`, siempre con `CAUSE: none | implementation | spec_defect | architecture` (la señal `spec_defect` alimenta las métricas y la decisión A6).
- **Modelo:** Opus (máxima precisión en review).

---

## Configuración por Proyecto

Cada proyecto que use Specture tiene una carpeta `.specture/`:

```
[proyecto-usuario]/
├── CLAUDE.md                  # Importa Specture vía @import (solo modo manual)
├── .specture/
│   ├── stack.yml              # Stack tecnológico (fuente de verdad)
│   ├── conventions.md         # Naming, patrones, estilo
│   ├── settings.yml           # Del framework: schema_version, perfil, toggles (lo escribe setup, lo migra doctor)
│   ├── migrations.log         # Registro append-only de migraciones aplicadas / diferidas
│   └── decisions/             # ADRs versionados, nunca borrados
└── docs/
    ├── .specture-meta/        # Telemetría local (gitignoreada) — salvo build-metrics.jsonl, trackeado (v1.18.0)
    ├── 01-requirements/
    ├── 02-architecture/
    ├── 03-ux-ui/
    ├── 04-roadmap/
    ├── 05-specs/              # <epic>/*.spec.md + <epic>/_planning.md (evidencia del gate) + _supersessions.md (índice)
    ├── 06-debug-logs/
    └── 07-reviews/
```

`stack.yml` es **leído por todos los skills y agentes** antes de generar nada. Cambia el stack → cambian las decisiones, sin tocar el framework.

`settings.yml` (desde v1.15.0) es el único archivo **del framework** dentro de `.specture/`: `schema_version` (la versión del esquema de proyecto que el plugin espera), `profile` (`lean | full | custom`) y los toggles (`hooks.enabled`, `context7.enabled`, `docs_index.*`, `knowledge.enabled`). Lo escribe `/specture:setup`; cuando actualizás el plugin, `/specture:start` compara `schema_version` con la versión instalada y, si hay migraciones pendientes, ofrece `/specture:doctor migrate`. Proyectos creados antes de v1.15.0 conservan los toggles en `conventions.md` §10 — se siguen leyendo hasta que el doctor los mueva.

**Doctor en la CI del proyecto (opcional):** un job que clona el plugin a la versión instalada y corre el chequeo — falla en `ERROR` (rutas rotas, ADR duplicado, sello huérfano):

```yaml
# .github/workflows/specture-doctor.yml
name: Specture doctor
on: [push, pull_request]
jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: git clone --depth 1 --branch v1.18.0 https://github.com/FerEscobarDev/Specture.git .specture-plugin
      - run: node .specture-plugin/scripts/doctor.js check --project .
```

Pineá el tag a la versión del plugin que usás y agregá `.specture-plugin/` a tu `.gitignore` por si corrés el job localmente.

---

## Native Claude Code Integration (v1.2.0)

Specture v1.2.0 integra seis capacidades nativas de Claude Code para convertir las "leyes de hierro" de convención a enforcement mecánico. Todas son **opt-in**: por defecto el plugin se comporta como v1.1.0.

| Capacidad | Función |
|-----------|---------|
| Hook `PreToolUse` (sello del build) | Bloquea mecánicamente, mientras el epic está en curso: edits a **tests sellados** (TDD Honesty Gate), edits a **specs sellados** (Spec Seal, v1.18.0) y escrituras de código **fuera de la superficie** `Crea:`/`Modifica:` de los specs (Allowed Paths, v1.18.0). |
| `TaskCreate` | Lista en vivo de specs del epic activo durante `/specture:build`. |
| `Context7` MCP | Docs vigentes para `code-reviewer` (Dimension 5: idiomaticity) y `modernize` (gap analysis). |
| `Plan mode` | Gate de aprobación antes de tocar código en `debug` y `new-feature`. |
| Background tasks | Paraleliza review + linter + type-checker en el build loop. |

### Cómo activar

En `.specture/settings.yml` (v1.15.0+; `/specture:setup` lo crea):

```yaml
profile: custom              # o lean | full, que fijan los toggles de abajo
hooks.enabled: true          # activa el TDD Honesty Gate (PreToolUse)
context7.enabled: true       # activa Context7 en code-reviewer y modernize
```

Sin esos toggles, los hooks shippean pero no actúan, y Context7 nunca se consulta. Proyectos anteriores a v1.15.0 los tienen en `conventions.md` §10 (`- **hooks.enabled**: true`); el framework los sigue leyendo ahí hasta que `/specture:doctor migrate` los mueva a `settings.yml`.

> **Cambio en v1.5.0 — routing opt-in.** El antiguo hook `SessionStart` (auto-routing al abrir Claude Code) fue **deregistrado**. Ahora se entra a Specture **solo** invocando `/specture:start` (o pidiendo iniciar/continuar). `hooks.enabled` ya únicamente controla el TDD Honesty Gate.

### Lo que vas a ver distinto

- Al abrir Claude Code en un proyecto Specture **no pasa nada automáticamente**: invocá `/specture:start` (o decí "continuemos con el roadmap") para que el router detecte la fase y enrute.
- Durante `/specture:build`, una lista visible trackea los specs del epic activo y su progreso por los pasos del loop.
- La ejecución del build es **secuencial**: el coordinador encola hasta N epics (decís "ejecuta 3"; sin número corre 1) y los construye **de a uno**, cada uno en un epic-agent de contexto aislado, parando al agotar la cola.
- Si algún agente intenta modificar un test durante GREEN, la edición se rechaza con un mensaje del TDD Honesty Gate explicando el contrato sellado. Desde v1.18.0 pasa lo mismo con un spec validado (mensaje "Spec Seal", con el `SPEC_SHA`) y con cualquier archivo de producción que ningún spec declare en `Crea:`/`Modifica:` (mensaje "Allowed Paths"): el implementer no lo rodea — reporta `BLOCKED: spec <ID>` con el archivo y el planner agrega la línea `Modifica:`.
- Sin hooks, los specs sellados igual están protegidos: el coordinador corre `git diff <SPEC_SHA>..HEAD -- <specs>` al procesar cada reporte y escala cualquier diff como `REJECTED_MAJOR`.
- Al pedir `/specture:debug` o `/specture:new-feature`, Claude entra automáticamente en Plan mode — el fix o el análisis se aprueba antes de tocar el codebase.
- En reviews y migraciones, las findings pueden citar APIs vigentes para tu stack consultadas en tiempo real vía Context7.

### Documentación detallada

Ver [`docs/native-integration-guide.md`](docs/native-integration-guide.md) para la guía operativa completa: troubleshooting, edge cases, FAQ.

---

## Frases típicas y a qué fase enrutan

- *"Inicia el proyecto"* → `/specture:discover`
- *"Continuemos con el roadmap"* → router detecta el estado y enruta
- *"Hay un bug en X"* → `/specture:debug`
- *"Quiero agregar Y"* → `/specture:new-feature`
- *"Reconfigura el stack"* → `/specture:setup` modo reconfigure
- *"Migra a X"* / *"Sube la versión a Y"* / *"Moderniza el stack"* / *"Quiero pasar de A a B"* → `/specture:modernize`

---

## Principios de Diseño Internos (para contribuidores)

- **CSO en `description` de cada skill.** "Use when…" + condiciones de activación, NUNCA un resumen del flujo.
- **Skill body en inglés. Mensajes al usuario y templates en español.**
- **Cero rutas absolutas.** Todo path es relativo o usa `$SPECTURE_ROOT`.
- **Cero hardcoding tecnológico.** Cualquier mención de stack se lee de `.specture/stack.yml`.
- **Agentes con contexto restringido.** Nunca pasarles la conversación entera ni archivos que no necesiten.
- **Limpieza de contexto explícita entre epics.** El acumulado mata calidad.
- **Anclas estables, no números de línea.** Código se cita `file:line` a un SHA fijo o `file::symbol`; documentos vivos (specs, ROADMAP, conventions, ADRs) solo por ID o encabezado.
- **Release verificado.** Cuatro manifiestos con la misma versión, entrada de changelog obligatoria, CI en Ubuntu y Windows, GitHub Release generado desde el changelog — ver `docs/release-process.md`.

Para crear o modificar skills, leer primero `skills/write-skill/SKILL.md`.

---

## Estado del Proyecto

Specture está en desarrollo activo. Para decisiones arquitectónicas internas, ver:

- [`docs/original-vision.md`](docs/original-vision.md) — Requisitos originales del framework.
- [`docs/ui-design-flow-analysis.md`](docs/ui-design-flow-analysis.md) — Análisis del flujo de UI y rediseño que motivó v1.6.0 (contrato de API + disciplina de frontend + herramientas de diseño).

---

## Changelog

### v1.18.0 — Spec Planning Gate · etapa 2: el set y la evidencia

**Motivación:** la etapa 1 puso autor y preguntas; faltaba verificar el *conjunto* de specs (cobertura, handoff de firmas, orden) antes de gastar validator, sellar los specs validados, hacer de las firmas planeadas una obligación del implementer, medir en vez de suponer, y darle al TDD Honesty Gate el camino "cambio legítimo cross-epic" que Psikora inventó en un ledger de 9.463 líneas. El baseline RED (`docs/spec-planning-baseline-stage2.md`) lo midió contra v1.17.0: el validator por spec aprobó un epic con una operación sin spec y dos specs con la misma firma escrita de dos maneras ("un validador por-spec no puede detectar drift de firma entre hermanos por construcción"); el planner con lectura acotada dejó que el código moldeara dos preguntas, una recomendada y un AC ("la recomendación está sesgada por el código"); la tabla reducida de migración obligó a inventar gramática; el hook v2 permitió editar un spec sellado y el coordinador no corría ningún `git diff SPEC_SHA`. Es la Milestone 4 de `docs/framework-roadmap.md` (ítems 29-37); decisiones A6 y A7 cerradas sin los ~10 epics de datos que el roadmap esperaba, con las opciones conservadoras.

**Cambios:**

- **`hooks/lib/spec-set-check.js` (gate step 4a):** chequeos mecánicos sobre el set de specs tras cada pasada del planner — C1 cada `operationId` del epic en exactamente un spec (y una operación `(consume)` exige su backend `[x]`), C2 cada `RN-nnn` citada, C4 cada firma `(planeada — re-anclar)` idéntica a la que crea el spec anterior, C5 sizing, C6 orden, más C-path, C-gap (migraciones) y C-sup (supersesiones); cruza cada fila con los archivos de spec para que una tabla no pueda mentir. Emite `MECH_CHECK: PASS|FAIL|UNVERIFIABLE <sha12 de las filas>`: un FAIL vuelve al planner sin gastar validator y el token es input obligatorio del validator (`BLOCKED` sin él). Gramática fija de `_planning.md` en el nuevo `templates/PLANNING_TEMPLATE.md` (parser en `hooks/lib/planning.js`, tolerante a las variantes reales del planner); el `ROADMAP_TEMPLATE.md` gana gramática parseable para operaciones/RN y la línea `Template:`.
- **Code Surface Resolution:** el coordinador resuelve `SYMBOL | PATH | SIGNATURE` de la carpeta raíz del componente (subagente haiku de solo lectura o `grep` de exports) y se lo entrega al planner; el `spec-planner` **no abre código** — un símbolo ausente de la tabla es un `CONCERNS`, nunca una firma inventada.
- **Sello v3 + `seal-cli.js`:** `build-locked.json` lleva `spec_sha`, `spec_paths`, `test_globs`, `allowed_paths` y `supersede_paths` además de `specs[]` (v1/v2 siguen leyéndose); `hooks/lib/seal-cli.js` es el único escritor (`write` / `merge-spec` / `unseal-spec` / `supersede` / `release` / `show`). Los hooks de Claude Code y Copilot/Antigravity deniegan, en orden, un **test sellado** (TDD Honesty Gate), un **spec sellado** (Spec Seal) y cualquier **escritura de código fuera de `Crea:`/`Modifica:`** (Allowed Paths — cero código sin spec, solo si el sello los lleva y nunca bajo `docs/` o `.specture/`); la vía de escape es `BLOCKED: spec <ID>` → loop de corrección. `specs[].test_paths` pasa a ser la lista de archivos del RED commit. Sin hooks, el coordinador corre `git diff <SPEC_SHA>..HEAD -- specs` al procesar cualquier reporte y escala un diff como `REJECTED_MAJOR`.
- **Reviewer Dim 1 verifica la superficie declarada:** todo símbolo `Crea:` existe en HEAD con la firma declarada (BLOCKER si diverge; `Crea:` gana el slot obligatorio `— firma:`); escrituras fuera de `Crea:`/`Modifica:` son sobre-implementación. El overlay `FIRMAS_REALES` queda como re-lectura defensiva del epic-agent antes del Manifest del spec k+1. `code-reviewer` devuelve `CAUSE: none | implementation | spec_defect | architecture`.
- **Validator: dispatch de set (C3/C7/C8/C2-fallback) antes de las dims 1-6 por spec** (decisión A6: por spec + set reducido; se consolida en un dispatch solo si `reviewer_rejected_major_spec_defect` no sube).
- **Métricas por epic:** el coordinador anexa una línea a `docs/.specture-meta/build-metrics.jsonl` (**trackeado**, decisión A7) y la commitea como `docs(metrics)`; `hooks/lib/metrics-report.js` resume gate vs baseline y aplica la lectura §6.5 (`--baseline --write` reconstruye los epics previos desde reviews, `_planning.md` y git log); nuevo modo `/specture:knowledge stats`.
- **Supersesión sancionada de tests sellados:** sección "Supersesiones de tests sellados" en los templates de spec (`Supersede: <path>::<test> — motivo: BR-n`), fila `sup:` + C-sup, commit `test(supersede)` previo al RED por el `tdd-test-writer`, registro por epic en `_planning.md` § SUPERSESIONES e índice `docs/05-specs/_supersessions.md`; RED-fix y remediación retroactiva formalizados en `docs/tdd-honesty-reference.md` (renombrado desde `tdd-honesty-violations.md` para no colisionar con el ledger del proyecto; el framework lo cita con `$SPECTURE_ROOT`).
- **Epics de migración (C-9a):** el gap analysis numera `GAP-nnn`, el epic los lista en "Breaking changes in scope", el spec en "Gaps cubiertos", el planner emite filas `gap:` y §5 del `MIGRATION_SPEC_TEMPLATE` lleva `AC-n`. Brecha de los espejos Copilot documentada (C-9b; generarlos es el ítem 40).
- **Doctor:** deja de decir que la supersesión "no tiene mecanismo"; catálogo con `1.18-metrics-tracked`.
- Baseline TDD-for-docs de la etapa 2 en `docs/spec-planning-baseline-stage2.md`: 6 escenarios RED→GREEN, 6/6 verdes, un ciclo REFACTOR (cuatro tolerancias de gramática).
- Tests: 101 (59 → 101: spec-set-check, seal, seal-cli, hooks v3, metrics-report, migración 1.18, doctor).

**Migración para proyectos existentes:** `1.18-metrics-tracked` (mecánica): `.gitignore` pasa de `docs/.specture-meta/` a `docs/.specture-meta/*` + `!docs/.specture-meta/build-metrics.jsonl` (git no re-incluye un archivo bajo un directorio ignorado); `/specture:doctor migrate`. Ningún otro ítem la necesita: los specs `[x]` y los reviews no se tocan, `_planning.md` se genera por epic (uno de v1.17.0 en vuelo se parsea por su etiqueta `COVERAGE_TABLE:`), las líneas y secciones nuevas de los templates son opcionales y el sello es transitorio.

**Backward-compat:** sellos v1/v2 siguen leyéndose; sin `allowed_paths` en el sello el hook falla abierto como hoy; specs existentes válidos (`Modifica:`, `— firma:` en `Crea:` y "Supersesiones" son adiciones); el formato de salida del validator no cambia salvo el prefijo `<task-slug>` en el dispatch de set; `knowledge capture`/`audit` intactos; el changelog histórico conserva el nombre viejo del documento de TDD.

### v1.17.0 — Spec Planning Gate · etapa 1: el autor y las preguntas

**Motivación:** el spec es el contrato sellado de toda la cadena (test-writer → implementer → reviewer) y era el único artefacto sin autor especializado ni canal al usuario. El baseline RED (`docs/spec-planning-baseline.md`) lo midió: 12-14 decisiones unilaterales de contrato observable por epic, cero preguntas, tres superficies de identidad y tres formatos de subida distintos entre corridas para el mismo problema, y una delegación vaga convertida en autoridad para editar el contrato OpenAPI. Es la Milestone 3 de `docs/framework-roadmap.md`; diseño en `docs/spec-planning-gate-design.md` corregido por su revisión (M1-M7).

**Cambios:**

- **Agente `spec-planner` (Opus, el 7º):** traduce un epic en 1-3 specs code-free sin commitear; regla de hierro "no existe el tercer estado" — toda duda de contrato queda `RESOLVED_ALONE` con **cita textual** o va a `OPEN_QUESTIONS` como pregunta cerrada; `BLOCKED: contrato` cuando el epic necesita un shape que el contrato no tiene (jamás se inventa ni se parchea); re-dispatch = edición mínima con IDs estables y `CHANGELOG` contrastado contra `git diff`.
- **Spec Planning Gate en el coordinador de `build`:** cada epic se planifica completo antes de ejecutar; `AskUserQuestion` ≤4 preguntas/tanda, ≤2 tandas, siempre con una `(recomendada)`; la presión vaga no suprime preguntas, la delegación explícita se honra (`fuente: delegado por el usuario`, alcance = el epic nombrado) y nunca autoriza tocar el contrato; respuestas que cambian reglas se editan in-place en `business_requirements.md` con marcador `(aclarado en Epic X.Y, fecha)`; "todas" sigue desatendido — un epic sin dudas corre hasta `[x]` sin interrupciones; modo revisión solo a pedido.
- **`docs/05-specs/<epic>/_planning.md` trackeado:** COVERAGE_TABLE + preguntas/respuestas + `RESOLVED_ALONE` con citas + veredicto verbatim + `SPEC_SHA` — propiedad partida (el planner escribe sus 3 secciones; el coordinador agrega evidencia).
- **Validator C7 ("aclaraciones sin sustento"):** en el primer dispatch del set verifica que cada cita existe verbatim en la fuente entregada Y responde la duda — BLOCKER si no; anti-cascada: 2º rechazo del mismo ítem → pregunta al usuario.
- **Epic-agent procedural (Steps 4-8, `model: sonnet`):** recibe specs sellados con `SPEC_SHA` + veredicto verbatim (sin ambos → `NEEDS_CONTEXT`); `EPIC_LOOP.md` pierde Steps 2/2.5/3; nuevo anti-pattern "editar o regenerar un spec sellado".
- **Loop de corrección a mitad de epic:** `BLOCKED: spec <ID>` → des-sellado quirúrgico de esa entrada → re-plan mínimo → re-validación → `git revert` del RED afectado → reanudar desde ese spec.
- **Reanudación de un `[/]` por evidencia en disco:** `_planning.md` APPROVED + specs commiteados → despacha sin re-planificar; specs solo en staging → pregunta; nunca descarta sin preguntar.
- **`modernize` delega al gate** (un solo camino para specs; tabla reducida para epics de migración hasta el ítem 37).
- Baseline TDD-for-docs completo en `docs/spec-planning-baseline.md`: 8 escenarios RED→GREEN, todos verdes a la primera.
- Tests: 59 (paridad de 7 agentes, secciones canónicas del template, schema gate re-sincronizado).

**Migración para proyectos existentes:** ninguna — `_planning.md` lo crea el gate durante `build` (el doctor ya lo clasificaba como documento vivo desde v1.15.0) y las secciones nuevas de template no invalidan specs existentes.

**Backward-compat:** los specs existentes siguen válidos (la sección "Aclaraciones" es un puntero opcional); un `[/]` huérfano gana camino de reanudación en vez de quedar trabado; el formato de output del validator no cambia; los epics de migración usan el mismo gate con su template declarado.

### v1.16.0 — Prerrequisitos del Spec Planning Gate

**Motivación:** el Spec Planning Gate (Milestone 3 del roadmap) asume IDs estables en los requerimientos, un ROADMAP validado mecánicamente, un procedimiento de epic corto y specs con techo y forma. Ninguno existía: las reglas de negocio se citaban por "§X" (juicio, no mecánica), el ROADMAP era la única fase sin gate, el epic-agent recibía las 517 líneas de `build/SKILL.md` (~190 solo del coordinador), y la verdad de negocio se fragmentaba en `feature-*.md` y "Adendas". Es la Milestone 2 de `docs/framework-roadmap.md`.

**Cambios:**

- **`templates/BUSINESS_REQUIREMENTS_TEMPLATE.md` + IDs estables:** reglas (`RN-nnn`), casos límite (`CL-nnn`) y exclusiones (`FA-nnn`) — specs, ROADMAP y `_current/` citan por ID, nunca por sección; `discover` cierra con un chequeo mecánico del doctor (grupo `requirements`: placeholders, `Exposición`, Capacidades de Frontera, IDs).
- **Gate del validator sobre el ROADMAP (Part C):** gramática parseable de `Dependencias`, cada `operationId` implementado por exactamente un epic backend, cobertura de `RN-nnn`, sizing 1-3 specs — las tres partes de `architecture` quedan con gate.
- **`build` partido:** `SKILL.md` = coordinador (cola, branching, reportes, 8.5/8.7/9); `build/EPIC_LOOP.md` = procedimiento del epic-agent (Steps 2-8, Manifest, resoluciones, gate 5.5, Iteration Cap, anti-patterns) — el epic-agent recibe **solo** el segundo.
- **Forma del spec:** check `spec-section` (WARNING con destino sugerido para secciones fuera del template) + sección "Guards de no-regresión (nacen verdes)" en `SPEC_TEMPLATE.md` — declarados, no cuentan como RED, el gate 5.5 los excluye.
- **Router con salida estricta:** `specture-router` corre la máquina de estados de `start` en solo lectura y devuelve `PHASE: <fase> · SKILL: <ruta>` — nunca ejecuta fases; el chat principal invoca el skill.
- **`new-feature` fusiona, no acumula:** requerimientos fusionados por sección con marcador `(añadido por feature X, fecha)`, borrador `feature-*.md` borrado al aprobar el ROADMAP, "Adendas" prohibidas.
- Tests: 59 (requirements lint, spec-section, ambas migraciones 1.16, orden intra-versión del catálogo).

**Migración para proyectos existentes:** `/specture:doctor migrate` ofrece `1.16-requirements-ids` (asistida: retrofit de IDs `RN/CL/FA`) y `1.16-requirements-merge` (asistida: fusión de `feature-*.md`/Adendas, borradores eliminados), en ese orden. Los ítems 14/15/16/17 no requieren migración: gate del ROADMAP y router son proceso del framework, el split de `build` es layout interno, y los guards son opt-in para specs nuevos.

**Backward-compat:** `business_requirements.md` sin IDs sigue funcionando (el doctor lo reporta como WARNING; la Dim 4 del validator degrada a juicio). `build` despacha igual que antes — cambia el archivo que recibe el epic-agent, no el flujo. El router era advisory; su nueva salida estricta no rompe ningún skill (ninguno lo referencia). Specs existentes con secciones extra solo generan WARNINGs.

### v1.15.0 — Doctor: diagnóstico del corpus + migraciones de esquema del proyecto

**Motivación:** Specture versionaba el plugin pero no el proyecto. Cada release definía "backward-compat" como *"sin X, comportamiento anterior"* — un no-op silencioso: el proyecto actualizaba el plugin y nunca recibía la feature, o la recibía a medias cuando un skill aguas abajo la asumía (lápidas apuntando a un `_current/` inexistente, validator sin contrato legible, reviewer sin comportamiento vigente). Un proyecto real migró a mano tres veces y seguía sin v1.6, v1.7 y v1.9. Es la Milestone 1 de `docs/framework-roadmap.md`; diseño en `docs/doctor-and-migrations-design.md`.

**Cambios:**
- **`.specture/settings.yml`** (archivo del framework): `schema_version`, `profile` y los toggles que vivían en `conventions.md` §10. `hooks/lib/settings.js` lo lee con fallback al §10 viejo hasta migrar; `setup` lo escribe; el §10 del template queda como puntero.
- **`/specture:doctor`** (`scripts/doctor.js`, Node ≥ 22): `check` — lint del corpus (rutas citadas inexistentes, placeholders `...`, ADRs duplicados o sin Status, reviews sin veredicto, specs sin IDs o > 300 líneas, citas por número de línea), estado (sello huérfano, > 1 `[/]`, `_current/` ausente, docs-index vs toggle, residuos de worktrees) y drift de esquema; `migrate` — aplica las migraciones mecánicas (idempotentes, verificadas, registradas en `.specture/migrations.log`), lleva las asistidas a Plan mode (`--plan`, `--verify`) y difiere las de contenido con su dueño; `sync` para CI. Nunca commitea.
- **Catálogo de migraciones `migrations/`** (13): gitignore de `state/` y `.specture-meta/`, Capacidades de Frontera y compañero del contrato (asistidas), retiro de `max_parallel_epics`, sintaxis de `Dependencias` (asistida), backfill de `_current/` (contenido, diferida), lápidas por script preservando IDs, §12/§13, perfil + `knowledge.enabled`, bloque `structure` (asistida), `settings.yml`, `schema_version`.
- **Gate de release por esquema:** `migrations/schema-manifest.json` + `npm run schema:sync` — cambiar `templates/project-config/**`, los templates de ROADMAP/SPEC/MIGRATION/CURRENT o los "Required Inputs" de un skill sin regenerarlo rompe `npm test`. Invariante: un proyecto recién creado desde los templates no tiene migraciones pendientes.
- **`start` Step 0:** `doctor check --brief`; anuncia migraciones pendientes y ofrece `migrate` — nunca bloquea.
- **Cero no-op silencioso:** `build` (tabla de precondiciones; Current-State Resolution y Step 8.7), `architecture` Part B y `new-feature` avisan una vez por sesión cuando falta un artefacto (`⚠ Specture: … — corré /specture:doctor`).
- **Contrato por `stack.yml.api.contract_file`:** ningún skill, agente ni template nombra el archivo machine-readable por extensión fija; el compañero legible es siempre `docs/02-architecture/api-contract.md`.
- **Sello multi-spec:** `build-locked.json` v2 (`specs: [{slug, red_sha, test_paths}]`, v1 aceptado); sello huérfano → los hooks permiten con aviso; el coordinador libera el sello al procesar `DONE`. Lógica compartida en `hooks/lib/seal.js`.
- Tests: 53 (settings, doctor check/migrate, catálogo, invariante setup↔migraciones, manifest, hooks v1/v2/sello huérfano).

**Migración para proyectos existentes:** `/specture:doctor migrate`. Las mecánicas se aplican solas; las asistidas se aprueban en Plan mode; `1.9-current-state-init` queda diferida a `knowledge reconcile` (ítem 38 del roadmap).

**Backward-compat:** los proyectos sin migrar funcionan como en v1.14.1 (toggles leídos de §10, sello v1 aceptado) — pero ahora lo dicen.

### v1.14.1 — Higiene: CI, release verificado, anclas y reglas de escritura

**Motivación:** v1.14.0 se publicó con tres manifiestos desincronizados (en 1.13.0), sin entrada de changelog y con el test de contrato en rojo — nada lo verificaba. Y la revisión a escala sobre un proyecto real (`docs/psikora-scale-review.md`) mostró dos hábitos que el framework premiaba y que fabrican errores: citar documentos vivos por número de línea, y reviewers/agentes concurrentes escribiendo sobre el mismo checkout. Es la Milestone 0 de `docs/framework-roadmap.md`.

**Cambios:**
- **CI y contrato de release:** `package.json` (`npm test` = `node --test`), `scripts/bump-version.js` (escribe la versión en los cuatro manifiestos; `--check`, `--title`, `--notes`), `hooks/test/release-contract.test.js`, `.github/workflows/ci.yml` (ubuntu/windows × node 22/24) y `release.yml` (publica el GitHub Release desde el changelog). Proceso en `docs/release-process.md`. Changelog de v1.13.0 y v1.14.0 reconstruido.
- **Política de anclas** (`code-reviewer`, `architecture-validator`, `contract-sync-audit`, `write-skill`): el código se cita `file:line` a `HEAD_SHA` o `file::symbol`; los documentos vivos solo por ID estable o encabezado, nunca `doc.md:NNN`.
- **Reglas de escritura para reviewers y agentes concurrentes** (`build` Anti-Patterns, `code-reviewer`): sin `git add -A` ni `--amend` durante un epic; sin `git checkout` para deshacer mutaciones (snapshot previo + `git hash-object`); un solo agente escribiendo por checkout; el reviewer escribe únicamente su reporte.
- **Limpieza:** `start` sin "Context Hygiene Rule"; `build` Step 1 solo-coordinador y Step 2.5 sin tabla; `hooks/session-start.js` eliminado; `required_test_coverage_percent` fuera del template; README con los 6 agentes y el árbol completo; `antigravity_plugin_plan.md` → `docs/`.

**Backward-compat:** total. Ningún cambio en `.specture/` de los proyectos; un `stack.yml` que aún tenga `required_test_coverage_percent` no rompe nada.

### v1.14.0 — Compatibilidad híbrida Antigravity CLI

**Motivación:** Google Antigravity CLI (`agy`) usa nombres de herramientas de escritura y campos de payload distintos a los de Claude Code / Copilot, y registra subagentes dinámicamente. El plugin de v1.13.0 se instalaba pero el TDD Honesty Gate no interceptaba sus escrituras ni los agentes quedaban disponibles.

**Cambios:**
- **`hooks.json`:** el matcher del `PreToolUse` cubre también `write_to_file|replace_file_content`; el hook unificado lee además `tool_input.TargetFile`.
- **`build/SKILL.md` — "Cross-Platform Subagent Initialization":** si la sesión expone `define_subagent` (Antigravity), el orquestador registra los cinco agentes desde `agents/*/AGENT.md` antes de despachar; en Claude Code ya están registrados estáticamente.
- `plugin.json` a 1.14.0.

**Nota de release:** los otros tres manifiestos (`.claude-plugin/plugin.json`, `.github/plugin/marketplace.json`, `copilot/compatibility-matrix.json`) quedaron en 1.13.0 y este changelog no se escribió en su momento — corregido en v1.14.1, que agrega el contrato de release que lo impide.

**Backward-compat:** total.

### v1.13.0 — Plugin GitHub Copilot CLI (y base para Antigravity)

**Motivación:** Specture solo existía como plugin de Claude Code. Usuarios de GitHub Copilot CLI no podían instalarlo, y sus agentes y hooks no tenían formato en esa plataforma.

**Cambios:**
- **Manifiesto y marketplace para Copilot CLI:** `plugin.json` (raíz) + `.github/plugin/marketplace.json` — `copilot plugin marketplace add …` / `copilot plugin install specture@specture`.
- **`copilot/agents/*.agent.md`:** seis espejos (validator, reviewer, implementer, router, test-writer, ux-implementer) en el formato de agentes de Copilot. **`copilot/compatibility-matrix.json`** declara la paridad de skills, agentes y gates por plataforma (`claudeSource` = versión del plugin que los espejos siguen).
- **TDD Honesty Gate para CLIs no-Claude:** `hooks.json` registra `hooks/specture-pre-tool-use-tdd-gate.js` (hook unificado, fail-open); `copilot-pre-tool-use-tdd-gate.js` queda como shim de compatibilidad.
- **Tests de contrato en `hooks/test/`:** manifiestos sincronizados, un espejo por agente, todas las skills en la matriz, descripciones con `: ` entrecomilladas; el hook deniega un test sellado, permite el resto y falla abierto con estado corrupto.
- **Docs:** `docs/copilot-cli-plugin.md`, `docs/antigravity-cli-plugin.md` (instalación, uso, gate), `docs/execution-flows.md` (diagramas Mermaid de todos los flujos), README con instalación para las tres plataformas.

**Backward-compat:** total — Claude Code no cambia.

### v1.12.0 — Naming de carpetas raíz por tipo de proyecto

**Motivación:** Specture no prescribía layout de código fuente — los componentes en `architecture.md` solo tenían un *slug* sin ruta, y los paths de archivos los rellenaba el orquestador a mano, dejando el naming de carpetas inconsistente entre proyectos. Esta versión introduce una convención **configurable** de carpetas raíz por app, derivada del nombre del proyecto, que se adapta al tipo de proyecto (api sola, web+api, suite completa…).

**Cambios:**
- **`stack.yml` nuevo `project.slug` + bloque `structure`:** `root_layout: by-app-suffix | flat | custom` y un mapa `apps` (api/web/app/landing → `{slug}_api`, `{slug}_web`, `{slug}_app`, `{slug}_landing`). Fuente de verdad que leen `architecture` y `build`.
- **`conventions.md` §2.1 "Estructura de Carpetas Raíz (apps)":** versión legible de la convención, con la tabla de mapeo rol→carpeta.
- **`setup` (Modo A / bootstrap):** deriva el `slug` en snake_case desde el nombre (lo confirma con el usuario) y escribe `structure` con **solo las apps que apliquen**. Modo Adopt deja `root_layout: custom` por defecto (no impone el patrón sobre código existente); Reconfigure puede añadir el bloque si falta.
- **`architecture`:** cada componente de app declara su "Carpeta raíz" resuelta desde `structure`; los componentes lógicos internos llevan "n/a".
- **`build` (Step 2):** los paths de archivos nuevos del spec se anclan a la carpeta raíz del componente del epic.

**Alcance:** solo convención + aplicación (setup/architecture/build). El enforcement automático (validator/code-reviewer) queda como fase futura. **Backward-compat:** total — proyectos existentes (sin bloque `structure` o con `root_layout: flat/custom`) no se ven afectados.

### v1.11.0 — Consolidación + perfiles (aligeramiento)

**Motivación:** tras los recortes de la Fase 1 (build 571→455), el peso restante era **superficie conceptual** (cantidad de skills y toggles). Diseño completo en `docs/lightening-design.md`. Cierra el plan de 4 fases.

**Cambios:**
- **`learn` + `audit-knowledge` → una skill `knowledge`** con modos `capture` (ex-learn) y `audit` (ex-audit-knowledge); el preámbulo/doctrina compartido se escribe una sola vez. Los comandos viejos `/specture:learn` y `/specture:audit-knowledge` se conservan como **alias** (stubs que redirigen). `handoff-ingest` y `contract-sync-audit` **no** se fusionan (falsa consolidación: trabajos distintos). 16→15 skills.
- **Perfiles de toggles (§10):** nuevo `specture.profile: lean | full | custom` — un knob para el caso común (`lean` apaga la tríada v1.7.0; `full` la enciende; sin definir = backward-compat). `learn.enabled` → `knowledge.enabled`. Podados los 3 sub-toggles finos de learn (`min_session_threshold_minutes`, `max_drafts_per_invocation`, `write_human_report`) a defaults fijos (30 / 3 / false).
- Callers internos (build Step 8.5, debug Phase 4.5) apuntan a `knowledge` capture; `setup` puebla el perfil.
- **Fix:** corregido un join accidental de las líneas `context7`/`docs_index` en §10 del template (introducido al quitar `max_parallel_epics` en v1.8.0).

**Backward-compat:** total. Los aliases viejos funcionan; sin `specture.profile` el comportamiento es idéntico a v1.10.0.

### v1.10.0 — Registro de reglas (invariantes + proceso)

**Motivación:** no había forma de declarar **reglas de desarrollo que nunca cambian** (DTOs inmutables, naming de métodos, de dónde nace cada rama) y que llegaran a los agentes de contexto restringido — `CLAUDE.md` no los alcanza por diseño. Hallazgo clave: `conventions.md` **ya** llega al `implementer` y al `code-reviewer`, así que el camino lean es ponerlas ahí. Diseño completo en `docs/rules-registry-design.md`.

**Cambios (lean — cero archivos/toggles nuevos):**
- **`conventions.md` §12 Invariantes (R-*):** reglas de código/naming con ID, ámbito (tag) y severidad. Las **aplica** el `implementer`/`ux-implementer` (Iron Rule de honrar conventions extendida) y las **enforça** el `code-reviewer` con una nueva **Dimensión 7 (Project Invariants)** que cita la regla por ID con su severidad declarada.
- **`conventions.md` §13 Workflow/Proceso (W-*):** reglas de rama/commit/PR que sigue el orquestador de `build`. Branching: al iniciar la sesión, `build` crea **una** rama según la regla (origen + nombre por tipo de trabajo) — granularidad por sesión, sin stacked-branches; **sin auto-merge** (lo sugiere al drenar la cola). `new-feature` señala work-type=feature.
- **Sin perillas nuevas:** la **presencia** de reglas es el switch. Sin §12, la Dimensión 7 es no-op; sin reglas de rama en §13, `build` no crea ramas (comportamiento idéntico a v1.9.0).
- `setup` puebla los stubs (Bootstrap pregunta; Adopt infiere la base de rama del git existente).

**Backward-compat:** total. Proyectos sin §12/§13 se comportan exactamente como v1.9.0.

**Diferido** (ver `docs/rules-registry-design.md` §5): `.specture/rules.yml` con routing selectivo, generación de lint, hook de rama mecánico, auto-merge/PR.

### v1.9.0 — Reconciliación: verdad viva + ROADMAP-como-cola

**Motivación:** Specture no tenía ninguna **fuente de verdad viva del comportamiento** — los specs son inmutables y el contrato es append-only, así que "¿qué hace hoy el módulo X?" obligaba a replayear specs históricos (spec rot). Y el ROADMAP era un libro mayor que crecía sin techo (regla "nunca borres un epic completado"). Son el mismo problema: cerrar un milestone debe **drenar de la intención (ROADMAP) → reconciliar en la realidad (verdad viva)**. Diseño completo en `docs/reconciliation-design.md`.

**Cambios:**
- **Verdad viva por componente:** nuevo `docs/05-specs/_current/<component>.md` (plantilla `CURRENT_CAPABILITY_TEMPLATE.md`) — vista materializada *sobre* los specs inmutables que consolida BR/AC/EC + contrato en presente; lo superseded baja a "Historial". Es verdad trackeada (no se gitignorea); se crea lazy.
- **Step 8.7 — Milestone Reconciliation** en `build/SKILL.md`: al cerrar un milestone, el **coordinador** reconcilia (incremental) los `_current/` de los componentes tocados.
- **ROADMAP-como-cola (colapso diferido):** al cerrar un milestone se colapsa a **lápida** cualquier milestone que deje de estar entre los ~2 cerrados más recientes (umbral fijo, sin toggle). La lápida conserva los IDs de epic → el parser de dependencias los resuelve (`Epic X.Y` en lápida = `[x]` satisfecho; no hallado = typo → escala). Regla 3 del `ROADMAP_TEMPLATE` reescrita (archivar/reconciliar, no "nunca borrar").
- **Current-State Resolution:** el orquestador inyecta el slice de `_current/` relevante al `architecture-validator` (Step 3) y al `code-reviewer` (Step 6) — clon de Docs Index Resolution; los agentes nunca leen el directorio. Ven el comportamiento vigente → atrapan regresiones.
- **`new-feature`:** el Impact Ripple Analysis lee `_current/` (verdad viva) en vez de replayear specs históricos.

**Backward-compat:** sin cambios requeridos. Un proyecto sin `_current/` lo crea en la primera reconciliación; el colapso a lápida recién aplica con ≥3 milestones cerrados.

**Archivos nuevos:** `templates/CURRENT_CAPABILITY_TEMPLATE.md`, `docs/reconciliation-design.md`.

### v1.8.0 — Modo de ejecución único (Cola Secuencial)

**Motivación:** `build/SKILL.md` cargaba **tres** modos de ejecución (Inline, Agentes por Epic secuencial, Agentes por Epic en Paralelo por Olas) — el archivo más pesado del hot path. En la práctica solo se quería **ejecutar de a una epic a la vez**, con la opción de **encolar N** y correrlas secuencialmente. El modo paralelo (worktrees + gate de integración) era superficie que complicaba el archivo crítico sin que la mayoría lo necesitara.

**Cambios (cambio de comportamiento):**
- **Un solo modo de ejecución: "Sequential Queue".** El coordinador computa los próximos **N** epics ready en orden de dependencia, los despacha **de a uno** (un epic-agent aislado por vez, concurrencia = 1) y **para al agotar la cola**. N por invocación: un número ("ejecuta 3") → N; sin número → **1**; "todas" → todos los pendientes.
- **Cola visible:** un `TaskCreate` por epic encolado.
- **Eliminados:** el modo **Inline** (batchear inline reintroduce la acumulación de contexto que el modo agente-por-epic resolvió) y el modo **Paralelo por Olas** (worktrees, ready-set concurrente, gate de integración). `build/SKILL.md` pasa de 571 a ~430 líneas.
- **Removido el toggle `build.max_parallel_epics`** de `conventions.md` §10. El Step 9 (reset de contexto entre epics) es ahora **automático** — cada epic corre en contexto aislado que se descarta al terminar.
- `ROADMAP_TEMPLATE.md`: la convención de estado vuelve a "solo UN epic en `[/]` a la vez"; la sintaxis de dependencias ahora alimenta la **cola** en orden de dependencia.
- **Docs:** `docs/parallel-epic-design.md` eliminado; `docs/agent-per-epic-design.md` actualizado para describir el modo único. La concurrencia **intra-epic** (review + linter + type-check en paralelo, suite en background) **se conserva** — no es paralelismo a nivel epic.

**Migración:** sin cambios requeridos en proyectos existentes salvo limpiar `build.max_parallel_epics` (opcional; se ignora, y `setup` modo *reconfigure* lo remueve). El comportamiento "de a una" es idéntico al viejo modo secuencial; lo nuevo es poder encolar N.

### v1.7.1 — README discoverability

**Motivación:** las skills nuevas de v1.7.0 (`setup-docs-bridge`, `learn`, `audit-knowledge`) estaban listadas en el árbol de archivos pero no en la tabla de Capacidades Transversales ni en la referencia de Slash Commands, así que un lector nuevo del README no las descubría. Y la sección "Instalación y Uso" estaba al final, después de toda la teoría — friction innecesaria para alguien que solo quiere instalar.

**Cambios (docs-only, sin cambio de comportamiento):**
- Tres skills v1.7.0 agregadas a la tabla de Capacidades Transversales.
- Tres entradas nuevas en la referencia de Slash Commands (`/specture:setup-docs-bridge`, `/specture:learn`, `/specture:audit-knowledge`) con descripción, output y línea de uso típico.
- Sección "Instalación y Uso" movida al inicio del README, justo después del intro.
- Intro extendido para mencionar v1.7.0 y la oferta de `setup-docs-bridge` desde `/specture:setup`.

### v1.7.0 — Adoption con Docs Preexistentes + Captura Continua + Auditoría

**Motivación:** el modo Adopt estaba optimizado para inferir el stack desde archivos de configuración, no para proyectos con documentación abundante preexistente. En esos proyectos `/specture:start` enrutaba ciego a `discover` aunque los requerimientos ya existieran en `SGD.Docs/`, `Documentation/`, `wiki/`. Los agentes (`architecture-validator`, `code-reviewer`) eran ciegos a esa documentación por diseño. Y el conocimiento descubierto durante una sesión se evaporaba al cerrar la conversación. Análisis completo en `docs/adoption-with-existing-docs.md` y `docs/continuous-knowledge-capture.md`. Guía end-to-end del flujo nuevo en `docs/adoption-and-learn-guide.md`.

**Nivel 1 — Adoption con documentación preexistente:**
- Nueva plantilla `templates/project-config/docs-index.template.yml` — catálogo machine-readable con schema v1 (campos `concept`, `file`, `read_when`, `tags`, `related_code`, `confidence`, `last_verified`, `superseded_by`).
- Nuevo sub-skill **`setup-docs-bridge`**: detecta carpetas con ≥10 `.md`, categoriza heurísticamente (path + keywords) como **draft mostrado al usuario** (nunca aplicado en silencio), genera bridges en `docs/01-`, `docs/02-`, `docs/03-`, propone ADRs implícitos con `Status: Proposed — awaiting team confirmation`, escribe `.specture/docs-index.yml`. Invocable desde `setup` o standalone para refresh.
- `setup/SKILL.md` (modo Adopt) gana **Step 8.5**: detecta carpetas de docs preexistentes y ofrece invocar `setup-docs-bridge`.
- `start/SKILL.md` **Step 2 ampliado**: si `business_requirements.md` no existe pero `docs-index.yml` tiene entries con tag `requirements`, ofrece generar bridge desde índice en vez de enrutar a `discover`.

**Nivel 2 — Resolución del índice en orquestadores (preserva contexto restringido):**
- `build/SKILL.md` y `architecture/SKILL.md` ganan una sección reusable **"Docs Index Resolution"** que ejecuta el filtrado por tags/conceptos, ordena por score (prefiere `user_confirmed` sobre `ai_categorized`), aplica cap (`docs_index.max_entries_per_dispatch`, default 3) y pasa los docs resueltos como input adicional a los agentes. **Los agentes (`architecture-validator`, `code-reviewer`) jamás leen el índice directamente** — preserva caché, determinismo, paralelización.
- Step 3 (architecture-validator dispatch), Step 6 (code-reviewer dispatch), y los Validation Gates de `architecture` (Part A y Part B) usan el resolver.
- Log estructurado de cada resolución a `docs/.specture-meta/index-usage.jsonl` para medir selectividad.

**Nivel 3 — Captura continua de conocimiento (`/specture:learn`):**
- Nuevo skill transversal **`learn`** con 8 fases: relevance filter → gather evidence → cross-reference → drafts max 3 → Plan mode confirm → apply → log → report. Modos: `epic` / `debug` / `manual` / `--teach`. Hard token budget ~30K. **Nunca escribe a memoria personal de Claude** (`~/.claude/projects/*/memory/`) — los candidatos personales se listan al usuario para que él decida.
- `build/SKILL.md` Step 8.5 nuevo: tras marcar epic `[x]`, prompt opt-in default-no para invocar `/learn` con el epic como input.
- `debug/SKILL.md` Phase 4.5 nuevo: tras hipótesis confirmada y fix commiteado, prompt opt-in default-no para invocar `/learn` con el `DEBUG_LOG` como input.
- Plantilla `LEARN_OUTPUT_TEMPLATE.md` para el reporte humano-legible opcional.

**Nivel 4 — Auditoría periódica del índice (`/specture:audit-knowledge`):**
- Nuevo skill transversal **`audit-knowledge`** (read-only). Detecta 4 tipos de drift: ORPHAN (HIGH), DUPLICATE_CANDIDATE (MEDIUM), STALE/VERY_STALE (LOW/MEDIUM), UNCOVERED (LOW), UNKNOWN_AGE (LOW). Genera `docs/.specture-meta/last-audit.md` (humano) + `audit-history.jsonl` (estructurado) + health score 0-100. **Nunca auto-corrige** — propone acciones, el usuario confirma.

**Toggles nuevos en `conventions.md` §10:** `docs_index.enabled`, `docs_index.max_entries_per_dispatch`, `learn.enabled`, `learn.min_session_threshold_minutes`, `learn.max_drafts_per_invocation`, `learn.write_human_report`. Defaults conservadores (el framework no agrega fricción out-of-the-box).

**Salvaguardas críticas:**
- ADRs auto-generados (por `setup-docs-bridge` o `/learn`) nacen con `Status: Proposed — awaiting team confirmation`. El `architecture-validator` los ignora; solo bind contra `Accepted`. El equipo promueve manualmente cuando confirma.
- Entradas auto-generadas en el índice nacen con `confidence: ai_categorized`. El humano las promueve a `user_confirmed` cuando valida.
- Aprobación de `/learn` es **atómica vía Plan mode** (`EnterPlanMode` + `ExitPlanMode`) — el usuario aprueba o rechaza en bloque; para rechazar selectivo, re-invoca con exclusión.
- Telemetría es **fail-open** — si la escritura a `docs/.specture-meta/*.jsonl` falla, la skill no se rompe.

**Archivos nuevos:** `skills/setup-docs-bridge/`, `skills/learn/`, `skills/audit-knowledge/`, `templates/project-config/docs-index.template.yml`, `templates/LEARN_OUTPUT_TEMPLATE.md`, `docs/adoption-and-learn-guide.md`.

### v1.6.0 — API Contract + Frontend Discipline + Design Tooling

**Motivación:** la experiencia de uso reveló dos fallas en el flujo de UI. (1) **Falla raíz:** no existía un contrato de API compartido; el frontend inventaba los endpoints que esperaba (en `navigation_map.md`) y el backend inventaba los que construía (en sus specs), sin nada que los reconciliara → el front esperaba URLs y formatos que el back nunca entregaba. (2) **Vacío estructural:** el loop de `build` estaba modelado para backend (TDD); para frontend no había agente especializado, ni gate de aprobación visual, ni paso de "design system primero". Análisis completo en `docs/ui-design-flow-analysis.md`.

**Nivel 1 — Contrato de API (fuente única de verdad):**
- `architecture/SKILL.md` gana una **Parte B (API Contract)** entre arquitectura y ROADMAP: genera `docs/02-architecture/api-contract.openapi.yaml` (OpenAPI 3.1, machine-readable) + `api-contract.md` (legible). Nuevas plantillas `API_CONTRACT_TEMPLATE.md` y `api-contract.openapi.template.yaml`.
- El `navigation_map.md` y los specs referencian operaciones por `operationId` — **nadie inventa URLs ni shapes** fuera del contrato. `SPEC_TEMPLATE.md`, `DESIGN_SYSTEM_TEMPLATE.md` y `ARCHITECTURE_TEMPLATE.md` actualizados.
- El ROADMAP ordena los epics de frontend tras los de backend que implementan las operaciones que consumen.
- `architecture-validator` gana **Dimensión 6 (conformidad de contrato):** todo `operationId` citado existe; todo `operationId` traza a un epic; los specs no redefinen shapes divergentes.

**Nivel 2 — Disciplina de frontend end-to-end:**
- `ux-design/SKILL.md` **unifica las rutas:** ambas producen `navigation_map.md` + `design_system.md` completo; la ruta solo decide quién renderiza. La Ruta 1 añade `design_specs_for_ai.md` con **mandato explícito de crear el design system**. Excepción Adopt-con-UI (se documenta el design system existente).
- `build/SKILL.md` gana **Modo Frontend:** orden obligatorio design system → ruta `/dev/design-system` → **gate de aprobación visual humana** → páginas. La calidad visual la aprueba el usuario, no los tests.
- Nuevo agente **`ux-implementer`** (tokens, a11y, cliente tipado, reglas de marca). `code-reviewer` gana **Dimensión 6 (fidelidad de frontend).**

**Nivel 3 — Herramientas de diseño:**
- Nueva skill **`handoff-ingest`**: convierte un handoff de Claude Design al stack destino (extracción determinista de tokens, checklist de fidelidad, mapeo pantalla→ruta→contrato; copia literal si el stack coincide, paridad visual si difiere).
- Nueva skill **`contract-sync-audit`**: audita la sincronización back/front en proyectos existentes (extrae rutas/llamadas, diffea, reporta y propone contra una fuente canónica; sin auto-fix).

**Trazabilidad de endpoints desde la planificación:** `discover` ahora captura **actores no-humanos** (consumidores externos) y marca la **Exposición** de cada historia de usuario (`UI` / `API-externa` / `Interna`), consolidando una sección **Capacidades de Frontera** en `business_requirements.md`. Esa lista es el input determinista del contrato: la Parte B de `architecture` deriva el contrato de ahí y valida **cobertura bidireccional** (toda capacidad de frontera → ≥1 operación; toda operación → una capacidad/HU). `architecture-validator` Dimensión 6 hace cumplir esa cobertura. Esto define *qué endpoints se necesitan* desde la Fase 1, sin depender de que exista UI.

**Otros:** `setup` detecta UI existente (`frontend.ui_defined`) y backends con API; `stack.yml` gana `frontend.ui_defined` y sección `api`; router y `CLAUDE.md` enrutan las skills nuevas.

**Archivos nuevos:** `docs/ui-design-flow-analysis.md`, `skills/handoff-ingest/`, `skills/contract-sync-audit/`, `agents/ux-implementer/`, `templates/API_CONTRACT_TEMPLATE.md`, `templates/api-contract.openapi.template.yaml`.

### v1.5.0 — Routing Opt-in + Parallel Epic Execution

**Motivación:** (1) el routing automático en cada conversación era intrusivo y duplicado (agente `specture-router` + hook `SessionStart`); el usuario prefiere entrar a Specture explícitamente. (2) El modo Agentes por Epic (v1.4.0) corría los epics de a uno; un ROADMAP ancho con epics independientes desperdicia throughput.

**Cambio 1 — Routing opt-in:**
- `settings.json`: removida la clave `"agent": "specture-router"` y el bloque `SessionStart`. Se conserva el `PreToolUse` (TDD Honesty Gate).
- `hooks/session-start.js` queda **deregistrado** (script dormido, no se borra, no se invoca).
- El agente `specture-router` se conserva pero **solo se invoca explícitamente** (`/specture:start` o pidiendo iniciar/continuar). `CLAUDE.md`, `AGENT.md` y `setup` reformulados: el routing no corre en cada mensaje; la resistencia a "saltarse la fase" se mantiene una vez dentro de Specture.

**Cambio 2 — Modo "Agentes por Epic en Paralelo (Olas)" (`skills/build/SKILL.md`):**
- Tercer modo de ejecución. El coordinador computa el "ready set" (epics `[ ]` con dependencias `[x]`), despacha hasta `build.max_parallel_epics` epic-agents **concurrentes**, cada uno en un **git worktree aislado**.
- **Gate de integración secuencial:** cada epic DONE se mergea de a uno al árbol principal y se corre la suite completa antes de marcar `[x]`. Conflictos o acoplamiento no declarado afloran aquí (→ `debug`), nunca se shippean en silencio.
- Nuevo toggle `build.max_parallel_epics` (default 3; `1` = secuencial) en `conventions.md` sección 10.
- `ROADMAP_TEMPLATE.md`: estado `[/]` múltiple permitido en modo paralelo + sintaxis parseable del campo `Dependencias`.
- Sin pérdida de gates: cada epic-agent corre el loop completo (Dispatch Manifest, architecture-validator, RED commit, TDD Honesty Gate, code-reviewer) dentro de su worktree. Inline y secuencial **sin cambios funcionales**.

**Archivos nuevos:** `docs/parallel-epic-design.md`. Addendum en `docs/agent-per-epic-design.md`.

### v1.4.0 — Agent-per-Epic Execution Mode

**Motivación:** el informe de consumo mostró 41% del uso con contexto >150k. El orquestador inline acumula specs + tests + outputs + reviews a lo largo de todo el build loop.

**Cambio (`skills/build/SKILL.md`):**
- Nueva sección **Execution Mode Selection**: al iniciar el build loop el usuario elige modo. Default a Agentes por Epic con 4+ epics pendientes, Inline con 1-3.
- **Modo: Agentes por Epic** — el chat principal es solo coordinador: lee checkboxes del ROADMAP, bloquea el epic, despacha un epic-agent fresco (sin heredar historial) que corre Steps 2-8, y procesa su reporte (DONE/BLOCKED/REJECTED_MAJOR) verificando contra el filesystem. El contexto del coordinador crece O(n_epics) en vez de O(trabajo total). Specs, tests, outputs y reviews quedan dentro de cada epic-agent y se descartan al terminar.
- **Modo: Inline (The Loop)** — el comportamiento anterior, sin cambios, recomendado para 1-3 epics.
- Reconciliado con features posteriores: el coordinador es dueño de la única tarea TaskCreate visible por epic; el epic-agent honra Dispatch Manifest, TDD Honesty Gate y todos los gates internamente.

**Sin pérdida de gates.** Cada epic-agent corre el loop completo con todas las defensas. Solo cambia DÓNDE vive el contexto.

### v1.3.1 — Token Cost Optimization

**Motivación:** el informe real de consumo (`docs/usage-cost-analysis.md`) mostró que el arranque/routing consumía costo accidental desproporcionado. Optimizaciones con afectación de calidad nula o mínima (`docs/token-optimization-report.md`).

**Cambios (sin cambio de comportamiento observable):**
- **SessionStart hook no-op** cuando el `specture-router` agent está activo — elimina doble enforcement del arranque (relevante en sesiones largas/loop).
- **`start/SKILL.md` con lecturas mínimas**: routing es máquina de estados de filesystem; existence-checks en Steps 1-3, campo único en Step 4, checkboxes en Step 5. Prohibido leer archivos completos para enrutar.
- **Tabla de violaciones TDD a `docs/tdd-honesty-violations.md`** (progressive disclosure): `build` Step 5.5 y `code-reviewer` Dimension 4 se reducen a ~6 líneas; el detalle se lee on-demand solo cuando hay violación. El reviewer ahora consume el resultado de Step 5.5 en vez de re-correr `git diff`.
- **`code-reviewer` recibe solo ADRs relevantes** al spec (regla de seguridad: ante duda, incluir).
- **Bloques "What the User Sees Differently" movidos** a `docs/native-integration-guide.md` (eran descripción, no instrucción de comportamiento).
- **Step 9 y exemplars compactados** sin perder regla ni patrón.
- **`specture-router` con resistencia endurecida** ante presión de atajo. El cambio de modelo a Haiku queda **pendiente de un gate A/B empírico** (routing correcto + resistencia a "saltate la metodología") antes de aplicarse.

**Sin nuevos archivos de comportamiento.** Nuevo: `docs/tdd-honesty-violations.md`. Reportes de análisis en `docs/` como audit trail.

### v1.3.0 — Prompt Optimization

**Motivación:** reducir la latencia de creación de tests e implementación. El análisis (`docs/prompt-optimization-report.md`) determinó que el cuello de botella estaba aguas arriba — en el spec pobre y la falta de un gate de contexto — no en los agentes.

**Cambios:**
- `SPEC_TEMPLATE.md` reescrito: secciones con IDs estables (`AC-1`, `BR-1`, `EC-1`), tabla de contrato machine-readable, "Fuera de Scope" explícito y "Superficie de Código Existente" con firmas exactas. Prosa de negocio en español; identificadores en el idioma de `conventions.md` §8.
- **Dispatch Manifest** (pre-flight dual): el orquestador ensambla un manifest antes de despachar; `tdd-test-writer` e `implementer` lo validan como Step 0 y devuelven `NEEDS_CONTEXT` en el turno 1 si falta algo — elimina los round-trips caros de trabajo parcial.
- **Cota de proporcionalidad de tests** en `tdd-test-writer`: ~1 test por AC/BR/EC, sin matrices combinatorias. El bloat de tests era multiplicador directo del tiempo de GREEN.
- **Exemplars few-shot** (pseudo-estructura agnóstica) en `tdd-test-writer` e `implementer`, mismo mini-spec en ambos para continuidad del patrón.
- `COVERAGE_MAP` dirigido por IDs (subproducto determinístico, no segunda pasada). Frontera de ejecución de tests determinizada (el test-writer siempre corre, sin negociación). Firmas pasadas en el dispatch del implementer (sin re-explorar la API).

**Impacto en `/specture:build`:** los specs son más estructurados y la generación en Step 2 es más exigente; un spec incompleto se rechaza en el Manifest antes de gastar un ciclo de agente. Sin nuevos opt-in: aplica a todo proyecto desde v1.3.0.

**Archivos nuevos:** `docs/prompt-optimization-report.md`.

### v1.2.0 — Native Claude Code Integration

**Nuevas capacidades (opt-in):**
- Hooks Node.js: `SessionStart` auto-routing, `PreToolUse` TDD Honesty Gate.
- `TaskCreate`: visibilidad por-spec dentro del build loop.
- `Context7` MCP: docs vivas para `code-reviewer` (Dimension 5) y `modernize` (gap analysis).
- `Plan mode`: gate de aprobación automático en `debug` y `new-feature`.
- Background tasks: paralelismo en review/verify del build loop.

**Hardening del principio de contexto restringido:** los 4 agentes especializados (`architecture-validator`, `tdd-test-writer`, `implementer`, `code-reviewer`) ahora tienen cláusulas anti-memory + anti-context7 explícitas. Solo `code-reviewer` (Dimension 5) y `modernize` pueden usar Context7.

**Activación:** ver sección "Native Claude Code Integration" arriba. Por defecto todo queda inactivo (comportamiento idéntico a v1.1.0).

**Archivos nuevos:** `hooks/`, `docs/native-integration-guide.md`. Sección 10 nueva en `templates/project-config/conventions.template.md`.

### v1.1.0

`/specture:modernize` agregado para migraciones tecnológicas (version upgrade + tech migration) con Strangler Fig y characterization tests obligatorios.

### v1.0.0

Reescritura de VibeCoding como plugin Specture. Stack-agnostic, contexto restringido por agente, TDD Honesty Gate, 5 fases + 4 capacidades transversales.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
