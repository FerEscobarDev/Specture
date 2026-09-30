# 04c — Review Stage (one sitting of decisions per batch, then execution without questions)

Read **only by the coordinator** of `build`, when the queue step 4.5 opens a batch. The
epic-agent never sees this file. Grammar of the register:
`templates/BATCH_REVIEW_TEMPLATE.md`; parser and CLI: `hooks/lib/review.js`.

Why it exists: under the per-epic gate the user was asked at three moments — when the ROADMAP
was written, at each epic's gate, and at each validation — and the build stalled waiting. The
review stage concentrates every decision the machine can foresee into **one sitting before
execution** (two rounds at most), and leaves execution with a single rule: **a decision nobody
foresaw parks the epic; it is never asked mid-queue** (except the announced mini-review of a
regulatory epic, below). Evidence: `docs/milestone-decision-stage-simulation.md` §7 — the
second round captures what is born of the user's answers, and reading code in the first round
brings forward the money holes; what only appears once a spec is written in detail is what the
mini-review exists for (variant **B2**).

Non-negotiable: **the user decides.** The recommended option is never applied by default. The
real answers matched the recommended one in only 3 of 11 and 5 of 12 decisions in the
simulation.

## R0 — Open or resume

- `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/review.js" status`:
  - `REVIEW: NONE` or `DRAINED` → open a new register
    `docs/05-specs/_reviews/<YYYY-MM-DD>-<slug>.md` from the template, with `ESTADO: PREPARANDO`,
    the batch's `EPICS` in execution order and its `REGULATORIOS` (every epic whose linked RN,
    description or operations handle personal data, health, money or legal consent — say why
    in one line each).
  - `REVIEW: OPEN <id> <ESTADO> pendientes:n` → resume at that state (R1 if `PREPARANDO`, R2 with
    the pending items if `RONDA-1`, R4 if `RONDA-2`). Never re-ask what the register already
    answers. The register's `EPICS` define the batch — a smaller N in the user's request never
    shrinks an open review. Before asking, check that every answered item that changes a rule
    or an ADR is persisted and committed (a cut session may have lost the write); persist what
    is missing first. Announce what is left: "quedan X de Y decisiones".
  - `REVIEW: CLOSED <id> …` → the batch is reviewed: go back to the queue (refresh & seal).
