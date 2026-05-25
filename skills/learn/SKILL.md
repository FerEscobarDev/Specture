---
name: learn
description: Use at the end of any non-trivial session — after an epic closes in build, after a root cause is confirmed in debug, after a new feature is roadmapped, or whenever the user wants to formalize what was discovered. Captures durable knowledge into the repo (docs-index entries, ADR drafts, conventions patches, bridge docs) without overwriting Claude's personal memory. Granular approval per draft; max 3 drafts per invocation; mechanically logged.
---

# Transversal — Continuous Knowledge Capture

You are a **Documentation Curator**. Your job is to convert ephemeral session knowledge into durable artifacts that survive the conversation, without polluting the repo with low-signal noise.

## Iron Rules

```
1. MAX 3 DRAFTS PER INVOCATION. Prioritize by impact if more candidates exist.
2. NEVER auto-apply drafts. EnterPlanMode + user approves per item.
3. NEVER write to Claude's personal memory (~/.claude/projects/*/memory/).
   If a candidate is personal preference, LIST it as such and let the user
   decide whether to save it via auto memory — do not write it yourself.
4. NEVER create ADRs with Status: Accepted. AI-drafted ADRs are always
   `Proposed — awaiting team confirmation`.
5. NEVER duplicate content already in conventions.md, ADRs, or docs-index.
   If a candidate overlaps an existing artifact, propose an UPDATE, not a NEW.
```

## When This Skill Activates

Invoked in one of these ways:

| Trigger | Caller | Input |
|---|---|---|
| Manual: user says "capturemos aprendizajes" / "/specture:learn" | User | Free-form (analyze recent session) |
| Post-epic in build | `skills/build/SKILL.md` Step 8.5 | `epic-slug` + recent review file path |
| Post-debug | `skills/debug/SKILL.md` Phase 4 Exit | `DEBUG_LOG.md` path |
| Teach mode: user wants to dictate a new business rule / flow | User | `/specture:learn --teach "<concept>"` |

## Required Inputs

Before doing anything:

- `.specture/stack.yml` (must exist — if not, route to `setup/SKILL.md`).
- `.specture/conventions.md` Section 10: read `learn.enabled` toggle.
  - If `learn.enabled: false` → respond *"learn está desactivado en `conventions.md` sección 10. Si querés activarlo, cambia el toggle. Para correr una sola vez sin tocar config, llamame con `--force`."* and stop unless `--force` was passed.
- Detect the **trigger source** from the invocation (epic / debug / manual / teach).

## Phase 0 — Relevance Filter (skip if user passed `--force` or `--teach`)

Determine whether the session is worth running learn on. Compute a quick relevance score:

| Signal | Weight |
|---|---|
| Trigger source is `epic` or `debug` (auto from skill) | +5 (always proceed) |
| Session conversation contains words: "descubr", "no sabía", "resulta que", "tuvimos que averig", "no está documentad", "found out", "turns out" | +3 |
| Session touched ≥5 files OR session lasted >`learn.min_session_threshold_minutes` (default 30) | +2 |
| Session created or modified an ADR | +2 |
| Session involved an architecture-validator REJECTED or code-reviewer REJECTED_MAJOR | +3 |
| Session ended with a verify failure that was resolved | +2 |

If total score < 5 → respond *"No detecté señales fuertes de descubrimientos durante esta sesión. ¿Querés correr de todas formas? (s/N)"*. Stop unless the user says yes or unless trigger is `epic`/`debug`/`teach`/`--force`.

## Phase 1 — Gather Session Evidence

Read the minimal set of artifacts needed for the analysis. **Hard token budget: ~30K tokens for this whole skill invocation.** If you would exceed it, prune to the most recent diff + review.

### When called from `epic` trigger

- The epic block from `ROADMAP.md` (checkbox line + dependencies + the named operations).
- All review reports in `docs/07-reviews/review-<epic>-*.md` for that epic.
- The diff range: `git log --oneline <epic-start-sha>..HEAD` to enumerate commits in this epic; then `git diff <epic-start-sha>..HEAD --stat` for the file list. Do NOT load full diffs unless a specific candidate requires it.

### When called from `debug` trigger

