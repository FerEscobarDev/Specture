# Proceso de release del plugin

> Vigente desde v1.14.1. La versión del plugin vive en **cuatro manifiestos** que deben
> coincidir; `scripts/bump-version.js` los escribe y `hooks/test/release-contract.test.js`
> + la CI lo verifican. El **changelog del README es la única fuente de las notas de
> release**: el workflow las extrae de ahí. Antes de v1.14.1 nada verificaba esto y
> v1.14.0 se publicó con tres manifiestos en 1.13.0 y sin changelog.

## Los cuatro manifiestos

| Archivo | Campo | Plataforma |
|---|---|---|
| `plugin.json` | `version` | Copilot CLI / Antigravity CLI (fuente que lee la CI) |
| `.claude-plugin/plugin.json` | `version` | Claude Code |
| `.github/plugin/marketplace.json` | `metadata.version` y `plugins[0].version` | Marketplace de Copilot |
| `copilot/compatibility-matrix.json` | `claudeSource` | Versión del plugin que siguen los espejos Copilot |

`package.json` **no** lleva `version` a propósito: sería un quinto manifiesto.

## Paso a paso

1. `npm test` en verde local (Node ≥ 22; `node --test` auto-descubre `hooks/test/*.test.js`).
   Si la release tocó `agents/*/AGENT.md`, antes `npm run mirrors:sync`: los espejos Copilot
   se generan desde ahí y el test de contrato falla si están desactualizados. Si tocó los
   agentes del gate, además corré los **probes de release** (sección de abajo) antes del bump.
2. `npm run bump -- X.Y.Z` — escribe la versión en los cuatro manifiestos (idempotente,
   conserva el formato de cada archivo).
3. Agregar al `README.md`, al inicio de `## Changelog`, la entrada
   `### vX.Y.Z — <título>` con **Motivación / Cambios / Backward-compat** (mismo formato
   que las anteriores). El texto tras ` — ` es el título del GitHub Release.
4. **Si la release cambia el esquema del proyecto** — cualquier archivo de
   `templates/project-config/`, `ROADMAP_TEMPLATE.md`, `SPEC_TEMPLATE.md`,
   `MIGRATION_SPEC_TEMPLATE.md`, `CURRENT_CAPABILITY_TEMPLATE.md`, `PLANNING_TEMPLATE.md`,
   `BUSINESS_REQUIREMENTS_TEMPLATE.md`, o la sección
   "Required Inputs" de un skill —: decidí si hace falta una migración
   (`migrations/<since>-<slug>.js`, registrada en `migrations/index.js`, con su test en
   `migrations/test/catalog.test.js`) y corré `npm run schema:sync`. `npm test` falla mientras
   `migrations/schema-manifest.json` esté desactualizado: ese es el gate.
5. `npm run check:release` — falla si los manifiestos no coinciden o falta la entrada.
6. Commit `chore(release): vX.Y.Z` (junto con los docs de la versión), `git push origin
   master` y **esperar la CI verde** (`gh run watch`). No cortar el tag sobre CI roja.
7. `git tag -a vX.Y.Z -m "vX.Y.Z — <título>"` y `git push origin vX.Y.Z`.
8. `release.yml` corre tests + contrato y **crea (o actualiza) el GitHub Release** con
   título = encabezado del changelog y notas = su cuerpo. Verificar con
   `gh release view vX.Y.Z`.

## Qué verifica la CI

- **`ci.yml`** — en push a `master`, PRs y tags `v*`: `npm test` en
  `ubuntu-latest` y `windows-latest` × Node 22 y 24. En tags, además el job
  `release-contract`: `bump-version --check` y `tag == plugin.json.version`.
- **`release.yml`** — solo en tags `v*`: repite tests y contrato (un tag inválido nunca
  publica) y crea/actualiza el Release con `gh`.
- **`hooks/test/release-contract.test.js`** (corre en ambos): manifiestos iguales, entrada
  de changelog presente, cada comando de hook en `settings.json`/`hooks.json` apunta a un
  script existente, `--check` en 0.
- **`migrations/test/*.test.js`**: catálogo (pending → apply → done, idempotente), invariante
  setup ↔ migraciones, manifest de esquema sincronizado.
- **`hooks/test/copilot-plugin-contract.test.js`**: cada `copilot/agents/*.agent.md` es la
  salida exacta de `scripts/copilot-mirrors.js` sobre su `AGENT.md` (`mirrors:check`).

## Probes de release (desde v2.2.0)

La CI verifica los scripts; no puede verificar el **juicio** de un agente. Un release que toca
los agentes del gate (`agents/spec-planner/AGENT.md`, `agents/architecture-validator/AGENT.md`)
o el procedimiento del gate y del loop de supersesiones en `skills/build/` corre, antes del
bump, las sondas de **defectos plantados** sobre el fixture:

```
node scripts/baseline-fixture.js <dir> --stage 4 --git
```

`<dir>` es un scratch fuera del repo. La etapa 4 es un proyecto `node:test` con un agregador
(un import roto tumba la suite entera), un epic cerrado con código y tests reales, un epic
`[/]` con historia (lock, plan, RED) y las carnadas: un rename que rompe la compilación de tests
cerrados, un BR que cambia una aserción (límite 10 → 25 MB), una supersesión falsa, un spec que
contradice un ADR `Accepted` (clon del caso ADR-020 de Psikora), un par AC contra AC, una lista
de supersesiones incompleta y una regla de `rules.yml` con `verify: tests/…::…` (test
protegido). Cada escenario se corre **3 veces** con el validador en `effort: medium` (y en
`high` si medium falla); las corridas son manuales hasta que exista un harness. El resultado se
documenta en `docs/gate-convergence-baseline.md`:

