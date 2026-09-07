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

### `pre-tool-use-tdd-gate.js` (Claude Code) · `specture-pre-tool-use-tdd-gate.js` (Copilot / Antigravity)

| | |
|---|---|
| Evento | `PreToolUse` con matcher `Edit\|Write\|NotebookEdit` (Copilot/Antigravity: + `write_to_file\|replace_file_content`) |
| Disparador | Antes de cualquier edición de archivo |
| Acción | Si existe `.specture/state/build-locked.json`, clasifica el `file_path` y deniega — en este orden de precedencia — (1) un **test sellado** (`specs[].test_paths`, mensaje "TDD Honesty Gate"), (2) un **spec sellado** (`spec_paths`, "Spec Seal"), (3) **código fuera de la superficie declarada** (`allowed_paths` — solo cuando el sello los lleva, nunca bajo `docs/` ni `.specture/`; "Allowed Paths"). En cualquier otro caso, allow. |
| Reemplaza | El `git diff RED_SHA..HEAD -- <test-globs>` y el `git diff SPEC_SHA..HEAD -- <specs>` post-mortem del orchestrator: el hook hace que modificar tests o specs durante el epic, o escribir código que ningún spec declara, sea **imposible**, no solo detectable. |

---

## Schema: `.specture/state/build-locked.json`

**v3 (v1.18.0+) — sello de specs + superficie permitida + una entrada por spec:**

```json
{
  "epic": "<epic-slug>",
  "sealed_at": "2026-09-07T10:00:00Z",
  "spec_sha": "<SHA del commit docs(specs): plan …>",
  "spec_paths": ["docs/05-specs/<epic-slug>/*.spec.md"],
  "test_globs": ["tests/**/*.test.ts", "tests/**"],
  "allowed_paths": ["src/notas/service.ts", "src/notas/"],
  "supersede_paths": [],
  "specs": [
    { "slug": "01-model", "red_sha": "<SHA del RED commit>", "test_paths": ["tests/model/nota.test.ts"] },
    { "slug": "02-api",   "red_sha": "<SHA del RED commit>", "test_paths": ["tests/api/notas.test.ts", "tests/api/errores.test.ts"] }
  ]
}
```

| Campo | Tipo | Quién lo escribe | Significado |
|-------|------|------------------|-------------|
| `epic` | string | coordinador (`write`) | Slug del epic activo (aparece en los mensajes de rechazo). |
| `sealed_at` | string (ISO-8601) | primer escritor | Momento del primer sellado. |
| `spec_sha` | string | coordinador (`write`) | SHA del commit de planificación; el epic-agent lo recibe como evidencia y el coordinador corre `git diff <spec_sha>..HEAD -- <specs>` al procesar el reporte. |
| `spec_paths` | string[] | coordinador (`write`) | Globs de los specs validados: **inmutables durante el epic** (deny "Spec Seal"). |
| `test_globs` | string[] | coordinador (`write`) | Globs de tests de `conventions.md` **más la carpeta raíz de tests** (`tests/**`): lo que sigue siendo escribible aunque haya `allowed_paths` (helpers y tests de la fase RED). |
| `allowed_paths` | string[] | coordinador (`write`) | Unión de los paths `Crea:`/`Modifica:` de la Superficie de los specs (`spec-set-check.js --allowed-paths`); una entrada que termina en `/` cubre todo el directorio. **Opcional**: sin este campo el gate Allowed Paths no actúa (fail open). |
| `supersede_paths` | string[] | epic-agent (`supersede`) | Transitorio: tests sellados de un epic cerrado que este spec supersede por declaración (`Supersede:`); levanta **solo** el deny de test para esos paths mientras el tdd-test-writer aplica la supersesión. |
| `specs[].slug` | string | epic-agent (`merge-spec`) | Slug del spec (`<task-slug>`). |
| `specs[].red_sha` | string | epic-agent (`merge-spec`) | SHA del commit donde `tdd-test-writer` selló los tests de **ese** spec. |
| `specs[].test_paths` | string[] | epic-agent (`merge-spec`) | **Lista explícita de archivos** del RED commit (`git show --stat <RED_SHA>`), no globs: un glob sellaría los tests del spec siguiente antes de existir. Se admiten globs (v2) por compatibilidad. |

