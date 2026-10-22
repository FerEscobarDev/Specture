# Build — Spec Planning Gate (per epic — run by the coordinator)

Companion of `skills/build/SKILL.md`. Read it **only** when the queue loop (`build/QUEUE.md`
step 5.3) hands you an epic that no `CLOSED` review register covers: that epic is planned here,
end to end, before its epic coordinator is dispatched. An epic of a `CLOSED` register skips this
file — the epic coordinator refreshes its specs itself.

## Contents

| Section | When you need it |
|---|---|
| Pre-flight — Code Surface Resolution | Before the first planner dispatch of the epic |
| Step 1 — Dispatch the `spec-planner` | The Required Inputs manifest you assemble |
| Step 2 — Stage and fingerprint | After every planner pass (TREE sha, scope check) |
| Step 3 — Questions | The one human budget of the gate (2 rounds, delegation, persisting answers) |
| Step 4 / 4a — Re-dispatch · Mechanical set check | Every planner pass before any validator |
| Step 5 — Validate (5a set, 5b per spec) | Rounds, delta re-validation, the observation table, the cap |
| Step 6 — Summary · Step 7 — Commit and seal | Closing the gate: `SPEC_SHA`, `seal-cli.js write` |
| Steps 8-9 — Tasks · Dispatch the epic coordinator | Hand-off with `ENTRY: sealed` |
| `BLOCKED` from the planner · Human contacts | What reaches the user and what never does |

## The gate

Every epic is **fully planned before any execution**: the `spec-planner` authors the 1-3
specs, only the questions the sources cannot answer reach the user, the
`architecture-validator` approves per spec, and the epic-agent then receives sealed,
validated specs — never the job of writing them. The evidence lives on disk in
`docs/05-specs/<epic-slug>/_planning.md` (tracked). Run these steps for the epic just
locked `[/]`:

**Pre-flight — Code Surface Resolution** (roadmap item 33; third application of the doctrine
"the orchestrator resolves, the agent never reads" — see Docs Index Resolution and
Current-State Resolution in `build/EPIC_LOOP.md`). The planner **does not open source
files**: you hand it a table `SYMBOL | PATH | SIGNATURE` of the component's existing code.
- **Roots**: the "Carpeta raíz" of every involved component in `architecture.md`, backed by
  `stack.yml.structure`; "n/a" → the dirs of `structure.apps`; no code yet (greenfield) →
  `CODE_SURFACE: (vacío — componente sin código)`.
- **Method A (preferred)**: dispatch a general-purpose subagent with `model: haiku` (sonnet if
  haiku is unavailable), read-only tools (Read/Glob/Grep), this prompt and nothing else:
  ~~~
  Read ONLY files under: <roots>. Do not read anything else. Do not describe behavior.
  List every exported/public symbol (functions, classes, methods of exported classes,
  constants, types) as rows, one per line, strict format, no prose, max 80 rows,
  alphabetical by PATH then SYMBOL:
  SYMBOL | PATH | SIGNATURE
  SIGNATURE = the declaration line as written (name, parameters with types, return type).
  No bodies, no comments. If there are no exported symbols, output exactly: NONE
  ~~~
- **Method B (no subagent tool)**: `grep` the exports of the language declared in
  `stack.yml` — TS/JS `^export\s+(async\s+)?(function|class|const|let|interface|type|enum)\s+\w+`,
  Python `^(def|class)\s+\w+`, C#/Java `^\s*public\s+[^=]*?\b\w+\s*\(`, Go
  `^func\s+(\([^)]*\)\s*)?\w+\(`; SIGNATURE = the matched line, trimmed.
- **Output**: pass the table to the planner as a `CODE_SURFACE:` block (transient — not
  persisted) and append one summary line to `## CODE_SURFACE` of `_planning.md`
  (`roots · símbolos: N · método · fecha`). Both methods failing → `CODE_SURFACE: UNAVAILABLE`:
  the planner writes only `Crea:`/`Modifica:` lines and raises `CONCERNS`; the validator's C8
  sees the summary line.
- **Never** build tables of how tests use the code (usage greps over `tests/`) for the
  planner or the validator: which old tests a spec breaks is not a gate question — the
  execution loop finds it mechanically.

