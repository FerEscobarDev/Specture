#!/usr/bin/env node
// seal-cli — the only sanctioned writer of `.specture/state/build-locked.json` (schema v3).
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" <command> [options] [--project <root>]
//
//   write        --epic <slug> --spec-sha <sha> --spec-paths a,b [--test-globs a,b] [--allowed-paths a,b]
//                [--lock-sha <sha>]
//                Coordinator, after the `docs(specs): plan …` commit. Sets the epic-level fields,
//                PRESERVES `specs[]` intact (same epic — every field, `red_sha_orig` included) and
//                `lock_sha` when not passed; a different epic's leftover specs[] is dropped. Clears
//                `lifted_spec_paths`, `supersede_paths` and `supersede_for`: a write re-seals.
//   merge-spec   --slug <task-slug> --red-sha <sha> (--test-paths a,b | --add-test-paths a,b)
//                [--reset-orig] [--epic <slug>]
//                Epic-agent, after each RED commit. Appends or updates ONE `specs[]` entry by slug
//                (its other fields kept). `red_sha_orig` is the FIRST RED and never moves unless
//                `--reset-orig`; `--test-paths` replaces, `--add-test-paths` unions without
//                duplicates. Never touches the epic-level fields. Creates the file when absent.
//   unseal-spec  --slug <task-slug>          Coordinator, full spec-correction loop: removes the
//                entry AND lifts the spec file from spec_paths (before v2.2.0 the hook kept denying
//                the planner's edit of a spec "unsealed" this way).
//   lift-spec    --slug <task-slug>          Coordinator, light supersession loop (F1-10): lifts ONLY
//                `docs/05-specs/<epic>/<slug>.spec.md` from spec_paths — the entry and its RED stay —
//                and records it in `lifted_spec_paths` until the next `write`.
//   supersede    [--slug <task-slug>] --paths a,b [--shared-with-red] | --clear
//                Epic-agent, around the tdd-test-writer dispatch (item 35 / F1-10). Refuses a path
//                sealed as the RED of any spec (its own or a sibling's) unless `--shared-with-red`.
//                Stores `supersede_paths` and `supersede_for`; `--clear` empties both.
//   release                                  Deletes the file (no-op when absent).
//   show                                     Prints the seal as JSON.
//
// Every command accepts only its own flags (plus `--project`): an unknown option is a usage
// error, never silently ignored. Read-modify-write on the whole file. Exit 1 on a corrupt file
// (except `release`), a refused supersession or an impossible lift; exit 2 on usage errors
// (unknown option or command, missing required flag). Paths are stored project-relative, posix.

const fs = require("fs");
const path = require("path");
const { STATE_FILE, readSeal, globToRegExp, pathMatchesAnyGlob } = require("./seal");
const { findProjectRoot } = require("./specture-guard");

const LIST_FLAGS = ["spec-paths", "test-globs", "allowed-paths", "test-paths", "add-test-paths", "paths"];
const BOOLEAN_FLAGS = ["clear", "shared-with-red", "reset-orig"];
const COMMAND_FLAGS = {
  write: ["epic", "spec-sha", "spec-paths", "test-globs", "allowed-paths", "lock-sha"],
  "merge-spec": ["slug", "red-sha", "test-paths", "add-test-paths", "reset-orig", "epic"],
  "unseal-spec": ["slug"],
  "lift-spec": ["slug"],
  supersede: ["slug", "paths", "shared-with-red", "clear"],
  release: [],
  show: []
};
const GLOB_CHARS = /[*?[\]{}]/;

