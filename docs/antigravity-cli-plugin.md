# Specture para Google Antigravity (`agy`)

Specture corre como plugin de **Antigravity** (CLI `agy`, IDE y Antigravity 2.0) además de Claude
Code. Las dos plataformas comparten la máquina de estados, la configuración `.specture/`, los
specs, el `ROADMAP.md`, las plantillas y la disciplina del TDD Honesty Gate. Desde v2.11.0 son las
dos únicas plataformas soportadas: la compatibilidad con GitHub Copilot CLI se retiró.

Todo lo que dice este documento se verificó contra `agy plugin validate` y la documentación oficial
que Antigravity instala en `~/.gemini/antigravity/builtin/skills/agy-customizations/docs/`
(`hooks.md`, `plugins.md`, `skills.md`).

---

## Prerrequisitos

- Google Antigravity CLI (`agy`) o Antigravity IDE / 2.0.
- Node.js ≥ 22 en `PATH` para los hooks y los scripts del doctor.

---

## Instalación

### Opción 1: `agy plugin add` (recomendado)

```shell
agy plugin add https://github.com/FerEscobarDev/Specture.git
```

O dentro de una sesión activa: `/plugin add https://github.com/FerEscobarDev/Specture.git`.

### Opción 2: clon en el directorio de plugins

```shell
git clone https://github.com/FerEscobarDev/Specture.git ~/.gemini/config/plugins/specture
```

En Windows (PowerShell): `git clone https://github.com/FerEscobarDev/Specture.git "$env:USERPROFILE\.gemini\config\plugins\specture"`.

### Opción 3: enlace para desarrollo local

```shell
agy plugin link C:\Proyectos\Specture
agy plugin validate C:\Proyectos\Specture --json
```

`validate` debe reportar `"skills": 18`, `"hooks": 1`, cero errores y **ningún** aviso
`only the first 24000 are loaded`. `"agents": 0` es lo esperado (ver subagentes).

---

## Qué lee Antigravity del repositorio

| Pieza | Archivo | Detalle verificado |
|---|---|---|
| Manifiesto | `plugin.json` (raíz) | Solo metadatos (`name`, `description`, `version`…). **Nunca** claves `skills` / `agents` / `hooks` como string: el loader de agy las rechaza (`unexpected token "skills/"`) y salta el plugin entero. Skills y hooks se descubren por convención. agy también acepta `.antigravity-plugin/plugin.json`, pero con los dos presentes avisa que ignora el de la raíz, así que Specture lleva uno solo. |
| Skills | `skills/*/SKILL.md` | Antigravity carga solo los **primeros 24.000 bytes** del cuerpo. Todos los `SKILL.md` de Specture están por debajo; el detalle vive en archivos compañeros (`build/QUEUE.md`, `build/PLANNING_GATE.md`, …) que el skill abre cuando llega a ellos. `hooks/test/skill-size.test.js` lo garantiza. |
| Hooks | `hooks.json` (raíz) | Formato oficial: cada clave de primer nivel es el **nombre** de un grupo (`"specture"`); dentro, `PreToolUse: [ { matcher, hooks: [ { type: "command", command, timeout } ] } ]`. Una clave `"version"` en la raíz invalida el archivo. |
| Agentes | — | Antigravity solo acepta `AGENT.md` con `model: inherit | flash | flash_lite | pro` y `tools` como lista YAML. Los de Specture declaran `model: opus | sonnet`, `effort` y `tools` como texto porque Claude Code los necesita así, y **no se modifican**: en Antigravity los registra cada skill con `define_subagent` (abajo). |

---

## Uso

Iniciá `agy` en la raíz del proyecto; el router y los skills están disponibles como
`/specture:<skill>`:

- `/specture:start` — detecta el estado y enruta (o decí *"continuemos con el roadmap"*).
- `/specture:setup`, `/specture:discover`, `/specture:architecture`, `/specture:ux-design`,
  `/specture:build`, `/specture:debug`, `/specture:knowledge`, `/specture:compliance-review`,
  `/specture:doctor`.

Las preguntas cerradas (`AskUserQuestion` en Claude Code) llegan como preguntas cerradas en el
chat con las mismas reglas (≤4 por ronda, ≤2 rondas por gate, una opción recomendada). Antigravity
tiene la herramienta nativa `ask_question`; los skills la aceptan como equivalente.

### Subagentes: `define_subagent` y `enable_write_tools`

Al arrancar `/specture:build` o `/specture:compliance-review`, el coordinador registra los
agentes que va a despachar con `define_subagent`, leyendo `name`, `description` y el cuerpo
(`system_prompt`) de cada `agents/<name>/AGENT.md`. Tres parámetros importan, y los tres son
`false` si no se pasan:

| Agente | `enable_write_tools` | `enable_mcp_tools` | `enable_subagent_tools` |
|---|---|---|---|
| `specture-router`, `architecture-validator` | `false` | `false` | `false` |
| `spec-planner`, `tdd-test-writer`, `implementer`, `code-reviewer`, `compliance-reviewer` | `true` | `false` | `false` |
| `ux-implementer` | `true` | `true` (canvas / Playwright si el proyecto los usa) | `false` |
| coordinador del epic (`EPIC_COORDINATOR.md` como subagente) | `true` | `false` | `true` |

