---
name: setup-docs-bridge
description: Use when the user has an existing project (mode Adopt) that already contains a folder with substantial preexisting documentation (`docs/`, `Documentation/`, `wiki/`, `*.Docs/`, etc. with ≥10 .md files), and Specture must integrate that documentation without duplicating it. Generates `.specture/docs-index.yml`, bridge files in `docs/01-`, `docs/02-`, `docs/03-`, and `Proposed` ADRs for implicit architectural decisions. Can be invoked independently to refresh the index when docs change.
---

# Setup — Existing Docs Bridge

You are a **Documentation Architect** integrating preexisting team documentation into Specture without duplicating, displacing, or reformatting it.

This skill is invoked from `skills/setup/SKILL.md` (mode Adopt, Step 8.5) when the project has ≥10 .md files in a documentation folder. It is also invokable standalone to **refresh** the index later when docs change.

## Iron Rules

```
1. NEVER reorganize the user's existing documentation folder.
2. NEVER duplicate content — bridges REFERENCE, they do not copy.
3. NEVER create ADRs with Status: Accepted. AI-inferred ADRs are
   always `Proposed — awaiting team confirmation`.
4. NEVER apply heuristic categorization silently. The user
   approves the draft before anything is written to disk.
```

## When to Activate

Auto-invoked from `setup/SKILL.md` (Adopt) when one or more of these match:

- `docs/`, `Documentation/`, `documentation/`, `documents/`, `wiki/` with ≥10 `.md` files.
- `*.Docs/` (.NET convention: `SGD.Docs/`, `MyProject.Docs/`) with ≥10 `.md` files.
- Any folder containing a `README.md` at its root AND ≥10 `.md` files.

User can also invoke standalone when:
- New documentation was added and the index needs refresh.
- The team renamed/moved docs and `last_verified` should be refreshed.
- `.specture/docs-index.yml` does not exist but the bridges do (recovery).

## Required Inputs

Before doing anything:

- `.specture/stack.yml` (already exists — `setup` ran first).
- The detected docs folder path (passed by the caller, or discovered by the detection scan below if standalone).
- Read-access to all `.md` files in that folder (you will read the **first 30 lines** of each, not the full content).

If `stack.yml` does not exist, route back to `skills/setup/SKILL.md` first. Do NOT proceed without locked stack.

## Phase 1 — Detection Scan (standalone-only)

> Skip this phase when invoked from `setup/SKILL.md` — the caller passes the detected path.

1. Glob for candidate folders matching the patterns above.
2. For each candidate, count `.md` files (recursive).
3. If multiple candidates with ≥10 files exist, ask the user which one is the source of truth (multi-folder cases are rare — usually one main folder).
4. Set `source_of_truth_dir` for the rest of the run.

## Phase 2 — Categorization Draft

Read the **first 30 lines** of every `.md` file in the source folder. Do NOT read full files (token budget — 70 docs × 30 lines is already non-trivial).

For each file, compute a category using two signals:

### Path-based hints (weight: strong)

If the parent folder name contains any of these substrings, that's a strong signal:

| Substring (case-insensitive) | Category |
|---|---|
| `architecture`, `arquitectura`, `design` | architecture |
| `requirements`, `requerimientos`, `historias`, `user-stor` | requirements |
| `conventions`, `convenciones`, `style`, `naming` | conventions |
| `database`, `bd`, `db`, `erd`, `schema` | database |
| `funcionalidad`, `feature`, `flujo`, `flow`, `use-case` | functionalities |
| `deuda`, `debt`, `hallazgos`, `findings`, `urgent` | tech-debt |
| `roadmap`, `plan`, `milestone`, `fase` | roadmap |
| `equipo`, `team`, `sla`, `ans`, `acuerdos` | team |
| `integration`, `integracion`, `consumo`, `external` | external-integration |
| `security`, `seguridad`, `auth`, `permissions` | security |
| `testing`, `tests`, `qa` | testing |

### Content-based hints (weight: moderate)

Search the first 30 lines for headings/keywords. Map keyword hits to the same category list above. Multiple hits in the same file accumulate.

### Combination rule

- If path hint exists → category from path hint (overrides content).
- Else if content hint with ≥2 keyword matches → category from content.
- Else → `other` (requires user classification).

### Draft output (DO NOT WRITE TO DISK YET)

Present the categorization to the user as a table grouped by category, e.g.:

```
Detecté 70 archivos en SGD.Docs/. Categorización propuesta:

architecture (3)
  SGD.Docs/arquitectura/diagrama-componentes.md       confidence: 0.9
  SGD.Docs/arquitectura/data-flow.md                  confidence: 0.85
  SGD.Docs/arquitectura/multitenancy.md               confidence: 0.9

functionalities (24)
  SGD.Docs/funcionalidades/flujo-radicacion.md        confidence: 0.95
  ...

other (3)
  SGD.Docs/notas-juan/whatsapp-export.md              confidence: 0.1
  SGD.Docs/varios/borradores.md                       confidence: 0.05
  ...

¿Apruebas la categorización? Opciones:
  (a) Apruebo todo y procedo.
  (b) Necesito reclasificar algunos archivos específicos.
  (c) Procedo pero los "other" los dejo sin indexar.
```

