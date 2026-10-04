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
| Evento | `PreToolUse` con matcher `Edit\|Write\|NotebookEdit` (Copilot/Antigravity: + `write_to_file\|replace_file_content\|multi_replace_file_content`) |
| Disparador | Antes de cualquier edición de archivo |
| Acción | Si existe `.specture/state/build-locked.json`, clasifica el `file_path` y deniega — en este orden de precedencia — (1) un **test sellado** (`specs[].test_paths`, mensaje "TDD Honesty Gate"), (2) un **spec sellado** (`spec_paths`, "Spec Seal"), (3) **código fuera de la superficie declarada** (`allowed_paths` — solo cuando el sello los lleva, nunca bajo `docs/` ni `.specture/`; "Allowed Paths"). En cualquier otro caso, allow. |
| Reemplaza | El `git diff RED_SHA..HEAD -- <test-globs>` y el `git diff SPEC_SHA..HEAD -- <specs>` post-mortem del orchestrator: el hook hace que modificar tests o specs durante el epic, o escribir código que ningún spec declara, sea **imposible**, no solo detectable. |

---

## Schema: `.specture/state/build-locked.json`

**v3 (v1.18.0+, ampliado en v2.2.0) — sello de specs + superficie permitida + una entrada por spec:**

```json
{
  "epic": "<epic-slug>",
  "sealed_at": "2026-09-07T10:00:00Z",
  "spec_sha": "<SHA del commit docs(specs): plan …>",
  "spec_paths": ["docs/05-specs/<epic-slug>/*.spec.md"],
  "test_globs": ["tests/**/*.test.ts", "tests/**"],
  "allowed_paths": ["src/notas/service.ts", "src/notas/"],
  "supersede_paths": [],
  "supersede_for": null,
  "lock_sha": "<SHA del commit que marcó el epic [/]>",
  "lifted_spec_paths": [],
  "specs": [
    { "slug": "01-model", "red_sha": "<SHA del RED commit>", "red_sha_orig": "<SHA del PRIMER RED>", "test_paths": ["tests/model/nota.test.ts"] },
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
| `supersede_for` | string \| null | epic-agent (`supersede --slug`) | v2.2.0: el spec dueño de los `supersede_paths` vigentes; `--clear` lo vacía. |
| `lock_sha` | string \| null | coordinador (`write --lock-sha`) | v2.2.0: el commit que marcó el epic `[/]` — la base donde el loop de supersesiones corre el RED retroactivo (`honesty-check base-worktree`). `write` lo conserva si no se pasa. |
| `lifted_spec_paths` | string[] | coordinador (`lift-spec`) | v2.2.0, transitorio: specs liberados del sello durante un loop de supersesiones (solo su sección de supersesiones puede cambiar — `honesty-check spec-delta`). El siguiente `write` lo vacía; si sobrevive, el loop quedó interrumpido (`/specture:doctor check` → `seal-lifted`). |
| `specs[].slug` | string | epic-agent (`merge-spec`) | Slug del spec (`<task-slug>`). |
| `specs[].red_sha` | string | epic-agent (`merge-spec`) | SHA del commit donde `tdd-test-writer` selló los tests de **ese** spec. |
| `specs[].red_sha_orig` | string | epic-agent (`merge-spec`) | v2.2.0: el **primer** RED del spec. `merge-spec` nunca lo mueve (salvo `--reset-orig`, tras un re-RED del loop completo); es el inicio del rango que audita `honesty-check range`. Ausente en sellos anteriores = `red_sha`. |
| `specs[].test_paths` | string[] | epic-agent (`merge-spec`) | **Lista explícita de archivos** del RED commit (`git show --stat <RED_SHA>`), no globs: un glob sellaría los tests del spec siguiente antes de existir. Se admiten globs (v2) por compatibilidad. |

**v2 (v1.15.0, sigue aceptado):** `{ "epic", "sealed_at", "specs": [ { slug, red_sha, test_paths } ] }`. **v1 (legacy, sigue aceptado):** `{ "epic", "red_sha", "test_paths": [...], "locked_at" }`. Los hooks leen la **unión** de todas las formas; un sello v2 en curso no necesita migración (el archivo es transitorio y gitignoreado). La lógica compartida — lectura, clasificación (`classify`) y mensajes (`denyReason`) — vive en `lib/seal.js`; los tres hooks solo difieren en el sobre de la respuesta.

**Lifecycle**: el **coordinador** (`skills/build/SKILL.md`, gate step 7) escribe los campos de epic con `seal-cli.js write` tras commitear los specs validados; el **epic-agent** (`skills/build/EPIC_LOOP.md`, Step 4 post-check 5) fusiona la entrada de cada spec con `seal-cli.js merge-spec` después de cada RED commit; el coordinador lo libera con `seal-cli.js release` al procesar el `DONE` — y también el epic-agent en Step 8, por si acaso; ninguno confía en el otro. `seal-cli.js unseal-spec --slug` (uso manual; desde v2.2.2 el build no lo usa: el loop de corrección libera el spec con `lift-spec` y abre los tests con `supersede --shared-with-red`) quita esa entrada **y libera su archivo de spec** de `spec_paths` (antes de v2.2.0 lo dejaba sellado y el hook seguía denegando la edición del planner). En el loop de supersesiones, `lift-spec --slug` libera solo el archivo del spec y conserva su entrada y su RED. **Nadie edita el JSON a mano.** Si querés desbloquear edits de tests legítimamente durante un epic en curso, liberá el sello y aceptá que el TDD contract se rompió — el `git diff` del Step 5.5 va a detectarlo igual; para un test de un epic **cerrado** que este spec contradice, la vía sancionada es `Supersede:` en el spec.

### `lib/seal-cli.js` — el único escritor del sello

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" <comando> [opciones] [--project <root>]
  write        --epic <slug> --spec-sha <sha> --spec-paths a,b [--test-globs a,b] [--allowed-paths a,b] [--lock-sha <sha>]
  merge-spec   --slug <task-slug> --red-sha <sha> (--test-paths a,b | --add-test-paths a,b) [--reset-orig] [--epic <slug>]
  unseal-spec  --slug <task-slug>
  lift-spec    --slug <task-slug>
  supersede    [--slug <task-slug>] --paths a,b [--shared-with-red] | --clear
  release | show
```