Sin `enable_write_tools: true` un `tdd-test-writer` o un `implementer` no puede crear archivos ni
correr tests. El `tools` y el `effort` del frontmatter **no viajan** con `define_subagent`: el
`architecture-validator` queda limitado solo por la regla escrita en su cuerpo, y nadie corre en
`effort: medium` salvo que la sesión lo fije. Recomendación: `/specture:build` con el esfuerzo de
razonamiento de la sesión en *medium*.

**Anidamiento.** Antigravity despacha con `invoke_subagent` (no existe una herramienta `Agent`).
Los Steps 0 de `EPIC_LOOP.md` y `EPIC_COORDINATOR.md` reconocen cualquiera de las dos. Un
coordinador del epic registrado con `enable_subagent_tools: true` puede despachar al epic-agent y
este a sus workers; si la sesión no expone `invoke_subagent`, el coordinador de `build` corre
`EPIC_COORDINATOR.md` **en línea** (`coordinator_mode: inline`, avisado una vez por tanda) y en una
tanda larga conviene cerrar la sesión entre epics y seguir con `/specture:start`.

---

## Hooks: TDD Honesty Gate, Spec Seal, Allowed Paths y Wait Guard

`hooks.json` registra dos `PreToolUse`:

| Matcher | Script | Qué deniega |
|---|---|---|
| `write_to_file\|replace_file_content\|multi_replace_file_content` | `hooks/specture-pre-tool-use-tdd-gate.js` | Con un epic en curso (`.specture/state/build-locked.json`): un **test sellado**, un **spec validado** y una escritura de código **fuera de la superficie** `Crea:`/`Modifica:`. Cada motivo nombra su vía de recuperación. |
| `run_command` | `hooks/specture-pre-tool-use-wait-gate.js` | Un `sleep` / `Start-Sleep` / `timeout /t` de 30 s o más y cualquier `sleep` dentro de un bucle. Los agentes esperan el resultado de su despacho, nunca un reloj. |

Contrato con Antigravity, tal como lo documenta `hooks.md`:

- **stdin** (protojson camelCase): `toolCall.name`, `toolCall.args` (`TargetFile`, `CommandLine`,
  `Cwd`…), `workspacePaths[]`, `conversationId`, `stepIdx`.
- **cwd** del hook = el directorio que contiene `hooks.json` (el plugin), **no** el proyecto. Los
  scripts localizan el proyecto en `workspacePaths[0]` y, si falta, en el directorio del archivo
  que se intenta editar (`hooks/lib/specture-guard.js`).
- **stdout**: `{ "decision": "deny", "reason": "…" }`. Los scripts emiten además el par plano
  `permissionDecision` / `permissionDecisionReason` por compatibilidad con instalaciones viejas.
- Un error inesperado o un sello huérfano (ningún epic `[/]`) hacen **fail-open**: la edición pasa
  y el motivo va a stderr; `/specture:doctor check` reporta el sello sobrante.

Opt-in como en Claude Code: `hooks.enabled: true` en `.specture/settings.yml` del proyecto. El
doctor verifica el registro y hace un auto-test del Wait Guard con el payload de Antigravity
(`hooks-antigravity-registry`, `hooks-antigravity-self-test`; WARNING con `agy` instalado, INFO sin
él).

Scripts del gate (`hooks/lib/spec-set-check.js`, `seal-cli.js`, `honesty-check.js`,
`red-check.js`, `review.js`, `metrics-report.js`, `scripts/doctor.js`) se invocan con
`${PLUGIN_ROOT}` en lugar de `${CLAUDE_PLUGIN_ROOT}`; la variable existe dentro de los procesos de
los hooks. En la terminal de `run_command` no está definida: el agente resuelve la raíz del plugin
desde la ruta del `SKILL.md` que acaba de leer (dos directorios arriba) o desde
`~/.gemini/config/plugins/specture`.

---

## Doctor

```shell
node "${PLUGIN_ROOT}/scripts/doctor.js" check           # solo lectura
node "${PLUGIN_ROOT}/scripts/doctor.js" migrate --apply  # migraciones mecánicas
```

Mismo script y mismo catálogo que en Claude Code (`skills/doctor/CATALOG.md`). Las migraciones
asistidas se aprueban en el chat antes de escribir; las de contenido solo se registran con su skill
dueño. `/specture:start` corre `check --brief` como Step 0 y avisa si hay migraciones pendientes.

---

## Compatibilidad

- **Claude Code**: `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/pre-tool-use-*.js`,
  `agents/` y `skills/`. Nada de lo que Antigravity necesita toca estos archivos.
- **Antigravity**: `plugin.json` (raíz), `hooks.json`, `hooks/specture-pre-tool-use-*.js` y los
  mismos `skills/`; los agentes se registran por sesión con `define_subagent`.

Ninguna plataforma interfiere con la otra; la fuente de verdad del proyecto es `.specture/` y
`ROADMAP.md`.
