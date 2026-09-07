# Specture para Google Antigravity CLI (`agy`)

Specture incluye soporte nativo como plugin para **Google Antigravity CLI (`agy`)**, manteniendo simultáneamente la compatibilidad completa con **Claude Code** y **GitHub Copilot CLI**.

Todas las plataformas comparten la máquina de estados de Specture, la configuración `.specture/`, las especificaciones (specs), el `ROADMAP.md`, las plantillas y la disciplina de TDD Honesty Gate.

---

## Prerrequisitos

- Google Antigravity CLI (`agy`) o Antigravity IDE.
- Node.js disponible en `PATH` para el TDD Honesty Gate.
- PowerShell 7+ en Windows o Bash en macOS/Linux.

---

## Instalación

### Opción 1: Instalación Directa por CLI (Recomendado)

Igual que en Claude Code, puedes instalar Specture directamente indicando la URL del repositorio en la CLI de Antigravity:

```shell
agy plugin add https://github.com/FerEscobarDev/Specture.git
```

O dentro de una sesión activa de `agy`:

```shell
/plugin add https://github.com/FerEscobarDev/Specture.git
```

### Opción 2: Instalación Global por Git Clone

Si prefieres clonar el repositorio manualmente en el directorio de plugins de Antigravity:

```shell
git clone https://github.com/FerEscobarDev/Specture.git ~/.gemini/config/plugins/specture
```

En Windows (PowerShell):

```powershell
git clone https://github.com/FerEscobarDev/Specture.git "$env:USERPROFILE\.gemini\config\plugins\specture"
```

### Opción 3: Enlace para Desarrollo Local

Para desarrollo local, enlaza el repositorio como fuente de plugin:

```shell
agy plugin link /ruta/a/Specture
```

---

## Uso de Specture en Antigravity CLI

Inicia `agy` en la raíz de tu proyecto. El router y las habilidades de Specture estarán disponibles automáticamente:

- **Iniciar o continuar trabajo**:
  ```shell
  /specture:start
  ```
  O simplemente di *"continuemos con el roadmap"* o *"inicia el proyecto"*.

- **Comandos directos de Fase**:
  - `/specture:setup` — Configura el proyecto (`.specture/stack.yml`, `conventions.md`).
  - `/specture:discover` — Levantamiento socrático de negocio.
  - `/specture:architecture` — Arquitectura, contrato OpenAPI y ROADMAP.
  - `/specture:ux-design` — Navigation map y Design System.
  - `/specture:build` — Ciclo iterativo TDD (plan → test → code → review). Las tandas del `spec-planner` llegan como preguntas cerradas en el chat (mismas reglas que en Claude Code).
  - `/specture:debug` — Diagnóstico estructurado con causa raíz obligatoria.
  - `/specture:knowledge` — Captura y auditoría de conocimiento.

---

## Sello del build en Antigravity (TDD Honesty Gate + Spec Seal + Allowed Paths)

Specture declara sus hooks en `hooks.json` usando el evento `PreToolUse` (matcher `Edit|Write|NotebookEdit|write_to_file|replace_file_content`; el hook lee `TargetFile` además de `file_path`). Mientras un epic está en curso, `.specture/state/build-locked.json` (schema v3, v1.18.0) hace que el hook deniegue un **test sellado**, un **spec validado** y cualquier **escritura de código fuera de la superficie** `Crea:`/`Modifica:` de los specs, cada una con su motivo y su vía de recuperación (`BLOCKED: spec <ID>` para los dos últimos).

El hook opera bajo una política **fail-open** en caso de errores inesperados, manteniendo los `git diff` del coordinador y del epic-agent como defensa en profundidad. Los scripts del gate (`hooks/lib/spec-set-check.js`, `hooks/lib/seal-cli.js`, `hooks/lib/metrics-report.js`) se invocan con `${PLUGIN_ROOT}`, igual que el doctor.

---

## Doctor: diagnóstico y migraciones de esquema (v1.15.0+)

Mismo script que en Claude Code y Copilot (`scripts/doctor.js`, Node ≥ 22), invocado por el skill `doctor` con la raíz del plugin de Antigravity:

```shell
node "${PLUGIN_ROOT}/scripts/doctor.js" check           # solo lectura
node "${PLUGIN_ROOT}/scripts/doctor.js" migrate --apply  # migraciones mecánicas
```

Las migraciones asistidas se aprueban en el chat antes de escribir; las de contenido solo se registran con su skill dueño. `/specture:start` corre `check --brief` como Step 0 y avisa si hay migraciones pendientes (no bloquea). La configuración del framework está en `.specture/settings.yml`.

---

## Compatibilidad Triple

- **Claude Code**: Utiliza `.claude-plugin/plugin.json`, `agents/` y `skills/`.
- **Copilot CLI**: Utiliza `.github/plugin/marketplace.json`, `copilot/agents/` y `hooks.json`.
- **Antigravity CLI**: Utiliza `plugin.json`, `agents/`, `skills/` y `hooks.json`.

Ninguna plataforma interfiere con la otra, compartiendo la misma fuente de verdad en `.specture/` y `ROADMAP.md`.