`write` conserva **íntegras** las entradas `specs[]` del mismo epic (con su `red_sha_orig`) y `lock_sha` si no se pasa, descarta las de otro epic avisando por stderr, y vacía `lifted_spec_paths` / `supersede_paths` / `supersede_for` (un `write` re-sella); `merge-spec` agrega o actualiza **una** entrada por slug sin tocar los campos del epic (`--test-paths` reemplaza, `--add-test-paths` une); `lift-spec` expande a lista explícita el glob que cubre el spec y quita solo ese archivo; `supersede` **rechaza** (exit 1) un path que sea el RED de cualquier spec del sello — propio o hermano — salvo `--shared-with-red` explícito (el RED agregó tests a un archivo existente); `release` es idempotente. Cada comando acepta solo sus flags (más `--project`): un flag desconocido es error de uso. Exit 1 con un archivo corrupto, una supersesión rechazada o un `lift-spec` imposible; exit 2 por uso incorrecto. En Copilot/Antigravity se invoca con `${PLUGIN_ROOT}` en vez de `${CLAUDE_PLUGIN_ROOT}`.

### `lib/honesty-check.js` — salvaguardas mecánicas del TDD Honesty Gate (v2.2.0)

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/honesty-check.js" <comando> [opciones] [--project <root>] [--json]
  clean-tree    [--test-globs a,b]
  range         --slug <task-slug> --epic-dir <dir> [--head <rev>]
  red-lines     [--slug <task-slug>]
  spec-delta    --epic-dir <dir> --base <SPEC_SHA> --slug <task-slug>
  protected     --epic-dir <dir> [--slug <task-slug>]
  base-worktree --lock <sha> [--files a,b] --dir <tmp> | --remove <dir>
  fix-range     --base <sha> --test-globs a,b --allowed a,b [--head <rev>]
