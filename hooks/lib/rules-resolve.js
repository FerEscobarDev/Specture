#!/usr/bin/env node
// Rules Resolution — the coordinator's pre-flight for `.specture/rules.yml` (since v1.19.0).
//
//   node hooks/lib/rules-resolve.js --project <root> --tags a,b,c [--json]
//   node hooks/lib/rules-resolve.js --project <root> --all [--json]
//
// Prints the `RULES_RESOLVED:` block to paste into a dispatch: the rules whose tags
// intersect `--tags` (the spec's module, component and backend/frontend/mobile signals —
// the same signals Docs Index Resolution derives) plus every rule tagged `all`; `--all`
// returns the whole registry (project-level validator dispatches). Agents never open the
// file — the orchestrator injects the block.
//
// Exit 0 with `RULES_RESOLVED: []` when the file does not exist (a warning names the
// migration when conventions.md §12 still declares rules), 1 when the file does not parse
// (fail loud: a broken registry must not silently drop invariants), 2 on usage errors.

const fs = require("fs");
const path = require("path");
const { findProjectRoot } = require("./specture-guard");
const { readRules, resolveRules, formatBlock, legacyRules, RULES_FILE } = require("./rules");

function usage(message) {
  if (message) process.stderr.write(`rules-resolve: ${message}\n`);
  process.stderr.write("usage: node hooks/lib/rules-resolve.js --project <root> (--tags a,b,c | --all) [--json]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { project: null, tags: [], all: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--tags") args.tags = String(argv[++i] || "").split(",").map((t) => t.trim()).filter(Boolean);
    else if (a === "--all") args.all = true;
    else if (a === "--json") args.json = true;
    else usage(`unknown argument ${a}`);
  }
  if (!args.all && args.tags.length === 0) usage("pass --tags <a,b,c> or --all");
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const start = path.resolve(args.project || ".");
  const root = findProjectRoot(start);
  if (!root) usage(`not a Specture project (no .specture/stack.yml found from ${start})`);

  const rules = readRules(root);
  if (!rules.exists) {
    let conventions = null;
    try {
      conventions = fs.readFileSync(path.join(root, ".specture", "conventions.md"), "utf8");
    } catch {
      conventions = null;
    }
    const legacy = legacyRules(conventions);
    if (legacy.length > 0) {
      // Tolerant read during a release (same as settings.js with §10): the old §12 rules are
      // injected whole (they carry no tags → `all`) so a project keeps its enforcement until
      // `1.19-rules-file` moves them; the warning names the migration.
      process.stderr.write(`⚠ Specture: \`${RULES_FILE.split(path.sep).join("/")}\` no inicializado — conventions.md §12 declara ${legacy.length} regla(s); se inyectan todas sin filtrar por tag hasta migrar: corré /specture:doctor migrate (1.19-rules-file)\n`);
      const resolved = resolveRules(legacy, args.tags, { all: true });
      if (args.json) {
        process.stdout.write(JSON.stringify({ file: ".specture/conventions.md#12", legacy: true, total: legacy.length, tags: args.tags, all: true, resolved }) + "\n");
      } else {
        process.stdout.write(formatBlock(resolved, { total: legacy.length, all: true }) + "\n");
      }
      return 0;
    }
    process.stdout.write((args.json ? JSON.stringify({ file: null, legacy: false, total: 0, tags: args.tags, all: args.all, resolved: [] }) : "RULES_RESOLVED: []") + "\n");
    return 0;
  }
  if (rules.error) {
    process.stderr.write(`rules-resolve: ${RULES_FILE.split(path.sep).join("/")} does not parse — ${rules.error.message}\n`);
    return 1;
  }
  const all = rules.parsed.rules;
  const resolved = resolveRules(all, args.tags, { all: args.all });
  if (args.json) {
    const strip = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "_line"));
    process.stdout.write(JSON.stringify({ file: RULES_FILE.split(path.sep).join("/"), total: all.length, tags: args.tags, all: args.all, resolved: resolved.map(strip) }) + "\n");
  } else {
    process.stdout.write(formatBlock(resolved, { total: all.length, tags: args.tags, all: args.all }) + "\n");
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main };
