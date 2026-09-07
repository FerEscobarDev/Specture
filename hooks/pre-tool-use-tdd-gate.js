#!/usr/bin/env node
// PreToolUse hook — TDD Honesty Gate + Spec Seal + Allowed Paths (Claude Code).
//
// While a build epic is in flight, the coordinator and the epic-agent write
// `.specture/state/build-locked.json` through `lib/seal-cli.js` (schema v3: sealed specs,
// allowed paths, one test entry per spec; v1/v2 still accepted — see lib/seal.js). This hook
// denies any Edit/Write/NotebookEdit that targets, in precedence order:
//   1. a sealed TEST path            → "TDD Honesty Gate" (tests are immutable after RED_SHA)
//   2. a sealed SPEC path            → "Spec Seal" (validated specs are immutable during the epic)
//   3. production code OUTSIDE the declared surface, only when the seal carries
//      `allowed_paths`               → "Allowed Paths" (zero code without spec)
//
// Exits 0 (allow) in any of these cases:
//   - hooks.enabled is false (settings.yml, or legacy conventions §10)
//   - cwd is not a Specture project
//   - state file does not exist, is unreadable, or carries no rule (fail open)
//   - file_path matches no rule (docs/ and .specture/ are never governed by allowed_paths)
//   - the seal is STALE (no epic is [/] in ROADMAP.md): allowed WITH a reason,
//     so a leftover seal never blocks unrelated work; `doctor check` reports it.
//
// Exits 0 with a deny decision (JSON payload) when the edit must be blocked.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { readSeal, classify, denyReason, sealIsStale, relativize } = require("./lib/seal");

function allow() {
  process.exit(0);
}

function decide(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason: reason }
    })
  );
  process.exit(0);
}

const result = guard();
if (!result.active) allow();

const seal = readSeal(result.projectRoot);
if (!seal || seal.corrupt) allow();

const payload = readHookPayload();
const toolInput = (payload && payload.tool_input) || {};
const targetPath = toolInput.file_path || toolInput.notebook_path || toolInput.path;
if (!targetPath || typeof targetPath !== "string") allow();

const relative = relativize(targetPath, result.projectRoot);
const hit = classify(relative, seal);
if (!hit) allow();

const epic = seal.epic || "current epic";
if (sealIsStale(result.projectRoot)) {
  decide(
    "allow",
    `Build seal: stale seal for epic "${epic}" (no epic is [/] in ROADMAP.md) — edit allowed. ` +
      `Delete .specture/state/build-locked.json (\`seal-cli.js release\`) or run /specture:doctor.`
  );
}

const reason = denyReason(hit.kind, relative, seal, hit.spec);
decide(
  "deny",
  hit.kind === "test"
    ? `${reason} If you genuinely need to change the test contract, abort the epic via skills/build/EPIC_LOOP.md and ` +
        `re-dispatch the tdd-test-writer with the corrected spec.`
    : reason
);
