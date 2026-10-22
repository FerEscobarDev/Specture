#!/usr/bin/env node
// Rules Resolution — the coordinator's pre-flight for `.specture/rules.yml` (since v1.19.0).
//
//   node hooks/lib/rules-resolve.js --project <root> --spec <path.spec.md> [--tags extra,…] [--json]
//   node hooks/lib/rules-resolve.js --project <root> --tags a,b,c [--json]
//   node hooks/lib/rules-resolve.js --project <root> --all [--json]
//
// Prints the `RULES_RESOLVED:` block to paste into a dispatch: the rules whose tags
// intersect the spec's tags plus every rule tagged `all`; `--all` returns the whole registry
// (project-level validator dispatches). Agents never open the file — the orchestrator injects
// the block.
//
// `--spec` (v2.8.0) derives the tags from the spec itself, with the same vocabulary the doctor
// checks in `rules-tag-unreachable` (`reachableTags`): its `Módulo:` header, the component slugs
// of its epic's "Componentes de arquitectura involucrados" block in ROADMAP.md, and the layer —
// `backend` when the spec **Implementa** contract operations, `frontend` when it **Consumes**
// them. `--tags` adds signals the spec does not carry (e.g. `mobile`). Before v2.8.0 the
// coordinator derived the tags by hand and the two sides normalized them differently.
//
// Exit 0 with `RULES_RESOLVED: []` when the file does not exist (a warning names the
// migration when conventions.md §12 still declares rules), 1 when the file does not parse
// (fail loud: a broken registry must not silently drop invariants), 2 on usage errors.

const fs = require("fs");
const path = require("path");
const { findProjectRoot } = require("./specture-guard");
const { readRules, resolveRules, formatBlock, legacyRules, normalizeTag, moduleTag, LAYER_TAGS, RULES_FILE } = require("./rules");
const { loadSpecs, epicComponents } = require("./components");
const { readText } = require("./doctor/project");

function usage(message) {
  if (message) process.stderr.write(`rules-resolve: ${message}\n`);
  process.stderr.write("usage: node hooks/lib/rules-resolve.js --project <root> (--spec <path.spec.md> [--tags extra,…] | --tags a,b,c | --all) [--json]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { project: null, spec: null, tags: [], all: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--spec") args.spec = argv[++i];
    else if (a === "--tags") args.tags = String(argv[++i] || "").split(",").map((t) => t.trim()).filter(Boolean);
    else if (a === "--all") args.all = true;
    else if (a === "--json") args.json = true;
    else usage(`unknown argument ${a}`);
  }
  if (!args.all && !args.spec && args.tags.length === 0) usage("pass --spec <path>, --tags <a,b,c> or --all");
  return args;
}

// The tags a spec carries: { tags, derived: { module, components, layer } } or { error }.
function specTags(root, specPath) {
  const abs = path.resolve(root, specPath);
  if (!fs.existsSync(abs)) return { error: `no existe ${specPath}` };
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const spec = loadSpecs(root).find((s) => s.path === rel);
  if (!spec) return { error: `${rel} no está bajo docs/05-specs/<epic>/ (o es un archivo _de coordinación)` };
  const text = fs.readFileSync(abs, "utf8");
  // Layer: an explicit `**Capa:** backend|frontend|mobile` header wins; else the contract
  // section — **Implementa** = backend, **Consume** = frontend.
  const capa = text.match(/\*\*Capa\s*:\*\*\s*`?([A-Za-z]+)`?/i);
  const explicit = capa ? normalizeTag(capa[1]) : null;
  const implementa = /^\s*-\s*\*\*Implementa\b/im.test(text);
  const consume = /^\s*-\s*\*\*Consume\b/im.test(text);
  const layer = LAYER_TAGS.includes(explicit) ? explicit : implementa ? "backend" : consume ? "frontend" : null;
  // Epic: the directory name (`epic-1.1-…`), else the spec's `**Epic:**` header (`HC-IHCE.9`),
  // looked up in ROADMAP's "Componentes de arquitectura involucrados".
  let epicId = spec.epicId;
  let componentNames = spec.epicComponents;
  if (!epicId) {
    const header = text.match(/\*\*Epic\s*:\*\*\s*`?([A-Za-z0-9][A-Za-z0-9._-]*)`?/i);
    if (header) {
      epicId = header[1];
      componentNames = epicComponents(readText(root, "docs/04-roadmap/ROADMAP.md"))[epicId] || [];
    }
  }
  // ROADMAP blocks name components the way specs name modules (`Plataforma API (architecture.md §2.13)`).
  const components = componentNames.map(moduleTag).filter(Boolean);
  const tags = [...new Set([moduleTag(spec.module), ...components, layer].filter(Boolean))];
  return { tags, derived: { path: rel, epic: epicId, module: spec.module, components: componentNames, layer } };
}

function main(argv) {
  const args = parseArgs(argv);
  const start = path.resolve(args.project || ".");
  const root = findProjectRoot(start);
  if (!root) usage(`not a Specture project (no .specture/stack.yml found from ${start})`);

  let derived = null;
  if (args.spec) {
    const fromSpec = specTags(root, args.spec);
    if (fromSpec.error) usage(fromSpec.error);
    derived = fromSpec.derived;
    args.tags = [...new Set([...fromSpec.tags, ...args.tags.map(normalizeTag)])];
    if (args.tags.length === 0) process.stderr.write(`⚠ rules-resolve: ${derived.path} no declara Módulo, su epic no lista componentes y no Implementa ni Consume operaciones — solo se inyectan las reglas \`all\`; pasá --tags si corresponde\n`);
  }

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
    process.stdout.write(JSON.stringify({ file: RULES_FILE.split(path.sep).join("/"), total: all.length, tags: args.tags, all: args.all, spec: derived, resolved: resolved.map(strip) }) + "\n");
  } else {
    process.stdout.write(formatBlock(resolved, { total: all.length, tags: args.tags, all: args.all }) + "\n");
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main, specTags };