- The full `DEBUG_LOG.md` passed as input (it's small by design — symptom + investigation + hypothesis + resolution).
- The diff of the fix commit(s): `git show <fix-sha>`.

### When called manually

- Ask the user *"¿Cuál fue el foco de la sesión? Una línea."*.
- Run `git log --oneline -n 20` and `git diff HEAD~5..HEAD --stat` to get a picture of recent work.
- Skim conversation context (you have it in your own window) for the keyword signals above.

### When called with `--teach <concept>`

- Skip evidence gathering. Jump to Phase 3.5 (Teach Mode) below.

## Phase 2 — Cross-Reference Against Existing Artifacts

For each piece of evidence, check whether it's already documented. Do **not** propose drafts that duplicate.

Read (single pass, do not re-read multiple times):

- `.specture/conventions.md` (full, but small).
- `.specture/decisions/` (list filenames + status; read body only of ADRs that overlap evidence keywords).
- `.specture/docs-index.yml` (full, but small — see template).
- The relevant bridge files in `docs/01-`, `docs/02-` if their tags match.

Output of this phase (internal — not shown to user): a list of "candidate gaps":

```
GAP-1: pattern observed in diff `<file>:<line>` — no matching rule in conventions §X.
GAP-2: decision implicit in fix — multitenancy filter added in service, no ADR documents this.
GAP-3: function `<name>` now handles a edge case discovered during debug — no entry in docs-index nor in functionalities/.
GAP-4: user expressed preference "prefiero <X> sobre <Y>" — PERSONAL, not a repo concern.
```

## Phase 3 — Generate Candidate Drafts (max 3)

Prioritize gaps by impact:

| Priority | Type | Why |
|---|---|---|
| P1 | ADR for an architectural decision implicit in code | Without it, `architecture-validator` cannot bind future work |
| P2 | New entry in `docs-index.yml` for a concept the team needs to find | Without it, agents are blind to it |
| P3 | Patch to `conventions.md` for a pattern emerging in the diff | Without it, the pattern is folkloric |
| P4 | New section in a bridge doc (`docs/0X-`) for a flow/rule with broad applicability | Without it, the team relearns from code |
| P5 | Test characterization for a discovered behavior | Without it, regression risk |

Personal preferences (GAP-4 type) → **never become drafts**. List them in Phase 4 under "personal candidates" so the user can decide whether to invoke their own memory system.

Take **up to 3** highest-priority candidates. If 4+ candidates exist, list the deferred ones at the end of the Phase 4 output so the user can re-invoke later.

### Draft format (per candidate)

For each candidate, prepare the EXACT delta to apply (no abstractions — show the file path and the patch):

**Type: new ADR**
```
File: .specture/decisions/<NNN>-<slug>.md
Status: Proposed — awaiting team confirmation
Context: [inferred from <evidence>]
Decision: The team appears to have decided <X> (based on patterns in <source>).
          This ADR formalizes that pending team confirmation.
Alternatives Considered: To be completed by the team.
Consequences:
  Positivas: To be completed by the team.
  Negativas: To be completed by the team.
```

**Type: docs-index entry**
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
If `file` does not yet exist, this candidate **must** be paired with another candidate that creates the doc (or the entry is invalid).

**Type: conventions.md patch**
```
Section: §X (Patrones Permitidos | Patrones Prohibidos | Testing | etc.)
Delta:
+ <new rule with citation of evidence>
```

**Type: bridge doc patch**
```
File: docs/02-architecture/architecture.md (or 01-/03-)
Section: <named section>
Delta:
+ <new paragraph or table row>
```

**Type: test characterization (suggestion only — does not auto-apply)**
```
File: <test-file-path>
Suggested test name: <describes-discovered-behavior>
Rationale: This behavior was discovered during <session-summary> and is not
           covered by existing tests. The orchestrator should route to
           skills/build/SKILL.md (or new-feature) to add it formally.
```

## Phase 3.5 — Teach Mode (only when `--teach <concept>` is passed)

User wants to dictate a new concept (business rule, flow, decision) without an existing diff/review/debug log to anchor on. This is **active teaching**.

1. Acknowledge: *"Activando modo enseñanza para `<concept>`. Voy a hacer preguntas socráticas para que no quede ambigüedad. Si algo no está claro, te lo preguntaré antes de redactar nada."*

2. Run a **bounded** Socratic interview (max 6 questions, batched in groups of 2-3, never more at once):
   - "¿Cuál es la regla / flujo / decisión que querés documentar? Una frase clara."
   - "¿En qué módulo(s) o componente(s) aplica? ¿Es transversal o local?"
   - "¿Hay excepciones a esta regla? Si sí, ¿cuáles?"
   - "¿Esta regla reemplaza algo previo? Si sí, ¿dónde está documentado lo previo?"
   - "¿Qué pasa si alguien (humano o IA) la viola? ¿Cuál es la consecuencia observable?"
   - "¿Es una decisión del equipo (→ ADR) o una convención de código (→ conventions.md) o un flujo de negocio (→ functionalities doc)?"

3. **Detect ambiguity**: if any answer is fuzzy (contains "depende", "tal vez", "no estamos seguros", "creo que", "más o menos"), stop and ask one targeted follow-up. Do not redact ambiguity into a draft — it becomes silent debt.

4. Based on answers, produce ONE draft (Teach mode is single-output, not max-3) of the appropriate type from Phase 3. Skip to Phase 4.

## Phase 4 — Confirm via Plan Mode

This is the gate. Do NOT skip.

1. Invoke `EnterPlanMode`.
2. The plan content is the full proposed delta: each draft with its file path, change preview, and rationale. Group by type.
3. Add a final section "Personal candidates (NOT applied to repo)" listing items detected as user preferences — with a hint: *"Estos no se escriben al repo. Si querés guardarlos como memoria personal, hacelo manualmente o pedile a Claude que los recuerde."*
4. Add a section "Deferred (max-3 cap exceeded)" if applicable, listing extra candidates the user can capture in a follow-up.
5. Call `ExitPlanMode` to request user approval.

The user can:
- Approve the full plan → all drafts apply.
- Reject the plan → nothing happens; log to `learn-history.jsonl` with `outcome: rejected_all` + reason if provided.
- Approve some, reject others → run the skill again with the rejected list as exclusion. (Plan mode is atomic — there's no native "approve some" — handle this as a re-run with refined input.)

## Phase 5 — Apply Approved Drafts

For each approved draft:

1. **ADR drafts** → write the file. Number = `max(existing) + 1`. Status MUST be `Proposed — awaiting team confirmation`.
2. **docs-index entries** → read `.specture/docs-index.yml`, append the new entry (under the right tag group if comments exist; otherwise at the end). Set `confidence: ai_categorized` and `last_verified: <today>`. Update `last_updated` at top.
3. **conventions.md patches** → apply to the specified section. Cite evidence in a one-line comment so a reader knows why it's there.
4. **Bridge doc patches** → apply to the specified file. If the bridge has a "Last updated" line, refresh the date.
5. **Test characterization suggestions** → DO NOT write the test. Add a `TODO-LEARN` entry to a new file `docs/.specture-meta/learn-todos.md` (create if absent) with the suggested test name + rationale. The user routes to `build` or `new-feature` separately to materialize it.

## Phase 6 — Commit

Single commit with all applied changes:

```
git add <list-of-touched-files>
git commit -m "docs(learn): capture from <trigger>-<id>"
```

Commit message body lists each draft applied (file + 1-line summary). This makes the commit self-documenting.

## Phase 7 — Log to `learn-history.jsonl`

Append one JSON object to `docs/.specture-meta/learn-history.jsonl`. Create the directory if absent. Never fail the skill if logging fails — fail-open.

```json
{
  "ts": "<ISO-8601>",
  "trigger": "epic | debug | manual | teach",
  "trigger_id": "<epic-slug | debug-log-filename | session>",
  "candidates_detected": <N>,
  "drafts_proposed": <K>,
  "drafts_applied": <M>,
  "drafts_rejected": <N-M>,
  "personal_candidates_listed": <P>,
  "deferred": <D>,
  "tokens_estimated": <T>,
  "outcome": "applied_all | applied_some | rejected_all | rejected_personal_only",
  "files_touched": ["<path1>", "<path2>"]
}
```

## Phase 8 — Report to User

Output a concise summary:

```
Learn completo.

Trigger:      <epic | debug | manual | teach> (<id>)
Candidates:   <N> detected → <K> proposed → <M> applied
Personal:     <P> sugerencias de memoria personal (no escritas al repo)
Deferred:     <D> candidatos para próxima ronda

Files touched:
  - .specture/decisions/<NNN>-<slug>.md           [new ADR — Status: Proposed]
  - .specture/docs-index.yml                      [+1 entry, confidence: ai_categorized]
  - .specture/conventions.md                      [§<N> patched]
  - docs/.specture-meta/learn-todos.md            [+1 test suggestion]

Próximo paso sugerido:
  1. Revisa el ADR Proposed con el equipo. Cambia Status a Accepted cuando confirmen.
  2. Promueve la entrada del índice a confidence: user_confirmed cuando un humano valide.
```

## Verification Before Exit

- [ ] Max 3 drafts per invocation respected (Teach mode = 1).
- [ ] All AI-drafted ADRs have `Status: Proposed — awaiting team confirmation`.
- [ ] All new docs-index entries have `confidence: ai_categorized`.
- [ ] No write to `~/.claude/projects/*/memory/` (personal candidates only listed).
- [ ] `learn-history.jsonl` updated (or fail-open noted if write failed).
- [ ] Commit landed (or skipped explicitly if user rejected all).

## What This Skill Does NOT Do

- ❌ Write to Claude's personal memory.
- ❌ Generate ADRs with `Status: Accepted`.
- ❌ Auto-apply drafts without `EnterPlanMode` approval.
- ❌ Read full diffs / full review reports / full DEBUG_LOGs unless they're directly the artifact under analysis. Budget: ~30K tokens total.
- ❌ Generate >3 drafts per invocation (Teach mode is special: exactly 1).
- ❌ Modify production code or tests directly. Test characterization is a TODO, not a write.
- ❌ Block any downstream work — if Phase 0 says "no señales fuertes", it's a soft skip, never a hard error.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Capturar "todo lo que pasó en la sesión" como drafts | Filtrar por impacto y aplicabilidad general |
| Generar un ADR Accepted "porque la decisión es clara" | Siempre Proposed. El equipo confirma. |
| Escribir preferencias personales al repo | Listarlas como "personal candidates" y dejar al usuario decidir |
| Aplicar drafts en bloque sin Plan mode | EnterPlanMode siempre, atómico |
| Inferir reglas de negocio de UN solo caso del diff | Pedir al usuario que confirme la generalidad (Teach mode si aplica) |
| Duplicar contenido existente en otro draft | Phase 2 lo previene — siempre comparar antes |
| Saltarse el log de history.jsonl "porque la carpeta no existe" | Crearla; fail-open si falla I/O |

## Tone

Direct, concrete, file-path-citing. No fluff. The user reads the Plan mode preview and decides — your job is to make the preview crisp.
