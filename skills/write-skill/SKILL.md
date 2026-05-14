---
name: write-skill
description: Use when the user wants to create a new Specture skill, modify an existing one, write a custom agent, or extend the framework. Enforces TDD-for-documentation: every skill must be tested with pressure scenarios before it ships.
---

# Transversal — Writing Skills

## Overview

A skill is documentation that **changes how an AI behaves**. It is code in the same way that a prompt is code. Therefore, **skills must be tested before deployment** the same way code must be tested before deployment.

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

## Required Background

You MUST be familiar with `skills/verify/SKILL.md` and the testing discipline it imposes. The same discipline applies to documentation.

## The Iron Law

```
NO SKILL WITHOUT A FAILING TEST FIRST.
```

This applies to NEW skills AND EDITS to existing skills.

- "Just adding a section" — same rule.
- "Just clarifying a paragraph" — same rule.
- "Documentation update" — same rule.

If you wrote the skill before testing the baseline, **delete it and start over**. Don't keep the draft as "reference" — you'll adapt it instead of writing fresh.

## TDD Cycle for Skills

| TDD Phase | Skill Phase |
|-----------|-------------|
| RED — write failing test | Run a pressure scenario through a subagent **without** the skill. Document the verbatim rationalization the agent uses. |
| GREEN — minimal implementation | Write the minimal skill that addresses those exact rationalizations. Don't pre-emptively cover hypotheticals. |
| REFACTOR — close loopholes | Re-run the scenarios. New rationalization emerges → add an explicit counter. Repeat until bulletproof. |

## When to Create a Skill

Create a skill when:
- The technique wasn't intuitive to you and you'd reuse it.
- The pattern applies broadly (not project-specific).
- A behavior keeps drifting and needs explicit guardrails.

Do NOT create a skill for:
- One-off solutions.
- Standard practices already documented elsewhere.
- Project-specific conventions (those go in `.specture/conventions.md`).
- Mechanical constraints (if a regex or validation can enforce it, automate it instead).

## Skill File Structure

Specture skills live in `$SPECTURE_ROOT/skills/`. Each skill is a directory:

```
skills/
└── <semantic-name>/
    └── SKILL.md          # main skill file
```

Examples:
- Phase skills: `discover/SKILL.md`, `architecture/SKILL.md`, `build/SKILL.md`
- Transversal skills: `debug/SKILL.md`, `verify/SKILL.md`, `new-feature/SKILL.md`

### Mandatory frontmatter

```yaml
---
name: <kebab-case-semantic-name>
description: Use when [specific triggering conditions] — symptoms, user phrases, file states. Do not summarize the workflow. (Spanish phrases the user might say are welcome here.)
---
```

### CSO (Claude Search Optimization) — non-negotiable

The `description` field decides whether the skill is loaded. Two rules:

1. **Start with "Use when…"** and describe **triggering conditions**, not what the skill does.
2. **Never summarize the workflow** in the description. If you describe the flow, Claude will follow the description and skip the skill body.

**Bad** (summarizes workflow):
```yaml
description: Use when fixing bugs - investigate root cause first, write a debug log, then make a minimal fix and verify
```

**Good** (triggering conditions only):
```yaml
description: Use when any test fails twice, the user reports a bug, or you find yourself "trying things". Forces root-cause investigation before any fix.
```

### Body skeleton

```markdown
# <Phase Number / Type> — <Skill Title>

## Overview
1-3 sentences. The core insight or principle.

## When to use
Bullet list of triggers. Be concrete.

## When NOT to use
Bullet list of cases where this skill is the wrong fit.

## The process
Steps in order, with explicit gates.

## Red flags / Anti-patterns
Table of rationalizations agents use to skip the discipline, with counters.

## Exit criteria
Checklist: what must be true before you can leave this skill.
```

## Language Rules in Specture Skills

- **Skill body**: English (multi-model compatibility, CSO works better with English keywords, future-proof).
- **User-facing messages produced BY the skill**: Spanish (this is the user's preference).
- **Templates**: Spanish (they live in the user's project and the user reads them).
- **Code examples in skills**: prefer pseudocode or commands over language-specific code; if needed, choose the language that matches the typical use case.

## Closing Loopholes

A skill that enforces discipline must resist rationalization. Every time you test the skill and find an agent talking itself out of compliance, capture the rationalization in a table:

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to need this" | Simple cases break too. The cost of running this is 30 seconds. |
```

Add explicit "Red Flags — STOP" sections listing exact phrases that signal violation.

State the meta-rule: **"Violating the letter of the rule is violating the spirit of the rule."** This cuts off "I'm following the spirit, not the letter" sophistry.

## Testing a Skill (briefly)

Even without a formal test harness, you can manually pressure-test a skill:

1. Pick a scenario where the skill should fire.
2. Open a fresh session of the same model the skill targets.
3. Drop the user into the scenario without invoking the skill.
4. Observe whether the agent does the right thing.
5. Now repeat WITH the skill loaded. Observe.
6. Add the rationalizations the agent used in step 4 as explicit counters in the skill.

## Don'ts

- ❌ Multi-language code examples (one good example beats five mediocre ones)
- ❌ Generic step labels (`step1`, `helper2`) — labels must mean something
- ❌ Narrative storytelling ("In session 2025-X-Y we found…") — skills are reusable references, not war stories
- ❌ Frontmatter `description` that explains workflow (CSO killer)
- ❌ Hardcoded absolute paths (use `$SPECTURE_ROOT` or relative)

## After Writing a Skill

1. Test it (manually if not automated).
2. Add a pointer in `skills/start/SKILL.md` if it's a transversal that needs routing.
3. Commit with a message describing what behavior the skill enforces.
4. Update `README.md` if it changes the framework's surface area.

## Modifying an Existing Skill

Same rules. The Iron Law applies to edits. If you cannot articulate "the agent fails this scenario without my edit", do not edit.
