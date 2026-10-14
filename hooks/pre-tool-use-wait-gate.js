#!/usr/bin/env node
// PreToolUse hook — Wait Guard (Claude Code, v2.9.0).
//
// Denies a Bash / PowerShell command that waits instead of working: a sleep of 30 s or more,
// or any sleep inside a loop (polling). See lib/wait-guard.js for the measurement that
// motivated it and the exact rule. Opt-in like every Specture hook (`hooks.enabled`); fails
// open on anything unexpected — the textual rule in build/EPIC_LOOP.md still applies.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { classifyWait, denyReason } = require("./lib/wait-guard");

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason }
    })
  );
  process.exit(0);
}

try {
  const result = guard();
  if (!result.active) allow();

  const payload = readHookPayload();
  const toolInput = (payload && payload.tool_input) || {};
  const command = toolInput.command;
  if (typeof command !== "string" || command.length === 0) allow();

  const hit = classifyWait(command);
  if (!hit) allow();
  deny(denyReason(command, hit));
} catch {
  allow();
}
