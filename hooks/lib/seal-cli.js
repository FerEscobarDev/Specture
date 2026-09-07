#!/usr/bin/env node
// seal-cli — the only sanctioned writer of `.specture/state/build-locked.json` (schema v3).
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" <command> [options] [--project <root>]
//
//   write        --epic <slug> --spec-sha <sha> --spec-paths a,b [--test-globs a,b] [--allowed-paths a,b]
//                Coordinator, after the `docs(specs): plan …` commit. Sets the epic-level fields
//                and PRESERVES `specs[]` (same epic) — a different epic's leftover specs[] is dropped.
//   merge-spec   --slug <task-slug> --red-sha <sha> --test-paths a,b [--epic <slug>]
//                Epic-agent, after each RED commit. Appends or replaces ONE `specs[]` entry by
//                slug; never touches the epic-level fields. Creates the file when absent.
//   unseal-spec  --slug <task-slug>          Coordinator, spec-correction loop (removes one entry).
//   supersede    --paths a,b | --clear       Epic-agent, around the tdd-test-writer dispatch (item 35).
//   release                                  Deletes the file (no-op when absent).
//   show                                     Prints the seal as JSON.
//
// Read-modify-write on the whole file; exit 1 on a corrupt file (except `release`), exit 2 on
// usage errors. Paths are stored project-relative, posix.

const fs = require("fs");
const path = require("path");
const { STATE_FILE, readSeal } = require("./seal");
const { findProjectRoot } = require("./specture-guard");

function usage() {
  return [
    "usage: seal-cli.js <write|merge-spec|unseal-spec|supersede|release|show> [options] [--project <root>]",
    "  write       --epic <slug> --spec-sha <sha> --spec-paths a,b [--test-globs a,b] [--allowed-paths a,b]",
    "  merge-spec  --slug <task-slug> --red-sha <sha> --test-paths a,b [--epic <slug>]",
    "  unseal-spec --slug <task-slug>",
    "  supersede   --paths a,b | --clear",
    "  release | show"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = { command: argv[0], flags: {}, lists: {} };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}\n${usage()}`);
    const key = arg.slice(2);
    if (key === "clear") {
      opts.flags.clear = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for --${key}\n${usage()}`);
    if (["spec-paths", "test-globs", "allowed-paths", "test-paths", "paths"].includes(key)) {
      opts.lists[key] = (opts.lists[key] || []).concat(splitList(value));
    } else {
      opts.flags[key] = value;
    }
  }
  return opts;
}

function splitList(value) {
  return String(value)
    .split(/\s*,\s*|\n/)
    .map((v) => v.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

function require_(opts, ...keys) {
  for (const key of keys) {
    const present = key in opts.flags || (key in opts.lists && opts.lists[key].length > 0);
    if (!present) throw new Error(`--${key} is required for ${opts.command}\n${usage()}`);
  }
}

function load(projectRoot) {
  const seal = readSeal(projectRoot);
  if (seal && seal.corrupt) throw new Error(`corrupt seal: ${path.join(projectRoot, STATE_FILE)} is not a JSON object`);
  return seal ? seal.state : null;
}

function save(projectRoot, state) {
  const abs = path.join(projectRoot, STATE_FILE);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(state, null, 2) + "\n");
  return abs;
}

function now() {
  return new Date().toISOString();
}

function run(opts, projectRoot) {
  const { command, flags, lists } = opts;
  switch (command) {
    case "write": {
      require_(opts, "epic", "spec-sha", "spec-paths");
      const existing = load(projectRoot);
      const sameEpic = existing && existing.epic === flags.epic;
      const specs = sameEpic && Array.isArray(existing.specs) ? existing.specs : [];
      if (existing && !sameEpic && Array.isArray(existing.specs) && existing.specs.length > 0) {
        process.stderr.write(`seal-cli: dropping ${existing.specs.length} specs[] entries of another epic ("${existing.epic}")\n`);
      }
      const state = {
        epic: flags.epic,
        sealed_at: (sameEpic && existing.sealed_at) || now(),
        spec_sha: flags["spec-sha"],
        spec_paths: lists["spec-paths"],
        test_globs: lists["test-globs"] || (sameEpic && existing.test_globs) || [],
        allowed_paths: lists["allowed-paths"] || (sameEpic && existing.allowed_paths) || [],
        supersede_paths: (sameEpic && existing.supersede_paths) || [],
        specs
      };
      return { file: save(projectRoot, state), state };
    }
    case "merge-spec": {
      require_(opts, "slug", "red-sha", "test-paths");
      const existing = load(projectRoot) || { epic: flags.epic || null, sealed_at: now(), specs: [] };
      if (!Array.isArray(existing.specs)) existing.specs = [];
      if (!existing.sealed_at) existing.sealed_at = now();
      if (flags.epic && !existing.epic) existing.epic = flags.epic;
      const entry = { slug: flags.slug, red_sha: flags["red-sha"], test_paths: lists["test-paths"] };
      const index = existing.specs.findIndex((s) => s && s.slug === flags.slug);
      if (index === -1) existing.specs.push(entry);
      else existing.specs[index] = entry;
      return { file: save(projectRoot, existing), state: existing };
    }
    case "unseal-spec": {
      require_(opts, "slug");
      const existing = load(projectRoot);
      if (!existing) return { file: null, state: null, note: "no seal — nothing to unseal" };
      existing.specs = (Array.isArray(existing.specs) ? existing.specs : []).filter((s) => !(s && s.slug === flags.slug));
      return { file: save(projectRoot, existing), state: existing };
    }
    case "supersede": {
      if (!flags.clear) require_(opts, "paths");
      const existing = load(projectRoot);
      if (!existing) throw new Error("no seal to update — run `write` or `merge-spec` first");
      existing.supersede_paths = flags.clear ? [] : lists.paths;
      return { file: save(projectRoot, existing), state: existing };
    }
    case "release": {
      const abs = path.join(projectRoot, STATE_FILE);
      const existed = fs.existsSync(abs);
      if (existed) fs.rmSync(abs, { force: true });
      return { file: abs, state: null, note: existed ? "seal released" : "no seal — nothing to release" };
    }
    case "show": {
      const existing = load(projectRoot);
      return { file: path.join(projectRoot, STATE_FILE), state: existing, note: existing ? null : "no seal" };
    }
    default:
      throw new Error(`unknown command ${command || "(none)"}\n${usage()}`);
  }
}

if (require.main === module) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exit(2);
  }
  const projectRoot = opts.flags.project ? path.resolve(opts.flags.project) : findProjectRoot(process.cwd()) || process.cwd();
  try {
    const result = run(opts, projectRoot);
    if (opts.command === "show") process.stdout.write((result.state ? JSON.stringify(result.state, null, 2) : result.note) + "\n");
    else process.stdout.write(`seal-cli: ${opts.command} ok — ${result.note || result.file}\n`);
  } catch (error) {
    process.stderr.write(`seal-cli: ${error.message}\n`);
    process.exit(/required|unknown|unexpected|missing value/.test(error.message) ? 2 : 1);
  }
}

module.exports = { run, parseArgs, splitList };
