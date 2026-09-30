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

// ---------------------------------------------------------------------------
// Stage 5 — review-stage probes (docs/review-stage-baseline.md, v2.3.0)
// ---------------------------------------------------------------------------

const reviewCli = path.join(root, "hooks", "lib", "review.js");
const BATCH = ["2.1", "2.2", "2.3"];
const STAGE5_PROBES = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "PR", "B2"];

// Every epic of the generated ROADMAP: { id, state, operations, rules, deps: [X.Y], text }.
function roadmapEpics(dir) {
  const planning = require(path.join(root, "hooks", "lib", "planning.js"));
  return planning.parseRoadmapEpics(read(dir, "docs/04-roadmap/ROADMAP.md")).map((e) => {
    const deps = (e.text.match(/\*\*Dependencias:\*\*\s*(.+)$/m) || [null, ""])[1];
    return { ...e, deps: [...deps.matchAll(/Epic\s+(\d+\.\d+)/g)].map((m) => m[1]) };
  });
}

function review(dir, ...args) {
  const result = spawnSync(process.execPath, [reviewCli, ...args, "--project", dir], { encoding: "utf8" });
  return { status: result.status, first: result.stdout.split(/\r?\n/)[0], out: result.stdout + result.stderr };
}

// Every generated file (no .git), as { rel, text }.
function tree(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.name === ".git") continue;
    if (entry.isDirectory()) out.push(...tree(dir, next));
    else out.push({ rel: next, text: read(dir, next) });
  }
  return out;
}

// `path:línea` of the premise hint (`PR`) → the text of that line in the generated tree.
function citedLine(dir, stdout, verdict) {
  const m = stdout.match(new RegExp(`${verdict} (archivador_api/[\\w./-]+\\.js):(\\d+)`));
  assert.ok(m, `the PR hint cites a ${verdict} path:línea`);
  return { file: m[1], line: Number(m[2]), text: read(dir, m[1]).split("\n")[Number(m[2]) - 1] };
}

