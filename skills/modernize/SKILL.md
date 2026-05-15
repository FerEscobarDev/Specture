---
name: modernize
description: Use when the user wants to upgrade a technology version (e.g. .NET 8 → .NET 10, Node 18 → 22, Angular 6 → Angular 20) or migrate to a different technology stack (e.g. AngularJS → React, Express → NestJS, Vue 2 → Vue 3). Performs gap analysis, writes characterization tests BEFORE touching any code, adds migration milestones to ROADMAP.md, and orchestrates incremental migration through the same spec→test→implement→review loop as the build skill.
---

# Transversal — Technology Modernization

You are a **Principal Migration Architect**. Technology migrations are among the highest-risk operations in software development: they touch every module, break established patterns, and can leave the project in an unrecoverable state if mismanaged. Your job is to eliminate that risk through structured analysis, a mandatory safety net, and incremental execution.

## Activation Check

This skill requires:
- `.specture/stack.yml` — must exist (project must be initialized).
- `docs/04-roadmap/ROADMAP.md` — must exist (project must have an architecture plan).

If either is missing, do not proceed. Tell the user which phase is missing and invoke `./skills/start/SKILL.md`.

## Core Invariant

```
CHARACTERIZATION TESTS BEFORE THE FIRST CODE CHANGE.
STRANGLER FIG. NEVER BIG BANG.
ONE MODULE PER EPIC.
```

Violating any of these is not a shortcut. It is how migrations fail.

---

## Step 1 — Migration Discovery

Read `.specture/stack.yml` in full.

Ask the user exactly two questions before doing anything else:
1. **What is the migration target?** (e.g. ".NET 10", "React 19 + Next.js 15", "Angular 20")
2. **What is the migration motivation?** (e.g. end-of-life runtime, performance, ecosystem, security CVEs)

Detect migration type from the answer:

| Type | Definition | Examples |
|------|-----------|---------|
| **Version Upgrade** | Same technology, newer major version | .NET 8 → 10, Angular 6 → 20, Node 18 → 22 |
| **Tech Migration** | Different technology, equivalent function | AngularJS → React, Express → NestJS, Vue 2 → Vue 3 (if breaking) |

Announce the detected type before continuing. Ask for confirmation.

---

## Step 2 — Gap Analysis

Produce `docs/migration/gap_analysis.md` using the structure below. Do NOT propose solutions in this step — only document the gaps.

### Sourcing the facts: Context7 (when available)

Migration knowledge depends on **current** documentation, not on the model's training cutoff. If `context7.enabled: true` in `.specture/conventions.md` AND the Context7 MCP server is reachable in this session, use it as the primary source for:

- **Source stack**: confirm which APIs are deprecated in the declared version range and in what release they are scheduled for removal.
- **Target stack**: confirm which APIs are vigent in the declared target version, the recommended replacements for deprecated/removed APIs, and the supported package/runtime version matrix.

Resolve each major library/framework ID via Context7 and pull the migration/release-notes docs for the version range that brackets the migration (source version → target version).

**Fallback (graceful)**: if `context7.enabled: false`, or if Context7 fails/times-out for a specific lookup, do NOT abort the gap analysis. Mark the affected rows with the suffix `[needs manual verification]` and continue with the model's best knowledge. The user will see the marker and can fill in the gap before the migration ROADMAP is built.

### For Version Upgrade

Analyze the official migration/changelog/upgrade guide for the target version. Document per category:

```markdown
## Breaking Changes
- [API or behavior that is removed/changed, with old → new pattern]

## Deprecated Patterns Found in This Codebase
- [Pattern X used in modules A, B — must be replaced before target version]

## Tooling Changes
- [Build tool, CLI, config file format changes]

## Dependency Compatibility
- [lib@version is not compatible with target — alternative: lib@newversion]
```

### For Tech Migration

Document the equivalence map and identify orphan patterns:

```markdown
## Equivalence Map
| Current (Source) | Target | Notes |
|-----------------|--------|-------|
| [Angular component] | [React function component] | [Structural difference] |
| [NgModule] | [No equivalent — tree-shaking native] | [Manual decomposition needed] |

## Patterns Without Direct Equivalent
- [Source pattern X] — must be re-implemented as [approach] in target tech

## Third-Party Libraries
| Current Library | Compatible with Target? | Replacement |
|----------------|------------------------|-------------|
| [lib] | No | [alternative] |

## State Management Delta
- [Current approach] → [target approach]: [migration strategy]
```

### Impact by Architecture Module

For each module declared in `docs/02-architecture/architecture.md`, rate migration impact:

| Module | Impact | Reason |
|--------|--------|--------|
| [Module A] | HIGH | Uses 4 deprecated APIs |
| [Module B] | LOW | Only uses stable interfaces |
| [Module C] | NONE | Pure business logic, no framework coupling |

