// Specture hook guard — shared opt-in check and payload normalisation.
//
// Every Specture hook script calls `guard()` first. It decides whether the
// hook should act based on two conditions:
//   1. The project the edit targets is a Specture project (.specture/stack.yml exists).
//   2. The project's settings declare hooks.enabled: true — read from
//      .specture/settings.yml (v1.15.0+) or, for projects not yet migrated,
//      from the legacy conventions.md §10 block (see lib/settings.js).
//
// When either check fails, hooks exit silently (code 0) so non-Specture
// projects and projects that have not opted in are unaffected.
//
// Two hosts deliver the PreToolUse event on stdin with different envelopes:
//   Claude Code / legacy CLI   { tool_name, tool_input: { file_path | command … } }, cwd = project
//   Antigravity (agy)          { toolCall: { name, args: { TargetFile | CommandLine … } },
//                                workspacePaths: ["<project>"] }, cwd = the plugin directory
// `normalizePayload` hides the difference and `guard({ payload })` finds the project from the
// payload before falling back to the process cwd — under Antigravity the cwd is never the project.

const fs = require("fs");
const path = require("path");
const { readToggle } = require("./settings");

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

// { toolName, toolInput, workspaceRoots, host } from either envelope. Missing pieces are empty,
// never undefined, so callers can read fields without guards.
function normalizePayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const toolCall = p.toolCall && typeof p.toolCall === "object" ? p.toolCall : null;
  const toolInput =
    (p.tool_input && typeof p.tool_input === "object" && p.tool_input) ||
    (toolCall && toolCall.args && typeof toolCall.args === "object" && toolCall.args) ||
    {};
  const workspaceRoots = Array.isArray(p.workspacePaths)
    ? p.workspacePaths.filter((entry) => typeof entry === "string" && entry.length > 0)
    : [];
  return {
    toolName: p.tool_name || (toolCall && toolCall.name) || "",
    toolInput,
    workspaceRoots,
    cwd: typeof p.cwd === "string" && p.cwd ? p.cwd : null,
    host: toolCall ? "antigravity" : "claude"
  };
}

// The path a write/edit targets, whatever the host calls the field.
function targetPathOf(toolInput) {
  const value = toolInput.file_path || toolInput.notebook_path || toolInput.path || toolInput.TargetFile;
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Directories to try, in order, when looking for the project the event belongs to.
function startDirCandidates(payload) {
  const { cwd, workspaceRoots, toolInput } = normalizePayload(payload);
  const candidates = [];
  if (cwd) candidates.push(cwd);
  candidates.push(...workspaceRoots);
  const target = targetPathOf(toolInput);
  if (target && path.isAbsolute(target)) candidates.push(path.dirname(target));
  candidates.push(process.cwd());
  return candidates;
}

function guard(options = {}) {
  const toggleKey = options.toggleKey || "hooks.enabled";
  const candidates = options.cwd ? [options.cwd] : options.payload ? startDirCandidates(options.payload) : [process.cwd()];

  let projectRoot = null;
  for (const candidate of candidates) {
    projectRoot = findProjectRoot(candidate);
    if (projectRoot) break;
  }
  if (!projectRoot) {
    return { active: false, projectRoot: null, reason: "not-a-specture-project" };
  }

  const enabled = readToggle(projectRoot, toggleKey) === true;
  if (!enabled) {
    return { active: false, projectRoot, reason: "opt-in-disabled" };
  }

  return { active: true, projectRoot, reason: null };
}

function readHookPayload() {
  // Both hosts deliver the hook event as JSON on stdin.
  try {
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// The deny decision both hosts understand: Antigravity reads `decision` / `reason`; the flat
// `permissionDecision` pair is what the CLI hooks always printed and what older installs expect.
function denyDecision(reason) {
  return { decision: "deny", reason, permissionDecision: "deny", permissionDecisionReason: reason };
}

module.exports = {
  guard,
  findProjectRoot,
  readConventionsToggle,
  readHookPayload,
  normalizePayload,
  targetPathOf,
  startDirCandidates,
  denyDecision
};
