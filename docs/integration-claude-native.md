# Reporte: Integración de Capacidades Nativas de Claude Code en Specture

> **Revisión v1.5.0 (audit trail):** la recomendación de auto-routing vía hook `SessionStart` (secciones 3.7 y siguientes) fue **revertida**. La experiencia mostró que el auto-routing en cada conversación es intrusivo y duplica al agente `specture-router`. Decisión vigente: routing **opt-in** — se invoca explícitamente `/specture:start`. El hook `SessionStart` quedó deregistrado; solo el `PreToolUse` (TDD Honesty Gate) permanece activo. El resto del análisis se conserva como registro histórico de diseño.

> Análisis de viabilidad e impacto de integrar las capacidades nativas de la plataforma Claude Code (auto-memory, hooks, TaskCreate, MCP, Plan mode, background tasks, SessionStart) en el framework Specture.
>
> Fecha: 2026-05-14

## Resumen Ejecutivo

Claude Code ha evolucionado desde que Specture fue diseñado: ya no es solo "una CLI con skills". Hoy provee **siete capacidades de plataforma** que el framework puede aprovechar — algunas se acoplan limpiamente, otras **contradicen el principio fundamental** de Specture ("contexto restringido por agente") y deben rechazarse activamente.

**Veredicto en una línea:** sí, integrar memoria nativa, hooks, TaskCreate y SessionStart — pero **solo en el chat principal y el `specture-router`**. Los subagentes (`tdd-test-writer`, `implementer`, `architecture-validator`, `code-reviewer`) deben permanecer ciegos a memoria por diseño. Mezclarlas rompe el TDD Honesty Gate y la disciplina anti-bias.

---

## 1. Inventario de Capacidades Nativas (estado a 2026-05)

| # | Capacidad | Qué hace | Persistencia |
|---|-----------|----------|--------------|
| 1 | **Auto-memory** | Almacena facts del usuario/proyecto/feedback/referencia en `~/.claude/projects/<dir>/memory/` con index en `MEMORY.md`. Se auto-carga al inicio de cada conversación | Cross-conversation |
| 2 | **Hooks** (PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, etc.) | Ejecuta comandos en eventos del ciclo de vida; puede bloquear/modificar tool calls | Configuración (no estado) |
| 3 | **TaskCreate / TaskList** | Tracking visual de tareas en-conversación, mostrado al usuario | Intra-conversation |
| 4 | **Plan mode** | Modo no-edición forzado para planificar antes de actuar | Intra-conversation |
| 5 | **Background tasks + Monitor** | Ejecutar comandos en background y recibir notificaciones | Intra-conversation |
| 6 | **MCP servers** | Servidores externos que exponen tools/resources al modelo (ej. context7, Linear, GitHub) | Configuración |
| 7 | **Output styles / Status line** | Personalización de la UX del agente | Configuración |

---

## 2. La Tensión Arquitectónica Crítica

Specture está construido sobre **tres principios** que entran en conflicto directo con la memoria global:

1. *"El contexto es un recurso, no un regalo. Cada agente recibe SOLO los archivos que necesita."* (README línea 12)
2. *"Trust the filesystem over conversation memory."* (`start/SKILL.md` línea 14)
3. *"Tests escritos mirando la implementación testean lo que el código hace, no lo que el negocio requiere."* (`tdd-test-writer` anti-bias)

Claude's auto-memory **viola estos tres principios si se aplica naive**:

- Inyecta facts no derivados del filesystem en cada conversación → contradice (2).
- Carga contexto global en cada agente → contradice (1).
- Permite que el `tdd-test-writer` "recuerde" cómo se implementó algo similar antes → contradice (3) — bias retro-introducido por memoria.

**Conclusión:** la memoria nativa no es plug-and-play en Specture. Debe **scopear quién la lee** con la misma disciplina con la que Specture scopea qué archivos recibe cada agente.

---

## 3. Análisis por Capacidad

### 3.1 Auto-memory — Integración **selectiva**

**Dónde SÍ integrar:**

