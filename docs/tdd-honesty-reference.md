# TDD Honesty — Reference: Violation Classification, Recovery & Sanctioned Supersession

This is the **framework's** on-demand reference for the TDD Honesty Gate (renamed from
`tdd-honesty-violations.md` in v1.18.0 so it never collides with a project's own ledger — in
a project's cwd the old name resolved to *the project's* file; cite it as
`$SPECTURE_ROOT/docs/tdd-honesty-reference.md`, or `${CLAUDE_PLUGIN_ROOT}/docs/tdd-honesty-reference.md`
from the plugin). It is **only read when the Step 5.5 check fails** (a violation was detected)
or when a spec declares a supersession. In the happy path nobody loads this file — that is the
point of keeping it external.

Referenced by:
- `skills/build/EPIC_LOOP.md` Step 5.5 (orchestrator-side gate) and Step 4 (supersessions).
- `agents/code-reviewer/AGENT.md` Dimension 4 (independent review).
- `hooks/README.md` (the platform hook is the preventive layer).

## The check

Since v2.2.0 the check is three mechanical commands (`hooks/lib/honesty-check.js`, first
stdout line = token, exit 0 PASS · 1 FAIL · 2 UNVERIFIABLE):

```
node hooks/lib/honesty-check.js clean-tree                                  # nothing uncommitted under the test globs
node hooks/lib/honesty-check.js range --slug <task-slug> --epic-dir <dir>   # allowlist of test commits after the RED
node hooks/lib/honesty-check.js red-lines --slug <task-slug>                # every line the original RED added survives
```

`range` walks `git rev-list <red_sha_orig>..HEAD -- <test-globs>`: every commit that touches a
test must be a SHA registered in `## SUPERSESIONES` of `_planning.md` (a loop supersession or
a `red-fix`) and touch only the paths registered with it; `supersede_paths` in the seal must be
empty. `red_sha_orig` is the spec's **first** RED — `merge-spec` never moves it.

Without node (or without a seal) the fallback is the historical diff:

```
git diff <RED_SHA>..<HEAD_SHA> -- <test-path-globs>
```

`<test-path-globs>` comes from `.specture/conventions.md` testing section
(e.g. `'**/*.test.ts' '**/*.spec.ts'`, `'tests/**/*.py' 'test_*.py'`, `'*_test.go'`).

- **Three `PASS`** (or an empty diff) → no TDD violation. Proceed normally.
- **Any `FAIL`** (or a hunk whose commit is not registered) → violation. The epic-agent puts
  the token, its lines and the diff **verbatim in its report** (it has no channel to the
  user); the coordinator shows them to the user unparaphrased, then classify and recover per
  below.

## Classification table

| Change observed in diff | Severity | Note |
|--------------------------|----------|------|
| Test file modified (assertion changed, expected value softened, comparison loosened) | `BLOCKER` / `REJECTED_MAJOR` | Prototypical violation. Spec contract rewritten silently. |
| Test deleted | `BLOCKER` | Equivalent to skipping. |
| Skip annotation added (`it.skip`, `xit`, `@Disabled`, `@Ignore`, `pytest.mark.skip`, `t.Skip()`, `@Skip`) | `BLOCKER` | Silent skip. Treat exactly as deletion. |
| Test renamed (path or function name) | `BLOCKER` | Even no-op renames break the contract identifier. |
| Test moved to a different file | `BLOCKER` | Same reason. |
| New test file added (not present at RED) | `IMPORTANT` | Suspicious — `tdd-test-writer` already wrote the tests. Investigate: legit test helper, or a smokescreen passing test added to dilute failures. |
| Existing test helper modified | `IMPORTANT`→`BLOCKER` | `BLOCKER` if it weakens assertions in the helper. |
| Snapshot file regenerated to match new output | `BLOCKER` | If the snapshot was the test's primary assertion. |
| A **closed epic's** sealed test edited in a declared `test(supersede)` commit **before** `RED_SHA` | not a violation | Sanctioned supersession (below): the path is in the spec's `Supersede:` section, the commit precedes the RED commit, so it is outside the range by construction. |
| A closed epic's test edited **after** `RED_SHA` in a `test(supersede): … — loop <capa>` commit whose SHA is registered in `## SUPERSESIONES` with `j9: SÍ` and exactly those paths | not a violation | Supersession discovered in execution (below): `range` accepts it by SHA, `red-lines` proves the RED survived, the reviewer judges the rewrite against its rule. |
| A closed epic's sealed test edited **after** `RED_SHA` without that registration, or one not declared under `Supersede:` | `BLOCKER` | Undeclared supersession = a test modification like any other. |

