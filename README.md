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
├── scripts/baseline-fixture.js        # Regenera el scratch "Archivador" de los baselines del gate (--stage 1|2|3|4|5|6, --git; la 4 lleva los defectos plantados de los probes de release del gate, la 5 la tanda de las sondas de la etapa de revisión, la 6 el milestone cerrado de las sondas de cumplimiento); árbol en scripts/baseline-fixture/
├── scripts/copilot-mirrors.js         # Genera copilot/agents/*.agent.md desde agents/*/AGENT.md (mirrors:sync · --check en los tests)
├── migrations/                        # Catálogo de migraciones <since>-<slug>.js + schema-manifest.json + tests
├── hooks/
│   ├── README.md                      # Cómo funcionan, schema de build-locked.json, troubleshooting
│   ├── pre-tool-use-tdd-gate.js       # Gate PreToolUse (Claude Code): tests sellados · specs sellados · allowed paths
│   ├── specture-pre-tool-use-tdd-gate.js  # Mismo gate para Copilot / Antigravity (hooks.json)
│   ├── copilot-pre-tool-use-tdd-gate.js   # Shim de compatibilidad → specture-pre-tool-use-tdd-gate.js
│   ├── lib/specture-guard.js          # Guard compartido (opt-in por hooks.enabled)
│   ├── lib/settings.js                # Lector de .specture/settings.yml (fallback a conventions §10, perfiles)
│   ├── lib/rules.js                   # Parser/lint de .specture/rules.yml (invariantes R-*, una línea por regla) + lectura del §12 legacy
│   ├── lib/rules-resolve.js           # Rules Resolution: --tags a,b | --all → bloque RULES_RESOLVED por dispatch (v1.19.0)
│   ├── lib/review-rules.js            # Parser/lint de .specture/review-rules.md (reglas del equipo: inclusión por sección, un nivel, nivel flexible) (v2.4.0)
│   ├── lib/review-rules-resolve.js    # Custom Rules Resolution: --spec | --paths | --paths-file | --all → bloque CUSTOM_RULES (v2.4.0)
│   ├── lib/compliance.js              # Revisión de cumplimiento: range · lint · assemble · stub · triage · correction · status · record (v2.4.0)
│   ├── lib/current-state.js           # Componentes de architecture.md y specs [x] por componente — knowledge reconcile (v1.19.0)
│   ├── lib/seal.js                    # Sello del build (schema v3: spec_sha/spec_paths/allowed_paths + specs[]; v2/v1 legacy; clasificación de denies)
│   ├── lib/seal-cli.js                # Único escritor del sello: write · merge-spec · unseal-spec · lift-spec · supersede · release · show
│   ├── lib/honesty-check.js           # Salvaguardas del loop de supersesiones y del Step 5.5: clean-tree · range · red-lines · spec-delta · protected · base-worktree (v2.2.0) · fix-range (v2.4.0)
│   ├── lib/planning.js                # Parser de _planning.md (COVERAGE_TABLE + hash), del bloque de epic y de los specs
│   ├── lib/spec-set-check.js          # Gate 4a: C1/C2/C4/C5/C6 (+ C-path/C-gap/C-sup) sobre el set de specs → MECH_CHECK token (--draft --batch: borradores de la revisión)
│   ├── lib/review.js                  # Registro de la revisión por tanda (docs/05-specs/_reviews/): status · scope-hash · scope-check (v2.3.0)
│   ├── lib/metrics-report.js          # Lector de docs/.specture-meta/build-metrics.jsonl (+ --baseline) — knowledge stats
│   ├── lib/doctor/                    # Chequeos del doctor: corpus · requirements · rules · estado · revisión · cumplimiento · drift · migrate
│   └── test/                          # Tests de contrato del plugin, hooks, settings y doctor
├── copilot/
│   ├── agents/*.agent.md              # Espejos de los agentes para Copilot CLI — GENERADOS desde agents/*/AGENT.md, no editar
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
│   ├── build/REVIEW_STAGE.md          # Etapa de revisión por tanda (R0-R5 + mini-revisión de epics regulatorios) — solo el coordinador (v2.3.0)
│   ├── ux-design/CHANNELS.md          # Mecánica de los 3 niveles de diseño (Claude Design · canvas nativo · sin externa)
│   ├── contract-sync-audit/SKILL.md   # Audita sync back/front en proyectos existentes
│   ├── debug/SKILL.md
│   ├── new-feature/SKILL.md
│   ├── verify/SKILL.md
│   ├── write-skill/SKILL.md
│   ├── compliance-review/SKILL.md     # Revisión de cumplimiento al cerrar un milestone + triage (v2.4.0)
│   ├── compliance-review/CORRECTION_LOOP.md  # Procedimiento del agente de corrección (solo refactors elegidos, sin tests)
│   ├── knowledge/SKILL.md             # Higiene de conocimiento — modos capture (ex-learn) + audit (ex-audit-knowledge) + stats (métricas del build)
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
│   ├── code-reviewer/AGENT.md           # Review unificado (spec + arch + quality + front)
│   └── compliance-reviewer/AGENT.md     # Revisión de cumplimiento de un milestone contra todas las reglas (v2.4.0)
├── templates/
│   ├── project-config/                # Plantillas de .specture/ del proyecto destino
│   │   ├── stack.template.yml
│   │   ├── settings.template.yml      # schema_version + perfil + toggles (archivo del framework)
│   │   ├── conventions.template.md    # §12 es un puntero desde v1.19.0 — las invariantes viven en rules.yml
│   │   ├── rules.template.yml         # Invariantes R-* (una línea por regla, tags, severidad, source) — inyección por tag
│   │   ├── review-rules.template.md   # Reglas de revisión del equipo (opcional): inclusión por sección, severidades, nivel flexible (v2.4.0)
│   │   ├── docs-index.template.yml    # Catálogo machine-readable de docs preexistentes
│   │   └── decisions/000-template.md
│   ├── ARCHITECTURE_TEMPLATE.md
│   ├── API_CONTRACT_TEMPLATE.md
│   ├── api-contract.openapi.template.yaml
│   ├── ROADMAP_TEMPLATE.md
│   ├── SPEC_TEMPLATE.md
│   ├── MIGRATION_SPEC_TEMPLATE.md     # Specs de epics de migración (modernize): AC-n, gaps GAP-nnn, supersesiones
│   ├── PLANNING_TEMPLATE.md           # Gramática de docs/05-specs/<epic>/_planning.md (COVERAGE_TABLE, MECH_CHECK, veredictos, SPEC_SHA)
│   ├── BATCH_REVIEW_TEMPLATE.md       # Registro de la revisión por tanda en docs/05-specs/_reviews/ (políticas, agenda, filtradas, premisas, SCOPE, aparcados)
│   ├── COMPLIANCE_REPORT_TEMPLATE.md  # Gramáticas de la revisión de cumplimiento: parte del revisor y reporte en docs/07-reviews/ (v2.4.0)
│   ├── CURRENT_CAPABILITY_TEMPLATE.md # Verdad viva por componente en docs/05-specs/_current/ (Confianza: spec_reconciled | ai_reconciled | ai_characterized | user_confirmed)
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
| `debug` | `/specture:debug` | Test falla 2+ veces, build roto, reviewer rechaza, implementer BLOCKED (en `build`: lo ofrece el coordinador ante un `BLOCKED: debug`; un `BLOCKED: supersesiones` no lo dispara) |
| `new-feature` | `/specture:new-feature` | Usuario pide funcionalidad fuera del ROADMAP original |
| `verify` | `/specture:verify` | Antes de cualquier "completado", "fixed", "passing" |
| `write-skill` | `/specture:write-skill` | Crear o modificar skills del framework |
| `modernize` | `/specture:modernize` | Subir versión de una tecnología o migrar a otro stack |
| `contract-sync-audit` | `/specture:contract-sync-audit` | Frontend y backend desincronizados en un proyecto existente |
| `setup-docs-bridge` | `/specture:setup-docs-bridge` | Proyecto Adopt con documentación preexistente abundante (≥10 .md). Genera `docs-index.yml` + bridges + ADRs Proposed |
| `knowledge` (capture) | `/specture:knowledge` · alias `/specture:learn` | Captura post-sesión opt-in (post-epic, post-debug, manual). Propone drafts de ADRs/índice/conventions con aprobación granular |
| `knowledge` (audit) | `/specture:knowledge audit` · alias `/specture:audit-knowledge` | Auditoría periódica (1-3 meses) del `docs-index.yml`: detecta orphans, duplicates, stale, uncovered. Read-only |
| `knowledge` (stats) | `/specture:knowledge stats` | Lee `docs/.specture-meta/build-metrics.jsonl` (una línea por epic, trackeada) y aplica la lectura del gate: ¿bajan los defectos aguas abajo? ¿pregunta el planner? ¿sube `spec_defect`? Ofrece reconstruir el baseline de los epics previos al gate. Read-only |
| `knowledge` (reconcile) | `/specture:knowledge reconcile --component <slug>` · `characterize --component <slug>` | Backfill lazy de la verdad viva `docs/05-specs/_current/<slug>.md` desde los specs `[x]` del componente (último gana; lo superseded baja a Historial) — un componente por vez, aprobación en Plan mode, `Confianza: ai_reconciled`. `characterize` la deriva del código (read-only) cuando el componente no tiene specs (Adopt), `Confianza: ai_characterized`. Lo piden el doctor, `build` y `new-feature` cuando falta el archivo |
| `compliance-review` | `/specture:compliance-review` · `milestone <N>` \| `triage` | Al cerrar un milestone (lo llama `build`, sin preguntar) revisa todo su código contra **todas** las reglas del proyecto y las del equipo (`.specture/review-rules.md`); deja un reporte con comentarios sugeridos en lenguaje claro en `docs/07-reviews/` y, al vaciarse la cola, te pregunta qué abordar. Nunca publica en GitHub ni Azure DevOps (v2.4.0) |
| `doctor` | `/specture:doctor` · `check` \| `migrate` \| `sync` | Después de actualizar el plugin, cuando `start` avisa migraciones pendientes, o para lintear el corpus (rutas rotas, ADRs duplicados, reviews sin veredicto, sello huérfano). `check` es solo lectura; `migrate` aplica las migraciones mecánicas y lleva las asistidas a Plan mode |

---

## Los 8 Agentes

Specture **no** especializa por capa técnica arbitraria (no hay un "Agente Backend" vs "Agente Frontend" partido por dónde vive el archivo — eso es falsa especialización). Especializa por **función cognitiva** con contexto restringido. `implementer` y `ux-implementer` no son "backend vs frontend por capa": son dos funciones cognitivas distintas — *hacer pasar tests de lógica* vs *renderizar con fidelidad al design system, accesibilidad y cliente tipado*. La calidad visual y la adherencia a tokens son una lente cognitiva que el implementer genérico (optimizado para TDD de lógica) no tiene. El sexto, `spec-planner`, es el **autor especializado del spec**: traduce un epic en 1-3 specs validados y separa lo resuelto con cita textual de lo que solo el usuario puede decidir. El séptimo, `specture-router`, no construye nada: solo detecta la fase (opt-in, vía `/specture:start`). El octavo, `compliance-reviewer` (v2.4.0), revisa un milestone cerrado contra **todas** las reglas del proyecto: lo que la revisión por spec no ve.

