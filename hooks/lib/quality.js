// Quality commands — `stack.yml` → `quality.commands` (since v2.8.0).
//
// The framework is language-agnostic: it never derives a command from a tool name
// (`quality.linter: eslint` is informative). What it EXECUTES is what the project declares here:
//
//   quality:
//     commands:
//       test: "..."           # the whole suite
//       type_check: "..."     # compiler / type checker; may take {files}
//       lint: "..."           # linter; may take {files}
//       format_check: "..."   # formatter in check mode (never writes); may take {files}
//       mutation: "..."       # mutation tool; may take {files}; only with settings `mutation.enabled`
//
// `{files}` is replaced by the files under check (space-separated, shell-quoted). A command
// without it runs as-is. `none` = does not apply; `sin definir` / empty / absent = not decided
// (readers get `null` and report SKIPPED — never a guess). No YAML dependency: the file is read
// with the same indentation-based subset the doctor uses for `stack.yml`.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const STACK_FILE = path.join(".specture", "stack.yml");
const COMMAND_KEYS = ["test", "type_check", "lint", "format_check", "mutation"];
const UNDEFINED_VALUES = ["", "sin definir", "undefined", "tbd", "todo"];
const NONE_VALUES = ["none", "n/a", "no aplica"];

function stripValue(raw) {
  // A `#` starts a comment unless inside quotes; then unquote.
  let inQuote = null;
  let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === "#") {
      end = i;
      break;
    }
  }
  return raw.slice(0, end).trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

// Raw `quality.commands` entries as written: { key: "value" } (unknown keys kept), plus the
// line numbers, or null when the block does not exist.
function parseQualityCommands(stackText) {
  const lines = String(stackText || "").split(/\r?\n/);
  let inQuality = false;
  let commandsIndent = null;
  let found = false;
  const values = {};
  const lineOf = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = line.match(/^ */)[0].length;
    if (indent === 0) {
      inQuality = /^quality\s*:/.test(line);
      commandsIndent = null;
      continue;
    }
    if (!inQuality) continue;
    if (commandsIndent === null) {
      if (/^\s+commands\s*:\s*(#.*)?$/.test(line)) {
        commandsIndent = indent;
        found = true;
      }
      continue;
    }
    if (indent <= commandsIndent) {
      commandsIndent = null;
      continue;
    }
    const entry = line.match(/^\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!entry) continue;
    values[entry[1]] = stripValue(entry[2]);
    lineOf[entry[1]] = i + 1;
  }
  return found ? { values, lineOf } : null;
}

// "defined" | "none" | "undefined"
function classify(value) {
  if (value === undefined || value === null) return "undefined";
  const text = String(value).trim().toLowerCase();
  if (UNDEFINED_VALUES.includes(text)) return "undefined";
  if (NONE_VALUES.includes(text)) return "none";
  return "defined";
}

// { exists, block, commands: { test, type_check, lint, format_check, mutation }, states }
//   commands.<key>: the command string, or null when `none` / undefined / absent
//   states.<key>:   "defined" | "none" | "undefined"
function readQualityCommands(projectRoot) {
  let text = null;
  try {
    text = fs.readFileSync(path.join(projectRoot, STACK_FILE), "utf8");
  } catch {
    text = null;
  }
  const block = text === null ? null : parseQualityCommands(text);
  const commands = {};
  const states = {};
  for (const key of COMMAND_KEYS) {
    const raw = block ? block.values[key] : undefined;
    const state = classify(raw);
    states[key] = state;
    commands[key] = state === "defined" ? String(raw).trim() : null;
  }
  return { exists: text !== null, block, commands, states };
}

function shellQuote(file) {
  return /^[A-Za-z0-9_./\\:-]+$/.test(file) ? file : `"${String(file).replace(/"/g, '\\"')}"`;
}

function expandCommand(command, files) {
  if (!/\{files\}/.test(command)) return command;
  return command.replace(/\{files\}/g, (files || []).map(shellQuote).join(" "));
}

// Runs a declared command in the project (shell), returning { command, status, stdout, stderr }.
// `status` is null when the shell could not start.
function runCommand(projectRoot, command, files, options = {}) {
  const expanded = expandCommand(command, files);
  const result = spawnSync(expanded, {
    cwd: projectRoot,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeoutMs || 15 * 60 * 1000,
    env: { ...process.env, CI: process.env.CI || "1" }
  });
  return {
    command: expanded,
    status: result.error ? null : result.status,
    stdout: result.stdout || "",
    stderr: result.error ? result.error.message : result.stderr || ""
  };
}

// The last N lines of a command's combined output — what a report can carry.
function tailOf(result, maxLines = 40) {
  const combined = `${result.stdout}${result.stdout && result.stderr ? "\n" : ""}${result.stderr}`.replace(/\s+$/, "");
  const lines = combined ? combined.split(/\r?\n/) : [];
  return lines.length > maxLines ? ["…", ...lines.slice(-maxLines)] : lines;
}

module.exports = { STACK_FILE, COMMAND_KEYS, parseQualityCommands, classify, readQualityCommands, expandCommand, runCommand, tailOf };
