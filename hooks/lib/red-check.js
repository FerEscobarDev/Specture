#!/usr/bin/env node
// RED check — the mechanical verification of a spec's RED commit BEFORE it is sealed (v2.8.0).
//
//   node hooks/lib/red-check.js <command> [options] [--project <root>] [--json]
//
//   files     --red-sha <sha> --slug <s> --epic-dir <dir> [--test-globs a,b]
//             (1) every file of the RED commit is a test (the seal's test_globs, or --test-globs)
//                 or a path the spec declares (`Crea:` / `Fixtures disponibles:`). A helper or a
//                 fixture outside that surface is the spec telling you it is incomplete — the
//                 Allowed Paths gate would deny it mid-GREEN, as a red-fix loop; here it costs a
//                 re-dispatch of the writer or a `BLOCKED: spec` before anyone implements.
//             (1b) no file of the RED names a documentation path (`docs/`, `.specture/`, a
//                 `*.md`, the docs-index `source_of_truth_dir`): a test never reads documentation,
//                 Specture's or the project's (lib/doc-paths.js — v3.0.0, after Psikora's CI
//                 went red when a pruning removed the `.md` files 41 tests read).
//   coverage  --red-sha <sha> --slug <s> --epic-dir <dir> --map <file> [--level strict|essential]
//             (2) every AC/BR/EC id of the spec appears exactly once in the writer's COVERAGE_MAP
//                 and every test name the map cites exists literally in a file of the RED commit.
//                 `--level essential` (the project's `tdd.level`, v3.1.0) demands only the AC-n.
//   commands  --red-sha <sha>
//             (3) runs stack.yml `quality.commands` type_check / lint / format_check with
//                 {files} = the RED commit's files. A slot `sin definir` or `none` is SKIPPED.
//   all       every flag of the three; stops at the first FAIL.
//
// Why these three and not more: the red-fix commits of real projects (Psikora, CEAgenda, oct 2026)
// came from exactly these causes — fixtures outside the surface, type/lint errors in the tests
// found by the reviewer rounds later, and ids without a test — plus weak tests, which the
// mutation command of build Step 6 covers. Everything here is a universal fact (git, files,
// the declared commands); nothing is judgement.
//
// stdout: one token per check — `RED-CHECK <cmd>: PASS <detalle>` | `FAIL <n>` |
// `SKIPPED <motivo>` | `UNVERIFIABLE <motivo>`; then `- <hallazgo>` lines and `- nota:` lines.
// Exit 0 = PASS/SKIPPED, 1 = FAIL, 2 = UNVERIFIABLE or usage. `--json` prints the result objects.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { STATE_FILE, readSeal, pathMatchesAnyGlob } = require("./seal");
const { parseSpec, parseSpecIds } = require("./planning");
const { readQualityCommands, runCommand, tailOf } = require("./quality");
const { scanDocumentationReads, sourceOfTruthDir } = require("./doc-paths");

const COMMAND_FLAGS = {
  files: ["red-sha", "slug", "epic-dir", "test-globs"],
  coverage: ["red-sha", "slug", "epic-dir", "map", "level"],
  commands: ["red-sha"],
  all: ["red-sha", "slug", "epic-dir", "test-globs", "map", "level"]
};
// `--level` (v3.1.0, the project's `tdd.level`): which ids a test is mandatory for. `strict`
// (default) = every AC/BR/EC; `essential` = the AC-n only — a BR/EC entry in the map is still
// checked when present, never demanded. `none` never reaches this check (no RED exists).
const COVERAGE_LEVELS = { strict: /^(?:AC|BR|EC)-\d+$/, essential: /^AC-\d+$/ };
const LIST_FLAGS = ["test-globs"];
const CHECK_COMMANDS = ["type_check", "lint", "format_check"];
const SHA = /^[0-9a-f]{7,40}$/i;
const MAP_ID = /^\s*-\s*((?:AC|BR|EC)-\d+)\b(.*)$/;

class UsageError extends Error {}

function usage() {
  return [
    "usage: red-check.js <command> [options] [--project <root>] [--json]",
    "  files     --red-sha <sha> --slug <task-slug> --epic-dir <dir> [--test-globs a,b]",
    "  coverage  --red-sha <sha> --slug <task-slug> --epic-dir <dir> --map <coverage-map file> [--level strict|essential]",
    "  commands  --red-sha <sha>",
    "  all       --red-sha <sha> --slug <task-slug> --epic-dir <dir> --map <file> [--test-globs a,b] [--level strict|essential]"
  ].join("\n");
}