| Agente | Función | Contexto que recibe | Contexto que NO recibe |
|--------|---------|---------------------|-------------------------|
| `specture-router` | Detectar la fase y devolver `PHASE · SKILL` (opt-in; nunca ejecuta la fase) | Existencia de archivos clave + checkboxes del ROADMAP | Contenido de los documentos, historial de chat |
| `spec-planner` | Traducir un epic en 1-3 specs code-free; citar textualmente o preguntar (`OPEN_QUESTIONS`) | Bloque del epic + fuentes enlazadas + slice del contrato + templates + tabla **Code Surface** (`símbolo → path → firma`, resuelta por el coordinador) | Código (no abre archivos fuente), memoria, Context7 |
| `architecture-validator` | Validar que plan/spec/ROADMAP/**contrato** respeta stack, ADRs y el contrato de API; en el dispatch de **set** por epic, C3 (dueño de cada Fuera de Scope) + C7 (citas) + C8 (Superficie sin comportamiento) | Documento + `.specture/` + token `MECH_CHECK` (+ contrato / `_planning.md` + todos los specs en el dispatch de set) | Código de implementación (salvo `MODE: REVIEW` de la etapa de revisión, v2.3.0: lo lee solo para decisiones y premisas) |
| `tdd-test-writer` | Escribir tests desde el spec | Spec + business rules + testing framework | Código de implementación (anti-bias crítico) |
| `implementer` | Hacer que los tests pasen (lógica/backend) | Spec + tests + archivos a tocar | Conversación entera, archivos no relevantes |
| `ux-implementer` | Implementar UI con fidelidad al design system | Spec + design system + slice del contrato + tests + checklist de marca | URLs a mano, valores hardcodeados, código no relacionado |
| `code-reviewer` | Review unificado (spec + arch + quality + TDD + **frontend**); verifica que cada `Crea:` exista en HEAD con la firma declarada; devuelve `CAUSE:` parseable | Diff + spec + `.specture/` + supersesiones declaradas (+ design system/contrato en epics de UI) | Sugerir fixes (solo reporta) |
| `compliance-reviewer` | Revisar un bloque de un milestone cerrado contra todas las `R-*`, `conventions.md`, `W-*`, ADRs y los criterios del equipo; clasificar cada hallazgo (refactor · comportamiento · test · proceso) y sugerir comentarios en lenguaje claro | Archivos y diff del bloque + commits + `RULES_RESOLVED` (todas) + `CUSTOM_RULES` + hallazgos ya aceptados | Archivos de configuración (recibe bloques), memoria; nunca edita código ni publica |

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
- **Nivel A — Claude Design** — el design system ya existe allá; Specture no exporta handoff: tira por componente y bajo demanda, justo antes del epic que lo necesita.
- **Nivel B — canvas nativo** · **Nivel C — sin herramienta externa** — la espina corre entera y pasa los mismos gates. Mecánica en `skills/ux-design/CHANNELS.md`.

El mapa de navegación referencia las operaciones por `operationId` del contrato — no inventa URLs. No produce código en esta fase. Excepción Adopt-con-UI: el design system se documenta a partir del código existente en vez de diseñarse.

Output: `docs/03-ux-ui/brief.md` + `navigation_map.md` + `design_system.md` (+ `components/<Nombre>.md`, autorados perezosamente).

> Úsalo cuando el frontend esté declarado y `docs/03-ux-ui/` no exista.

---

#### `/specture:build`
**Orquesta el loop de construcción plan → test → código → review por epic.** Es el skill más denso. **Cada epic se planifica completo antes de ejecutar** (Spec Planning Gate): el coordinador despacha al `spec-planner`, que escribe los 1-3 specs y **pregunta solo lo que las fuentes no responden**. Desde v2.2.0 el gate tiene **un solo presupuesto humano**: como mucho 2 rondas de preguntas (≤4 por ronda, siempre con una recomendada) vengan de donde vengan, más una única pregunta cerrada si el gate llega a su tope. Después del sello el epic corre hasta `[x]` sin preguntarte, salvo los casos que solo tú puedes decidir (aprobación visual del design system, `BLOCKED: entorno`, `BLOCKED: debug`, un test protegido por una regla del proyecto, o un `BLOCKED` / `REJECTED_MAJOR` sin loop automático; lista completa en "Human contacts" de `skills/build/SKILL.md`); **un test viejo roto por diseño no es uno de ellos** — lo resuelve el loop de supersesiones sin preguntarte. El `architecture-validator` aprueba cada spec (incluidas las citas de `RESOLVED_ALONE`, chequeo C7) y la evidencia queda trackeada en `docs/05-specs/<epic>/_planning.md`. Recién entonces el epic-agent ejecuta: `tdd-test-writer` (RED commit) → `implementer` (GREEN) → `code-reviewer`, con el **TDD Honesty Gate** (`hooks/lib/honesty-check.js` desde v2.2.0; `git diff` sin node) en el medio. Marca el epic `[x]` solo cuando el reviewer aprueba y los tests pasan.

**Cómo pedir revisión o delegar:** *"construí con revisión de specs"* frena el gate en el resumen para que confirmes; *"si hay dudas usá la recomendada"* delega las respuestas de esas rondas (quedan registradas como `fuente: delegado por el usuario`, con alcance al epic nombrado, o a la tanda entera solo si lo dices antes de arrancarla; nunca sobrevive la sesión ni autoriza tocar el contrato). La presión vaga ("hazlo rápido, no preguntes") **no** suprime preguntas de contrato. Delegar no hace falta para los tests viejos que un spec vuelve falsos: esos nunca llegan como pregunta. Preguntas frecuentes: [`docs/build-faq.md`](docs/build-faq.md).

**Etapa 2 del gate (v1.18.0) — el set y la evidencia.** Antes de gastar un dispatch del validator, el coordinador corre `hooks/lib/spec-set-check.js` sobre el **conjunto** de specs: cada `operationId` del epic en exactamente un spec, cada `RN-nnn` citada, cada firma `(planeada — re-anclar)` idéntica a la que crea el spec anterior, orden de dependencia, tamaño — un hueco o un desajuste vuelve al planner sin pasar por el validator, y el token `MECH_CHECK: PASS <sha>` es input obligatorio del validator. El planner ya **no abre código**: el coordinador le entrega una tabla `símbolo → path → firma` de la carpeta raíz del componente (Code Surface Resolution). El validator recibe además **un dispatch de set** por epic (C3: todo "Fuera de Scope" tiene dueño; C7: citas; C8: Superficie solo firmas y paths). Tras el commit de planificación, los specs quedan **sellados** (`spec_sha` + `spec_paths` en `build-locked.json`, escritos con `hooks/lib/seal-cli.js`): con hooks, editar un spec se deniega; sin hooks, el coordinador corre `git diff <SPEC_SHA>..HEAD` al procesar el reporte y escala cualquier diff como `REJECTED_MAJOR`. Con hooks, el sello también lleva los paths `Crea:`/`Modifica:` de los specs y **deniega cualquier escritura de código fuera de ellos** (cero código sin spec): un archivo que falta no se agrega a escondidas — el implementer reporta `BLOCKED: spec <ID>` y el planner suma la línea `Modifica:`. El `code-reviewer` verifica que cada símbolo `Crea:` exista en HEAD con la firma declarada y devuelve `CAUSE:` (`none | implementation | spec_defect | architecture`). Un test de un epic **cerrado** que el nuevo spec contradice se declara (`Supersede: <path>::<test> — motivo: BR-n`), se aplica en un commit `test(supersede)` previo al RED y queda registrado en `_planning.md` — nunca más un ledger de excepciones. Y cada epic deja una línea en `docs/.specture-meta/build-metrics.jsonl` (trackeado): `/specture:knowledge stats` la lee y te dice si el gate está atrapando ambigüedad real.

**Gate convergente (v2.2.0).** El gate ya no exige la lista completa de tests viejos que un spec rompe (el planner no los puede ver): declara solo lo que las fuentes muestran, y el resto lo encuentra la ejecución corriendo la suite **por capas** (compilación antes de GREEN, runtime después, descontando los fallos que ya existían antes del epic). Esos tests pasan por el **loop de supersesiones**, sin revert ni preguntas: un validador fresco juzga cada caso con el dato (J9), el spec cambia solo en su sección de supersesiones, los tests protegidos por `rules.yml` o por un GUARD de otro epic quedan fuera, el test-writer reescribe a ciegas en un commit registrado por SHA y `hooks/lib/honesty-check.js` verifica en el Step 5.5 que cada commit de tests posterior al RED esté registrado y que el RED original sobreviva. La validación va **por rondas**: una re-validación es **delta** (veredicto previo + diff), un `APPROVED` avanza (sus observaciones van a `GATE_NOTES` o a Diferidos con epic dueño, nunca a otra pasada) y tres rondas sin aprobar terminan en **una** pregunta cerrada con opciones según el tipo de problema. Detalle y cómo auditarlo: [`docs/build-faq.md`](docs/build-faq.md).

**Etapa de revisión (v2.3.0).** Antes de ejecutar una tanda, `build` abre una **revisión por tanda** (paso 4.5 de la cola, `skills/build/REVIEW_STAGE.md`): te sientas **una vez** —dos rondas como mucho— y tomas todas las decisiones que la máquina puede prever; después la tanda corre sin preguntarte. La preparación es desatendida: por cada epic, el `spec-planner` escribe borradores ciego al código (`MODE: DRAFT`), `spec-set-check --draft --batch` los chequea sin habilitar ningún sello, y el `architecture-validator` en `MODE: REVIEW` **lee código** (solo `Read`/`Glob`) para encontrar lo que te obliga a decidir y para **verificar cada premisa** que los borradores afirman sobre el sistema actual, con `path:línea`; el planner (`MODE: QUESTIONS`) lo convierte en preguntas cerradas. Lo que una fuente ya responde se **filtra a la vista**, con su cita (dices "inclúyela" y entra). La ronda 1 va **por tema**, con el tope de 4 preguntas por llamada y no por ronda, más siete políticas de la tanda (P-1…P-7); la ronda 2 solo trae preguntas nacidas de tus respuestas o que chocan con un ADR, una regla o el contrato. **La recomendada nunca se aplica sola**: delegar se dice por ítem o por tema y queda escrito en el registro, ítem por ítem. Cada respuesta se persiste al momento en `docs/05-specs/_reviews/<fecha>-<tanda>.md` (plantilla `templates/BATCH_REVIEW_TEMPLATE.md`, leído por `hooks/lib/review.js`), así que una sentada cortada se retoma con `/specture:start` sin repreguntar; al cerrar, cada epic guarda su huella (`SCOPE`). En su turno, cada epic pasa por **Refresh & seal** sin preguntas (planner `MODE: REFRESH` contra el código de ese momento, 4a real, validador delta, sello); si su bloque o sus RN cambiaron desde la sentada, vuelve a una revisión corta. Los epics **regulatorios** (datos personales, salud, dinero, consentimiento legal) tienen además una **mini-revisión anunciada** justo antes de sellarse, el único contacto previsto durante la ejecución. En cualquier otro epic, una decisión que nadie previó lo **aparca** (vuelve a `[ ]` con una línea `**Aparcado:**` en el ROADMAP) y la cola sigue con los que no dependen de él. Un epic que no pasó por la revisión sigue por el gate por epic de siempre. Guía para el usuario: [`docs/review-stage-guide.md`](docs/review-stage-guide.md).

**Modo Frontend (v1.6.0):** cuando el epic es de UI, despacha `ux-implementer` en vez del implementer genérico y aplica el orden obligatorio: el epic de **design system** se construye primero (tokens + componentes + ruta `/dev/design-system`) y pasa por un **gate de aprobación visual humana** (Claude puede capturar screenshots con Playwright; el usuario aprueba) antes de que se construya cualquier página. Las páginas consumen el backend solo a través del **cliente tipado generado del contrato**, en orden de dependencia de `operationId`.

Output: código implementado, testeado, revisado, y ROADMAP actualizado.

> Úsalo cuando digas "construyamos", "implementemos el siguiente epic", o cuando el ROADMAP tenga epics `[ ]`.

---

#### `/specture:debug`
**Debug sistemático con causa raíz obligatoria.** Se activa ante cualquiera de estos triggers: un test falla por segunda vez, el build se rompe, el `code-reviewer` devuelve `REJECTED_MAJOR`, el `implementer` reporta `BLOCKED`, o el usuario reporta un bug. Dentro de `/specture:build` (v2.2.0) hay dos excepciones: un `BLOCKED: supersesiones` del implementer ya está clasificado y va al loop de supersesiones, y el epic-agent nunca invoca debug (necesita Plan mode y detendría la cola) — reporta `BLOCKED: debug <spec>` y el coordinador te lo ofrece. Prohíbe fixes sin investigación previa. Obliga a escribir un `DEBUG_LOG.md` con síntoma, hipótesis, experimentos y causa raíz confirmada antes de proponer cualquier solución.

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

#### `/specture:knowledge` (modos `capture` | `audit` | `stats` | `reconcile`)
**Higiene de conocimiento del proyecto, unificada en una skill con cuatro modos** (v1.11.0; `stats` desde v1.18.0; `reconcile` desde v1.19.0). Los aliases `/specture:learn` → `capture` y `/specture:audit-knowledge` → `audit` siguen funcionando.

**Modo `capture`** (ex-`/specture:learn`): captura post-sesión opt-in del conocimiento descubierto. Se activa al final de un epic (build Step 8.5), tras confirmar una causa raíz (debug Phase 4.5), manualmente, o con `--teach <concepto>`. Filtra relevancia, recolecta evidencia, cross-referencia el `docs-index.yml`, y genera hasta **3 drafts** por invocación (entrada de índice `ai_categorized`, ADR `Status: Proposed`, patch a `conventions.md`/bridge, o test de characterization pendiente). El usuario **aprueba en bloque vía Plan mode**. Hard token budget ~30K. **Nunca escribe a la memoria personal de Claude.** Gate: `knowledge.enabled` en `.specture/settings.yml`. Output: drafts + log en `docs/.specture-meta/learn-history.jsonl`.

**Modo `audit`** (ex-`/specture:audit-knowledge`): auditoría periódica read-only del `docs-index.yml`. Detecta **ORPHAN** (HIGH), **DUPLICATE_CANDIDATE** (MEDIUM), **STALE/VERY_STALE** (LOW/MEDIUM), **UNCOVERED** (LOW), **UNKNOWN_AGE** (LOW); calcula un **health score 0-100**. **Nunca auto-corrige** — propone acciones y el usuario decide. Output: `docs/.specture-meta/last-audit.md` + `audit-history.jsonl`.

**Modo `stats`** (v1.18.0): lee `docs/.specture-meta/build-metrics.jsonl` — la línea por epic que el coordinador de `build` anexa y commitea (`planner_dispatches`, `open_questions`, `c7_rejections`, `mech_check_failures`, `needs_context_spec`, `iteration_cap_spec`, `blocked_spec`, `reviewer_rejected_major_spec_defect`, `review_rejections`, `supersessions`, `outcome`, `tokens` opcional) — vía `hooks/lib/metrics-report.js`, y aplica la lectura del diseño del gate: bajan los defectos aguas abajo → el gate atrapa ambigüedad real; no bajan y `open_questions ≈ 0` → el planner no pregunta; sube `spec_defect` → mantener la validación por spec (decisión A6). Desde v2.2.0 lee además el gate convergente: `gate_rounds` (≥3 sostenido → revisar el criterio del validador), `planner_redispatch_after_approved` (debe ser 0: si no, el coordinador está reabriendo APROBADOS), despachos de gate vs de loop, `supersede_loops` / `supersede_tests`, `j9_regressions`, `baseline_failures` y contactos humanos del gate vs de la ejecución. Si no hay archivo, ofrece `--baseline --write`: reconstruye una línea por epic cerrado desde los veredictos de `docs/07-reviews/`, los contadores de `_planning.md` y el `git log`. Read-only.

**Modo `reconcile`** (v1.19.0, ítem 38 del roadmap): backfill **lazy, por componente**, de la verdad viva `docs/05-specs/_current/<slug>.md`. `hooks/lib/current-state.js` lista los componentes de `architecture.md` y los specs `[x]` que citan a cada uno (por `Módulo:` del spec o por el bloque del epic), en orden de ROADMAP; el modo lee **solo** esos specs, aplica "último gana" por `operationId` / sujeto de regla (lo superseded baja a "Historial"), hace merge incremental si el archivo ya existe y escribe con **aprobación en Plan mode** y `Confianza: ai_reconciled`. Un slug ambiguo se pregunta, nunca se adivina. **`characterize --component <slug>`** es la variante para proyectos Adopt o código heredado sin specs: un subagente read-only (haiku) extrae del código de la "Carpeta raíz" filas `KIND | STATEMENT | path::símbolo` y el archivo nace con `Confianza: ai_characterized` (informativo para el reviewer). El doctor (`current-state-missing` / `current-state-partial`), `build` (Current-State Resolution) y `new-feature` nombran el comando cuando un componente con specs cerrados no tiene archivo; `build` Step 8.7 sigue reconciliando al cerrar cada milestone (`Confianza: spec_reconciled`). Un proyecto maduro obtiene verdad viva sin consolidar cientos de specs de golpe.

> Úsalo (capture) cuando termine un epic / se confirme un root cause / quieras formalizar lo descubierto; (audit) cada 1-3 meses o cuando el índice parezca desfasado; (stats) cada ~10 epics con gate para decidir sobre él con datos; (reconcile) cuando el doctor o el build avisen de un componente con specs cerrados y sin `_current/`, o (characterize) antes de la primera feature sobre código heredado.

---

#### `/specture:compliance-review` (modos `milestone <N>` | `triage`)
**Revisión de cumplimiento de un milestone (v2.4.0).** La revisión por spec mira cada spec con las reglas que le tocan por tags; esta mira **todo el milestone** contra **todas** las reglas: cada `R-*` (también las de tags mal puestos), cada sección de `conventions.md`, las reglas de proceso `W-*` sobre los commits, los ADRs `Accepted`, la consistencia entre epics y los **criterios del equipo** enlazados desde `.specture/review-rules.md` (un archivo opcional que incluye, con un solo nivel, archivos o secciones que el equipo ya mantiene, con condición de ruta, severidades propias y un nivel flexible para código legado). `build` la llama al cerrar cada milestone (paso 3.5 de Step 8.7) sin preguntar: calcula el rango con las ventanas `[/]`→`[x]` de cada epic, despacha el `compliance-reviewer` por bloque y deja `docs/07-reviews/cumplimiento-milestone-<N>-<fecha>.md`, con un **comentario sugerido** por hallazgo que se entiende sin los documentos internos. Al vaciarse la cola te muestra los hallazgos con una propuesta y **tú decides** cada uno: corregir (solo los `refactor`, por un agente de corrección, sin tocar tests), diferir o "no aplica". Nunca publica en GitHub ni en Azure DevOps. Se apaga con `compliance_review.enabled: false`.

> Guía: [`docs/compliance-review-guide.md`](docs/compliance-review-guide.md).

#### `/specture:doctor` (modos `check` | `migrate` | `sync`)
**Diagnóstico mecánico del proyecto y migraciones de esquema.** Specture versiona el plugin; el doctor versiona el **proyecto**. `check` (solo lectura) lintea el corpus documental — rutas citadas que no existen, placeholders `...`, ADRs con número duplicado o sin `Status`, reviews sin veredicto, specs sin `AC/BR/EC`, sobre 300 líneas o con secciones fuera del template, citas por número de línea a documentos vivos —, lintea los requerimientos — placeholders sin resolver, HUs sin `Exposición`, historias de frontera sin consolidar, reglas/casos/exclusiones sin IDs `RN/CL/FA` —, lintea las reglas — `.specture/rules.yml` que no parsea, ids duplicados o severidad desconocida (`rules-schema`); una regla de más de 240 caracteres o un ítem del deny-list §4 de más de 2 líneas (`rule-length`: la historia va a un ADR/debug log enlazado) —, revisa el estado — sello `build-locked.json` huérfano, más de un epic `[/]`, `_current/` ausente con milestones cerrados (acción: `knowledge reconcile --component <slug>`), `docs-index.yml` vs toggle, residuos de worktrees, un spec liberado del sello por un loop interrumpido (`seal-lifted`, v2.2.0) —, revisa lo que un proyecto arrastra del gate anterior (`gate-legacy-rejection`, `claude-md-gate-overrides`, v2.2.0) y compara `schema_version` (`.specture/settings.yml`) con la versión del plugin para listar las migraciones pendientes por tipo (cada minor embarca las suyas — la última, `1.19-rules-file` en v1.19.0, que mueve las invariantes de `conventions.md` §12 a `rules.yml`). `migrate` aplica las **mecánicas** (idempotentes, verificadas, registradas en `.specture/migrations.log`), lleva las **asistidas** a Plan mode y registra las de **contenido** con su skill dueño; `sync` = mecánicas + check (para CI). Nunca commitea; nunca toca specs cerrados, reviews ni debug logs.

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
**Autor especializado del spec (v1.17.0).** Traduce **un** epic en 1-3 specs code-free, self-contained y ordenados por dependencia; los escribe a disco sin commitear y no toca nada fuera de `docs/05-specs/<epic-slug>/`. Su regla de hierro: **no existe el tercer estado** — toda duda que cambie el contrato observable queda `RESOLVED_ALONE` con **cita textual** de una fuente entregada, o va a `OPEN_QUESTIONS` como pregunta cerrada con opciones. En re-dispatch edita mínimamente (IDs y slugs estables, `CHANGELOG` contrastado contra `git diff`). Desde v2.3.0 tiene tres modos para la etapa de revisión, los tres ciegos al código: `DRAFT` (borradores sin Superficie, con las dudas marcadas `sujeto a Q-n`), `QUESTIONS` (preguntas cerradas a partir de las decisiones y las premisas falsas que encontró el validador) y `REFRESH` (completa los borradores en specs sellables en el turno del epic; nunca pregunta: una decisión que el registro no cubre va a `CONCERNS: decisión-nueva` y el coordinador aparca el epic).

- **Contexto que recibe:** bloque del epic + secciones enlazadas de requerimientos/arquitectura + slice del contrato + templates (`SPEC_TEMPLATE` o `MIGRATION_SPEC_TEMPLATE` + `PLANNING_TEMPLATE`) + ADRs Accepted + `_current/`/docs-index resueltos + la tabla **Code Surface** (`SYMBOL | PATH | SIGNATURE` de la carpeta raíz del componente, resuelta por el coordinador — v1.18.0).
- **Contexto que NO recibe:** el código (desde v1.18.0 **no abre archivos fuente**: un símbolo ausente de la tabla es un `CONCERNS`, nunca una lectura ni una firma inventada), memoria, Context7, historial.
- **Salida machine-readable:** la `COVERAGE_TABLE` de `_planning.md` (gramática exacta de `templates/PLANNING_TEMPLATE.md`: `op:` / `br:` / `sym:` / `oos:` / `gap:` / `sup:`) la parsea `hooks/lib/spec-set-check.js` — una fila que no parsea vuelve como `VIOLATIONS`.
- **Output:** `STATUS` + `SPECS` + `COVERAGE_TABLE` + `OPEN_QUESTIONS` + `RESOLVED_ALONE` + `CHANGELOG` + `CONCERNS`.
- **Modelo:** Opus (detectar ambigüedad real y citar es juicio; el spec es el contrato sellado de toda la cadena), con `effort: medium` desde v2.2.0; cada pase es un despacho **fresco** con `ALCANCE` (nunca se reanuda uno anterior).

---

#### `architecture-validator`
**Revisor independiente de conformidad arquitectónica.** Recibe un documento (plan, spec, o architecture.md) y lo compara contra `.specture/stack.yml`, `conventions.md`, y todos los ADRs aceptados. Devuelve `APPROVED` o `REJECTED` con las violaciones específicas (tecnología no declarada en stack, patrón prohibido, ADR ignorado, naming incorrecto). En el Spec Planning Gate valida **por rondas**: en cada ronda, **un dispatch de set** (`SPEC_SET`: todos los specs + `_planning.md` + extractos citados + Code Surface) para la Dimensión 7 — C3 todo "Fuera de Scope" tiene dueño, C7 citas verbatim que responden la duda, C8 Superficie solo firmas y paths, C2 fallback si el chequeo mecánico no pudo verificar — y **un dispatch por spec** (dims 1-6); los despachos paralelos cuentan como una ronda. Desde v2.2.0 una re-validación es **delta** (`MODE: DELTA`: su veredicto previo + el diff de specs y fuentes; un BLOCKER nuevo solo sobre el diff o como hallazgo tardío acotado), juzga solo lo que el autor del spec puede ver (la completitud de las supersesiones ya no es criterio) y en ejecución responde el juicio J9 del loop de supersesiones. Corre con `tools: Read, Glob` (sin Bash ni Grep: no barre tests ni código) y `effort: medium`. Todo spec del planner llega con el token `MECH_CHECK` del chequeo mecánico; sin él responde `BLOCKED`. Desde v2.3.0, en la etapa de revisión (`MODE: REVIEW`) —y solo ahí— **lee código** con `Read`/`Glob` para encontrar lo que solo el usuario puede decidir (`HUMAN_DECISIONS`) y verificar las premisas de los borradores sobre el sistema actual (`PREMISAS`, con `path:línea`); nunca propone la respuesta ni juzga cómo implementar.

- **Contexto que recibe:** documento candidato + `.specture/` completo + `MECH_CHECK` (+ el set y `_planning.md` en el dispatch de set; + el registro de la tanda y las carpetas raíz de código en `MODE: REVIEW`).
- **Contexto que NO recibe:** código de implementación (salvo en `MODE: REVIEW`).
- **Output:** `APPROVED` | `REJECTED — [violaciones]` | `BLOCKED — missing input: [qué]`
- **Modelo:** Opus (razonamiento de alta precisión), `effort: medium`, `tools: Read, Glob` (v2.2.0).

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

#### `compliance-reviewer`
**Revisor de cumplimiento de un milestone cerrado (v2.4.0).** Revisa un bloque del código del milestone contra todas las reglas del proyecto — `R-*`, `conventions.md`, `W-*`, ADRs `Accepted`, criterios del equipo (`CUSTOM_RULES`, como datos y nunca como procedimiento) — y la consistencia entre epics. En rutas de nivel flexible aplica solo esas reglas; ante una contradicción aplica la de Specture y la reporta. Clasifica cada hallazgo (`refactor` · `comportamiento` · `test` · `proceso`) y escribe un comentario sugerido sin IDs ni documentos internos. Escribe solo su parte; el reporte lo arma `hooks/lib/compliance.js`. Modo `VERIFY` para las correcciones.

- **Contexto que recibe:** archivos y diff del bloque + commits del rango + `RULES_RESOLVED` (todas) + `conventions.md` + ADRs + `CUSTOM_RULES` + hallazgos ya aceptados por las revisiones por spec.
- **Output:** una parte con gramática estricta (`templates/COMPLIANCE_REPORT_TEMPLATE.md`); nunca edita código ni publica nada.
- **Modelo:** Opus.

---

## Configuración por Proyecto

Cada proyecto que use Specture tiene una carpeta `.specture/`:

```
[proyecto-usuario]/
├── CLAUDE.md                  # Importa Specture vía @import (solo modo manual)
├── .specture/
│   ├── stack.yml              # Stack tecnológico (fuente de verdad)
│   ├── conventions.md         # Naming, patrones, estilo (§12 es un puntero a rules.yml desde v1.19.0)
│   ├── rules.yml              # Invariantes R-*: una línea por regla + tags + severidad + source (v1.19.0)
│   ├── review-rules.md        # Opcional: criterios de revisión del equipo, enlazados por archivo o sección (v2.4.0)
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
    └── 07-reviews/            # review-<epic>-<spec>-<fecha>.md (por spec) · cumplimiento-milestone-<N>-<fecha>.md (v2.4.0)
```

`stack.yml` es **leído por todos los skills y agentes** antes de generar nada. Cambia el stack → cambian las decisiones, sin tocar el framework.

`settings.yml` (desde v1.15.0) es el único archivo **del framework** dentro de `.specture/`: `schema_version` (la versión del esquema de proyecto que el plugin espera), `profile` (`lean | full | custom`) y los toggles (`hooks.enabled`, `context7.enabled`, `docs_index.*`, `knowledge.enabled`, `compliance_review.enabled` — este último, desde v2.4.0, activo por defecto y respetado en cualquier perfil). Lo escribe `/specture:setup`; cuando actualizás el plugin, `/specture:start` compara `schema_version` con la versión instalada y, si hay migraciones pendientes, ofrece `/specture:doctor migrate`. Proyectos creados antes de v1.15.0 conservan los toggles en `conventions.md` §10 — se siguen leyendo hasta que el doctor los mueva.

`rules.yml` (desde v1.19.0) guarda las **invariantes del proyecto** `R-*` — **una línea por regla** (≤ 240 caracteres) con `tags`, `severity` (`BLOCKER | IMPORTANT`) y `source` (el ADR o debug log donde vive la historia; nunca inline). No hay toggle: la presencia de reglas es el switch. El coordinador de `build` corre `hooks/lib/rules-resolve.js --tags <módulo,componente,backend|frontend>` antes de cada dispatch y entrega **solo** las reglas que cruzan (`RULES_RESOLVED`) al planner, al implementer y al reviewer, que las enforça por ID (Dimensión 7). `/specture:knowledge capture` escribe las nuevas ahí y rechaza cualquier draft que supere el largo; el doctor marca `rule-length` y `rules-schema`. Proyectos anteriores conservan la tabla en `conventions.md` §12 hasta que `/specture:doctor migrate` (`1.19-rules-file`) la mueva; mientras tanto el resolver inyecta esas reglas enteras (sin filtro por tag, como antes) y avisa.

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
      - run: git clone --depth 1 --branch v1.19.0 https://github.com/FerEscobarDev/Specture.git .specture-plugin
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
- *"Revisá el milestone contra todas las reglas"* / *"Revisión de cumplimiento"* → `/specture:compliance-review`

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

### v2.4.0 — Revisión de cumplimiento: cada milestone contra todas las reglas, también las del equipo

**Motivación:** la revisión por spec mira cada spec con las reglas que le tocan por sus tags. Lo que queda fuera nadie lo revisaba: una invariante `R-*` con tags mal puestos, las secciones de `conventions.md` que ninguna dimensión cubre (estilo, testing, idioma, reglas del equipo), las reglas de proceso `W-*` sobre los commits (el formato de commit no lo verificaba nadie) y la consistencia entre epics. Además, los equipos que adoptan Specture suelen tener ya sus propios criterios de revisión —un agente o skill de review en su repositorio— que quedaban aislados: guardaban los resultados en otra carpeta y no consideraban las reglas de Specture. Guía para el usuario: [`docs/compliance-review-guide.md`](docs/compliance-review-guide.md).

**Cambios:**
- **Revisión de cumplimiento al cerrar un milestone** (`skills/compliance-review/SKILL.md`, `/specture:compliance-review milestone <N> | triage`). `build` la llama en el paso 3.5 de Step 8.7, antes del colapso del ROADMAP, **sin preguntar y sin frenar la cola**. `hooks/lib/compliance.js range` calcula el código del milestone con ventanas por epic —desde el commit que lo marcó `[/]` (`LOCK_SHA` de `_planning.md`, o el historial del ROADMAP) hasta el que lo marcó `[x]`—, así que otro milestone intercalado no se cuela; excluye `docs/`, `.specture/`, lockfiles y binarios, y agrupa por componente. Sin una ventana verificable el reporte sale `BLOCKED` con el motivo, nunca revisa código equivocado.
- **Agente `compliance-reviewer`** (nuevo, opus): revisa cada bloque contra **todas** las `R-*`, cada sección de `conventions.md`, las `W-*` sobre los commits, los ADRs `Accepted`, los criterios del equipo y la consistencia entre epics. Clasifica cada hallazgo como `refactor`, `comportamiento`, `test` o `proceso`. Escribe solo su parte en `.specture/state/compliance/`; nunca edita código ni publica nada.
- **Reporte** en `docs/07-reviews/cumplimiento-milestone-<N>-<fecha>.md`, armado por script (`compliance.js assemble`): STATUS calculado, hallazgos ordenados por severidad con su origen, conflictos y lo no evaluado. Cada hallazgo trae un **comentario sugerido** en lenguaje claro que se entiende sin los documentos internos; `compliance.js lint` rechaza IDs de reglas, archivos del framework, `§` y nombres de archivos incluidos. **Nunca publica** en GitHub ni en Azure DevOps.
- **Triage al vaciarse la cola** (paso 6, después de aparcados y diferidos, antes de Step 8.5 y de la sugerencia de PR): el usuario decide cada hallazgo —corregir, diferir o "no aplica"— con una pregunta cerrada. Solo un `refactor` se corrige: un cambio de comportamiento pasa por un spec, un test lo cambia el test-writer y un hallazgo de proceso no se arregla con código. Lo corrige un **agente de corrección** (`skills/compliance-review/CORRECTION_LOOP.md`): declara de antemano los archivos de cada hallazgo, un commit por hallazgo con el implementer en `MODE: CUMPLIMIENTO`, sin tocar tests, `honesty-check.js fix-range` (nuevo), la suite igual al baseline y una pasada `VERIFY` del revisor. Corre solo sin ningún epic `[/]`.
- **Reglas personalizadas `.specture/review-rules.md`** (opcional; plantilla `templates/project-config/review-rules.template.md`): enlaza criterios que el equipo ya mantiene por archivo o por sección (`§` o `#`), con `cuando:` por rutas, un solo nivel de inclusión, severidades del equipo, un **nivel flexible** para código legado (ahí la revisión aplica solo esas reglas) y reglas `RV-n` propias. `hooks/lib/review-rules.js` + `review-rules-resolve.js` arman el bloque `CUSTOM_RULES`, cercado como datos de criterio; falla en voz alta con errores o por encima de 60 000 caracteres. Si contradicen a Specture, gana Specture y el reporte lista el conflicto.
- **El implementer y el ux-implementer reciben `CUSTOM_RULES`** con lo que aplica a la superficie de cada spec ("Custom Rules Resolution" en `EPIC_LOOP`): la revisión de cumplimiento confirma en vez de descubrir.
- **`compliance_review.enabled`** en `.specture/settings.yml`: `true` por defecto y respetada en cualquier perfil (`PROFILE_INDEPENDENT_KEYS` generaliza la excepción que ya tenía `docs_index.max_entries_per_dispatch`).
- **Setup:** Bootstrap pregunta por criterios de revisión existentes; Adopt suma el paso 8.6, que encuentra los archivos de revisión del equipo, lista sus secciones y el usuario elige cuáles enlazar; Reconfigure permite editarlo. `conventions.template.md` §9 apunta al archivo.
- **Doctor:** `review-rules-schema`, `review-rules-include` (archivo o encabezado inexistente, inclusión anidada, fuera del repositorio), `review-rules-size`, `review-rules-agent-include`, `review-rules-glob`, `compliance-triage-pending` y `compliance-report-malformed`.
- **Métricas:** un registro `kind: "compliance"` por reporte en `build-metrics.jsonl`; `/specture:knowledge stats` lo suma en una línea `cumplimiento:` y avisa cuando la mitad o más de los hallazgos fueron "no aplica".
- **Fixture y sondas:** `scripts/baseline-fixture.js --stage 6` (milestone cerrado sobre código real con las reglas de un equipo ficticio enlazadas por sección); sondas C1-C11 en `docs/compliance-review-baseline.md`. La primera corrida encontró tres defectos, corregidos antes del release (un tipo `proceso` para los hallazgos de commits, `NO_EVALUADO` solo por nivel flexible, un fixture con ruido); en la versión final las 11 sondas pasaron 3 de 3 y el loop de corrección se verificó de punta a punta.
- **Plataformas:** espejo Copilot del agente nuevo y de los implementers; gate `compliance-review` en `copilot/compatibility-matrix.json`; en Copilot y Antigravity el triage es una pregunta cerrada en el chat y el skill comprueba con `git status` que el revisor no escribió fuera de su parte.
- **Docs:** `docs/compliance-review-guide.md` (nueva), `docs/compliance-review-baseline.md` (nueva), `docs/release-process.md`, `docs/build-faq.md`, `docs/execution-flows.md` (§5.8 nuevo), `docs/native-integration-guide.md`, guías de Copilot y Antigravity, `hooks/README.md`, `docs/framework-roadmap.md` (Milestone 9).
- Tests: 333 (305 → 333: settings, `review-rules`, doctor, `compliance.js` sobre repositorios git sintéticos, `fix-range`, métricas, fixture etapa 6).

**Lo que este release deliberadamente NO envió:** la revisión de un **PR de GitHub o Azure DevOps** y de una rama local (ítem 78, v2.5.0): lectura del PR, reglas tomadas de la rama destino, sin corrección ni publicación. Tampoco el coordinador por epic en subagente (ítem 72), que deja de estar atado a v2.4.0 y queda condicional, con versión por definir.

**Migración para proyectos existentes:** ninguna. La revisión de cumplimiento queda **activa por defecto** al actualizar: el próximo cierre de milestone la corre y, al vaciarse la cola, te pregunta qué abordar. Para apagarla: `compliance_review.enabled: false` en `.specture/settings.yml`. `/specture:doctor migrate` registra el `schema_version`.

**Backward-compat:** sin `.specture/review-rules.md` el bloque es `CUSTOM_RULES: []` y no hay aviso (es opcional). Los registros `kind: "compliance"` de `build-metrics.jsonl` son aditivos: no cuentan como epics ni como líneas mal formadas. La clave nueva de `settings.yml` no necesita migración: si falta, vale `true`. El code-reviewer por spec, el gate y la etapa de revisión no cambian.

### v2.3.1 — El gate de sellos intercepta multi_replace_file_content de Antigravity

**Motivación:** el hook `PreToolUse` que hace cumplir los sellos del build (TDD Honesty Gate, Spec Seal y Allowed Paths) solo se dispara para las herramientas que nombra el matcher de `hooks.json`. Ese matcher cubría `write_to_file` y `replace_file_content` de Antigravity, pero no `multi_replace_file_content`, la que aplica varios reemplazos a un archivo en una sola llamada. En Antigravity, un agente podía editar un test sellado por el RED, un spec validado o código fuera de la superficie declarada sin que el hook lo viera.

**Cambios:**
- **`hooks.json`:** el matcher pasa a `Edit|Write|NotebookEdit|write_to_file|replace_file_content|multi_replace_file_content`. El hook ya leía `tool_input.TargetFile`, así que no cambia su lógica.
- **`agents/code-reviewer/AGENT.md`:** la descripción decía que las invariantes del proyecto salen de `conventions.md` §12; desde v1.19.0 salen de `.specture/rules.yml`, resueltas por spec en el bloque `RULES_RESOLVED`. La introducción hablaba de tres dimensiones; son cuatro obligatorias y tres opcionales. Solo cambia el texto, no lo que revisa el agente. Espejo Copilot regenerado.
- **Docs:** `hooks/README.md` y `docs/antigravity-cli-plugin.md` con el matcher nuevo.
- Tests: 304 (302 → 304: el matcher de `hooks.json` cubre todas las herramientas de escritura de Claude Code, Copilot y Antigravity; el hook deniega `multi_replace_file_content` sobre un test sellado).

**Migración para proyectos existentes:** ninguna. `/specture:doctor migrate` registra el `schema_version`.

**Backward-compat:** sin cambios de esquema. En Claude Code y Copilot no cambia nada; en Antigravity, una edición con `multi_replace_file_content` sobre una ruta sellada ahora se deniega, como ya pasaba con `replace_file_content`.

### v2.3.0 — Decidir una vez antes de ejecutar: la etapa de revisión por tanda

**Motivación:** con el gate por epic se te preguntaba en tres momentos —al escribir el ROADMAP, en el gate de cada epic y en cada validación— y la tanda se detenía esperándote. v2.2 hizo converger el gate: HC-IHCE.5 de Psikora aprobó en una ronda delta y HC-IHCE.6 hizo su gate completo en una ronda, con 4 preguntas en una sola sentada. Pero las preguntas seguían llegando epic por epic, y las dos mediciones dejaron un defecto que ningún gate podía ver, porque ni el planner ni el validador leían código: **premisas falsas**. Un spec afirmaba "como hoy" un comportamiento que el código no tenía (AC-13 de HC-IHCE.5, EC-4 de HC-IHCE.6) y la ejecución lo encontró horas después. La simulación a ciegas sobre 31 decisiones reales (`docs/milestone-decision-stage-simulation.md`) mostró que, en el epic regulatorio, un barrido previo anticipa 11 de 12 preguntas de primera ronda pero no las de segundo orden, y que la recomendada coincidió con tu respuesta real solo en 3 de 11 y en 5 de 12: las decisiones siguen siendo tuyas, pero se pueden concentrar. El experimento "ronda 2" (mismo documento, §7) eligió la variante **B2**: dos rondas por tanda más una mini-revisión anunciada antes de cada epic regulatorio. Análisis: `docs/milestone-planning-stage-analysis.md`; guía para el usuario: [`docs/review-stage-guide.md`](docs/review-stage-guide.md).

**Cambios:**
- **Etapa de revisión por tanda** (`skills/build/REVIEW_STAGE.md`, paso 4.5 de la cola; solo la lee el coordinador). R0 abre el registro de la tanda o lo retoma en su estado: nunca con un epic `[/]` abierto, nunca repregunta lo que el registro ya responde ("quedan X de Y decisiones"). R1, desatendida y por epic: Code Surface → planner fresco `MODE: DRAFT` → `spec-set-check --draft --batch` → validador `MODE: REVIEW` → planner `MODE: QUESTIONS` → filtro visible → políticas P-1…P-7 → agenda por tema, y commit. R2 es la ronda 1 contigo; R3 reescribe con tus respuestas y re-valida (delta sobre el diff, más `MODE: REVIEW` para lo que abrieron las respuestas); R4 es la ronda 2, solo si R3 produjo preguntas; R5 cierra con dónde quedó persistida cada decisión, un `SCOPE` por epic, un resumen legible y la pregunta "¿Ejecutamos ya la tanda o más tarde?". No hay tercera ronda: lo que siga abierto es un `discover` acotado o un diferido explícito con dueño.
- **Verificación de premisas contra el código.** El validador en `MODE: REVIEW` —el único modo en que lee código, con `Read`/`Glob`— devuelve `HUMAN_DECISIONS` (dinero, legal, datos personales, ciclo de vida y estados, vencimientos, qué ve y hace cada rol) y `PREMISAS`: cada afirmación sobre el sistema actual sale `VERIFICADA`, `FALSA` o `NO VERIFICABLE`, con `path:línea`. Una premisa falsa nunca se corrige en silencio: si las fuentes deciden qué debe pasar, es una `VIOLATION` para el planner; si no, es una pregunta con su `Dato verificado:`. El planner escribe cada afirmación sobre el sistema actual como algo verificable y con fuente, nunca un "como hoy" suelto. El código es fuente de premisas y de preguntas, nunca de respuestas: una sonda de ≤20 líneas puede verificar una premisa, nunca decidir.
- **Las preguntas.** Cerradas, 2-4 opciones, una `(recomendada)` justificada por una fuente de negocio, con `derivadas:`; agrupadas por tema, con el tope de 4 **por llamada** de `AskUserQuestion` y tantas llamadas como la ronda necesite. Antes se anuncia el tamaño ("N decisiones en T temas, unos M minutos") y se listan las filtradas; más de ~40 preguntas → dos sentadas o una tanda más chica, y como mucho 3 epics regulatorios por sentada. **La recomendada nunca se aplica por defecto**: "usá la recomendada" vale solo para los ítems o el tema que nombres y queda como `fuente: delegado por el usuario <fecha>`, ítem por ítem; "ninguna de las opciones" se registra textual como tu regla. Cada respuesta se escribe al momento; una que cambia una regla edita `business_requirements.md` en su sitio (`(aclarado en revisión <id>, <fecha>)`) y una arquitectónica es un ADR nuevo. Una `HUMAN_DECISION` que se dio por cerrada con una respuesta que no toca su premisa vuelve a la ronda 2: en la simulación, ese mapeo perdió en silencio el hueco de los enlaces de pago.
- **Filtradas a la vista.** Una pregunta que una RN, un ADR, el contrato, `rules.yml` o una revisión anterior ya decide va a `## FILTRADAS` con su cita; nunca desaparece, y "inclúyela" la trae a la ronda en curso.
- **Mini-revisión anunciada (variante B2).** Antes de ejecutar un epic de `REGULATORIOS` —ya con sus specs escritos en detalle y antes del sello— el validador en `MODE: REVIEW` los relee contra el código: qué puede ver y hacer cada rol en cada pantalla o endpoint, y qué datos personales entran por superficies públicas. Sin decisiones nuevas, sella y ejecuta sin preguntar; con decisiones nuevas, **una** sentada que ya se te anunció en R5, y después un refresco con tus respuestas, 4a real y validación delta antes del sello. Es el único contacto previsto durante la ejecución.
- **Refresh & seal.** Un epic de un registro `CERRADA` no pasa por el gate con preguntas: lock → `review.js scope-check` (si su bloque o sus RN cambiaron desde la sentada, vuelve a una revisión corta de ese epic) → Code Surface del momento → planner fresco `MODE: REFRESH` (cita el registro: `fuente: revisión <id> A-n`) → 4a real → validador `MODE: DELTA` contra los veredictos de la revisión (un hallazgo que una respuesta ya resuelve es una `VIOLATION` que cita esa `A-n`, nunca una pregunta) → mini-revisión si es regulatorio → commit, `SPEC_SHA`, sello y epic-agent.
- **Epics aparcados.** Una decisión **nueva** de dinero, legal, datos personales, contrato o modelo que aparece al refrescar un epic no regulatorio —un `CONCERNS: decisión-nueva` del planner o una `HUMAN_DECISION` que el registro no cubre— lo aparca en vez de preguntar (en uno regulatorio va a su mini-revisión, y lo que esa sentada deja abierto lo aparca): vuelve de `[/]` a `[ ]` con `- **Aparcado:** <ISO-8601> — <clase> — <motivo> — tanda <id>` en su bloque del ROADMAP (no es un estado nuevo de checkbox) y una línea en `## APARCADOS` del registro, y la cola sigue con los epics que no dependen de él. Al drenar la cola se listan con su decisión pendiente, para la próxima sentada. Límite dicho: en una cadena casi lineal de dependencias, aparcar uno suele detener el resto.
- **Registro de la tanda** (`templates/BATCH_REVIEW_TEMPLATE.md`, nuevo, en el manifiesto de esquema): `docs/05-specs/_reviews/<YYYY-MM-DD>-<slug>.md`, trackeado, con `ID`, `ESTADO` (`PREPARANDO` · `RONDA-1` · `RONDA-2` · `CERRADA` · `EJECUTADA`), `EPICS`, `REGULATORIOS`, `POLÍTICAS` P-1…P-7, `AGENDA` (`A-n`), `FILTRADAS` (`F-n`), `PREMISAS` (`PR-n`), `DECISIONES PERSISTIDAS`, `SCOPE`, `APARCADOS`, `EJECUCIÓN` y `MÉTRICAS`.
- **`hooks/lib/review.js`** (nuevo): `status` (`REVIEW: NONE | OPEN <id> <ESTADO> pendientes:n | CLOSED <id> por-ejecutar:n aparcados:m | DRAINED <id>`; `UNVERIFIABLE` si el registro actual está mal formado, y la cola se detiene), `scope-hash --epic` (huella del bloque del epic —estable ante el checkbox y las líneas `Aparcado`/`Diferidos`— más el texto de sus RN) y `scope-check --batch [--epic]` (`SAME | CHANGED | MISSING` por epic).
- **`spec-set-check.js --draft [--batch <epics>]`:** el mismo chequeo sobre borradores sin Superficie; C-path, C4, C6 y C-sup bajan a INFO y, con `--batch`, también C1-consume y C-design cuando el epic proveedor está en la tanda. Tokens `MECH_CHECK: DRAFT_PASS | DRAFT_FAIL | DRAFT_UNVERIFIABLE`, que nunca cuentan como `MECH_CHECK` para sellar.
- **Doctor:** `review-open` (una sentada quedó a medias → `/specture:start`), `review-scope-drift` (un epic de un registro cerrado cambió desde la sentada, o no tiene `SCOPE`), `epic-parked` (INFO con la decisión pendiente), `parked-orphan` (un `Aparcado` en un epic `[/]` o `[x]`, sin tanda o de una tanda sin registro) y `review-malformed`. Un proyecto sin `_reviews/` ni líneas `Aparcado` no ve ninguno.
- **Métricas en `/specture:knowledge stats`:** `batch_id`, `parked` y `park_class` por epic, y las seis cifras del registro (`review_rounds`, `review_questions`, `review_filtered`, `review_human_contacts`, `late_questions`, `premises_false`) contadas **una vez por tanda**; R1 cuenta `open_questions + review_questions` en las líneas con `batch_id`; columna `rev`.
- **Traspasos:** `start`, `new-feature` y `architecture` anuncian que el build empieza por la sentada de revisión; `ROADMAP_TEMPLATE.md` documenta la línea `**Aparcado:**`.
- **Plataformas:** espejos Copilot regenerados (los modos nuevos viajan en el cuerpo de los agentes); gates `review-stage` y `parked-epic` en `copilot/compatibility-matrix.json`. En Copilot y Antigravity las rondas son turnos del chat con preguntas cerradas, sin Plan mode.
- **Fixture de sondas:** `scripts/baseline-fixture.js --stage 5`, una tanda de tres epics (uno regulatorio, uno independiente y uno que depende del primero) con una pregunta que una RN ya responde, una respuesta que abre una decisión de segundo orden, otra que choca con un ADR, una decisión nueva al refrescar y una premisa falsa verificable en el código.
- **Docs:** `docs/review-stage-guide.md` (nuevo); `docs/build-faq.md`, `docs/execution-flows.md` (§3.1, §3.7, §3.8), addendum §9 de `docs/spec-planning-gate-design.md`, `docs/framework-roadmap.md` (ítems 68-71 y 73), `docs/native-integration-guide.md`, guías de Copilot y Antigravity.
- **Sondas** (`docs/review-stage-baseline.md`): RED contra v2.2.2 y GREEN contra v2.3 del coordinador (pregunta ya respondida, decisión nueva a mitad de la cola, sesión cortada, "usá la recomendada") y el pipeline completo sobre la etapa 5: el validador `MODE: REVIEW` marcó la premisa plantada `FALSA` en `path:línea` y encontró otras tres reales; la respuesta contra ADR-002 volvió como `LATE` y la de "30 días" abrió una derivada. Las sondas encontraron y se corrigieron, entre otros, un defecto de gramática del registro (premisas `NO VERIFICABLE` y preguntas compartidas por dos epics) y un borrador que se bloqueaba por un hueco del contrato en vez de preguntarlo.
- Tests: 302 (268 → 302: `review.js`, huella de alcance y bloque del epic, `spec-set-check --draft --batch`, doctor de la revisión, métricas por tanda, fixture etapa 5).

**Lo que este release deliberadamente NO envió:** el **coordinador por epic en subagente** (ítem 72, v2.4.0 condicional): el refresco, el sello, el epic-agent y el loop de supersesiones siguen en el coordinador principal. Se construye solo si, tras v2.3.0, hay ≥2 tandas de N≥3 que obligaron a reiniciar la sesión, o un contexto del coordinador de más de ~400k tokens antes del epic 3. Tampoco entra Plan mode como puerta de lanzamiento de la ejecución: el cierre es una pregunta en el chat.

**Migración para proyectos existentes:** ninguna de contenido. `/specture:doctor migrate` registra el `schema_version`. Los registros de revisión se crean solos: el próximo `/specture:build` abre el primero en `docs/05-specs/_reviews/` para la tanda que elijas. Un epic `[/]` se termina (o se aparca) antes de abrir una revisión, y un epic que no pasó por una revisión sigue por el gate por epic, sin cambios.

**Backward-compat:** cambios de esquema aditivos: la plantilla nueva entra al manifiesto y la línea `**Aparcado:**` del ROADMAP es opcional. Los tokens `DRAFT_*` no cuentan como `MECH_CHECK` para sellar, así que las líneas `MECH_CHECK: PASS` existentes siguen valiendo, y `spec-set-check` sin `--draft` se comporta como antes. Los campos nuevos de `build-metrics.jsonl` son aditivos; las cifras de revisión en una línea sin `batch_id` no se cuentan, y la lectura lo dice. Un proyecto sin `_reviews/` ni líneas `Aparcado` no ve ningún chequeo nuevo del doctor. El gate por epic, con su modo revisión a pedido, sigue igual para los epics que no pasan por una revisión.

### v2.2.2 — El gate desde cero en una ronda, y un red-fix que no desarma lo que ya funciona

**Motivación:** HC-IHCE.6 de Psikora fue el primer gate completo bajo v2.2: **una ronda**, 4 preguntas en una sola sentada, ningún APROBADO reabierto, y el epic cerrado con 104 tests viejos supersedidos sin una regresión. Las dos preguntas que quedaron en la ejecución las provocó el propio procedimiento: la regla de v2.2.1 de revertir toda la producción para corregir un test del RED (el coordinador ofreció una "corrección puntual" y el usuario la eligió) y la regla de "un loop por capa", que obligó a pedir permiso para reescribir tests que el reviewer había marcado como débiles. Y apareció un defecto mecánico nuevo del C-sup.

**Cambios:**
- **Red-fix y loop de corrección puntuales, sin revert.** Los tests del RED que hay que corregir —por un defecto mecánico o porque el spec cambió— se abren con `seal-cli supersede --shared-with-red` y el test-writer, en el nuevo `MODE: RED-FIX`, reescribe **solo** los de los IDs afectados en un commit `test(red-fix)` registrado por SHA. La producción que ya pasa no se toca y ya no hace falta `unseal-spec`. La honestidad la prueban tres controles: `honesty-check red-lines --epic-dir` exige que el resto del RED original sobreviva y toma las líneas del red-fix como el contrato nuevo; un **RED retroactivo** en `<red_sha_orig>^` —el código sin este spec— exige que los tests corregidos fallen allí; y la Dim 4 del reviewer lee cada red-fix contra el spec. El loop de corrección usa `lift-spec` para liberar solo el spec y termina en ese mismo red-fix (`RESUME_AT: red-fix`, EPIC_LOOP Step 5.3). Reemplaza el "revertir el RED y la producción y restaurar" de v2.2.1.
- **La reescritura que pide el reviewer no es un loop nuevo.** Si el reviewer marca una reescritura del loop o de un red-fix como más débil que su regla (por ejemplo, una mutación que el test no detecta), el epic-agent la devuelve al test-writer con el hallazgo textual, la registra igual que la primera y re-revisa: cuenta para el tope de iteraciones, no pregunta nada.
- **C-sup con dos specs sobre el mismo test.** Cuando dos specs del mismo epic supersiden el mismo test viejo, el chequeo tomaba la primera fila `sup:` y daba un BLOCKER falso al segundo ("la tabla la asigna a …"); ahora busca la fila del propio spec. En HC-IHCE.6 hizo fallar tres corridas del chequeo mecánico.
- **Docs:** `docs/tdd-honesty-reference.md` (clasificación y opciones de recuperación), `docs/execution-flows.md`, `docs/native-integration-guide.md`, `hooks/README.md`, `docs/build-faq.md`.
- Tests: 268 (266 → 268: `red-lines` con red-fix registrado, C-sup con dos specs sobre el mismo test).

**Migración para proyectos existentes:** ninguna. `/specture:doctor migrate` registra el `schema_version`.

**Backward-compat:** sin cambios de esquema. `red-lines` sin `--epic-dir` se comporta como antes. Las reglas de permisos de v2.2.1 siguen valiendo; `unseal-spec` sigue existiendo para uso manual.

### v2.2.1 — Lo que la primera medición real encontró

**Motivación:** HC-IHCE.5 de Psikora, el epic que se había atascado un día entero en el gate bajo v2.1, se cerró con v2.2.0: el gate reanudado aprobó en **una** ronda delta y el epic llegó a `[x]` con 197 tests viejos supersedidos en 3 loops. La medición dejó tres fricciones reales y una métrica mal definida, todas de la ejecución.

**Cambios:**
- **C-sup ya no falla después de aplicar una supersesión.** El chequeo literal de v2.2.0 exigía que el nombre del test siguiera en el archivo aun cuando el loop ya lo había reescrito, renombrado o retirado: en HC-IHCE.5, `spec-set-check` en HEAD daba `MECH_CHECK: FAIL` y el paso 4a del loop solo pasó desde un worktree anterior. Ahora una línea `Supersede:` cuyo registro en `## SUPERSESIONES` ya tiene el SHA del commit no se vuelve a verificar en disco; `commit: pendiente` y `sin cambio` siguen exigiendo el nombre.
- **Red-fix por el coordinador, nunca por el epic-agent.** Un test del RED con un defecto **mecánico** (no compila o no carga, o su preparación contradice una premisa que el spec declara) sale como `BLOCKED: red-fix <spec>`; el coordinador desella, re-sella y revierte, sin planner y sin preguntar. Un desacuerdo sobre *qué* afirma el test sigue siendo `BLOCKED: spec`. El epic-agent ya no corre `unseal-spec` ni `release` a mitad del epic.
- **El loop de corrección revierte el RED y la producción del spec, y la restaura después del RED nuevo.** Es lo que hizo el coordinador en HC-IHCE.5 por su cuenta —y lo correcto: con la implementación presente, algunos tests nuevos pasarían en el commit RED y el test-writer los descartaría—; ahora está escrito, con un bloque `REVERTED_PROD:` en la reanudación y `merge-spec --reset-orig` para el RED nuevo.
- **Permisos en modo auto.** El clasificador del modo auto negó dos veces `seal-cli.js unseal-spec` a un subagente ("Security Test Removal") y cada negación fue una pregunta para ti. `hooks/README.md` § Permisos documenta las reglas estrechas de `permissions.allow` para los scripts de Specture (con el comodín pegado a `.js`, porque la ruta va entre comillas) y la entrada `autoMode.allow` de `~/.claude/settings.json`, el único lugar donde el clasificador la lee. Nuevo INFO del doctor `specture-script-permissions` cuando el build ya corrió y no hay ninguna. Specture nunca escribe tu configuración de permisos.
- **`planner_redispatch_after_approved` bien definida:** cuenta solo re-despachos del gate causados por un WARNING o NOTE de un APROBADO; los loops de corrección, red-fix y supersesiones nacidos en ejecución van a `planner_dispatches_loop`. En HC-IHCE.5 marcó 1 por un loop de corrección legítimo.
- **Docs:** `docs/build-faq.md` ("¿Por qué el build me pidió autorizar `unseal-spec`?"), `docs/tdd-honesty-reference.md` (red-fix y loop de corrección), `docs/execution-flows.md` (rama de red-fix).
- Tests: 266 (264 → 266: C-sup sobre supersesiones aplicadas, `specture-script-permissions`).

**Migración para proyectos existentes:** ninguna. `/specture:doctor migrate` registra el `schema_version`; si `check` muestra `specture-script-permissions`, agrega las reglas de `hooks/README.md` § Permisos.

**Backward-compat:** sin cambios de esquema ni de gramática. Un `_planning.md` sin registro `## SUPERSESIONES` se comporta como en v2.2.0.

### v2.2.0 — Desbloqueo: el gate converge y la ejecución resuelve sola los tests viejos

**Motivación:** en Psikora, el Epic HC-IHCE.5 pasó 427 minutos en el Spec Planning Gate sin sellar un solo spec: 14 contactos humanos, el 51 % del tiempo esperando al usuario, y 3 de sus 4 rechazos por "faltan supersesiones" — la lista de tests de epics cerrados que el spec rompe, que el planner no puede ver porque no lee código. En HC-IHCE.3/.4 el gate acertó solo el 30 % de esas supersesiones; la ejecución encontró el resto en minutos. Y 10 de las 14 observaciones de veredictos **aprobados** se volvieron trabajo o preguntas nuevas. El gate no tenía punto fijo: intentaba adelantar un dato que la suite da exacto y barato. Evidencia y diseño: `docs/spec-gate-convergence-design.md` (fase 1); preguntas frecuentes para el usuario: [`docs/build-faq.md`](docs/build-faq.md).

**Cambios:**
- **Un solo presupuesto humano por gate.** Como mucho **2 rondas** de preguntas (≤4 por ronda, 2-4 opciones, una recomendada) **vengan de donde vengan**: dudas del planner, dudas de contrato de la validación, tamaño del epic. Las opciones son las del planner tal cual, cada una con las decisiones que abriría (`derivadas:`), para que la segunda ronda sea opcional. Una respuesta que cambia una regla se edita en su sitio y se commitea antes del siguiente pase. Una duda de contrato que sigue abierta tras la ronda 2 te ofrece un `discover` acotado, nunca una tercera ronda.
- **APROBADO avanza.** Un veredicto `APPROVED` nunca se re-valida, re-planifica ni se vuelve pregunta por sus WARNING o NOTES: cada observación va a un destino cerrado — `## GATE_NOTES` de `_planning.md` (las leen implementer, ux-implementer y reviewer; nunca el test-writer) o `## DIFERIDOS` más una línea `**Diferidos heredados:**` en el epic **dueño** del ROADMAP, cuyo propio gate la recibe. Un caso límite de dinero, legal o datos personales en las operaciones del propio epic nunca se difiere. El resumen antes del commit de specs lista las `GATE_NOTES` y los Diferidos.
- **Validación por rondas y re-validación delta.** Una ronda es el conjunto de despachos del validador que salen juntos (los paralelos cuentan uno). Tras un rechazo, el validador recibe su veredicto previo y el diff de los specs y de las fuentes (`MODE: DELTA`): cada hallazgo previo sale `ADDRESSED`, `NOT ADDRESSED` o `RETIRADO`, y un BLOCKER nuevo solo puede estar sobre el diff o ser un hallazgo tardío acotado (uno por epic). El estado queda en `.specture/state/gate/<epic>/` para reanudar.
- **Tope por rondas con menú cerrado.** Tres rondas sin aprobar (los FAIL del chequeo mecánico 4a no cuentan) terminan en **una** pregunta cerrada con opciones según el tipo de BLOCKER vivo: enmendar el ADR o cumplirlo al pie de la letra, `BLOCKED: contrato`, un `discover` acotado o elegir entre dos reglas, partir el epic, pausarlo. "Sellar con riesgo declarado" solo aparece para defectos de forma y nunca es la recomendada. El mismo FAIL de 4a tres pases seguidos es `BLOCKED: gate` (defecto del framework).
- **Validador y planner acotados.** El `architecture-validator` corre con `tools: Read, Glob` (sin Bash ni Grep) y `effort: medium`, juzga solo lo que el autor del spec puede ver (ADR, reglas, contrato, RN, contradicciones internas, dueños del Fuera de Scope) y deja de exigir la lista completa de supersesiones: una sospecha va, como mucho, en una línea `sup-candidato:` de NOTES. Cada WARNING trae un `destino-sugerido`. El `spec-planner` corre con `effort: medium`, en un **despacho fresco por pase** con `ALCANCE` (nunca se reanuda: uno reanudado llegó a 941k tokens de contexto) y declara solo las supersesiones de comportamiento que las fuentes muestran. Un re-despacho exige al menos un BLOCKER o una respuesta tuya. El chequeo C-sup de 4a verifica ahora que el nombre del test aparezca literal en su archivo.
- **Ejecución por capas y línea base de fallos.** Antes del primer RED el epic-agent corre la suite completa; lo que ya fallaba queda en `## BASELINE_FALLOS`: no bloquea el `[x]`, pero se reporta. Si la suite ni compila por tests viejos que una regla del spec rompe, el implementer commitea su trabajo como WIP y reporta `BLOCKED: supersesiones (compilación)` **sin tocar ningún test**; después de GREEN, cada fallo fuera de su RED se re-corre (flakes) y se clasifica, y una aserción rota es regresión suya salvo que cite la regla del spec que la vuelve falsa. Nunca dobla producción contra una regla.
- **Loop de supersesiones, sin revert ni preguntas.** El coordinador: un validador fresco juzga cada test con el dato (`MODE: J9`: ¿una regla de este spec vuelve falsa la expectativa vieja?) → `seal-cli.js lift-spec` libera solo ese spec → un planner fresco (`MODE: SUPERSESSIONS`) escribe las líneas `Supersede:` → `honesty-check.js spec-delta` comprueba que el spec cambió solo en esa sección (si no, loop de corrección completo con re-RED) → `honesty-check.js protected` saca los tests de un `verify:` de `rules.yml` o de un GUARD de otro epic (esos te los escala: enmendar una invariante es decisión tuya) → 4a → commit y re-sello. El epic-agent se reanuda: el test-writer reescribe **a ciegas** (`MODE: SUPERSEDE-HEAD`, nunca ve los valores que devuelve el código) en un commit `test(supersede): … — loop <capa>` registrado por SHA; `red-lines` prueba que el RED original sigue intacto, y un **RED retroactivo** exige que las aserciones reescritas fallen en el commit que bloqueó el epic (`LOCK_SHA`) y pasen en HEAD. Los tests con J9 `NO` o `INDETERMINABLE` vuelven al implementer como regresión. Un loop por spec y por capa; el segundo se escala. En el historial aparecen dos commits nuevos: `docs(specs): supersesiones <epic>/<spec> — loop <capa>` y `test(supersede): … — loop <capa>` **después** del RED.
- **Step 5.5 como lista blanca.** El TDD Honesty Gate pasa de `git diff RED_SHA..HEAD` a `hooks/lib/honesty-check.js` `clean-tree` · `range` · `red-lines`: todo commit que toca tests después del primer RED de un spec (`red_sha_orig`, que ya nunca se mueve) tiene que estar registrado en `## SUPERSESIONES` con exactamente sus archivos. Sin node queda el `git diff`, y un hunk solo pasa si su commit está registrado. El `code-reviewer` lee cada reescritura contra su regla: una más débil que la regla es BLOCKER.
- **Sello.** `seal-cli.js` gana `lift-spec`; `unseal-spec` ahora también libera el archivo del spec (antes el hook seguía denegando la edición del planner en el loop de corrección); `write --lock-sha` conserva íntegras las entradas `specs[]`; `merge-spec` preserva `red_sha_orig` (`--reset-orig`, `--add-test-paths`); `supersede --slug` rechaza un archivo del RED de un spec salvo `--shared-with-red`; un flag desconocido es error de uso. Campos nuevos: `lock_sha`, `lifted_spec_paths`, `supersede_for` y `red_sha_orig` por spec. El commit que marca el epic `[/]` queda registrado como `LOCK_SHA` en `_planning.md`.
- **`BLOCKED: debug` y `BLOCKED: entorno`.** Al llegar al Iteration Cap el epic-agent reporta `BLOCKED: debug <spec>` y **nunca** invoca `debug`: esa skill necesita Plan mode y dejaría la cola esperando una aprobación que nadie puede dar; el coordinador te ofrece `/specture:debug`. Un `BLOCKED: supersesiones` ya clasificado no dispara `debug` (excepción explícita en `debug` y en `start`). Una suite que no puede correr es `BLOCKED: entorno`, con el log. Con N > 1, la captura de aprendizajes (Step 8.5) se ofrece una sola vez al drenar la cola.
- **Checkpoint declarado.** El coordinador ya no promete un contexto O(n_epics): todo lo que importa vive en disco (ROADMAP, `_planning.md`, sello, `.specture/state/gate/`, métricas), así que después de cualquier epic puedes cerrar la sesión y seguir con `/specture:start`.
- **`modernize`:** en un epic de migración el juicio J9 acepta `AC-n` o `GAP-nnn` como regla, y los characterization tests nunca entran al loop salvo que el spec declare el `GAP-nnn` que retira ese comportamiento.
- **Métricas nuevas en `/specture:knowledge stats`:** `gate_rounds`, `gate_human_contacts`, `exec_human_contacts`, `planner_redispatch_after_approved` (debe quedar en 0), despachos de validador y planner de gate vs de loop, `supersede_loops`, `supersede_tests`, `j9_regressions`, `exec_blocked_compile`, `exec_blocked_runtime`, `baseline_failures`, `late_findings` y `effort`; reglas de lectura nuevas y columnas `rnd` y `sup-loop`. Los encabezados de `## VEREDICTOS` llevan ronda, hora con zona, `tree` y `head`; los viejos siguen parseando.
- **Doctor:** `gate-legacy-rejection` (WARNING — epic `[/]` rechazado por supersesiones con la versión anterior), `claude-md-gate-overrides` (INFO — el bloque temporal de instrucciones del gate sigue en el `CLAUDE.md` del proyecto) y `seal-lifted` (WARNING — un spec quedó liberado del sello por un loop interrumpido).
- **Plantillas (cambios aditivos):** `PLANNING_TEMPLATE.md` (encabezado de veredictos, `GATE_NOTES`, `DIFERIDOS`, `BASELINE_FALLOS`, `LOCK_SHA`, registro de supersesiones con `loop`/`j9`/`acción`), `ROADMAP_TEMPLATE.md` (`**Diferidos heredados:**`), `SPEC_TEMPLATE.md` (los dos caminos de una supersesión), `MIGRATION_SPEC_TEMPLATE.md` (motivo `AC-n | GAP-nnn`).
- **Plataformas:** espejos Copilot regenerados. Ni los espejos de Copilot ni el `define_subagent` de Antigravity trasladan `tools` ni `effort`: en esas plataformas el validador no queda limitado a `Read`/`Glob` y conviene fijar el esfuerzo de la sesión en *medium* para `/specture:build` (`docs/copilot-cli-plugin.md`, `docs/antigravity-cli-plugin.md`). Las preguntas del gate siguen siendo preguntas cerradas en el chat.
- **Docs:** `docs/build-faq.md` (nuevo); `docs/tdd-honesty-reference.md` § "Supersessions discovered in execution", con salvaguardas y riesgo residual; addendum §8 de `docs/spec-planning-gate-design.md` (D5, D8, D22); `docs/execution-flows.md`, `docs/native-integration-guide.md`, guías de Copilot y Antigravity; Milestone 8 en `docs/framework-roadmap.md`; "Probes de release" en `docs/release-process.md` (fixture `scripts/baseline-fixture.js --stage 4`, resultado en `docs/gate-convergence-baseline.md`).
- **Probes de release corridos** (`docs/gate-convergence-baseline.md`, RED contra v2.1.0 y GREEN contra esta versión): el clon de la contradicción con un ADR bloquea **3/3** (condición de release cumplida: el validador sale en `effort: medium`), los defectos de nivel proyecto **2/2**, sin regresión en AC contra AC; v2.1.0 invocaba `debug` desde la cola y escalaba al usuario un test viejo roto por diseño, v2.2.0 no. Límite dicho en el baseline: fuera del plugin el esfuerzo y las herramientas del frontmatter no se imponen, así que las sondas prueban las definiciones; el efecto de `medium` se mide con datos reales.
- **La etapa de revisión de v2.3.0 queda decidida con datos:** el experimento "ronda 2" (`docs/milestone-decision-stage-simulation.md` §7) mostró que la revisión en dos rondas captura lo que nace de tus respuestas pero no lo que solo aparece con el spec escrito en detalle, así que v2.3.0 suma una mini-revisión anunciada antes de cada epic regulatorio (variante B2).
- Tests: 264 (211 → 264: parsers de planning, C-sup literal, métricas de rondas y loops, doctor del gate, sello v2.2 y `lift-spec`, `honesty-check` con repos git temporales, fixture etapa 4).

**Lo que este release deliberadamente NO envió:** la validación borrador en segundo plano mientras respondes, los chequeos mecánicos de citas, IDs y congelamiento de alcance (C7m, C-ids, C-freeze), la delegación ofrecida al armar la tanda y las notificaciones, y el modo ADAPT del test-writer. La **etapa de revisión por tanda** —una sola sentada de decisiones antes de ejecutar— es v2.3.0 (`docs/milestone-planning-stage-analysis.md`).

**Migración para proyectos existentes:**
1. `/specture:doctor migrate` — registra el `schema_version` (el doctor lo pide con `schema-version-behind`). No hay migración de contenido: los cambios de plantilla son aditivos y los parsers aceptan que falten las secciones nuevas.
2. **Epics `[/]` a medio planificar:** `/specture:doctor check` señala con `gate-legacy-rejection` los que quedaron rechazados por supersesiones con la versión anterior. Al retomarlos con `/specture:start`, `build` re-valida ese target en modo delta y esos hallazgos quedan `RETIRADO`.
3. **Retira del `CLAUDE.md` del proyecto** cualquier bloque temporal de instrucciones del Spec Planning Gate que hayas agregado para v2.1: v2.2.0 lo incorpora, y el doctor lo señala (`claude-md-gate-overrides`).

**Backward-compat:** la gramática de los specs no cambia (`Supersede:`, las filas `sup:` y `## SUPERSESIONES` siguen iguales; el motivo acepta además `AC-n`/`GAP-nnn` y `acción:` es opcional) y el hash de `MECH_CHECK` tampoco, así que las líneas `MECH_CHECK: PASS` existentes siguen valiendo. Los encabezados de veredicto viejos siguen parseando y la reanudación acepta ambos formatos; las líneas viejas de `build-metrics.jsonl` se siguen leyendo (los campos son aditivos). Un sello escrito por la versión anterior sigue sirviendo: sin `red_sha_orig`, el chequeo usa `red_sha`. Las supersesiones declaradas en el gate se aplican como antes, en un commit previo al RED. Lo que cambia de verdad es que un test de un epic cerrado **puede** modificarse después del RED — solo en un commit del loop registrado por SHA, con J9 `SÍ` y revisión independiente. Riesgo residual, dicho sin rodeos en `docs/tdd-honesty-reference.md`: un J9 y un reviewer que acepten a la vez una lectura demasiado generosa de una regla.

### v2.1.0 — Migrar sin conocer el interior, y un gate de marca que dejó de pasar en vacío

**Motivación:** al simular `doctor migrate --apply` contra una copia real de CEAgenda —44 documentos de componente, 46 citas— aparecieron defectos que ninguna prueba en seco había ejercido. Y al preguntarse *"¿cómo hace esto un usuario que no conoce el funcionamiento interno?"* aparecieron tres huecos más, uno de ellos serio. Lo que **sí** funcionaba y no se tocó: `start` anuncia las migraciones pendientes antes de enrutar y ofrece correr el doctor; `check` sigue reportando las diferidas en cada corrida; las de contenido cierran solas porque su `detect` mira el contenido.

**El gate de procedencia de marca pasaba en vacío — el hallazgo que justifica este release.** La regla decía: *contá los campos `MK-001`…`MK-005` que digan `sin definir`; si hay 2 o más, no podés escribir `design_system.md`*. En un proyecto **sin** la sección `## Identidad de Marca` —todos los creados antes de v2.0.0— la cuenta da **cero**, el gate pasa, y el agente escribe el design system con su propio gusto. Era exactamente el fallo que el rediseño de v2.0.0 existe para impedir, abierto justo en el único caso que importa. Una sección ausente no es "cero campos indefinidos": es la forma más fuerte de no tener marca, porque a nadie se le preguntó nunca. Ahora se evalúa **antes** del conteo y bloquea.

**Consecuencia directa, y es intencional:** un proyecto existente **no puede correr `/specture:ux-design`** hasta capturar la marca. Son cinco preguntas.

**Cambios:**
- **`discover` gana modo sólo-marca (`/specture:discover --marca`).** `2.0-brand-brief` nombraba dueña a `discover`, cuya propia descripción dice que se invoca *"whenever `business_requirements.md` does not yet exist"*: en un proyecto existente nunca se vuelve a entrar ahí, así que el puntero del doctor no llevaba a ninguna parte. El modo nuevo corre **sólo** las cinco preguntas `MK` que ya estaban escritas, escribe la sección en el documento existente, no toca nada más y registra el cierre con `migrate --verify 2.0-brand-brief --by "discover"`. No re-abre el cuestionario: re-preguntar lo ya levantado es como un usuario aprende a saltarse una skill.
- **`ux-design` recoge su propia migración.** No sabía que era dueña de `2.0-design-system-layers` (`grep -c migrat` daba **0**, contra **5** en `knowledge`), y su `## When NOT to use` rebotaba a `build` justo el proyecto pre-2.0 que hay que reparar. Ahora el Step 4 detecta la ausencia de capa semántica, la reconstruye **con el usuario** sobre los primitivos que ya existen, y cierra con `migrate --verify … --by`, copiando el patrón que `knowledge` estableció en v1.19.0 en vez de inventar otro.
- **`design-lint contrast` dice por qué no puede computar nada.** Sobre un sistema sin capa semántica emitía **ocho** BLOCKERs que enumeraban el mismo hecho ocho veces sin nombrar la causa. Cuando **ninguno** de los tokens obligatorios está declarado, colapsa a **uno** que nombra `2.0-design-system-layers` y el comando que lo resuelve. Con capa **parcial** la enumeración por token es exactamente la respuesta correcta y **no cambia**. La causa se computa del propio texto —el mismo test que corre la migración—, así que el linter no queda acoplado al catálogo.
- **`handoff-residue` (WARNING) en el doctor.** El `git rm -r` del andamiaje del handoff se decía **una vez**, en la salida de la corrida que aplicó `2.0-design-spine`, y nunca más: su `verify()` no mira el andamiaje, así que la migración queda `done` con los ficheros intactos. Calcado de `worktree-residue`. **Sólo dispara una vez existe la espina** — antes de migrar, el espejo es la única copia de trabajo medido de un DOM vivo que ningún canal devuelve, y mandar a borrarlo ahí lo destruiría; ese guard tiene su propio test.
- **El catálogo da el comando, no el nombre de una skill.** `ownerSkill` de las dos migraciones de contenido de v2.0.0 pasa a `/specture:discover --marca` y `/specture:ux-design`, con lo que va a pedir cada una. Un nombre de skill es algo que el usuario tiene que traducir; el string se lee tal cual en `content-migration-deferred`.
- **`2.0-design-spine` — tres bugs, uno grave (arrastrado de v2.0.0).** (i) **Reescribía historia inmutable**: el barrido de citas tomaba cualquier `.md` bajo `docs/`, y en CEAgenda editó dos reviews de julio y cuatro specs de un epic cerrado — un review fechado 2026-07-13 pasaba a citar un archivo que en julio no existía. Ahora sólo reescribe documentos **vivos**, con el mismo `isLivingDoc` que usa el corpus lint, que además ya los ignoraba. (ii) **Producía citas malformadas**: el andamiaje se sustituía por *prosa*, así que `handoff-mapping.md:77-78` quedaba `design_system.md §3 (inventario):77-78` y `handoff-mapping.md §3` quedaba con la sección dos veces; ahora se sustituye por una **ruta** y el destino semántico se dice en las notas. (iii) **`verify` era insatisfacible**: rechazaba cualquier cadena con forma de ruta vieja, incluido un glob `*.reference.md` que `apply` no puede reescribir por no tener destino único; ahora comprueba sólo las rutas que la migración movió.
- Tests: 211 (209 → 211, más tres del fix de la espina).

**Migración para proyectos existentes:** ninguna nueva. Este release no cambia el esquema del proyecto — nada tocó la sección `## Required Inputs` de ningún skill, que es lo único de un skill que el manifiesto de esquema vigila. Lo que cambia es cómo el framework **acompaña** las migraciones que v2.0.0 ya había definido.

**Backward-compat:** un proyecto sin frontend no ve nada de este release. `handoff-residue` sólo aparece después de aplicar `2.0-design-spine`, así que hoy no dispara en ningún proyecto real. La salida de `design-lint contrast` cambia **sólo** en el caso de capa semántica totalmente ausente, que ya era FAIL y no tenía token `PASS` pegado en ningún documento. Lo único que se endurece de verdad es el gate de marca: un proyecto con `design_system.md` ya escrito no se ve afectado —`ux-design` no se re-corre para eso—, pero uno que entre a Fase 3 sin `## Identidad de Marca` ahora para, y eso es el arreglo, no un efecto colateral.

### v2.0.0 — Rediseño del flujo de frontend, sin handoff, y núcleo de invariantes obligatorias

**Motivación:** es la Milestone 7 de `docs/framework-roadmap.md` (ítems 43-52) más el núcleo de reglas que el usuario pidió antes de cerrarla. El punto de partida lo describe `docs/frontend-design-track-design.md`: el trabajo con una herramienta de diseño externa exigía exportar un handoff y **replicarlo a mano**, doble trabajo que las herramientas nativas ya volvieron innecesario; la skill `ux-design` producía diseños genéricos; y la Fase 03 no forzaba ninguna decisión estética humana, así que el gusto del agente entraba por la puerta de atrás. Una auditoría del rediseño encontró además tres cosas rotas de antes: el gate de aprobación visual era **inejecutable** (vivía en el archivo de un subagente no interactivo al que se le ordenaba marcar `[x]` antes de reportar), no existía `NAVIGATION_MAP_TEMPLATE.md` pese a que varias skills mandaban "seguir la gramática", y `BRAND_BRIEF_TEMPLATE.md` y los dos linters existían sin que **ninguna skill los citara**.

**BREAKING — se elimina `/specture:handoff-ingest`.** Sin alias de compatibilidad: el comando y su skill desaparecen. El formato al que estaba clavada cambió tres veces en cuatro meses y ningún nivel vivo del nuevo flujo lo necesita. Sus cuatro reglas que sí valían sobreviven en `skills/ux-design/CHANNELS.md`. Quien lo invoque verá "comando desconocido"; nada se rompe en disco y `/specture:doctor migrate` reescribe los archivos y las citas.

**Cambios:**
- **Gate de aprobación visual reparado (ítem 43):** el epic-agent construye el showcase y reporta `DONE: pendiente de aprobación visual` (sub-forma, sin cuarto estado terminal); el **coordinador** —que sí habla con el usuario— corre el gate y escribe `VISUAL_APPROVAL: <sha>` en `_planning.md`. Era el único gate del framework sin artefacto durable. Un epic de fundación capa la tanda a N=1.
- **`Tipo:` de epic y orden design-system → páginas (ítem 44):** `spec-set-check.js` C-design bloquea un epic `Tipo: pagina` cuyo epic `Tipo: design-system` no registre `VISUAL_APPROVAL`. Se ancla en el registro de aprobación y **nunca** en el checkbox, porque el epic-agent escribe su propio `[x]`. Opt-in por construcción: sin línea `Tipo:` todo epic es `backend` y el check no dispara — sin migración ni backfill de aprobaciones que no dejaron sha.
- **Captura de marca en la Fase 01 (ítem 45):** `discover` gana `## Identidad de Marca` con IDs `MK-nnn`. Un campo sin respuesta se escribe `sin definir` y **no lo rellena el agente**: un hueco visible es información; uno rellenado viaja como decisión del usuario.
- **Gramática canónica y plantillas de la espina (ítem 46):** `NAVIGATION_MAP_TEMPLATE.md` con una tabla de cinco columnas (`Ruta | Pantalla | Auth | Operaciones consumidas | Estados declarados`) como única fuente legible por máquina; `DESIGN_SYSTEM_TEMPLATE.md` reescrita (tres capas de token, modo oscuro **enumerado**, nivel `domain` obligatorio, gobernanza); `COMPONENT_REFERENCE_TEMPLATE.md` (un archivo por componente, con `Procedencia`) y `BRAND_BRIEF_TEMPLATE.md` partida en preguntar / proponer / restricciones duras. Ambas plantillas de diseño entran al manifiesto de esquema, que nunca las vigiló.
- **`design-lint` y `design-inventory` (ítem 47):** contraste WCAG 2.2 como gate **bloqueante** con piso de pares obligatorios —sin él itera el conjunto vacío y emite PASS sobre un sistema que no declara nada— corriendo dos veces, una por modo. El inventario se **verifica**, no se deriva: derivarlo exigía leer enums de una celda de texto libre y habría emitido inventarios vacíos en silencio; una gramática no reconocida es `UNVERIFIABLE` ruidoso, nunca un PASS vacío.
- **`ux-design` reescrita — tres niveles y gate de procedencia (ítem 48):** Claude Design por herramientas nativas · la herramienta Design de Claude Code · una skill fuerte para el resto. Escrita contra un RED de seis escenarios de presión, como exige la Ley de Hierro de `write-skill`; las seis racionalizaciones capturadas están en su tabla de Red Flags con su contra.
- **Canal por componente y frontera de confianza (ítem 49):** Design Surface Resolution — cuarta instancia del patrón resolver ("el orquestador resuelve, el agente nunca lee") — con bloque "For ux-implementer" en el Dispatch Manifest, que no existía. El material que baja por canal lo escribió otra persona y entraba directo al contexto de agentes construidos para obedecerlo: ahora va en valla explícita, y lo `medido del DOM` no lo pisa ningún pull.
- **Métricas de la Fase 03 (ítem 51):** archivo **hermano** de las de build, no el mismo: una corrida de diseño no tiene `epic`, el lector descarta toda línea sin ese campo, y si se le inventara uno el agregado falsearía la lectura del Spec Planning Gate.
- **Núcleo de invariantes obligatorias (ítem 52):** cuatro reglas que **el framework posee** y ningún proyecto puede quitar ni debilitar — `R-FILE-001` (un componente por archivo) [frontend, mobile], `R-FILE-002` (una clase o servicio exportado por archivo) [backend], `R-FILE-003` (types, interfaces, constantes y hooks fuera del archivo del componente o de la clase, en la ubicación que declara `conventions.md` §2) [all] y `R-SOLID-001` (SOLID en frontend y backend) [all]. Las tres de archivo son BLOCKER; `R-SOLID-001` es IMPORTANT **a propósito**, porque un BLOCKER que se dispara por criterio se aprende a esquivar. Se pueden **endurecer** (subir severidad, añadir tags, precisar el texto) y el proyecto puede añadir las suyas; quitar un id o bajar una severidad es ERROR del doctor (`rules-core-missing`, `rules-core-weakened`). `lintCore` compara id y severidad y **nunca el texto**: exigir igualdad literal bloquearía una traducción o adaptación legítima, y el id es lo que el reviewer cita.
- **Cambio de doctrina, explícito:** `conventions.template.md` prometía que ante un conflicto entre una convención del proyecto y una regla genérica del framework **gana la convención**. Desde v2.0.0 esa precedencia tiene una excepción: las reglas `framework-core` de `.specture/rules.yml`. Sin decirlo, el núcleo se contradecía en silencio con su propia plantilla y el primer agente que leyera esa línea habría resuelto el conflicto a favor del proyecto.
- **`conventions.md` §2 gana el mapa de ubicaciones** que `R-FILE-003` cita (componentes · types e interfaces · constantes · hooks/composables · servicios/casos de uso · tests). `sin definir` es un valor legal y **visible**: es la señal de preguntarle al equipo, nunca un hueco que el agente rellene — una ubicación inventada se vuelve una convención que nadie eligió. `setup` lo pregunta en Bootstrap, lo **propone desde el código** en Adopt y lo ofrece como cambiable en Reconfigure.
- **`code-reviewer`:** la Dimensión 3 deja de delegar el 100 % en un documento vacío y cita §2 y su mapa; SOLID entra explícito con el puntero a que su forma citable es `R-SOLID-001` en la Dimensión 7 — no se juzga dos veces. Espejos Copilot regenerados.
- Tests: 206 (137 → 206).

**Lo que este release deliberadamente NO envió:** un **gate de genericidad** — la medida por ejes se prototipó contra cinco proyectos reales y no separa las clases (el detector eligió como "primario" un token de dominio y el rojo de error: el rol vive en el nombre del token, no en el valor); se descartó entera en vez de ajustar el umbral y no se envió ni como señal, y consta por qué en `docs/frontend-design-baseline.md`. El **ledger de defaults prohibidos** sobre `design_system.md`: nueve de diez entradas no disparan en ningún proyecto real, las dos que disparan son falsos positivos y no caza el caso que motivó todo; sobrevive como `design-lint tokens` sobre código, midiendo adherencia a tokens, WARNING y nunca bloqueante. El **push código → herramienta externa**: exige un permiso durable que no se puede emitir desde un subagente.

**Migración para proyectos existentes** (`/specture:doctor migrate`, ítem 50):
- `2.0-design-channel` (mecánica) — detecta el canal de diseño desde los archivos que ya están en disco y lo registra en `stack.yml` `frontend.design_channel` (`claude-design | canvas | none`).
- `2.0-design-spine` (mecánica) — mueve los documentos a `docs/03-ux-ui/components/` y **reescribe las citas**; sin eso, un ERROR `broken-path` por cita en cada corrida (CEAgenda tenía 81 archivos citando).
- `2.0-design-metrics-tracked` (mecánica) — negación en `.gitignore` para `design-metrics.jsonl`.
- `2.0-rules-core` (mecánica) — repone los ids del núcleo que falten y sube a su piso las severidades debilitadas, **en su sitio** y sin reescribir el texto de ninguna regla; comentarios, orden y reglas propias sobreviven byte a byte, y `rules: []` se convierte en `rules:` en vez de producir YAML roto. Es `n/a` mientras no exista `rules.yml` (lo crea `1.19-rules-file` desde la plantilla, núcleo incluido) y cuando el archivo no parsea.
- `2.0-file-org-conventions` (asistida) — el mapa de §2, por Plan mode: `planInputs` entrega §2 tal como está, la tabla canónica y las carpetas que el repo tiene por slot. Es **evidencia, jamás respuesta**; un slot que el usuario no confirme queda `sin definir`.
- `2.0-brand-brief` y `2.0-design-system-layers` (contenido) — las levanta `discover` y `ux-design`; nunca se aplican automáticamente, porque el arreglo es una conversación y no una transformación de texto.

Probadas en seco contra los cinco proyectos reales. Psikora —el único con `rules.yml`— pasa `pending → done` conservando sus diez reglas delante y el núcleo detrás; los otros cuatro reciben el núcleo al correr `1.19-rules-file`, que ya les figura pendiente.

**Backward-compat:** un proyecto sin frontend no ve nada de este release. Sin línea `Tipo:` en el ROADMAP todo epic es `backend` y el check C-design no dispara, así que ningún ROADMAP anterior cambia de comportamiento. Sin `design-metrics.jsonl` el lector devuelve vacío. Un código adoptado **violará el núcleo el primer día**: eso es esperado y no es razón para ablandarlo — las reglas aplican de aquí en adelante y el reviewer las cita sobre lo que el diff toca; nadie está pidiendo un refactor del repo. Lo único que se rompe de verdad es `/specture:handoff-ingest`.

### v1.19.0 — Escala y madurez: verdad viva por componente, reglas de una línea, espejos generados

**Motivación:** es la Milestone 5 de `docs/framework-roadmap.md` (ítems 38-40): que un proyecto con veinte milestones cerrados y quinientas líneas de convenciones siga teniendo verdad viva, reglas cortas y paridad entre plataformas. Las tres evidencias venían de Psikora (`docs/psikora-scale-review.md`): `_current/` nunca existió y 29 análisis de impacto re-derivaron la verdad desde los specs; `conventions.md` de 518 líneas viajaba entero a cuatro workers por spec, con reglas que narraban el bug de origen; y los espejos Copilot eran resúmenes escritos a mano que el test solo verificaba por existencia.

**Cambios:**
- **`/specture:knowledge reconcile --component <slug>` (ítem 38):** backfill lazy de `docs/05-specs/_current/<slug>.md` desde los specs `[x]` que citan el componente, un componente por vez, "último gana" por `operationId`/sujeto de regla (lo superseded baja a Historial), merge incremental si el archivo existe y aprobación en Plan mode; `Confianza: ai_reconciled`. Variante **`characterize`** para componentes sin specs (Adopt, código heredado): subagente read-only sobre la "Carpeta raíz", filas `KIND | STATEMENT | path::símbolo`, `Confianza: ai_characterized`. Nuevo `hooks/lib/current-state.js` (`components` / `specs --component`: slugs de `architecture.md`, specs por `Módulo:` o por el bloque del epic, en orden de ROADMAP; un slug ambiguo se pregunta). `CURRENT_CAPABILITY_TEMPLATE.md` gana `Confianza` (`spec_reconciled` lo escribe `build` Step 8.7). Current-State Resolution, `new-feature` y el doctor (`current-state-missing` con los slugs; nuevo `current-state-partial`) nombran el comando cuando falta el archivo y nunca bloquean. Fixture `scripts/baseline-fixture.js --stage 3` y baseline `docs/knowledge-reconcile-baseline.md`.
- **Reglas de una línea + `.specture/rules.yml` (ítem 39):** las invariantes `R-*` salen de `conventions.md` §12 (que queda como puntero, igual que §10 → `settings.yml`) a `rules.yml`: `id`, `tags`, `rule` ≤ 240 caracteres sin salto, `verify`, `severity`, `source` con la historia (ADR / debug log) — nunca inline. `hooks/lib/rules-resolve.js --tags <módulo,componente,backend|frontend>` resuelve el bloque `RULES_RESOLVED` que el coordinador pega en cada dispatch ("Rules Resolution" en `build/EPIC_LOOP.md`; `--all` para los dispatches de proyecto de `architecture`); lo reciben planner, implementer/ux-implementer, reviewer (Dimensión 7 lee solo el bloque) y validator; el test-writer no. Doctor: `rules-schema` (ERROR) y `rule-length` (WARNING, también para ítems del deny-list §4 de más de 2 líneas). `knowledge capture` escribe drafts `rules.yml entry` y rechaza antes de Plan mode uno que supere el largo. `setup` copia `rules.template.yml`.
- **Espejos Copilot generados (ítem 40, cierra C-9b):** `scripts/copilot-mirrors.js` (`npm run mirrors:sync` / `mirrors:check`) genera `copilot/agents/*.agent.md` desde `agents/*/AGENT.md` con el cuerpo completo (el formato admite 30.000 caracteres; el mayor ronda 19.000), `tools` desde `compatibility-matrix.json → platformAdaptations.agentTools`, `disable-model-invocation: true` y sustituciones de plataforma (`${CLAUDE_PLUGIN_ROOT}` → `${PLUGIN_ROOT}`, `AskUserQuestion` → pregunta cerrada en chat, `EnterPlanMode`/`ExitPlanMode` → propuesta cerrada + aprobación). Se niega a truncar. El test de contrato exige paridad exacta; `code-reviewer` gana `edit` en su espejo (escribe su reporte).
- **`build`:** `templates/PLANNING_TEMPLATE.md` y `.specture/rules.yml` en sus Required Inputs (el primero, diferido desde v1.18.1); filas nuevas en Preconditions.
- **Docs:** `docs/rules-registry-design.md` y `docs/reconciliation-design.md` pasan a "implementado" con la graduación de v1.19.0; catálogo del doctor con `1.19-rules-file`; `docs/copilot-cli-plugin.md`, `docs/execution-flows.md` (Rules Resolution en el gate, cuatro modos de `knowledge`), `docs/native-integration-guide.md`, `docs/release-process.md` (`mirrors:sync` antes de `npm test`), README.
- Tests: 137 (111 → 137).

**Migración para proyectos existentes:** `1.19-rules-file` (mecánica): mueve las filas reales de `conventions.md` §12 (tabla de seis columnas o bullets `- **R-n:** …`; placeholders omitidos) a `.specture/rules.yml` y deja §12 como puntero; las reglas sin tags o severidad quedan `all` / `IMPORTANT` y las de más de 240 caracteres se anotan (el doctor las marca `rule-length`) — `/specture:doctor migrate`. El backfill de `_current/` (`1.9-current-state-init`, contenido) sigue siendo lazy y manual: `/specture:knowledge reconcile --component <slug>` por cada componente que `doctor check` liste.

**Backward-compat:** sin `rules.yml`, `RULES_RESOLVED: []` y la Dimensión 7 del reviewer es no-op, como un §12 vacío hoy; un proyecto con la tabla vieja en §12 sigue recibiendo esas reglas enteras (sin filtro por tag) hasta migrar, con aviso. Un `_current/` sin `Confianza` se lee como `spec_reconciled`. Los espejos conservan `name` y `tools` (más `edit` en `code-reviewer`); Antigravity lee `agents/*/AGENT.md` directo y no cambia. Sin cambios en el sello, los hooks ni el gate.

### v1.18.1 — Cierre de huecos de la Milestone 4

**Motivación:** una auditoría del diff `v1.17.0..v1.18.0` tras publicar la etapa 2 del gate encontró lo que quedó a medias: tres espejos Copilot sin las reglas nuevas, cuatro tests que el plan listaba y no se escribieron, strings del doctor que mandaban borrar el sello a mano, prosa obsoleta en guías y diseños (toggles "en `conventions.md` §10", "dos modos" de `knowledge`, `Steps 2-8`), el catálogo del diseño del doctor detenido en 1.15, cuerpos de ítems del roadmap contradiciendo su línea de "hecho", `actions/*@v4` con aviso de Node 20, y un fixture de baseline que solo existía en el scratchpad de una sesión. Al escribir los tests faltantes aparecieron tres bugs reales. Patch: sin cambio de comportamiento de skills ni agentes, sin cambio de esquema.

**Cambios:**

- **Tres bugs corregidos:** `hooks/lib/seal.js` — el gate Allowed Paths denegaba escrituras **fuera del proyecto** (un path que `relativize` no puede hacer relativo ya no se gobierna); `hooks/lib/doctor/checks/state.js` — `seal-mismatch` marcaba WARNING para los slugs reales `epic-X.Y-nombre` (ahora compara el id `X.Y`); `hooks/lib/doctor/project.js` — un milestone con "archivador" en el título contaba como lápida (`/archivad/` sin límite de palabra) y el doctor pedía `_current/`.
- **Espejos Copilot al día (C-9b):** `tdd-test-writer` (supersesiones declaradas, commit `test(supersede)` previo al RED, `SUPERSEDE:`), `implementer` y `ux-implementer` (escribir solo dentro de `Crea:`/`Modifica:`, `BLOCKED: spec <ID>` ante un archivo no declarado); `docs/copilot-cli-plugin.md` deja de sobreafirmar la paridad.
- **Tests que faltaban:** sello v3 aceptado/huérfano/mismatch en el doctor, stale v3 en el hook de Copilot/Antigravity, precedencia test-sellado ∩ `allowed_paths`, `relativize` dentro/igual/fuera de la raíz y path absoluto nativo, `seal-cli show`/`supersede`, lápidas del ROADMAP.
- **Doctor:** las acciones de `seal-corrupt`/`seal-stale`/`seal-mismatch` apuntan a `seal-cli.js release` (y `show`) en vez de borrar el JSON a mano; el detalle de `seal-stale` nombra tests, specs y allowed paths.
- **Telemetría:** el schema de `index-usage.jsonl` en `EPIC_LOOP.md` tenía `step: 3|6` (el Step 3 no existe desde v1.17.0) → `gate|4|6` con `spec-planner` en el enum.
- **Prosa obsoleta:** `knowledge` declara sus tres modos (frontmatter e intro); `docs/native-integration-guide.md` y `docs/execution-flows.md` §5.5 hablan de `.specture/settings.yml` y de `stats`; el README completa el árbol de `templates/` (`MIGRATION_SPEC`, `PLANNING`, `CURRENT_CAPABILITY`) y nombra la migración 1.18 en la sección del doctor; `docs/doctor-and-migrations-design.md` lista `1.16-*` y `1.18-metrics-tracked`; los cuerpos de los ítems 34/35/37 del roadmap llevan su resolución; `build/SKILL.md` gana en Preconditions la fila de **Node ≥ 22** (sin Node no hay sello ni chequeo mecánico: quedan los `git diff` y la Dim 1 del reviewer) y la de `PLANNING_TEMPLATE.md`, y la nota de la variable de raíz por plataforma (`${PLUGIN_ROOT}` / `$SPECTURE_ROOT`) para los scripts.
- **Fixture reproducible:** `scripts/baseline-fixture.js <dir> [--stage 1|2] [--git]` regenera el scratch "Archivador" de los dos baselines desde `scripts/baseline-fixture/archivador/` (`npm run baseline:fixture`); su test verifica que el doctor lo ve limpio y que los escenarios mecánicos 2/3/11 reproducen.
- **CI:** `actions/checkout` y `actions/setup-node` a `@v5` (adiós al aviso de Node 20).
- Tests: 111 (101 → 111).

**Migración para proyectos existentes:** ninguna.

**Backward-compat:** total. `templates/PLANNING_TEMPLATE.md` sigue fuera de `## Required Inputs` de `build` a propósito (esa sección está hasheada por el gate de esquema y su cambio sería minor): se documenta en Preconditions y en los pasos del gate.

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
