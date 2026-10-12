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
| `test` | build Step 3 (baseline) e implementer | la suite completa | verde/rojo; `BASELINE_FALLOS` |
| `type_check` | `red-check.js` (Step 4, antes del sello) · Step 6 | `{files}` = tests del RED · archivos del spec | FAIL re-despacha al test-writer · `LINT_REPORT` al reviewer |
| `lint` | `red-check.js` · Step 6 · revisión de cumplimiento | ídem · archivos del chunk | ídem · el reviewer cita, no re-inspecciona |
| `format_check` | `red-check.js` · revisión de cumplimiento | ídem | ídem; **modo verificación**, nunca reescribe |
| `mutation` | Step 6, solo con `settings.yml` → `mutation.enabled: true` | `{files}` = `Crea:`/`Modifica:` del spec (producción) | `MUTATION_REPORT` al reviewer: cada mutante sobreviviente es un hallazgo de fuerza de tests o se descarta con una línea |

`{files}` se sustituye por las rutas separadas por espacio (con comillas si hace falta). Un comando
sin `{files}` corre tal cual. Un slot `sin definir` deja el check en `SKIPPED` y el doctor avisa
(`quality-commands-undefined`); `none` es una decisión y no avisa.

## 2. Ejemplos de `quality.commands` por pila

Son puntos de partida. Verificá cada comando en tu repo antes de declararlo: el framework lo va a
ejecutar tal cual.

### .NET (xunit / nunit)

```yaml
commands:
  test: "dotnet test"
  type_check: "dotnet build --no-restore -warnaserror"          # compila tests y producción
  lint: "dotnet format analyzers --verify-no-changes --include {files}"
  format_check: "dotnet format whitespace --verify-no-changes --include {files}"
  mutation: "dotnet stryker --mutate {files}"                   # Stryker.NET (dotnet tool)
```

### PHP (Laravel · Pest / PHPUnit)

```yaml
commands:
  test: "php artisan test"
  type_check: "vendor/bin/phpstan analyse --no-progress {files}"   # Larastan / PHPStan
  lint: "vendor/bin/phpstan analyse --no-progress {files}"
  format_check: "vendor/bin/pint --test {files}"
  mutation: "vendor/bin/infection --filter={files} --min-msi=0"    # Infection
```

### TypeScript / JavaScript (vitest · jest)

```yaml
commands:
  test: "npm test"
  type_check: "npx tsc --noEmit -p tsconfig.json"                # tsc no filtra por archivo
  lint: "npx eslint {files}"
  format_check: "npx prettier --check {files}"
  mutation: "npx stryker run --mutate {files}"                   # StrykerJS
```

### Python (pytest)

```yaml
commands:
  test: "pytest -q"
  type_check: "mypy {files}"
  lint: "ruff check {files}"
  format_check: "ruff format --check {files}"
  mutation: "mutmut run --paths-to-mutate {files}"               # mutmut
```

### Go

```yaml
commands:
  test: "go test ./..."
  type_check: "go vet ./..."
  lint: "golangci-lint run"
  format_check: "test -z \"$(gofmt -l {files})\""
  mutation: "go-mutesting {files}"
```

### Java / Kotlin (JUnit)

```yaml
commands:
  test: "./gradlew test"
  type_check: "./gradlew compileTestJava"
  lint: "./gradlew checkstyleMain checkstyleTest"
  format_check: "./gradlew spotlessCheck"
  mutation: "./gradlew pitest"                                   # Pitest
```

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
