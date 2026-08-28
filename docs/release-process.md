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
2. `npm run bump -- X.Y.Z` — escribe la versión en los cuatro manifiestos (idempotente,
   conserva el formato de cada archivo).
3. Agregar al `README.md`, al inicio de `## Changelog`, la entrada
   `### vX.Y.Z — <título>` con **Motivación / Cambios / Backward-compat** (mismo formato
   que las anteriores). El texto tras ` — ` es el título del GitHub Release.
4. `npm run check:release` — falla si los manifiestos no coinciden o falta la entrada.
5. Commit `chore(release): vX.Y.Z` (junto con los docs de la versión), `git push origin
   master` y **esperar la CI verde** (`gh run watch`). No cortar el tag sobre CI roja.
6. `git tag -a vX.Y.Z -m "vX.Y.Z — <título>"` y `git push origin vX.Y.Z`.
7. `release.yml` corre tests + contrato y **crea (o actualiza) el GitHub Release** con
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
- **Un cambio en `templates/project-config/**`, `SPEC_TEMPLATE.md`, `ROADMAP_TEMPLATE.md`
  o en los "Required Inputs" de un skill es cambio de esquema del proyecto** → minor, y
  (desde M1) con entrada en `migrations/`.

## Comandos útiles

```
npm test                                   # todos los tests
npm run check:release                      # contrato de release, sin escribir
node scripts/bump-version.js --title 1.14.1   # "v1.14.1 — <título>"
node scripts/bump-version.js --notes 1.14.1   # cuerpo de la entrada del changelog
gh run watch                               # seguir el run de CI del último push
gh release view v1.14.1                    # verificar el Release publicado
```
