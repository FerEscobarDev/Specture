# Specture — Native Claude Code Integration Guide

> **Cambio v1.5.0 — routing opt-in.** El hook `SessionStart` (auto-routing) fue **deregistrado**: ya no existe como capacidad. Se entra a Specture invocando explícitamente `/specture:start` (o pidiendo iniciar/continuar). `hooks.enabled` ahora solo controla el TDD Honesty Gate (`PreToolUse`). Las menciones a `SessionStart` más abajo se conservan como audit trail histórico.

> Guía operativa para usar las capacidades nativas de Claude Code integradas en Specture: hooks (TDD Honesty Gate), TaskCreate, Context7, Plan mode, background tasks.
>
> Audiencia: usuarios de Specture que ya conocen los slash commands base (`/specture:setup`, `/specture:build`, etc.) y quieren entender qué cambia con las capacidades nativas activas.

---

## 1. Overview

Specture v1.2.0 delega a la plataforma seis funciones que antes vivían como convención:

| Capacidad nativa | Función en Specture |
|------------------|---------------------|
| Hook `PreToolUse` (TDD Honesty Gate) | Bloquea mecánicamente la edición de tests durante GREEN. |
| ~~Hook `SessionStart`~~ | **Deregistrado en v1.5.0.** El routing es opt-in: invocá `/specture:start`. |
| `TaskCreate` | Muestra al usuario una lista en vivo de los specs del epic activo en el build loop. |
| `Context7` MCP | Provee docs vigentes para `code-reviewer` (Dimension 5) y `modernize` (gap analysis). |
| `Plan mode` | Gate de aprobación obligatorio en `debug` y `new-feature` antes de tocar código. |
| Background tasks | Paraleliza review + linter + type-checker en el build loop. |

El principio core de Specture — **contexto restringido por agente** — se mantiene intacto: los cuatro agentes especializados siguen recibiendo solo los archivos que necesitan, y se les prohíbe explícitamente consultar memorias persistentes.

---

## 2. Activación y desactivación

### 2.1 Opt-in granular por capacidad

Editá `.specture/conventions.md` sección 10:

```markdown
## 10. Specture / Claude Code Integration

- **hooks.enabled**: true            # activa el TDD Honesty Gate (PreToolUse). SessionStart ya no existe (v1.5.0).
- **context7.enabled**: true         # activa Context7 en code-reviewer y modernize
```

Cualquier capacidad podés dejarla en `false` (o ausente) y el resto sigue funcionando. Con todos los toggles en `false`, Specture funciona exactamente como v1.1.0.

### 2.2 Cómo verificar que un hook está activo

1. Confirmá que el plugin está instalado: `/plugin list` debe mostrar `specture` activo.
2. Confirmá que `.specture/stack.yml` existe en la raíz del proyecto.
3. Confirmá que `.specture/conventions.md` sección 10 tiene `hooks.enabled: true`.
4. Probá el TDD Honesty Gate: durante un epic activo del build loop, intentá editar un archivo de test sellado — la edición debe rechazarse. (En v1.5.0 ya no hay `additionalContext` de routing al abrir la sesión: el routing se invoca con `/specture:start`.)

Si no se dispara, ver `hooks/README.md` sección Troubleshooting.

---

## 3. Hooks

### 3.1 SessionStart — DEREGISTRADO (v1.5.0)

> Histórico: hasta v1.4.0 este hook inyectaba un `additionalContext` al abrir Claude Code recordando invocar `skills/start/SKILL.md`. En v1.5.0 el routing pasó a ser **opt-in**: el hook fue deregistrado de `settings.json` y el script `hooks/session-start.js` quedó dormido. Para entrar a Specture ahora invocás `/specture:start` (o pedís iniciar/continuar el trabajo) y el router detecta la fase. El único hook activo es el `PreToolUse` (TDD Honesty Gate, abajo).

### 3.2 PreToolUse / TDD Honesty Gate — qué bloquea

Mientras un epic del build loop está en curso (entre el commit RED de `tdd-test-writer` y el cierre del epic en Step 8), `.specture/state/build-locked.json` está presente y sella la lista de paths de tests.

Si en ese intervalo cualquier agente (incluido el implementer) intenta `Edit`, `Write` o `NotebookEdit` sobre un path que matchea esos globs, el hook responde con un `permissionDecision: "deny"` que incluye:

