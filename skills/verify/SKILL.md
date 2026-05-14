---
name: verify
description: Use before claiming any work is "done", "completed", "fixed", "passing", or "ready". Use before committing, before creating PRs, before marking a task or epic complete in ROADMAP, before delegating downstream. Forces fresh execution of the relevant verification command and reading of its output before any success claim.
---

# Transversal — Verification Before Completion

## Overview

Claiming work is complete without verification is **dishonesty, not efficiency**. Even when accidental, it breaks trust and produces broken code.

**Core principle:** Evidence before claims. Always.

**Violating the letter of the rule is violating the spirit of the rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.
```

If you have not run the verification command **in this turn** and read its output, you cannot claim it passed.

## The Gate Function

Before claiming any status, expressing satisfaction, committing, or moving on:

1. **IDENTIFY** — What command proves this claim?
2. **RUN** — Execute the full command (no shortcuts, no cached output assumed).
3. **READ** — Read the full output, check exit code, count failures.
4. **VERIFY** — Does the output actually confirm the claim?
   - If NO → state the actual status with the evidence.
   - If YES → state the claim WITH evidence.
5. **THEN** make the claim.

Skipping any step = lying, not verifying.

## Common Claim → Verification Map

| Claim | Required verification | NOT sufficient |
|-------|----------------------|---------------|
| "Tests pass" | Run the test command, see `0 failures` in current output | Previous run, "should pass", "I'm confident" |
| "Linter clean" | Run linter, see `0 errors` | Partial check, formatter passed |
| "Build succeeds" | Run build, see exit 0 | Tests passed (tests ≠ build) |
| "Bug fixed" | Run the test that reproduces the bug, see PASS | Code changed, looks right |
| "Regression test works" | RED-GREEN cycle: revert fix, see FAIL, restore fix, see PASS | Test passed once after the fix |
| "Spec implemented" | Line-by-line checklist against spec acceptance criteria, plus all tests | Tests pass alone |
| "Agent completed task" | VCS diff shows the changes, run tests independently | Agent's success report |
| "Epic complete" | All specs verified + tests pass + reviewer APPROVED + lint clean | Some specs done |

## Red Flags — STOP

If you catch yourself with any of these, you are about to violate the Iron Law:

- Using "should", "probably", "seems", "I think it"
- Expressing satisfaction or completion without having run the command this turn
- About to write `[x]` in ROADMAP without verifying
- About to commit without verifying
- Trusting another agent's success report without spot-checking
- Thinking "just this once is fine"
- Tired and wanting to be done
- Saying "the previous run passed" — previous ≠ now

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Should work now" | Run the verification command. |
| "I'm confident" | Confidence is not evidence. |
| "Just this once" | No exceptions. |
| "Linter passed, so build passes" | Linter is not the compiler. Run the build. |
| "Implementer agent said success" | Agents lie too. Verify the diff and run tests yourself. |
| "Partial check is enough" | Partial check proves nothing. |
| "I'm tired" | Exhaustion is not an excuse. |

## How to Use This Skill

This skill does not replace other phases — it is a **gate** that the orchestrator (`skills/build/SKILL.md`) passes through before marking anything complete. Any phase that produces an artifact must invoke this gate before reporting "done".

In practice:

```
Implementer says "DONE" 
  → invoke skills/verify/SKILL.md
  → run tests fresh, read output, check 0 failures
  → if pass: continue to review
  → if fail: don't continue; investigate
```

```
About to mark epic [x] in ROADMAP
  → invoke skills/verify/SKILL.md
  → run full test suite, lint, type-check (per stack.yml)
  → all pass: write [x]
  → any fail: stay [/], escalate
```

## When This Skill is the Wrong Skill

- If the verification command itself is failing for reasons unrelated to the work (env issue, missing dep) → that's a debugging issue, route to `skills/debug/SKILL.md`.
- If the verification is impossible to run (prod-only feature, hardware-specific) → say so explicitly. State what you can verify and what you can't. Do NOT claim completion based on what's verifiable when there are unverifiable parts.

## The Bottom Line

**No shortcuts.**

Run the command. Read the output. Then make the claim.

Non-negotiable.
