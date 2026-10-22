// Hooks checks — does the installed plugin register, in the shape each host loads, the gates
// that `hooks.enabled: true` promises? Every finding: { severity, group: "hooks", check, file,
// detail, action }. Silent when hooks are off: nothing is promised.
//
//   hooks-registry-missing     ERROR    the plugin has no `hooks/hooks.json`, or it does not parse,
//                                       or it lacks the top-level `"hooks"` wrapper, or a registered
//                                       command points to a script that is not there. Claude Code
//                                       loads a plugin's hooks from that file (or from the `hooks`
//                                       key of `.claude-plugin/plugin.json`) — never from the
//                                       plugin's `settings.json`, where Specture kept them from
//                                       v1.2.0 to v2.9.0: every gate shipped inert for Claude Code
//                                       (found in Psikora, 2026-10-18)
//   hooks-self-test-failed     WARNING  the registry is fine but the Wait Guard, run from this
//                                       project with a known polling payload, did not deny it. The
//                                       scripts run, so the toggle or the project root is what the
//                                       guard does not see
//   hooks-antigravity-registry WARNING  (INFO when `agy` is not installed) the root `hooks.json`
//                                       Antigravity loads is missing, has a top-level `version`
//                                       key (agy drops the whole file), or a handler without a
//                                       `command` to an existing script
//   hooks-antigravity-self-test WARNING (INFO when `agy` is not installed) the universal Wait
//                                       Guard, run the way agy runs it — cwd = the plugin
//                                       directory, the project only in `workspacePaths`, the
//                                       command in `toolCall.args.CommandLine` — did not answer
//                                       `decision: "deny"`
//
// What this check cannot see: whether the running session actually loaded the registry. In
// Claude Code that is `/hooks` (the list names the plugin as the source); in agy,
// `agy plugin validate <plugin dir>` prints `"hooks": 1` — the actions say so.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REGISTRY = "hooks/hooks.json";
const WAIT_GATE = "hooks/pre-tool-use-wait-gate.js";
const AGY_REGISTRY = "hooks.json";
const AGY_WAIT_GATE = "hooks/specture-pre-tool-use-wait-gate.js";
const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SELF_TEST_COMMAND = "until grep -q DONE status.txt; do sleep 10; done";

function finding(severity, check, file, detail, action) {
  return { severity, group: "hooks", check, file, detail, action };
}

const VERIFY = "then confirm in Claude Code with `/hooks` that both PreToolUse hooks list the specture plugin as their source (`/reload-plugins` after updating)";
const VERIFY_AGY = "then confirm with `agy plugin validate <plugin dir> --json` that `components.hooks` is 1";

// Returns null when the registry is sound, else the reason.
function registryProblem(pluginRoot) {
  const abs = path.join(pluginRoot, REGISTRY);
  if (!fs.existsSync(abs)) return `the installed plugin (${pluginRoot}) has no ${REGISTRY}`;
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    return `${REGISTRY} is not valid JSON (${error.message})`;
  }
  if (!registry || typeof registry.hooks !== "object" || Array.isArray(registry.hooks)) {
    return `${REGISTRY} lacks the top-level "hooks" wrapper Claude Code requires`;
  }
  const groups = registry.hooks.PreToolUse;
  if (!Array.isArray(groups) || groups.length === 0) return `${REGISTRY} registers no PreToolUse hook`;
  const commands = groups.flatMap((g) => (g.hooks || []).map((h) => h.command || ""));
  for (const command of commands) {
    const match = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"']+)/);
    if (!match) return `a PreToolUse command does not run a script under \${CLAUDE_PLUGIN_ROOT}: ${command}`;
    if (!fs.existsSync(path.join(pluginRoot, match[1]))) return `${match[1]} is registered but does not exist in the plugin`;
  }
  const scripts = commands.join("\n");
  for (const required of ["pre-tool-use-tdd-gate.js", "pre-tool-use-wait-gate.js"]) {
    if (!scripts.includes(required)) return `${REGISTRY} does not register ${required}`;
  }
  return null;
}

// Runs the Wait Guard exactly as Claude Code would (payload on stdin, cwd = project) and
// expects a deny. `null` when it denies, else what happened.
function selfTestProblem(pluginRoot, projectRoot) {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, WAIT_GATE)], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 10000,
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: SELF_TEST_COMMAND } })
  });
  if (result.error) return `the hook could not run (${result.error.message})`;
  if (result.status !== 0) return `the hook exited ${result.status}${result.stderr ? `: ${result.stderr.trim()}` : ""}`;
  try {
    const decision = JSON.parse(result.stdout || "{}");
    if (decision.hookSpecificOutput && decision.hookSpecificOutput.permissionDecision === "deny") return null;
  } catch {
    return `the hook printed something that is not a decision: ${result.stdout.trim().slice(0, 120)}`;
  }
  return "the hook allowed a polling loop it must deny — from this project root it sees hooks as disabled";
}