1. **Dispatch the `spec-planner`** (`agents/spec-planner/AGENT.md`) with its Required
   Inputs manifest, assembled by you: the full epic block; the linked
   `business_requirements.md` sections + Capacidades de Frontera; the `architecture.md`
   sections of the involved components (incl. "Carpeta raíz"); the contract slice with the
   epic's `operationId`s; `stack.yml`, `conventions.md` (§8, file-org), `Accepted`
   ADRs; the `RULES_RESOLVED` block (run "Rules Resolution" of `build/EPIC_LOOP.md` with
   the epic's component slugs + `backend`/`frontend`/`mobile` as tags — the planner cites
   the rules a spec must honor, never the whole registry); resolved docs-index and
   `_current/` files (run "Docs Index Resolution" and "Current-State Resolution" as
   defined in `build/EPIC_LOOP.md` — same algorithms, you have the file); **for a frontend
   epic, the `design_surface_resolved` block** (run "Design Surface Resolution" —
   without it the planner has to fill the `Crea:` surface of the Code Surface seal for
   components it is forbidden to read and whose inventory nobody hands it, which is exactly
   the gap the inventory exists to close); the template
   per the epic's `Template:` field plus
   `templates/PLANNING_TEMPLATE.md` (the `_planning.md` grammar); the **Code Surface
   table** from the pre-flight above (`(vacío)` / `UNAVAILABLE` are valid and explicit — the
   planner never reads code); the frontend/migration conditionals. A missing item costs a
   `NEEDS_CONTEXT` round-trip.
