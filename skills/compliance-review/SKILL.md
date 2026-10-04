---
name: compliance-review
description: 'Use when a milestone closes in the build (Step 8.7 calls it), when the build queue drains with a compliance report waiting for triage, or when the user asks to check code against ALL the project rules — "revisión de cumplimiento", "revisá el milestone N contra las reglas", "qué reglas incumple lo que construimos", "/specture:compliance-review milestone <N> | triage". Reviews the milestone''s code against every R-* invariant, conventions.md, W-* process rules, Accepted ADRs and the team''s custom criteria (.specture/review-rules.md), writes a report with plain-language suggested comments to docs/07-reviews/, and asks the user which findings to address. Never posts anything to GitHub or Azure DevOps.'
---

# Compliance Review (revisión de cumplimiento)

The per-spec `code-reviewer` judges each spec against the rules that match it. This skill judges a **whole milestone** against **every** rule the project declares — invariants whose tags never matched a spec, conventions no dimension covers, the process rules over the commits, Accepted ADRs and the team's own criteria linked from `.specture/review-rules.md` — and leaves a report the user can act on and a set of suggested comments anyone can read without the project's internal documents.

Two modes:

| Mode | When | Who talks to the user |
|---|---|---|
| `milestone <N>` | `build` Step 8.7 when a milestone closes (unattended), or on demand to re-run | nobody when called from `build`; on demand it continues straight into `triage` |
| `triage [<report>]` | `build` queue step 6 when the queue drains, `start` when a report is pending, or on demand | this skill — the only point where the user decides |

The mechanical half lives in `hooks/lib/compliance.js` (range, lint, assemble, triage, correction, status, record); the grammars of the part and the report are in `templates/COMPLIANCE_REPORT_TEMPLATE.md`. You never write the report by hand.

## Iron Rules

1. **Never post.** No `gh pr review`, no `az repos`, no comment anywhere outside the repository. The suggested comments are text in the report; the user decides what to do with them.
2. **Never ask in the middle of a build queue.** Called from Step 8.7, the review runs and returns one informational line; the triage waits for the queue to drain (the same rule as Step 8.5).
3. **The user decides every finding.** You propose; a recommended option is applied only when the user chooses it (for all findings, or for the ones they name). Never infer a decision from silence.
4. **Only a `refactor` is corrected.** A finding of `Tipo: comportamiento` needs a spec (it is deferred, a candidate for `/specture:new-feature` or `/specture:debug`); a finding of `Tipo: test` belongs to the test-writer (deferred or "no aplica"); a finding of `Tipo: proceso` (a commit message, a branch name) is not fixed with code (deferred or "no aplica"). `compliance.js triage` refuses anything else.
5. **One writing agent at a time.** The reviewer writes only its part file under `.specture/state/compliance/<id>/`; after each dispatch `git status --porcelain` must show no change to a tracked file — otherwise stop and escalate (never restore with `git checkout`).
6. **Fail loud, never guess.** A range that cannot be verified, rules that do not resolve, or parts that fail lint twice produce a `BLOCKED` report (`compliance.js stub`) — never a review of the wrong code.

## Required Inputs

- `.specture/settings.yml` — `compliance_review.enabled` (honoured under every profile; default `true`). It gates only the automatic call from `build`; an explicit request always runs.
- `.specture/conventions.md` — passed whole to the reviewer (all sections, §13 `W-*` included); its test globs and §8 language are used by the correction loop.
- `.specture/rules.yml` — through `hooks/lib/rules-resolve.js --all` (`RULES_RESOLVED` with every `R-*`).
- `.specture/review-rules.md` (opt-in) — through `hooks/lib/review-rules-resolve.js --paths-file <chunk>.files` (`CUSTOM_RULES` per chunk). Exit 1 = stop and report it.
- `.specture/decisions/` — the Accepted ADRs relevant to each chunk's components (include when unsure).
- `docs/04-roadmap/ROADMAP.md`, `docs/05-specs/<epic>/_planning.md` (`LOCK_SHA`), `docs/02-architecture/architecture.md` ("Carpeta raíz") — read by `compliance.js range`, not by you.
- `docs/07-reviews/review-<epic-slug>-*.md` of the milestone's epics — the `IMPORTANT`/`NIT` findings their `APPROVED` reviews accepted (`ACCEPTED_FINDINGS`).
- `templates/COMPLIANCE_REPORT_TEMPLATE.md` — the grammars.

## Cross-Platform Subagent Initialization

If the session exposes `define_subagent` (Antigravity CLI), register `compliance-reviewer`, `implementer` and `ux-implementer` from `agents/<name>/AGENT.md` before dispatching. In Claude Code they are registered statically. Script paths: `${CLAUDE_PLUGIN_ROOT}` (Claude Code), `${PLUGIN_ROOT}` (Copilot / Antigravity), `$SPECTURE_ROOT` (manual setups).

## Mode `milestone <N>` — the review

