> **Estado: DISEÑO — no implementado aún.** Documento de diseño de la Fase 4 del
> plan maestro (aligeramiento restante: consolidación de skills + perfiles de
> toggles). Objetivo de release: **v1.11.0**. Decisiones cerradas con el usuario
> el 2026-06-19 (forks Q1/Q2). La Fase 1 ya entregó el mayor aligeramiento (L1,
> build 571→455); esta fase es **pulido de superficie**. Independiente de las
> Fases 2 y 3.

# Plan de diseño: Aligeramiento restante (consolidación + perfiles)

## Context

El reporte de valor-vs-peso identificó que, tras la Fase 1, el peso restante es **conceptual** (cantidad de skills y toggles), no de tokens. Tres ítems:
- **L2** — consolidar skills transversales por familia.
- **L4** — colapsar los toggles de `conventions.md §10`.
- **L3** — modularizar lo opt-in (la tríada v1.7.0) según uso.

Dos reencuadres honestos hechos en el diseño:
1. **L2b descartada (falsa consolidación).** Fusionar `handoff-ingest` (ingestión de diseño → stack) con `contract-sync-audit` (drift de API front/back) los agrupa por similitud superficial ("ambos tocan el contrato"), pero son funciones cognitivas distintas — justo lo que la filosofía de Specture evita. Solo se fusiona **L2a** (learn + audit-knowledge = un dominio real: higiene del docs-index).
2. **L3 se subsume en L4.** "Modularizar la tríada v1.7.0 según uso" requiere telemetría que no es medible en el repo del framework. Pero el perfil `lean` (de L4) ya apaga esa tríada → L3 se cumple sin esperar datos. Los datos solo informan, más adelante, *cuál perfil es el default*.

## Decisiones cerradas

| # | Decisión | Elección |
|---|----------|----------|
| **Q1** | alcance de fusión (L2) | **Solo conocimiento**: `learn` + `audit-knowledge` → una skill `knowledge` con modos `capture`/`audit`. NO fusionar handoff/contract-sync. Alias viejos preservados. 16→15 skills (conceptualmente). |
| **Q2** | toggles §10 (L4) | **Perfiles + podar**: agregar `specture.profile: lean \| full \| custom`; podar los 3 sub-toggles finos de learn a defaults hardcodeados. |
| derivada | L3 | **Subsumida en el perfil `lean`** (apaga docs_index + knowledge). |

## 1. L2a — Fusionar learn + audit-knowledge → skill `knowledge`

Mismo dominio (higiene del docs-index), operaciones opuestas pero hermanas: `capture` escribe conocimiento; `audit` lo chequea.

- **NUEVA `skills/knowledge/SKILL.md`** con dos modos:
  - **`capture`** (= ex-`learn`): captura post-epic/debug/manual de conocimiento durable (entradas docs-index, drafts de ADR, patches de conventions, bridges). Max 3 drafts, aprobación granular vía Plan mode.
  - **`audit`** (= ex-`audit-knowledge`): auditoría periódica read-only del drift del docs-index (orphans, stale, duplicates, uncovered) + health score.
- **Dedup:** el preámbulo/doctrina compartido (qué es el docs-index, contexto restringido, telemetría fail-open) se escribe **una vez** → el skill fusionado pesa menos que learn (305) + audit (217) sumados.
- **Alias preservados (backward-compat):**
  - `skills/learn/SKILL.md` → stub fino que redirige a `knowledge` modo `capture`.
  - `skills/audit-knowledge/SKILL.md` → stub fino que redirige a `knowledge` modo `audit`.
  - *(Si el plugin soporta alias de comando nativos, usarlos y eliminar los dirs stub. Si no, los stubs garantizan que `/specture:learn` y `/specture:audit-knowledge` sigan funcionando.)*
- **Callers internos actualizados** a invocar `knowledge` (capture): `build/SKILL.md` Step 8.5, `debug/SKILL.md` Phase 4.5.
- **`setup-docs-bridge`: sin cambios** (ya es sub-skill de `setup`; no se fusiona).
- **`handoff-ingest` + `contract-sync-audit`: sin cambios** (decisión Q1 — no fusionar).

## 2. L4 — Perfiles + poda de toggles en `conventions.md §10`

> **No tocar la numeración de §10/§11** — hay referencias a "Section 10" en skills/código. El perfil se agrega *dentro* de §10.