2. **Stage and fingerprint, don't commit.** After each planner pass: `git add
   docs/05-specs/<epic-slug>/` and `git write-tree --prefix=docs/05-specs/<epic-slug>/` —
   that sha is the pass's **TREE** (comparable with `git rev-parse
   <SPEC_SHA>:docs/05-specs/<epic-slug>` on resumption; the delta re-validation diffs two
   TREEs). Then compare `git status --porcelain --untracked-files=all --
   docs/05-specs/<epic-slug>/` with the pass's `ALCANCE`: a spec modified outside it is
   restored from the previous TREE (`git show <tree_prev>:<file> > <path>` — the declared
   exception to the "never restore after a mutation" anti-pattern); a new file outside it is
   reported, never deleted without asking.
3. **Questions — one human budget per gate.** At most **2 rounds** of `AskUserQuestion`
   (Copilot / Antigravity: closed questions in chat, same rules) **whatever their origin** —
   the planner's `OPEN_QUESTIONS`, C7 conversions, a validator warning routed to `pregunta`,
   sizing — at most **4 questions per round**, 2-4 options each, one `(recomendada)`. The
   resumption question and the single closed question of the cap (step 5) do not count.
   Contract doubts still open after round 2 mean the epic is under-discovered → offer a
   scoped `discover` instead of a third round.
   - **The planner's options go verbatim**, with their `derivadas:` — ask the derived
     sub-decisions of the likely answers in the same round, so round 2 stays optional. You
     may add one line `Dato verificado: <hecho> (<path>)` under a question; if you disagree
     with an option, hand it back to the planner as `CONCERNS` before asking — never rewrite
     it.
   - **Vague pressure never suppresses contract questions** ("hazlo rápido", "no me
     preguntes" — same resistance rule as the router). **Explicit delegation** ("si hay
     dudas usá la recomendada") is honored: answer each question with its recommended
     option, recording `fuente: delegado por el usuario <fecha>`. Delegation scope = the
     named epic (the whole batch only if said **before** starting it); it never survives
     the session and is never inferred from a previous one. It does NOT authorize touching
     the contract or the architecture — a missing shape stays `BLOCKED: contrato`.
   - **Persist the answers.** If an answer creates or changes a business rule, edit the
     rule **in place** in `business_requirements.md` with the marker `(aclarado en Epic
     X.Y, <fecha>)` — never per-epic addendum subsections — BEFORE re-dispatching, so the
     spec can cite it and validator Dimension 4 finds it. An architectural answer → new
     ADR. **Commit** those source edits (`docs(requirements): aclaraciones Epic X.Y`) before
     re-dispatching — the delta re-validation diffs them by commit. Record every question,
     answer and `fuente:` in `_planning.md`.
4. **Re-dispatch a fresh planner** — never resume it with `SendMessage` (a resumed planner
   reached 941k tokens of context in a real epic) — with `SPECS_DIR`, `ALCANCE: [task-slugs]`
   (the specs the answers or violations touch) and the `ANSWERS` / `VIOLATIONS` verbatim; it
   edits minimally. **A re-dispatch needs at least one BLOCKER or one user answer** — never
   a WARNING or a NOTE of an APPROVED verdict. **Echo the `CHANGELOG`** to the chat ("así
   quedó — …") without waiting for confirmation. Contrast `git diff --
   docs/05-specs/<epic-slug>/` against the `CHANGELOG`: a diff that exceeds it is a finding
   → re-dispatch with "revertí lo no listado".
4a. **Mechanical set check — after every planner pass, before any validator dispatch**
   (no agent involved; roadmap item 29):
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js" docs/05-specs/<epic-slug> --roadmap docs/04-roadmap/ROADMAP.md --epic <X.Y>
   ```
   It reads the `COVERAGE_TABLE` of `_planning.md` (grammar: `templates/PLANNING_TEMPLATE.md`)
   plus the epic block and cross-checks the spec files: **C1** every `operationId` of the
   epic in exactly one spec (hole / overlap; a consumed op needs its backend epic `[x]`),
   **C2** every linked `RN-nnn` cited by ≥1 spec, **C4** every `(planeada — re-anclar)`
   symbol created by an *earlier* spec with a string-identical signature, **C5** ≤3 specs /
   ≤15 IDs per spec (WARNING), **C6** no consumer before its creator, plus `C-path` (every
   `Crea:`/`Modifica:` carries `en <path>`), `C-gap` (migration epics) and `C-sup`
   (declared supersessions). The first stdout line is the **token**:
   - `MECH_CHECK: PASS <sha>` → append the line to `## MECH_CHECK` of `_planning.md` (date +
     run number). The sha covers only the table rows: answers and verdicts never invalidate
     it, any table edit does.
   - `MECH_CHECK: FAIL <sha>` (exit 1) → re-dispatch the planner with `VIOLATIONS` = the
     finding lines verbatim (step 4). No validator dispatch is spent on evident errors, and
     **FAILs do not count toward the cap** of step 5. The same FAIL line on two passes in a
     row goes back with `CONCERNS: 4a repetido`; a third identical FAIL is `BLOCKED: gate`
     (a framework or grammar defect — escalate with the lines). A `C5 WARNING` is the
     `BLOCKED: sizing` escalation below.
   - `MECH_CHECK: UNVERIFIABLE <reason>` (exit 2) → a malformed table is a planner defect →
     `VIOLATIONS`; a missing input is yours to fix. Only if it stays unverifiable, append the
     line as-is: the validator then runs its C2 fallback.
   - No node available → the same three checks by hand with `grep` (epic ops vs `op:` rows,
     `RN-nnn` vs `br:` rows, `(planeada — re-anclar)` vs `sym:` rows) and append
     `MECH_CHECK: MANUAL <fecha>`; the validator accepts it with a note.
