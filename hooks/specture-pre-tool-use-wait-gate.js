#!/usr/bin/env node
// Specture Wait Guard + Suite Guard for Antigravity (agy) and any CLI host that runs `hooks.json`.
//
// Same rules as pre-tool-use-wait-gate.js (Claude Code): a shell command that sleeps 30 s or
// more, or sleeps inside a loop, is a wait — denied with the recovery path in the reason; and
// (v3.2.0) the full test suite (`quality.commands.test`, `quality.js run|expand test`) is denied
// while the build seal's `phase` is anything but `baseline` or `verify`. Reads the command from
// Antigravity's `run_command` (`CommandLine`) or from `command` / `cmd` when a host sends the
// Claude envelope. The project is found from `workspacePaths`, never from the process cwd
// (Antigravity runs hooks from the plugin directory). Opt-in (`hooks.enabled`); fails open on
// uncaught errors.

const { guard, readHookPayload, normalizePayload, denyDecision } = require("./lib/specture-guard");
const { classifyWait, denyReason } = require("./lib/wait-guard");
const { classifyFullSuite, denyReason: suiteDenyReason } = require("./lib/suite-guard");
const { readSeal, sealIsStale } = require("./lib/seal");
const { readQualityCommands } = require("./lib/quality");

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

  const wait = classifyWait(command);
  if (wait) deny(denyReason(command, wait));

  const seal = readSeal(result.projectRoot);
  const suite = classifyFullSuite({ command, seal, quality: readQualityCommands(result.projectRoot) });
  if (!suite) allow();
  if (sealIsStale(result.projectRoot)) allow(); // a leftover seal never blocks unrelated work
  deny(suiteDenyReason(command, suite));
} catch {
  allow();
}
