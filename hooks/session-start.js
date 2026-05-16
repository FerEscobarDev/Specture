#!/usr/bin/env node
// SessionStart hook — emits a routing reminder to the model when the cwd is
// a Specture project that has opted in (hooks.enabled: true in conventions.md).
//
// No-op when the plugin's specture-router agent is active: that agent already
// forces skills/start/SKILL.md on every session, so emitting the reminder here
// would be redundant double enforcement (wasteful, especially in long/loop
// sessions). The reminder is only useful in manual @import setups that have no
// router agent. In any other case it exits silently with code 0.

const fs = require("fs");
const path = require("path");
const { guard } = require("./lib/specture-guard");

const result = guard();
if (!result.active) {
  process.exit(0);
}

// If the plugin ships the specture-router agent (settings.json declares it),
// the router already enforces start routing — skip to avoid double enforcement.
try {
  const settingsPath = path.join(__dirname, "..", "settings.json");
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (settings && settings.agent === "specture-router") {
      process.exit(0);
    }
  }
} catch {
  // If settings can't be read/parsed, fall through and emit the reminder
  // (fail toward enforcement, not toward silence).
}

const message = [
  "Specture está activo en este proyecto.",
  "Antes de cualquier otra acción, invocá `skills/start/SKILL.md` para detectar la fase actual y enrutar al skill correcto.",
  "Trust the filesystem, not chat history."
].join(" ");

// Claude Code reads JSON from the hook's stdout to inject context into the
// session. Using `additionalContext` keeps the message visible to the model
// without interrupting the user.
const payload = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: message
  }
};

process.stdout.write(JSON.stringify(payload));
process.exit(0);