5. **Validate — the set first, then each spec** (roadmap item 30; decision A6: dims 1-6 stay
   per spec, the set gets one extra dispatch — the metrics decide later whether to merge
   them). **Every** validator dispatch of the gate carries the **last `MECH_CHECK:` line** of
   `_planning.md` verbatim — a required input: without it the validator answers `BLOCKED`.
   - **5a — one `SPEC_SET` dispatch per epic** of the `architecture-validator` (its Dimension
     7: **C3** every "Fuera de Scope" item has an owner in the `oos:` rows, **C7**
     "aclaraciones sin sustento", **C8** Superficie with signatures and paths only, **C2
     fallback** when 4a was `UNVERIFIABLE`/`MANUAL`) with: the epic block, **all** the specs
     in path order, the contract slice, `_planning.md` (`COVERAGE_TABLE`, `RESOLVED_ALONE`,
     last `MECH_CHECK:`), the source excerpts cited in `RESOLVED_ALONE`, and the
     `CODE_SURFACE` table. It runs first because a C3/C7 rejection reshuffles content across
     specs — the per-spec dispatches then run once, on the stabilized set.
   - **5b — one dispatch per spec** (dims 1-6, unchanged; **never** `_planning.md` — Dimension
     7 does not run per spec). Both 5a and 5b carry the `RULES_RESOLVED` block of the gate
     (Rules Resolution with the epic's tags) so a spec that contradicts a `BLOCKER` invariant
     is rejected by rule ID before any test is written. A 5b of a spec with `Supersede:` lines
     also carries the ROADMAP checkbox line of each `epic origen` (Dimension 4 checks it is
     closed) — never the test files.
   - **Rounds.** A round is the set of validator dispatches you launch together after a
     planner pass (5a and/or the 5b's — parallel dispatches count **one** round).
   - On `REJECTED` (5a or 5b) → re-dispatch the planner with `VIOLATIONS` (step 4) → 4a →
     **delta re-validation**: 5a again only if the `CHANGELOG` touched `COVERAGE_TABLE`,
     `RESOLVED_ALONE`, a "Fuera de Scope" or a Superficie; 5b only for the specs the
     `CHANGELOG` touched; each one a fresh dispatch in `MODE: DELTA` (validator "Modes")
     with its `PRIOR_VERDICT` verbatim, `DIFF_SPECS` = `git diff <tree_prev> <tree>`,
     `DIFF_SOURCES` = `git diff <sha_prev>..HEAD -- docs/01-requirements/business_requirements.md
     .specture/decisions/` and `LATE_USED` (at most one LATE finding per epic). Keep the
     PRIOR and DIFF files under `.specture/state/gate/<epic-slug>/` for resumption. If `git
     cat-file -e <tree_prev>` fails, validate in full.
   - **APPROVED means advance.** An APPROVED target is never re-validated, re-planned or
     turned into a question because of its WARNINGs or NOTES. Route each observation with
     this closed table (the validator's `destino-sugerido` is a hint; the table decides):

     | Observation | Destination |
     |---|---|
     | a) Form or traceability (C7, C8, IDs) | `## GATE_NOTES` of `_planning.md`, verbatim |
     | b) A "how" on a path the Superficie already declares | `GATE_NOTES` (the sealed path is executed as is; the implementer decides only what does not move `allowed_paths`). Visual and brand (MK-nnn) never go here — reviewer Dim 6 or the visual gate |
     | c) Observable contract doubt | round 2 of step 3 if the budget allows; otherwise the cap menu |
     | d) Missing EC or guard of money, legal or personal data **in the epic's own operations** | contractual — the validator must raise it as BLOCKER; if it came as a warning, it enters round 2 or the next pass. Never deferred |
     | e) Scope outside the epic block | `## DIFERIDOS` of `_planning.md` + a `**Diferidos heredados:**` line on the block of the epic that **owns** it (by component or RN), which its own gate receives as a C3 candidate. **No epic owns it** → `dueño: sin epic` in `## DIFERIDOS`, and offer it **once**, when the queue drains, as a `new-feature` route — never as a question mid-queue |
     | f) `sup-candidato:` | nothing — execution finds it |

   - **Anti-cascade**: if C7 rejects the **same item a second time**, convert it into an
     `OPEN_QUESTION` (back to step 3) — no third attempt between two models arguing over a
     plausible quote.
   - **Cap: 3 rounds without the epic APPROVED** (only BLOCKERs `NOT ADDRESSED` or new keep a
     round alive; 4a FAILs never count) → **one** closed `AskUserQuestion`, its options
     pre-built from the class of each live BLOCKER: ADR → amend the ADR via `architecture` |
     comply literally; contract → `BLOCKED: contrato`; BR vs RN or an internal contradiction
     → scoped `discover` | pick one of the two rules; sizing → split the epic; always →
     pause the epic. "Sellar con riesgo declarado" is offered only for non-semantic classes
     (form, traceability) and is never the recommended option.
   - Record every verdict verbatim under `## VEREDICTOS` with the header
     `### <set | task-slug> — dispatch N — ronda R — <ISO-8601 with time> — tree <sha12> —
     head <sha12> [— delta] [— loop] [— J9]` (parsed by `metrics-report.js` and the
     resumption below).
