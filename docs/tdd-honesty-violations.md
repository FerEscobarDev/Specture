# TDD Honesty — Violation Classification & Recovery

This is the on-demand reference for the TDD Honesty Gate. It is **only read when
`git diff <RED_SHA>..<HEAD_SHA> -- <test-globs>` is non-empty** (i.e. a violation
was detected). In the happy path (empty diff) nobody loads this file — that is
the point of keeping it external.

Referenced by:
- `skills/build/SKILL.md` Step 5.5 (orchestrator-side gate).
- `agents/code-reviewer/AGENT.md` Dimension 4 (independent review).

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

1. **Revert test changes** — `git checkout <RED_SHA> -- <test-paths>` and
   re-dispatch the implementer with a stronger Iron-Rule-1 reminder.
2. **Implementer was right that the test was wrong** (rare): revert, then
   re-run `tdd-test-writer` with the implementer's concern as input. Get a new
   RED commit. Restart Step 5 with the new `RED_SHA`.
3. **Abort the spec entirely** if the violation signals a fundamental
   spec/implementation mismatch — fix the spec, restart from Step 3.

## Why this gate is non-negotiable

If the test contract can be silently rewritten, every other review dimension
becomes unreliable — "tests pass" stops being a signal of "spec implemented".
The orchestrator-side check (Step 5.5) and the reviewer's independent check
(Dimension 4) are intentional defense-in-depth; the platform hook
(`hooks/pre-tool-use-tdd-gate.js`, v1.2.0) is a third preventive layer when
`hooks.enabled: true`.

## Hook-active vs hook-inactive interpretation

- **Hook inactive + gate fires** → standard TDD violation: the implementer
  modified tests. Recover per options above.
- **Hook active + gate fires** → TDD violation **plus a hook bypass**:
  something modified tests that the hook should have blocked (external edit
  outside Claude Code, misconfigured glob in `conventions.md`, or the hook
  failing open). Investigate the bypass source **before** reverting.
