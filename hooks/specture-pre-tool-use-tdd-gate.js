#!/usr/bin/env node
// Specture TDD Honesty Gate hook for CLI agents (Copilot CLI, Antigravity CLI, etc.).
//
// Intercepts Edit / Write / NotebookEdit (and Antigravity's write_to_file /
// replace_file_content) during the TDD RED-to-GREEN window. If an agent attempts
// to modify a sealed test file declared in `.specture/state/build-locked.json`
// (schema v2 `specs[]` or legacy v1 — see lib/seal.js), the hook denies the
// operation with a descriptive reason.
//
// A STALE seal (no epic is [/] in ROADMAP.md) fails open: the edit is allowed
// and the reason goes to stderr; `doctor check` reports the leftover file.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { readSeal, matchSealed, sealIsStale, relativize } = require("./lib/seal");

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({ permissionDecision: "deny", permissionDecisionReason: reason }));
  process.exit(0);
}

try {
  const result = guard();
  if (!result.active) allow();

  const seal = readSeal(result.projectRoot);
  if (!seal || seal.corrupt || seal.specs.length === 0) allow();

  const payload = readHookPayload();
  const toolInput = payload.tool_input || {};
  const targetPath = toolInput.file_path || toolInput.notebook_path || toolInput.path || toolInput.TargetFile;
  if (typeof targetPath !== "string" || targetPath.length === 0) allow();

  const relativePath = relativize(targetPath, result.projectRoot);
  const spec = matchSealed(relativePath, seal);
  if (!spec) allow();

  const epic = seal.epic || "current epic";
  if (sealIsStale(result.projectRoot)) {
    process.stderr.write(
      `TDD Honesty Gate: stale seal for epic "${epic}" (no epic is [/] in ROADMAP.md) — edit allowed. ` +
        `Delete .specture/state/build-locked.json or run /specture:doctor.\n`
    );
    allow();
  }

  deny(
    `TDD Honesty Gate: \`${relativePath}\` is part of the sealed test contract for epic "${epic}"` +
      `${spec.slug ? ` (spec ${spec.slug})` : ""} (RED commit ${spec.red_sha || "unknown"}). ` +
      `Tests cannot be modified between the RED commit and the epic's completion.`
  );
} catch {
  // PreToolUse command hooks fail open on uncaught errors to preserve recovery policy.
  // The orchestrator-side git diff remains the defense-in-depth gate.
  allow();
}
