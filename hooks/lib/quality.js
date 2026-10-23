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
// Since v3.2.0 the file also owns the RUN LOGS: `quality.js run <slot> --log` streams a full run to
// `docs/.specture-meta/runs/`, and `quality.js runs …` lists, reuses (Step 3.9 baseline), records
// failures, sums and prunes them — see "Run logs" below.
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

// ---------------------------------------------------------------------------
// Run logs (v3.2.0) — `docs/.specture-meta/runs/<start>-<slot>-<sha7>.log`
//
// Why: in Psikora HC-IHCE.17 the epic-agent ran the 21-minute suite a second time only to learn
// WHICH tests had failed — it had kept a `tail` of the first run. Every full run now streams its
// whole output to a log the agent greps; the header carries the facts the loop needs (sha, tree
// state, phase, duration) and a sidecar `<log>.failures` carries the failing tests in the
// `BASELINE_FALLOS` grammar, written by the agent (the framework never parses a runner's output).
// A `test` log whose tree equals the current one is a reusable baseline (Step 3.9).
// ---------------------------------------------------------------------------

const { spawn } = require("child_process");

const RUNS_DIR = path.join("docs", ".specture-meta", "runs");
const LOG_FORMAT = 1;
const LOG_SEPARATOR = "# ---";
const CODE_EXCLUDES = ["docs", ".specture"]; // documentation never changes what a suite tests
const NO_FAILURES_LINE = "- (ninguno)";

