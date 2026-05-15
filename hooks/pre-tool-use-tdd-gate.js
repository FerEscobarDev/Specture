#!/usr/bin/env node
// PreToolUse hook — TDD Honesty Gate.
//
// While a build epic is in flight (RED commit captured, epic not yet [x]),
// the orchestrator writes `.specture/state/build-locked.json` describing the
// sealed test contract. This hook denies any Edit/Write/NotebookEdit that
// targets a file matching `test_paths` in that state file.
//
// Exits 0 (allow) in any of these cases:
//   - hooks.enabled is false in conventions
//   - cwd is not a Specture project
//   - state file does not exist (not in build loop)
//   - file_path does not match any test glob
//
// Exits 0 with a deny decision (JSON payload) when the edit must be blocked.

const fs = require("fs");
const path = require("path");
const { guard, readHookPayload } = require("./lib/specture-guard");

function allow() {
  process.exit(0);
}

function deny(reason) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  };
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function globToRegExp(glob) {
  // Minimal glob translator covering the patterns used in conventions.md
  // (e.g. `**/*.test.ts`, `tests/**/*.py`, `*.spec.js`).
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^$()|{}[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("(^|/)" + re + "$", "i");
}

function pathMatchesAnyGlob(filePath, globs) {
  const normalized = filePath.replace(/\\/g, "/");
  return globs.some((g) => globToRegExp(g).test(normalized));
}

function relativize(absolutePath, projectRoot) {
  const norm = path.resolve(absolutePath);
  const root = path.resolve(projectRoot);
  if (norm.startsWith(root + path.sep) || norm === root) {
    return path.relative(root, norm).replace(/\\/g, "/");
  }
  return norm.replace(/\\/g, "/");
}

const result = guard();
if (!result.active) allow();

const statePath = path.join(result.projectRoot, ".specture", "state", "build-locked.json");
if (!fs.existsSync(statePath)) allow();

let state;
try {
  state = JSON.parse(fs.readFileSync(statePath, "utf8"));
} catch {
  // Corrupt or unreadable state file — fail open to avoid blocking the user
  // from recovering. The orchestrator-side `git diff` gate is still in place.
  allow();
}

const testPaths = Array.isArray(state.test_paths) ? state.test_paths : [];
if (testPaths.length === 0) allow();

const payload = readHookPayload();
const toolInput = (payload && payload.tool_input) || {};
const targetPath = toolInput.file_path || toolInput.notebook_path || toolInput.path;
if (!targetPath || typeof targetPath !== "string") allow();

const relative = relativize(targetPath, result.projectRoot);

if (pathMatchesAnyGlob(relative, testPaths)) {
  const redSha = state.red_sha || "unknown";
  const epic = state.epic || "current epic";
  deny(
    `TDD Honesty Gate: \`${relative}\` is part of the sealed test contract for epic "${epic}" ` +
      `(RED commit ${redSha}). Tests cannot be modified between the RED commit and the epic's ` +
      `completion. If you genuinely need to change the test contract, abort the epic via ` +
      `skills/build/SKILL.md and re-dispatch the tdd-test-writer with the corrected spec.`
  );
}

allow();
