#!/usr/bin/env node
// Components helper — the architecture components of a project and the specs that cite them.
// Shared by rules.js (reachable tags), rules-resolve.js (a spec's component tags), compliance.js
// (the components a milestone touched) and the doctor.
//
//   node hooks/lib/components.js components --project <root> [--json]
//   node hooks/lib/components.js specs --project <root> --component <slug> [--all-states] [--json]
//
// `components` lists the architecture components (architecture.md § Componentes — the template's
// numbered `### 2.1 Nombre` headings or plain `### Nombre` ones) with their slug, root folder and
// how many specs cite them. `specs` lists the specs that cite one component — by the spec header's
// `Módulo:` (inline `**Módulo:** …` or the migration template's bullet) or by the epic's
// "Componentes de arquitectura involucrados" line — in ROADMAP order, [x] only unless
// `--all-states`.
//
// Specs of a closed milestone are deleted when the milestone closes (v3.0.0), so the counts here
// describe what is on disk, not history: the truth of built behaviour is the code and its tests.
// Exit 0 = ok, 1 = no architecture.md (UNAVAILABLE), 2 = usage / unknown component.

const path = require("path");
const { findProjectRoot } = require("./specture-guard");
const { lines, walk, readText, parseRoadmap, epicIdFrom } = require("./doctor/project");

const ARCHITECTURE = "docs/02-architecture/architecture.md";
const ROADMAP = "docs/04-roadmap/ROADMAP.md";
const SPECS_DIR = "docs/05-specs";
const COMPONENTS_HEADING = /^##\s*(?:\d+\.\s*)?Componentes\b/i;
const COMPONENT_HEADING = /^###\s*(?:\d+(?:\.\d+)*\.?\s+)?(.+?)\s*$/;
const MODULE_LINE = /\*\*M[oó]dulo:\*\*\s*(.+?)(?:\s{2,}\*\*|$)/;
const EPIC_COMPONENTS = /\*\*Componentes de arquitectura involucrados:\*\*\s*(.*)$/;
const FIELD = (name) => new RegExp(`^\\s*-\\s*\\*\\*${name}:\\*\\*\\s*(.*)$`);

