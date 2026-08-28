#!/usr/bin/env node
// Specture doctor — CLI.
//
//   node scripts/doctor.js check   [--project <root>] [--json] [--brief]
//   node scripts/doctor.js migrate [--project <root>] [--json] [--apply] [--by <name>]
//   node scripts/doctor.js migrate --plan <id>   [--json]      plan inputs of one migration
//   node scripts/doctor.js migrate --verify <id> [--by <name>] confirm an assisted/manual migration
//   node scripts/doctor.js sync    [--project <root>] [--json]  = migrate --apply (mechanical only) + check
//
// `check` and `migrate` without `--apply` are read-only. Exit 0 = no ERROR,
// 1 = ERROR or failed migration/verify, 2 = usage. The skill
// skills/doctor/SKILL.md wraps this script; it also runs standalone (CI).
//
// `--plugin-version <X.Y.Z>` overrides the installed plugin version (tests, dry runs).

const fs = require("fs");
const path = require("path");
const { findProjectRoot } = require("../hooks/lib/specture-guard");
const { runCheck } = require("../hooks/lib/doctor");
const { runMigrate, verifyMigration, planFor } = require("../hooks/lib/doctor/migrate");
const { formatBrief, formatTable } = require("../hooks/lib/doctor/report");

const PLUGIN_ROOT = path.resolve(__dirname, "..");

function usage(message) {
  if (message) process.stderr.write(`doctor: ${message}\n`);
  process.stderr.write(
    "usage: node scripts/doctor.js check|migrate|sync [--project <root>] [--json] [--brief] [--apply] [--plan <id>] [--verify <id>] [--by <name>]\n"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = { mode: null, project: null, json: false, brief: false, apply: false, plan: null, verify: null, by: null, pluginVersion: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--brief") args.brief = true;
    else if (a === "--apply") args.apply = true;
    else if (a === "--plan") args.plan = argv[++i];
    else if (a === "--verify") args.verify = argv[++i];
    else if (a === "--by") args.by = argv[++i];
    else if (a === "--plugin-version") args.pluginVersion = argv[++i];
    else if (a.startsWith("--")) usage(`unknown option ${a}`);
    else if (!args.mode) args.mode = a;
    else usage(`unexpected argument ${a}`);
  }
  args.mode = args.mode || "check";
  if (!["check", "migrate", "sync"].includes(args.mode)) usage(`unknown mode "${args.mode}"`);
  return args;
}

function installedPluginVersion() {
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

function printMigrate(result, apply) {
  const out = [];
  out.push(`Specture doctor migrate ${apply ? "(applied)" : "(dry run — pass --apply to write)"}`);
  out.push(`schema_version: ${result.schema.before || "(none)"} → ${result.schema.after || "(none)"}`);
  const section = (title, items, render) => {
    if (items.length === 0) return;
    out.push("", title);
    for (const item of items) out.push(`  ${render(item)}`);
  };
  section("Applied (mechanical):", result.applied, (m) => `${m.id} — ${m.title}${m.notes.length ? "\n    " + m.notes.join("\n    ") : ""}`);
  section("Would apply (mechanical):", result.wouldApply, (m) => `${m.id} — ${m.title}`);
  section("Assisted — draft in Plan mode, then `migrate --verify <id>`:", result.assisted, (m) => `${m.id} — ${m.title}`);
  section("Deferred (content — owned by a skill, never automatic):", result.deferred, (m) => `${m.id} — ${m.title} → ${m.ownerSkill}`);
  section("FAILED:", result.failed, (m) => `${m.id}: ${m.reason}`);
  if (result.log.length > 0) out.push("", `Logged to .specture/migrations.log (${result.log.length} line(s)).`);
  return out.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const root = resolveProject(args.project);
const pluginVersion = args.pluginVersion || installedPluginVersion();
const catalog = loadCatalog();
const emit = (obj, text) => process.stdout.write((args.json ? JSON.stringify(obj, null, 2) : text) + "\n");

if (args.mode === "check") {
  const result = runCheck(root, { pluginVersion, catalog });
  emit(result, args.brief ? formatBrief(result) : formatTable(result));
  process.exit(result.exitCode);
}

if (args.mode === "migrate" && args.plan) {
  const plan = planFor(root, { pluginVersion, catalog, id: args.plan });
  emit(plan, JSON.stringify(plan, null, 2));
  process.exit(plan.error ? 2 : 0);
}

if (args.mode === "migrate" && args.verify) {
  const result = verifyMigration(root, { pluginVersion, catalog, id: args.verify, by: args.by || "skill" });
  emit(result, result.ok ? `doctor: ${result.id} verified${result.logged ? " and logged" : " (already logged)"}` : `doctor: ${result.reason}`);
  process.exit(result.ok ? 0 : 1);
}

if (args.mode === "migrate") {
  const result = runMigrate(root, { pluginVersion, catalog, apply: args.apply, by: args.by || "doctor" });
  emit(result, printMigrate(result, args.apply));
  process.exit(result.failed.length > 0 ? 1 : 0);
}

// sync = apply mechanical migrations, then a full check
const migrated = runMigrate(root, { pluginVersion, catalog, apply: true, by: args.by || "doctor-sync" });
const checked = runCheck(root, { pluginVersion, catalog });
emit({ migrate: migrated, check: checked }, printMigrate(migrated, true) + "\n\n" + formatTable(checked));
process.exit(migrated.failed.length > 0 || checked.exitCode !== 0 ? 1 : 0);
