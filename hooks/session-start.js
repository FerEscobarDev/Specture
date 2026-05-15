#!/usr/bin/env node
// SessionStart hook — emits a routing reminder to the model when the cwd is
// a Specture project that has opted in (hooks.enabled: true in conventions.md).
// In any other case it exits silently with code 0.

const { guard } = require("./lib/specture-guard");

const result = guard();
if (!result.active) {
  process.exit(0);
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
