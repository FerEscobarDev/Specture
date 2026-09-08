---
name: knowledge
description: 'Use to keep the project''s knowledge healthy — FOUR modes. `capture` (alias `/specture:learn`): at the end of a non-trivial session — after an epic closes, a root cause is confirmed, a feature is roadmapped, or on demand — turn ephemeral discoveries into durable artifacts (docs-index entries, ADR drafts, rules.yml entries, conventions patches, bridge docs); max 3 drafts, granular approval. `audit` (alias `/specture:audit-knowledge`): periodically (every 1-3 months) detect docs-index drift (orphans, stale, duplicates, uncovered) and report — read-only. `stats`: read the per-epic build metrics (`docs/.specture-meta/build-metrics.jsonl`) and apply the Spec Planning Gate reading — read-only. `reconcile --component <slug>`: lazy backfill of the living-behaviour file `docs/05-specs/_current/<slug>.md` from that component''s [x] specs (último gana), one component at a time, Plan-mode approval; `characterize --component <slug>` does it from the code when the component has no specs (Adopt). Never writes Claude''s personal memory.'
---

# Transversal — Knowledge Hygiene (capture + audit + stats + reconcile)

You manage the project's durable knowledge. Four modes, one domain (the `docs-index`, the repo's documentation truth, the living behaviour in `docs/05-specs/_current/`, and the evidence the build leaves behind):

- **`capture`** — convert ephemeral session knowledge into durable artifacts without polluting the repo with low-signal noise. (Was `/specture:learn`.)
- **`audit`** — detect and report the drift the index accumulates as docs are added/renamed/deleted. (Was `/specture:audit-knowledge`.)
- **`stats`** — read `docs/.specture-meta/build-metrics.jsonl` (one line per epic, tracked since v1.18.0) and turn it into the gate's §6.5 reading. (New in v1.18.0.)
- **`reconcile --component <slug>`** — build the living-behaviour file of **one** component from its `[x]` specs (lazy backfill of `_current/`, roadmap item 38); its variant **`characterize`** does it from the code when the component has no specs. (New in v1.19.0.)

## Shared Iron Rules (all modes)

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
| `/specture:knowledge stats`, "¿cómo viene el gate?", "métricas del build" | **stats** |
| `/specture:knowledge reconcile --component <slug>`, "reconciliá el componente X", the warning `build` (Current-State Resolution) or `new-feature` prints, doctor `current-state-missing` / `current-state-partial` | **reconcile** |
| `/specture:knowledge characterize --component <slug>`, "caracterizá X desde el código" (Adopt / inherited code, no specs) | **reconcile** (variant `characterize`) |
| `/specture:knowledge` with no mode | Ask: *"¿capture (guardar lo aprendido), audit (revisar la salud del índice), stats (métricas del build) o reconcile (verdad viva de un componente)?"* |

---

# Mode: capture — post-session knowledge capture

You are a **Documentation Curator**. Convert ephemeral session knowledge into durable artifacts that survive the conversation.

## Capture Iron Rules (additional to the shared rules)

```
1. MAX 3 DRAFTS PER INVOCATION. Prioritize by impact if more candidates exist.
2. NEVER auto-apply drafts. EnterPlanMode + user approves per item.
3. NEVER duplicate content already in conventions.md, rules.yml, ADRs, or docs-index.
   If a candidate overlaps an existing artifact, propose an UPDATE, not a NEW.
4. ONE RULE = ONE LINE. A new invariant goes to `.specture/rules.yml` (never inline in
   conventions.md §12): `rule` ≤ 240 characters, no line break, and a `source` that
   links the story (an ADR draft of this same capture, or the debug log). A draft
   that exceeds the length is REJECTED before Plan mode — shorten it and move the
   story to `source`. §4 deny-list patches obey the same limit (≤ 2 lines).
```

## Required Inputs

- `.specture/stack.yml` (must exist — if not, route to `setup/SKILL.md`).
- `.specture/settings.yml`: read the `knowledge.enabled` toggle (`conventions.md` §10 only for projects not yet migrated).
  - If `knowledge.enabled: false` → respond *"knowledge está desactivado en `.specture/settings.yml` (o el perfil activo lo apaga). Para correr una sola vez sin tocar config, llamame con `--force`."* and stop unless `--force` was passed.
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

Prioritize by impact: **P1** ADR for an architectural decision implicit in code → **P2** new docs-index entry for a concept the team needs to find → **P3** `rules.yml` entry for an invariant the session proved (or a conventions.md patch for an emerging pattern) → **P4** bridge-doc section for a broadly-applicable flow/rule → **P5** test characterization for a discovered behavior.

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