| Lector | Tipo de memoria útil | Justificación |
|--------|---------------------|---------------|
| `specture-router` (orquestador) | `user`, `feedback`, `reference` | El router toma decisiones de UX (qué preguntar, cuánta verbosidad). Una vez supiste que el usuario prefiere "preguntas de una en una" en `discover`, no deberías re-aprenderlo cada conversación. |
| Chat principal en `discover` | `user` (rol, dominio, expertise) | Permite ajustar el nivel de las preguntas socráticas sin contaminar las reglas de negocio. |
| Chat principal en `debug` | `project` (incidentes pasados), `reference` (dónde viven los logs) | Acelera la fase de hipótesis sin saltarse causa raíz. |
| Chat principal en `new-feature` | `project` (qué se construyó antes, qué se decidió descartar) | Mejora el Impact Ripple Analysis sin agregar reglas alucinadas. |
| Chat principal en `modernize` | `project` (migración previa en mismo stack), `reference` (issue trackers) | Aprovecha lecciones de migraciones anteriores. |

**Dónde NO integrar (líneas rojas):**

| Agente | Por qué NO |
|--------|------------|
| `tdd-test-writer` | **Crítico anti-bias.** Si recuerda implementaciones previas, sus tests sesgan hacia patrones existentes en vez de hacia el spec. Rompe la fase RED. |
| `implementer` | Recibe solo spec + tests + archivos a tocar. Memoria global le abriría una puerta lateral para "recordar" cómo bypassear restricciones. |
| `architecture-validator` | Su única fuente de verdad debe ser `.specture/`. Si "recuerda" que el usuario aprobó algo informalmente, valida contra historia personal en vez de contra ADRs. **Destruye el audit trail.** |
| `code-reviewer` | Mismo argumento que el validator — la review debe ser reproducible mirando solo el diff + spec + `.specture/`. |

**Implementación concreta (cambio mínimo):**

```yaml
# settings.json del plugin
hooks:
  SessionStart:
    - command: "load-specture-memory.sh"  # filtra MEMORY.md a tipos user/feedback/reference

# agents/*/AGENT.md de los 4 agentes restringidos
# Agregar línea explícita:
#   "You operate with restricted context. Do NOT read or invoke any memory file
#    under ~/.claude/projects/*/memory/. Your only valid context is what this
#    prompt provides."
```

Además, Specture debería **publicar su propio convenio** de qué memorias se escriben durante cada fase. Por ejemplo: `discover` debe escribir `user` memory (rol detectado), nunca `project` memory de las reglas de negocio (esas viven en `business_requirements.md`).

---

### 3.2 Hooks — La integración de **mayor leverage**

Hoy las "leyes de hierro" de Specture (cero código sin spec, TDD Honesty Gate, verify-before-claim) son **disciplina por convención**: el orquestador puede saltárselas. Los hooks las convierten en **gates mecánicos imposibles de evadir**.

**Hooks de alto valor para Specture:**

| Hook | Propósito | Reemplaza/Refuerza |
|------|-----------|---------------------|
| `PreToolUse` (Edit/Write) | Bloquea edits a archivos no declarados en el spec activo | Iron Law: "cero código sin spec" |
| `PreToolUse` (Edit) sobre paths de tests entre `RED_SHA` y `HEAD_SHA` | Bloquea modificación de tests durante GREEN | TDD Honesty Gate (hoy es manual con `git diff`) |
| `PostToolUse` (Bash con comando de tests) | Captura output y lo anexa al estado del epic | Step 7 — Verification |
| `UserPromptSubmit` | Detecta frases gatillo ("hay un bug", "migra a", "agregá X") y precarga el skill correcto | Routing reactivo del `specture-router` |
| `SessionStart` | Auto-invoca `skills/start/SKILL.md` aunque el usuario no diga `/specture:start` | Eliminación del "olvido de fase" |

