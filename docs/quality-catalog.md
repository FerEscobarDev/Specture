# Catálogo de calidad — ejemplos por pila (no es parte del motor)

> **Estado: referencia, desde v2.8.0.** Specture es agnóstico de lenguaje: el framework **ejecuta
> los comandos que el proyecto declara** en `.specture/stack.yml` → `quality.commands` y nunca
> deduce uno a partir del nombre de la herramienta. Todo lo que sigue son **ejemplos** para
> rellenar ese bloque y para mecanizar las reglas del núcleo con el linter que el equipo ya usa.
> Si tu pila no está, el mecanismo es el mismo: un comando por slot, `{files}` donde la
> herramienta acepte rutas, `none` cuando no aplica.

## 1. Qué corre cada comando y cuándo

| Slot | Quién lo corre | Sobre qué | Qué pasa con la salida |
|---|---|---|---|
| `test` | **solo** el epic-agent: Step 3.9 (línea base — o reutilizada del log del epic anterior, v3.2.0) y Step 7, lanzado junto a las herramientas del Step 6 (v2.9.0 · v3.2.0) | la suite completa, siempre vía `quality.js run test --log` | verde/rojo; la salida entera queda en `docs/.specture-meta/runs/`; `BASELINE_FALLOS` se registran en el log (`runs record-failures`); regresiones de otros epics → implementer `MODE: REGRESIONES`. Con hooks, la **Suite Guard** deniega el comando fuera de las fases `baseline` / `verify` |
| `test_scoped` (v2.9.0) | tdd-test-writer · implementer / ux-implementer · post-checks del epic-agent | `{files}` = los tests en obra (`{names}` = sus nombres base, para runners que filtran por clase) | verde/rojo; `sin definir` → `SKIPPED`: el agente corre lo más acotado que ofrezca su runner sobre esos archivos y lo dice; nunca la suite |
| `type_check` | `red-check.js` (Step 4, antes del sello) · Step 6 | `{files}` = tests del RED · archivos del spec | FAIL re-despacha al test-writer · `LINT_REPORT` al reviewer |
| `lint` | `red-check.js` · Step 6 · revisión de cumplimiento | ídem · archivos del chunk | ídem · el reviewer cita, no re-inspecciona |
| `format_check` | `red-check.js` · revisión de cumplimiento | ídem | ídem; **modo verificación**, nunca reescribe |
| `mutation` | Step 6 con `settings.yml` → `mutation.enabled: true` y `mutation.scope: spec` (default); Step 7.5, **una vez por epic**, con `mutation.scope: epic` (v3.2.0) | `{files}` = `Crea:`/`Modifica:` del spec (producción); con `epic`, la unión de todos los specs | `MUTATION_REPORT` al reviewer (Step 6) o al reviewer en `MODE: MUTATION` (Step 7.5): cada mutante sobreviviente es un hallazgo de fuerza de tests o se descarta con una línea |

`{files}` se sustituye por las rutas separadas por espacio (con comillas si hace falta); `{names}` por
sus nombres base sin extensión ni sufijo `.test` / `.spec` (`FooTests`, `bar`). Un comando sin
placeholders corre tal cual. `node hooks/lib/quality.js show` lista los slots y `expand <slot> --files a,b`
imprime el comando expandido (o `SKIPPED`, exit 3): ningún agente adivina el runner. Un slot `sin definir` deja el check en `SKIPPED` y el doctor avisa
(`quality-commands-undefined`); `none` es una decisión y no avisa.

## 2. Ejemplos de `quality.commands` por pila

Son puntos de partida. Verificá cada comando en tu repo antes de declararlo: el framework lo va a
ejecutar tal cual.

### .NET (xunit / nunit)

```yaml
commands:
  test: "dotnet test"            # compila si hace falta. Comparte obj/ con type_check: el Step 6 lanza type_check PRIMERO y la suite al terminar (ver § 2.1)
                                 # variante: "dotnet test --no-build" — solo si el Step 3.9 también compila antes (quality.js run type_check); si no, la línea base corre binarios viejos
  test_scoped: "dotnet test --no-restore --filter \"$(printf 'FullyQualifiedName~%s|' {names} | sed 's/|$//')\""   # filtra por clase: dotnet no acepta rutas de test; `--filter` es lo que la Suite Guard reconoce como corrida acotada
  type_check: "dotnet build --no-restore -warnaserror"          # compila tests y producción
  lint: "dotnet format analyzers --verify-no-changes --include {files}"
  format_check: "dotnet format whitespace --verify-no-changes --include {files}"
  mutation: "dotnet stryker --mutate {files}"                   # Stryker.NET (dotnet tool)
```