**rules.yml entry** (an invariant `R-*` — since v1.19.0 these never go to conventions.md §12)
```yaml
- id: R-<max(existing)+1>
  tags: [<module>, <component>, backend|frontend|mobile]   # what the build coordinator matches against the spec
  rule: "<the invariant in one sentence — ≤ 240 characters, no line break>"
  verify: "<how the reviewer checks it>"
  severity: BLOCKER | IMPORTANT
  source: "<ADR-nnn §title | docs/06-debug-logs/<file> | conventions.md §n>"   # the story lives THERE
```
Mechanical pre-check before Plan mode: `rule` over 240 characters or without a `source` → the draft is rejected (shorten; the story goes to `source`). If the story has no home yet, pair this draft with the ADR draft that tells it.

**conventions.md patch**
```
Section: §X (Patrones Permitidos | Prohibidos | Testing | etc. — never §12, see rules.yml entry)
Delta: + <new pattern, ≤ 2 lines, with a link to the evidence (ADR / debug log) — never the story inline>
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
3. **rules.yml entry** → append to `rules:` in `.specture/rules.yml` (create it from `templates/project-config/rules.template.yml` if absent — then `/specture:doctor migrate` records `1.19-rules-file` as done); keep the file's grammar (one `- id:` item, `key: value` lines, inline `tags: [...]`); then `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" check --brief` must report no `rules-schema` / `rule-length` finding.
3b. **conventions.md patch** → apply to the section; one-line comment citing evidence.
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
- [ ] Every `rules.yml` entry: `rule` ≤ 240 characters, `source` present, doctor `check` clean of `rules-*` findings. No rule written into conventions.md §12; no §4 item over 2 lines.
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

# Mode: stats — build metrics reader (roadmap item 34)

Read-only. Turns the per-epic telemetry the build coordinator appends to
`docs/.specture-meta/build-metrics.jsonl` (tracked in git since v1.18.0) into the reading
the Spec Planning Gate was designed to be judged by (`docs/spec-planning-gate-design.md`
§6.5).

## Stats — Inputs

- `docs/.specture-meta/build-metrics.jsonl` — may not exist yet (that is a valid answer, not an
  error).
- Optional: `--last N` (only the last N epics), `--baseline` (see below).

## Stats — Procedure

1. Run the reader and print its output **verbatim**:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/metrics-report.js" --project . [--last N]
   ```
   It prints one row per epic, the aggregates split by `source` (`gate` vs `baseline`) and
   the §6.5 reading: defects downstream (`needs_context_spec` + `iteration_cap_spec` +
   `blocked_spec`) falling → the gate catches real ambiguity; not falling with
   `open_questions ≈ 0` → the planner does not ask (fix the planner, not the validation);
   `reviewer_rejected_major_spec_defect` rising → keep validating per spec (decision A6);
   `c7_rejections` high → harden the planner's Step 4; tokens → the user's judgment (no
   harness; the `tokens` field is optional).
2. **No file yet** → say so and offer the baseline: *"No hay métricas todavía. ¿Reconstruyo
   el baseline de los epics cerrados antes del gate (`--baseline --write`)?"* On yes:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/metrics-report.js" --project . --baseline --write
   ```
   It reconstructs one `source: "baseline"` line per `[x]` epic from what is mechanical —
   review verdicts and `CAUSE:` in `docs/07-reviews/`, `_planning.md` counters when present,
   RED / revert / `test(supersede)` commits — with `null` for what cannot be recovered and
   `heuristic: true` when an old review's `spec_defect` was inferred from its text. Commit
   the file (`docs(metrics): baseline — N epics`).
3. Close with one recommendation per firing rule, in the user's words. Never edit the file
   by hand, never "fix" a line; a suspicious line is reported, not rewritten.

## Stats — What this mode does NOT do

- ❌ Write metrics for gate epics (only the build coordinator appends those) · ❌ delete or
  rewrite lines · ❌ decide A6 by itself (it reports the signal; the user decides).

---

# Mode: reconcile — lazy backfill of `docs/05-specs/_current/` per component (roadmap item 38)

Builds (or incrementally updates) the living-behaviour file of **one** component from the `[x]` specs that cite it, so a mature project gets `_current/` without "consolidating 379 specs at once" — the reviewer and the impact analyses of the next epics see the current behaviour instead of `[]`. **`characterize`** is the variant for a component that has **no specs** (Adopt projects, inherited code): it reads the code, read-only, and writes the same file marked `ai_characterized`. Both are the retroactive / bootstrap side of `build` Step 8.7, which keeps reconciling at every milestone closure.