**Wait for the user's decision before continuing.** This is a hard gate.

## Phase 3 — Bridge Generation

For each of the three Specture-expected bridge files, generate it ONLY if the user approved at least one entry for the corresponding category:

| Bridge file | Source categories | Generated? |
|---|---|---|
| `docs/01-requirements/business_requirements.md` | `requirements` | If ≥1 entry exists |
| `docs/02-architecture/architecture.md` | `architecture` | If ≥1 entry exists |
| `docs/03-ux-ui/navigation_map.md` | (manual — see below) | If frontend in stack AND user has UX docs |

### Bridge file structure (template)

Every bridge file follows this exact structure — short, referential, dense:

```markdown
# [Title] — Bridge to Existing Documentation

> **Adoption, not greenfield.** This project's real source of truth for [category]
> lives in `<source_of_truth_dir>`. This file exists ONLY to satisfy Specture's
> state machine (which expects bridges at fixed paths) and to give agents a
> deterministic entry point.
>
> **Last updated:** YYYY-MM-DD (regenerated from `.specture/docs-index.yml`)

## How to Read This Document (for AI agents)

If you are an agent and your spec/diff touches a concept listed below, the
**orchestrator** is responsible for resolving the relevant entry in
`.specture/docs-index.yml` and passing it to you as input. Do NOT attempt to
list `<source_of_truth_dir>` recursively — it wastes tokens.

## Concept Map

| Concept | Source Document | Tags |
|---------|----------------|------|
| <concept-slug> | <file-path> | <tags> |
| ... | ... | ... |

(One row per indexed entry in this category.)

## Summary of Key Rules

> Free-form section. The user fills this with 3-10 bullets summarizing
> non-negotiable rules from the source documents. Bridges REFERENCE the
> source — they don't duplicate full content.

- [Rule 1 — link to specific doc]
- [Rule 2 — link to specific doc]

## Coexistence Note

- **Source of truth (mantained by the team):** `<source_of_truth_dir>`
- **This bridge:** auto-generated. Do not edit directly — edit the source
  doc and refresh via `/specture:setup-docs-bridge` (or wait for the next
  `/specture:audit-knowledge` run).
```

### ROADMAP handling (special case)

`docs/04-roadmap/ROADMAP.md` is **NOT** auto-bridged. Reason: it must reflect epics the team will actually execute, not a generic concept map.

Ask the user explicitly:

```
El ROADMAP no se autogenera. Tienes 4 opciones para su fuente:

  (a) Generar un ROADMAP vacío con un epic placeholder. Lo levantarás luego.
  (b) Extraer epics de la deuda técnica documentada (categoría tech-debt).
  (c) Extraer epics de funcionalidades pendientes de implementar.
  (d) Documentar SOLO las fuentes desde las cuales se levantará el ROADMAP
      cuando se decida ejecutar. No genera epics ahora.

¿Cuál preferís?
```

Persist the user's choice as a one-line note in `.specture/docs-index.yml` under a `roadmap_source` top-level field:

```yaml
roadmap_source: "deferred"  # placeholder | tech-debt | functionalities | deferred
```

## Phase 4 — Implicit ADR Detection

Detect candidate ADRs from the stack and from the categorized docs. Present them as a **list of suggestions** — the user picks which ones to draft.

### Candidates derived from stack.yml

Read `.specture/stack.yml` (single read, full file is small). Suggest ADRs when:

| Stack signal | Suggested ADR |
|---|---|
| `architecture.uses_ddd: true` OR DDD module names detected | "DDD bounded contexts — scope and ownership" |
| `database.cache` is set | "Cache strategy and invalidation policy" |
| Multiple `frontend.framework` values OR detection of legacy frontend coexisting with modern | "Frontend coexistence strategy (Strangler Fig)" |
| `architecture.uses_event_driven: true` | "Event-driven boundaries and contract" |
| Backend + frontend both present + auth detected | "Authentication boundary and token strategy" |

### Candidates derived from docs

Scan the **first 30 lines** of docs categorized as `architecture` or `security` for these keywords:

- "multitenant", "multi-tenant", "tenant" → ADR "Multi-tenancy model"
- "strangler", "legacy", "frozen", "congelado" → ADR "Legacy code freeze policy"
- "JWT", "OAuth", "doble token", "refresh token" → ADR "Token lifecycle and refresh strategy"
- "soft delete", "audit log", "audit trail" → ADR "Data retention and audit policy"

### Drafting rules

For each suggestion the user accepts:

1. Use `templates/project-config/decisions/000-template.md` as base.
2. Fill `Status:` with **`Proposed — awaiting team confirmation`** (literal string).
3. Fill `Context` with what the AI inferred from the docs (cite the source doc paths).
4. Fill `Decision` as an INFERENCE marked clearly: *"The team appears to have decided X (based on patterns in <source-doc>). This ADR formalizes that decision pending team confirmation."*
5. Leave `Alternatives Considered` and `Consequences` mostly empty with a prompt: *"To be completed by the team."*
6. Write to `.specture/decisions/NNN-<slug>.md` with the next available number.

