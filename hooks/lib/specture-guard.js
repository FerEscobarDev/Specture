// Specture hook guard — shared opt-in check.
//
// Every Specture hook script calls `guard()` first. It decides whether the
// hook should act based on two conditions:
//   1. The current working directory is a Specture project (.specture/stack.yml exists).
//   2. The project's .specture/conventions.md declares hooks.enabled: true.
//
// When either check fails, hooks exit silently (code 0) so non-Specture
// projects and projects that have not opted in are unaffected.

const fs = require("fs");
const path = require("path");

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, ".specture", "stack.yml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function readConventionsToggle(projectRoot, toggleKey) {
  const conventionsPath = path.join(projectRoot, ".specture", "conventions.md");
  if (!fs.existsSync(conventionsPath)) return false;
  const content = fs.readFileSync(conventionsPath, "utf8");
  // Matches lines like:  - **hooks.enabled**: true
  //                or:   - hooks.enabled: true
  const pattern = new RegExp(
    `^\\s*-\\s*\\*?\\*?${toggleKey.replace(/\./g, "\\.")}\\*?\\*?\\s*:\\s*(true|false)\\b`,
    "im"
  );
  const match = content.match(pattern);
  return match ? match[1].toLowerCase() === "true" : false;
}

function guard(options = {}) {
  const cwd = options.cwd || process.cwd();
  const toggleKey = options.toggleKey || "hooks.enabled";

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    return { active: false, projectRoot: null, reason: "not-a-specture-project" };
  }

  const enabled = readConventionsToggle(projectRoot, toggleKey);
  if (!enabled) {
    return { active: false, projectRoot, reason: "opt-in-disabled" };
  }

  return { active: true, projectRoot, reason: null };
}

function readHookPayload() {
  // Claude Code delivers the hook event as JSON on stdin.
  try {
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = { guard, findProjectRoot, readConventionsToggle, readHookPayload };
