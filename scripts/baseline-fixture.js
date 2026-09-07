#!/usr/bin/env node
// Regenerates the "Archivador" scratch project used by the Spec Planning Gate baselines
// (docs/spec-planning-baseline.md — stage 1; docs/spec-planning-baseline-stage2.md — stage 2),
// so the RED/GREEN scenarios can be re-run instead of recreated from prose.
//
//   node scripts/baseline-fixture.js <dir> [--stage 1|2] [--git] [--force]
//
//   --stage 2 (default)  the stage-2 fixture ("Archivador v2"): 5 epics, 5-operation contract,
//                        hand-written baits for scenarios 2/3/11/12, existing code in
//                        archivador_api/src/tags/ (scenario 9), migration epic + gap_analysis.md
//                        with GAP ids (scenario 10). Source tree: scripts/baseline-fixture/archivador/.
//   --stage 1            the stage-1 fixture derived from it: only Epics 1.1/1.2, 4-operation
//                        contract, RN-001 deliberately ambiguous, RN-002 as bait, no hand-written
//                        specs, no existing code (the planner authors the specs in those scenarios).
//   --git                git init + one commit, so SPEC_SHA / RED_SHA scenarios have real history.
//   --force              write into a non-empty directory.
//
// The generated project is a USER project (not the framework): `.specture/settings.yml` gets the
// installed plugin version as `schema_version`, and `.gitignore` the current three-line form.
// Exit 0 = written, 2 = usage / refused (non-empty dir without --force).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SOURCE = path.resolve(__dirname, "baseline-fixture", "archivador");
const PLUGIN_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "plugin.json"), "utf8")).version;

function usage(message) {
  if (message) process.stderr.write(`baseline-fixture: ${message}\n`);
  process.stderr.write("usage: node scripts/baseline-fixture.js <dir> [--stage 1|2] [--git] [--force]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { dir: null, stage: 2, git: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stage") args.stage = Number(argv[++i]);
    else if (a === "--git") args.git = true;
    else if (a === "--force") args.force = true;
    else if (a.startsWith("--")) usage(`unknown option ${a}`);
    else if (args.dir === null) args.dir = a;
    else usage(`unexpected argument ${a}`);
  }
  if (!args.dir) usage("missing <dir>");
  if (![1, 2].includes(args.stage)) usage("--stage must be 1 or 2");
  return args;
}

function walk(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, next));
    else out.push(next);
  }
  return out.sort();
}

// { rel: text } of the stage-2 tree, with the two substitutions every stage needs.
function stage2Files() {
  const files = {};
  for (const rel of walk(SOURCE)) {
    const target = rel === "_gitignore" ? ".gitignore" : rel;
    let text = fs.readFileSync(path.join(SOURCE, rel), "utf8").replace(/\r\n/g, "\n"); // LF regardless of autocrlf
    if (target === ".specture/settings.yml") text = text.replace("[PLUGIN_VERSION]", PLUGIN_VERSION);
    files[target] = text;
  }
  return files;
}

