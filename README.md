# Specture Framework

> Una metodología de Vibe Coding para Claude Code basada en SDD (Spec-Driven Development), con configuración agnóstica al stack, agentes especializados con contexto restringido, y disciplina anti-alucinación.

Specture lleva un proyecto **desde la idea hasta el código** en 5 fases consecutivas + capacidades transversales, dispatchando agentes funcionales con contexto restringido. No replica la estructura de un equipo humano: replica las **funciones cognitivas** que la IA hace mejor cuando se le restringe el contexto. Desde v1.6.0 incluye un **contrato de API** como fuente única de verdad backend↔frontend, disciplina de diseño end-to-end (design system → showcase → aprobación → páginas), y herramientas para ingerir handoffs de diseño y auditar la sincronización back/front.

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
├── settings.json                      # Registra el TDD Honesty Gate (PreToolUse)
├── .claude-plugin/
│   └── plugin.json                    # Manifiesto del plugin
├── skills/
│   ├── start/SKILL.md                 # Router: detecta el estado y enruta
│   ├── setup/SKILL.md                 # Setup en 3 modos (bootstrap/adopt/reconfigure)
│   ├── setup-docs-bridge/SKILL.md     # Sub-skill: integra docs preexistentes en proyectos Adopt (genera docs-index.yml + bridges + ADRs Proposed)
│   ├── discover/SKILL.md              # Levantamiento socrático de negocio
│   ├── architecture/SKILL.md          # Arquitectura + contrato de API + ROADMAP
│   ├── ux-design/SKILL.md             # UX/UI: nav map + design system (siempre)
│   ├── build/SKILL.md                 # Loop spec→test→code→review + Modo Frontend
│   ├── handoff-ingest/SKILL.md        # Convierte un handoff de diseño al stack
│   ├── contract-sync-audit/SKILL.md   # Audita sync back/front en proyectos existentes
│   ├── debug/SKILL.md
│   ├── new-feature/SKILL.md
│   ├── verify/SKILL.md
│   ├── write-skill/SKILL.md
│   ├── learn/SKILL.md                 # Captura post-sesión: ADRs Proposed + entradas docs-index + patches conventions
│   ├── audit-knowledge/SKILL.md       # Auditoría periódica del docs-index.yml (orphans / duplicates / stale / uncovered)
│   └── modernize/SKILL.md
├── agents/
│   ├── specture-router/AGENT.md       # Router (opt-in: se invoca con /specture:start)
│   ├── architecture-validator/AGENT.md  # Valida planes/contrato contra .specture/
│   ├── tdd-test-writer/AGENT.md         # Escribe tests desde el spec (sin ver código)
│   ├── implementer/AGENT.md             # Implementa para pasar tests (backend/lógica)
│   ├── ux-implementer/AGENT.md          # Implementa UI: tokens, a11y, cliente tipado
│   └── code-reviewer/AGENT.md           # Review unificado (spec + arch + quality + front)
├── templates/
│   ├── project-config/                # Plantillas de .specture/ del proyecto destino
│   │   ├── stack.template.yml
│   │   ├── conventions.template.md
│   │   ├── docs-index.template.yml    # Catálogo machine-readable de docs preexistentes
│   │   └── decisions/000-template.md
│   ├── ARCHITECTURE_TEMPLATE.md
│   ├── API_CONTRACT_TEMPLATE.md
│   ├── api-contract.openapi.template.yaml
│   ├── ROADMAP_TEMPLATE.md
│   ├── SPEC_TEMPLATE.md
│   ├── DESIGN_SYSTEM_TEMPLATE.md
│   ├── DEBUG_LOG_TEMPLATE.md
│   └── LEARN_OUTPUT_TEMPLATE.md       # Reporte humano-legible de /specture:learn (opt-in)
└── docs/
    └── original-vision.md             # Visión y requisitos originales del framework