1. **Gate.** Called from `build`: if `compliance_review.enabled` is `false`, print *"Revisión de cumplimiento desactivada (`compliance_review.enabled: false`)"* and return. On demand: run.
2. **Range.**
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" range --milestone <N>
   ```
   - `READY <id> · …` → continue with its chunks (`.specture/state/compliance/<id>/range.json`).
   - `EMPTY` → no code in the milestone: run `assemble` with no parts (an `APPROVED` report that says so) and go to step 6.
   - `UNVERIFIABLE <motivo>` → `compliance.js stub --milestone <N> --reason "<motivo>"`, commit the report (step 5) and tell the user what could not be verified. Do not review.
3. **Review, one chunk at a time.** For each chunk of `range.json`:
   - `rules-resolve.js --project . --all` → `RULES_RESOLVED`.
   - `review-rules-resolve.js --project . --paths-file .specture/state/compliance/<id>/<chunk>.files` → `CUSTOM_RULES` (exit 1 → stub with the resolver's message).
   - Dispatch **`compliance-reviewer`** with `MODE: REVIEW`, `ID`, `CHUNK` + label, `HEAD`, `FILES`, `DIFF_FILE` (`<chunk>.diff`), `COMMITS_FILE` (`commits.txt`), `RULES_RESOLVED`, the content of `conventions.md`, the relevant Accepted ADRs, `CUSTOM_RULES`, `ACCEPTED_FINDINGS` and `PART_FILE` = `.specture/state/compliance/<id>/part-<chunk>.md`.
   - After it returns: `git status --porcelain` — any tracked change → stop and escalate (Iron Rule 5).
4. **Lint, then assemble.**
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" lint --id <id>
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" assemble --id <id>
   ```
   `lint` FAIL → re-dispatch only the failing chunks once, with the lint lines verbatim; a second FAIL → `stub --reason "las partes no cumplen la gramática o citan documentos internos"`. `assemble` prints the report path and its `STATUS`.
5. **Commit** only the report: `git add <report>` and `docs(cumplimiento): milestone <N> — <STATUS>`.
6. **Hand back.**
   - From `build`: one line — *"Cumplimiento Milestone <N>: <STATUS> · BLOCKER n · IMPORTANT n — triage al vaciar la cola"* — and return. Never ask here.
   - On demand: continue with `triage` for this report.

## Mode `triage [<report>]` — the user decides

1. **What is pending.** `compliance.js status` lists reports with `TRIAGE PENDIENTE` and corrections still open, oldest first. Nothing pending → say so and stop. With a `<report>` argument, take only that one.
2. **Precondition: no epic `[/]`.** The correction loop runs without a seal; with an epic in progress its seal would deny the fixes and the two would collide. If an epic is `[/]`, leave the triage `PENDIENTE` and say when it will be asked (the next queue drain).
3. **Show the findings** of the report as a table — `F-n`, severity, Tipo, title, location, and the suggested comment — with a **proposed decision** per finding: `refactor` + `BLOCKER`/`IMPORTANT` → corregir; everything else → diferir. List the conflicts and what was not evaluated under the flexible level.
4. **Ask one closed question** (`AskUserQuestion`; on Copilot / Antigravity a chat turn with the same closed options):
   - *Aplicar la propuesta (Recomendada)*
   - *Decidir hallazgo por hallazgo* — then up to 4 findings per call, options `corregir` (only for `refactor`) / `diferir` / `no aplica`; reasons go in "Other".
   - *Diferir todo*
   - *No aplica a todo*
5. **Record it**:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" triage --report <report> --set "F-1=corregir;F-2=diferir:<motivo>;F-3=no-aplica:<motivo>"
   ```
   (a reason cannot contain `;`). `FAIL` names what is wrong — fix the set, never the report. Commit `docs(cumplimiento): triage milestone <N>`.
6. **Correct** — only if some finding is `corregir`. Dispatch a fresh **general-purpose correction agent** (`model: sonnet`, no history) whose complete procedure is `skills/compliance-review/CORRECTION_LOOP.md`, with: the report path, the full block of each `corregir` finding, `TEST_GLOBS` (the conventions test globs + the test root, as the seal uses them), `TEST_COMMAND`, `stack.yml`, `conventions.md`, the relevant ADRs, `RULES_RESOLVED` (`--all`) and `CUSTOM_RULES` for the findings' files. Wait for its report and record it:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/compliance.js" correction --report <report> --set "F-1=<sha>;F-4=no-corregido:<motivo>"
   ```
   A `fix-range` FAIL or a `NUEVO:` line from the verify pass is escalated to the user with the details — no automatic revert.
7. **Deferred.** Each `diferir` is a `dueño: sin epic` line under `## DIFERIDOS`: offer them once, together, as possible `/specture:new-feature` items (behaviour) or a follow-up refactor — never create anything without the user's yes.
8. **Metrics.** `compliance.js record --report <report>` appends the `kind: "compliance"` line to `docs/.specture-meta/build-metrics.jsonl`; commit it with the report: `docs(cumplimiento): corrección milestone <N>` (or with the triage commit when nothing was corrected).

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "Lo publico en el PR, así lo ven" | Never post. The report holds the suggested comments; the user copies what they want. |
| "Es un cambio chiquito de comportamiento, lo corrijo igual" | Behaviour changes go through a spec. Defer it. |
| "Pregunto ahora, total el epic siguiente puede esperar" | Never ask mid-queue. The triage waits for the drain. |
| "Corrijo el reporte a mano para que quede prolijo" | The script owns the report. Re-run `assemble` (a new `-pK`) or `triage`. |
| "El agente cambió un archivo, lo restauro con git checkout" | Stop and escalate. `git checkout` destroys work that is not yours. |
| "El usuario no contestó, aplico la propuesta" | Silence is not a decision. The triage stays `PENDIENTE`. |

## Exit criteria

- `milestone`: a committed report under `docs/07-reviews/cumplimiento-milestone-<N>-<fecha>[-pK].md` with a parseable `STATUS` and `TRIAGE` — or a committed `BLOCKED` stub that says what could not be verified.
- `triage`: every finding has a decision; every `corregir` has a result under `## CORRECCIÓN`; the metrics line is appended; deferred items were offered once.
