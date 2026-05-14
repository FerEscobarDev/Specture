# VibeCoding como Plugin de Claude Code — Análisis de Requerimientos

> Fecha: 2026-05-10
> Fuente: Documentación oficial de Claude Code (code.claude.com/docs)

---

## Estado actual vs. formato de plugin

Claude Code tiene un sistema de plugins en beta pública. Un plugin es un directorio con estructura específica que se instala con `/plugin install` y se distribuye via marketplace (GitHub).

---

## Lo que ya está bien (no requiere cambio de fondo)

El frontmatter de los skills es casi correcto. Cada `.md` en `skills/` ya tiene:

```yaml
---
name: transversal-systematic-debug
description: Use the moment any test fails twice...
---
```

El formato de `SKILL.md` espera exactamente eso. Los agentes también tienen frontmatter compatible.

---

## Lo que hay que hacer

### 1. Crear el manifiesto del plugin (nuevo archivo)

```
vibecoding/
└── .claude-plugin/
    └── plugin.json
```

```json
{
  "name": "vibecoding",
  "description": "Spec-Driven Development framework para Claude Code",
  "version": "1.0.0",
  "author": { "name": "Fernando Escobar" },
  "homepage": "https://github.com/tu-org/vibecoding"
}
```

El campo `name` define el namespace: todos los skills quedan como `/vibecoding:setup`, `/vibecoding:discover`, etc.

---

### 2. Reestructurar `skills/` — de archivos planos a directorios

**Formato actual (no válido para plugin):**
```
skills/
├── 00-using-vibecoding.md
├── 01-discovery.md
...
```

**Formato requerido:**
```
skills/
├── start/                        # /vibecoding:start
│   └── SKILL.md
├── setup/                        # /vibecoding:setup
│   └── SKILL.md
├── discover/                     # /vibecoding:discover
│   └── SKILL.md
├── architecture/                 # /vibecoding:architecture
│   └── SKILL.md
├── ux-design/                    # /vibecoding:ux-design
│   └── SKILL.md
├── debug/                        # /vibecoding:debug
│   └── SKILL.md
├── new-feature/                  # /vibecoding:new-feature
│   └── SKILL.md
├── verify/                       # /vibecoding:verify
│   └── SKILL.md
└── write-skill/                  # /vibecoding:write-skill
    └── SKILL.md
```

El contenido de cada `SKILL.md` es idéntico al actual — solo se mueve y renombra. Los templates de `templates/` pueden convertirse en archivos de soporte dentro de los skills que los usan.

**Estructura con archivos de soporte (ejemplo para `debug`):**
```
skills/debug/
├── SKILL.md
└── DEBUG_LOG_TEMPLATE.md         # referenciado desde SKILL.md
```

---

### 3. Reestructurar `agents/` — mismo patrón

```
agents/
├── architecture-validator/
│   └── AGENT.md
├── tdd-test-writer/
│   └── AGENT.md
├── implementer/
│   └── AGENT.md
└── code-reviewer/
    └── AGENT.md
```

---

### 4. El problema más difícil: reemplazar el `CLAUDE.md`

El `CLAUDE.md` actual tiene una regla absoluta:

> "Before answering, exploring, or writing any code, you MUST invoke the master skill."

**Los plugins no admiten `CLAUDE.md`.** Las opciones son:

| Opción | Cómo funciona | Trade-off |
|--------|--------------|-----------|
| **`settings.json` con agente default** | El plugin define un agente cuyo system prompt contiene la regla de routing. `settings.json` lo activa como main thread cuando el plugin está activo. | Cambia el comportamiento de Claude en todas las conversaciones donde el plugin está activo. Es la más fiel al original. |
| **Skill con `user-invocable: false`** | El skill `start` siempre está en contexto para Claude (su descripción se carga siempre). Claude lo invoca cuando lo considera relevante. | Menos estricto: Claude decide cuándo aplicarlo, no es forzado. |
| **Documentar que el usuario añada el `@import`** | El plugin instala los skills, pero el usuario sigue añadiendo `@$VIBECODING_ROOT/CLAUDE.md` a su proyecto. | Requiere paso manual, pero mantiene el comportamiento exacto. |

**Recomendación:** opción 1 (agente default) para quienes usen el plugin activamente, combinado con documentar la opción de `@import` para quienes quieran el comportamiento más estricto.

**Implementación del agente default:**

```json
// plugin root: settings.json
{
  "agent": "vibecoding-router"
}
```

```markdown
// agents/vibecoding-router/AGENT.md
---
name: vibecoding-router
description: Main orchestrator for VibeCoding methodology
---

[Contenido actual del CLAUDE.md]
```

---

### 5. Estructura final del plugin

```
vibecoding/                            # raíz del plugin
├── .claude-plugin/
│   └── plugin.json                    # manifiesto (NUEVO)
├── skills/
│   ├── start/SKILL.md                 # router principal
│   ├── setup/SKILL.md
│   ├── discover/SKILL.md
│   ├── architecture/SKILL.md
│   ├── ux-design/SKILL.md
│   ├── debug/
│   │   ├── SKILL.md
│   │   └── DEBUG_LOG_TEMPLATE.md
│   ├── new-feature/SKILL.md
│   ├── verify/SKILL.md
│   └── write-skill/SKILL.md
├── agents/
│   ├── vibecoding-router/AGENT.md     # reemplaza CLAUDE.md (NUEVO)
│   ├── architecture-validator/AGENT.md
│   ├── tdd-test-writer/AGENT.md
│   ├── implementer/AGENT.md
│   └── code-reviewer/AGENT.md
├── settings.json                      # activa agente default (NUEVO)
└── README.md
```

---

### 6. Para distribución via marketplace

- Repo de GitHub con la estructura del plugin en la raíz.
- Para alojar un marketplace propio: archivo `.claude-plugin/marketplace.json` en el repo.
- Para el marketplace oficial de Anthropic: submit en `claude.ai/settings/plugins/submit`.
- Instalación por usuarios: `/plugin marketplace add tu-org/vibecoding`

---

## Resumen de trabajo estimado

| Tarea | Esfuerzo |
|-------|---------|
| Crear `.claude-plugin/plugin.json` | 5 min |
| Reestructurar 9 skills en directorios | 20 min (mecánico) |
| Reestructurar 4 agentes + crear `vibecoding-router` | 20 min |
| Crear `settings.json` con agente default | 5 min |
| Mover templates como archivos de soporte en skills | 10 min |
| Renombrar skills a nombres sin números (UX del marketplace) | Opcional |
| Publicar en GitHub + submit al marketplace oficial | Variable |

---

## Referencias

- [Extend Claude with skills](https://code.claude.com/docs/en/slash-commands)
- [Create plugins](https://code.claude.com/docs/en/plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Customize Claude Code with plugins (blog)](https://www.anthropic.com/news/claude-code-plugins)