| # | Escenario (gate) | Resultado exigido |
|---|---|---|
| G1 | Lista de supersesiones incompleta | `APPROVED` (a lo sumo `sup-candidato:`); 0 herramientas fuera de `Read`/`Glob` |
| G2 | Clon de ADR | BLOCKER **3/3** |
| G3 | AC contra AC | BLOCKER |
| G4 | `APPROVED` con observación de alcance | a Diferidos; 0 preguntas y 0 re-despachos |
| G5 | Re-validación delta sin cambios | sin BLOCKER nuevo |
| G6 | 3 rondas sin `APPROVED` | una sola pregunta cerrada |
| G7 | Re-pase del planner | despacho fresco, sin `COVERAGE_TABLE` en el handback |
| G8 | Defectos de nivel proyecto | BLOCKER en medium |

| # | Escenario (ejecución) | Resultado exigido |
|---|---|---|
| E1 | Import roto (capa de compilación) | `BLOCKED` con la lista completa y 0 ediciones de tests |
| E2 | Aserción 10 → 25 MB | loop de supersesiones; J9 `SÍ`; Step 5.5 `PASS` |
| E3 | Supersesión falsa | J9 `NO` → regresión al implementer |
| E4 | Cualquier corrida de ejecución | `debug` nunca se invoca desde la cola |

Los escenarios mecánicos del loop (supersede sobre un archivo del RED propio, edición sin
commitear, `RED_SHA` movido, retiro de un test protegido…) los cubre `npm test`.

**Condición de release:** si el validador en `medium` no detecta **3/3** el clon de ADR (G2),
el release se publica con `effort: high` en `agents/architecture-validator/AGENT.md`, y se
registra en `docs/gate-convergence-baseline.md` y en la entrada del changelog. (El diseño,
`docs/spec-gate-convergence-design.md` F1-02, aplica la misma regla a los defectos de nivel
proyecto de G8.)

**Etapa de revisión (desde v2.3.0).** Un release que toca `skills/build/REVIEW_STAGE.md`, los
modos `DRAFT`/`QUESTIONS`/`REFRESH` del planner o `MODE: REVIEW` del validador corre además el
pipeline sobre la etapa 5:

```
node scripts/baseline-fixture.js <dir> --stage 5 --git
```

La tanda 2.1–2.3 lleva sus carnadas en la pista que imprime el script (con las respuestas que
debe dar el operador). El resultado se documenta en `docs/review-stage-baseline.md`:

| # | Escenario (revisión) | Resultado exigido |
|---|---|---|
| PR | Premisa falsa en el bloque de 2.1 | `FALSA repository.js:29` → pregunta con `Dato verificado:`; control de 2.2 `VERIFICADA` |
| R1 | Tanda completa | una sola agenda por tema; `review.js status` = `OPEN … RONDA-1` (el registro parsea) |
| R4 | Respuesta contra ADR-002 | `LATE` en la ronda 2, nunca persistida como regla |
| R5 | Respuesta "30 días" | una pregunta `derivada de A-n` en la ronda 2 |
| R6 | Decisión nueva al refrescar 2.2 | aparcado; 0 preguntas; la cola sigue |
| R8 | Borrador de 2.3 con su proveedor en la tanda | `DRAFT_PASS` con `--batch` |

## Reglas

- **Semver del plugin:** *patch* = higiene, docs, fixes sin cambio de comportamiento de
  skills/agentes; *minor* = cambia comportamiento o la estructura esperada en `.specture/`
  / `docs/` del proyecto (desde la Milestone 1 del roadmap, un minor así **embarca su
  migración**); *major* = rompe proyectos existentes.
- **Nunca mover un tag ni reescribir `master`.** Un release defectuoso se corrige con un
  patch nuevo.
- **El changelog de una versión publicada solo se toca por erratas.** Para regenerar las
  notas de un Release ya creado:
  `node scripts/bump-version.js --notes X.Y.Z > notes.md && gh release edit vX.Y.Z --title "$(node scripts/bump-version.js --title X.Y.Z)" --notes-file notes.md`.
- **Un cambio en `templates/project-config/**`, los templates de ROADMAP/SPEC/MIGRATION/
  CURRENT o en los "Required Inputs" de un skill es cambio de esquema del proyecto** → minor,
  con migración en `migrations/` cuando un proyecto existente necesite algo para seguir
  funcionando igual, y siempre con `npm run schema:sync` (el test
  `migrations/test/schema-manifest.test.js` lo exige). La regla complementaria: un proyecto
  recién creado desde los templates **nunca** tiene migraciones pendientes
  (`migrations/test/setup-invariant.test.js`).

## Comandos útiles

```
npm test                                   # todos los tests
npm run check:release                      # contrato de release, sin escribir
npm run mirrors:sync                       # regenera los espejos Copilot tras editar agents/*/AGENT.md
node scripts/bump-version.js --title 1.14.1   # "v1.14.1 — <título>"
node scripts/bump-version.js --notes 1.14.1   # cuerpo de la entrada del changelog
gh run watch                               # seguir el run de CI del último push
gh release view v1.14.1                    # verificar el Release publicado
```
