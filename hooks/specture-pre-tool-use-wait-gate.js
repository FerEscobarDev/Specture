#!/usr/bin/env node
// Specture Wait Guard for CLI agents (Copilot CLI, Antigravity CLI, etc.) — v2.9.0.
//
// Same rule as pre-tool-use-wait-gate.js (Claude Code): a shell command that sleeps 30 s or
// more, or sleeps inside a loop, is a wait — denied with the recovery path in the reason.
// Reads the command from `tool_input.command` (Bash / PowerShell), `CommandLine` (Antigravity
// run_command) or `cmd`. Opt-in (`hooks.enabled`); fails open on uncaught errors.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { classifyWait, denyReason } = require("./lib/wait-guard");

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

  const payload = readHookPayload();
  const toolInput = payload.tool_input || {};
  const command = toolInput.command || toolInput.CommandLine || toolInput.cmd;
  if (typeof command !== "string" || command.length === 0) allow();

  const hit = classifyWait(command);
  if (!hit) allow();
  deny(denyReason(command, hit));
} catch {
  allow();
}
