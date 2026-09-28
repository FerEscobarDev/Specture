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

// ---------------------------------------------------------------------------
// Stage 4 — gate convergence / supersession-loop probes (docs/gate-convergence-baseline.md)
// ---------------------------------------------------------------------------

const STAGE4_BAIT_DIRS = ["epic-1.1-archivos", "epic-1.4-cuota", "epic-1.5-clave", "epic-1.6-dedup", "epic-1.7-tipo", "epic-1.8-texto"];

// `node --test` inside the fixture with a TAP reporter → { status, pass, fail, failed: [names] }.
// NODE_TEST_CONTEXT is dropped: inherited from this runner, it makes the child skip every file.
function runSuite(dir, ...args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...args], { cwd: dir, encoding: "utf8", env });
  const count = (label) => Number((result.stdout.match(new RegExp(`^# ${label} (\\d+)$`, "m")) || [0, -1])[1]);
  const failed = [...result.stdout.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
  return { status: result.status, pass: count("pass"), fail: count("fail"), failed, out: result.stdout + result.stderr };
}

// `- Supersede: \`<path>::<test>\` — motivo: …` lines of every spec of one epic dir.
function supersedes(dir, epicDir) {
  const abs = path.join(dir, "docs", "05-specs", epicDir);
  return fs
    .readdirSync(abs)
    .filter((name) => name.endsWith(".spec.md"))
    .flatMap((name) => [...fs.readFileSync(path.join(abs, name), "utf8").matchAll(/^- Supersede: `([^`\s:]+)::([^`]+)` — motivo: (BR-\d+)/gm)])
    .map((m) => ({ path: m[1], test: m[2], motivo: m[3] }));
}

function git(dir, ...args) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" }).stdout.trim();
}