// Antigravity's `hooks.json`: every top-level key names a hook group → { PreToolUse: [ { matcher,
// hooks: [ { command, timeout } ] } ] }. Returns null when sound, else the reason.
function agyRegistryProblem(pluginRoot) {
  const abs = path.join(pluginRoot, AGY_REGISTRY);
  if (!fs.existsSync(abs)) return `the installed plugin (${pluginRoot}) has no root ${AGY_REGISTRY}`;
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    return `${AGY_REGISTRY} is not valid JSON (${error.message})`;
  }
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) return `${AGY_REGISTRY} is not an object of named hook groups`;
  if ("version" in registry) return `${AGY_REGISTRY} has a top-level "version" key — agy reads every top-level key as a hook group and drops the file`;
  const groups = Object.entries(registry).filter(([, spec]) => spec && typeof spec === "object" && !Array.isArray(spec));
  if (groups.length === 0) return `${AGY_REGISTRY} declares no hook group`;
  const preToolUse = groups.flatMap(([, spec]) => (Array.isArray(spec.PreToolUse) ? spec.PreToolUse : []));
  if (preToolUse.length === 0) return `${AGY_REGISTRY} registers no PreToolUse group`;
  const commands = [];
  for (const group of preToolUse) {
    if (!Array.isArray(group.hooks) || group.hooks.length === 0) return `a PreToolUse group (matcher ${JSON.stringify(group.matcher || "")}) has no "hooks" array — agy needs { type: "command", command, timeout } per handler`;
    for (const hook of group.hooks) {
      if (typeof hook.command !== "string" || !hook.command) return `a handler under matcher ${JSON.stringify(group.matcher || "")} has no "command"`;
      const match = hook.command.match(/\$\{PLUGIN_ROOT\}\/([^"']+)/);
      if (!match) return `a handler does not run a script under \${PLUGIN_ROOT}: ${hook.command}`;
      if (!fs.existsSync(path.join(pluginRoot, match[1]))) return `${match[1]} is registered but does not exist in the plugin`;
      commands.push(hook.command);
    }
  }
  const scripts = commands.join("\n");
  for (const required of ["specture-pre-tool-use-tdd-gate.js", "specture-pre-tool-use-wait-gate.js"]) {
    if (!scripts.includes(required)) return `${AGY_REGISTRY} does not register ${required}`;
  }
  return null;
}

// Runs the universal Wait Guard the way agy does: cwd = plugin directory, camelCase payload,
// the project only in `workspacePaths`. `null` when it answers decision "deny".
function agySelfTestProblem(pluginRoot, projectRoot) {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, AGY_WAIT_GATE)], {
    cwd: pluginRoot,
    encoding: "utf8",
    timeout: 10000,
    input: JSON.stringify({
      conversationId: "doctor-self-test",
      toolCall: { name: "run_command", args: { CommandLine: SELF_TEST_COMMAND, Cwd: projectRoot } },
      workspacePaths: [projectRoot]
    })
  });
  if (result.error) return `the hook could not run (${result.error.message})`;
  if (result.status !== 0) return `the hook exited ${result.status}${result.stderr ? `: ${result.stderr.trim()}` : ""}`;
  try {
    const decision = JSON.parse(result.stdout || "{}");
    if (decision.decision === "deny") return null;
  } catch {
    return `the hook printed something that is not a decision: ${result.stdout.trim().slice(0, 120)}`;
  }
  return "the hook allowed a polling loop it must deny — from the plugin directory it does not find this project in workspacePaths";
}

// `agy` on PATH → Antigravity findings are WARNING; otherwise INFO (nothing is broken for a
// Claude Code-only user, the information is still true).
function agyInstalled() {
  try {
    const result = spawnSync("agy", ["--version"], { encoding: "utf8", timeout: 5000, shell: process.platform === "win32" });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

function run(project, options = {}) {
  if (project.settings.values["hooks.enabled"] !== true) return [];
  const pluginRoot = options.pluginRoot || DEFAULT_PLUGIN_ROOT;
  const out = [];

  const registry = registryProblem(pluginRoot);
  if (registry) {
    out.push(finding(
      "ERROR",
      "hooks-registry-missing",
      ".specture/settings.yml",
      `hooks.enabled: true but Claude Code cannot load the gates: ${registry} — the TDD Honesty Gate, the Spec Seal, Allowed Paths and the Wait Guard never run; only the post-mortem git diffs and the reviewer stand`,
      `update the plugin to a version that ships ${REGISTRY} (≥ 2.9.1), ${VERIFY}`
    ));
  } else {
    const selfTest = selfTestProblem(pluginRoot, project.root);
    if (selfTest) {
      out.push(finding(
        "WARNING",
        "hooks-self-test-failed",
        ".specture/settings.yml",
        `the registry is sound but the Wait Guard run from this project did not deny a known polling loop: ${selfTest}`,
        `check that \`.specture/settings.yml\` declares \`hooks.enabled: true\` (or \`profile: lean | full\`) at the root Claude Code opens, ${VERIFY}`
      ));
    }
  }

  const agySeverity = options.agyInstalled !== undefined ? (options.agyInstalled ? "WARNING" : "INFO") : agyInstalled() ? "WARNING" : "INFO";
  const agyRegistry = agyRegistryProblem(pluginRoot);
  if (agyRegistry) {
    out.push(finding(
      agySeverity,
      "hooks-antigravity-registry",
      AGY_REGISTRY,
      `Antigravity cannot load the gates: ${agyRegistry}`,
      `update the plugin to a version that ships the Antigravity ${AGY_REGISTRY} (≥ 2.11.0), ${VERIFY_AGY}`
    ));
  } else {
    const agySelfTest = agySelfTestProblem(pluginRoot, project.root);
    if (agySelfTest) {
      out.push(finding(
        agySeverity,
        "hooks-antigravity-self-test",
        AGY_REGISTRY,
        `the Antigravity registry is sound but the universal Wait Guard, run as agy runs it, did not deny a known polling loop: ${agySelfTest}`,
        `check that \`.specture/settings.yml\` declares \`hooks.enabled: true\` in the workspace agy opens, ${VERIFY_AGY}`
      ));
    }
  }
  return out;
}

module.exports = {
  run,
  registryProblem,
  selfTestProblem,
  agyRegistryProblem,
  agySelfTestProblem,
  REGISTRY,
  AGY_REGISTRY,
  SELF_TEST_COMMAND
};
