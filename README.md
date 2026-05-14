# Specture Framework

> Una metodología de Vibe Coding para Claude Code basada en SDD (Spec-Driven Development), con configuración agnóstica al stack, agentes especializados con contexto restringido, y disciplina anti-alucinación.

Specture lleva un proyecto **desde la idea hasta el código** en 5 fases consecutivas + 4 capacidades transversales, dispatchando 4 agentes funcionales por cada epic. No replica la estructura de un equipo humano: replica las **funciones cognitivas** que la IA hace mejor cuando se le restringe el contexto.

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
├── settings.json                      # Activa specture-router automáticamente
├── .claude-plugin/
│   └── plugin.json                    # Manifiesto del plugin
├── skills/
│   ├── start/SKILL.md                 # Router: detecta el estado y enruta
│   ├── setup/SKILL.md                 # Setup en 3 modos (bootstrap/adopt/reconfigure)
│   ├── discover/SKILL.md              # Levantamiento socrático de negocio
│   ├── architecture/SKILL.md          # Arquitectura + ROADMAP fusionados
│   ├── ux-design/SKILL.md             # UX/UI con dual route
│   ├── build/SKILL.md                 # Loop spec→test→code→review por epic
│   ├── debug/SKILL.md
│   ├── new-feature/SKILL.md
│   ├── verify/SKILL.md
│   ├── write-skill/SKILL.md
│   └── modernize/SKILL.md
├── agents/
│   ├── specture-router/AGENT.md       # Orquestador principal (reemplaza CLAUDE.md)
│   ├── architecture-validator/AGENT.md  # Valida planes contra .specture/
│   ├── tdd-test-writer/AGENT.md         # Escribe tests desde el spec (sin ver código)
│   ├── implementer/AGENT.md             # Implementa para pasar tests
│   └── code-reviewer/AGENT.md           # Review unificado (spec + arch + quality)
├── templates/
│   ├── project-config/                # Plantillas de .specture/ del proyecto destino
│   │   ├── stack.template.yml
│   │   ├── conventions.template.md
│   │   └── decisions/000-template.md
│   ├── ARCHITECTURE_TEMPLATE.md
│   ├── ROADMAP_TEMPLATE.md
│   ├── SPEC_TEMPLATE.md
│   ├── DESIGN_SYSTEM_TEMPLATE.md
│   └── DEBUG_LOG_TEMPLATE.md
└── docs/
    └── original-vision.md             # Visión y requisitos originales del framework
