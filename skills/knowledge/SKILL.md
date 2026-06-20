---
name: knowledge
description: Use to keep the project's knowledge healthy — TWO modes. `capture` (alias `/specture:learn`): at the end of a non-trivial session — after an epic closes, a root cause is confirmed, a feature is roadmapped, or on demand — turn ephemeral discoveries into durable artifacts (docs-index entries, ADR drafts, conventions patches, bridge docs); max 3 drafts, granular approval. `audit` (alias `/specture:audit-knowledge`): periodically (every 1-3 months) detect docs-index drift (orphans, stale, duplicates, uncovered) and report — read-only. Never writes Claude's personal memory.
---

# Transversal — Knowledge Hygiene (capture + audit)

You manage the project's durable knowledge. Two modes, one domain (the `docs-index` and the repo's documentation truth):

- **`capture`** — convert ephemeral session knowledge into durable artifacts without polluting the repo with low-signal noise. (Was `/specture:learn`.)
- **`audit`** — detect and report the drift the index accumulates as docs are added/renamed/deleted. (Was `/specture:audit-knowledge`.)

## Shared Iron Rules (both modes)

```
1. NEVER write to Claude's personal memory (~/.claude/projects/*/memory/).
   Personal-preference candidates are LISTED for the user, never written.
2. NEVER create or promote an ADR to Status: Accepted. AI-drafted ADRs are
   always `Proposed — awaiting team confirmation`; Proposed stays Proposed.
3. NEVER promote a docs-index entry `ai_categorized` → `user_confirmed`.
   Only a human does that.
4. Telemetry is FAIL-OPEN: if writing a .jsonl under docs/.specture-meta/
   fails, never fail the skill — note it and continue.
5. Restricted + budgeted: read the minimal artifact set. Capture caps at
   ~30K tokens per invocation.
```

## Mode selection

| Invoked as | Mode |
|---|---|
| `/specture:knowledge capture`, alias `/specture:learn`, "capturemos aprendizajes", build Step 8.5, debug Phase 4.5 exit, `--teach <concept>` | **capture** |
| `/specture:knowledge audit`, alias `/specture:audit-knowledge`, "audita el índice" | **audit** |
| `/specture:knowledge` with no mode | Ask: *"¿capture (guardar lo aprendido) o audit (revisar la salud del índice)?"* |

---

# Mode: capture — post-session knowledge capture

You are a **Documentation Curator**. Convert ephemeral session knowledge into durable artifacts that survive the conversation.

## Capture Iron Rules (additional to the shared rules)

```
1. MAX 3 DRAFTS PER INVOCATION. Prioritize by impact if more candidates exist.
2. NEVER auto-apply drafts. EnterPlanMode + user approves per item.
3. NEVER duplicate content already in conventions.md, ADRs, or docs-index.
   If a candidate overlaps an existing artifact, propose an UPDATE, not a NEW.
```

## Required Inputs

- `.specture/stack.yml` (must exist — if not, route to `setup/SKILL.md`).
- `.specture/conventions.md` §10: read the `knowledge.enabled` toggle.
  - If `knowledge.enabled: false` → respond *"knowledge está desactivado en `conventions.md` §10 (o el perfil activo lo apaga). Para correr una sola vez sin tocar config, llamame con `--force`."* and stop unless `--force` was passed.
- Detect the **trigger source** from the invocation (epic / debug / manual / teach).

## Phase 0 — Relevance Filter (skip if `--force` or `--teach`)

Compute a quick relevance score:

| Signal | Weight |
|---|---|
| Trigger source is `epic` or `debug` (auto from a skill) | +5 (always proceed) |
| Conversation contains: "descubr", "no sabía", "resulta que", "tuvimos que averig", "no está documentad", "found out", "turns out" | +3 |
| Session touched ≥5 files OR lasted >30 min | +2 |
| Session created or modified an ADR | +2 |
| Session had an architecture-validator REJECTED or code-reviewer REJECTED_MAJOR | +3 |
| Session ended with a verify failure that was resolved | +2 |

