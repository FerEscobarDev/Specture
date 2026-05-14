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
│   └── write-skill/SKILL.md
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

Por definir.