6. **Summary — always, before committing**: the specs in order, AC/BR/EC counts,
   `operationId`s covered, **every** `RESOLVED_ALONE` decision with its quote, the
   `GATE_NOTES` and the `DIFERIDOS` with their owning epic.
   **Review mode** (only if the user explicitly asked this session, e.g. "construí con
   revisión de specs"): stop here and wait for confirmation in chat. There is no toggle,
   and Plan mode is not used.
7. **Commit** `docs(specs): plan <epic-slug> — N specs validados` (specs +
   `_planning.md`). Before committing, run `spec-set-check.js <epic-dir> --hash-only`: its
   sha must equal the last `MECH_CHECK: PASS` line — a different sha means a planner pass
   was never re-checked → back to 4a. The verdicts are already under `## VEREDICTOS` (step
   5 records each one as it arrives, so an interrupted gate resumes from disk) and ride in
   this commit; after it, append only the commit's `SPEC_SHA` (`## SPEC_SHA`) — that append
   rides with the epic's next commit. `_planning.md` ownership is split
   (`templates/PLANNING_TEMPLATE.md`): the planner wrote `COVERAGE_TABLE` /
   `OPEN_QUESTIONS` / `RESOLVED_ALONE` / `SUPERSESIONES`; you write the sections marked
   *(coordinador)* — answers, `CODE_SURFACE`, `MECH_CHECK`, `VEREDICTOS`, `SPEC_SHA`,
   `GATE_NOTES`, `DIFERIDOS` — sequential writers, never concurrent.
   **Seal the specs** (roadmap items 31/36 — `hooks/README.md` schema v3), right after the
   commit, through the only sanctioned writer:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" write --epic <epic-slug> --spec-sha <SPEC_SHA> \
     --lock-sha <LOCK_SHA> \
     --spec-paths "docs/05-specs/<epic-slug>/*.spec.md" \
     --test-globs "<conventions.md test globs>,<test root, e.g. tests/**>" \
     --allowed-paths "$(node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js" docs/05-specs/<epic-slug> --allowed-paths | paste -sd,)"
   ```
   `spec_paths` makes the validated specs immutable during the epic (hook deny "Spec Seal");
   `allowed_paths` (the union of every `Crea:`/`Modifica:` path — 4a's `C-path` guaranteed
   each one has a path) makes writes outside the declared surface a deny "Allowed Paths"
   (zero code without spec, item 36). `test_globs` must include the conventions test globs
   **and** the test root directory so RED-phase helpers stay writable. No `Crea:`/`Modifica:`
   at all (docs-only epic) → omit `--allowed-paths` and say so in one line. `LOCK_SHA` is
   the commit that marked the epic `[/]` (queue step 5.1) — the base the supersession loop
   runs retroactive REDs against. Never hand-edit `build-locked.json`. The epic-agent later
   **merges** its `specs[]` entries into this file.
8. **`TaskCreate` one task per spec** (subject `<epic-slug> / <task-slug>`, start
   `pending`) — user-visible progress for the epic-agent's Steps 4-8; `ROADMAP.md`
   remains the source of truth.
9. **Dispatch the epic coordinator** (`build/QUEUE.md` § "Epic execution") with `ENTRY: sealed`, the `SPEC_SHA` and your gate
   counters as `GATE_METRICS` — it dispatches the epic-agent with the verbatim verdict.

**When the planner reports `BLOCKED`** — `sizing` (>3 specs): escalate the suggested
split to the user (it touches `ROADMAP.md`); `contrato`: the epic needs a contract change
→ `architecture`/ADR, never a spec; `contradicción`: escalate for an ADR.

**Human contacts.** With a review stage the user's contacts are the batch sitting (rounds 1-2), the announced mini-review of each regulatory epic (an `EPIC_REPORT: MINI_REVIEW` — you ask, the epic coordinator never does), the compliance triage at the queue drain (only when a milestone closed in the batch), and the exceptions listed below; a decision nobody foresaw **parks** the epic instead of asking. Without one, inside the gate there is **one budget**: at most 2 question rounds
(step 3) plus the single closed question of the cap (step 5). After the seal the epic runs
without asking, except for: **`DONE: pendiente de aprobación visual`** (the design-system
foundation epic — you run the gate; routine on any project with a frontend) · `BLOCKED:
sizing` / `contrato` / `contradicción` / `gate` · `BLOCKED: entorno` · `BLOCKED: debug
<slug>` · a protected test in the supersession loop · `BLOCKED` / `REJECTED_MAJOR`
downstream · resumption with unvalidated specs · review mode on request. **An old test
broken by design is not a human contact** — it goes through the supersession loop of
`build/EPIC_COORDINATOR.md`.