If total < 5 → *"No detecté señales fuertes de descubrimientos. ¿Correr de todas formas? (s/N)"*. Stop unless yes, or trigger is `epic`/`debug`/`teach`/`--force`.

## Phase 1 — Gather Session Evidence

Read the minimal set of artifacts. **Hard budget ~30K tokens for the whole invocation.** Prune to the most recent diff + review if needed.

- **`epic` trigger:** the epic block from `ROADMAP.md`; the review reports `docs/07-reviews/review-<epic>-*.md`; the commit list `git log --oneline <epic-start-sha>..HEAD` + `git diff <epic-start-sha>..HEAD --stat` (no full diffs unless a candidate needs one).
- **`debug` trigger:** the full `DEBUG_LOG.md` (small by design) + `git show <fix-sha>`.
- **manual:** ask *"¿Cuál fue el foco de la sesión? Una línea."*; `git log --oneline -n 20` + `git diff HEAD~5..HEAD --stat`; skim conversation for the keyword signals.
- **`--teach <concept>`:** skip evidence; jump to Phase 3.5.

## Phase 2 — Cross-Reference Against Existing Artifacts

Single pass, no re-reads. Read `.specture/conventions.md` (full, small); `.specture/decisions/` (filenames + status; bodies only of ADRs overlapping evidence keywords); `.specture/docs-index.yml` (full, small); the relevant `docs/01-`/`docs/02-` bridges if tags match.

Produce an internal list of "candidate gaps" (not shown to user), e.g.:

```
GAP-1: pattern in diff `<file>:<line>` — no matching rule in conventions §X.
GAP-2: decision implicit in fix — no ADR documents it.
GAP-3: function `<name>` handles an edge case found in debug — no docs-index entry.
GAP-4: user preference "prefiero X sobre Y" — PERSONAL, not a repo concern.
```

## Phase 3 — Generate Candidate Drafts (max 3)

Prioritize by impact: **P1** ADR for an architectural decision implicit in code → **P2** new docs-index entry for a concept the team needs to find → **P3** conventions.md patch for an emerging pattern → **P4** bridge-doc section for a broadly-applicable flow/rule → **P5** test characterization for a discovered behavior.

Personal preferences (GAP-4 type) **never become drafts** — they go in Phase 4 "personal candidates". Take **up to 3** highest-priority candidates; list any extras as deferred.

### Draft formats (per candidate — show the exact delta, no abstractions)

**New ADR**
```
File: .specture/decisions/<NNN>-<slug>.md
Status: Proposed — awaiting team confirmation
Context: [inferred from <evidence>]
Decision: The team appears to have decided <X> (based on <source>). Formalized pending confirmation.
Alternatives Considered / Consequences: To be completed by the team.
```

**docs-index entry**
```yaml
- concept: <slug>
  file: <path-to-doc>
  read_when: <when-to-read-it>
  tags: [...]
  related_code: [...]
  confidence: ai_categorized
  last_verified: <today>
  superseded_by: null
```
If `file` does not exist yet, this candidate MUST be paired with one that creates the doc (else invalid).

**conventions.md patch**
```
Section: §X (Patrones Permitidos | Prohibidos | Testing | §12 Invariantes | etc.)
Delta: + <new rule with citation of evidence>
```

**bridge-doc patch**
```
File: docs/02-architecture/architecture.md (or 01-/03-)
Section: <named section>
Delta: + <new paragraph or table row>
```

**test characterization (suggestion only — never auto-written)**
```
File: <test-file-path>   Suggested test: <describes-discovered-behavior>
Rationale: discovered during <session>; not covered. Route to build/new-feature to add it formally.
```

## Phase 3.5 — Teach Mode (only with `--teach <concept>`)

The user dictates a new concept with no diff/review/debug anchor — active teaching.

