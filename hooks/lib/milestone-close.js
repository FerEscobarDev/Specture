#!/usr/bin/env node
// Milestone close — delete the process artefacts of a closed milestone's epics, by exact path
// (v3.0.0, "Specture independiente"). What is not a decision does not stay: the specs and
// `_planning.md` of each epic, the code reviews of each epic, the debug logs that cite it and
// the local coverage maps. The decisions stay: ADRs, `rules.yml`, `conventions.md`, the
// requirements, the contract, the ROADMAP (collapsed to a tombstone afterwards) and the milestone
// compliance reports (the triage reads them). The GUARD-n lines of the specs are promoted to
// `rules.yml` (`guards.js`) before the specs go, so `honesty-check protected` keeps them.
//
//   node hooks/lib/milestone-close.js --milestone <N> [--project <root>] [--apply] [--force] [--json]
//
// Without `--apply` it only lists what it would promote and delete. It never touches a path
// outside the four families below (a team's own documentation often lives inside docs/ — no
// glob, ever), never commits, and refuses a milestone that is not closed unless `--force`.
// Exit 0 = ok, 1 = refused, 2 = usage.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { findProjectRoot } = require("./specture-guard");
const { readText, parseRoadmap } = require("./doctor/project");
const { promoteGuards } = require("./guards");

const SPECS_DIR = "docs/05-specs";
const REVIEWS_DIR = "docs/07-reviews";
const DEBUG_DIR = "docs/06-debug-logs";
const COVERAGE_DIR = "docs/.specture-meta/coverage";
const FAMILIES = [`${SPECS_DIR}/epic-`, `${REVIEWS_DIR}/review-`, `${DEBUG_DIR}/`, `${COVERAGE_DIR}/`];