**v2 (v1.15.0, sigue aceptado):** `{ "epic", "sealed_at", "specs": [ { slug, red_sha, test_paths } ] }`. **v1 (legacy, sigue aceptado):** `{ "epic", "red_sha", "test_paths": [...], "locked_at" }`. Los hooks leen la **unión** de todas las formas; un sello v2 en curso no necesita migración (el archivo es transitorio y gitignoreado). La lógica compartida — lectura, clasificación (`classify`) y mensajes (`denyReason`) — vive en `lib/seal.js`; los tres hooks solo difieren en el sobre de la respuesta.

**Lifecycle**: el **coordinador** (`skills/build/SKILL.md`, gate step 7) escribe los campos de epic con `seal-cli.js write` tras commitear los specs validados; el **epic-agent** (`skills/build/EPIC_LOOP.md`, Step 4 post-check 5) fusiona la entrada de cada spec con `seal-cli.js merge-spec` después de cada RED commit; el coordinador lo libera con `seal-cli.js release` al procesar el `DONE` — y también el epic-agent en Step 8, por si acaso; ninguno confía en el otro. En el loop de corrección de un spec, `seal-cli.js unseal-spec --slug` quita solo esa entrada. **Nadie edita el JSON a mano.** Si querés desbloquear edits de tests legítimamente durante un epic en curso, liberá el sello y aceptá que el TDD contract se rompió — el `git diff` del Step 5.5 va a detectarlo igual; para un test de un epic **cerrado** que este spec contradice, la vía sancionada es `Supersede:` en el spec.

### `lib/seal-cli.js` — el único escritor del sello

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" <comando> [opciones] [--project <root>]
  write        --epic <slug> --spec-sha <sha> --spec-paths a,b [--test-globs a,b] [--allowed-paths a,b]
  merge-spec   --slug <task-slug> --red-sha <sha> --test-paths a,b [--epic <slug>]
  unseal-spec  --slug <task-slug>
  supersede    --paths a,b | --clear
  release | show
```

`write` conserva las entradas `specs[]` del mismo epic (y descarta las de otro epic avisando por stderr); `merge-spec` agrega o reemplaza **una** entrada por slug sin tocar los campos del epic; `release` es idempotente. Exit 1 con un archivo corrupto, exit 2 por uso incorrecto. En Copilot/Antigravity se invoca con `${PLUGIN_ROOT}` en vez de `${CLAUDE_PLUGIN_ROOT}`.

**Sello huérfano**: si `docs/04-roadmap/ROADMAP.md` existe y **ningún** epic está `[/]`, el sello sobrevivió a su epic. Los hooks entonces **permiten** la edición para los tres tipos de regla (Claude Code: `permissionDecision: "allow"` con la razón; Copilot/Antigravity: razón por stderr) — un archivo olvidado nunca bloquea trabajo ajeno — y `/specture:doctor check` lo reporta como ERROR (`seal-stale`).

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
| El TDD Gate no bloquea aunque estoy en build loop | `.specture/state/build-locked.json` no existe o sus `test_paths` no matchean. Inspeccioná el sello con `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" show` (o `cat .specture/state/build-locked.json`). |
| El TDD Gate bloquea archivos que no son tests | Algún glob en `test_paths` es demasiado amplio. Revisá la línea de testing en `conventions.md` (desde v1.18.0 `merge-spec` guarda la lista de archivos del RED commit, no globs). |
| El hook deniega un archivo de producción con "Allowed Paths" | El spec no lo declara en `Crea:`/`Modifica:`. No es un falso positivo: el implementer reporta `BLOCKED: spec <ID>` con el archivo y el planner agrega la línea `Modifica:` (loop de corrección). Si es un helper de tests, `test_globs` debe incluir la carpeta raíz de tests (`tests/**`). |
| El hook deniega un spec con "Spec Seal" | Los specs validados son inmutables durante el epic. Un spec inejecutable se reporta como `BLOCKED: spec <ID>`; el coordinador lo des-sella (`unseal-spec`), lo re-planifica y lo re-sella con un `SPEC_SHA` nuevo. |
| El TDD Gate actúa en un proyecto que no es Specture | `.specture/` heredado de un directorio padre. `findProjectRoot` sube en el árbol; chequeá. |
| `hooks.enabled: true` pero `specture-guard` devuelve inactivo | Revisá `.specture/settings.yml` (`hooks.enabled: true` sin comillas ni corchetes, o `profile: lean|full`). En proyectos sin migrar, el bloque de `conventions.md` §10 exige el formato `- **hooks.enabled**: true`. Si existe `settings.yml`, `conventions.md` se ignora. |