```

Primera línea de stdout = token `HONESTY <cmd>: PASS … | FAIL <n> | UNVERIFIABLE <motivo>`; exit 0 / 1 / 2. `clean-tree` exige nada sin commitear bajo los globs de test; `range` es la **allowlist** del Step 5.5 (todo commit que toca tests en `red_sha_orig..HEAD` está registrado en `## SUPERSESIONES` con exactamente sus paths — o es el primer RED de un spec hermano — y `supersede_paths` está vacío); `red-lines` verifica que cada línea que agregó el RED original siga en HEAD; `spec-delta` que un spec liberado solo cambió su sección de supersesiones; `protected` que ninguna supersesión toque un test de `verify:` de `rules.yml` o un GUARD de otro epic; `base-worktree` arma el worktree en `LOCK_SHA` para el RED retroactivo; `fix-range` (v2.4.0) es el chequeo posterior del loop de corrección de cumplimiento, que corre sin sello: cada commit de `BASE..HEAD` toca solo los archivos declarados para los hallazgos elegidos (el del hallazgo, los nuevos que crea un arreglo estructural y los que lo usan, nunca un test). Lo usan `skills/build/EPIC_LOOP.md` (Step 5.2 y 5.5), el loop de supersesiones de `skills/build/SKILL.md` y `skills/compliance-review/CORRECTION_LOOP.md`; el detalle y el riesgo residual están en `docs/tdd-honesty-reference.md`.