### Perfil (el knob del caso común)
```markdown
- **specture.profile**: lean | full | custom   # atajo; expande a los toggles de abajo
```
| Perfil | hooks | context7 | docs_index | knowledge |
|--------|-------|----------|------------|-----------|
| `lean`  | on | off | off | off  | ← apaga la tríada v1.7.0 (cumple L3) |
| `full`  | on | on  | on  | on   |
| `custom`| (lee los toggles individuales de abajo) |

- **Default (sin `specture.profile`)** = comportamiento actual (los defaults individuales de hoy) → **backward-compat total**.
- `lean`/`full` son atajos opt-in; `custom` = control fino.
- `hooks` (TDD gate) queda **on** incluso en `lean` — es valor core, no peso.

### Poda
- **Eliminar** de §10 los 3 sub-toggles finos (casi nadie los cambia) → **hardcodear defaults** en `knowledge`:
  - `learn.min_session_threshold_minutes` → 30
  - `learn.max_drafts_per_invocation` → 3
  - `learn.write_human_report` → false (capture puede generarlo a pedido)
- **Renombrar** `learn.enabled` → `knowledge.enabled` (gate de los prompts de capture en build 8.5 / debug 4.5).

### §10 resultante
`specture.profile` (nuevo) · `hooks.enabled` · `context7.enabled` · `docs_index.enabled` · `docs_index.max_entries_per_dispatch` · `knowledge.enabled`.
→ **De 8 toggles individuales a "1 perfil (caso común) o 6 en custom"**. El perfil es la ganancia cognitiva.

## 3. Backward-compat

- `/specture:learn` y `/specture:audit-knowledge` siguen funcionando (alias).
- **Sin `specture.profile`** → comportamiento idéntico a v1.10.0 (defaults individuales).
- Proyectos con `learn.*` viejos: `learn.enabled` se lee como `knowledge.enabled`; los 3 sub-toggles podados se ignoran (aplican los defaults hardcodeados). Documentar en el changelog.

## 4. Alcance de implementación (para la fase de build futura)

- **NUEVA** `skills/knowledge/SKILL.md` (merge de learn + audit con modos `capture`/`audit`, preámbulo dedup).
- `skills/learn/SKILL.md` + `skills/audit-knowledge/SKILL.md` → stubs de alias (o eliminarlos si hay alias de comando nativos).
- `skills/build/SKILL.md` (Step 8.5) + `skills/debug/SKILL.md` (Phase 4.5) → invocar `knowledge` capture; gate `knowledge.enabled`.
- `skills/start/SKILL.md` → tabla transversal: `knowledge` (+ alias).
- `templates/project-config/conventions.template.md` §10 → agregar `specture.profile` + tabla de perfiles; renombrar `learn.enabled`→`knowledge.enabled`; eliminar los 3 sub-toggles. **Sin renumerar §10/§11.**
- `skills/setup/SKILL.md` → escribir `specture.profile` (bootstrap pregunta lean/full/custom; default = backward-compat); usar `knowledge.enabled`.
- `CLAUDE.md` (entry point) + `README.md` → tabla de skills y referencia de slash commands (`knowledge` con modos; learn/audit como alias), doc de §10/perfiles, **changelog v1.11.0** (no reescribir historia) + bump de `plugin.json`.
- `templates/LEARN_OUTPUT_TEMPLATE.md` → se conserva (lo usa capture para el reporte humano opcional); renombrar a `KNOWLEDGE_OUTPUT_TEMPLATE.md` es opcional.

## 5. Diferido / no incluido

- **No fusionar** handoff-ingest + contract-sync-audit (decisión Q1).
- **Default de perfil informado por datos:** una vez que haya telemetría de uso real (`index-usage.jsonl`, `learn-history.jsonl`, `audit-history.jsonl`) a través de proyectos, decidir si el default debería pasar de "backward-compat" a `lean`.

## 6. Verificación

1. Disciplina `write-skill` por skill/agente tocado (baseline → cambio → verify).
2. Pruebas:
   - `/specture:learn` → enruta a `knowledge` capture (alias vivo); `/specture:audit-knowledge` → `knowledge` audit.
   - `specture.profile: lean` → docs_index + knowledge **off**; `full` → **on**; sin perfil → comportamiento v1.10.0.
   - build Step 8.5 / debug 4.5 invocan `knowledge` capture y respetan `knowledge.enabled`.
   - §10 muestra `specture.profile` + 6 toggles; los 3 sub-toggles de learn **ya no están**; defaults hardcodeados aplican.
   - Grep: referencias a "Section 10" intactas (sin renumerar); ningún caller roto a `learn`/`audit-knowledge`.
3. Conteo de skills conceptual: 16→15 (knowledge unifica dos); handoff/contract-sync intactas.
