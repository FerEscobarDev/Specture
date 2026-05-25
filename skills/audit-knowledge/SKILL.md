---
name: audit-knowledge
description: Use periodically (every 1-3 months in mature projects) or whenever the docs-index seems out of sync with the actual repo. Detects entries pointing to missing files, stale `last_verified` dates, duplicate concepts, and docs in the source-of-truth dir that are NOT in the index. Reports drift but does NOT auto-fix — proposes actions for the user to confirm.
---

# Transversal — Knowledge Index Audit

You are an **Index Auditor**. The `docs-index.yml` accumulates drift silently as the team adds/renames/deletes docs. This skill catches that drift before it pollutes agent dispatches.

## Iron Rules

```
1. READ-ONLY by default. The audit reports findings, never mutates the index.
2. NEVER delete entries automatically. The user confirms.
3. NEVER promote `ai_categorized` → `user_confirmed`. Only humans do that.
4. NEVER mark "Proposed" ADRs as `Accepted`. Same rule as everywhere else.
```

## When This Skill Activates

- Manual: user says "audita el índice" / "/specture:audit-knowledge".
- After a long period without `/specture:learn` invocations (heuristic: if `learn-history.jsonl` has no entries in the last 90 days, suggest running this).
- After `setup-docs-bridge` runs on a project that already had a partial index (sanity check).

## Required Inputs

- `.specture/docs-index.yml` (must exist — if not, respond *"No hay índice que auditar. Si querés generar uno, corré `/specture:setup-docs-bridge`."* and stop).
- `.specture/conventions.md` — read `source_of_truth_dir` from §11 (fallback to the `source_of_truth_dir` field inside the index itself).
- File system access to walk the source-of-truth dir.

## Phase 1 — Load and Parse the Index

Read `.specture/docs-index.yml` once, full. (It's small — even SGD's 70+ entries fit in ~700 lines.)

Build an in-memory map: `concept → entry`.

## Phase 2 — Detect Drift (4 checks)

### Check 1 — Orphan entries (file missing)

For each entry: check whether `entry.file` exists on disk.

- If exists → OK.
- If missing → **ORPHAN**. The file was moved, renamed, or deleted, but the index was not updated.

### Check 2 — Stale `last_verified`

For each entry with a valid `last_verified`:

- Age = today − last_verified.
- If age > 180 days (6 months) → **STALE**. The entry has not been re-verified in a long time; its `read_when` may not match current reality.
- If age > 365 days → **VERY STALE** (higher severity).

If `last_verified` is missing or malformed → **UNKNOWN_AGE** (lower severity, but should be fixed).

### Check 3 — Duplicate concepts

Group entries by `tags` (frozenset) AND first 8 words of `read_when`.

- If two or more entries share the same group → **DUPLICATE_CANDIDATE**. The user must confirm if they're actually duplicates or just adjacent.

### Check 4 — Uncovered files (gap)

Walk the source-of-truth dir for `.md` files. For each file:

- If its path matches `entry.file` for some entry → covered.
- If not → **UNCOVERED**. The doc exists but is not in the index. New docs added after the last index update.

## Phase 3 — Compute Severity

| Finding | Severity |
|---|---|
| ORPHAN | HIGH (active drift — agents may try to read missing files) |
| DUPLICATE_CANDIDATE | MEDIUM (wastes context budget) |
| VERY STALE (>365 days) | MEDIUM |
| STALE (>180 days) | LOW |
| UNCOVERED | LOW (doc exists but is invisible to agents) |
| UNKNOWN_AGE | LOW |

## Phase 4 — Generate Reports

### Machine-readable log

Append one row to `docs/.specture-meta/audit-history.jsonl` (create dir if absent, fail-open):

```json
{
  "ts": "<ISO-8601>",
  "total_entries": N,
  "orphans": [{"concept": "...", "file": "..."}],
  "duplicates": [{"group": [...]}],
  "stale": {"180d": [...], "365d": [...]},
  "uncovered": ["<file1>", "<file2>"],
  "unknown_age": [...],
  "health_score": <0..100>
}
```

`health_score = 100 - (orphans*10 + duplicates*5 + very_stale*3 + stale*1 + uncovered*2)` capped at 0.

### Human-readable report

Write `docs/.specture-meta/last-audit.md` (overwrite previous):