### Revisión de cumplimiento (v2.4.0) — `lib/review-rules-resolve.js` y `lib/compliance.js`

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review-rules-resolve.js" --project . (--spec <file> | --paths a,b | --paths-file <list> | --all) [--json] [--cap N]
node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" <range|lint|assemble|stub|triage|correction|status|record> [opciones] [--project <root>] [--json]
```

`review-rules-resolve.js` arma el bloque `CUSTOM_RULES` desde `.specture/review-rules.md` (opcional; parser y lint en `lib/review-rules.js`): las inclusiones y reglas `RV-n` cuyo `cuando:` toca las rutas dadas, con un solo nivel de inclusión y el nivel flexible aplicado. Exit 0 (sin archivo: `CUSTOM_RULES: []`, sin aviso), 1 con errores o sobre el tope de 60 000 caracteres, 2 uso. `compliance.js` es la mitad mecánica de la revisión de cumplimiento: `range --milestone <N>` (ventanas `LOCK..CLOSE` por epic y bloques por componente en `.specture/state/compliance/<id>/`), `lint` (gramática de las partes y comentarios sin vocabulario interno), `assemble` (el reporte en `docs/07-reviews/`), `stub` (reporte `BLOCKED`), `triage` y `correction` (decisiones y resultados por hallazgo), `status` y `record` (la línea `kind: "compliance"` de `build-metrics.jsonl`). Token `COMPLIANCE <cmd>: …`; exit 0 / 1 (FAIL) / 2 (UNVERIFIABLE o uso). Gramáticas: `templates/COMPLIANCE_REPORT_TEMPLATE.md`.

### Permisos (Claude Code, v2.2.1)

El build corre `seal-cli.js`, `honesty-check.js` y `spec-set-check.js` muchas veces por epic, a veces desde un subagente. En **modo auto**, el clasificador de permisos puede leer `seal-cli.js unseal-spec` como "quitar tests de seguridad" y negarlo; en un epic real eso pasó dos veces y cada negación terminó en una pregunta al usuario. Dos vías, complementarias:

- **Reglas estrechas en `permissions.allow`** del proyecto (`.claude/settings.json`, commiteado para todo el equipo, o `.claude/settings.local.json` solo para ti). El comodín va **pegado** a `.js`, porque la ruta del plugin va entre comillas en el comando (`node "…/seal-cli.js" write …`) y cambia con la versión:

  ```json
  {
    "permissions": {
      "allow": [
        "Bash(node *specture*hooks/lib/seal-cli.js*)",
        "Bash(node *specture*hooks/lib/honesty-check.js*)",
        "Bash(node *specture*hooks/lib/spec-set-check.js*)"
      ]
    }
  }
  ```

  Estas reglas se resuelven antes que el clasificador. La documentación de Claude Code avisa que el modo auto **suspende** las reglas amplias de ejecución arbitraria, "como `Bash(*)` o intérpretes con comodín"; si tu versión trata estas reglas así, queda la segunda vía.
- **Una entrada `autoMode.allow`** en `~/.claude/settings.json` — el único lugar donde el clasificador lee `autoMode` (nunca de la configuración del proyecto). Es prosa, no un patrón; por ejemplo: *"Correr los scripts del plugin Specture (`seal-cli.js`, `honesty-check.js`, `spec-set-check.js`, bajo el directorio del plugin specture) está permitido: administran el sello local de `.specture/state/` y verifican el historial de git; no borran tests ni tocan sistemas remotos."* `/auto-mode-setup` y la pestaña **Auto mode** de `/permissions` sirven para agregarla.

`/specture:doctor check` avisa con `specture-script-permissions` (INFO) cuando el build ya corrió y no encuentra ninguna de las dos. Specture nunca escribe tu configuración de permisos: la decisión es tuya.

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
- `readToggle(projectRoot, key)` → valor efectivo de un toggle. `PROFILE_INDEPENDENT_KEYS` (`docs_index.max_entries_per_dispatch`, `compliance_review.enabled`) se respetan bajo cualquier perfil cuando el archivo los declara; los perfiles `lean`/`full` deciden solo los cuatro toggles booleanos.
- `parseSettingsYaml(text)` / `serializeSettings(values, { schemaVersion })` — el subset plano de YAML que usa `settings.yml`.

---

## Troubleshooting

| Síntoma | Causa probable |
|---------|---------------|
| El hook nunca se dispara aunque `hooks.enabled: true` | El plugin no está instalado, o `${CLAUDE_PLUGIN_ROOT}` no resuelve. Verificá `claude /plugin list`. |
| El TDD Gate no bloquea aunque estoy en build loop | `.specture/state/build-locked.json` no existe o sus `test_paths` no matchean. Inspeccioná el sello con `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" show` (o `cat .specture/state/build-locked.json`). |
| El TDD Gate bloquea archivos que no son tests | Algún glob en `test_paths` es demasiado amplio. Revisá la línea de testing en `conventions.md` (desde v1.18.0 `merge-spec` guarda la lista de archivos del RED commit, no globs). |
| El hook deniega un archivo de producción con "Allowed Paths" | El spec no lo declara en `Crea:`/`Modifica:`. No es un falso positivo: el implementer reporta `BLOCKED: spec <ID>` con el archivo y el planner agrega la línea `Modifica:` (loop de corrección). Si es un helper de tests, `test_globs` debe incluir la carpeta raíz de tests (`tests/**`). |
| El hook deniega un spec con "Spec Seal" | Los specs validados son inmutables durante el epic. Un spec inejecutable se reporta como `BLOCKED: spec <ID>`; el coordinador libera solo ese archivo (`lift-spec`), lo re-planifica y lo re-sella con un `SPEC_SHA` nuevo; los tests afectados se corrigen con un red-fix puntual registrado. En el loop de supersesiones lo libera `lift-spec`. |
| `honesty-check range` da FAIL con un commit `test(supersede): … — loop …` | Su SHA no está en `## SUPERSESIONES` del `_planning.md` del epic, o toca un archivo que no se registró con él. El epic-agent completa el `commit:` de cada línea en el Step 5.2; sin ese registro el commit es una modificación de tests como cualquier otra. |
| `/specture:doctor check` reporta `seal-lifted` | Un loop de supersesiones quedó interrumpido con un spec liberado. Retomalo con `/specture:start` (el coordinador lo continúa desde `spec-delta`); nunca edites el sello a mano. |
| El TDD Gate actúa en un proyecto que no es Specture | `.specture/` heredado de un directorio padre. `findProjectRoot` sube en el árbol; chequeá. |
| `hooks.enabled: true` pero `specture-guard` devuelve inactivo | Revisá `.specture/settings.yml` (`hooks.enabled: true` sin comillas ni corchetes, o `profile: lean|full`). En proyectos sin migrar, el bloque de `conventions.md` §10 exige el formato `- **hooks.enabled**: true`. Si existe `settings.yml`, `conventions.md` se ignora. |