```

---

## Las 5 Fases

| # | Skill | Slash command | Cuándo se activa | Output |
|---|-------|--------------|------------------|--------|
| **0** | `setup` | `/specture:setup` | Sin `.specture/stack.yml` | `.specture/` poblado + `CLAUDE.md` del proyecto |
| **1** | `discover` | `/specture:discover` | Sin `docs/01-requirements/business_requirements.md` | Reglas de negocio, actores, edge cases |
| **2** | `architecture` | `/specture:architecture` | Sin `docs/04-roadmap/ROADMAP.md` | Arquitectura + **contrato de API (OpenAPI + doc legible)** + ROADMAP de milestones/epics |
| **3** | `ux-design` | `/specture:ux-design` | Frontend declarado + `docs/03-ux-ui/` incompleto | Mapa de navegación + **design system completo (siempre)** + (Ruta 1) specs para IA de diseño externa |
| **4** | `build` | `/specture:build` | ROADMAP con epics `[ ]` o `[/]` | Código testeado, revisado, verificado |

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

---

## Los 5 Agentes

Specture **no** especializa por capa técnica arbitraria (no hay un "Agente Backend" vs "Agente Frontend" partido por dónde vive el archivo — eso es falsa especialización). Especializa por **función cognitiva** con contexto restringido. `implementer` y `ux-implementer` no son "backend vs frontend por capa": son dos funciones cognitivas distintas — *hacer pasar tests de lógica* vs *renderizar con fidelidad al design system, accesibilidad y cliente tipado*. La calidad visual y la adherencia a tokens son una lente cognitiva que el implementer genérico (optimizado para TDD de lógica) no tiene.

| Agente | Función | Contexto que recibe | Contexto que NO recibe |
|--------|---------|---------------------|-------------------------|
| `architecture-validator` | Validar que plan/spec/**contrato** respeta stack, ADRs y el contrato de API | Documento + `.specture/` (+ contrato si aplica) | Código de implementación |
| `tdd-test-writer` | Escribir tests desde el spec | Spec + business rules + testing framework | Código de implementación (anti-bias crítico) |
| `implementer` | Hacer que los tests pasen (lógica/backend) | Spec + tests + archivos a tocar | Conversación entera, archivos no relevantes |
| `ux-implementer` | Implementar UI con fidelidad al design system | Spec + design system + slice del contrato + tests + checklist de marca | URLs a mano, valores hardcodeados, código no relacionado |
| `code-reviewer` | Review unificado (spec + arch + quality + TDD + **frontend**) | Diff + spec + `.specture/` (+ design system/contrato en epics de UI) | Sugerir fixes (solo reporta) |

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

Output: `docs/01-requirements/business_requirements.md` con reglas verificables y actores definidos.

> Úsalo cuando digas "inicia el proyecto", "levanta los requerimientos", "definamos el negocio".

---

#### `/specture:architecture`
**Diseña la arquitectura técnica, el contrato de API y genera el ROADMAP.** Fusiona tres responsabilidades: (1) produce `architecture.md` basado en el stack declarado en `stack.yml` (nunca inventa tecnología); (2) produce el **contrato de API** — `api-contract.openapi.yaml` (fuente de verdad machine-readable) + `api-contract.md` (versión legible) — que es la única fuente de verdad de la interfaz backend↔frontend, eliminando que cada lado invente sus propias URLs y shapes; (3) convierte arquitectura + contrato + requerimientos en un `ROADMAP.md` de milestones/epics con dependencias explícitas, ordenando los epics de frontend tras los de backend que implementan las operaciones que consumen. Valida cada documento con el agente `architecture-validator`.

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
**Orquesta el loop de construcción spec → test → código → review por epic.** Es el skill más denso: toma el próximo epic del ROADMAP, genera su spec, lo despacha al `architecture-validator`, luego al `tdd-test-writer` (RED commit), luego al `implementer` (GREEN), y finalmente al `code-reviewer`. Cada agente recibe solo el contexto que necesita. Incluye un **TDD Honesty Gate** que verifica con `git diff` que el implementer no modificó los tests. Marca el epic como `[x]` solo cuando el reviewer aprueba y los tests pasan.

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

### Agentes

Los agentes de Specture son subagentes con **contexto restringido** — cada uno recibe exactamente los archivos que necesita, no la conversación completa. Esto previene drift y alucinación acumulada.

---

#### `specture-router`
**Router del framework (opt-in, desde v1.5.0).** Cuando se lo invoca explícitamente, este agente inspecciona el estado real del filesystem e invoca `skills/start/SKILL.md` para enrutar a la fase correcta. **No intercepta** automáticamente las conversaciones: el routing dejó de ser automático y se activa solo a pedido.

- **Se activa:** invocando `/specture:start`, o cuando el usuario pide iniciar/continuar trabajo de Specture ("continuemos con el roadmap", "inicia el proyecto"). **Nunca automáticamente.**
- **No escribe código** — solo enruta.

---

#### `architecture-validator`
**Revisor independiente de conformidad arquitectónica.** Recibe un documento (plan, spec, o architecture.md) y lo compara contra `.specture/stack.yml`, `conventions.md`, y todos los ADRs aceptados. Devuelve `APPROVED` o `REJECTED` con las violaciones específicas (tecnología no declarada en stack, patrón prohibido, ADR ignorado, naming incorrecto).

- **Contexto que recibe:** documento candidato + `.specture/` completo.
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
**Ingeniero de implementación con contexto mínimo.** Recibe el spec, los tests fallando, y los archivos fuente relevantes (solo los que debe tocar). Escribe el código mínimo para hacer pasar los tests. Tiene prohibido modificar, saltar, o debilitar los tests recibidos — el **TDD Honesty Gate** del build loop verifica esto con `git diff`. Si algo falta para proceder, responde `NEEDS_CONTEXT` en lugar de inventar.

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
**Staff Engineer + Lead Reviewer en un solo pase.** Revisa el código implementado en cuatro dimensiones core simultáneas — (1) conformidad con el spec, (2) conformidad con arquitectura y ADRs, (3) calidad del código, (4) honestidad TDD — más dos opcionales: (5) idiomaticidad del stack vía Context7, y (6) **fidelidad de frontend** en epics de UI (adherencia a tokens, accesibilidad, adherencia al contrato, reglas de marca). No modifica código — produce un reporte estructurado.

- **Contexto que recibe:** diff del implementer + spec + `.specture/` + output de tests + sección relevante de `architecture.md` (+ design system y slice del contrato en epics de UI).
- **Output:** `APPROVED` | `REJECTED_MINOR — [lista de fixes]` | `REJECTED_MAJOR — [razón crítica]`.
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
│   └── decisions/             # ADRs versionados, nunca borrados
└── docs/
    ├── 01-requirements/
    ├── 02-architecture/
    ├── 03-ux-ui/
    ├── 04-roadmap/
    ├── 05-specs/
    ├── 06-debug-logs/
    └── 07-reviews/
```

