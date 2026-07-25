#!/usr/bin/env node
// Specture TDD Honesty Gate hook for CLI agents (Copilot CLI, Antigravity CLI, etc.).
//
// Intercepts Edit / Write / NotebookEdit operations during the TDD RED-to-GREEN window.
// If an agent attempts to modify a sealed test file declared in `.specture/state/build-locked.json`,
// the hook denies the operation with a descriptive reason.

const fs = require("fs");
const path = require("path");
const { guard, readHookPayload } = require("./lib/specture-guard");

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      permissionDecision: "deny",
      permissionDecisionReason: reason
    })
  );
  process.exit(0);
}

function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const character = glob[i];
    if (character === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (character === "?") {
      re += "[^/]";
    } else if (".+^$()|{}[]\\".includes(character)) {
      re += "\\" + character;
    } else {
      re += character;
    }
  }
  return new RegExp("(^|/)" + re + "$", "i");
}

function pathMatchesAnyGlob(filePath, globs) {
  const normalized = filePath.replace(/\\/g, "/");
  return globs.some((glob) => globToRegExp(glob).test(normalized));
}

function relativize(absolutePath, projectRoot) {
  const normalizedPath = path.resolve(absolutePath);
  const normalizedRoot = path.resolve(projectRoot);
  if (
    normalizedPath.startsWith(normalizedRoot + path.sep) ||
    normalizedPath === normalizedRoot
  ) {
    return path.relative(normalizedRoot, normalizedPath).replace(/\\/g, "/");
  }
  return normalizedPath.replace(/\\/g, "/");
}

try {
  const result = guard();
  if (!result.active) allow();

  const statePath = path.join(
    result.projectRoot,
    ".specture",
    "state",
    "build-locked.json"
  );
  if (!fs.existsSync(statePath)) allow();

  let state;
  try {
    state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    allow();
  }

  const testPaths = Array.isArray(state.test_paths) ? state.test_paths : [];
  if (testPaths.length === 0) allow();

  const payload = readHookPayload();
  const toolInput = payload.tool_input || {};
  const targetPath =
    toolInput.file_path || toolInput.notebook_path || toolInput.path;
  if (typeof targetPath !== "string" || targetPath.length === 0) allow();

  const relativePath = relativize(targetPath, result.projectRoot);
  if (!pathMatchesAnyGlob(relativePath, testPaths)) allow();

  deny(
    `TDD Honesty Gate: \`${relativePath}\` is part of the sealed test contract for epic "${state.epic || "current epic"}" ` +
      `(RED commit ${state.red_sha || "unknown"}). Tests cannot be modified between the RED commit and the epic's completion.`
  );
} catch {
  // PreToolUse command hooks fail open on uncaught errors to preserve recovery policy.
  // The orchestrator-side git diff remains the defense-in-depth gate.
  allow();
}