- Never open a review while an epic is `[/]`: finish it, or park it (build/SKILL.md "Parked
  epics") first.

## R1 — Unattended preparation (no questions to the user)

For each epic of `EPICS`, in order:

1. **Code Surface Resolution** (the gate pre-flight of build/SKILL.md).
2. **Fresh `spec-planner` in `MODE: DRAFT`** — blind to code, as always: drafts with Objetivo,
   Contrato, BR/AC/EC with stable IDs and Fuera de Scope, **no Superficie**; an open doubt is
   written with its recommended option marked `sujeto a Q-n`, and its question goes to
   `OPEN_QUESTIONS` with `derivadas:`. The drafts live in `docs/05-specs/<epic-slug>/`.
3. `git add docs/05-specs/<epic-slug>/` and record the TREE (`git write-tree --prefix=…`).
4. `spec-set-check.js <epic-dir> --roadmap … --epic <X.Y> --draft --batch <EPICS>` —
   `DRAFT_FAIL` → one planner micro-pass with the lines as `VIOLATIONS`; still failing →
   note it in the register and continue (a draft never blocks the sitting; it never seals).
   `DRAFT_UNVERIFIABLE` (a malformed table or a missing input) → fix the input or treat it
   as a `DRAFT_FAIL`. No `DRAFT_*` token ever counts as a `MECH_CHECK` for sealing.
5. **Fresh `architecture-validator` in `MODE: REVIEW`** — it **may read code** (Read/Glob only)
   to discover what forces a decision and to **verify premises**; it returns `VIOLATIONS`,
   `HUMAN_DECISIONS` and `PREMISAS` (validator AGENT.md "Modes").
6. **Premises.** Every `PREMISAS` line goes to `## PREMISAS` of the register. A `FALSA` premise
   is never silently corrected: if the sources decide what should happen, it is a `VIOLATION`
   for the planner; if they do not, it becomes a question (step 7). This is what the per-epic
   gate could not do: in real epics a spec said "as today" about behaviour the code did not
   have, and execution found it hours later (AC-13 of HC-IHCE.5, EC-4 of HC-IHCE.6).
7. **Fresh `spec-planner` in `MODE: QUESTIONS`** — turns the `HUMAN_DECISIONS` and the unsettled
   false premises into closed questions (2-4 options, one `(recomendada)` justified by business
   sources, `derivadas:`). It reads no code; the validator's `premisa: path:línea` travels with
   the question as `Dato verificado:`.
8. **Filter, visibly.** A question that a source (RN, ADR, contract, `rules.yml`) or an answer of
   a previous register already decides goes to `## FILTRADAS` with the citation — never
   dropped silently; the draft's `sujeto a Q-n` for it is replaced by that citation in R3. A
   code probe of ≤20 lines may **verify a premise**, never decide an answer.
9. **Policies.** Add the checklist P-1…P-7 of the template. If a previous register of this
   project answered them, show those answers and ask only for confirmation or change.
10. Write the agenda **by theme** (all the money questions together, all the personal-data ones,
    …) in `## AGENDA` / `### Ronda 1`, set `ESTADO: RONDA-1`, and commit drafts + register:
    `docs(review): preparación <id> — N epics, M preguntas`.

## R2 — Round 1 with the user (one sitting)

- Announce the size first: "N decisiones en T temas, unos M minutos", **and list the filtered
  questions** with their citation — the user can say "inclúyela" and it enters this round.
  More than ~40 questions → offer to split into two sittings, or a smaller batch; at most 3
  regulatory epics per sitting.
- `AskUserQuestion` **by theme**, at most 4 questions per call and **as many calls as the
  round needs** — the cap is per call, not per round. The planner's options go verbatim, with
  `Dato verificado:` when a premise backs them.
- "Ninguna de las opciones" → free text, recorded as the user's rule, verbatim.
- "Usá la recomendada" counts only for the items or the theme the user names, and is recorded as
  `respuesta: recomendada — fuente: delegado por el usuario <fecha>` item by item. Never inferred.
- **Persist as you go**: each answer is written to the register immediately (a cut session loses
  nothing); an answer that creates or changes a rule edits `business_requirements.md` **in
  place** (`(aclarado en revisión <id>, <fecha>)`); an architectural one is a new ADR. Commit the
  sources and the register before R3 (`docs(requirements): decisiones de la revisión <id> —
  ronda N`) — the delta re-validation diffs them by commit.

## R3 — Unattended: rewrite and re-validate

1. Fresh planner per epic (`MODE: DRAFT`, minimal edit) with the answers as `ANSWERS` and the
   register as the source of decisions (`fuente: revisión <id> A-n`).
2. `spec-set-check --draft --batch` → validator in `MODE: DELTA` over the diff, **plus `MODE:
   REVIEW` for what the answers opened**: only questions **born of the answers** (derived) or
   **LATE** (an answer that contradicts an Accepted ADR, a BLOCKER rule or the contract) pass.
   The validator may read code again to verify the premises the answers created.
3. **An answer closes a decision only if it addresses its premise.** A `HUMAN_DECISION` that was
   mapped to an answer that does not touch it (the validator marks it "cerrada solo por mapeo")
   goes back to round 2 — in the simulation that mapping silently lost the payment-link hole.

## R4 — Round 2 (only if R3 produced questions)

Same rules as R2, one sitting, `### Ronda 2` in the register, `ESTADO: RONDA-2`. There is no third
round: a doubt still open after it is a scoped `discover` or an explicit deferral with owner.

## R5 — Close

1. Every answer persisted (`## DECISIONES PERSISTIDAS` points where each one landed).
2. `review.js scope-hash --epic <X.Y>` for each epic → `## SCOPE` (the fingerprint of the epic
   block and its RN; execution compares it before refreshing).
3. A readable summary for the user: decisions taken, questions filtered (and why), premises
   verified and false, policies, and **which regulatory epics will have an announced
   mini-review** and roughly when.
4. `ESTADO: CERRADA`, metrics line of the template, commit
   `docs(review): cierre <id> — N decisiones`.
5. One question: "¿Ejecutamos ya la tanda o más tarde?" — later is fine: the register holds
   everything; `/specture:start` resumes.

## The announced mini-review (variant B2 — regulatory epics only)

Before executing an epic listed in `REGULATORIOS`, **after** its refresh wrote the specs in
detail and **before** sealing, dispatch the validator in `MODE: REVIEW` over the written specs,
reading code, focused on what the simulation showed no earlier sweep catches: **what each role
can see and do on each screen or endpoint the epic touches**, and **personal data that enters
through public surfaces** (portals, public forms, tokens). No new `HUMAN_DECISIONS` → seal and
execute without asking. New ones (and any `CONCERNS: decisión-nueva` of this epic's refresh) →
**one** sitting, announced at R5, with the same rules as R2 (`### Mini-revisión <X.Y>` in the
register); then persist and commit the answers, a fresh planner in `MODE: REFRESH` with them as
`ANSWERS`, the real 4a and the validator in `MODE: DELTA`, and seal. A decision still open after
that sitting parks the epic. It is the only planned contact during execution.

## What never happens

- Applying a recommended option the user did not choose.
- Asking during the refresh of a non-regulatory epic: a new decision there **parks** the epic.
- Dropping a filtered question silently, or deciding an answer from code.
- A third round.

## Metrics

At R5, the register's `## MÉTRICAS` line: `review_rounds`, `review_questions`,
`review_filtered`, `review_human_contacts`, `late_questions`, `premises_false`. The build's
metrics lines of the batch's epics carry `batch_id: <id>` so `knowledge stats` counts the
review once per batch.
