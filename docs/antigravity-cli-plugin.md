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
  - `/specture:build` — Ciclo iterativo TDD (spec → test → code → review).
  - `/specture:debug` — Diagnóstico estructurado con causa raíz obligatoria.
  - `/specture:knowledge` — Captura y auditoría de conocimiento.

---

## TDD Honesty Gate en Antigravity

Specture declara sus hooks en `hooks.json` usando el evento `PreToolUse`. Durante la fase TDD RED, los archivos de test sellados quedan bloqueados mecánicamente contra escrituras accidentales.

El hook opera bajo una política **fail-open** en caso de errores inesperados, manteniendo la verificación en `git diff` como defensa en profundidad.

---

## Compatibilidad Triple

- **Claude Code**: Utiliza `.claude-plugin/plugin.json`, `agents/` y `skills/`.
- **Copilot CLI**: Utiliza `.github/plugin/marketplace.json`, `copilot/agents/` y `hooks.json`.
- **Antigravity CLI**: Utiliza `plugin.json`, `agents/`, `skills/` y `hooks.json`.

Ninguna plataforma interfiere con la otra, compartiendo la misma fuente de verdad en `.specture/` y `ROADMAP.md`.