### PHP (Laravel · Pest / PHPUnit)

```yaml
commands:
  test: "php artisan test"
  test_scoped: "php artisan test {files}"
  type_check: "vendor/bin/phpstan analyse --no-progress {files}"   # Larastan / PHPStan
  lint: "vendor/bin/phpstan analyse --no-progress {files}"
  format_check: "vendor/bin/pint --test {files}"
  mutation: "vendor/bin/infection --filter={files} --min-msi=0"    # Infection
```

### TypeScript / JavaScript (vitest · jest)

```yaml
commands:
  test: "npm test"
  test_scoped: "npx vitest run {files}"                          # jest: npx jest {files}
  type_check: "npx tsc --noEmit -p tsconfig.json"                # tsc no filtra por archivo
  lint: "npx eslint {files}"
  format_check: "npx prettier --check {files}"
  mutation: "npx stryker run --mutate {files}"                   # StrykerJS
```

### Python (pytest)

```yaml
commands:
  test: "pytest -q"
  test_scoped: "pytest -q {files}"
  type_check: "mypy {files}"
  lint: "ruff check {files}"
  format_check: "ruff format --check {files}"
  mutation: "mutmut run --paths-to-mutate {files}"               # mutmut
```

### Go

```yaml
commands:
  test: "go test ./..."
  test_scoped: "go test $(dirname {files} | sort -u)"            # los paquetes de esos archivos
  type_check: "go vet ./..."
  lint: "golangci-lint run"
  format_check: "test -z \"$(gofmt -l {files})\""
  mutation: "go-mutesting {files}"
```

### Java / Kotlin (JUnit)

```yaml
commands:
  test: "./gradlew test"
  test_scoped: "./gradlew test $(printf -- '--tests *%s* ' {names})"
  type_check: "./gradlew compileTestJava"
  lint: "./gradlew checkstyleMain checkstyleTest"
  format_check: "./gradlew spotlessCheck"
  mutation: "./gradlew pitest"                                   # Pitest
```

### 2.1 Comandos que comparten salida de build (v3.2.0)

Desde v3.2.0 el Step 6 lanza en background `type_check`, `lint`, `mutation` **y la suite completa**
del Step 7 al mismo tiempo que despacha al reviewer. Dos comandos que compilan sobre el mismo
directorio de salida chocan si corren a la vez; el epic-agent lanza `type_check` primero y el
resto cuando termina. Qué pares comparten salida, por pila:

| Pila | ¿`type_check` y `test` comparten build? | Qué hacer |
|---|---|---|
| .NET (`dotnet build` / `dotnet test`) | **Sí** — ambos escriben `obj/` y `bin/` (MSBuild bloquea los archivos) | `type_check` primero, la suite después; o `test: "dotnet test --no-build"` si garantizás un build previo también en el Step 3.9 |
| Java/Kotlin con Gradle | No — el daemon serializa las tareas | todo a la vez |
| TypeScript (`tsc --noEmit` / vitest · jest) | No — `--noEmit` no escribe; los runners transpilan en memoria | todo a la vez |
| Python (`mypy` / pytest) | No | todo a la vez |
| Go (`go vet` / `go test`) | No — la caché de build es segura entre procesos | todo a la vez |
| PHP (`phpstan` / Pest) | No | todo a la vez |

Stryker.NET, Infection y mutmut copian el proyecto a un sandbox propio: no colisionan con nada.

## 3. Mecanizar las reglas del núcleo con el linter

El `code-reviewer` (Dimensión 7) y la revisión de cumplimiento verifican las reglas `R-*` por su
cláusula `verificar:`. Cuando el linter ya las reporta, el reviewer cita su salida (`LINT_REPORT`)
en vez de inspeccionar el archivo. Equivalencias conocidas — **ejemplos**:

| Regla del núcleo | ESLint (TS/JS, React) | .NET (`.editorconfig` + analizadores) | PHP | Python / Go |
|---|---|---|---|---|
| `R-FILE-001` un componente por archivo | `react/no-multi-comp` | — | — | — |
| `R-FILE-002` una clase/servicio exportado por archivo | `max-classes-per-file: ["error", 1]` | StyleCop `SA1402` (un tipo por archivo) | PSR-4 (una clase por archivo, lo exige el autoload) | `ruff` `PLR0904`-family no aplica; revisar a mano |
| `R-FILE-003` types/interfaces fuera del componente | `no-restricted-syntax` sobre `ExportNamedDeclaration > TSInterfaceDeclaration` en `*.tsx` | `SA1402` cubre el caso de clase + interfaz en un archivo | `phpcs` regla `PSR1.Files.SideEffects` + una clase por archivo | — |
| `R-FILE-004` hooks/constantes compartidas fuera del componente (frontend) | `no-restricted-syntax` sobre `ExportNamedDeclaration > VariableDeclaration` en `*.tsx` (exportar una constante desde el componente) | n/a | n/a | n/a |
| línea máxima (conventions §1) | `max-len` | `max_line_length` en `.editorconfig` + `dotnet format whitespace` | `pint` (`line_length` en `pint.json`) | `ruff` `E501` · `golines` |
| idioma de identificadores (§8) | `@typescript-eslint/naming-convention` con `custom: { regex }` | `IDE1006` + regla personalizada | — | — |