function usage() {
  return [
    "usage: seal-cli.js <write|merge-spec|unseal-spec|lift-spec|supersede|release|show> [options] [--project <root>]",
    "  write       --epic <slug> --spec-sha <sha> --spec-paths a,b [--test-globs a,b] [--allowed-paths a,b] [--lock-sha <sha>]",
    "  merge-spec  --slug <task-slug> --red-sha <sha> (--test-paths a,b | --add-test-paths a,b) [--reset-orig] [--epic <slug>]",
    "  unseal-spec --slug <task-slug>",
    "  lift-spec   --slug <task-slug>",
    "  supersede   [--slug <task-slug>] --paths a,b [--shared-with-red] | --clear",
    "  release | show"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = { command: argv[0], flags: {}, lists: {} };
  const known = COMMAND_FLAGS[opts.command];
  if (!known) throw new Error(`unknown command ${opts.command || "(none)"}\n${usage()}`);
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}\n${usage()}`);
    const key = arg.slice(2);
    if (key !== "project" && !known.includes(key)) throw new Error(`unknown option --${key} for ${opts.command}\n${usage()}`);
    if (BOOLEAN_FLAGS.includes(key)) {
      opts.flags[key] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for --${key}\n${usage()}`);
    if (LIST_FLAGS.includes(key)) {
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

function union(...lists) {
  return [...new Set(lists.flat())];
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

function filesIn(projectRoot, dir) {
  try {
    return fs
      .readdirSync(path.join(projectRoot, dir), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => (dir === "." ? entry.name : `${dir}/${entry.name}`));
  } catch {
    return []; // a directory that does not exist seals nothing yet
  }
}

// Lifts `<dir>/<slug>.spec.md` out of `state.spec_paths` (mutates `state` only on success):
//   - an explicit entry naming `<slug>.spec.md` is removed;
//   - a glob with a literal dirname whose expansion on disk (readdirSync + globToRegExp)
//     contains the spec is replaced by that expansion minus the spec (siblings stay sealed,
//     explicitly); a glob that does not cover it is left untouched;
//   - a glob with a wildcard dirname that could cover it cannot be expanded → error.
// Returns the lifted paths ([] when no entry covers the slug), recorded in `lifted_spec_paths`.
function liftSpecPath(state, slug, projectRoot) {
  const file = `${slug}.spec.md`;
  const entries = (Array.isArray(state.spec_paths) ? state.spec_paths : []).map((e) => String(e).replace(/\\/g, "/"));
  const next = [];
  const lifted = [];
  for (const entry of entries) {
    const dir = path.posix.dirname(entry);
    if (!GLOB_CHARS.test(entry)) {
      if (path.posix.basename(entry) === file) lifted.push(entry);
      else next.push(entry);
      continue;
    }
    if (GLOB_CHARS.test(dir)) {
      if (globToRegExp(path.posix.basename(entry)).test(file)) throw new Error(`cannot expand ${entry} — seal the spec paths explicitly (write --spec-paths)`);
      next.push(entry);
      continue;
    }
    const target = dir === "." ? file : `${dir}/${file}`;
    const expanded = filesIn(projectRoot, dir).filter((p) => globToRegExp(entry).test(p)).sort();
    if (!expanded.includes(target)) {
      next.push(entry);
      continue;
    }
    next.push(...expanded.filter((p) => p !== target));
    lifted.push(target);
  }
  if (lifted.length === 0) return [];
  state.spec_paths = union(next);
  state.lifted_spec_paths = union(Array.isArray(state.lifted_spec_paths) ? state.lifted_spec_paths : [], lifted);
  return lifted;
}

// The slug of the first spec whose sealed RED covers `candidate` (either side may be a glob), or null.
function redOwner(candidate, state) {
  const specs = [
    ...(Array.isArray(state.test_paths) ? [{ slug: state.spec || "legacy", test_paths: state.test_paths }] : []),
    ...(Array.isArray(state.specs) ? state.specs : [])
  ];
  for (const spec of specs) {
    if (!spec || !Array.isArray(spec.test_paths)) continue;
    const covered =
      pathMatchesAnyGlob(candidate, spec.test_paths) ||
      spec.test_paths.some((tp) => !GLOB_CHARS.test(tp) && pathMatchesAnyGlob(tp, [candidate]));
    if (covered) return spec.slug || "(sin slug)";
  }
  return null;
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
        lock_sha: flags["lock-sha"] || (sameEpic && existing.lock_sha) || null,
        spec_paths: lists["spec-paths"],
        lifted_spec_paths: [],
        test_globs: lists["test-globs"] || (sameEpic && existing.test_globs) || [],
        allowed_paths: lists["allowed-paths"] || (sameEpic && existing.allowed_paths) || [],
        supersede_paths: [],
        supersede_for: null,
        specs
      };
      return { file: save(projectRoot, state), state };
    }
    case "merge-spec": {
      require_(opts, "slug", "red-sha");
      const replacing = lists["test-paths"] || null;
      const adding = lists["add-test-paths"] || [];
      if ((!replacing || replacing.length === 0) && adding.length === 0) {
        throw new Error(`--test-paths or --add-test-paths is required for merge-spec\n${usage()}`);
      }
      const existing = load(projectRoot) || { epic: flags.epic || null, sealed_at: now(), specs: [] };
      if (!Array.isArray(existing.specs)) existing.specs = [];
      if (!existing.sealed_at) existing.sealed_at = now();
      if (flags.epic && !existing.epic) existing.epic = flags.epic;
      const index = existing.specs.findIndex((s) => s && s.slug === flags.slug);
      const previous = index === -1 ? null : existing.specs[index];
      const redSha = flags["red-sha"];
      // RED_ORIG: the first RED of the spec. A pre-v2.2 entry without the field anchors on the
      // red_sha it already carries — the older of the two — never on the new one.
      const redOrig = flags["reset-orig"] ? redSha : (previous && (previous.red_sha_orig || previous.red_sha)) || redSha;
      const kept = previous && Array.isArray(previous.test_paths) ? previous.test_paths : [];
      const entry = {
        ...(previous || {}),
        slug: flags.slug,
        red_sha: redSha,
        red_sha_orig: redOrig,
        test_paths: union(replacing || kept, adding)
      };
      if (index === -1) existing.specs.push(entry);
      else existing.specs[index] = entry;
      return { file: save(projectRoot, existing), state: existing };
    }
    case "unseal-spec": {
      require_(opts, "slug");
      const existing = load(projectRoot);
      if (!existing) return { file: null, state: null, note: "no seal — nothing to unseal" };
      const lifted = liftSpecPath(existing, flags.slug, projectRoot);
      existing.specs = (Array.isArray(existing.specs) ? existing.specs : []).filter((s) => !(s && s.slug === flags.slug));
      const file = save(projectRoot, existing);
      return { file, state: existing, note: lifted.length > 0 ? `${file} (lifted ${lifted.join(", ")})` : `${file} (no spec_paths entry covers ${flags.slug} — nothing to lift)` };
    }
    case "lift-spec": {
      require_(opts, "slug");
      const existing = load(projectRoot);
      if (!existing) throw new Error("no seal to update — run `write` first");
      const lifted = liftSpecPath(existing, flags.slug, projectRoot);
      if (lifted.length === 0) throw new Error(`no sealed spec for slug ${flags.slug} (no spec_paths entry covers ${flags.slug}.spec.md on disk)`);
      const file = save(projectRoot, existing);
      return { file, state: existing, note: `${file} (lifted ${lifted.join(", ")})` };
    }
    case "supersede": {
      const clear = Boolean(flags.clear);
      if (clear && (lists.paths || flags.slug || flags["shared-with-red"])) {
        throw new Error(`--clear cannot be combined with --paths, --slug or --shared-with-red\n${usage()}`);
      }
      if (!clear) require_(opts, "paths");
      const existing = load(projectRoot);
      if (!existing) throw new Error("no seal to update — run `write` or `merge-spec` first");
      if (!clear && !flags["shared-with-red"]) {
        for (const candidate of lists.paths) {
          const owner = redOwner(candidate, existing);
          if (owner) {
            throw new Error(
              `refused: ${candidate} is in specs[${owner}].test_paths (RED of ${owner}) — pass --shared-with-red if RED tests were added to an existing file`
            );
          }
        }
      }
      existing.supersede_paths = clear ? [] : lists.paths;
      existing.supersede_for = clear ? null : flags.slug || null;
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

// Refusals and impossible lifts are facts about the seal (exit 1); a malformed call is usage (exit 2).
function exitCodeFor(message) {
  if (/refused|cannot expand|no sealed spec/.test(message)) return 1;
  return /unknown option|unknown command|required|unexpected|missing value|cannot be combined/.test(message) ? 2 : 1;
}

if (require.main === module) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`seal-cli: ${error.message}\n`);
    process.exit(2);
  }
  const projectRoot = opts.flags.project ? path.resolve(opts.flags.project) : findProjectRoot(process.cwd()) || process.cwd();
  try {
    const result = run(opts, projectRoot);
    if (opts.command === "show") process.stdout.write((result.state ? JSON.stringify(result.state, null, 2) : result.note) + "\n");
    else process.stdout.write(`seal-cli: ${opts.command} ok — ${result.note || result.file}\n`);
  } catch (error) {
    process.stderr.write(`seal-cli: ${error.message}\n`);
    process.exit(exitCodeFor(error.message));
  }
}

module.exports = { run, parseArgs, splitList, liftSpecPath, redOwner, exitCodeFor, COMMAND_FLAGS };