`stack.yml` es **leído por todos los skills y agentes** antes de generar nada. Cambia el stack → cambian las decisiones, sin tocar el framework.

---

## Native Claude Code Integration (v1.2.0)

Specture v1.2.0 integra seis capacidades nativas de Claude Code para convertir las "leyes de hierro" de convención a enforcement mecánico. Todas son **opt-in**: por defecto el plugin se comporta como v1.1.0.

| Capacidad | Función |
|-----------|---------|
| Hook `PreToolUse` (TDD Honesty Gate) | Bloquea mecánicamente edits a tests durante GREEN. |
| `TaskCreate` | Lista en vivo de specs del epic activo durante `/specture:build`. |
| `Context7` MCP | Docs vigentes para `code-reviewer` (Dimension 5: idiomaticity) y `modernize` (gap analysis). |
| `Plan mode` | Gate de aprobación antes de tocar código en `debug` y `new-feature`. |
| Background tasks | Paraleliza review + linter + type-checker en el build loop. |

### Cómo activar

En `.specture/conventions.md` sección 10:

```markdown
- **hooks.enabled**: true            # activa el TDD Honesty Gate (PreToolUse)
- **context7.enabled**: true         # activa Context7 en code-reviewer y modernize
- **build.max_parallel_epics**: 3    # tope de epic-agents concurrentes en el modo paralelo de build
```

Sin esos toggles, los hooks shippean pero no actúan, y Context7 nunca se consulta. `build.max_parallel_epics` solo aplica al modo "Agentes por Epic en Paralelo (Olas)" (default 3; `1` = secuencial).

