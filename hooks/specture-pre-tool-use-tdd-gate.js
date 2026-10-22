#!/usr/bin/env node
// Specture build-seal hook for Antigravity (agy) and any CLI host that runs `hooks.json`.
//
// Intercepts Antigravity's write_to_file / replace_file_content / multi_replace_file_content
// (and Edit / Write / NotebookEdit when a host sends the Claude envelope) while a build epic is in
// flight. Reads `.specture/state/build-locked.json` (schema v3; v2/v1 still accepted — see
// lib/seal.js) and denies, in precedence order: a sealed TEST path (TDD Honesty Gate), a sealed
// SPEC path (Spec Seal), and — only when the seal carries `allowed_paths` — production code
// outside the declared surface (Allowed Paths). The reason is descriptive and names the recovery
// path.
//
// The project is found from the payload (`workspacePaths`, then the target file's directory),
// never assumed to be the process cwd: Antigravity runs hooks from the plugin directory.
//
// A STALE seal (no epic is [/] in ROADMAP.md) fails open: the edit is allowed
// and the reason goes to stderr; `doctor check` reports the leftover file.

const { guard, readHookPayload, normalizePayload, targetPathOf, denyDecision } = require("./lib/specture-guard");
const { readSeal, classify, denyReason, sealIsStale, relativize } = require("./lib/seal");

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify(denyDecision(reason)));
  process.exit(0);
}

try {
  const payload = readHookPayload();
  const { toolInput } = normalizePayload(payload);
  const targetPath = targetPathOf(toolInput);
  if (!targetPath) allow();

  const result = guard({ payload });
  if (!result.active) allow();

  const seal = readSeal(result.projectRoot);
  if (!seal || seal.corrupt) allow();

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