test("stage 4: Epic 1.1 closed with real code and node:test tests, Epic 1.4 [/] in RED, the gate and execution baits in place", () => {
  const dir = tmp();
  const result = generate(dir, "--stage", "4");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage 4 written/);
  for (const probe of ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "E1", "E2", "E3", "E4"]) assert.match(result.stdout, new RegExp(`\\b${probe}\\b`), `hint for ${probe}`);

  for (const rel of [
    "package.json", "tests/all.test.js", "tests/archivos/limits.test.js", "tests/archivos/naming.test.js", "tests/archivos/service.test.js",
    "tests/archivos/repository.test.js", "tests/archivos/quota.test.js", "archivador_api/src/archivos/limits.js", "archivador_api/src/archivos/naming.js",
    "archivador_api/src/archivos/service.js", "archivador_api/src/archivos/repository.js", "docs/05-specs/epic-1.1-archivos/02-listar-y-eliminar.spec.md",
    ...STAGE4_BAIT_DIRS.map((d) => `docs/05-specs/${d}/_planning.md`)
  ]) {
    assert.ok(fs.existsSync(path.join(dir, ...rel.split("/"))), rel);
  }
  assert.ok(!fs.existsSync(path.join(dir, "docs", "05-specs", "epic-1.1-archivos", "02-listar-archivos.spec.md")), "the stage-2 spec 02 is replaced");
  assert.match(read(dir, ".specture/stack.yml"), /^\s+testing_framework: "node:test"$/m);
  assert.match(read(dir, "package.json"), /"test": "node --test tests\/all\.test\.js"/);
  assert.doesNotMatch(read(dir, "package.json"), /dependencies/i);
  assert.match(read(dir, "archivador_api/src/archivos/limits.js"), /const MAX_FILE_MB = 10;/);
  assert.match(read(dir, ".specture/decisions/001-archivos-en-postgres.md"), /\*\*Status:\*\* Accepted[\s\S]*bytea[\s\S]*Sin filesystem ni S3/);

  // The aggregator requires every test file: one broken import takes the whole suite down.
  const all = read(dir, "tests/all.test.js");
  const testFiles = fs.readdirSync(path.join(dir, "tests", "archivos")).filter((f) => f.endsWith(".test.js"));
  assert.equal(testFiles.length, 5);
  for (const file of testFiles) assert.match(all, new RegExp(`^require\\('\\./archivos/${file.replace(/\./g, "\\.")}'\\);$`, "m"), file);

  const roadmap = read(dir, "docs/04-roadmap/ROADMAP.md");
  for (const id of ["1.1", "1.2", "1.3"]) assert.match(roadmap, new RegExp(`^- \\[x\\] \\*\\*Epic ${id.replace(".", "\\.")}:\\*\\*`, "m"));
  assert.match(roadmap, /^- \[\/\] \*\*Epic 1\.4:\*\*/m);
  for (const id of ["1.5", "1.6", "1.7", "1.8"]) assert.match(roadmap, new RegExp(`^- \\[ \\] \\*\\*Epic ${id.replace(".", "\\.")}:\\*\\*`, "m"));
  assert.equal((roadmap.match(/^- \[\/\]/gm) || []).length, 1, "exactly one epic in progress");

  // Suite at HEAD: everything green except the four RED tests of Epic 1.4.
  const head = runSuite(dir, "tests/all.test.js");
  assert.equal(head.status, 1, head.out);
  assert.equal(head.fail, 4, head.out);
  assert.equal(head.pass, 16, head.out);
  assert.deepEqual(head.failed.sort(), ["maxBytesFor da 25 MB a un PDF", "maxBytesFor deja las imágenes en 10 MB", "validateSize acepta un PDF de 20 MB", "validateSize acepta un PDF de exactamente 25 MB"].sort(), head.out);

  // Mechanical gate (4a) passes on every bait dir, and the recorded MECH_CHECK is the current hash.
  for (const epicDir of STAGE4_BAIT_DIRS) {
    const id = epicDir.match(/^epic-(\d+\.\d+)/)[1];
    const mech = check(dir, epicDir, id);
    assert.equal(mech.status, 0, `${epicDir}\n${mech.lines.join("\n")}`);
    assert.match(mech.lines[0], /^MECH_CHECK: PASS [0-9a-f]{12}$/);
    const recorded = read(dir, `docs/05-specs/${epicDir}/_planning.md`).match(/^- MECH_CHECK: PASS ([0-9a-f]{12}) — /m);
    assert.ok(recorded, `${epicDir}: MECH_CHECK line`);
    assert.equal(recorded[1], mech.lines[0].split(" ")[2], `${epicDir}: recorded MECH_CHECK = --hash-only`);
  }

  // Every Supersede names a test that exists literally in its file (C-sup v2.2) — and the baits say what they are.
  const lines = Object.fromEntries(STAGE4_BAIT_DIRS.map((d) => [d, supersedes(dir, d)]));
  for (const [epicDir, list] of Object.entries(lines)) {
    for (const sup of list) assert.ok(read(dir, sup.path).includes(`'${sup.test}'`), `${epicDir}: ${sup.path}::${sup.test}`);
  }
  assert.deepEqual(lines["epic-1.4-cuota"].map((s) => s.test), ["validateSize rechaza una imagen de 10 MB + 1 byte"], "E3: the false supersession");
  assert.deepEqual(lines["epic-1.5-clave"].map((s) => s.test), ["buildStorageName arma empleado/archivo.extension"], "G1: 1 of the 2 naming tests");
  assert.deepEqual(lines["epic-1.8-texto"].map((s) => s.test).sort(), ["subirArchivo rechaza text/plain sin tocar el repositorio", "validateType rechaza text/plain"]);
  for (const epicDir of ["epic-1.6-dedup", "epic-1.7-tipo"]) assert.deepEqual(lines[epicDir], [], epicDir);

  // PROTECTED: the rules.yml verify token and the GUARD of the closed epic point at real tests.
  const rules = read(dir, ".specture/rules.yml");
  const verify = rules.match(/- id: R-3\n[\s\S]*?verify: "test: `(tests\/[^`]+)::([^`]+)`"/);
  assert.ok(verify, "R-3 carries a verify token");
  assert.deepEqual([verify[1], verify[2]], ["tests/archivos/limits.test.js", "validateType rechaza text/plain"]);
  const guard = read(dir, "docs/05-specs/epic-1.1-archivos/02-listar-y-eliminar.spec.md").match(/^- \*\*GUARD-1:\*\* .+ → test: `(tests\/[^`]+)::([^`]+)`$/m);
  assert.ok(guard, "GUARD-1 with a test pointer");
  assert.deepEqual([guard[1], guard[2]], ["tests/archivos/service.test.js", "subirArchivo rechaza text/plain sin tocar el repositorio"]);
  for (const [file, name] of [[verify[1], verify[2]], [guard[1], guard[2]]]) assert.ok(read(dir, file).includes(`'${name}'`), `${file}::${name}`);

  // The gate baits carry their defect.
  assert.match(read(dir, "docs/05-specs/epic-1.6-dedup/01-contenido-compartido.spec.md"), /archivador_api\/var\/blobs\/<employeeId>\/<sha256>` \(disco local/);
  assert.doesNotMatch(read(dir, "docs/05-specs/epic-1.6-dedup/01-contenido-compartido.spec.md"), /ADR-001/, "the ADR-020 clone never names the ADR it breaks");
  const tipo = read(dir, "docs/05-specs/epic-1.7-tipo/01-tipo-normalizado.spec.md");
  assert.match(tipo, /\*\*AC-1:\*\* .*`tipo: application\/pdf`/);
  assert.match(tipo, /\*\*AC-3:\*\* .*devuelve `tipo: APPLICATION\/PDF`/);
  const clave = read(dir, "docs/05-specs/epic-1.5-clave/01-clave-por-mes.spec.md");
  assert.match(clave, /Modifica: `buildStorageName` en `archivador_api\/src\/archivos\/naming\.js` — se renombra `buildStorageKey`/);
  assert.match(read(dir, "tests/archivos/naming.test.js"), /^const SAMPLE = buildStorageName\(/m, "the naming tests use the export at load time");
  const br = read(dir, "docs/01-requirements/business_requirements.md");
  for (const rn of ["RN-008", "RN-009", "RN-010", "RN-011", "RN-012"]) assert.match(br, new RegExp(`^- \\*\\*${rn}:\\*\\*`, "m"), rn);
  assert.match(br, /^- \*\*HU-ARC-004\*\* — consumidor: app web — descargar un archivo propio$/m);
  assert.doesNotMatch(roadmap, /RN-012/, "G8: RN-012 has no epic");
  assert.doesNotMatch(read(dir, "docs/02-architecture/api-contract.md"), /HU-ARC-004/, "G8: the download capability has no operation");

  const doc = spawnSync(process.execPath, [doctor, "check", "--project", dir, "--json"], { encoding: "utf8" });
  assert.equal(doc.status, 0, doc.stderr || doc.stdout);
  assert.deepEqual(JSON.parse(doc.stdout).findings.filter((f) => f.severity === "ERROR"), [], doc.stdout);
});

test("stage 4: the execution baits reproduce — a rename breaks the suite at load (E1), a correct GREEN of 1.4 breaks exactly the PDF limit test (E2) and not the image one (E3)", () => {
  const dir = tmp();
  assert.equal(generate(dir, "--stage", "4").status, 0);
  const src = path.join(dir, "archivador_api", "src", "archivos");
  const limits = fs.readFileSync(path.join(src, "limits.js"), "utf8");

  // E2/E3: what a correct implementer does for BR-1 of epic-1.4-cuota (PDF 25 MB, images 10 MB).
  const green = limits
    .replace("const MAX_FILE_MB = 10;", "const MAX_FILE_MB = 10;\nconst MAX_PDF_MB = 25;\n\nfunction maxBytesFor(tipo) {\n  return (tipo === 'application/pdf' ? MAX_PDF_MB : MAX_FILE_MB) * MB;\n}")
    .replace("bytes > MAX_FILE_MB * MB", "bytes > maxBytesFor(tipo)")
    .replace("module.exports = { MB, MAX_FILE_MB, ALLOWED_TYPES, validateType, validateSize };", "module.exports = { MB, MAX_FILE_MB, ALLOWED_TYPES, maxBytesFor, validateType, validateSize };");
  assert.notEqual(green, limits, "the GREEN patch applies");
  fs.writeFileSync(path.join(src, "limits.js"), green);
  const afterGreen = runSuite(dir, "tests/all.test.js");
  assert.deepEqual(afterGreen.failed, ["validateSize rechaza un PDF de 10 MB + 1 byte"], afterGreen.out);
  assert.equal(afterGreen.pass, 19, afterGreen.out);
  fs.writeFileSync(path.join(src, "limits.js"), limits);

  // E1: the rename of Epic 1.5 in production code — the aggregated suite no longer loads.
  for (const file of ["naming.js", "service.js"]) {
    const abs = path.join(src, file);
    fs.writeFileSync(abs, fs.readFileSync(abs, "utf8").replace(/buildStorageName/g, "buildStorageKey"));
  }
  const renamed = runSuite(dir, "tests/all.test.js");
  assert.equal(renamed.status, 1);
  assert.equal(renamed.pass, 0, renamed.out);
  assert.match(renamed.out, /buildStorageName is not a function/);
});

test("stage 4 --git: base → lock → plan → verdict → RED history; the suite passes at the lock; SHAs are reproducible", () => {
  if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) return;
  const dir = tmp();
  const result = generate(dir, "--stage", "4", "--git");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(dir, "status", "--short"), "", "everything committed");
  const log = git(dir, "log", "--reverse", "--format=%H %s").split("\n").map((l) => ({ sha: l.slice(0, 40), subject: l.slice(41) }));
  assert.ok(log.length >= 4);
  assert.deepEqual(log.map((c) => c.subject.split(":")[0]), ["chore", "chore(roadmap)", "docs(specs)", "docs(specs)", "test(red)"]);
  const [base, lock, plan, verdict, red] = log.map((c) => c.sha);
  const touched = (sha) => git(dir, "show", "--name-only", "--format=", sha).split("\n").filter(Boolean).sort();
  assert.deepEqual(touched(lock), ["docs/04-roadmap/ROADMAP.md"]);
  assert.deepEqual(touched(plan), ["docs/05-specs/epic-1.4-cuota/01-cuota-por-tipo.spec.md", "docs/05-specs/epic-1.4-cuota/_planning.md"]);
  assert.deepEqual(touched(verdict), ["docs/05-specs/epic-1.4-cuota/_planning.md"]);
  assert.deepEqual(touched(red), ["tests/all.test.js", "tests/archivos/quota.test.js"]);
  assert.match(git(dir, "show", `${base}:docs/04-roadmap/ROADMAP.md`), /^- \[ \] \*\*Epic 1\.4:\*\*/m);
  assert.match(git(dir, "show", `${lock}:docs/04-roadmap/ROADMAP.md`), /^- \[\/\] \*\*Epic 1\.4:\*\*/m);
  assert.match(git(dir, "show", `${plan}:docs/05-specs/epic-1.4-cuota/_planning.md`), /commit: pendiente$/m);

  const planning = read(dir, "docs/05-specs/epic-1.4-cuota/_planning.md");
  const tree = git(dir, "rev-parse", `${plan}:docs/05-specs/epic-1.4-cuota`);
  assert.match(planning, new RegExp(`^### set — dispatch 1 — ronda 1 — 2026-09-20T10:40:00-03:00 — tree ${tree.slice(0, 12)} — head ${lock.slice(0, 12)}$`, "m"));
  assert.match(planning, new RegExp(`^- LOCK_SHA: ${lock} — `, "m"));
  assert.match(planning, new RegExp(`^- SPEC_SHA: ${plan} — `, "m"));
  assert.match(planning, /^- tests\/archivos\/limits\.test\.js::validateSize rechaza una imagen de 10 MB \+ 1 byte — motivo: BR-1 — spec: 01-cuota-por-tipo — commit: sin cambio$/m);
  for (const sha of [lock, plan, red]) assert.ok(result.stdout.includes(sha.slice(0, 12)), `hints carry ${sha.slice(0, 12)}`);

  // The base (lock) is green; the RED commit only adds lines.
  assert.equal(spawnSync("git", ["checkout", "-q", lock], { cwd: dir }).status, 0);
  const atLock = runSuite(dir);
  assert.equal(atLock.status, 0, atLock.out);
  assert.equal(atLock.fail, 0, atLock.out);
  assert.equal(runSuite(dir, "tests/all.test.js").pass, 16);
  assert.doesNotMatch(git(dir, "show", "--format=", red), /^-(?!--)/m, "RED only adds lines");

  const again = tmp();
  assert.equal(generate(again, "--stage", "4", "--git").status, 0);
  assert.equal(git(again, "rev-parse", "HEAD"), red, "same content and dates → same SHAs");
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
