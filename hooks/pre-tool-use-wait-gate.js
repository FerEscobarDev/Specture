#!/usr/bin/env node
// PreToolUse hook — Wait Guard (Claude Code, v2.9.0) + Suite Guard (v3.2.0).
//
// Denies a Bash / PowerShell command that waits instead of working: a sleep of 30 s or more,
// or any sleep inside a loop (polling). See lib/wait-guard.js for the measurement that
// motivated it and the exact rule. Since v3.2.0 it also denies the FULL test suite
// (`quality.commands.test`, or `quality.js run|expand test`) while the build seal's `phase` is
// anything but `baseline` or `verify` — see lib/suite-guard.js. A stale seal (no epic `[/]`)
// allows with a reason, like the TDD gate. Opt-in like every Specture hook (`hooks.enabled`);
// fails open on anything unexpected — the textual rules in build/EPIC_LOOP.md still apply.

const { guard, readHookPayload } = require("./lib/specture-guard");
const { classifyWait, denyReason } = require("./lib/wait-guard");
const { classifyFullSuite, denyReason: suiteDenyReason } = require("./lib/suite-guard");
const { readSeal, sealIsStale } = require("./lib/seal");
const { readQualityCommands } = require("./lib/quality");

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

try {
  const result = guard();
  if (!result.active) allow();

  const payload = readHookPayload();
  const toolInput = (payload && payload.tool_input) || {};
  const command = toolInput.command;
  if (typeof command !== "string" || command.length === 0) allow();

  const wait = classifyWait(command);
  if (wait) decide("deny", denyReason(command, wait));

  const seal = readSeal(result.projectRoot);
  const suite = classifyFullSuite({ command, seal, quality: readQualityCommands(result.projectRoot) });
  if (!suite) allow();
  if (sealIsStale(result.projectRoot)) {
    decide(
      "allow",
      `Suite guard: stale seal for epic "${seal.epic || "current epic"}" (no epic is [/] in ROADMAP.md) — command allowed. ` +
        "Delete .specture/state/build-locked.json (`seal-cli.js release`) or run /specture:doctor."
    );
  }
  decide("deny", suiteDenyReason(command, suite));
} catch {
  allow();
}
