---
name: learn
description: Alias of `knowledge` in CAPTURE mode. Use when the user invokes `/specture:learn` or asks to capture session learnings (post-epic, post-debug, on demand, or `--teach <concept>`). Backward-compat alias — the real procedure lives in `skills/knowledge/SKILL.md`.
---

# Alias — learn → knowledge (capture mode)

`/specture:learn` is preserved for muscle memory. Since v1.11.0 it is the **`capture` mode** of the unified `knowledge` skill.

**Invoke `./skills/knowledge/SKILL.md` in `capture` mode**, passing through whatever triggered this:

- Manual / "capturemos aprendizajes" → capture, `manual` trigger.
- From `build` Step 8.5 → capture, `epic` trigger (+ epic-slug, review files, diff range).
- From `debug` Phase 4.5 → capture, `debug` trigger (+ `DEBUG_LOG.md` path).
- `/specture:learn --teach "<concept>"` → capture, teach mode.

Everything — Iron Rules, max-3-drafts, the Plan-mode approval gate, the `knowledge.enabled` toggle, `learn-history.jsonl` logging — is defined in `knowledge/SKILL.md`. Do not duplicate it here.
