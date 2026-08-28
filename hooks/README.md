# Specture Hooks

Scripts Node.js invocados por Claude Code en eventos del ciclo de vida. Sirven para convertir las "leyes de hierro" de Specture (cero código sin spec, TDD Honesty Gate, verify-before-claim) de **convenciones** en **gates mecánicos**.

Audiencia de este documento: usuarios que quieren entender, debuggear o extender los hooks. Para uso normal alcanza con la sección "Cómo activar" del README principal.

---

## Activación

Los hooks shippean **inactivos** dentro del plugin. Para encenderlos en un proyecto, en `.specture/settings.yml` (v1.15.0+):

```yaml
hooks.enabled: true      # o profile: lean | full, que lo encienden
```

Proyectos creados antes de v1.15.0 pueden tener el toggle en `.specture/conventions.md` §10 (`- **hooks.enabled**: true`); `lib/settings.js` lo lee de ahí como fallback hasta que `/specture:doctor migrate` lo mueva. Sin el toggle (o con `false`), cada hook llama a `lib/specture-guard.js`, recibe `{ active: false }` y sale con exit 0 inmediatamente. El plugin no toca nada.

---

## Hooks incluidos

### `session-start.js` — eliminado en v1.14.1

> Deregistrado desde v1.5.0 (el routing es opt-in: se entra con `/specture:start`) y
> **eliminado del repo en v1.14.1**. No hay ningún hook `SessionStart` registrado. Si
> alguna vez querés restaurar el auto-routing, el script histórico está en git
> (`git show v1.14.0:hooks/session-start.js`).

### `pre-tool-use-tdd-gate.js`

| | |
|---|---|
| Evento | `PreToolUse` con matcher `Edit\|Write\|NotebookEdit` |
| Disparador | Antes de cualquier edición de archivo |
| Acción | Si existe `.specture/state/build-locked.json` y el `file_path` matchea uno de los `test_paths` declarados, retorna decisión `deny` con un mensaje del TDD Honesty Gate. En cualquier otro caso, allow. |
| Reemplaza | El `git diff RED_SHA..HEAD -- <test-globs>` post-mortem del orchestrator: el hook hace que la modificación de tests durante GREEN sea **imposible**, no solo detectable. |

---

## Schema: `.specture/state/build-locked.json`

```json
{
  "epic": "<epic-slug>",
  "red_sha": "<SHA del RED commit>",
  "test_paths": ["**/*.test.ts", "tests/**/*.py"],
  "locked_at": "2026-05-14T18:32:00Z"
}
```

| Campo | Tipo | Significado |
|-------|------|-------------|
| `epic` | string | Slug del epic activo (se usa en el mensaje de rechazo del hook). |
| `red_sha` | string | SHA del commit donde `tdd-test-writer` selló los tests. Solo informativo aquí; el orchestrator lo usa para el `git diff` de defense-in-depth. |
| `test_paths` | string[] | Lista de globs (formato de `conventions.md` testing) que el hook intentará matchear contra cada `file_path` editado. |
| `locked_at` | string (ISO-8601) | Timestamp del momento del sellado. Útil para auditar. |

**Lifecycle**: `skills/build/SKILL.md` escribe el archivo en Step 4 (después del RED commit), y lo borra en Step 8 (después de marcar el epic `[x]`). Si querés desbloquear edits de tests legítimamente durante un epic en curso, borrá el archivo a mano y aceptá que el TDD contract se rompió — el `git diff` del Step 5.5 va a detectarlo igual.

---

## Exit codes y decisiones

Los hooks de Claude Code combinan exit code con payload JSON en stdout:

| Caso | Exit code | Stdout | Resultado |
|------|-----------|--------|-----------|
| Hook decidió no actuar | `0` | (vacío) | La tool call procede sin cambios. |
| Hook quiere agregar contexto al modelo (SessionStart) | `0` | `{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "..."}}` | El texto se inyecta como contexto adicional al modelo. |
| Hook quiere bloquear una tool call (PreToolUse) | `0` | `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "..."}}` | La tool call se rechaza con la razón provista. |
| Error inesperado del script | `≠0` | (cualquier cosa) | Claude Code emite warning; la tool call procede igual (fail-open) — el script no debe usar exit ≠0 como mecanismo de bloqueo. |

Diseño deliberado: **fail-open**. Si `lib/specture-guard.js` o el parseo del state file fallan, los hooks dejan pasar la tool call. El orquestador del build loop tiene su propio `git diff` como red de seguridad.

---

## Escribir un hook custom

Si querés agregar tu propio hook siguiendo el patrón:

1. Creá `hooks/<mi-hook>.js`.
2. Empezá con:
   ```js
   const { guard, readHookPayload } = require("./lib/specture-guard");
   const result = guard();
   if (!result.active) process.exit(0);
   ```
3. Leé el payload del hook con `readHookPayload()` y decidí.
4. Para devolver una decisión, emití el JSON correspondiente por stdout y exit 0.
5. Registralo en el `settings.json` del plugin bajo el evento que corresponda.

`lib/specture-guard.js` exporta:

- `guard(options)` → `{ active, projectRoot, reason }`. Decide si actuar.
- `findProjectRoot(cwd)` → string | null. Sube en el árbol buscando `.specture/stack.yml`.
- `readConventionsToggle(projectRoot, key)` → boolean. Lee `- **<key>**: true|false` de `conventions.md` (legacy; `guard()` ya usa `lib/settings.js`).
- `readHookPayload()` → object. Parsea el JSON del stdin.

`lib/settings.js` exporta:

- `readSettings(projectRoot)` → `{ source, path, schemaVersion, values, raw }`. Lee `.specture/settings.yml`; si no existe, cae al bloque §10 de `conventions.md`; expande el perfil (`lean`/`full`/`custom`) y aplica defaults.
- `readToggle(projectRoot, key)` → valor efectivo de un toggle.
- `parseSettingsYaml(text)` / `serializeSettings(values, { schemaVersion })` — el subset plano de YAML que usa `settings.yml`.

---

## Troubleshooting

| Síntoma | Causa probable |
|---------|---------------|
| El hook nunca se dispara aunque `hooks.enabled: true` | El plugin no está instalado, o `${CLAUDE_PLUGIN_ROOT}` no resuelve. Verificá `claude /plugin list`. |
| El TDD Gate no bloquea aunque estoy en build loop | `.specture/state/build-locked.json` no existe o sus `test_paths` no matchean. Comprobá con `cat .specture/state/build-locked.json`. |
| El TDD Gate bloquea archivos que no son tests | Algún glob en `test_paths` es demasiado amplio. Revisá la línea de testing en `conventions.md`. |
| El TDD Gate actúa en un proyecto que no es Specture | `.specture/` heredado de un directorio padre. `findProjectRoot` sube en el árbol; chequeá. |
| `hooks.enabled: true` pero `specture-guard` devuelve inactivo | Revisá `.specture/settings.yml` (`hooks.enabled: true` sin comillas ni corchetes, o `profile: lean|full`). En proyectos sin migrar, el bloque de `conventions.md` §10 exige el formato `- **hooks.enabled**: true`. Si existe `settings.yml`, `conventions.md` se ignora. |