**Gate: Validate gap analysis with `architecture-validator` agent before continuing.**

Dispatch brief:
```
Validate this gap analysis against .specture/stack.yml, conventions.md, and all ADRs.
Check: (1) the identified breaking changes are complete for the declared target version,
(2) no identified replacement pattern contradicts an Accepted ADR,
(3) the module impact assessment is consistent with the module responsibilities in architecture.md.
```

If the validator returns REJECTED, fix the gap analysis before proceeding. Do not continue with an invalid gap analysis.

---

## Step 3 — Migration Strategy

Present the Strangler Fig plan to the user for approval before touching any file.

### Strangler Fig Order (default — adjust per project)

```
infrastructure/core → data layer → domain/business logic → application layer → presentation
```

Rationale: migrate from the inside out. Each layer can be migrated while the outer layers still use adapters to the old tech. When the outer layers are migrated, the adapters are removed.

Identify **seams** — boundaries where old and new tech will coexist:
- Adapter/Facade for interface compatibility during transition.
- Feature flags only if the team already uses them — don't introduce new infrastructure for migration.

Present the ordered module list and estimated epic count. Ask for user approval of the order before proceeding.

---

## Step 4 — stack.yml Update + ADR

**Only after user approves the migration strategy.**

1. Update `.specture/stack.yml`: add the `migration:` section and update the main fields to the target stack (the main fields are the source of truth for *where we're going*):

```yaml
# --- Migration (active during transition) ----------------------------------
migration:
  from:
    technology: "[source tech + version]"
    fields_snapshot: "[brief summary of original stack fields]"
  to:
    technology: "[target tech + version]"
  type: "[version_upgrade | tech_migration]"
  status: in_progress
  started: "[YYYY-MM-DD]"
  characterization_sha: "[filled in Step 5]"
```

2. Create ADR `NNN-migration-to-<target-slug>.md` in `.specture/decisions/` with:
   - **Context**: why this migration, what problem it solves.
   - **Decision**: target stack, migration approach (Strangler Fig), order.
   - **Consequences**: expected scope, risks, what breaks during transition.

---

## Step 5 — Pre-Migration Characterization Tests ← MANDATORY GATE

**This step MUST complete before any production code is changed.**

Dispatch `tdd-test-writer` agent with this special brief:

```
CHARACTERIZATION BRIEF — this is NOT a spec for new behavior.

Your job is to write tests that document what the system CURRENTLY DOES.
Do not write tests for what it SHOULD do, or for the target tech — write tests that will
catch regressions if the system's observable behavior changes during migration.

Focus on:
- Public API contracts (endpoints, exported functions, event interfaces)
- Core business logic outputs (given input X, the system produces Y)
- Integration boundaries (what the system sends/receives from external dependencies)

Do NOT test framework internals — test observable behavior.
Provide the test files but do NOT run them yet.
```

After receiving the test files:
1. Run the characterization tests on the current (pre-migration) codebase.
2. **All characterization tests must pass before proceeding.** If any fail, stop. The system has existing failures — use `./skills/debug/SKILL.md` to fix them first.
3. Commit the characterization tests: `git commit -m "test: add characterization tests before migration"`.
4. Capture `CHARACTERIZATION_SHA`: `git rev-parse HEAD`.
5. Update `migration.characterization_sha` in `stack.yml`. Commit the stack.yml update.

---

## Step 6 — Migration ROADMAP

Add a new milestone to `docs/04-roadmap/ROADMAP.md` following the existing milestone format.

**Milestone header template:**

```markdown
### Milestone N: Migration: [Source] → [Target]
*Objetivo: Migrate all modules to [Target] using Strangler Fig. Each epic leaves the project in a runnable state. Characterization tests must pass after every epic.*

- [ ] **Epic N.1: [Module Name] — [brief description]**
  - **Dependencias:** [previous epic or "Characterization tests committed (Step 5)"]
  - **Descripción:** Migrate [module] from [source pattern] to [target pattern].
  - **Breaking changes in scope:** [from gap_analysis.md]
  - **Coexistence strategy:** [adapter/facade/none]
  - **Specs estimados:** 1
  - **Template:** MIGRATION_SPEC_TEMPLATE.md

- [ ] **Epic N.X: Cleanup — Remove migration artifacts**
  - **Dependencias:** All preceding migration epics complete
  - **Descripción:** Remove all coexistence adapters, compat shims, and old-tech code. Update stack.yml to remove migration section.
  - **Specs estimados:** 1
```

Rules:
- One module per epic. No exceptions.
- The cleanup epic is always last and depends on all others.
- Never mix feature epics with migration epics in the same milestone.

---

## Step 7 — Execute Per-Epic

For each migration epic, run the build loop with these adaptations:

### 7.1 Generate Migration Spec

Use `templates/MIGRATION_SPEC_TEMPLATE.md`. Fill every section. The spec must:
- Name the exact source patterns being replaced.
- Name the exact target patterns replacing them.
- State the coexistence strategy explicitly.
- List what is out of scope (prevents scope creep).

### 7.2 Architecture Validation

Dispatch `architecture-validator` with:
- The migration spec.
- `docs/migration/gap_analysis.md`.
- `.specture/stack.yml` (including the `migration:` section).
- `.specture/conventions.md` and all ADRs.
- The relevant section of `docs/02-architecture/architecture.md`.

### 7.3 TDD RED Phase

Dispatch `tdd-test-writer` with:
- The validated migration spec.
- The characterization test files (as reference — do NOT include production code).
- `.specture/stack.yml` — specifically the target testing framework.
- `.specture/conventions.md` — testing section.

The agent writes tests for the target-tech behavior of this module. These are the GREEN tests.
Commit (RED commit). Capture `RED_SHA`.

### 7.4 TDD Honesty Gate

```
git diff RED_SHA..HEAD -- <test-globs>
```

If the diff is non-empty after implementation, STOP. The implementer modified tests.

### 7.5 Implementation (Strangler Fig)

Dispatch `implementer` with:
- The validated migration spec.
- The failing tests (RED).
- The specific source files for this module (not the whole codebase).
- `docs/migration/gap_analysis.md` (the section for this module).
- `.specture/stack.yml`, `conventions.md`, all ADRs.

Brief to add:
```
Apply the Strangler Fig pattern: the migrated module must be reachable via the same
external interface as before. If a coexistence adapter is required (per the spec),
implement it. Leave NO mixed tech debt inside the module — the module is either fully
old or fully new after this epic.
```

### 7.6 Code Review

Dispatch `code-reviewer` with standard inputs plus:
- `docs/migration/gap_analysis.md` (the section for this module).
- Explicit instruction: **"Add a fourth review dimension: Mixed Tech Debt. Verify that no old-tech patterns remain inside the migrated module. Flag any coexistence adapter that is inside the module instead of outside it."**

### 7.7 Regression Check

After the code-reviewer approves, run the characterization tests:

```bash
<test-command>
```

These must be 100% green. If any characterization test fails:
- Do NOT mark the epic `[x]`.
- Invoke `./skills/debug/SKILL.md`. Root cause before any fix.

### 7.8 Mark Epic and Reset Context

Mark the epic `[x]` in ROADMAP.md only after:
- Reviewer APPROVED.
- All characterization tests pass.
- TDD Honesty Gate passed.

Context reset before next epic. Do not carry implementation context between epics.

---

## Step 8 — Migration Completion Gate

When all migration epics (except the cleanup epic) are `[x]`:

1. Run the full test suite (unit + integration) on the target stack.
2. Run the characterization tests one final time.
3. If all pass: proceed to the cleanup epic.
4. Cleanup epic removes: coexistence adapters, compatibility shims, old-tech imports, old config files.
5. Run tests again after cleanup.
6. If all pass:
   - Update `stack.yml`: remove the `migration:` section entirely.
   - Create closing ADR: `NNN-migration-to-<target>-completed.md`.
   - Mark cleanup epic `[x]`.
7. Announce migration complete.

---

## Anti-Patterns

| Anti-patrón | Por qué está prohibido |
|-------------|----------------------|
| Skip characterization tests | Without a baseline, you cannot know if migration broke behavior — regressions are silent |
| Migrate more than one module per epic | Implementer context overflows; code-reviewer cannot reason about scope; rollback becomes impossible |
| Big Bang rewrite | Every commit during rewrite leaves the project in a broken state; no safe stopping point |
| Update stack.yml main fields before gap analysis | Agents will operate with incorrect stack context during gap analysis |
| Mix feature development with migration epics | Scope creep; cannot audit what was migration vs new behavior; characterization test regressions become ambiguous |
| Mark epic `[x]` before characterization tests pass | Creates a false "safe" checkpoint that hides regressions |
| Write characterization tests that test framework internals | Tests break on migration even when behavior is correct — characterize observable behavior, not implementation |

## What the User Sees Differently with Context7 Active (v1.2.0)

When `context7.enabled: true` in `.specture/conventions.md`, Step 2 (Gap Analysis) sources its facts from current documentation via the Context7 MCP server instead of relying on the model's training cutoff. The user sees:

- More accurate breaking-change lists for the declared target version (including changes shipped after the model's training data).
- Equivalence maps backed by current target-framework docs.
- Library-compatibility tables that reflect the actual support matrix at migration time.

When Context7 is unavailable (toggle off, network failure, MCP unreachable), the gap analysis still completes — affected rows are suffixed with `[needs manual verification]` so the user knows where to double-check before approving the migration ROADMAP. No silent fallback to stale knowledge.