test("stage 5: Milestone 1 closed and green, the batch 2.1-2.3 pending with its fields, no review register, the doctor has no ERROR", () => {
  const dir = tmp();
  const result = generate(dir, "--stage", "5");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage 5 written/);
  for (const probe of STAGE5_PROBES) assert.match(result.stdout, new RegExp(`^\\s+${probe}\\s`, "m"), `hint for ${probe}`);

  // Milestone 1 closed (Epic 1.4 finished its GREEN), the stage-4 gate baits gone, one [/] at most: none.
  const epics = roadmapEpics(dir);
  const byId = Object.fromEntries(epics.map((e) => [e.id, e]));
  for (const id of ["1.1", "1.2", "1.3", "1.4"]) assert.equal(byId[id].state, "done", `Epic ${id}`);
  for (const id of ["1.5", "1.6", "1.7", "1.8"]) assert.ok(!byId[id], `the stage-4 bait Epic ${id} is gone`);
  assert.ok(!epics.some((e) => e.state === "in-progress"), "no epic [/]: the review stage cannot open over one");
  for (const d of ["epic-1.5-clave", "epic-1.6-dedup", "epic-1.7-tipo", "epic-1.8-texto", "epic-3.1-mis-archivos"]) {
    assert.ok(!fs.existsSync(path.join(dir, "docs", "05-specs", d)), `${d} must not exist in stage 5`);
  }

  // The batch: the first three pending epics in ROADMAP order, no specs yet, the old milestones after it.
  assert.deepEqual(epics.filter((e) => e.state === "pending").map((e) => e.id), [...BATCH, "3.1", "4.1"]);
  assert.match(byId["3.1"].text, /Migración de `tags`/);
  assert.match(byId["4.1"].text, /Página "Mis archivos"/);
  assert.match(read(dir, "docs/04-roadmap/ROADMAP.md"), /^### Milestone 2: [^\n]+\n[\s\S]*^### Milestone 3: Modernización del módulo tags$[\s\S]*^### Milestone 4: App web\n\*Objetivo:\* la página "Mis archivos" de la SPA\.$/m);
  assert.ok(fs.existsSync(path.join(dir, "docs", "05-specs", "epic-4.1-mis-archivos", "01-pagina-mis-archivos.spec.md")), "the page epic keeps its specs under its new id");
  assert.match(read(dir, "docs/05-specs/epic-4.1-mis-archivos/01-pagina-mis-archivos.spec.md"), /id: epic-4\.1-mis-archivos\/01-pagina-mis-archivos/);
  assert.deepEqual(byId["2.1"].operations, [{ id: "darDeBajaEmpleado", mode: "implementa" }]);
  assert.deepEqual(byId["2.1"].rules, ["RN-013", "RN-014"]);
  assert.deepEqual(byId["2.2"].operations, [{ id: "descargarArchivo", mode: "implementa" }]);
  assert.deepEqual(byId["2.2"].rules, ["RN-012"]);
  assert.deepEqual(byId["2.3"].operations, [{ id: "darDeBajaEmpleado", mode: "consume" }]);
  assert.deepEqual(byId["2.3"].deps, ["2.1"]);
  for (const id of BATCH) {
    assert.match(byId[id].text, /\*\*Descripción:\*\* \S/, `Epic ${id} Descripción`);
    assert.match(byId[id].text, /\*\*Componentes de arquitectura involucrados:\*\* \S/, `Epic ${id} componentes`);
    assert.match(byId[id].text, /\*\*Specs estimados:\*\* \d/, `Epic ${id} specs estimados`);
    assert.equal(byId[id].parked, null, `Epic ${id} is not parked`);
    assert.deepEqual(byId[id].diferidos, [], `Epic ${id} inherits nothing yet`);
    assert.ok(!fs.readdirSync(path.join(dir, "docs", "05-specs")).some((d) => d.startsWith(`epic-${id}-`)), `Epic ${id} has no specs yet`);
  }
  assert.ok(!fs.existsSync(path.join(dir, "docs", "05-specs", "_reviews")), "no previous review register");
  assert.doesNotMatch(read(dir, "docs/04-roadmap/ROADMAP.md"), /\*\*(Aparcado|Diferidos heredados):\*\*/);

  // The batch's sources exist: requirements, contract (both files), architecture, navigation map, ADR-002.
  const br = read(dir, "docs/01-requirements/business_requirements.md");
  for (const rn of ["RN-012", "RN-013", "RN-014"]) assert.match(br, new RegExp(`^- \\*\\*${rn}:\\*\\* \\S`, "m"), rn);
  for (const rn of ["RN-008", "RN-009", "RN-010", "RN-011"]) assert.doesNotMatch(br, new RegExp(`\\*\\*${rn}:\\*\\*`), `${rn} left with its stage-4 epic`);
  assert.match(br, /^- \*\*RRHH\*\* — /m);
  assert.match(br, /^- \*\*HU-RH-001:\*\* .*Actor: RRHH · Exposición: `UI`$/m);
  assert.match(br, /^- \*\*HU-RH-001\*\* — consumidor: app web — dar de baja a un empleado$/m);
  const yaml = read(dir, "docs/02-architecture/api-contract.openapi.yaml");
  for (const op of ["descargarArchivo", "darDeBajaEmpleado"]) {
    assert.match(yaml, new RegExp(`operationId: ${op}$`, "m"), op);
    assert.match(read(dir, "docs/02-architecture/api-contract.md"), new RegExp(`^\\| \`${op}\` \\|`, "m"), op);
  }
  assert.match(read(dir, "docs/02-architecture/api-contract.md"), /HU-ARC-004 → `descargarArchivo` · HU-RH-001 → `darDeBajaEmpleado`/);
  assert.match(read(dir, "docs/02-architecture/architecture.md"), /### Empleados\n- \*\*Responsabilidad:\*\* [^\n]*RN-013[\s\S]*?- \*\*Ubicación:\*\* `archivador_api\/src\/empleados\/`/);
  assert.match(read(dir, "docs/03-ux-ui/navigation_map.md"), /^\| `\/rrhh\/bajas` \| [^|]+ \| `rol:rrhh` \| `darDeBajaEmpleado` \| [^|]*`sin-permiso`[^|]* \|$/m);

  // Epic 1.4 closed on real code: every test green, the superseded PDF test rewritten and registered.
  const suite = runSuite(dir, "tests/all.test.js");
  assert.equal(suite.status, 0, suite.out);
  assert.equal(suite.fail, 0, suite.out);
  assert.equal(suite.pass, 20, suite.out);
  assert.match(read(dir, "archivador_api/src/archivos/limits.js"), /function maxBytesFor\(tipo\)/);
  assert.match(read(dir, "tests/archivos/limits.test.js"), /'validateSize rechaza un PDF de 25 MB \+ 1 byte'/);
  assert.doesNotMatch(read(dir, "tests/archivos/limits.test.js"), /PDF de 10 MB \+ 1 byte/);
  const sup = supersedes(dir, "epic-1.4-cuota");
  assert.deepEqual(sup.map((s) => s.test), ["validateSize rechaza un PDF de 10 MB + 1 byte"]);
  assert.match(read(dir, "docs/05-specs/epic-1.4-cuota/_planning.md"), /^- tests\/archivos\/limits\.test\.js::validateSize rechaza un PDF de 10 MB \+ 1 byte — motivo: BR-1 — spec: 01-cuota-por-tipo — commit: pendiente — loop: runtime — j9: SÍ — acción: reescribir$/m);

  // Nothing in the generated tree says what it is there for.
  for (const { rel, text } of tree(dir)) assert.doesNotMatch(text, /carnada|sonda|\bbaits?\b|\bprobes?\b/i, rel);

  const doc = spawnSync(process.execPath, [doctor, "check", "--project", dir, "--json"], { encoding: "utf8" });
  assert.equal(doc.status, 0, doc.stderr || doc.stdout);
  const findings = JSON.parse(doc.stdout).findings;
  assert.deepEqual(findings.filter((f) => f.severity === "ERROR"), [], doc.stdout);
  assert.ok(!findings.some((f) => /^review-|parked/.test(f.check)), JSON.stringify(findings));
  // Milestone 1 closed without docs/05-specs/_current/ (as in stage 3): only the deferred backfill is pending.
  assert.ok(findings.some((f) => f.check === "current-state-missing"), JSON.stringify(findings));
  for (const f of findings.filter((x) => x.check === "migrations-pending")) assert.match(f.detail, /0 mechanical, 0 assisted, 1 content: 1\.9-current-state-init$/);
});

test("stage 5: the baits (a)-(f) are in place and nothing gives them away", () => {
  const dir = tmp();
  const result = generate(dir, "--stage", "5");
  assert.equal(result.status, 0, result.stderr);
  const epics = Object.fromEntries(roadmapEpics(dir).map((e) => [e.id, e]));
  const br = read(dir, "docs/01-requirements/business_requirements.md");
  const rn = (id) => (br.match(new RegExp(`^- \\*\\*${id}:\\*\\* (.+)$`, "m")) || [null, ""])[1];

  // (a) the retention period is left open — the obvious answer (a period) opens the rehire question.
  assert.match(rn("RN-014"), /plazo de conservación/);
  assert.doesNotMatch(rn("RN-014"), /\d/, "RN-014 names no period");
  assert.doesNotMatch(br, /reincorpora|readmi|reingres/i, "no source says what a rehire recovers");

  // (b) RN-006 already answers whether HR sees the files of the employee it dismisses; 2.1 does not link it.
  assert.match(rn("RN-006"), /para cualquier otro empleado ese archivo no existe/);
  for (const id of ["RN-006", "RN-012"]) assert.ok(!epics["2.1"].rules.includes(id), `2.1 does not link ${id}`);

  // (c) 2.2 is independent inside the batch: it depends only on a closed epic and nothing in the batch depends on it.
  assert.deepEqual(epics["2.2"].deps, ["1.1"]);
  assert.ok(!BATCH.some((id) => epics[id].deps.includes("2.2")));

  // (d) ADR-002 (Accepted): the API does not authenticate nor keep passwords — and no source says how HR is recognised.
  const adr = read(dir, ".specture/decisions/002-identidad-en-el-gateway.md");
  assert.match(adr, /\*\*Status:\*\* Accepted/);
  assert.match(adr, /no autentica/);
  assert.match(adr, /contraseñas/);
  assert.doesNotMatch(br + read(dir, "docs/02-architecture/architecture.md") + adr, /grupo|cabecera de rol|X-Employee-Roles/i);

  // (e) false premise: the 2.1 block says `eliminarArchivo` soft-deletes today; the code hard-deletes the row.
  assert.match(epics["2.1"].text, /sus archivos pasan al mismo borrado lógico que hoy usa `eliminarArchivo` \(quedan ocultos y sus bytes se conservan\)/);
  assert.ok(result.stdout.includes('"sus archivos pasan al mismo borrado lógico que hoy usa `eliminarArchivo` (quedan ocultos y sus bytes se conservan)"'), "the PR hint quotes the block verbatim");
  const falsa = citedLine(dir, result.stdout, "FALSA");
  assert.equal(falsa.file, "archivador_api/src/archivos/repository.js");
  assert.match(falsa.text, /DELETE FROM archivos WHERE id = \$1/);
  for (const { rel, text } of tree(dir).filter((f) => f.rel.startsWith("archivador_api/"))) {
    assert.doesNotMatch(text, /eliminad[oa]_en|deleted_at|borrado l[oó]gico|soft/i, rel);
  }
  // ... and its control: the 2.2 block's premise (lookup by id and owner) is true.
  assert.match(epics["2.2"].text, /Como hoy `eliminarArchivo`, busca el archivo por id y dueño/);
  assert.match(citedLine(dir, result.stdout, "VERIFICADA").text, /WHERE id = \$1 AND employee_id = \$2/);

  // (f) the regulatory epic handles personal data.
  assert.match(rn("RN-014"), /datos personales/);
  assert.match(result.stdout, /REGULATORIOS: 2\.1, 2\.3/);
});

test("stage 5: the mechanics behind R0, R6 and R8 — no register, a scope unmoved by an inherited item, a draft whose provider is in the batch", () => {
  const dir = tmp();
  const result = generate(dir, "--stage", "5");
  assert.equal(result.status, 0, result.stderr);

  // R0 / R7: no register yet.
  const status = review(dir, "status");
  assert.equal(status.status, 0, status.out);
  assert.equal(status.first, "REVIEW: NONE");

  // R6: an inherited item on 2.2 leaves its SCOPE unchanged (the refresh, not a short review, meets it); an RN edit moves it.
  const before = review(dir, "scope-hash", "--epic", "2.2");
  assert.equal(before.status, 0, before.out);
  assert.match(before.first, /^SCOPE 2\.2: [0-9a-f]{12}$/);
  const roadmap = path.join(dir, "docs", "04-roadmap", "ROADMAP.md");
  const original = fs.readFileSync(roadmap, "utf8");
  const hinted = result.stdout.split(/\r?\n/).find((l) => l.includes("**Diferidos heredados:**"));
  assert.ok(hinted, "the R6 hint prints the inherited line");
  const injected = original.replace(/(\*\*Epic 2\.2:\*\*[\s\S]*?\n  - \*\*Specs estimados:\*\* 1)\n/, `$1\n${hinted.replace(/^\s+-/, "  -")}\n`);
  assert.notEqual(injected, original, "the inherited line is added to 2.2");
  fs.writeFileSync(roadmap, injected);
  const parsed = roadmapEpics(dir).find((e) => e.id === "2.2");
  assert.equal(parsed.diferidos.length, 1, "the planning parser reads the inherited item");
  assert.match(parsed.diferidos[0], /^`descargarArchivo` registra cada descarga/);
  assert.equal(review(dir, "scope-hash", "--epic", "2.2").first, before.first, "Diferidos heredados is outside the scope");
  const requirements = path.join(dir, "docs", "01-requirements", "business_requirements.md");
  fs.writeFileSync(requirements, fs.readFileSync(requirements, "utf8").replace(/^(- \*\*RN-012:\*\* .*)$/m, "$1 Cada descarga queda registrada."));
  assert.notEqual(review(dir, "scope-hash", "--epic", "2.2").first, before.first, "a linked RN is inside the scope");

  // R8: a draft of 2.3 consuming darDeBajaEmpleado of 2.1 [ ] passes only when 2.1 is in the batch.
  const epicDir = path.join(dir, "docs", "05-specs", "epic-2.3-bajas-rrhh");
  fs.mkdirSync(epicDir, { recursive: true });
  fs.writeFileSync(
    path.join(epicDir, "01-pagina-bajas.spec.md"),
    [
      "# SPEC: Página Bajas de empleados — id: epic-2.3-bajas-rrhh/01-pagina-bajas",
      "",
      "**Epic:** Epic 2.3 Página \"Bajas de empleados\"   **Módulo:** App web (`archivador_app/`)",
      "",
      "## Objetivo",
      "RRHH registra la baja de un empleado desde `/rrhh/bajas`.",
      "",
      "## Operaciones del Contrato de API (si el spec toca un boundary HTTP)",
      "- **Consume** (spec de frontend): `operationId` — `[darDeBajaEmpleado]` (vía cliente tipado generado, nunca URL escrita a mano)",
      "",
      "## Reglas de Negocio",
      "- **BR-1:** La baja lleva fecha de egreso y motivo — fuente: `RN-013` de business_requirements.md",
      "",
      "## Criterios de Aceptación (≥1 test por ID)",
      "- **AC-1:** Confirmar el formulario envía `darDeBajaEmpleado` con la fecha de egreso y el motivo.",
      ""
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(epicDir, "_planning.md"),
    ["# Planning — epic-2.3-bajas-rrhh", "", "## COVERAGE_TABLE", "- op: darDeBajaEmpleado → 01-pagina-bajas (consume)", "- br: RN-013 → 01-pagina-bajas [BR-1]", "", "## OPEN_QUESTIONS", "(ninguna)", ""].join("\n")
  );
  const draft = (...extra) => {
    const r = spawnSync(process.execPath, [setCheck, epicDir, "--roadmap", roadmap, "--epic", "2.3", "--draft", ...extra], { encoding: "utf8" });
    return { status: r.status, lines: r.stdout.split(/\r?\n/).filter(Boolean) };
  };
  const inBatch = draft("--batch", BATCH.join(","));
  assert.equal(inBatch.status, 0, inBatch.lines.join("\n"));
  assert.match(inBatch.lines[0], /^MECH_CHECK: DRAFT_PASS [0-9a-f]{12}$/);
  const alone = draft();
  assert.equal(alone.status, 1, alone.lines.join("\n"));
  assert.match(alone.lines[0], /^MECH_CHECK: DRAFT_FAIL [0-9a-f]{12}$/);
  assert.ok(alone.lines.some((l) => /^C1 BLOCKER .*darDeBajaEmpleado.*2\.1/.test(l)), alone.lines.join("\n"));
});

test("stage 5 --git: base + bookkeeping commit (the SUPERSEDE_SHA of Epic 1.4), clean tree, reproducible SHAs", () => {
  if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) return;
  const dir = tmp();
  const result = generate(dir, "--stage", "5", "--git");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(dir, "status", "--short"), "", "everything committed");
  const log = git(dir, "log", "--reverse", "--format=%H %s").split("\n").map((l) => ({ sha: l.slice(0, 40), subject: l.slice(41) }));
  assert.equal(log.length, 2);
  assert.match(log[0].subject, /^chore: fixture Archivador \(stage 5\)/);
  assert.match(log[1].subject, /^docs\(specs\): epic-1\.4-cuota/);
  assert.deepEqual(git(dir, "show", "--name-only", "--format=", log[1].sha).split("\n").filter(Boolean), ["docs/05-specs/epic-1.4-cuota/_planning.md"]);
  assert.match(read(dir, "docs/05-specs/epic-1.4-cuota/_planning.md"), new RegExp(`— commit: ${log[0].sha} — loop: runtime — j9: SÍ — acción: reescribir$`, "m"));
  assert.match(git(dir, "show", "--name-only", "--format=", log[0].sha), /^tests\/archivos\/limits\.test\.js$/m, "the base commit carries the rewritten test");
  assert.equal(review(dir, "status").first, "REVIEW: NONE");

  const again = tmp();
  assert.equal(generate(again, "--stage", "5", "--git").status, 0);
  assert.equal(git(again, "rev-parse", "HEAD"), log[1].sha, "same content and dates → same SHAs");
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