## Additional checks (run regardless of the diff result)

- Any skip annotation on tests **anywhere touching this spec's surface area**,
  even pre-existing → flag `IMPORTANT` so the user decides.
- "Vacuous green": a RED test passes at HEAD without code that obviously
  implements the spec (trivial `return true`, hardcoded values, no-op). This is
  not a test modification but a spec misimplementation → `BLOCKER` under
  Dimension 1 (Spec Compliance), citing the vacuously-passing test.
- `git diff --name-status <RED_SHA>..<HEAD_SHA> -- <test-paths>`: anything other
  than no entries (or an unchanged `M`) is a violation.

## Recovery options (orchestrator escalates to user)

1. **Revert test changes** — restore the test paths to `RED_SHA` (snapshot to scratch first;
   never `git checkout` to restore in-flight work — see `build/EPIC_LOOP.md` Anti-Patterns)
   and re-dispatch the implementer with a stronger Iron-Rule-1 reminder.
2. **RED-fix — the implementer was right that the sealed test was wrong** (rare, audited):
   never edit the test in place. The epic-agent reports `BLOCKED: spec <AC-n/BR-n/EC-n>`
   when the spec itself was wrong (the coordinator runs the spec-correction loop: unseal
   that spec's entry with `seal-cli.js unseal-spec`, re-plan, re-validate, `git revert` the
   RED commit, resume from that spec), or — when only the test is **mechanically** defective
   (it does not compile or load, or its setup contradicts a premise the spec states: a
   fixture, a seed, the route or role it names) — reports `BLOCKED: red-fix <task-slug>`.
   Since v2.2.1 the epic-agent never unseals anything itself: the coordinator runs
   `unseal-spec`, re-seals with `write`, reverts the RED **and the spec's production commits**
   (so the new RED fails against code without the implementation), and re-dispatches with the
   defect list; the test-writer writes a **new RED commit** (never an amend), the epic-agent
   restores the production work after it and merges the new `RED_SHA` with `--reset-orig`. A
   disagreement about *what* a test asserts is never a red-fix — it is `BLOCKED: spec`.
   Either way the coordinator records the RED-fix in the epic's `_planning.md`
   (`## SUPERSESIONES`, line `- red-fix: <path>::<test> — motivo: … — spec: <slug> — commit:
   <new RED_SHA>`) so the audit trail is on disk, not in a chat.
3. **Abort the spec entirely** if the violation signals a fundamental
   spec/implementation mismatch — report `BLOCKED: spec <AC-n/BR-n/EC-n>`;
   the coordinator runs the spec-correction loop (re-plan → re-validate →
   revert the affected RED and its production commits → resume from that spec; the
   epic-agent restores the production work right after the new RED commit).

## Sanctioned supersession of a closed epic's tests (v1.18.0, roadmap item 35)