function posix(p) {
  return p.split(path.sep).join("/");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listDir(root, rel) {
  try {
    return fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return [];
  }
}

// The milestone `N` of the ROADMAP: { title, closed, epics: [{ id, state }] } or null.
function findMilestone(root, number) {
  const text = readText(root, "docs/04-roadmap/ROADMAP.md");
  if (text === null) return { error: "no existe docs/04-roadmap/ROADMAP.md" };
  const roadmap = parseRoadmap(text);
  const wanted = new RegExp(`^Milestone\\s+${escapeRegExp(String(number))}\\b`, "i");
  const milestone = roadmap.milestones.find((m) => wanted.test(m.title));
  if (!milestone) return { error: `el ROADMAP no tiene un "Milestone ${number}"` };
  return { milestone };
}

// Every artefact of the milestone's epics, grouped by epic directory.
function collect(root, milestone) {
  const epics = [];
  const specEntries = listDir(root, SPECS_DIR).filter((e) => e.isDirectory() && /^epic-/i.test(e.name));
  const reviewEntries = listDir(root, REVIEWS_DIR).filter((e) => e.isFile() && /^review-.*\.md$/i.test(e.name));
  const debugEntries = listDir(root, DEBUG_DIR).filter((e) => e.isFile() && e.name.endsWith(".md"));
  for (const epic of milestone.epics) {
    if (!epic.id) continue;
    const idRe = new RegExp(`^epic-${escapeRegExp(epic.id)}(?:-|$)`, "i");
    for (const dir of specEntries.filter((e) => idRe.test(e.name))) {
      const dirRel = `${SPECS_DIR}/${dir.name}`;
      const files = fs.readdirSync(path.join(root, dirRel));
      const tasks = files.filter((f) => f.endsWith(".spec.md")).map((f) => f.replace(/\.spec\.md$/, ""));
      const reviews = reviewEntries
        .filter((e) => e.name.toLowerCase().startsWith(`review-${dir.name.toLowerCase()}-`) || (readText(root, `${REVIEWS_DIR}/${e.name}`) || "").includes(`${dirRel}/`))
        .map((e) => `${REVIEWS_DIR}/${e.name}`);
      const epicWord = new RegExp(`\\bEpic\\s+${escapeRegExp(epic.id)}\\b|${escapeRegExp(dirRel)}`, "i");
      const debugLogs = debugEntries
        .filter((e) => epicWord.test(readText(root, `${DEBUG_DIR}/${e.name}`) || ""))
        .map((e) => `${DEBUG_DIR}/${e.name}`);
      const coverage = tasks.map((t) => `${COVERAGE_DIR}/${t}.map`).filter((rel) => fs.existsSync(path.join(root, rel)));
      epics.push({ id: epic.id, state: epic.state, dir: dirRel, tasks, reviews, debugLogs, coverage });
    }
  }
  return epics;
}

function inFamilies(rel) {
  return FAMILIES.some((f) => rel.startsWith(f));
}

function gitTracked(root, rel) {
  const r = spawnSync("git", ["ls-files", "--error-unmatch", "--", rel], { cwd: root, encoding: "utf8" });
  return r.status === 0;
}

function remove(root, rel) {
  if (!inFamilies(rel)) throw new Error(`se negó a borrar ${rel}: fuera de las rutas de Specture`);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return "absent";
  if (gitTracked(root, rel)) {
    const r = spawnSync("git", ["rm", "-r", "-q", "--", rel], { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git rm ${rel}: ${(r.stderr || "").trim()}`);
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true }); // untracked leftovers inside a tracked dir
    return "git-rm";
  }
  fs.rmSync(abs, { recursive: true, force: true });
  return "rm";
}

// { milestone, epics, promoted, deleted, refused } — `apply` false lists only.
function closeMilestone(root, number, { apply = false, force = false } = {}) {
  const found = findMilestone(root, number);
  if (found.error) return { refused: found.error };
  const { milestone } = found;
  if (!milestone.closed && !force) {
    const open = milestone.epics.filter((e) => e.state !== "done").map((e) => e.id || "?");
    return { refused: `el Milestone ${number} no está cerrado (${open.join(", ")} sin [x]) — nada se borra; --force solo si sabés lo que hacés` };
  }
  const epics = collect(root, milestone);
  const promoted = [];
  const deleted = [];
  for (const epic of epics) {
    const guards = promoteGuards(root, path.join(root, epic.dir), { dryRun: !apply });
    promoted.push(...guards.added.map((a) => ({ ...a, epic: epic.id })));
    const targets = [epic.dir, ...epic.reviews, ...epic.debugLogs, ...epic.coverage];
    for (const rel of targets) deleted.push({ epic: epic.id, path: rel, how: apply ? remove(root, rel) : "would-delete" });
  }
  return { milestone: milestone.title, epics, promoted, deleted };
}

function usage(message) {
  if (message) process.stderr.write(`milestone-close: ${message}\n`);
  process.stderr.write("usage: node hooks/lib/milestone-close.js --milestone <N> [--project <root>] [--apply] [--force] [--json]\n");
  return 2;
}

function main(argv) {
  const args = { milestone: null, project: null, apply: false, force: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--milestone") args.milestone = argv[++i];
    else if (a === "--project") args.project = argv[++i];
    else if (a === "--apply") args.apply = true;
    else if (a === "--force") args.force = true;
    else if (a === "--json") args.json = true;
    else return usage(`unknown argument ${a}`);
  }
  if (!args.milestone) return usage("--milestone <N> is required");
  const root = findProjectRoot(path.resolve(args.project || "."));
  if (!root) return usage("not a Specture project (no .specture/stack.yml)");
  let result;
  try {
    result = closeMilestone(root, args.milestone, { apply: args.apply, force: args.force });
  } catch (error) {
    process.stderr.write(`milestone-close: ${error.message}\n`);
    return 1;
  }
  if (args.json) {
    process.stdout.write(JSON.stringify({ apply: args.apply, ...result }) + "\n");
    return result.refused ? 1 : 0;
  }
  if (result.refused) {
    process.stdout.write(`MILESTONE-CLOSE: REFUSED ${result.refused}\n`);
    return 1;
  }
  const verb = args.apply ? "borrado(s)" : "por borrar";
  process.stdout.write(`MILESTONE-CLOSE: ${args.apply ? "APPLIED" : "DRY-RUN"} ${result.milestone} — ${result.epics.length} epic(s), ${result.promoted.length} guard(s) ${args.apply ? "promovido(s)" : "por promover"}, ${result.deleted.length} ruta(s) ${verb}\n`);
  for (const p of result.promoted) process.stdout.write(`PROMOTE ${p.id} ← ${p.spec} ${p.guard}\n`);
  for (const d of result.deleted) process.stdout.write(`DELETE ${d.path}${d.how === "absent" ? " (ya no existía)" : ""}\n`);
  if (args.apply) process.stdout.write("nota: nada se commiteó — el coordinador colapsa la lápida y commitea `docs: archive milestone <N>`\n");
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { closeMilestone, collect, findMilestone, FAMILIES };