## Reconcile Iron Rules (additional to the shared rules)

```
1. ONE COMPONENT PER INVOCATION. Never loop over every component; never
   "consolidate everything" — that is the anti-pattern this mode exists to avoid.
2. WRITE ONLY docs/05-specs/_current/<slug>.md — plus the two append-only logs the
   procedure names (`.specture/migrations.log` through the doctor's --verify,
   `docs/.specture-meta/learn-history.jsonl`). Never edit a spec, the ROADMAP,
   another component's file, or code. characterize never writes code or tests.
3. EnterPlanMode BEFORE WRITING — the full proposed file is the plan; approval is
   atomic. (Copilot / Antigravity: a closed proposal in chat + explicit approval.)
4. Confianza: ai_reconciled (from specs) | ai_characterized (from code). Never
   spec_reconciled (that is build Step 8.7's mark) and never user_confirmed.
5. Every vigente item carries `origen:` — the spec id `<epic-dir>/<task-slug>` (the
   template's `[epic/task]`), or `path::símbolo` for characterize, never a line
   number. No origin → the item does not exist (an operation the epic block or the
   contract declares but no [x] spec implements is a note in the plan, not a line).
```

## Reconcile — Inputs

- `docs/04-roadmap/ROADMAP.md` (epic states) and `docs/02-architecture/architecture.md` (§ Componentes: slugs, "Carpeta raíz", "Ubicación"). No `architecture.md` → stop: components are declared there (`architecture` skill).
- `${CLAUDE_PLUGIN_ROOT}/templates/CURRENT_CAPABILITY_TEMPLATE.md` (`$SPECTURE_ROOT/…` in manual setups; `${PLUGIN_ROOT}` in Copilot / Antigravity).
- The existing `docs/05-specs/_current/<slug>.md`, if any (incremental merge, never a blind rebuild).
- **Only** the specs the helper lists (step 1) — never scan `docs/05-specs/` by hand.
- The `operationId` list of the contract file (`stack.yml.api.contract_file`; a `grep operationId` is enough) — only to decide what goes under "Operaciones del contrato implementadas". Never `business_requirements.md` or `conventions.md`: the specs already cite their `RN-nnn`.
- Not gated by `knowledge.enabled` (that toggle governs the opt-in *capture* prompts in build/debug); the doctor, `build` and `new-feature` route here regardless.

## Reconcile — Procedure

0. **Resolve the component**: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/current-state.js" components --project .` prints `SLUG | NAME | ROOT | SPECS_DONE | SPECS_OTHER | CURRENT` and a `MISSING:` line. `--component <slug>` must match a slug or name exactly; on an unknown or partial slug the helper exits 2 with candidates → ask the user with those candidates (≤ 4 options), **never guess** a component.
1. **List the specs**: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/current-state.js" specs --project . --component <slug>` → `SPEC | EPIC | STATE | MATCH` in ROADMAP order, `[x]` only. `MATCH = modulo` = the spec's own `Módulo:`; `MATCH = epic` = cited only through the epic's "Componentes de arquitectura involucrados" — include it, but take from it only the items whose subject is this component's data or operations (e.g. an ownership rule about *archivos* enforced by the Etiquetas epic — yes; the tag-normalisation rule — no, that belongs to Etiquetas); it is a judgment call, so the plan lists exactly what was taken. `NONE` → this is a `characterize` case (section C). `NONE_DONE` → nothing to reconcile yet; stop and say so.
2. **Read those specs, in that order, and apply "último gana"** (`docs/reconciliation-design.md` § schema): for each business rule, acceptance criterion, edge case and contract operation, the **most recent** spec that touches the **same `operationId` or the same rule subject** defines the vigente item; the older statement moves to "Historial / supersesiones" with both origins. Two `[x]` specs on the same subject with no clear order or no declared supersession → an open question for the user (in the plan), not a coin toss. Fill the template: header (`Componente`, `Specs de origen` = every listed spec, `Última reconciliación: <fecha> — knowledge reconcile`, `Confianza: ai_reconciled`), the four vigente sections with `origen:` + `fuente: RN-nnn`, the consolidated contract table, the Historial (its "en Milestone N" = the milestone of the superseding epic).
3. **Incremental merge** when the file already exists: keep what it says unless a listed spec supersedes it; never drop an item whose origin spec is still `[x]`; append to the Historial, never rewrite it. An item whose `origen:` is not a spec (a human wrote it) is kept and **flagged in the plan** — the user decides. A previous `Confianza: user_confirmed` is preserved only if the merge changes nothing vigente — otherwise the file goes back to `ai_reconciled` and the plan says so. If the merge changes **nothing** (same vigente items, no new supersession), say so and stop: no rewrite, no refreshed date, no commit.
4. **`EnterPlanMode`** — the plan is the full proposed file plus: the supersessions applied (old → new, origins), what was taken from `MATCH = epic` specs, the open conflicts as questions. **`ExitPlanMode`**. Approve → write; reject → nothing (log `outcome: rejected`).
5. **Write** `docs/05-specs/_current/<slug>.md`. If this created the `_current/` directory itself, record the content migration: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" migrate --verify 1.9-current-state-init --by "knowledge reconcile"`.
6. **Verify**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" check --brief` — no `current-state-partial` for this slug, no new ERROR.
7. **Commit** `docs(knowledge): reconcile _current/<slug> — N specs` — that file, plus `.specture/migrations.log` when step 5 wrote it (the log is tracked, append-only) — and append to `docs/.specture-meta/learn-history.jsonl` (fail-open): `{"ts":"<ISO-8601>","trigger":"reconcile","trigger_id":"<slug>","specs":N,"supersessions":M,"confidence":"ai_reconciled","outcome":"applied|rejected|unchanged"}` (`supersessions` = statements moved to the Historial, not subjects).

