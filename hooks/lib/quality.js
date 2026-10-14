// Quality commands — `stack.yml` → `quality.commands` (since v2.8.0).
//
// The framework is language-agnostic: it never derives a command from a tool name
// (`quality.linter: eslint` is informative). What it EXECUTES is what the project declares here:
//
//   quality:
//     commands:
//       test: "..."           # the whole suite — Step 3.9 (baseline) and Step 7 only (v2.9.0)
//       test_scoped: "..."    # only the tests in {files} / {names} — every other run (v2.9.0)
//       type_check: "..."     # compiler / type checker; may take {files}
//       lint: "..."           # linter; may take {files}
//       format_check: "..."   # formatter in check mode (never writes); may take {files}
//       mutation: "..."       # mutation tool; may take {files}; only with settings `mutation.enabled`
//
// `{files}` is replaced by the files under check (space-separated, shell-quoted); `{names}` by
// their base names without extension (for runners that filter by class or test name, e.g.
// `dotnet test --filter`). A command without placeholders runs as-is. `none` = does not apply; `sin definir` / empty / absent = not decided
// (readers get `null` and report SKIPPED — never a guess). No YAML dependency: the file is read
// with the same indentation-based subset the doctor uses for `stack.yml`.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const STACK_FILE = path.join(".specture", "stack.yml");
const COMMAND_KEYS = ["test", "test_scoped", "type_check", "lint", "format_check", "mutation"];
const UNDEFINED_VALUES = ["", "sin definir", "undefined", "tbd", "todo"];
const NONE_VALUES = ["none", "n/a", "no aplica"];

function stripValue(raw) {
  // A `#` starts a comment unless inside quotes (a backslash escapes the next char inside double
  // quotes, YAML-style: `"node -e \"x\" {files}"`); then unquote and unescape.
  let inQuote = null;
  let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuote) {
      if (inQuote === '"' && c === "\\") i++;
      else if (c === inQuote) inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === "#") {
      end = i;
      break;
    }
  }
  const text = raw.slice(0, end).trim();
  if (/^".*"$/s.test(text)) return text.slice(1, -1).replace(/\\(["\\])/g, "$1").trim();
  if (/^'.*'$/s.test(text)) return text.slice(1, -1).replace(/''/g, "'").trim();
  return text;
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

function baseName(file) {
  return String(file).replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "").replace(/\.(test|spec|tests)$/i, "");
}

function expandCommand(command, files) {
  const list = files || [];
  return String(command)
    .replace(/\{files\}/g, list.map(shellQuote).join(" "))
    .replace(/\{names\}/g, [...new Set(list.map(baseName))].join(" "));
}

// The command an agent should run for a slot, expanded — `null` when the slot is `none` or
// undefined. `test_scoped` falls back to nothing on purpose: a scoped run that silently became
// the whole suite is exactly the cost this slot exists to avoid; the caller reports SKIPPED.
function commandFor(projectRoot, key, files) {
  const quality = readQualityCommands(projectRoot);
  const command = quality.commands[key];
  return command ? expandCommand(command, files) : null;
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

module.exports = { STACK_FILE, COMMAND_KEYS, parseQualityCommands, classify, readQualityCommands, expandCommand, commandFor, runCommand, tailOf };

// CLI (v2.9.0) — what the build agents call instead of guessing a runner:
//   node hooks/lib/quality.js show   [--project <root>]            one line per slot: the command | none | sin definir
//   node hooks/lib/quality.js expand <slot> --files a,b [--project <root>]
//     prints the expanded command (exit 0), or `SKIPPED <slot>: none | sin definir …` (exit 3)
if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const projectRoot = path.resolve(opt("--project") || process.cwd());
  const mode = argv[0];
  if (mode === "show") {
    const quality = readQualityCommands(projectRoot);
    for (const key of COMMAND_KEYS) {
      const state = quality.states[key];
      process.stdout.write(`${key}: ${state === "defined" ? quality.commands[key] : state === "none" ? "none" : "sin definir"}\n`);
    }
    process.exit(quality.exists ? 0 : 2);
  }
  if (mode === "expand" && argv[1]) {
    const key = argv[1];
    if (!COMMAND_KEYS.includes(key)) {
      process.stderr.write(`unknown slot "${key}" (${COMMAND_KEYS.join(", ")})\n`);
      process.exit(2);
    }
    const files = (opt("--files") || "").split(",").map((f) => f.trim()).filter(Boolean);
    const quality = readQualityCommands(projectRoot);
    const command = quality.commands[key];
    if (!command) {
      process.stdout.write(`SKIPPED ${key}: ${quality.states[key] === "none" ? "none" : "sin definir en stack.yml quality.commands"}\n`);
      process.exit(3);
    }
    process.stdout.write(expandCommand(command, files) + "\n");
    process.exit(0);
  }
  process.stderr.write("usage: node hooks/lib/quality.js show [--project <root>] | expand <slot> --files a,b [--project <root>]\n");
  process.exit(2);
}
