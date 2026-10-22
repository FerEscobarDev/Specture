#!/usr/bin/env node
// Specture Wait Guard for Antigravity (agy) and any CLI host that runs `hooks.json`.
//
// Same rule as pre-tool-use-wait-gate.js (Claude Code): a shell command that sleeps 30 s or
// more, or sleeps inside a loop, is a wait — denied with the recovery path in the reason.
// Reads the command from Antigravity's `run_command` (`CommandLine`) or from `command` / `cmd`
// when a host sends the Claude envelope. The project is found from `workspacePaths`, never from
// the process cwd (Antigravity runs hooks from the plugin directory). Opt-in (`hooks.enabled`);
// fails open on uncaught errors.

const { guard, readHookPayload, normalizePayload, denyDecision } = require("./lib/specture-guard");
const { classifyWait, denyReason } = require("./lib/wait-guard");

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
  const command = toolInput.command || toolInput.CommandLine || toolInput.cmd;
  if (typeof command !== "string" || command.length === 0) allow();

  const result = guard({ payload });
  if (!result.active) allow();

  const hit = classifyWait(command);
  if (!hit) allow();
  deny(denyReason(command, hit));
} catch {
  allow();
}