```markdown
# Knowledge Index Audit — YYYY-MM-DD

> Reporte de auditoría del índice de documentación.
> Skill: `/specture:audit-knowledge`. Health score: <N>/100.

## Resumen

- Entradas totales: <N>
- Orphans (HIGH): <K>
- Duplicates (MEDIUM): <M>
- Stale (LOW/MEDIUM): <S> (>180d: <a>, >365d: <b>)
- Uncovered (LOW): <U>
- Unknown age (LOW): <X>

## Acciones sugeridas

### HIGH — Orphans
[lista de entradas cuyo `file` no existe]

Acción: o eliminá la entrada del índice, o actualizá el path si el doc fue movido.
NO se auto-aplica. Para borrar: editá `.specture/docs-index.yml` directamente o
invocá `/specture:setup-docs-bridge` para refresh general.

### MEDIUM — Duplicates
[grupos de entradas similares]

Acción: revisá cada grupo. Si son duplicados reales, consolidá manualmente
(`superseded_by` apunta al que queda, o eliminá la redundante).

### MEDIUM — Very Stale (>365 días sin verificar)
[lista]

Acción: leé el doc, validá que `read_when` y `tags` siguen siendo correctos,
actualizá `last_verified: <hoy>` y considerá promover a `user_confirmed` si
aplica.

### LOW — Stale (>180 días)
[lista]

Acción: revisar cuando se pueda. Misma corrección que very-stale.

### LOW — Uncovered (docs no indexados)
[lista de archivos en source-of-truth dir sin entrada]

Acción: corré `/specture:learn` (modo manual) para que proponga entries para
estos archivos. O agregá manualmente al índice.

### LOW — Unknown age
[lista]

Acción: agregá `last_verified` a estas entradas.

## Próximos pasos

- Si el health score está por debajo de 70, sugerimos correr `/specture:setup-docs-bridge`
  en modo refresh para regenerar el índice desde cero (preserva entradas confirmadas).
- Si hay muchos uncovered, vale invocar `/specture:learn` para que vayan entrando.
```

## Phase 5 — Report to User

Output a compact summary to the conversation:

```
Audit completo. Health: <N>/100.

  Orphans (HIGH):       <K> entradas apuntan a archivos inexistentes
  Duplicates (MEDIUM):  <M> grupos posiblemente redundantes
  Stale:                <S> total (<a> >365d, <b> >180d)
  Uncovered:            <U> docs en <source-dir> sin entrada en el índice
  Unknown age:          <X>

Reporte completo: docs/.specture-meta/last-audit.md
Log estructurado:  docs/.specture-meta/audit-history.jsonl

Acción sugerida:
  <one-line based on health score>:
    - >85 → "Índice saludable. Re-correr en 1-3 meses."
    - 60-85 → "Limpieza menor recomendada. Revisar la sección HIGH+MEDIUM."
    - <60 → "Drift significativo. Considerá un refresh con /specture:setup-docs-bridge."
```

## Verification Before Exit

- [ ] `docs/.specture-meta/last-audit.md` written (or fail-open noted).
- [ ] `docs/.specture-meta/audit-history.jsonl` appended (or fail-open noted).
- [ ] **NO changes to `.specture/docs-index.yml`** (this skill is read-only by contract).
- [ ] **NO changes to ADR statuses** (Proposed stays Proposed).
- [ ] Summary reported to user with health score.

## What This Skill Does NOT Do

- ❌ Auto-fix orphans by deleting entries.
- ❌ Auto-consolidate duplicates.
- ❌ Promote `ai_categorized` → `user_confirmed`.
- ❌ Re-index uncovered files (use `/specture:learn` or `/specture:setup-docs-bridge`).
- ❌ Touch source-of-truth files. The audit is non-invasive.
- ❌ Promote Proposed ADRs to Accepted.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Borrar entradas orphan "porque obviamente sobran" | Reportar, dejar al usuario decidir |
| Consolidar duplicates automáticamente | Marcar como candidatos, usuario confirma |
| Refrescar `last_verified` durante el audit "porque ya las miré" | Solo humanos refrescan ese campo |
| Llenar el reporte con findings de severidad arbitraria | Severidades son fijas (tabla en Phase 3) |
| Saltarse el log de history "porque la carpeta no existe" | Crearla; fail-open si falla |

## Tone

Direct, numeric, action-oriented. The user reads the summary and either acts or schedules action — your job is to surface drift, not to lecture.
