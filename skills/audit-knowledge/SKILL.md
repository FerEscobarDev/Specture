---
name: audit-knowledge
description: Alias of `knowledge` in AUDIT mode. Use when the user invokes `/specture:audit-knowledge` or asks to audit the docs-index for drift (orphans, stale entries, duplicates, uncovered docs). Backward-compat alias — the real procedure lives in `skills/knowledge/SKILL.md`.
---

# Alias — audit-knowledge → knowledge (audit mode)

`/specture:audit-knowledge` is preserved for muscle memory. Since v1.11.0 it is the **`audit` mode** of the unified `knowledge` skill.

**Invoke `./skills/knowledge/SKILL.md` in `audit` mode.** The full procedure — the 4 drift checks (orphan / stale / duplicate / uncovered), the fixed severity table, the `last-audit.md` + `audit-history.jsonl` reports, and the read-only contract — lives in `knowledge/SKILL.md`. Do not duplicate it here.