```

---

## Las 5 Fases

| # | Skill | Slash command | Cuándo se activa | Output |
|---|-------|--------------|------------------|--------|
| **0** | `setup` | `/specture:setup` | Sin `.specture/stack.yml` | `.specture/` poblado + `CLAUDE.md` del proyecto |
| **1** | `discover` | `/specture:discover` | Sin `docs/01-requirements/business_requirements.md` | Reglas de negocio, actores, edge cases |
| **2** | `architecture` | `/specture:architecture` | Sin `docs/04-roadmap/ROADMAP.md` | Arquitectura + ROADMAP de milestones/epics |
| **3** | `ux-design` | `/specture:ux-design` | Frontend declarado + sin `docs/03-ux-ui/` | Mapa de navegación + design system o specs para IA externa |
| **4** | `build` | `/specture:build` | ROADMAP con epics `[ ]` o `[/]` | Código testeado, revisado, verificado |

## Capacidades Transversales

| Skill | Slash command | Activación |
|-------|--------------|-----------|
| `debug` | `/specture:debug` | Test falla 2+ veces, build roto, reviewer rechaza, implementer BLOCKED |
| `new-feature` | `/specture:new-feature` | Usuario pide funcionalidad fuera del ROADMAP original |
| `verify` | `/specture:verify` | Antes de cualquier "completado", "fixed", "passing" |
| `write-skill` | `/specture:write-skill` | Crear o modificar skills del framework |
| `modernize` | `/specture:modernize` | Subir versión de una tecnología o migrar a otro stack |

---

## Los 4 Agentes

Specture **no** especializa por capa técnica (no hay "Frontend Agent" ni "Backend Agent" — esa es falsa especialización en IA). Especializa por **función cognitiva** con contexto restringido:

| Agente | Función | Contexto que recibe | Contexto que NO recibe |
|--------|---------|---------------------|-------------------------|
| `architecture-validator` | Validar que un plan/spec respeta stack y ADRs | Documento + `.specture/` | Código de implementación |
| `tdd-test-writer` | Escribir tests desde el spec | Spec + business rules + testing framework | Código de implementación (anti-bias crítico) |
| `implementer` | Hacer que los tests pasen | Spec + tests + archivos a tocar | Conversación entera, archivos no relevantes |
| `code-reviewer` | Review unificado (spec + arch + quality) | Diff + spec + `.specture/` | Sugerir fixes (solo reporta) |

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
**Diseña la arquitectura técnica y genera el ROADMAP.** Fusiona dos responsabilidades en una: produce `architecture.md` basado en el stack declarado en `stack.yml` (nunca inventa tecnología), y luego convierte esa arquitectura + los requerimientos en un `ROADMAP.md` de milestones y epics con dependencias explícitas. Valida el documento con el agente `architecture-validator` antes de finalizarlo.

Output: `docs/02-architecture/architecture.md` + `docs/04-roadmap/ROADMAP.md`.

> Úsalo cuando digas "diseñemos la arquitectura", "generemos el roadmap", o cuando `ROADMAP.md` no existe.

---

#### `/specture:ux-design`
**Define UX e información arquitectónica antes de escribir UI.** Solo se activa si el proyecto tiene frontend declarado en `stack.yml`. Ofrece dos rutas:
- **Ruta 1 (Delegada)** — genera specs para una IA de diseño externa (v0, Lovable, Figma AI): produce el brief de marca, restricciones y mapa de navegación.
- **Ruta 2 (Full Specture)** — construye el Design System internamente: tokens de color, tipografía, spacing, componentes base con variantes/estados/accesibilidad.

No produce código en esta fase — solo especificación en Markdown.

Output: `docs/03-ux-ui/navigation_map.md` + (Ruta 2) `docs/03-ux-ui/design_system.md`.

> Úsalo cuando el frontend esté declarado y `docs/03-ux-ui/` no exista.

---

#### `/specture:build`
**Orquesta el loop de construcción spec → test → código → review por epic.** Es el skill más denso: toma el próximo epic del ROADMAP, genera su spec, lo despacha al `architecture-validator`, luego al `tdd-test-writer` (RED commit), luego al `implementer` (GREEN), y finalmente al `code-reviewer`. Cada agente recibe solo el contexto que necesita. Incluye un **TDD Honesty Gate** que verifica con `git diff` que el implementer no modificó los tests. Marca el epic como `[x]` solo cuando el reviewer aprueba y los tests pasan.

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

### Agentes

Los agentes de Specture son subagentes con **contexto restringido** — cada uno recibe exactamente los archivos que necesita, no la conversación completa. Esto previene drift y alucinación acumulada.

---

#### `specture-router`
**Orquestador principal del framework (se activa automáticamente).** Cuando el plugin está activo, este agente intercepta toda conversación en un proyecto Specture e invoca `skills/start/SKILL.md` antes de hacer cualquier otra cosa. Garantiza que el framework siempre opere desde el estado real del filesystem, no desde suposiciones del historial de chat.

- **Se activa:** automáticamente con el plugin habilitado, o manualmente con `/specture:start`.
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

#### `code-reviewer`
**Staff Engineer + Lead Reviewer en un solo pase.** Revisa el código implementado en tres dimensiones simultáneas: (1) conformidad con el spec, (2) conformidad con la arquitectura y ADRs, (3) calidad del código (naming, patrones, dead code, seguridad). No modifica código — produce un reporte estructurado.

- **Contexto que recibe:** diff del implementer + spec + `.specture/` + output de tests + sección relevante de `architecture.md`.
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

## Instalación y Uso

### Opción A — Plugin (recomendado)

La forma más simple. Un solo comando en cualquier conversación de Claude Code:

```
/plugin install github:FerEscobarDev/Specture
```

Una vez instalado, los slash commands `/specture:*` quedan disponibles en **todas** tus conversaciones. El agente `specture-router` se activa automáticamente cuando está habilitado.

**Inicializar Specture en un proyecto:**

```
/specture:setup
```

Specture detectará si el proyecto está vacío (Bootstrap), tiene código existente (Adopt), o ya tiene `.specture/` (Reconfigure), y te guiará.

**Usar el router automático:**

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

Al iniciar una conversación en ese directorio, Claude leerá el `CLAUDE.md` y cargará Specture automáticamente. Luego di:

> "Configura Specture aquí."

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
- [`REPORTE_ANALISIS_EXPERTO.md`](REPORTE_ANALISIS_EXPERTO.md) — Análisis comparativo que motivó la reescritura.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