function posix(p) {
  return String(p).replace(/\\/g, "/").replace(/^\.\//, "");
}

function splitList(value) {
  return String(value).split(/\s*,\s*|\n/).map((v) => posix(v.trim())).filter(Boolean);
}

function parseArgs(argv) {
  const opts = { command: argv[0], flags: {}, lists: {}, json: false, project: null };
  const known = COMMAND_FLAGS[opts.command];
  if (!known) throw new UsageError(`unknown command ${opts.command || "(none)"}`);
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new UsageError(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === "json") {
      opts.json = true;
      continue;
    }
    if (key !== "project" && !known.includes(key)) throw new UsageError(`unknown option --${key} for ${opts.command}`);
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`missing value for --${key}`);
    if (key === "project") opts.project = value;
    else if (LIST_FLAGS.includes(key)) opts.lists[key] = (opts.lists[key] || []).concat(splitList(value));
    else opts.flags[key] = value;
  }
  return opts;
}

function requireFlags(opts, ...keys) {
  for (const key of keys) {
    if (!(key in opts.flags)) throw new UsageError(`--${key} is required for ${opts.command}`);
  }
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

function git(root, args) {
  const result = spawnSync("git", ["-c", "core.quotePath=false", ...args], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) return { ok: false, stdout: "", stderr: result.error.message };
  return { ok: result.status === 0, stdout: result.stdout || "", stderr: (result.stderr || "").trim() };
}

function firstLine(text) {
  return String(text || "").split(/\r?\n/)[0];
}

function short(sha) {
  return String(sha).slice(0, 7);
}

// The RED commit's files, project-relative (the project may live in a subdirectory of the repo).
function redFiles(cmd, root, rev) {
  const prefixResult = git(root, ["rev-parse", "--show-prefix"]);
  if (!prefixResult.ok) return { error: unverifiable(cmd, `sin git en ${root}: ${firstLine(prefixResult.stderr) || "no es un repositorio"}`) };
  const prefix = posix(prefixResult.stdout.trim());
  const verify = git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  if (!verify.ok) return { error: unverifiable(cmd, `commit desconocido: ${rev}`) };
  const sha = verify.stdout.trim();
  const show = git(root, ["show", "--name-only", "--no-renames", "--format=", sha]);
  if (!show.ok) return { error: unverifiable(cmd, `git show ${short(sha)} falló: ${firstLine(show.stderr)}`) };
  const files = show.stdout.split(/\r?\n/).map((l) => posix(l.trim())).filter(Boolean)
    .map((p) => (prefix && p.startsWith(prefix) ? p.slice(prefix.length) : prefix ? null : p))
    .filter(Boolean);
  if (files.length === 0) return { error: unverifiable(cmd, `el commit ${short(sha)} no toca ningún archivo del proyecto`) };
  return { sha, files };
}

// A RED file's contents: the working tree first (the RED is HEAD when the check runs), else
// the committed blob.
function readRedFile(root, sha, file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    const show = git(root, ["show", `${sha}:${file}`]);
    return show.ok ? show.stdout : "";
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function unverifiable(command, reason, extra = {}) {
  return { command, status: "UNVERIFIABLE", reason, detail: null, findings: [], notes: [], ...extra };
}

function skipped(command, reason, extra = {}) {
  return { command, status: "SKIPPED", reason, detail: null, findings: [], notes: [], ...extra };
}

function verdict(command, findings, detail, extra = {}) {
  return { command, status: findings.length > 0 ? "FAIL" : "PASS", reason: null, detail, findings, notes: [], ...extra };
}

function loadSpec(cmd, root, opts) {
  const dir = path.resolve(root, opts.flags["epic-dir"]);
  const file = path.join(dir, `${opts.flags.slug}.spec.md`);
  if (!fs.existsSync(file)) return { error: unverifiable(cmd, `no existe ${posix(path.relative(root, file))}`) };
  const text = fs.readFileSync(file, "utf8");
  return { text, rel: posix(path.relative(root, file)), parsed: parseSpec(text, opts.flags.slug) };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function filesCheck(opts, root) {
  const cmd = "files";
  requireFlags(opts, "red-sha", "slug", "epic-dir");
  const red = redFiles(cmd, root, opts.flags["red-sha"]);
  if (red.error) return red.error;
  let globs = opts.lists["test-globs"] || [];
  if (globs.length === 0) {
    const seal = readSeal(root);
    if (!seal) return unverifiable(cmd, `sin sello (${posix(STATE_FILE)}) y sin --test-globs`);
    if (seal.corrupt) return unverifiable(cmd, `sello corrupto (${posix(STATE_FILE)})`);
    globs = seal.test_globs || [];
    if (globs.length === 0) return unverifiable(cmd, "el sello no declara test_globs");
  }
  const spec = loadSpec(cmd, root, opts);
  if (spec.error) return spec.error;
  const declared = spec.parsed.surface
    .filter((s) => (s.kind === "crea" || s.kind === "fixtures") && s.path)
    .map((s) => posix(s.path));
  const inDeclared = (file) => declared.some((d) => file === d || (d.endsWith("/") && file.startsWith(d)) || file.startsWith(`${d}/`));
  const findings = red.files
    .filter((file) => !pathMatchesAnyGlob(file, globs) && !inDeclared(file))
    .map((file) => `${file} — fuera de los test globs y no declarado en la Superficie (Crea: / Fixtures disponibles:) de ${spec.rel}`);
  // (1b) no test reads documentation — Specture's or the project's.
  const extraDirs = [sourceOfTruthDir(root)].filter(Boolean);
  for (const file of red.files) {
    for (const read of scanDocumentationReads(readRedFile(root, red.sha, file), { extraDirs })) {
      findings.push(`${file}:${read.line} — lee documentación (\`${read.match}\`): ningún test del proyecto depende de documentación; un entregable documental es un DOC-n del spec, sin test`);
    }
  }
  return verdict(cmd, findings, `${red.files.length} archivo(s) del RED ${short(red.sha)} dentro de los test globs o de la Superficie, sin lecturas de documentación`, { files: red.files });
}

// `- AC-1 → test "name"` · `- BR-1 → test+ "a" / test- "b"` · `- EC-2 → test "x"`
function parseCoverageMap(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(MAP_ID);
    if (!m) continue;
    const names = [...m[2].matchAll(/"([^"]+)"|'([^']+)'|`([^`]+)`/g)].map((x) => x[1] || x[2] || x[3]);
    entries.push({ id: m[1], names, raw: line.trim() });
  }
  return entries;
}

function coverageCheck(opts, root) {
  const cmd = "coverage";
  requireFlags(opts, "red-sha", "slug", "epic-dir", "map");
  const mapFile = path.resolve(root, opts.flags.map);
  if (!fs.existsSync(mapFile)) return unverifiable(cmd, `no existe el COVERAGE_MAP ${posix(path.relative(root, mapFile))}`);
  const spec = loadSpec(cmd, root, opts);
  if (spec.error) return spec.error;
  const allIds = parseSpecIds(spec.text);
  if (allIds.length === 0) return unverifiable(cmd, `${spec.rel} no declara ningún AC/BR/EC`);
  const level = String(opts.flags.level || "strict").toLowerCase();
  if (!COVERAGE_LEVELS[level]) throw new UsageError(`--level must be strict or essential (got ${level}); under none there is no RED to check`);
  const ids = allIds.filter((id) => COVERAGE_LEVELS[level].test(id));
  if (ids.length === 0) return unverifiable(cmd, `${spec.rel} no declara ningún ${level === "essential" ? "AC" : "AC/BR/EC"}`);
  const red = redFiles(cmd, root, opts.flags["red-sha"]);
  if (red.error) return red.error;
  const entries = parseCoverageMap(fs.readFileSync(mapFile, "utf8"));
  if (entries.length === 0) return unverifiable(cmd, "el COVERAGE_MAP no tiene ninguna línea `- <ID> → test \"<nombre>\"`");

  const findings = [];
  const seen = new Map();
  for (const e of entries) seen.set(e.id, (seen.get(e.id) || 0) + 1);
  for (const id of ids) {
    const n = seen.get(id) || 0;
    if (n === 0) findings.push(`${id} — sin test en el COVERAGE_MAP`);
    else if (n > 1) findings.push(`${id} — aparece ${n} veces en el COVERAGE_MAP (una por ID)`);
  }
  for (const id of seen.keys()) {
    if (!allIds.includes(id)) findings.push(`${id} — está en el COVERAGE_MAP pero no en ${spec.rel}`);
    else if (!ids.includes(id) && seen.get(id) > 1) findings.push(`${id} — aparece ${seen.get(id)} veces en el COVERAGE_MAP (una por ID)`);
  }

  const contents = red.files.map((file) => readRedFile(root, red.sha, file)).join("\n");
  for (const e of entries) {
    if (e.names.length === 0) {
      findings.push(`${e.id} — la línea no cita ningún nombre de test entre comillas: ${e.raw}`);
      continue;
    }
    for (const name of e.names) {
      if (!contents.includes(name)) findings.push(`${e.id} — el test "${name}" no aparece en ningún archivo del RED ${short(red.sha)}`);
    }
  }
  return verdict(cmd, findings, `${ids.length} ID(s) cubiertos por ${entries.length} línea(s) del COVERAGE_MAP; ${entries.reduce((n, e) => n + e.names.length, 0)} test(s) presentes en el RED ${short(red.sha)}${level === "essential" ? " (nivel essential: solo los AC son obligatorios)" : ""}`, { ids, level, files: red.files });
}

function commandsCheck(opts, root) {
  const cmd = "commands";
  requireFlags(opts, "red-sha");
  const red = redFiles(cmd, root, opts.flags["red-sha"]);
  if (red.error) return red.error;
  const quality = readQualityCommands(root);
  if (!quality.exists) return unverifiable(cmd, "sin .specture/stack.yml");
  const findings = [];
  const notes = [];
  const ran = [];
  for (const key of CHECK_COMMANDS) {
    const command = quality.commands[key];
    if (!command) {
      notes.push(`${key}: SKIPPED (${quality.states[key] === "none" ? "none" : "sin definir en stack.yml quality.commands"})`);
      continue;
    }
    const result = runCommand(root, command, red.files);
    ran.push({ key, command: result.command, status: result.status });
    if (result.status === 0) {
      notes.push(`${key}: PASS (${result.command})`);
      continue;
    }
    const tail = tailOf(result, 40);
    findings.push(`${key} — exit ${result.status === null ? "n/a" : result.status}: ${result.command}${tail.length ? "\n    " + tail.join("\n    ") : ""}`);
  }
  if (ran.length === 0) return skipped(cmd, "ningún comando de quality.commands (type_check, lint, format_check) está definido", { notes, files: red.files });
  return verdict(cmd, findings, `${ran.length} comando(s) sobre ${red.files.length} archivo(s) del RED ${short(red.sha)}`, { notes, files: red.files, ran });
}

function allChecks(opts, root) {
  const results = [];
  for (const [name, fn] of [["files", filesCheck], ["coverage", coverageCheck], ["commands", commandsCheck]]) {
    const sub = { ...opts, command: name, flags: Object.fromEntries(Object.entries(opts.flags).filter(([k]) => COMMAND_FLAGS[name].includes(k))) };
    let result;
    try {
      result = fn(sub, root);
    } catch (error) {
      result = error instanceof UsageError ? unverifiable(name, error.message, { usage: true }) : unverifiable(name, `error inesperado: ${firstLine(error && error.message)}`);
    }
    results.push(result);
    if (result.status === "FAIL" || result.status === "UNVERIFIABLE") break;
  }
  return results;
}

const COMMANDS = { files: filesCheck, coverage: coverageCheck, commands: commandsCheck, all: allChecks };

function run(opts) {
  const root = path.resolve(opts.project || process.cwd());
  try {
    const out = COMMANDS[opts.command](opts, root);
    return Array.isArray(out) ? out : [out];
  } catch (error) {
    if (error instanceof UsageError) return [unverifiable(opts.command, error.message, { usage: true })];
    return [unverifiable(opts.command, `error inesperado: ${firstLine(error && error.message)}`)];
  }
}

function token(result) {
  const head = `RED-CHECK ${result.command}:`;
  if (result.status === "UNVERIFIABLE" || result.status === "SKIPPED") return `${head} ${result.status} ${result.reason}`;
  if (result.status === "FAIL") return `${head} FAIL ${result.findings.length}`;
  return `${head} PASS ${result.detail}`;
}

function render(results) {
  return results.map((r) => [token(r), ...r.findings.map((f) => `- ${f}`), ...(r.notes || []).map((n) => `- nota: ${n}`)].join("\n")).join("\n") + "\n";
}

function exitCode(results) {
  if (results.some((r) => r.status === "UNVERIFIABLE")) return 2;
  return results.some((r) => r.status === "FAIL") ? 1 : 0;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    process.stdout.write(`RED-CHECK ${argv[0] || "(none)"}: UNVERIFIABLE ${error.message}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  const results = run(opts);
  if (results.some((r) => r.usage)) process.stderr.write(`${usage()}\n`);
  process.stdout.write(opts.json ? JSON.stringify(results.map((r) => ({ token: token(r), ...r })), null, 2) + "\n" : render(results));
  process.exit(exitCode(results));
}

module.exports = { COMMAND_FLAGS, parseArgs, run, token, render, exitCode, parseCoverageMap };
