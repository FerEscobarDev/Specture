# VibeCoding Framework

> Una metodología de Vibe Coding para Claude Code basada en SDD (Spec-Driven Development), con configuración agnóstica al stack, agentes especializados con contexto restringido, y disciplina anti-alucinación.

VibeCoding lleva un proyecto **desde la idea hasta el código** en 5 fases consecutivas + 4 capacidades transversales, dispatchando 4 agentes funcionales por cada epic. No replica la estructura de un equipo humano: replica las **funciones cognitivas** que la IA hace mejor cuando se le restringe el contexto.

---

## Filosofía

1. **Configuración, no apertura.** El framework es agnóstico al stack — pero a través de un archivo de configuración por proyecto (`.vibecoding/stack.yml`), no a costa de no opinar de nada.
2. **El contexto es un recurso, no un regalo.** Cada agente recibe SOLO los archivos que necesita. Conversaciones largas degradan calidad.
3. **Cero código sin spec. Cero fix sin causa raíz. Cero "completado" sin verificar.** Tres leyes de hierro que no se negocian.
4. **Las fases existen para controlar el contexto y prevenir alucinación, no para coordinar humanos.** Por eso son menos y más densas que en otros frameworks.

---

## Estructura del Framework

```
$VIBECODING_ROOT/
├── CLAUDE.md                          # Punto de entrada para la IA
├── skills/
│   ├── 00-using-vibecoding.md         # Router: detecta el estado y enruta
│   ├── 00-setup-and-detect.md         # Setup en 3 modos (bootstrap/adopt/reconfigure)
│   ├── 01-discovery.md                # Levantamiento socrático de negocio
│   ├── 02-architecture-and-plan.md    # Arquitectura + ROADMAP fusionados
│   ├── 03-ux-design.md                # UX/UI con dual route
│   ├── 04-iterative-build.md          # Loop spec→test→code→review por epic
│   ├── transversal-systematic-debug.md
│   ├── transversal-new-feature.md
│   ├── transversal-verification.md
│   └── transversal-writing-skills.md
├── agents/
│   ├── architecture-validator.md      # Valida planes contra .vibecoding/
│   ├── tdd-test-writer.md             # Escribe tests desde el spec (sin ver código)
│   ├── implementer.md                 # Implementa para pasar tests
│   └── code-reviewer.md               # Review unificado (spec + arch + quality)
├── templates/
│   ├── project-config/                # Plantillas de .vibecoding/ del proyecto destino
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

| # | Skill | Cuándo se activa | Output |
|---|-------|------------------|--------|
| **0** | `00-setup-and-detect` | Sin `.vibecoding/stack.yml` | `.vibecoding/` poblado + `CLAUDE.md` del proyecto |
| **1** | `01-discovery` | Sin `docs/01-requirements/business_requirements.md` | Reglas de negocio, actores, edge cases |
| **2** | `02-architecture-and-plan` | Sin `docs/04-roadmap/ROADMAP.md` | Arquitectura + ROADMAP de milestones/epics |
| **3** | `03-ux-design` | Frontend declarado + sin `docs/03-ux-ui/` | Mapa de navegación + design system o specs para IA externa |
| **4** | `04-iterative-build` | ROADMAP con epics `[ ]` o `[/]` | Código testeado, revisado, verificado |

## Capacidades Transversales

| Skill | Activación |
|-------|-----------|
| `transversal-systematic-debug` | Test falla 2+ veces, build roto, reviewer rechaza, implementer BLOCKED |
| `transversal-new-feature` | Usuario pide funcionalidad fuera del ROADMAP original |
| `transversal-verification` | Antes de cualquier "completado", "fixed", "passing" |
| `transversal-writing-skills` | Crear o modificar skills del framework |

---

## Los 4 Agentes

VibeCoding **no** especializa por capa técnica (no hay "Frontend Agent" ni "Backend Agent" — esa es falsa especialización en IA). Especializa por **función cognitiva** con contexto restringido:

| Agente | Función | Contexto que recibe | Contexto que NO recibe |
|--------|---------|---------------------|-------------------------|
| `architecture-validator` | Validar que un plan/spec respeta stack y ADRs | Documento + `.vibecoding/` | Código de implementación |
| `tdd-test-writer` | Escribir tests desde el spec | Spec + business rules + testing framework | Código de implementación (anti-bias crítico) |
| `implementer` | Hacer que los tests pasen | Spec + tests + archivos a tocar | Conversación entera, archivos no relevantes |
| `code-reviewer` | Review unificado (spec + arch + quality) | Diff + spec + `.vibecoding/` | Sugerir fixes (solo reporta) |

---

## Configuración por Proyecto

Cada proyecto que use VibeCoding tiene una carpeta `.vibecoding/`:

```
[proyecto-usuario]/
├── CLAUDE.md                  # Importa VibeCoding via $VIBECODING_ROOT
├── .vibecoding/
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

### 1. Clonar el framework

```bash
git clone https://github.com/[tu-org]/vibecoding.git
```

Puedes ponerlo donde quieras: `~/dev/vibecoding`, `C:\Proyectos\VibeCoding`, etc.

### 2. Configurar `$VIBECODING_ROOT`

**Windows (PowerShell, persistente):**
```powershell
setx VIBECODING_ROOT "C:\Proyectos\VibeCoding"
```

**Mac/Linux (zsh/bash):**
```bash
echo 'export VIBECODING_ROOT="$HOME/dev/vibecoding"' >> ~/.zshrc  # o ~/.bashrc
source ~/.zshrc
```

### 3. Inicializar VibeCoding en tu proyecto

En la carpeta del proyecto (vacío o existente), abre Claude Code y di:

> "Configura VibeCoding aquí."

Claude detectará si es bootstrap o adopt y te guiará. Al terminar tendrás `.vibecoding/` poblado y un `CLAUDE.md` que importa el framework.

### 4. Trabajar

A partir de aquí, cualquier conversación nueva en ese proyecto activará VibeCoding automáticamente. Frases típicas y a qué fase enrutan:

- *"Inicia el proyecto"* → `01-discovery`
- *"Continuemos con el roadmap"* → router detecta el estado y enruta
- *"Hay un bug en X"* → `transversal-systematic-debug`
- *"Quiero agregar Y"* → `transversal-new-feature`
- *"Reconfigura el stack"* → `00-setup-and-detect` modo reconfigure

---

## Principios de Diseño Internos (para contribuidores)

- **CSO en `description` de cada skill.** "Use when…" + condiciones de activación, NUNCA un resumen del flujo (porque Claude seguiría la descripción y no leería el skill).
- **Skill body en inglés. Mensajes al usuario y templates en español.**
- **Cero rutas absolutas.** Todo path es relativo o usa `$VIBECODING_ROOT`.
- **Cero hardcoding tecnológico.** Cualquier mención de stack se lee de `.vibecoding/stack.yml`.
- **Agentes con contexto restringido.** Nunca pasarles la conversación entera ni archivos que no necesiten.
- **Limpieza de contexto explícita entre epics.** El acumulado mata calidad.

Para crear o modificar skills, leer primero `skills/transversal-writing-skills.md`.

---

## Estado del Proyecto

VibeCoding está en desarrollo activo. La documentación y skills evolucionan en cada iteración. Para decisiones arquitectónicas internas, ver:

- [`docs/original-vision.md`](docs/original-vision.md) — Requisitos originales del framework.
- [`REPORTE_ANALISIS_EXPERTO.md`](REPORTE_ANALISIS_EXPERTO.md) — Análisis comparativo VibeCoding vs Superpowers que motivó la reescritura actual.

---

## Licencia

Por definir.