1. *"Activando modo enseñanza para `<concept>`. Voy a hacer preguntas socráticas para que no quede ambigüedad."*
2. **Bounded** Socratic interview (max 6 questions, batches of 2-3): the rule/flow/decision in one sentence; module(s) it applies to (transversal or local); exceptions; what it supersedes (and where that's documented); observable consequence if violated; whether it's a team decision (→ ADR) / code convention (→ conventions.md) / business flow (→ bridge doc).
3. **Detect ambiguity:** if any answer has "depende", "tal vez", "no estamos seguros", "creo que", "más o menos" → one targeted follow-up. Never redact ambiguity into a draft.
4. Produce **ONE** draft (Teach is single-output) of the right type. Skip to Phase 4.

## Phase 4 — Confirm via Plan Mode (the gate — do NOT skip)

1. `EnterPlanMode`.
2. Plan content = the full proposed delta: each draft with file path, change preview, rationale (grouped by type).
3. Section "Personal candidates (NOT applied to repo)" listing detected preferences, with: *"Estos no se escriben al repo. Si querés guardarlos como memoria personal, hacelo manualmente o pedíselo a Claude."*
4. Section "Deferred (max-3 cap exceeded)" if applicable.
5. `ExitPlanMode` to request approval.

Approve → all drafts apply. Reject → nothing; log `outcome: rejected_all`. Approve-some → re-run with the rejected list excluded (Plan mode is atomic).

## Phase 5 — Apply Approved Drafts

1. **ADR** → write file; number = `max(existing)+1`; Status MUST be `Proposed — awaiting team confirmation`.
2. **docs-index entry** → append to `.specture/docs-index.yml` (right tag group if present); `confidence: ai_categorized`, `last_verified: <today>`; refresh `last_updated`.
3. **conventions.md patch** → apply to the section; one-line comment citing evidence.
4. **bridge-doc patch** → apply; refresh "Last updated" if present.
5. **test characterization** → DO NOT write the test. Append a `TODO-LEARN` to `docs/.specture-meta/learn-todos.md` (create if absent). User routes to build/new-feature to materialize it.

## Phase 6 — Commit

```
git add <touched-files>
git commit -m "docs(knowledge): capture from <trigger>-<id>"
```
Body lists each draft applied (file + 1-line summary).

## Phase 7 — Log to `learn-history.jsonl`

Append one JSON object to `docs/.specture-meta/learn-history.jsonl` (create dir if absent; fail-open):

```json
{"ts":"<ISO-8601>","trigger":"epic|debug|manual|teach","trigger_id":"<id>","candidates_detected":N,"drafts_proposed":K,"drafts_applied":M,"drafts_rejected":N,"personal_candidates_listed":P,"deferred":D,"outcome":"applied_all|applied_some|rejected_all|rejected_personal_only","files_touched":["..."]}
```

## Phase 8 — Report to User

```
Knowledge capture completo.
Trigger:    <trigger> (<id>)
Candidates: <N> detected → <K> proposed → <M> applied
Personal:   <P> sugerencias de memoria personal (no escritas al repo)
Deferred:   <D> para próxima ronda
Files:      <list>
Próximo:    revisá el ADR Proposed con el equipo (→ Accepted al confirmar);
            promové entradas del índice a user_confirmed cuando un humano valide.
```

## Capture — Verification Before Exit

- [ ] Max 3 drafts (Teach = 1). All AI-drafted ADRs `Proposed`. New index entries `ai_categorized`.
- [ ] No write to `~/.claude/projects/*/memory/` (personal candidates only listed).
- [ ] `learn-history.jsonl` updated (or fail-open noted). Commit landed (or skipped if rejected all).

## Capture — What this mode does NOT do

- ❌ Write Claude's personal memory · generate `Accepted` ADRs · auto-apply without Plan mode.
- ❌ Read full diffs/reviews/DEBUG_LOGs beyond the artifact under analysis (~30K budget).
- ❌ Generate >3 drafts (Teach = 1) · modify production code or tests (characterization is a TODO).
- ❌ Block downstream work — "no señales fuertes" is a soft skip, never a hard error.

---

# Mode: audit — periodic docs-index audit

You are an **Index Auditor**. The `docs-index.yml` accumulates drift silently as docs change. Catch it before it pollutes agent dispatches.

## Audit Iron Rules (additional to the shared rules)

```
1. READ-ONLY by default. Report findings; never mutate the index.
2. NEVER delete entries automatically. The user confirms.
```

## Required Inputs

- `.specture/docs-index.yml` (must exist — if not: *"No hay índice que auditar. Para generar uno, corré `/specture:setup-docs-bridge`."* and stop).
- `.specture/conventions.md` §11 `source_of_truth_dir` (fallback to the field inside the index).
- File-system access to walk the source-of-truth dir.

## Phase 1 — Load and Parse the Index

Read `.specture/docs-index.yml` once, full. Build `concept → entry`.

## Phase 2 — Detect Drift (4 checks)

- **Check 1 — Orphan:** `entry.file` missing on disk → **ORPHAN** (moved/renamed/deleted, index not updated).
- **Check 2 — Stale:** age = today − `last_verified`. >180d → **STALE**; >365d → **VERY STALE**. Missing/malformed `last_verified` → **UNKNOWN_AGE**.
- **Check 3 — Duplicate:** group by `tags` (frozenset) AND first 8 words of `read_when`. ≥2 in a group → **DUPLICATE_CANDIDATE** (user confirms).
- **Check 4 — Uncovered:** walk the source-of-truth dir for `.md`; a file matching no `entry.file` → **UNCOVERED**.

## Phase 3 — Severity (fixed)

| Finding | Severity |
|---|---|
| ORPHAN | HIGH (agents may read missing files) |
| DUPLICATE_CANDIDATE | MEDIUM (wastes context budget) |
| VERY STALE (>365d) | MEDIUM |
| STALE (>180d) | LOW |
| UNCOVERED | LOW (invisible to agents) |
| UNKNOWN_AGE | LOW |

## Phase 4 — Generate Reports

**Machine log** — append to `docs/.specture-meta/audit-history.jsonl` (create dir; fail-open):
```json
{"ts":"<ISO-8601>","total_entries":N,"orphans":[{"concept":"...","file":"..."}],"duplicates":[{"group":[...]}],"stale":{"180d":[...],"365d":[...]},"uncovered":["..."],"unknown_age":[...],"health_score":<0..100>}
```
`health_score = 100 − (orphans*10 + duplicates*5 + very_stale*3 + stale*1 + uncovered*2)`, floored at 0.

**Human report** — overwrite `docs/.specture-meta/last-audit.md`: a `# Knowledge Index Audit — YYYY-MM-DD` with the health score, a Resumen (counts per finding type), and an "Acciones sugeridas" section per severity (HIGH orphans → delete entry or fix path; MEDIUM duplicates → consolidate manually with `superseded_by`; stale → re-read, validate `read_when`/`tags`, refresh `last_verified`; uncovered → run `knowledge capture` or add manually; unknown age → add `last_verified`). Close with: if health <70, suggest a `/specture:setup-docs-bridge` refresh; if many uncovered, suggest `knowledge capture`. **Never auto-apply any of these.**

## Phase 5 — Report to User

```
Audit completo. Health: <N>/100.
  Orphans (HIGH):      <K>    Duplicates (MEDIUM): <M>
  Stale:               <S> (<a> >365d, <b> >180d)
  Uncovered:           <U>    Unknown age:        <X>
Reporte: docs/.specture-meta/last-audit.md · Log: audit-history.jsonl
Acción:  >85 "índice saludable, re-correr en 1-3 meses" · 60-85 "limpieza menor (HIGH+MEDIUM)" · <60 "drift significativo → refresh con /specture:setup-docs-bridge"
```

## Audit — Verification Before Exit

- [ ] `last-audit.md` written + `audit-history.jsonl` appended (or fail-open noted).
- [ ] **NO changes to `.specture/docs-index.yml`** (read-only by contract). **NO ADR status changes.**
- [ ] Summary reported with health score.

## Audit — What this mode does NOT do

- ❌ Auto-fix orphans / auto-consolidate duplicates / re-index uncovered (use `knowledge capture` or `setup-docs-bridge`).
- ❌ Promote `ai_categorized` → `user_confirmed` · refresh `last_verified` itself (only humans) · touch source-of-truth files.

---

## Tone (both modes)

Direct, concrete, file-path/numeric-citing. No fluff. In capture, make the Plan-mode preview crisp; in audit, surface drift and let the user act.