function slugify(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanValue(value) {
  return String(value || "").replace(/[`*]/g, "").replace(/\s+/g, " ").trim();
}

// Components declared in architecture.md: [{ name, slug, root, location, lineNo }].
function parseComponents(architectureText) {
  const all = lines(architectureText);
  const start = all.findIndex((l) => COMPONENTS_HEADING.test(l));
  if (start === -1) return [];
  const out = [];
  let current = null;
  for (let i = start + 1; i < all.length; i++) {
    const line = all[i];
    if (/^##\s/.test(line)) break;
    const heading = line.match(COMPONENT_HEADING);
    if (heading) {
      const name = cleanValue(heading[1].replace(/\[|\]/g, ""));
      current = { name, slug: slugify(name), root: null, location: null, lineNo: i + 1 };
      out.push(current);
      continue;
    }
    if (!current) continue;
    const root = line.match(FIELD("Carpeta raíz"));
    if (root) current.root = cleanValue(root[1]);
    const location = line.match(FIELD("Ubicación"));
    if (location) current.location = cleanValue(location[1]);
  }
  return out;
}

// The `Módulo:` reference of a spec header (null when absent).
function specModule(specText) {
  for (const line of lines(specText).slice(0, 40)) {
    const match = line.match(MODULE_LINE);
    if (match) return cleanValue(match[1]);
  }
  return null;
}

// "Componentes de arquitectura involucrados" of each epic block: { "<epic id>": [names] }.
function epicComponents(roadmapText) {
  const out = {};
  if (!roadmapText) return out;
  let currentId = null;
  for (const line of lines(roadmapText)) {
    const epic = line.match(/^\s*-\s*\[( |\/|x)\]\s*(.*)$/);
    if (epic) {
      currentId = epicIdFrom(epic[2]);
      continue;
    }
    if (/^#/.test(line)) {
      currentId = null;
      continue;
    }
    const field = line.match(EPIC_COMPONENTS);
    if (field && currentId) {
      // `Core y Tenancy (§2.2, ADR-007)` — the parenthesised references are not components and
      // their commas are not separators.
      out[currentId] = field[1].replace(/\([^)]*\)/g, "").split(/[,;·]/).map(cleanValue)
        .filter((name) => name && !/^(ADR|RN|GAP|MK|CL|FA)-\d/i.test(name) && !/^[§\d]/.test(name));
    }
  }
  return out;
}

function mentions(text, component) {
  const haystack = `-${slugify(text)}-`;
  return haystack.includes(`-${component.slug}-`) || haystack.includes(`-${slugify(component.name)}-`);
}

function epicIdOfDir(dir) {
  const match = dir.match(/^epic-([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)/i);
  return match ? match[1] : null;
}

// Every *.spec.md under docs/05-specs/<epic>/ with its epic id, ROADMAP state and order.
function loadSpecs(root) {
  const roadmapText = readText(root, ROADMAP);
  const roadmap = roadmapText === null ? null : parseRoadmap(roadmapText);
  const byEpic = epicComponents(roadmapText);
  const order = new Map();
  const state = new Map();
  if (roadmap) {
    roadmap.epics.forEach((e, index) => {
      if (e.id) {
        order.set(e.id, index);
        state.set(e.id, e.state);
      }
    });
  }
  const specs = [];
  for (const rel of walk(root, SPECS_DIR)) {
    if (!rel.endsWith(".spec.md")) continue;
    const parts = rel.split("/");
    if (parts.length !== 4 || parts[2].startsWith("_")) continue; // docs/05-specs/<epic>/<file>
    const epicId = epicIdOfDir(parts[2]);
    specs.push({
      path: rel,
      epicDir: parts[2],
      epicId,
      state: epicId && state.has(epicId) ? state.get(epicId) : "unknown",
      order: epicId && order.has(epicId) ? order.get(epicId) : Number.MAX_SAFE_INTEGER,
      module: specModule(readText(root, rel) || ""),
      epicComponents: epicId ? byEpic[epicId] || [] : []
    });
  }
  specs.sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
  return specs;
}

// Specs citing `component`: MATCH = modulo (spec header) | epic (ROADMAP block).
function specsFor(specs, component) {
  const out = [];
  for (const spec of specs) {
    if (spec.module && mentions(spec.module, component)) out.push({ ...spec, match: "modulo" });
    else if (spec.epicComponents.some((c) => mentions(c, component))) out.push({ ...spec, match: "epic" });
  }
  return out;
}

// Every component with the specs that cite it. null when architecture.md is absent.
function loadComponents(root) {
  const architecture = readText(root, ARCHITECTURE);
  if (architecture === null) return null;
  const components = parseComponents(architecture);
  const specs = loadSpecs(root);
  return components.map((c) => {
    const cited = specsFor(specs, c);
    return {
      ...c,
      specsDone: cited.filter((s) => s.state === "done").length,
      specsOther: cited.filter((s) => s.state !== "done").length,
      specs: cited
    };
  });
}

function findComponent(components, query) {
  const wanted = slugify(query);
  const exact = components.find((c) => c.slug === wanted || slugify(c.name) === wanted);
  if (exact) return { component: exact, candidates: [] };
  return { component: null, candidates: components.filter((c) => c.slug.includes(wanted) || wanted.includes(c.slug)) };
}

function usage(message) {
  if (message) process.stderr.write(`components: ${message}\n`);
  process.stderr.write("usage: node hooks/lib/components.js components|specs --project <root> [--component <slug>] [--all-states] [--json]\n");
  return 2;
}

function parseArgs(argv) {
  const args = { mode: null, project: null, component: null, allStates: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--component") args.component = argv[++i];
    else if (a === "--all-states") args.allStates = true;
    else if (a === "--json") args.json = true;
    else if (a.startsWith("--")) return { error: `unknown option ${a}` };
    else if (!args.mode) args.mode = a;
    else return { error: `unexpected argument ${a}` };
  }
  if (!["components", "specs"].includes(args.mode)) return { error: `mode must be components or specs` };
  if (args.mode === "specs" && !args.component) return { error: "specs needs --component <slug>" };
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) return usage(args.error);
  const start = path.resolve(args.project || ".");
  const root = findProjectRoot(start);
  if (!root) return usage(`not a Specture project (no .specture/stack.yml found from ${start})`);
  const components = loadComponents(root);
  if (!components) {
    process.stdout.write("UNAVAILABLE: docs/02-architecture/architecture.md not found — components are declared there\n");
    return 1;
  }
  const strip = (c) => ({ name: c.name, slug: c.slug, root: c.root, location: c.location, specsDone: c.specsDone, specsOther: c.specsOther });

  if (args.mode === "components") {
    if (args.json) {
      process.stdout.write(JSON.stringify({ components: components.map(strip) }) + "\n");
      return 0;
    }
    process.stdout.write("SLUG | NAME | ROOT | SPECS_DONE | SPECS_OTHER\n");
    for (const c of components) {
      process.stdout.write(`${c.slug} | ${c.name} | ${c.root || "n/a"} | ${c.specsDone} | ${c.specsOther}\n`);
    }
    return 0;
  }

  const { component, candidates } = findComponent(components, args.component);
  if (!component) {
    process.stderr.write(`components: unknown component "${args.component}"${candidates.length ? ` — did you mean: ${candidates.map((c) => c.slug).join(", ")}` : ` — components: ${components.map((c) => c.slug).join(", ")}`}\n`);
    return 2;
  }
  const rows = component.specs.filter((s) => args.allStates || s.state === "done");
  if (args.json) {
    process.stdout.write(JSON.stringify({ component: strip(component), specs: rows.map((s) => ({ path: s.path, epic: s.epicId, state: s.state, match: s.match, module: s.module })) }) + "\n");
    return 0;
  }
  process.stdout.write(`COMPONENT: ${component.slug} (${component.name}) · root: ${component.root || "n/a"} · specs [x]: ${component.specsDone} · other: ${component.specsOther}\n`);
  process.stdout.write("SPEC | EPIC | STATE | MATCH\n");
  for (const s of rows) process.stdout.write(`${s.path} | ${s.epicId || "?"} | ${s.state} | ${s.match}\n`);
  if (rows.length === 0) {
    process.stdout.write(component.specsOther > 0 && !args.allStates
      ? `NONE_DONE: ${component.specsOther} spec(s) not yet [x] (--all-states to list)\n`
      : `NONE: no spec on disk cites this component (closed milestones delete their specs — the code under ${component.location || component.root || "its root folder"} is the truth)\n`);
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { slugify, parseComponents, specModule, epicComponents, loadSpecs, specsFor, loadComponents, findComponent };
