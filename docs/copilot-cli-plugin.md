# Specture para GitHub Copilot CLI

Specture ofrece soporte nativo como plugin para **GitHub Copilot CLI**, operando en paralelo con las integraciones de **Claude Code** y **Google Antigravity CLI (`agy`)**.

Todas las plataformas comparten la máquina de estados de Specture, la configuración `.specture/`, las especificaciones (specs), el `ROADMAP.md`, las plantillas y la disciplina de TDD Honesty Gate.

---

## Prerrequisitos

- GitHub Copilot CLI con soporte para plugins habilitado.
- Node.js disponible en `PATH` para el TDD Honesty Gate.
- PowerShell 7+ en Windows o Bash en macOS/Linux.

---

## Instalación

### Opción 1: Instalación desde Marketplace o Repositorio (Recomendado)

Añade la fuente del marketplace de Specture e instala el plugin:

```shell
copilot plugin marketplace add https://github.com/FerEscobarDev/Specture.git
copilot plugin install specture@specture
```

O bien instala directamente indicando la URL del repositorio de GitHub:

```shell
copilot plugin install https://github.com/FerEscobarDev/Specture.git
```

### Opción 2: Desarrollo y Carga Local (`--plugin-dir`)

Para desarrollo local o pruebas sin publicar, inicia Copilot indicando el directorio fuente de Specture:

```shell
copilot --plugin-dir /ruta/a/Specture
```

En Windows (PowerShell):

```powershell
copilot --plugin-dir C:\Proyectos\VibeCoding
```

---

## Uso de Specture en Copilot CLI

1. **Seleccionar el Agente Router**:
   Selecciona el agente `specture:specture-router` mediante el comando slash `/agent`:
   ```shell
   /agent specture:specture-router
   ```

2. **Iniciar o continuar trabajo**:
   Una vez activado el agente, pide iniciar o continuar el trabajo (*"inicia el proyecto"*, *"continuemos con el roadmap"*). El router inspecciona el sistema de archivos y responde una línea estricta `PHASE: <fase> · SKILL: <ruta>` — **no ejecuta la fase**. Invocá la habilidad indicada en el chat principal (paso 3).

3. **Invocación directa de Habilidades**:
   Las habilidades mantienen sus nombres estándar (`start`, `setup`, `discover`, `architecture`, `ux-design`, `build`, `debug`, `knowledge`). Copilot puede inferir la habilidad requerida o puedes nombrarla explícitamente.

4. **Preguntas del Spec Planning Gate**:
   En `build`, las tandas del `spec-planner` llegan como **preguntas cerradas en el chat** (2-4 opciones, una recomendada, ≤4 por tanda, ≤2 tandas por epic) — mismas reglas que `AskUserQuestion` en Claude Code. `copilot/agents/` incluye los 7 espejos de agentes.

---

## Sello del build en Copilot CLI (TDD Honesty Gate + Spec Seal + Allowed Paths)

Specture declara sus hooks en `hooks.json` usando el evento `PreToolUse`. Mientras un epic está en curso, `.specture/state/build-locked.json` (schema v3, v1.18.0) hace que el hook deniegue tres tipos de escritura: un **test sellado** (TDD Honesty Gate), un **spec validado** (Spec Seal — el planner y el validator ya lo aprobaron; un spec inejecutable se reporta como `BLOCKED: spec <ID>`) y **código fuera de la superficie** `Crea:`/`Modifica:` de los specs (Allowed Paths — cero código sin spec). La respuesta es `{ "permissionDecision": "deny", "permissionDecisionReason": … }` con el motivo y la vía de recuperación.

Los hooks de Copilot CLI operan con manejo de excepciones para fallar de forma abierta (*fail open*) en caso de errores no evaluables, manteniendo los `git diff` del coordinador y del epic-agent como defensa en profundidad.

Los scripts del gate se invocan con la raíz del plugin de Copilot (`${PLUGIN_ROOT}` en vez de `${CLAUDE_PLUGIN_ROOT}`), igual que el doctor:

```shell
node "${PLUGIN_ROOT}/hooks/lib/spec-set-check.js" docs/05-specs/<epic> --roadmap docs/04-roadmap/ROADMAP.md --epic <X.Y>   # gate 4a → MECH_CHECK
node "${PLUGIN_ROOT}/hooks/lib/seal-cli.js" write|merge-spec|unseal-spec|supersede|release|show                          # único escritor del sello
node "${PLUGIN_ROOT}/hooks/lib/metrics-report.js" --project . [--baseline --write]                                        # knowledge stats
```

**Brecha conocida de los espejos (C-9b):** `copilot/agents/*.agent.md` tienen 16-30 líneas frente a las 100-300 de `agents/*/AGENT.md`. Desde v1.18.1 los seis llevan las reglas de significado de v1.18.0 (planner: no leer código y gramática de la `COVERAGE_TABLE`; validator: `MECH_CHECK` y chequeos de set; reviewer: firmas `Crea:` + `CAUSE:`; tdd-test-writer: supersesiones declaradas y `SUPERSEDE:`; implementer y ux-implementer: escribir solo dentro de `Crea:`/`Modifica:`), pero no las tablas de racionalizaciones, los worked examples ni los formatos completos de salida — y `hooks/test/copilot-plugin-contract.test.js` solo verifica que cada espejo exista, no que diga lo mismo. Generarlos desde `AGENT.md` es el ítem 40 del roadmap del framework.

---

## Doctor: diagnóstico y migraciones de esquema (v1.15.0+)

El doctor es un script de Node (≥ 22) que funciona igual en las tres plataformas; el skill `doctor` lo invoca con la variable de raíz del plugin de cada CLI:

```shell
node "${PLUGIN_ROOT}/scripts/doctor.js" check          # solo lectura: corpus + estado + drift de esquema
node "${PLUGIN_ROOT}/scripts/doctor.js" migrate --apply # aplica las migraciones mecánicas
```

En Copilot CLI las migraciones **asistidas** (las que reescriben `business_requirements.md`, el ROADMAP o `stack.yml`) se presentan como propuesta cerrada en el chat y se aplican solo con tu aprobación explícita — equivalente al Plan mode de Claude Code. Las de **contenido** nunca se aplican automáticamente. La configuración del framework vive en `.specture/settings.yml` (perfil, toggles, `schema_version`); los hooks la leen de ahí, con fallback a `conventions.md` §10 en proyectos anteriores a v1.15.0.

Para correrlo en la CI del proyecto, ver el snippet en el README (sección "Configuración por Proyecto").

---

## Garantías de Compatibilidad y Aislamiento

- **Claude Code**: Utiliza `.claude-plugin/plugin.json`, `agents/` y `skills/`.
- **Copilot CLI**: Utiliza `.github/plugin/marketplace.json`, `copilot/agents/` y `hooks.json`.
- **Antigravity CLI**: Utiliza `plugin.json`, `agents/`, `skills/` y `hooks.json`.

Ninguna plataforma interfiere con la otra, compartiendo la misma fuente de verdad en `.specture/` y `ROADMAP.md`.
