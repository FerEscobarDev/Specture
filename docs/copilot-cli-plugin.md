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
   Una vez activado el agente, pide iniciar o continuar el trabajo (*"inicia el proyecto"*, *"continuemos con el roadmap"*). El router cargará la habilidad `start` e inspeccionará el sistema de archivos para dirigir la sesión a la fase adecuada.

3. **Invocación directa de Habilidades**:
   Las habilidades mantienen sus nombres estándar (`start`, `setup`, `discover`, `architecture`, `ux-design`, `build`, `debug`, `knowledge`). Copilot puede inferir la habilidad requerida o puedes nombrarla explícitamente.

---

## TDD Honesty Gate en Copilot CLI

Specture declara sus hooks en `hooks.json` usando el evento `PreToolUse`. Durante la fase TDD RED, los archivos de test sellados quedan bloqueados mecánicamente contra escrituras accidental o prematuras.

Los hooks de Copilot CLI operan con manejo de excepciones para fallar de forma abierta (*fail open*) en caso de errores no evaluables, manteniendo la verificación en `git diff` como defensa en profundidad.

---

## Garantías de Compatibilidad y Aislamiento

- **Claude Code**: Utiliza `.claude-plugin/plugin.json`, `agents/` y `skills/`.
- **Copilot CLI**: Utiliza `.github/plugin/marketplace.json`, `copilot/agents/` y `hooks.json`.
- **Antigravity CLI**: Utiliza `plugin.json`, `agents/`, `skills/` y `hooks.json`.

Ninguna plataforma interfiere con la otra, compartiendo la misma fuente de verdad en `.specture/` y `ROADMAP.md`.