The gate's original model was "the implementer touched tests → violation". Real projects
also need the **legitimate cross-epic change**: a later epic that, by design, contradicts a
test sealed by an earlier, closed epic (a rule changed, an endpoint's contract evolved). The
protocol makes that visible and mechanical instead of a ledger of exceptions:

1. **Declared in the spec** — section "Supersesiones de tests sellados" of
   `SPEC_TEMPLATE.md` (§10 of `MIGRATION_SPEC_TEMPLATE.md`): one line per test,
   `Supersede: <path>::<test> — motivo: BR-n — epic origen: <epic-slug>`. Only tests of a
   **closed** epic: a sibling spec's test inside the same epic is the spec-correction loop,
   never a supersession. The planner writes the matching `sup:` rows in the `COVERAGE_TABLE`
   and the `## SUPERSESIONES` register of `_planning.md` (`commit: pendiente`).
2. **Checked before the validator** — `spec-set-check.js` C-sup: every `Supersede:` line has
   its `sup:` row and vice-versa, the path exists on disk and — since v2.2.0 — the test name
   appears in the file (full name, without its `[…]`/`(…)` suffix, or its last segment;
   a parameterised name that does not appear is a WARNING). The validator (per-spec Dim 4)
   only confirms the `motivo` is a rule of this spec (`BR-n`; `AC-n`/`GAP-nnn` in a
   migration) and the origin epic is closed. **Whether the list is complete is no longer a
   gate criterion** — the planner cannot see the tests, and execution finds the rest.
3. **Applied by the `tdd-test-writer`, before the RED commit** — a separate commit
   `test(supersede): <epic>/<task-slug> — <path>::<test> (BR-n)` touching only the declared
   files; its SHA is reported as `SUPERSEDE_SHA`. With hooks on, the epic-agent lifts the
   test deny for exactly those paths around the dispatch (`seal-cli.js supersede --slug <task-slug> --paths …`
   / `--clear`). The RED range `<RED_SHA>..<HEAD_SHA>` therefore never contains the
   supersession: the gate excludes it **by declaration**, not by manual exception.
4. **Recorded** — the coordinator fills the `commit:` of each `## SUPERSESIONES` line at
   `DONE` and appends one line per epic to `docs/05-specs/_supersessions.md` (the global
   index: `- <epic-slug> (<fecha>) — N tests supersedidos — ver <epic>/_planning.md
   § SUPERSESIONES`). The per-epic register is the truth; the global file is an index of
   one line per epic, never a narrative.

## Supersessions discovered in execution (v2.2.0)

The gate used to demand a complete list of the old tests a spec breaks. The planner cannot
see tests, so that list was guesswork: in a real epic three of four rejections and a whole
day of gate were spent on it, and the gate still caught only 30 % of what execution then
found in minutes. Since v2.2.0 the list declared at the gate is **what the sources show**,
and the rest is discovered by running the suite, in two layers:

- **Compile layer (before GREEN).** An old test that no longer compiles or loads because a
  rule of the spec renamed or removed something: the implementer commits its production work
  as WIP and reports `BLOCKED: supersesiones (compilación)` with the full log, **touching no
  test**.
- **Runtime layer (after GREEN).** Every failure outside the spec's RED tests and outside
  `BASELINE_FALLOS` (failures that predate the epic) is re-run twice (flakes) and classified
  from the runner's report — compilación · preparación · aserción · producción · entorno ·
  desconocido. The class only **raises** scrutiny: a production frame or a 5xx is
  `producción`; `desconocido` counts as `producción`. `aserción`/`producción` is the
  implementer's regression unless it cites a rule of the spec that makes the old expectation
  false; it never bends production against a rule and never touches the test.

The coordinator then runs the **supersession loop**, with no revert, no unsealing of the RED
and no question to the user:

1. **J9 — judged with data, by someone else.** A fresh validator receives each failing
   test's old assertion and first failure line and answers, per test, "does a rule of this
   spec make the old expectation false?" — `SÍ` (citing the rule), `NO` or
   `INDETERMINABLE`. Only `SÍ` tests are superseded; the rest go back to the implementer as
   regressions. Without this step the one deciding "regression or design" would be the
   implementer.
2. **Only the Supersesiones section of the spec changes.** `seal-cli.js lift-spec` releases
   that one spec file; a fresh planner in `MODE: SUPERSESSIONS` writes the `Supersede:` lines,
   `sup:` rows and register lines; `honesty-check spec-delta` compares the spec with its
   sealed version ignoring only that section — any other byte sends the epic to the full
   spec-correction loop (re-RED).
3. **Protected tests stay out.** `honesty-check protected` fails when a supersession touches a
   test named in a `verify:` of `.specture/rules.yml` or a GUARD of another epic: amending a
   project invariant is the user's decision, never the loop's.
4. **The rewrite is blind and registered.** The test-writer, in `MODE: SUPERSEDE-HEAD`,
   receives the spec and the declared tests — never the failure output or its values — and
   commits `test(supersede): … — loop <capa>`. The epic-agent records its SHA in the register;
   `seal-cli supersede --slug` refuses any path of a spec's own RED unless `--shared-with-red`
   is explicit.
5. **The RED survives.** `honesty-check red-lines`: every line the original RED commit added
   still exists at HEAD (multiset). `clean-tree` runs before every step that commits tests,
   so uncommitted edits cannot be laundered into a registered commit.
6. **Retroactive RED at the lock.** For assertion rewrites, `honesty-check base-worktree`
   checks the rewritten tests out on top of `LOCK_SHA` (the commit that locked the epic): they
   must **fail** there and **pass** at HEAD. Passing in both means they do not express the
   rule; not compiling at the lock is `REVIEW`, handed to the reviewer.
7. **Independent review.** The code-reviewer's Dimension 4 reads each rewrite against its
   rule: a rewrite weaker than the rule is a `BLOCKER` with `CAUSE: implementation`.

At most one loop per spec and per layer; a second one is escalated. In a migration epic the
rule may be an `AC-n` or a `GAP-nnn`, and characterization tests never enter the loop unless
the spec declares the `GAP-nnn` that retires that behaviour.

**Residual risk, said plainly.** Before v2.2.0, a supersession was decided before the RED and
the range excluded it by construction. Now a test can change **after** the RED, justified by a
rule. What still protects the contract is: a different agent judges each case with the data
(J9); the rewrite is blind to the values the code returns; the retroactive RED at the lock
proves the new test discriminates; the RED lines are intact; every commit is on an
allowlist; and an independent reviewer reads the result. What is **not** protected: a J9 and
a reviewer that both accept a rule reading that is too generous. That is the price of not
asking the user about each old test — and it is visible, because every loop leaves its
register lines, its J9 verdict and its commits on disk. To audit by hand:
`git log --oneline <red_sha_orig>..HEAD -- <test-globs>` and compare each SHA with
`## SUPERSESIONES` of the epic's `_planning.md`.

## Retroactive remediation of closed epics without a real RED

A closed epic whose tests were never RED (or never sealed) is remediated by a **remediation
epic** planned through the same gate: its specs declare the existing behavior to protect as
"Guards de no-regresión (nacen verdes)" and the tests they legitimately replace under
`Supersede:`. No new mechanism, no manual ledger — the guards are born green by declaration,
the supersessions are excluded from the range by declaration, everything else is a normal RED.

## Why this gate is non-negotiable

If the test contract can be silently rewritten, every other review dimension
becomes unreliable — "tests pass" stops being a signal of "spec implemented".
The orchestrator-side check (Step 5.5) and the reviewer's independent check
(Dimension 4) are intentional defense-in-depth; the platform hook
(`hooks/pre-tool-use-tdd-gate.js`, schema v3 since v1.18.0) is a third preventive layer when
`hooks.enabled: true` — for sealed tests, sealed specs and writes outside the declared surface.

## Hook-active vs hook-inactive interpretation

- **Hook inactive + gate fires** → standard TDD violation: the implementer
  modified tests. Recover per options above.
- **Hook active + gate fires** → TDD violation **plus a hook bypass**:
  something modified tests that the hook should have blocked (external edit
  outside Claude Code, a `supersede_paths` entry left in the seal — `honesty-check range`
  now fails on that by itself —, misconfigured glob in `conventions.md`, a spec left in
  `lifted_spec_paths` by an interrupted loop, or the hook failing open). Investigate the
  bypass source **before** reverting.
