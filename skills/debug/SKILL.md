---
name: debug
description: Use the moment any test fails twice, when a build breaks unexpectedly, when the code-reviewer rejects code, when the implementer reports BLOCKED, when the user reports a bug, or when you find yourself "trying things". Stops guess-and-check loops. Forces root-cause investigation with a physical debug log artifact before any fix is attempted.
---

# Transversal — Systematic Debugging

You are in **emergency mode**. Random fixes waste time and create new bugs. Symptom patches hide root causes.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.
NO FIXES WITHOUT A WRITTEN DEBUG LOG.
```

**Violating the letter of this rule is violating the spirit of debugging.**

If you have not completed Phase 1 + Phase 2 + written the log, you cannot propose a fix.

## When This Skill Activates

Invoke immediately on any of these triggers:

- A test failed and a quick fix didn't make it pass.
- The same test failed twice in TDD GREEN phase.
- The `code-reviewer` agent returned `REJECTED_MAJOR`.
- The `implementer` agent reported `BLOCKED`.
- A build/CI step that was passing yesterday is failing today and you don't know why.
- The user reports unexpected behavior.
- You catch yourself thinking "let me try changing X and see".

## The Four Phases (mandatory order)

### Phase 1 — Root Cause Investigation

1. **Read errors completely.** Full stack trace, full output. Do not skim.
2. **Reproduce reliably.** Can you trigger it on demand? If not, gather more data — do not guess.
3. **Inspect recent changes.** `git log`, `git diff` since last green state. New deps? New config? New env vars?
4. **Trace the data flow.** Where does the bad value originate? Walk back up the call stack until you find the source. Fix at source, not at symptom.
5. **For multi-component failures**: instrument each boundary (logs at component edges) to identify WHICH layer fails first, then investigate that layer.

### Phase 2 — Pattern Analysis

1. **Find a working example** in the same codebase doing something similar.
2. **Compare working vs broken** line by line. List every difference, even ones you think don't matter.
3. **Understand dependencies** — what does the broken code expect that might not be there?

### Phase 3 — Hypothesis & Log (MANDATORY ARTIFACT)

**Before drafting the hypothesis or proposing any fix, enter Plan mode**: invoke `EnterPlanMode`. The plan file is the debug log itself — write the entire log content (raw symptom, Phase 1 findings, Phase 2 findings, hypothesis, proposed minimal fix) into the plan and call `ExitPlanMode` to request user approval. Until the user approves the plan, you cannot run `Edit`, `Write`, or any other non-read tool — Plan mode enforces this mechanically. This converts the Iron Law from convention into a hard system-level gate.

1. **Form ONE hypothesis** in the format: "I think the cause is X because Y."
2. **Create or update** the debug log file at `docs/06-debug-logs/YYYY-MM-DD-<short-slug>.md` using `templates/DEBUG_LOG_TEMPLATE.md`. The log MUST contain:
   - Exact error / symptom (paste raw).
   - Investigation findings from Phase 1.
   - Pattern analysis findings from Phase 2.
   - Hypothesis.
   - Proposed minimal fix.

The log file on disk is written **after** the user approves the plan in `ExitPlanMode`. The plan content and the log content are identical — Plan mode just guarantees the user sees and ratifies it before any fix touches the codebase.

**You cannot write any fix code until this log exists.** No exceptions. The log is your commitment device.

### Phase 4 — Test the Hypothesis

1. **Make the SMALLEST possible change** that could disprove or confirm the hypothesis. One variable at a time.
2. **Run the test/verification** that captures the symptom.
3. **Update the log** with the result.

#### If the hypothesis was correct

- Document the resolution in the log (root cause confirmed + final fix description).
- Verify no other tests broke.
- Run **Phase 4.5 — Capture learnings (opt-in)** below before returning.
- Return to the previous skill (`skills/build/SKILL.md`, `skills/architecture/SKILL.md`, etc.).

### Phase 4.5 — Capture Learnings (opt-in, after confirmed root cause)

Only when the hypothesis was confirmed AND the fix is committed. **Toggle gate**: read `learn.enabled` from `.specture/conventions.md` §10. If `false`, skip.

A confirmed root cause is high-signal: by definition, the system did something the team did not expect. That delta between expectation and reality is often a learning that deserves to live beyond this debug log.

**Prompt to user (default no)**:

> "Causa raíz confirmada y fix commiteado. ¿La causa raíz aplica más allá de este bug puntual (ej. otro módulo podría caer en lo mismo)? Puedo correr `/specture:learn` para proponer un ADR (regla "no hacer X"), una entrada en `docs-index.yml` o un test caracterizador. Es opcional y no toca código. (s/N)"

- **Sí** → invoke `./skills/learn/SKILL.md` passing:
  - Trigger: `debug`
  - Trigger ID: `<debug-log-filename>` (the YYYY-MM-DD-<slug>.md path)
  - Debug log path (full content is small enough to pass as input)
  - Fix commit SHA(s)

  When `learn` returns, continue to Exit Criteria.

- **No** (default) → continue to Exit Criteria.

> **Why opt-in default-no**: most fixes are localized — a typo, a wrong variable, a missing null check. Forcing capture on every debug session generates noise. The user knows when a root cause was *generalizable* (e.g. "we always forget the tenant filter in this kind of query") and says yes then.

#### If the hypothesis was wrong

- Add **Hypothesis 2** to the log. Repeat Phase 3 → Phase 4.
- **Hard limit: 3 hypotheses.** If after 3 you still don't have a fix, STOP.

### Architectural Escalation (after 3 failed hypotheses)

Three failed hypotheses is a signal of an **architectural problem**, not a bug. Stop trying fixes. Discuss with the user:

- Is the underlying pattern fundamentally sound?
- Is each fix revealing a new symptom in a different place? (That's coupling/shared-state pain.)
- Should we refactor the architecture (new ADR) instead of patching?

## Red Flags — STOP and follow the process

If you catch yourself:

- "Let me just try X and see if it works"
- "Quick fix for now, investigate later"
- "It's probably X, let me change that"
- "I don't fully understand it but this might work"
- "One more attempt before logging"
- Skipping the debug log because "this is simple"

…you are violating the Iron Law. Stop. Open the log file.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "It's a simple bug, no need for the log" | Simple bugs have root causes too. The log takes 2 minutes. |
| "I'm under time pressure" | Systematic debugging is FASTER than thrashing. Measured. |
| "I'll write the log after I confirm the fix works" | Then it's not a hypothesis log, it's a post-mortem. Different artifact. |
| "Multiple fixes at once will save time" | You won't know which one worked. Causes new bugs. |
| "The previous skill said to fix it fast" | No skill overrides the Iron Law. |

## Exit Criteria

You can leave this skill and resume the calling phase only when:

- [ ] Root cause is identified (not just "the symptom is gone").
- [ ] Fix is implemented at the root cause level.
- [ ] All previously passing tests still pass.
- [ ] The failing test (or new test capturing the bug) now passes.
- [ ] The debug log is committed to `docs/06-debug-logs/`.

If any item is unchecked, you are not done.

> Comportamiento observable con Plan mode activo: ver `docs/native-integration-guide.md` ("Comportamiento observable por skill").
