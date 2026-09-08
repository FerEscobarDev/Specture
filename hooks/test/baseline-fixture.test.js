const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const generator = path.join(root, "scripts", "baseline-fixture.js");
const doctor = path.join(root, "scripts", "doctor.js");
const setCheck = path.join(root, "hooks", "lib", "spec-set-check.js");
const pluginVersion = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8")).version;
const temporaryDirectories = [];

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-fixture-"));
  temporaryDirectories.push(dir);
  return dir;
}

function generate(dir, ...args) {
  return spawnSync(process.execPath, [generator, dir, ...args], { encoding: "utf8" });
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, ...rel.split("/")), "utf8");
}

function check(dir, epicDir, epic) {
  const result = spawnSync(process.execPath, [setCheck, path.join(dir, "docs", "05-specs", epicDir), "--roadmap", path.join(dir, "docs", "04-roadmap", "ROADMAP.md"), "--epic", epic], { encoding: "utf8" });
  return { status: result.status, lines: result.stdout.split(/\r?\n/).filter(Boolean) };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("stage 2: a doctor-clean project with the stage-2 baits in place", () => {
  const dir = tmp();
  const result = generate(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage 2 written/);
  for (const rel of [
    ".gitignore", ".specture/stack.yml", ".specture/settings.yml", ".specture/conventions.md", ".specture/decisions/001-archivos-en-postgres.md",
    "docs/01-requirements/business_requirements.md", "docs/02-architecture/api-contract.openapi.yaml", "docs/02-architecture/api-contract.md",
    "docs/02-architecture/architecture.md", "docs/03-ux-ui/design_system.md", "docs/03-ux-ui/navigation_map.md", "docs/04-roadmap/ROADMAP.md",
    "docs/05-specs/epic-1.1-archivos/_planning.md", "docs/05-specs/epic-1.2-notas/02-api-notas.spec.md", "docs/05-specs/epic-3.1-mis-archivos/_planning.md",
    "docs/migration/gap_analysis.md", "archivador_api/src/tags/tag-repository.js", "tests/.gitkeep"
  ]) {
    assert.ok(fs.existsSync(path.join(dir, ...rel.split("/"))), rel);
  }
  assert.ok(!fs.existsSync(path.join(dir, "_gitignore")));
  assert.match(read(dir, ".specture/settings.yml"), new RegExp(`^schema_version: "${pluginVersion.replace(/\\./g, "\\\\.")}"`, "m"));
  assert.match(read(dir, ".gitignore"), /^docs\/\.specture-meta\/\*\n!docs\/\.specture-meta\/build-metrics\.jsonl/m);
  assert.match(read(dir, "docs/04-roadmap/ROADMAP.md"), /Breaking changes in scope:\*\* GAP-001, GAP-002, GAP-003/);
  assert.match(read(dir, "docs/migration/gap_analysis.md"), /GAP-004/);

  const doc = spawnSync(process.execPath, [doctor, "check", "--project", dir, "--json"], { encoding: "utf8" });
  assert.equal(doc.status, 0, doc.stderr || doc.stdout);
  const findings = JSON.parse(doc.stdout).findings;
  assert.deepEqual(findings.filter((f) => f.severity === "ERROR"), [], JSON.stringify(findings));
  assert.ok(!findings.some((f) => f.check === "migrations-pending"), JSON.stringify(findings));
});

test("stage 2: the mechanical scenarios reproduce — C1 hole (sc.2), C4 divergent signature (sc.3), C1-consume (sc.11)", () => {
  const dir = tmp();
  assert.equal(generate(dir).status, 0);
  const sc2 = check(dir, "epic-1.1-archivos", "1.1");
  assert.equal(sc2.status, 1);
  assert.ok(sc2.lines.some((l) => /^C1 BLOCKER -: operationId `eliminarArchivo`.*hueco/.test(l)), sc2.lines.join("\n"));

  const sc3 = check(dir, "epic-1.2-notas", "1.2");
  assert.equal(sc3.status, 1);
  assert.ok(sc3.lines.some((l) => /^C4 BLOCKER 02-api-notas: `crearNota` planeada .* ≠ creada en 01-modelo-nota/.test(l)), sc3.lines.join("\n"));

  const sc11 = check(dir, "epic-3.1-mis-archivos", "3.1");
  assert.equal(sc11.status, 1);
  assert.ok(sc11.lines.some((l) => /^C1 BLOCKER -: `listarArchivos` \(consume\): el epic 1\.1 .*pending, no \[x\]/.test(l)), sc11.lines.join("\n"));
  const roadmap = path.join(dir, "docs", "04-roadmap", "ROADMAP.md");
  fs.writeFileSync(roadmap, fs.readFileSync(roadmap, "utf8").replace("- [ ] **Epic 1.1:**", "- [x] **Epic 1.1:**"));
  assert.equal(check(dir, "epic-3.1-mis-archivos", "3.1").status, 0, "backend [x] → PASS");
});

test("stage 1: only Epics 1.1/1.2, 4-operation contract, RN-001 ambiguous, no specs, no code", () => {
  const dir = tmp();
  const result = generate(dir, "--stage", "1");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage 1 written/);
  for (const rel of ["docs/05-specs", "docs/migration", "docs/03-ux-ui", "archivador_api"]) {
    assert.ok(!fs.existsSync(path.join(dir, ...rel.split("/"))), `${rel} must not exist in stage 1`);
  }
  const br = read(dir, "docs/01-requirements/business_requirements.md");
  assert.match(br, /^- \*\*RN-001:\*\* Los usuarios pueden subir archivos\.$/m);
  assert.match(br, /^- \*\*RN-002:\*\* Toda entrada de texto \(título, cuerpo\)/m, "RN-002 stays as the bait, without the tag wording");
  assert.match(br, /RN-006/, "ownership of listar/eliminar stays — the 4-operation contract keeps eliminarArchivo");
  assert.doesNotMatch(br, /RN-005|HU-ETQ-001|etiquet/i);
  assert.match(br, /\*\*Empleado\*\* — sube, lista y elimina/);
  const yaml = read(dir, "docs/02-architecture/api-contract.openapi.yaml");
  assert.doesNotMatch(yaml, /asignarEtiqueta/);
  assert.equal((yaml.match(/operationId:/g) || []).length, 4);
  assert.doesNotMatch(read(dir, "docs/02-architecture/api-contract.md"), /asignarEtiqueta/);
  const roadmap = read(dir, "docs/04-roadmap/ROADMAP.md");
  assert.match(roadmap, /\*\*Epic 1\.2:\*\*/);
  assert.doesNotMatch(roadmap, /Epic 1\.3|Milestone 2|Milestone 3/);
  assert.doesNotMatch(read(dir, "docs/02-architecture/architecture.md"), /### Etiquetas|### App web/);
  assert.doesNotMatch(read(dir, ".specture/stack.yml"), /^migration:/m);
  const doc = spawnSync(process.execPath, [doctor, "check", "--project", dir, "--json"], { encoding: "utf8" });
  assert.equal(doc.status, 0, doc.stderr || doc.stdout);
});

test("stage 3: Milestone 1 closed, Epic 1.4 supersedes the 10 MB limit, Auditoría has code and no specs; the doctor asks for the backfill", () => {
  const dir = tmp();
  const result = generate(dir, "--stage", "3");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage 3 written/);
  assert.match(result.stdout, /knowledge reconcile --component archivos/);
  for (const rel of [
    "docs/05-specs/epic-1.3-etiquetas/01-asignar-etiqueta.spec.md", "docs/05-specs/epic-1.4-cuota/01-cuota-por-tipo.spec.md",
    "docs/05-specs/epic-1.4-cuota/_planning.md", "archivador_api/src/auditoria/audit-log.js", "archivador_api/src/tags/tag-repository.js"
  ]) {
    assert.ok(fs.existsSync(path.join(dir, ...rel.split("/"))), rel);
  }
  assert.ok(!fs.existsSync(path.join(dir, "docs", "05-specs", "_current")), "no living-behaviour dir yet");
  const roadmap = read(dir, "docs/04-roadmap/ROADMAP.md");
  for (const id of ["1.1", "1.2", "1.3", "1.4"]) assert.match(roadmap, new RegExp(`^- \\[x\\] \\*\\*Epic ${id.replace(".", "\\.")}:\\*\\*`, "m"), `Epic ${id} closed`);
  assert.match(roadmap, /^- \[ \] \*\*Epic 2\.1:\*\*/m);
  assert.match(read(dir, "docs/01-requirements/business_requirements.md"), /^- \*\*RN-007:\*\* Un PDF pesa como máximo 25 MB/m);
  assert.match(read(dir, "docs/02-architecture/architecture.md"), /### Auditoría\n- \*\*Responsabilidad:\*\* registro de eventos[\s\S]*?- \*\*Ubicación:\*\* `archivador_api\/src\/auditoria\/`\n\n## Identidad/);
  assert.match(read(dir, "docs/05-specs/epic-1.4-cuota/01-cuota-por-tipo.spec.md"), /\*\*Módulo:\*\* Archivos/);

  const doc = spawnSync(process.execPath, [doctor, "check", "--project", dir, "--json"], { encoding: "utf8" });
  assert.equal(doc.status, 0, doc.stderr || doc.stdout);
  const findings = JSON.parse(doc.stdout).findings;
  assert.deepEqual(findings.filter((f) => f.severity === "ERROR"), [], JSON.stringify(findings));
  const missing = findings.find((f) => f.check === "current-state-missing");
  assert.ok(missing, JSON.stringify(findings));
  assert.match(missing.action, /knowledge reconcile --component archivos, notas, etiquetas/);
  assert.ok(findings.some((f) => f.check === "content-migration-deferred" && /1\.9-current-state-init/.test(f.file)), "the backfill migration is reported as deferred");
  assert.ok(!findings.some((f) => f.check === "migrations-pending" && /1\.19|1\.18/.test(f.detail)), JSON.stringify(findings));

  const stage2 = tmp();
  assert.equal(generate(stage2).status, 0);
  assert.ok(!fs.existsSync(path.join(stage2, "archivador_api", "src", "auditoria")), "stage 2 has no Auditoría");
  assert.doesNotMatch(read(stage2, "docs/04-roadmap/ROADMAP.md"), /Epic 1\.4/);
});

test("refuses a non-empty directory without --force; --git leaves one commit", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "keep.txt"), "x");
  const refused = generate(dir);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /not empty/);
  assert.equal(generate(dir, "--force").status, 0);
  assert.ok(fs.existsSync(path.join(dir, "keep.txt")));

  if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) return;
  const withGit = tmp();
  const result = generate(withGit, "--git");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /commit [0-9a-f]{7}/);
  assert.ok(fs.existsSync(path.join(withGit, ".git")));
  const log = spawnSync("git", ["log", "--oneline"], { cwd: withGit, encoding: "utf8" }).stdout.trim().split("\n");
  assert.equal(log.length, 1);
  assert.match(log[0], /fixture Archivador \(stage 2\)/);
  assert.equal(spawnSync("git", ["status", "--short"], { cwd: withGit, encoding: "utf8" }).stdout.trim(), "", "everything committed, gitignore honoured");
});
