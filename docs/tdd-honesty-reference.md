# TDD Honesty — Reference: Violation Classification, Recovery & Sanctioned Supersession

This is the **framework's** on-demand reference for the TDD Honesty Gate (renamed from
`tdd-honesty-violations.md` in v1.18.0 so it never collides with a project's own ledger — in
a project's cwd the old name resolved to *the project's* file; cite it as
`$SPECTURE_ROOT/docs/tdd-honesty-reference.md`, or `${CLAUDE_PLUGIN_ROOT}/docs/tdd-honesty-reference.md`
from the plugin). It is **only read when `git diff <RED_SHA>..<HEAD_SHA> -- <test-globs>` is
non-empty** (a violation was detected) or when a spec declares a supersession. In the happy
path nobody loads this file — that is the point of keeping it external.

Referenced by:
- `skills/build/EPIC_LOOP.md` Step 5.5 (orchestrator-side gate) and Step 4 (supersessions).
- `agents/code-reviewer/AGENT.md` Dimension 4 (independent review).
- `hooks/README.md` (the platform hook is the preventive layer).

## The check

```
git diff <RED_SHA>..<HEAD_SHA> -- <test-path-globs>
```

`<test-path-globs>` comes from `.specture/conventions.md` testing section
(e.g. `'**/*.test.ts' '**/*.spec.ts'`, `'tests/**/*.py' 'test_*.py'`, `'*_test.go'`).

- **Empty output** → no TDD violation. Proceed normally.
- **Non-empty output** → violation. Show the diff to the user verbatim (no
  paraphrasing), then classify and recover per below.

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
| A closed epic's sealed test edited **after** `RED_SHA`, or one not declared under `Supersede:` | `BLOCKER` | Undeclared supersession = a test modification like any other. |

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
   RED commit, resume from that spec), or — when only the test misread a correct spec —
   re-dispatches `tdd-test-writer` with the implementer's concern as input for a **new RED
   commit** (the old one is reverted, never amended) and merges the new `RED_SHA` into the
   seal. Either way the coordinator records the RED-fix in the epic's `_planning.md`
   (`## SUPERSESIONES`, line `- red-fix: <path>::<test> — motivo: … — spec: <slug> — commit:
   <new RED_SHA>`) so the audit trail is on disk, not in a chat.
3. **Abort the spec entirely** if the violation signals a fundamental
   spec/implementation mismatch — report `BLOCKED: spec <AC-n/BR-n/EC-n>`;
   the coordinator runs the spec-correction loop (re-plan → re-validate →
   revert the affected RED → resume from that spec).

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
   its `sup:` row and vice-versa, and the path exists on disk; the validator (per-spec Dim 4)
   confirms the line names an existing test and a `BR-n` of this spec.
3. **Applied by the `tdd-test-writer`, before the RED commit** — a separate commit
   `test(supersede): <epic>/<task-slug> — <path>::<test> (BR-n)` touching only the declared
   files; its SHA is reported as `SUPERSEDE_SHA`. With hooks on, the epic-agent lifts the
   test deny for exactly those paths around the dispatch (`seal-cli.js supersede --paths …`
   / `--clear`). The RED range `<RED_SHA>..<HEAD_SHA>` therefore never contains the
   supersession: the gate excludes it **by declaration**, not by manual exception.
4. **Recorded** — the coordinator fills the `commit:` of each `## SUPERSESIONES` line at
   `DONE` and appends one line per epic to `docs/05-specs/_supersessions.md` (the global
   index: `- <epic-slug> (<fecha>) — N tests supersedidos — ver <epic>/_planning.md
   § SUPERSESIONES`). The per-epic register is the truth; the global file is an index of
   one line per epic, never a narrative.

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
  outside Claude Code, a `supersede_paths` entry left in the seal after the RED commit,
  misconfigured glob in `conventions.md`, or the hook failing open). Investigate the
  bypass source **before** reverting.
