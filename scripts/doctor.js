#!/usr/bin/env node
// Specture doctor — CLI.
//
//   node scripts/doctor.js check [--project <root>] [--json] [--brief]
//
// `check` is read-only: corpus lint + state + schema drift. Exit 0 when there is
// no ERROR, 1 when there is, 2 on usage errors. The skill `skills/doctor/SKILL.md`
// wraps this script; it can also run standalone (e.g. in a project's CI).

const fs = require("fs");
const path = require("path");
const { findProjectRoot } = require("../hooks/lib/specture-guard");
const { runCheck } = require("../hooks/lib/doctor");
const { formatBrief, formatTable } = require("../hooks/lib/doctor/report");

const PLUGIN_ROOT = path.resolve(__dirname, "..");

function usage(message) {
  if (message) process.stderr.write(`doctor: ${message}\n`);
  process.stderr.write("usage: node scripts/doctor.js check [--project <root>] [--json] [--brief]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { mode: null, project: null, json: false, brief: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--brief") args.brief = true;
    else if (a.startsWith("--")) usage(`unknown option ${a}`);
    else if (!args.mode) args.mode = a;
    else usage(`unexpected argument ${a}`);
  }
  args.mode = args.mode || "check";
  return args;
}

function pluginVersion() {
  return JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "plugin.json"), "utf8")).version;
}

function loadCatalog() {
  try {
    return require(path.join(PLUGIN_ROOT, "migrations", "index.js"));
  } catch {
    return [];
  }
}

function resolveProject(explicit) {
  const start = explicit ? path.resolve(explicit) : process.cwd();
  const root = findProjectRoot(start);
  if (!root) usage(`not a Specture project (no .specture/stack.yml found from ${start})`);
  return root;
}

const args = parseArgs(process.argv.slice(2));
if (args.mode !== "check") usage(`mode "${args.mode}" is not available yet (only: check)`);

const root = resolveProject(args.project);
const result = runCheck(root, { pluginVersion: pluginVersion(), catalog: loadCatalog() });

if (args.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
else if (args.brief) process.stdout.write(formatBrief(result) + "\n");
else process.stdout.write(formatTable(result) + "\n");

process.exit(result.exitCode);