- El path bloqueado.
- El RED commit que selló el contrato.
- Instrucciones para desbloquear legítimamente (abortar el epic y re-dispatch el tdd-test-writer).

El usuario ve este mensaje y entiende por qué el modelo no pudo modificar el test.

### 3.3 Troubleshooting: hook no se dispara

Ver `hooks/README.md` — tabla de síntomas y causas. Los más comunes:

1. Plugin no instalado (`/plugin list`).
2. `hooks.enabled` no está en `true` literal en conventions.md.
3. `.specture/stack.yml` no existe en cwd (o existe solo en un subdirectorio).

---

## 4. TaskCreate en el build loop

> **Nota v1.3.0 (Prompt Optimization):** desde v1.3.0 el spec usa un template con slots obligatorios (IDs estables, tabla de contrato, "Fuera de Scope", "Superficie de Código Existente"). Antes de despachar `tdd-test-writer` o `implementer`, el orquestador ensambla un **Dispatch Manifest**; el agente lo valida como su Step 0 y devuelve `NEEDS_CONTEXT` en el turno 1 si algún slot falta — el spec incompleto se rechaza **antes** de gastar un ciclo de agente, no a mitad del trabajo. Esto reduce la latencia de creación de tests e implementación. Ver `docs/prompt-optimization-report.md`.

### 4.1 Mapeo de los 9 pasos a estados visibles

Cuando `/specture:build` empieza un epic, el orchestrator crea una task por cada spec del epic (1–3 typically). Cada task progresa por estos `activeForm`:

```
validating architecture  → architecture-validator dispatch (Step 3)
writing tests (RED)      → tdd-test-writer dispatch (Step 4)
implementing (GREEN)     → implementer dispatch (Step 5)
verifying TDD honesty    → manual git diff gate (Step 5.5)
code review              → code-reviewer + linter + typecheck (Step 6, en paralelo)
running verification     → fresh test run (Step 7)
completed                → al marcar epic [x] en ROADMAP (Step 8)
```

Si algo se rechaza (`REJECTED_MAJOR` del reviewer, `BLOCKED` del implementer), el `activeForm` cambia a algo como `"blocked: spec ambiguity"` y la task sigue `in_progress` hasta que se resuelva.

### 4.2 Diferencia con ROADMAP.md

TaskCreate es **visibilidad intra-conversación**. Las tasks se ven mientras la sesión está abierta; al cerrar Claude Code desaparecen.

`ROADMAP.md` es **persistencia cross-conversación**. Es el único source of truth de qué epics están `[ ]`, `[/]`, `[x]`.

Si por cualquier razón TaskCreate y ROADMAP discrepan (ej. el modelo marcó una task como completada pero ROADMAP no se actualizó), **ROADMAP gana**. El epic no está cerrado hasta que su línea en ROADMAP diga `[x]` y esté commiteado.

---

## 5. Context7 (MCP)

### 5.1 Cuándo se usa

Context7 está activo en exactamente dos lugares cuando `context7.enabled: true`:

**`code-reviewer` — Dimension 5 (Stack Idiomaticity)**

El reviewer consulta Context7 para confirmar que las APIs de framework usadas en el diff son idiomáticas y vigentes en la versión declarada en `stack.yml`. Las findings se ranquean entre `IMPORTANT` y `BLOCKER` según severidad (API removida vs. simplemente deprecada vs. no-idiomática).

**`modernize/SKILL.md` Step 2 — Gap Analysis**

El skill consulta Context7 para producir el `gap_analysis.md`: qué APIs de la versión origen están deprecadas, en qué release se remueven, qué APIs equivalentes existen en la versión target, qué versiones de librerías terceras son compatibles.

### 5.2 Fallback si el servidor no responde

Si `context7.enabled: false` o si la consulta falla (timeout, red caída, rate limit):

- En `code-reviewer`: la Dimension 5 se omite. El reporte la marca como "skipped — Context7 unreachable" y emite el verdict basado en las 4 dimensiones core (las findings BLOCKER no se pierden).
- En `modernize` gap analysis: cada sección afectada se marca con sufijo `[needs manual verification]`. El usuario revisa antes de aprobar el ROADMAP de migración.

Nunca se rompe el flujo. Specture funciona offline, Context7 solo le agrega información viva cuando está disponible.

### 5.3 Por qué los otros agentes NO usan Context7

`architecture-validator`, `tdd-test-writer` e `implementer` tienen prohibición explícita de consultar Context7. Razones por agente:

- **architecture-validator**: la validación es self-contained dentro de `.specture/`. Si una decisión importa, vive en un ADR. Permitirle consultar docs externos abriría una puerta para "documentación dice X, así que apruebo" sobre un ADR rechazado.
- **tdd-test-writer**: las docs muestran patrones de librería, no requisitos. Tests escritos mirando docs replican lo que la librería suele hacer, no lo que el negocio necesita.
- **implementer**: la API surface viene del spec y los tests. Si no es derivable de ahí, debe responder `NEEDS_CONTEXT`, no investigar.

---

## 6. Plan mode en `debug` y `new-feature`

### 6.1 Flujo nuevo: invocación → plan en archivo → aprobación → ejecución

**Antes** (`v1.1.0`):
1. Usuario reporta bug → Claude invoca `/specture:debug`.
2. Claude investiga, propone fix, lo escribe en el log.
3. Si el usuario se distrae, el fix puede aplicarse antes de la confirmación.

**Ahora** (`v1.2.0`):
1. Usuario reporta bug → Claude invoca `/specture:debug`.
2. Claude llega a Phase 3 (Hypothesis & Log) e invoca `EnterPlanMode`.
3. Claude escribe el debug log completo como contenido del plan: síntoma, Phase 1 findings, Phase 2 findings, hypothesis, proposed fix.
4. Claude llama a `ExitPlanMode` mostrando el plan al usuario.
5. El usuario revisa, modifica si quiere, aprueba.
6. **Recién entonces** Claude puede ejecutar `Edit`/`Write` para aplicar el fix.

Plan mode es un bloqueo a nivel de sistema: el modelo **no puede** llamar a tools de escritura mientras esté activo. La regla "no fix sin investigación" pasa de convención a candado mecánico.

`new-feature` aplica la misma lógica antes del Impact Ripple Analysis: el análisis se entrega como plan, el usuario lo aprueba, y solo después se modifican ROADMAP y ADRs.

### 6.2 Cómo aprobar/modificar el plan

Claude Code muestra el plan en un diálogo con tres opciones:

- **Approve**: el modelo sale de Plan mode y procede a ejecutar.
- **Approve with edits**: editás el plan inline antes de aprobarlo. El modelo procede con la versión editada.
- **Reject**: el modelo no procede. Tenés que darle más contexto o cambiarle el approach.

---

## 7. Background tasks

### 7.1 Qué corre en paralelo durante el review

En Step 6 del build loop (`code-reviewer`), tres procesos pueden correr al mismo tiempo:

1. El **code-reviewer agent** vía `Agent` tool.
2. El **linter** del proyecto (eslint, ruff, golangci-lint, etc.) vía `Bash run_in_background: true`.
3. El **type-checker** (tsc --noEmit, mypy, dotnet build, etc.) vía `Bash run_in_background: true`.

El orquestador no procede al Step 7 hasta que los tres reporten. La rigurosidad de cada gate es idéntica a la del flujo secuencial — solo se ahorra wall-clock.

### 7.2 Cómo leer los resultados cuando completan

Claude Code notifica automáticamente cuando un background task termina. El orquestador recolecta los outputs y los pasa al code-reviewer si éste todavía está activo (la review puede citar findings del linter/typecheck como evidencia adicional).

---

## 8. FAQ / Edge cases

### 8.1 "Necesito modificar un test legítimamente durante GREEN, ¿cómo?"

El TDD Honesty Gate existe precisamente porque "es legítimo" es la racionalización más común para violarlo. Si el test está mal, probablemente el spec está mal — y el spec se corrige en Step 2, no en Step 5.

Si genuinamente necesitás cambiar el contrato de test mid-epic:

1. Abortá el epic actual (no marqués `[x]` el spec actual).
2. Borrá `.specture/state/build-locked.json` para liberar el gate.
3. Volvé a Step 2 del build loop: actualizá el spec con lo que aprendiste.
4. Re-dispatch `tdd-test-writer` para que produzca un nuevo RED commit con el contrato corregido.
5. El `RED_SHA` se actualiza, el state file se rescribe, el implementer arranca de cero.

Nunca edites un test "rapidito" para hacerlo pasar — eso destruye el audit trail que justifica todo el framework.

### 8.2 "El hook bloqueó algo que no era una violación, ¿qué hago?"

Tres casos posibles:

