#!/usr/bin/env node
// Specture build-seal hook for CLI agents (Copilot CLI, Antigravity CLI, etc.).
//
// Intercepts Edit / Write / NotebookEdit (and Antigravity's write_to_file /
// replace_file_content) while a build epic is in flight. Reads
// `.specture/state/build-locked.json` (schema v3; v2/v1 still accepted — see lib/seal.js)
// and denies, in precedence order: a sealed TEST path (TDD Honesty Gate), a sealed SPEC path
// (Spec Seal), and — only when the seal carries `allowed_paths` — production code outside the
// declared surface (Allowed Paths). The reason is descriptive and names the recovery path.
//
// A STALE seal (no epic is [/] in ROADMAP.md) fails open: the edit is allowed
// and the reason goes to stderr; `doctor check` reports the leftover file.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { readSeal, classify, denyReason, sealIsStale, relativize } = require("./lib/seal");

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
  if (!seal || seal.corrupt) allow();

  const payload = readHookPayload();
  const toolInput = payload.tool_input || {};
  const targetPath = toolInput.file_path || toolInput.notebook_path || toolInput.path || toolInput.TargetFile;
  if (typeof targetPath !== "string" || targetPath.length === 0) allow();

  const relativePath = relativize(targetPath, result.projectRoot);
  const hit = classify(relativePath, seal);
  if (!hit) allow();

  const epic = seal.epic || "current epic";
  if (sealIsStale(result.projectRoot)) {
    process.stderr.write(
      `Build seal: stale seal for epic "${epic}" (no epic is [/] in ROADMAP.md) — edit allowed. ` +
        `Delete .specture/state/build-locked.json (seal-cli.js release) or run /specture:doctor.\n`
    );
    allow();
  }

  deny(denyReason(hit.kind, relativePath, seal, hit.spec));
} catch {
  // PreToolUse command hooks fail open on uncaught errors to preserve recovery policy.
  // The orchestrator-side git diff remains the defense-in-depth gate.
  allow();
}