// Stage 1 = the stage-2 tree minus everything the stage-1 scenarios must not see, with the
// baits described in docs/spec-planning-baseline.md § Setup común.
function stage1Files(files) {
  const out = {};
  for (const [rel, text] of Object.entries(files)) {
    if (/^(docs\/05-specs\/|docs\/migration\/|docs\/03-ux-ui\/|archivador_api\/)/.test(rel)) continue;
    out[rel] = text;
  }
  const dropLine = (text, regex) => text.split("\n").filter((l) => !regex.test(l)).join("\n");

  out["docs/01-requirements/business_requirements.md"] = dropLine(
    out["docs/01-requirements/business_requirements.md"]
      .replace(", y puede etiquetar sus archivos para encontrarlos.", ".")
      .replace("sube, lista, etiqueta y elimina sus propios archivos", "sube, lista y elimina sus propios archivos")
      .replace("(título, cuerpo, nombre de etiqueta)", "(título, cuerpo)")
      .replace(/- \*\*RN-001:\*\*.*$/m, "- **RN-001:** Los usuarios pueden subir archivos."),
    /HU-ETQ-001|RN-005/
  );
  out["docs/02-architecture/api-contract.openapi.yaml"] = out["docs/02-architecture/api-contract.openapi.yaml"].replace(/  \/archivos\/\{id\}\/etiquetas:[\s\S]*?(?=  \/notas:)/, "");
  out["docs/02-architecture/api-contract.md"] = dropLine(out["docs/02-architecture/api-contract.md"], /asignarEtiqueta/).replace(" · HU-ETQ-001 → `asignarEtiqueta`", "");
  out["docs/02-architecture/architecture.md"] = out["docs/02-architecture/architecture.md"].replace(/### Etiquetas[\s\S]*?(?=## Identidad)/, "");
  const roadmap = out["docs/04-roadmap/ROADMAP.md"];
  out["docs/04-roadmap/ROADMAP.md"] = roadmap
    .slice(0, roadmap.indexOf("\n- [ ] **Epic 1.3:**"))
    .replace("subir, listar, eliminar y etiquetar archivos; crear notas.", "subir, listar y eliminar archivos; crear notas.")
    .trimEnd() + "\n";
  out[".specture/stack.yml"] = out[".specture/stack.yml"].replace(/migration:[\s\S]*?\n\n/, "");
  return out;
}

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

function gitInit(dir, stage) {
  const git = (...a) => execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...a], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q", "-b", "master");
  git("add", "-A");
  git("commit", "-q", "-m", `chore: fixture Archivador (stage ${stage})`);
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function scenarioHints(dir, stage) {
  const root = path.resolve(__dirname, "..").replace(/\\/g, "/");
  const d = path.resolve(dir).replace(/\\/g, "/");
  if (stage === 1) {
    return [
      "Stage-1 scenarios (docs/spec-planning-baseline.md): dispatch the spec-planner / coordinator on Epic 1.1 (RN-001 ambiguous) and Epic 1.2 (well-discovered); the planner authors the specs.",
      `  doctor:  node "${root}/scripts/doctor.js" check --project "${d}"`
    ];
  }
  return [
    "Stage-2 mechanical scenarios (docs/spec-planning-baseline-stage2.md):",
    `  sc.2  node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-1.1-archivos" --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic 1.1   # C1 hueco eliminarArchivo`,
    `  sc.3  node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-1.2-notas"    --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic 1.2   # C4 firmas divergentes`,
    `  sc.11 node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-3.1-mis-archivos" --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic 3.1   # C1-consume (flip Epic 1.1 to [x] to PASS)`,
    `  sc.12 hooks.enabled: true in .specture/settings.yml, Epic 1.2 → [/], then: node "${root}/hooks/lib/seal-cli.js" write --epic epic-1.2-notas --spec-sha <sha> --spec-paths "docs/05-specs/epic-1.2-notas/*.spec.md" --test-globs "tests/**/*.test.js,tests/**" --allowed-paths "$(node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-1.2-notas" --allowed-paths | paste -sd,)" --project "${d}"`,
    "        and pipe a PreToolUse payload (file_path with forward slashes) into hooks/pre-tool-use-tdd-gate.js from that directory.",
    "  sc.9 / sc.10: dispatch the spec-planner on Epic 1.3 / Epic 2.1 with the CODE_SURFACE table of archivador_api/ (haiku pre-flight).",
    `  doctor: node "${root}/scripts/doctor.js" check --project "${d}"`
  ];
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.dir);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !args.force) usage(`${dir} is not empty (use --force)`);
  const files = args.stage === 1 ? stage1Files(stage2Files()) : stage2Files();
  fs.mkdirSync(dir, { recursive: true });
  write(dir, files);
  let sha = null;
  if (args.git) sha = gitInit(dir, args.stage);
  process.stdout.write(`baseline-fixture: stage ${args.stage} written to ${dir} (${Object.keys(files).length} files, schema_version ${PLUGIN_VERSION}${sha ? `, commit ${sha}` : ""})\n`);
  for (const line of scenarioHints(dir, args.stage)) process.stdout.write(line + "\n");
}

module.exports = { stage2Files, stage1Files, write, SOURCE, PLUGIN_VERSION };