### C — `characterize` (a component without specs)

Same gate, different source. Only when step 1 says `NONE`, or the user asks for it on an Adopt component:

1. **Root** = the component's `Ubicación` (fallback "Carpeta raíz") from `architecture.md`. Nothing under it → say so; there is nothing to characterize.
2. **Read-only extraction** — the fourth application of "the orchestrator resolves, the agent never reads" (see Code Surface Resolution in `build/SKILL.md`): dispatch a general-purpose subagent with `model: haiku` (sonnet if haiku is unavailable), read-only tools (Read/Glob/Grep), this prompt and nothing else (`<root>` = the component's `Ubicación`, or its "Carpeta raíz" when there is no `Ubicación`):
   ~~~
   Read ONLY files under: <root>. Do not read anything else. Do not write anything.
   Extract the OBSERVABLE behaviour as rows, strict format, no prose, max 60 rows:
   KIND | STATEMENT | ANCHOR
   KIND = BR (a rule the code enforces) | AC (what a caller observes) | EC (an edge case handled) | OP (a public operation: name + parameters)
   STATEMENT = one sentence in Spanish, present tense, with the literal values (limits, codes, defaults).
   ANCHOR = <path>::<symbol> — never a line number. If nothing is observable, output exactly: NONE
   ~~~
   No subagent tool → read the root yourself under the same 60-row cap; never open a file outside it (the contract's `operationId` grep of the Inputs is the one exception).
3. **Fill the template** from the rows: `origen:` = the ANCHOR; `Specs de origen: (ninguno — caracterizado desde código)`; `Confianza: ai_characterized`; Historial empty; no `fuente:` lines (there is no spec citing an `RN-nnn` — do not open `business_requirements.md` to hunt for one; the first epic on the component will). "Operaciones del contrato" only for operations whose `operationId` exists in the contract file — otherwise the OP rows go under "Comportamiento observable" and that section says so; never invent an `operationId`.
4. Steps 4-7 as above with `--by "knowledge characterize"` in step 5, the commit `docs(knowledge): characterize _current/<slug> — N rows`, and the log line `{"ts":…,"trigger":"characterize","trigger_id":"<slug>","rows":N,"confidence":"ai_characterized","outcome":"applied|rejected"}`. Sibling of `modernize` Step 5's characterization brief — the tests come later, when an epic touches the component.

## Reconcile — What this mode does NOT do

- ❌ Consolidate every component in one run · edit specs, the ROADMAP or code · invent behaviour with no origin · mark `spec_reconciled` or `user_confirmed` · "refresh" an `ai_characterized` file into something stronger by re-running it (only a human promotes `Confianza`).
- ❌ Replace `build` Step 8.7: at every milestone closure the coordinator still reconciles that milestone's components and marks them `spec_reconciled`; this mode is the retroactive backfill and the Adopt bootstrap.

---

## Tone (all modes)

Direct, concrete, file-path/numeric-citing. No fluff. In capture, make the Plan-mode preview crisp; in audit, surface drift and let the user act; in reconcile, the proposed file **is** the preview — show it whole, then the supersessions.
