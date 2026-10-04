const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const compliance = require("../lib/compliance");
const { parseLockSha } = require("../lib/planning");

const cli = path.resolve(__dirname, "..", "lib", "compliance.js");
const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-compliance-"));
  temporaryDirectories.push(dir);
  return dir;
}

function write(root, rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

let tick = 0;
function git(cwd, ...args) {
  tick += 1;
  const date = `2026-01-01T00:${String(Math.floor(tick / 60)).padStart(2, "0")}:${String(tick % 60).padStart(2, "0")}Z`;
  const res = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
  });
  assert.equal(res.status, 0, `git ${args.join(" ")}: ${res.stderr}`);
  return res.stdout.trim();
}

function commit(cwd, message) {
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

function roadmap(states) {
  const box = (id) => `[${states[id] || " "}]`;
  return [
    "# ROADMAP",
    "",
    "### Milestone 1: Pedidos",
    "",
    `- ${box("1.1")} **Epic 1.1:** Crear pedido`,
    "  - **Componentes de arquitectura involucrados:** Pedidos API",
    `- ${box("1.2")} **Epic 1.2:** Listar pedidos`,
    "",
    "### Milestone 2: Pagos",
    "",
    `- ${box("2.1")} **Epic 2.1:** Cobrar`,
    ""
  ].join("\n");
}

const ARCHITECTURE = "# Arquitectura\n\n## Componentes\n\n### Pedidos API\n\n- **Carpeta raíz:** `api`\n\n### Web\n\n- **Carpeta raíz:** n/a\n";

// Milestone 1 = Epic 1.1 and 1.2; Epic 2.1 (another milestone) runs between them and its
// code must stay out of Milestone 1's range. 1.1 records LOCK_SHA in _planning.md; 1.2 does not
// (its lock comes from the ROADMAP history).
function history(root) {
  const states = {};
  const flip = (id, s, message) => {
    states[id] = s;
    write(root, "docs/04-roadmap/ROADMAP.md", roadmap(states));
    return commit(root, message);
  };
  write(root, ".specture/stack.yml", "schema: 1\n");
  write(root, "docs/02-architecture/architecture.md", ARCHITECTURE);
  write(root, "docs/04-roadmap/ROADMAP.md", roadmap(states));
  write(root, "README.md", "demo\n");
  commit(root, "chore: base");

  const lock11 = flip("1.1", "/", "chore(roadmap): Epic 1.1 → [/]");
  write(root, "docs/05-specs/epic-1.1-crear/_planning.md", `# Planning\n\n## SPEC_SHA (coordinador)\n- LOCK_SHA: ${lock11} — 2026-01-01T00:00:00Z\n`);
  write(root, "api/orders/create.js", "module.exports = function create() { return 1; };\n");
  write(root, "package-lock.json", "{}\n");
  write(root, "web/logo.png", Buffer.from([0, 1, 2, 3, 0, 255]));
  commit(root, "feat(api): crear pedido");
  const close11 = flip("1.1", "x", "chore(roadmap): Epic 1.1 → [x]");

  flip("2.1", "/", "chore(roadmap): Epic 2.1 → [/]");
  write(root, "api/payments/charge.js", "module.exports = () => 'cobro';\n");
  commit(root, "feat(api): cobrar");
  flip("2.1", "x", "chore(roadmap): Epic 2.1 → [x]");

  flip("1.2", "/", "chore(roadmap): Epic 1.2 → [/]");
  write(root, "web/src/list.js", "export const list = () => [];\n");
  write(root, "api/orders/create.js", "module.exports = function create() { return 2; };\n");
  commit(root, "agrega listado");
  const close12 = flip("1.2", "x", "chore(roadmap): Epic 1.2 → [x]");
  return { lock11, close11, close12 };
}

function repo() {
  const root = tmp();
  git(root, "init", "-q");
  const shas = history(root);
  return { root, ...shas };
}

function run(root, ...args) {
  return spawnSync(process.execPath, [cli, ...args, "--project", root], { encoding: "utf8" });
}

const PART = (chunk, findings, extra = "") =>
  [`PARTE: ${chunk}`, "RESUMEN: el bloque crea y lista pedidos.", "BIEN: las funciones son cortas.", ...findings, extra].join("\n") + "\n";

const FINDING = (o) =>
  [
    "HALLAZGO",
    `SEV: ${o.sev || "IMPORTANT"}`,
    `TIPO: ${o.tipo || "refactor"}`,
    `TITULO: ${o.title || "Número sin nombre"}`,
    `UBICACION: ${o.loc || "api/orders/create.js:1"}`,
    `SIMBOLO: ${o.symbol || "api/orders/create.js::create"}`,
    "FRAGMENTO: return 2;",
    `ORIGEN: ${o.origin || "conventions.md §5"}`,
    "POR_QUE: el 2 no explica qué representa.",
    `COMENTARIO: ${o.comment || "Este 2 no dice qué significa; conviene darle un nombre que explique su propósito."}`,
    "FIN"
  ].join("\n");

test("parseLockSha takes the last LOCK_SHA line", () => {
  assert.equal(parseLockSha("## SPEC_SHA\n- LOCK_SHA: abc1234 — x\n- SPEC_SHA: def5678 — y\n- LOCK_SHA: `0123abcd` — z\n"), "0123abcd");
  assert.equal(parseLockSha("## SPEC_SHA\n- SPEC_SHA: def5678\n"), null);
});

test("milestoneEpics reads every Epic token, including tombstone lines with several ids", () => {
  const text = "### Milestone 3: Archivo ✅ archivado 2026-01-01\n\n- [x] Epic 3.1, Epic 3.2 y Epic 3.10\n\n### Milestone 4: Nuevo\n\n- [ ] **Epic 4.1:** algo\n";
  const m3 = compliance.milestoneEpics(text, "3");
  assert.deepEqual(m3.ids, ["3.1", "3.2", "3.10"]);
  assert.equal(m3.tombstone, true);
  assert.deepEqual(compliance.milestoneEpics(text, "4").ids, ["4.1"]);
  assert.equal(compliance.milestoneEpics(text, "31"), null, "Milestone 3 does not answer for 31");
});

test("range: per-epic windows keep another milestone's interleaved work out; excludes docs, lockfiles and binaries; groups by component", () => {
  const { root, lock11, close11, close12 } = repo();
  const res = run(root, "range", "--milestone", "1", "--date", "2026-02-01");
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /^COMPLIANCE range: READY milestone-1-2026-02-01 · 2 epics · 2 archivos · 2 bloques/);
  assert.match(res.stdout, /omitido: web\/logo\.png \(binario\)/);

  const data = JSON.parse(fs.readFileSync(path.join(root, ".specture/state/compliance/milestone-1-2026-02-01/range.json"), "utf8"));
  const e11 = data.epics.find((e) => e.id === "1.1");
  const e12 = data.epics.find((e) => e.id === "1.2");
  assert.equal(e11.lock, lock11);
  assert.equal(e11.lockSource, "planning");
  assert.equal(e11.close, close11);
  assert.equal(e12.lockSource, "roadmap");
  assert.equal(e12.close, close12);
  const files = data.chunks.flatMap((c) => c.files).sort();
  assert.deepEqual(files, ["api/orders/create.js", "web/src/list.js"]);
  assert.ok(!files.includes("api/payments/charge.js"), "Epic 2.1 belongs to Milestone 2");
  assert.ok(!files.includes("package-lock.json"));
  assert.deepEqual(data.chunks.map((c) => c.label), ["Pedidos API", "otros: web"]);
  const diff = fs.readFileSync(path.join(root, ".specture/state/compliance/milestone-1-2026-02-01/chunk-1.diff"), "utf8");
  assert.match(diff, /# Epic 1\.1 ·/);
  assert.match(diff, /# Epic 1\.2 ·/, "a file touched by two epics carries both windows");
  const commits = fs.readFileSync(path.join(root, ".specture/state/compliance/milestone-1-2026-02-01/commits.txt"), "utf8");
  assert.match(commits, /Epic 1\.2\t[0-9a-f]+\tagrega listado/);
  assert.doesNotMatch(commits, /cobrar/);
});

test("range is UNVERIFIABLE for an open milestone, an unknown one, a LOCK that does not exist, or outside git", () => {
  const { root } = repo();
  write(root, "docs/04-roadmap/ROADMAP.md", roadmap({ "1.1": "x", "1.2": "/" }));
  let res = run(root, "range", "--milestone", "1");
  assert.equal(res.status, 2);
  assert.match(res.stdout, /UNVERIFIABLE Milestone 1 no está cerrado: Epic 1\.2/);
  assert.match(run(root, "range", "--milestone", "9").stdout, /UNVERIFIABLE no hay "Milestone 9"/);

  write(root, "docs/04-roadmap/ROADMAP.md", roadmap({ "1.1": "x", "1.2": "x" }));
  write(root, "docs/05-specs/epic-1.1-crear/_planning.md", "## SPEC_SHA\n- LOCK_SHA: deadbeefdeadbeef — x\n");
  res = run(root, "range", "--milestone", "1");
  assert.equal(res.status, 2);
  assert.match(res.stdout, /Epic 1\.1: sin LOCK \(deadbeefdeadbeef no existe\)/);

  const plain = tmp();
  write(plain, ".specture/stack.yml", "schema: 1\n");
  write(plain, "docs/04-roadmap/ROADMAP.md", roadmap({ "1.1": "x", "1.2": "x" }));
  assert.match(run(plain, "range", "--milestone", "1").stdout, /UNVERIFIABLE no es un repositorio git/);
});

test("range works for a project nested inside a larger repository", () => {
  const outer = tmp();
  git(outer, "init", "-q");
  const root = path.join(outer, "apps", "pedidos");
  fs.mkdirSync(root, { recursive: true });
  write(outer, "otro/x.js", "x\n");
  history(root);
  const res = run(root, "range", "--milestone", "1", "--date", "2026-02-01");
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const data = JSON.parse(fs.readFileSync(path.join(root, ".specture/state/compliance/milestone-1-2026-02-01/range.json"), "utf8"));
  assert.deepEqual(data.chunks.flatMap((c) => c.files).sort(), ["api/orders/create.js", "web/src/list.js"]);
});

test("parts: grammar errors and Specture vocabulary in suggested comments fail lint", () => {
  const ok = compliance.parsePart(PART("chunk-1", [FINDING({}), FINDING({ tipo: "proceso", loc: "api/orders/create.js:1", origin: "W-3", comment: "El mensaje del commit no sigue el formato tipo(ámbito): descripción que usa el resto del repositorio." })]));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.findings[0].symbol, "api/orders/create.js::create");
  assert.equal(ok.findings[1].tipo, "proceso", "a process finding (W-*) has its own type");

  const broken = compliance.parsePart("PARTE: chunk-1\nHALLAZGO\nSEV: GRAVE\nTIPO: estilo\nFIN\nOTRA: x\n");
  assert.ok(broken.errors.some((e) => /SEV "GRAVE"/.test(e)));
  assert.ok(broken.errors.some((e) => /TIPO "estilo"/.test(e)));
  assert.ok(broken.errors.some((e) => /falta COMENTARIO/.test(e)));
  assert.ok(broken.errors.some((e) => /clave desconocida OTRA/.test(e)));

  const root = tmp();
  write(root, ".specture/review-rules.md", "## Incluye\n- .claude/agents/acme-reviewer.md § Reglas\n");
  const patterns = compliance.forbiddenPatterns(root);
  const leaky = compliance.parsePart(
    PART("chunk-1", [
      FINDING({ comment: "Incumple R-FILE-002 de conventions.md §2." }),
      FINDING({ loc: "api/x.js:2", comment: "Ver acme-reviewer.md: no se permite." })
    ], "GENERAL: Specture recomienda separar archivos.")
  );
  const problems = compliance.lintPart(leaky, patterns).join("\n");
  assert.match(problems, /cita un ID de regla \("R-FILE-002"\)/);
  assert.match(problems, /cita un archivo de configuración del framework/);
  assert.match(problems, /cita el archivo incluido \.claude\/agents\/acme-reviewer\.md/);
  assert.match(problems, /GENERAL 1: menciona el framework/);
});

test("assemble → triage → correction → status → record, end to end on the CLI", () => {
  const { root } = repo();
  assert.equal(run(root, "range", "--milestone", "1", "--date", "2026-02-01").status, 0);
  const dir = path.join(root, ".specture/state/compliance/milestone-1-2026-02-01");
  fs.writeFileSync(
    path.join(dir, "part-chunk-1.md"),
    PART("chunk-1", [
      FINDING({}),
      FINDING({ sev: "BLOCKER", tipo: "comportamiento", title: "Falta validar el total", loc: "api/orders/create.js:1", origin: "RV-1" }),
      FINDING({}) // exact duplicate (same location + origin): dropped
    ], "CONFLICTO: equipo pide 'else' explícito ⟂ conventions §5 early return — se aplicó la de Specture")
  );
  fs.writeFileSync(path.join(dir, "part-chunk-2.md"), PART("chunk-2", [FINDING({ sev: "NIT", tipo: "test", title: "Nombre de test vago", loc: "web/src/list.js:1", origin: "acme § Tests" })], "NO_EVALUADO: R-FILE-001 en legacy/** — nivel flexible"));

  assert.match(run(root, "lint", "--id", "milestone-1-2026-02-01").stdout, /^COMPLIANCE lint: PASS 2 parte\(s\)/);
  const assembled = run(root, "assemble", "--id", "milestone-1-2026-02-01");
  assert.equal(assembled.status, 0, assembled.stdout);
  assert.match(assembled.stdout, /WRITTEN docs\/07-reviews\/cumplimiento-milestone-1-2026-02-01\.md · STATUS REJECTED_MAJOR · 3 hallazgo\(s\)/);
  const rel = "docs/07-reviews/cumplimiento-milestone-1-2026-02-01.md";
  const report = fs.readFileSync(path.join(root, rel), "utf8");
  assert.match(report, /\*\*STATUS: REJECTED_MAJOR\*\*/);
  assert.match(report, /\*\*TRIAGE:\*\* PENDIENTE/);
  assert.match(report, /### F-1 \[BLOCKER\] Falta validar el total[\s\S]*### F-2 \[IMPORTANT\][\s\S]*### F-3 \[NIT\]/, "ordered by severity");
  assert.match(report, /## Reglas en conflicto\n\n- equipo pide 'else'/);
  assert.match(report, /No evaluado: R-FILE-001 en legacy/);
  assert.match(run(root, "status").stdout, /PENDING 1[\s\S]*TRIAGE PENDIENTE \(3 hallazgo/);

  const refused = run(root, "triage", "--report", rel, "--set", "F-1=corregir;F-2=corregir;F-3=corregir");
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /F-1 es de tipo comportamiento: solo se corrige un refactor/);
  assert.match(refused.stdout, /F-3 es de tipo test: solo se corrige un refactor/);
  assert.match(run(root, "triage", "--report", rel, "--set", "F-2=corregir").stdout, /sin decisión: F-1, F-3/);

  const recorded = run(root, "triage", "--report", rel, "--set", "F-1=diferir:requiere spec;F-2=corregir;F-3=no-aplica:criterio del equipo", "--date", "2026-02-02");
  assert.equal(recorded.status, 0, recorded.stdout);
  assert.match(recorded.stdout, /corregir F-2 api\/orders\/create\.js:1/);
  const triaged = fs.readFileSync(path.join(root, rel), "utf8");
  assert.match(triaged, /\*\*TRIAGE:\*\* HECHO 2026-02-02/);
  assert.match(triaged, /- F-1 — diferir — requiere spec/);
  assert.match(triaged, /## DIFERIDOS\n\n- F-1 — Falta validar el total — dueño: sin epic — requiere spec/);
  assert.match(run(root, "status").stdout, /CORRECCIÓN pendiente: F-2/);

  assert.equal(run(root, "correction", "--report", rel, "--set", "F-1=abc1234").status, 1, "F-1 was not 'corregir'");
  assert.equal(run(root, "correction", "--report", rel, "--set", "F-2=abc1234").status, 0);
  assert.match(fs.readFileSync(path.join(root, rel), "utf8"), /## CORRECCIÓN\n\n- F-2 — corregido — abc1234/);
  assert.match(run(root, "status").stdout, /^COMPLIANCE status: NONE diferidos 1/);

  assert.equal(run(root, "record", "--report", rel).status, 0);
  const metrics = fs.readFileSync(path.join(root, "docs/.specture-meta/build-metrics.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const line = metrics[metrics.length - 1];
  assert.equal(line.kind, "compliance");
  assert.equal(line.milestone, "1");
  assert.deepEqual(line.findings, { BLOCKER: 1, IMPORTANT: 1, NIT: 1 });
  assert.deepEqual(line.triage, { corregir: 1, diferir: 1, no_aplica: 1 });
  assert.equal(line.corrected, 1);

  const again = run(root, "assemble", "--id", "milestone-1-2026-02-01");
  assert.match(again.stdout, /cumplimiento-milestone-1-2026-02-01-p2\.md/, "a second pass never overwrites");
});

test("assemble fails on a missing or broken part; stub writes a BLOCKED report the doctor accepts", () => {
  const { root } = repo();
  run(root, "range", "--milestone", "1", "--date", "2026-02-01");
  const missing = run(root, "assemble", "--id", "milestone-1-2026-02-01");
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /falta part-chunk-1\.md/);

  const stubbed = run(root, "stub", "--milestone", "1", "--reason", "LOCK no verificable", "--date", "2026-02-01");
  assert.equal(stubbed.status, 0);
  const text = fs.readFileSync(path.join(root, "docs/07-reviews/cumplimiento-milestone-1-2026-02-01.md"), "utf8");
  assert.match(text, /\*\*STATUS: BLOCKED\*\*/);
  assert.match(text, /\*\*TRIAGE:\*\* NO REQUERIDO/);
  assert.match(text, /\*\*Motivo:\*\* LOCK no verificable/);
  assert.deepEqual(compliance.parseReport(text).errors, []);
});