Cómo adoptarlo: `/specture:setup` (reconfigure) pregunta los comandos y, si tu pila está en este
catálogo, **propone** la configuración en Plan mode, archivo por archivo. Nunca escribe una
configuración de linter sin que la confirmes: una regla que nadie eligió es una convención
invisible.

## 4. Lo que el framework no hace a propósito

- No instala herramientas ni elige una por vos.
- No corre un comando que no esté declarado: `sin definir` es `SKIPPED`, visible en el reporte.
- No convierte este catálogo en comportamiento: si cambiás de linter, cambiás el comando.
- No parsea la salida de tu runner: el log de una corrida es texto crudo, y los nombres de los
  tests que fallaron los escribe el agente que lo leyó (`runs record-failures`), no el framework.

## 5. `quality.js run` y `runs` — el registro de corridas (v3.2.0)

En Psikora HC-IHCE.17/01 el epic-agent corrió la suite de 21 minutos dos veces seguidas: de la
primera había guardado solo un `tail` y no sabía qué tests habían fallado. Desde v3.2.0 toda
corrida completa se lanza con `run <slot> --log` y queda entera en
`docs/.specture-meta/runs/<inicio>-<slot>-<sha7>.log` (gitignoreado; `runs prune --keep 20` en el
Step 8 limpia los viejos):

```
# specture-run: 1
# slot: test
# sha: <commit HEAD al arrancar>
# tree: clean | dirty      ← el árbol fuera de docs/ y .specture/
# phase: verify | (none)   ← la fase del sello
# command: dotnet test
# cwd: …
# start: 2026-10-22T14:03:11.000Z
# ---
<salida cruda stdout+stderr del runner>
# ---
# end: 2026-10-22T14:24:40.000Z
# duration_s: 1289
# exit: 1
```

El CLI imprime una línea de resumen (`RUN test: exit 1 · 1289 s · sha ab12cd3 · tree clean · log …`)
y la vía de recuperación: **grep en el log, nunca volver a correr**. Pistas de grep por pila:
`dotnet` → `^\s*Failed ` · pytest → `^FAILED ` · vitest / jest → `✗|FAIL ` · go → `--- FAIL` ·
PHPUnit → `^\d+\) `. Luego `runs record-failures --log <path> --from-file <lista> | --none` escribe
el sidecar `<log>.failures` en la gramática de `BASELINE_FALLOS`.

| Comando | Para qué |
|---|---|
| `run <slot> [--files a,b] [--log] [--timeout-min N]` | ejecuta el slot; con `--log` lo registra; exit = el del comando |
| `runs [--slot s] [--last N]` · `runs --sha <rev>` | lista los logs, el más nuevo primero |
| `runs reusable` | `REUSABLE <log> · sha · failures <n>` cuando un log de `test` describe el árbol actual (completo, árbol limpio, sidecar registrado, sin cambios fuera de `docs/` y `.specture/` desde su sha) — la línea base del Step 3.9 se toma de ahí; si no, `NONE <motivo>` |
| `runs record-failures --log <path> (--from-file f \| --failure "…" \| --none)` | registra los fallos que el agente leyó |
| `runs summary --since <ISO\|rev> [--slot s]` | `runs: N · minutes: M` de las corridas completas de un slot (default `test`) — sin `--slot`, las métricas `full_suite_runs` / `full_suite_minutes` del epic; `type_check`, `lint` y `mutation` no cuentan como suite |
| `runs prune --keep N` | borra los logs viejos por slot, con sus sidecars, y nombra cada uno |

La **Suite Guard** (`hooks/lib/suite-guard.js`, dentro del hook de espera) deniega `quality.commands.test`
— y `quality.js run|expand test` — mientras el sello está en una fase distinta de `baseline` o `verify`;
reconoce una corrida acotada por los tokens que `test_scoped` tiene y `test` no (`--filter`, `--tests`),
o por un argumento con ruta cuando `test_scoped` es solo `test` + `{files}`. Si `test` y `test_scoped`
son idénticos, declarar un `test_scoped` distinguible.