> **Cambio en v1.5.0 — routing opt-in.** El antiguo hook `SessionStart` (auto-routing al abrir Claude Code) fue **deregistrado**. Ahora se entra a Specture **solo** invocando `/specture:start` (o pidiendo iniciar/continuar). `hooks.enabled` ya únicamente controla el TDD Honesty Gate.

### Lo que vas a ver distinto

- Al abrir Claude Code en un proyecto Specture **no pasa nada automáticamente**: invocá `/specture:start` (o decí "continuemos con el roadmap") para que el router detecte la fase y enrute.
- Durante `/specture:build`, una lista visible trackea los specs del epic activo y su progreso por los pasos del loop.
- Con el modo **Agentes por Epic en Paralelo (Olas)**, varios epics independientes se construyen concurrentemente en worktrees aislados y se integran de a uno con verificación completa.
- Si algún agente intenta modificar un test durante GREEN, la edición se rechaza con un mensaje del TDD Honesty Gate explicando el contrato sellado.
- Al pedir `/specture:debug` o `/specture:new-feature`, Claude entra automáticamente en Plan mode — el fix o el análisis se aprueba antes de tocar el codebase.
- En reviews y migraciones, las findings pueden citar APIs vigentes para tu stack consultadas en tiempo real vía Context7.

### Documentación detallada

Ver [`docs/native-integration-guide.md`](docs/native-integration-guide.md) para la guía operativa completa: troubleshooting, edge cases, FAQ.

---

## Instalación y Uso

### Opción A — Plugin (recomendado)

La forma más simple. Un solo comando en cualquier conversación de Claude Code:

```
/plugin install github:FerEscobarDev/Specture
```

Una vez instalado, los slash commands `/specture:*` quedan disponibles en **todas** tus conversaciones. El routing es **opt-in**: Specture no intercepta nada hasta que invocas `/specture:start` (o pides iniciar/continuar el trabajo).

**Inicializar Specture en un proyecto:**

```
/specture:setup
```

Specture detectará si el proyecto está vacío (Bootstrap), tiene código existente (Adopt), o ya tiene `.specture/` (Reconfigure), y te guiará.

**Usar el router (invocación explícita):**

```
/specture:start
```

O simplemente di "continuemos con el roadmap" — el `specture-router` detecta el estado y enruta.

---

### Opción B — Manual con @import

Para quienes no usan el plugin o prefieren control total.

**1. Clonar el framework:**

```bash
git clone https://github.com/FerEscobarDev/Specture.git
```

Puedes ponerlo donde quieras: `~/dev/specture`, `C:\Proyectos\Specture`, etc.

**2. Configurar `$SPECTURE_ROOT`:**

**Windows (PowerShell, persistente):**
```powershell
setx SPECTURE_ROOT "C:\Proyectos\Specture"
```

**Mac/Linux (zsh/bash):**
```bash
echo 'export SPECTURE_ROOT="$HOME/dev/specture"' >> ~/.zshrc
source ~/.zshrc
```

**3. Crear `CLAUDE.md` en el proyecto destino:**

En la raíz del proyecto que quieres usar con Specture, crea un archivo `CLAUDE.md` con:

```markdown
# [Nombre de tu proyecto]

@C:/Proyectos/Specture/CLAUDE.md
```

(Usa la ruta absoluta real de tu instalación — `$SPECTURE_ROOT` no se expande dentro de @imports.)

**4. Abrir Claude Code en el proyecto:**

Al iniciar una conversación en ese directorio, Claude leerá el `CLAUDE.md` y tendrá Specture disponible. El routing es opt-in: no se activa solo. Para entrar, di:

> "Configura Specture aquí." (o invoca `/specture:start`)

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

Para crear o modificar skills, leer primero `skills/write-skill/SKILL.md`.

---

## Estado del Proyecto

Specture está en desarrollo activo. Para decisiones arquitectónicas internas, ver:

- [`docs/original-vision.md`](docs/original-vision.md) — Requisitos originales del framework.
- [`docs/ui-design-flow-analysis.md`](docs/ui-design-flow-analysis.md) — Análisis del flujo de UI y rediseño que motivó v1.6.0 (contrato de API + disciplina de frontend + herramientas de diseño).

---

## Changelog

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