El hook más importante es el de **TDD Honesty Gate via PreToolUse**: hoy el orquestador corre `git diff RED_SHA..HEAD -- <test-globs>` *después* de que el implementer terminó. Con un hook PreToolUse, el implementer **no puede ni siquiera abrir** un test file para edición. La detección pasa de post-mortem a impossibilidad.

**Riesgo:** los hooks son por-usuario (en `settings.json`), no por-skill. Si los enviás dentro del plugin, todos los proyectos del usuario los heredan. La mitigación es que los hooks consulten primero `.specture/stack.yml` y se auto-desactiven si no existe.

---

### 3.3 TaskCreate / TaskList — Acoplamiento **complementario, no sustitutivo**

ROADMAP.md sigue siendo la fuente de verdad cross-conversación. TaskCreate aporta valor **dentro de una sesión** del build loop:

- Mostrar visualmente al usuario los 9 pasos del loop por epic mientras se ejecutan.
- Trackear los 1-3 specs del epic actual con su estado individual.
- En `debug`: trackear el árbol de hipótesis.
- En `modernize`: trackear módulos por migrar dentro del milestone.

**Regla de oro:** TaskCreate refleja, no decide. Las tareas se derivan de ROADMAP.md, no al revés. Si hay divergencia, ROADMAP.md gana.

---

### 3.4 Plan mode — Encaje **parcial**

Specture ya tiene sus propios artefactos de planificación (architecture.md, ROADMAP.md, specs). Plan mode nativo no aporta sobre eso. **Donde sí podría ayudar:**

- En `debug/SKILL.md`: forzar Plan mode antes de tocar código asegura que la hipótesis se documenta primero. Hoy es convención; con Plan mode es bloqueo del sistema.
- En `new-feature/SKILL.md`: el Impact Ripple Analysis se beneficia de Plan mode porque obliga a mostrar el análisis antes de modificar.

No lo integraría en `build` — ahí ya hay specs físicos, Plan mode duplicaría.

---

### 3.5 Background tasks + Monitor — Optimización **operacional**

El build loop tiene momentos donde el orquestador espera I/O lento:

- Step 6 (review) — corre en paralelo con el linter/type-check.
- Step 7 (verify) — re-ejecutar suite completa.
- En `modernize`: characterization tests pueden ser lentos.

Levantando estos como background tasks, el orquestador progresa mientras corren. Notificación automática al completar. **Ahorro real de wall-clock**, no de quality. Bajo riesgo, baja prioridad.

---

### 3.6 MCP servers — Encaje **estrecho pero potente**

Tres casos concretos donde MCP aporta:

| Caso | Servidor MCP útil | Skill afectado |
|------|-------------------|----------------|
| Pull de tickets/bugs existentes durante discovery | Linear / Jira / GitHub Issues MCP | `discover`, `new-feature` |
| Docs versionadas del stack actual | `context7` (ya está disponible en tu entorno) | `architecture`, `modernize`, `code-reviewer` |
| Diseño UX delegado | Canva MCP / Figma MCP | `ux-design` (Ruta 1) |

**Notable: `context7` está conectado en tu instalación** y resuelve un problema real de Specture — el `architecture-validator` y el `code-reviewer` necesitan saber si un patrón es idiomático en el framework declarado en `stack.yml`. Hoy lo deducen de entrenamiento (estancado en 2025). Con context7 lo consultan en vivo. Esto es **especialmente crítico para `modernize`**: validar que el target de migración usa APIs actuales y no deprecadas.

---

### 3.7 SessionStart / Auto-routing — Cierre del último gap

Hoy `specture-router` se activa "automáticamente cuando el plugin está habilitado", pero en la práctica depende de que el modelo lea el system prompt y respete la instrucción. Con un hook `SessionStart` que ejecute `skills/start/SKILL.md`, la activación es **infraestructural**, no discrecional.

---

## 4. Roadmap de Integración Recomendado

Ordenado por **leverage × low-risk**:

| # | Cambio | Esfuerzo | Riesgo |
|---|--------|----------|--------|
| 1 | Hook `PreToolUse` para TDD Honesty Gate (bloquear edits a tests entre RED_SHA y HEAD_SHA) | Bajo | Bajo |
| 2 | Anti-memory clauses explícitas en los 4 agentes restringidos | Trivial | Nulo |
| 3 | Hook `SessionStart` → invoca `skills/start/SKILL.md` | Bajo | Bajo |
| 4 | Memoria selectiva en `specture-router` y chat principal de `discover`/`debug` | Medio | Medio (requiere convención de qué se escribe en cada fase) |
| 5 | TaskCreate dentro del build loop (mirror de ROADMAP.md) | Bajo | Bajo |
| 6 | MCP `context7` referenciado desde `architecture-validator` y `code-reviewer` | Medio | Bajo |
| 7 | Hook `PreToolUse` Edit/Write — bloquear edits fuera de paths declarados en spec activo | Alto (requiere parsear el spec) | Medio (puede frustrar al usuario en edge cases) |
| 8 | Plan mode en `debug` y `new-feature` | Bajo | Bajo |
| 9 | Background tasks para review/verify | Bajo | Bajo |

---

## 5. Lo que NO se Debe Integrar (Decisiones Conscientes de Rechazo)

1. **Memoria en los 4 agentes restringidos.** Ya argumentado en §3.1. Es la línea roja.
2. **Memoria como sustituto de archivos del filesystem.** Si una decisión arquitectónica importa, va a un ADR — no a memory. Las memorias son volátiles y editables sin trazabilidad; los ADRs no.
3. **TaskCreate como reemplazo de ROADMAP.md.** ROADMAP.md sobrevive al cierre de conversación y a la rotación de máquinas; TaskCreate no.
4. **Hooks que modifiquen contenido silenciosamente.** Los hooks de Specture deberían **bloquear o anotar**, nunca reescribir prompts del usuario. La transparencia es un valor en Specture.
5. **Pull-based memory en `code-reviewer`.** Si el reviewer pudiera "consultar memoria", podría rationalizar que algo se aprobó antes. La review debe ser idempotente y reproducible.

---

## 6. Riesgos y Contradicciones Específicas

| Riesgo | Origen | Mitigación |
|--------|--------|-----------|
| Memory leak cross-project | Memorias se escriben con paths de un proyecto y luego se reutilizan en otro | El convenio de Specture: solo escribir `user` memory cross-project; `project` memory siempre referencia el repo en su body |
| Memoria reemplaza `.specture/decisions/` informalmente | Usuario empieza a "decir y olvidar" en vez de generar ADRs | Hook `UserPromptSubmit` detecta frases tipo "que esto sea regla" → sugiere `/specture:setup` reconfigure |
| Hooks pesados ralentizan el flujo | Hooks PreToolUse corren en cada edit | Mantener los hooks como scripts <100ms; usar early-return cuando no aplica |
| MCP servers fallan offline | context7 requiere red | Skills deben funcionar sin MCPs disponibles (fallback graceful) |
| El plugin viene con hooks que el usuario no consintió | Hooks tienen blast radius mayor que skills | Documentar explícitamente en README y ofrecer toggle en `.specture/conventions.md` |

---

## 7. Implicación Estratégica

Specture nació en una era donde Claude Code era *casi solo prompts*. La metodología llenó el vacío de plataforma con disciplina. Hoy, **la plataforma cubrió parte de ese vacío** — pero solo parte:

- **Lo que la plataforma cubre mejor que Specture:** ciclo de vida de tools (hooks), tracking de tareas, persistencia transversal de usuario.
- **Lo que Specture sigue cubriendo y la plataforma no:** SDD como flujo end-to-end, fases con state machine, contexto restringido por función cognitiva, ADRs versionados, anti-bias en TDD.

La integración correcta **delega a la plataforma lo que la plataforma hace mejor** (hooks como enforcement, memoria para UX, TaskCreate para visibilidad) y **conserva intacto el core de Specture** (restricted-context agents, spec-first, verify-before-claim). Tratar de fusionarlo todo en memoria global destruiría lo que hace único al framework.