- **Glob demasiado amplio**: revisá `test_paths` en `.specture/state/build-locked.json`. Si incluye algo como `**/*.ts` en lugar de `**/*.test.ts`, fixéalo en `conventions.md` (sección 7 testing) — el orchestrator lo lee de ahí.
- **State file huérfano**: un epic se abortó pero el archivo quedó. Borralo a mano.
- **Edit en archivo de soporte (test helper)**: si tu glob captura `tests/fixtures/*` y querés tocarlo, está bien — borrar el state file desbloquea, pero perdés la protección del epic en curso. Lo mejor: aislar el path del helper fuera del glob.

### 8.3 "¿Cómo desactivo Specture en una conversación puntual?"

Tenés tres opciones según el alcance:

- **Solo desactivar hooks**: setá `hooks.enabled: false` en conventions.md. Specture sigue funcionando (skills, agentes, slash commands) pero sin gates mecánicos.
- **Desactivar todo en este proyecto**: borrá `.specture/stack.yml`. El `specture-router` detecta la ausencia y no se activa. Recordá que perdés todo el contexto del proyecto.
- **Desactivar globalmente**: deshabilitá el plugin con `/plugin disable specture`. Vuelve a activarse cuando lo reactives.

---

## Comportamiento observable por skill (v1.2.0)

Esta sección consolida lo que cada skill hace diferente con hooks/Context7/Plan mode activos. Vive acá (no en cada skill) porque es descripción para el usuario, no instrucción que el modelo deba ingerir en cada ciclo.

### build (`/specture:build`)

Con `hooks.enabled: true` y/o `context7.enabled: true`:

- **TaskCreate visible**: cada spec del epic aparece como tarea viva, transicionando por `validating architecture` → `writing tests (RED)` → `implementing (GREEN)` → `code review` → `running verification` → `completed`. Sin hooks, solo `ROADMAP.md` refleja el progreso.
- **TDD Honesty Gate como hard block**: mientras existe `.specture/state/build-locked.json`, cualquier `Edit`/`Write` contra un test sellado se deniega a nivel plataforma. Sin el hook, la violación se detecta post-mortem vía `git diff` en Step 5.5.
- **Review en paralelo (Step 6)**: `code-reviewer` corre concurrente con linter y type-checker. ~30-50% menos wall-clock en diffs grandes. El rigor de cada gate no cambia.
- **Dimension 5 con Context7**: con `context7.enabled: true`, las reviews citan deprecaciones versionadas del framework de `stack.yml`. Sin él, el reviewer omite Dimension 5 y lo nota en el reporte.

### debug (`/specture:debug`)

Phase 3 (Hypothesis & Log) entra en Plan mode automáticamente. El usuario recibe un diálogo approve-or-reject con el debug log propuesto **antes** de que un fix toque código. Hasta aprobar, `Edit`/`Write` están bloqueados a nivel plataforma — no existe el atajo "lo pruebo rápido". El debug log en disco se escribe solo tras `ExitPlanMode`.

### new-feature (`/specture:new-feature`)

Step 2 (Impact Ripple Analysis) entra en Plan mode antes de producir output. Diálogo approve-or-reject con el análisis de impacto completo. Step 3 (User Validation) pasa de pregunta cortés a gate de sistema: ROADMAP, arquitectura y ADRs no se modifican hasta que `ExitPlanMode` apruebe.

### modernize (`/specture:modernize`)

Con `context7.enabled: true`, Step 2 (Gap Analysis) toma los hechos de docs vigentes vía Context7 en vez del training cutoff: breaking-changes más precisos, equivalence maps respaldados, tablas de compatibilidad reales. Sin Context7 (toggle off / red caída), el gap analysis igual completa — filas afectadas con sufijo `[needs manual verification]`. Sin fallback silencioso a conocimiento viejo.

---

## Apéndice — Anti-memory clauses

Como parte de v1.2.0, los cuatro agentes restringidos (`architecture-validator`, `tdd-test-writer`, `implementer`, `code-reviewer`) recibieron una cláusula explícita de contexto restringido que prohíbe:

- Leer memorias persistentes (`~/.claude/projects/*/memory/`).
- Consultar Context7 (excepto `code-reviewer` para Dimension 5 y `modernize` para gap analysis).
- Apoyarse en historial de conversación previo.

Esta defensa mantiene el principio "el contexto es un recurso, no un regalo" intacto incluso cuando el resto del ecosistema Claude Code adopta memoria automática.