function git(root, args) {
  const result = spawnSync("git", ["-c", "core.quotePath=false", ...args], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function gitHead(root) {
  const out = git(root, ["rev-parse", "HEAD"]);
  return out ? out.trim() : null;
}

function excludePathspecs() {
  return [".", ...CODE_EXCLUDES.map((d) => `:(exclude)${d}`)];
}

// "clean" | "dirty" | "unknown" — the working tree outside docs/ and .specture/.
function gitTreeState(root) {
  const out = git(root, ["status", "--porcelain", "--untracked-files=all", "--", ...excludePathspecs()]);
  if (out === null) return "unknown";
  return out.trim().length === 0 ? "clean" : "dirty";
}

// true | false | null — HEAD equals <sha> outside docs/ and .specture/.
function treeUnchangedSince(root, sha) {
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) return null;
  const result = spawnSync("git", ["diff", "--quiet", sha, "HEAD", "--", ...excludePathspecs()], { cwd: root, encoding: "utf8" });
  if (result.error || result.status === null || result.status > 1) return null;
  return result.status === 0;
}

function runLogName(startIso, slot, sha) {
  const stamp = String(startIso).replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  return `${stamp}-${slot}-${sha ? String(sha).slice(0, 7) : "unknown"}.log`;
}

function headerLines(fields) {
  return [`# specture-run: ${LOG_FORMAT}`, ...Object.entries(fields).map(([k, v]) => `# ${k}: ${v === null || v === undefined ? "unknown" : v}`), LOG_SEPARATOR, ""].join("\n");
}

function trailerLines(fields) {
  return ["", LOG_SEPARATOR, ...Object.entries(fields).map(([k, v]) => `# ${k}: ${v === null || v === undefined ? "null" : v}`), ""].join("\n");
}

function readChunk(file, position, length) {
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(length);
    const read = fs.readSync(fd, buffer, 0, length, position);
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function parseKeyValues(lines) {
  const out = {};
  for (const line of lines) {
    const m = line.match(/^#\s*([a-z_-]+):\s*(.*)$/i);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// Reads only the head and the tail of a log → { file, name, slot, sha, tree, phase, command, start,
// end, duration_s, exit, complete, failuresFile }. `complete` is false without a trailer (the run
// was cut); `exit` is a number, or null when the shell could not start / the trailer is absent.
function parseRunLog(file) {
  const size = fs.statSync(file).size;
  const head = readChunk(file, 0, Math.min(size, 4096)).split(/\r?\n/);
  const sepAt = head.indexOf(LOG_SEPARATOR);
  const header = parseKeyValues(sepAt === -1 ? head : head.slice(0, sepAt));
  const tailText = readChunk(file, Math.max(0, size - 2048), Math.min(size, 2048));
  const tailLines = tailText.split(/\r?\n/);
  const lastSep = tailLines.lastIndexOf(LOG_SEPARATOR);
  // A trailer is the LAST separator followed by `# end:` and `# exit:` lines. Without one (the run
  // was cut, or the tail only shows the header separator of a tiny log) the run is incomplete:
  // the raw body of a runner never carries both keys as `# ` comment lines.
  const after = lastSep === -1 ? {} : parseKeyValues(tailLines.slice(lastSep + 1));
  const complete = Object.prototype.hasOwnProperty.call(after, "exit") && Object.prototype.hasOwnProperty.call(after, "end");
  const trailer = complete ? after : {};
  const exitRaw = complete ? trailer.exit : null;
  const failuresFile = `${file}.failures`;
  return {
    file,
    name: path.basename(file),
    format: header["specture-run"] ? Number(header["specture-run"]) : null,
    slot: header.slot || null,
    sha: header.sha && header.sha !== "unknown" ? header.sha : null,
    tree: header.tree || "unknown",
    phase: header.phase && header.phase !== "(none)" ? header.phase : null,
    command: header.command || null,
    start: header.start || null,
    end: complete ? trailer.end || null : null,
    duration_s: complete && /^\d+$/.test(trailer.duration_s || "") ? Number(trailer.duration_s) : null,
    exit: exitRaw === null || exitRaw === "null" ? null : Number(exitRaw),
    complete,
    failuresFile: fs.existsSync(failuresFile) ? failuresFile : null
  };
}

// Newest first (the name starts with the ISO start). `slot` filters; absent = every slot.
function listRuns(root, options = {}) {
  const dir = path.join(root, RUNS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".log"))
    .sort()
    .reverse()
    .map((name) => {
      try {
        return parseRunLog(path.join(dir, name));
      } catch {
        return null;
      }
    })
    .filter((run) => run && (!options.slot || run.slot === options.slot));
}

function readFailures(failuresFile) {
  return fs
    .readFileSync(failuresFile, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") && l !== NO_FAILURES_LINE);
}

// The newest `test` log that describes the CURRENT tree — the reusable baseline of Step 3.9:
// complete, taken on a clean tree, with a recorded `.failures` sidecar, whose sha equals HEAD
// outside docs/ and .specture/, while the tree is clean now. { log, failures } | { none: reason }.
function reusableRun(root, options = {}) {
  const slot = options.slot || "test";
  const runs = listRuns(root, { slot });
  if (runs.length === 0) return { none: `sin logs de ${slot} en ${posixPath(RUNS_DIR)}` };
  const treeNow = gitTreeState(root);
  if (treeNow !== "clean") return { none: treeNow === "dirty" ? "árbol sucio fuera de docs/ y .specture/" : "sin git" };
  let reason = null;
  for (const run of runs) {
    if (!run.complete) reason = reason || `${run.name}: corrida incompleta (sin trailer)`;
    else if (run.tree !== "clean") reason = reason || `${run.name}: árbol sucio al correr`;
    else if (!run.failuresFile) reason = reason || `${run.name}: sin .failures registrado (quality.js runs record-failures)`;
    else if (!run.sha) reason = reason || `${run.name}: sha desconocido`;
    else {
      const same = treeUnchangedSince(root, run.sha);
      if (same === true) return { log: run, failures: readFailures(run.failuresFile) };
      reason = reason || `${run.name}: el árbol cambió fuera de docs/ desde ${run.sha.slice(0, 7)}${same === null ? " (diff no verificable)" : ""}`;
    }
  }
  return { none: reason || "ningún log reutilizable" };
}

function posixPath(p) {
  return String(p).replace(/\\/g, "/");
}

// `shell: true` puts a shell between us and the runner: on Windows `child.kill()` ends cmd.exe and
// leaves the runner alive (holding the cwd), so the whole tree is killed.
function killTree(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

// Executes the slot's command with its whole output streamed into a new run log. Resolves with
// the parsed log plus `command`. `timeoutMs` null = no limit (a suite has no time budget).
function runLogged(root, slot, files, options = {}) {
  const quality = readQualityCommands(root);
  const command = quality.commands[slot];
  if (!command) return Promise.resolve({ skipped: quality.states[slot] === "none" ? "none" : "sin definir en stack.yml quality.commands" });
  const expanded = expandCommand(command, files);
  const sha = gitHead(root);
  const tree = gitTreeState(root);
  let phase = null;
  try {
    const seal = require("./seal").readSeal(root);
    phase = seal && !seal.corrupt ? seal.phase : null;
  } catch {
    phase = null;
  }
  const start = new Date();
  const dir = path.join(root, RUNS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  // Two runs started within the same second get `-2`, `-3`…: a log is never overwritten.
  let file = path.join(dir, runLogName(start.toISOString(), slot, sha));
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, runLogName(start.toISOString(), slot, sha).replace(/\.log$/, `-${n}.log`));
  const fd = fs.openSync(file, "w");
  fs.writeSync(fd, headerLines({ slot, sha: sha || "unknown", tree, phase: phase || "(none)", command: expanded, cwd: posixPath(root), start: start.toISOString() }));
  return new Promise((resolve) => {
    const child = spawn(expanded, { cwd: root, shell: true, detached: process.platform !== "win32", stdio: ["ignore", fd, fd], env: { ...process.env, CI: process.env.CI || "1" } });
    let timer = null;
    let timedOut = false;
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        killTree(child);
      }, options.timeoutMs);
    }
    const finish = (exit, error) => {
      if (timer) clearTimeout(timer);
      const end = new Date();
      const trailer = { end: end.toISOString(), duration_s: Math.round((end - start) / 1000), exit: exit === null || exit === undefined ? null : exit };
      if (error) fs.writeSync(fd, `\n# error: ${error.message}\n`);
      if (timedOut) fs.writeSync(fd, `\n# error: timeout after ${options.timeoutMs} ms — process killed\n`);
      fs.writeSync(fd, trailerLines(trailer));
      fs.closeSync(fd);
      resolve({ ...parseRunLog(file), command: expanded, startedWith: { sha, tree, phase } });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(timedOut ? null : code));
  });
}

function recordFailures(logFile, lines) {
  const run = parseRunLog(logFile);
  if (!run.complete) throw new Error(`${run.name} has no trailer — the run was cut; its failures cannot be recorded`);
  const clean = (lines || []).map((l) => String(l).trim()).filter(Boolean).map((l) => (l.startsWith("- ") ? l : `- ${l}`));
  const body = (clean.length === 0 ? [NO_FAILURES_LINE] : clean).join("\n") + "\n";
  const target = `${logFile}.failures`;
  fs.writeFileSync(target, body);
  return { file: target, count: clean.length };
}

// Sums the complete runs started after `since` (an ISO date, or a git rev whose committer date is used).
function runsSummary(root, since, options = {}) {
  let from = null;
  if (since) {
    if (/^\d{4}-\d{2}-\d{2}/.test(since)) from = new Date(since);
    else {
      const out = git(root, ["log", "-1", "--format=%cI", since]);
      from = out ? new Date(out.trim()) : null;
      if (!from) return { error: `rev desconocido: ${since}` };
    }
  }
  const runs = listRuns(root, { slot: options.slot }).filter((r) => r.complete && (!from || (r.start && new Date(r.start) >= from)));
  const seconds = runs.reduce((n, r) => n + (r.duration_s || 0), 0);
  return { runs: runs.length, minutes: Math.round((seconds / 60) * 10) / 10, logs: runs.map((r) => r.name) };
}

// Keeps the newest `keep` logs per slot (sidecars follow their log). Returns the removed paths.
function pruneRuns(root, keep, options = {}) {
  const bySlot = new Map();
  for (const run of listRuns(root, { slot: options.slot })) {
    const key = run.slot || "(sin slot)";
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key).push(run);
  }
  const removed = [];
  for (const runs of bySlot.values()) {
    for (const run of runs.slice(keep)) {
      for (const file of [run.file, `${run.file}.failures`]) {
        if (fs.existsSync(file)) {
          fs.rmSync(file, { force: true });
          removed.push(posixPath(path.relative(root, file)));
        }
      }
    }
  }
  return removed;
}

module.exports = {
  STACK_FILE,
  COMMAND_KEYS,
  RUNS_DIR,
  LOG_FORMAT,
  NO_FAILURES_LINE,
  parseQualityCommands,
  classify,
  readQualityCommands,
  expandCommand,
  commandFor,
  runCommand,
  tailOf,
  gitHead,
  gitTreeState,
  treeUnchangedSince,
  runLogName,
  parseRunLog,
  listRuns,
  reusableRun,
  runLogged,
  recordFailures,
  runsSummary,
  pruneRuns
};

// CLI — what the build agents call instead of guessing a runner:
//   quality.js show   [--project <root>]            one line per slot: the command | none | sin definir
//   quality.js expand <slot> --files a,b             prints the expanded command (exit 0), or `SKIPPED <slot>: …` (exit 3)
//   quality.js run <slot> [--files a,b] [--log] [--timeout-min N]        (v3.2.0)
//        runs the slot; without --log the output passes through; with --log it is streamed whole to
//        docs/.specture-meta/runs/<start>-<slot>-<sha7>.log and a short summary is printed. Exit = the
//        command's exit (3 SKIPPED, 2 usage).
//   quality.js runs [--slot <s>] [--last N] | --sha <rev>                 list the logs, newest first
//   quality.js runs reusable [--slot test]           REUSABLE <log> · sha · failures <n> (exit 0) | NONE <motivo> (exit 3)
//   quality.js runs record-failures --log <path> (--from-file <f> | --failure "<line>"… | --none)
//   quality.js runs summary --since <ISO|rev> [--slot <s>]               runs: N · minutes: M.m
//   quality.js runs prune --keep N [--slot <s>]
const USAGE = [
  "usage: node hooks/lib/quality.js <command> [--project <root>]",
  "  show",
  "  expand <slot> --files a,b",
  "  run <slot> [--files a,b] [--log] [--timeout-min N]",
  "  runs [--slot <s>] [--last N] | runs --sha <rev>",
  "  runs reusable [--slot test]",
  "  runs record-failures --log <path> (--from-file <f> | --failure \"<line>\" ... | --none)",
  "  runs summary --since <ISO|rev> [--slot <s>]",
  "  runs prune --keep N [--slot <s>]"
].join("\n");

function fail(message, code = 2) {
  process.stderr.write(`${message}\n${USAGE}\n`);
  process.exit(code);
}

function formatRun(root, run) {
  const rel = posixPath(path.relative(root, run.file));
  const exit = run.complete ? `exit ${run.exit === null ? "n/a" : run.exit}` : "incompleta";
  const dur = run.duration_s === null ? "" : ` · ${run.duration_s} s`;
  return `${run.name} · ${run.slot || "?"} · sha ${run.sha ? run.sha.slice(0, 7) : "unknown"} · tree ${run.tree} · ${exit}${dur} · failures ${run.failuresFile ? "registrados" : "sin registrar"} · ${rel}`;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const has = (name) => argv.includes(name);
  const all = (name) => argv.map((a, i) => (a === name ? argv[i + 1] : null)).filter((v) => v !== null && v !== undefined);
  const projectRoot = path.resolve(opt("--project") || process.cwd());
  const mode = argv[0];
  const listOpt = (name) => (opt(name) || "").split(",").map((f) => f.trim()).filter(Boolean);
  const slotOf = (key) => {
    if (!COMMAND_KEYS.includes(key)) fail(`unknown slot "${key}" (${COMMAND_KEYS.join(", ")})`);
    return key;
  };

  if (mode === "show") {
    const quality = readQualityCommands(projectRoot);
    for (const key of COMMAND_KEYS) {
      const state = quality.states[key];
      process.stdout.write(`${key}: ${state === "defined" ? quality.commands[key] : state === "none" ? "none" : "sin definir"}\n`);
    }
    process.exit(quality.exists ? 0 : 2);
  }
  if (mode === "expand" && argv[1]) {
    const key = slotOf(argv[1]);
    const quality = readQualityCommands(projectRoot);
    const command = quality.commands[key];
    if (!command) {
      process.stdout.write(`SKIPPED ${key}: ${quality.states[key] === "none" ? "none" : "sin definir en stack.yml quality.commands"}\n`);
      process.exit(3);
    }
    process.stdout.write(expandCommand(command, listOpt("--files")) + "\n");
    process.exit(0);
  }
  if (mode === "run" && argv[1]) {
    const key = slotOf(argv[1]);
    const files = listOpt("--files");
    const timeoutMin = opt("--timeout-min");
    const timeoutMs = timeoutMin ? Number(timeoutMin) * 60 * 1000 : null;
    if (timeoutMin && !(timeoutMs > 0)) fail(`--timeout-min must be a positive number (got ${timeoutMin})`);
    const quality = readQualityCommands(projectRoot);
    const command = quality.commands[key];
    if (!command) {
      process.stdout.write(`SKIPPED ${key}: ${quality.states[key] === "none" ? "none" : "sin definir en stack.yml quality.commands"}\n`);
      process.exit(3);
    }
    if (!has("--log")) {
      const result = spawnSync(expandCommand(command, files), { cwd: projectRoot, shell: true, stdio: "inherit", timeout: timeoutMs || undefined, env: { ...process.env, CI: process.env.CI || "1" } });
      process.exit(result.error ? 1 : result.status === null ? 1 : result.status);
    }
    runLogged(projectRoot, key, files, { timeoutMs }).then((run) => {
      const rel = posixPath(path.relative(projectRoot, run.file));
      process.stdout.write(`RUN ${key}: ${run.complete && run.exit !== null ? `exit ${run.exit}` : "sin exit (proceso cortado o shell no arrancó)"} · ${run.duration_s} s · sha ${run.sha ? run.sha.slice(0, 7) : "unknown"} · tree ${run.tree} · log ${rel}\n`);
      if (!run.sha) process.stdout.write("aviso: sha desconocido (sin git) — este log no sirve como línea base\n");
      if (run.tree === "dirty") process.stdout.write("aviso: árbol sucio fuera de docs/ y .specture/ — este log no sirve como línea base\n");
      if (run.exit !== 0) {
        process.stdout.write(`leer fallos: grep en ${rel} (nunca re-correr la suite para verlos); luego registrarlos:\n`);
        process.stdout.write(`  node hooks/lib/quality.js runs record-failures --log ${rel} --from-file <lista> | --none\n`);
      } else {
        process.stdout.write(`registrar: node hooks/lib/quality.js runs record-failures --log ${rel} --none\n`);
      }
      process.exit(run.exit === null ? 1 : run.exit);
    });
    return;
  }
  if (mode === "runs") {
    const sub = argv[1] && !argv[1].startsWith("--") ? argv[1] : null;
    const slot = opt("--slot") ? slotOf(opt("--slot")) : null;
    if (sub === null) {
      let runs = listRuns(projectRoot, { slot });
      if (opt("--sha")) {
        const target = git(projectRoot, ["rev-parse", opt("--sha")]);
        if (!target) fail(`rev desconocido: ${opt("--sha")}`, 2);
        runs = runs.filter((r) => r.sha === target.trim());
      }
      if (opt("--last")) runs = runs.slice(0, Number(opt("--last")) || 1);
      if (runs.length === 0) process.stdout.write(`sin logs${slot ? ` de ${slot}` : ""} en ${posixPath(RUNS_DIR)}\n`);
      for (const run of runs) process.stdout.write(formatRun(projectRoot, run) + "\n");
      process.exit(0);
    }
    if (sub === "reusable") {
      const result = reusableRun(projectRoot, { slot: slot || "test" });
      if (result.none) {
        process.stdout.write(`NONE ${result.none}\n`);
        process.exit(3);
      }
      process.stdout.write(`REUSABLE ${posixPath(path.relative(projectRoot, result.log.file))} · sha ${result.log.sha.slice(0, 7)} · failures ${result.failures.length}\n`);
      for (const line of result.failures) process.stdout.write(`${line}\n`);
      process.exit(0);
    }
    if (sub === "record-failures") {
      const log = opt("--log");
      if (!log) fail("--log <path> is required for record-failures");
      const abs = path.resolve(projectRoot, log);
      if (!fs.existsSync(abs)) fail(`no existe ${log}`, 2);
      let lines = [];
      if (opt("--from-file")) lines = fs.readFileSync(path.resolve(projectRoot, opt("--from-file")), "utf8").split(/\r?\n/);
      lines = lines.concat(all("--failure"));
      if (!has("--none") && lines.filter((l) => l.trim()).length === 0) fail("record-failures needs --from-file, --failure or --none");
      try {
        const out = recordFailures(abs, has("--none") ? [] : lines);
        process.stdout.write(`RECORDED ${out.count} fallo(s) → ${posixPath(path.relative(projectRoot, out.file))}\n`);
        process.exit(0);
      } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
      }
    }
    if (sub === "summary") {
      const result = runsSummary(projectRoot, opt("--since"), { slot });
      if (result.error) fail(result.error, 2);
      process.stdout.write(`runs: ${result.runs} · minutes: ${result.minutes}\n`);
      process.exit(0);
    }
    if (sub === "prune") {
      const keep = Number(opt("--keep"));
      if (!(keep >= 0) || !opt("--keep")) fail("--keep N is required for prune");
      const removed = pruneRuns(projectRoot, keep, { slot });
      process.stdout.write(removed.length === 0 ? "nada que borrar\n" : removed.map((p) => `borrado ${p}`).join("\n") + "\n");
      process.exit(0);
    }
    fail(`unknown runs subcommand ${sub}`);
  }
  fail(`unknown command ${mode || "(none)"}`);
}
