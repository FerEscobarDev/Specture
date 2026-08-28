#!/usr/bin/env node
// PreToolUse hook — TDD Honesty Gate (Claude Code).
//
// While a build epic is in flight, the orchestrator writes
// `.specture/state/build-locked.json` describing the sealed test contract
// (schema v2: one entry per spec; v1 still accepted — see lib/seal.js). This
// hook denies any Edit/Write/NotebookEdit that targets a sealed test path.
//
// Exits 0 (allow) in any of these cases:
//   - hooks.enabled is false (settings.yml, or legacy conventions §10)
//   - cwd is not a Specture project
//   - state file does not exist or is unreadable (fail open)
//   - file_path does not match any sealed glob
//   - the seal is STALE (no epic is [/] in ROADMAP.md): allowed WITH a reason,
//     so a leftover seal never blocks unrelated work; `doctor check` reports it.
//
// Exits 0 with a deny decision (JSON payload) when the edit must be blocked.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { readSeal, matchSealed, sealIsStale, relativize } = require("./lib/seal");

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
if (!seal || seal.corrupt || seal.specs.length === 0) allow();

const payload = readHookPayload();
const toolInput = (payload && payload.tool_input) || {};
const targetPath = toolInput.file_path || toolInput.notebook_path || toolInput.path;
if (!targetPath || typeof targetPath !== "string") allow();

const relative = relativize(targetPath, result.projectRoot);
const spec = matchSealed(relative, seal);
if (!spec) allow();

const epic = seal.epic || "current epic";
if (sealIsStale(result.projectRoot)) {
  decide(
    "allow",
    `TDD Honesty Gate: stale seal for epic "${epic}" (no epic is [/] in ROADMAP.md) — edit allowed. ` +
      `Delete .specture/state/build-locked.json or run /specture:doctor.`
  );
}

decide(
  "deny",
  `TDD Honesty Gate: \`${relative}\` is part of the sealed test contract for epic "${epic}"` +
    `${spec.slug ? ` (spec ${spec.slug})` : ""} (RED commit ${spec.red_sha || "unknown"}). ` +
    `Tests cannot be modified between the RED commit and the epic's completion. If you genuinely need to ` +
    `change the test contract, abort the epic via skills/build/SKILL.md and re-dispatch the tdd-test-writer ` +
    `with the corrected spec.`
);