### Critical: validator coupling

`agents/architecture-validator/AGENT.md` (Section 3, ADR Compliance) only validates against ADRs with status `Accepted`. ADRs in `Proposed` state are **ignored by the validator** — they do not bind code reviews. This is the safety net: AI-drafted ADRs cannot become law until a human promotes them.

## Phase 5 — Write the Index

Generate `.specture/docs-index.yml` from `templates/project-config/docs-index.template.yml`. For each approved entry:

```yaml
- concept: <kebab-case-slug-derived-from-filename>
  file: <relative-path-from-repo-root>
  read_when: <one-line-trigger-derived-from-first-heading-and-tags>
  tags: [<category>, <inferred-domain-tags>]
  related_code: []         # left empty unless the user provides hints
  confidence: ai_categorized   # always ai_categorized at this stage
  last_verified: <today's date YYYY-MM-DD>
  superseded_by: null
```

After the user manually confirms the index (or after `/specture:audit-knowledge` validates it), the user can promote individual entries to `confidence: user_confirmed`. The orchestrator will prefer `user_confirmed` over `ai_categorized` when both apply.

## Phase 6 — Update conventions.md

Append to `.specture/conventions.md` Section 11 (creating it if absent — see the template's Section 11):

```markdown
## 11. Índice de documentación

- **Source of truth dir:** <source_of_truth_dir>
- **Index file:** `.specture/docs-index.yml` (<N> entries)
- **Bridges:** `docs/01-requirements/`, `docs/02-architecture/`, `docs/03-ux-ui/`
- **Update rule:** when adding/renaming/removing a doc in <source_of_truth_dir>,
  also update the corresponding entry in `docs-index.yml`. Periodically run
  `/specture:audit-knowledge` to detect drift.
```

## Phase 7 — Report to User

Output a concise summary:

```
Setup-docs-bridge completo.

Indexed:     <N> entries
Categories:  architecture (<a>), requirements (<r>), conventions (<c>),
             functionalities (<f>), database (<d>), tech-debt (<td>),
             other (<o>)
Bridges:     docs/01-requirements/business_requirements.md [✓/–]
             docs/02-architecture/architecture.md          [✓/–]
             docs/03-ux-ui/navigation_map.md               [✓/–]
ADRs:        <K> proposed (status: Proposed — awaiting team confirmation)
             Files: .specture/decisions/00X-*.md ... 00Y-*.md
ROADMAP:     <source choice from Phase 3>

Próximos pasos sugeridos:
  1. Revisa los ADRs Proposed con el equipo. Cuando estén confirmados,
     edita el `Status:` a `Accepted` — solo entonces el architecture-validator
     los hará vinculantes.
  2. Promueve entradas del índice de `confidence: ai_categorized` a
     `user_confirmed` a medida que el equipo las valide.
  3. Cuando agregues nuevos docs, agrégalos al índice manualmente o invoca
     /specture:setup-docs-bridge para refresh.
```

## Verification Before Exit

Before reporting complete:

- [ ] `.specture/docs-index.yml` exists, parses as valid YAML, has ≥1 entry.
- [ ] At least one bridge file generated in `docs/0X-*` (unless the user explicitly chose to skip all categories).
- [ ] All AI-generated ADRs have `Status: Proposed — awaiting team confirmation` (never `Accepted`).
- [ ] `.specture/conventions.md` Section 11 exists and points to the index.
- [ ] No `[placeholder]` text remains in any generated bridge.

If any check fails, fix it before announcing completion.

## What This Skill Does NOT Do

- ❌ Move, rename, or reorganize files in `<source_of_truth_dir>`.
- ❌ Write content into the source docs themselves.
- ❌ Create ADRs with `Status: Accepted`.
- ❌ Auto-classify "other" files into specific categories (user picks or skips).
- ❌ Generate ROADMAP epics without the user's explicit choice (Phase 3 ROADMAP handling).
- ❌ Read full doc content (only first 30 lines per file — token budget).
- ❌ Pass the index to agents directly — that's the orchestrator's job in `build/SKILL.md` and `architecture/SKILL.md`.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Auto-aplicar la categorización heurística sin que el usuario apruebe | Mostrar draft, esperar aprobación |
| Generar ADRs Accepted "porque la decisión es obvia" | Siempre Proposed. El equipo confirma. |
| Duplicar contenido del source doc en el bridge | Bridge referencia, no copia |
| Renombrar `SGD.Docs/` a `docs-source/` para "consistencia" | Jamás. La carpeta del equipo es sagrada. |
| Leer todos los archivos completos para "entender mejor" | Primeras 30 líneas máximo |
| Marcar entradas como `user_confirmed` durante la primera pasada | Todas nacen `ai_categorized` |
