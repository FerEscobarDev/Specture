// v3.0.0 — a closed milestone deletes the process artefacts of its epics by exact path and
// promotes their GUARD-n lines to rules.yml first. The team's own documentation inside docs/,
// the decisions and the milestone compliance reports are never touched.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const closeCli = path.join(root, "hooks", "lib", "milestone-close.js");
const guardsCli = path.join(root, "hooks", "lib", "guards.js");
const temporaryDirectories = [];

function write(dir, rel, text) {
  const abs = path.join(dir, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function git(dir, ...args) {
  const r = spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function cli(bin, dir, ...args) {
  const r = spawnSync(process.execPath, [bin, ...args, "--project", dir], { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CEILING_DIRECTORIES: os.tmpdir() } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, lines: r.stdout.split(/\r?\n/).filter(Boolean) };
}

const ROADMAP = [
  "# ROADMAP",
  "",
  "### Milestone 1: Núcleo",
  "",
  "- [x] **Epic 1.1:** Archivos",
  "  - **Dependencias:** Ninguna",
  "- [x] **Epic 1.2:** Notas",
  "  - **Dependencias:** Epic 1.1",
  "",
  "### Milestone 2: Reportes",
  "",
  "- [ ] **Epic 2.1:** Reportes",
  "  - **Dependencias:** Milestone 1 completo",
  ""
].join("\n");

const SPEC_11 = [
  "# SPEC: Subir archivo — id: epic-1.1-archivos/01-subir",
  "",
  "**Epic:** Epic 1.1   **Módulo:** Archivos",
  "",
  "## Criterios de Aceptación (≥1 test por ID)",
  "- **AC-1:** sube",
  "",
  "## Guards de no-regresión (nacen verdes — omitir si no aplica)",
  "- **GUARD-1:** el listado sigue paginando de a 20 → test: `tests/archivos/listar.test.js::pagina de a 20`",
  "- **GUARD-2:** ya protegido por una regla → test: `tests/archivos/listar.test.js::rechaza tamaño cero`",
  ""
].join("\n");

const RULES = [
  "schema: 1",
  "rules:",
  "  - id: R-1",
  "    tags: [archivos]",
  '    rule: "Un archivo vacío se rechaza."',
  '    verify: "`tests/archivos/listar.test.js::rechaza tamaño cero`"',
  "    severity: BLOCKER",
  ""
].join("\n");

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-close-"));
  temporaryDirectories.push(dir);
  git(dir, "init", "-q");
  git(dir, "config", "core.autocrlf", "false");
  git(dir, "config", "commit.gpgsign", "false");
  write(dir, ".specture/stack.yml", 'project:\n  name: "Demo"\n');
  write(dir, ".specture/rules.yml", RULES);
  write(dir, ".specture/decisions/001-stack.md", "# ADR-001\n\n## Status\n\nAccepted\n");
  write(dir, "docs/01-requirements/business_requirements.md", "# Req\n\n- **RN-001:** regla\n");
  write(dir, "docs/02-architecture/architecture.md", "# Arquitectura\n");
  write(dir, "docs/04-roadmap/ROADMAP.md", ROADMAP);
  write(dir, "docs/estandares/guia.md", "# Guía del equipo — vive en docs/ y no es de Specture\n");
  write(dir, "docs/05-specs/epic-1.1-archivos/01-subir.spec.md", SPEC_11);
  write(dir, "docs/05-specs/epic-1.1-archivos/_planning.md", "# Planning 1.1\n");
  write(dir, "docs/05-specs/epic-1.2-notas/01-crear.spec.md", "# SPEC: Crear nota\n\n**Epic:** Epic 1.2   **Módulo:** Notas\n\n## Criterios de Aceptación\n- **AC-1:** crea\n");
  write(dir, "docs/05-specs/epic-1.2-notas/_planning.md", "# Planning 1.2\n");
  write(dir, "docs/05-specs/epic-2.1-reportes/01-listar.spec.md", "# SPEC: Reportes\n\n**Epic:** Epic 2.1\n\n## Criterios de Aceptación\n- **AC-1:** lista\n");
  write(dir, "docs/05-specs/_reviews/R-1.md", "# registro de revisión\n");
  write(dir, "docs/07-reviews/review-epic-1.1-archivos-01-subir-2026-09-01.md", "# Code Review — 1.1\n\n**Spec:** docs/05-specs/epic-1.1-archivos/01-subir.spec.md\n\nSTATUS: APPROVED\n");
  write(dir, "docs/07-reviews/review-epic-2.1-reportes-01-listar-2026-10-01.md", "# Code Review — 2.1\n\n**Spec:** docs/05-specs/epic-2.1-reportes/01-listar.spec.md\n");
  write(dir, "docs/07-reviews/cumplimiento-milestone-1-2026-09-10.md", "# Cumplimiento M1\n\nSTATUS: PENDING\n");
  write(dir, "docs/06-debug-logs/2026-09-02-subida-lenta.md", "# Debug\n\nEpic 1.1 — la subida tardaba\n");
  write(dir, "docs/06-debug-logs/2026-10-02-reportes.md", "# Debug\n\nEpic 2.1 — reportes vacíos\n");
  write(dir, "docs/.specture-meta/coverage/01-subir.map", '- AC-1 → test "sube"\n');
  write(dir, "tests/archivos/listar.test.js", "test('pagina de a 20', () => {});\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "scaffold");
  return dir;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("dry-run lists exactly the milestone's artefacts, promotes nothing and deletes nothing", () => {
  const dir = project();
  const before = git(dir, "status", "--porcelain");
  const r = cli(closeCli, dir, "--milestone", "1");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.lines[0], /^MILESTONE-CLOSE: DRY-RUN Milestone 1: Núcleo — 2 epic\(s\), 1 guard\(s\) por promover, 5 ruta\(s\) por borrar$/, r.stdout);
  assert.ok(r.lines.includes("PROMOTE R-G-1 ← docs/05-specs/epic-1.1-archivos/01-subir.spec.md GUARD-1"), r.stdout);
  const deletes = r.lines.filter((l) => l.startsWith("DELETE ")).map((l) => l.slice(7)).sort();
  assert.deepEqual(deletes, [
    "docs/.specture-meta/coverage/01-subir.map",
    "docs/05-specs/epic-1.1-archivos",
    "docs/05-specs/epic-1.2-notas",
    "docs/06-debug-logs/2026-09-02-subida-lenta.md",
    "docs/07-reviews/review-epic-1.1-archivos-01-subir-2026-09-01.md"
  ]);
  for (const kept of ["docs/estandares/guia.md", "docs/05-specs/epic-2.1-reportes", "docs/05-specs/_reviews/R-1.md", "docs/07-reviews/cumplimiento-milestone-1-2026-09-10.md", "docs/07-reviews/review-epic-2.1-reportes-01-listar-2026-10-01.md", "docs/06-debug-logs/2026-10-02-reportes.md", ".specture/decisions/001-stack.md"]) {
    assert.ok(!deletes.includes(kept), `${kept} must never be listed`);
  }
  assert.equal(git(dir, "status", "--porcelain"), before, "dry-run writes nothing");
  assert.equal(fs.readFileSync(path.join(dir, ".specture", "rules.yml"), "utf8"), RULES, "dry-run does not promote");
});

test("--apply promotes the guard that no rule protects yet, deletes by exact path and leaves everything else", () => {
  const dir = project();
  const r = cli(closeCli, dir, "--milestone", "1", "--apply");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.lines[0], /^MILESTONE-CLOSE: APPLIED .* 1 guard\(s\) promovido\(s\), 5 ruta\(s\) borrado\(s\)$/, r.stdout);

  const rules = fs.readFileSync(path.join(dir, ".specture", "rules.yml"), "utf8");
  assert.match(rules, /- id: R-G-1\n\s+tags: \[archivos\]\n\s+rule: "Guard heredado de docs\/05-specs\/epic-1\.1-archivos\/01-subir GUARD-1: el listado sigue paginando de a 20"\n\s+verify: "`tests\/archivos\/listar\.test\.js::pagina de a 20`"\n\s+severity: IMPORTANT\n\s+source: "docs\/05-specs\/epic-1\.1-archivos\/01-subir\.spec\.md GUARD-1 — promovido al cerrar el milestone"/);
  assert.equal((rules.match(/rechaza tamaño cero/g) || []).length, 1, "GUARD-2 was already protected by R-1: not duplicated");

  for (const gone of ["docs/05-specs/epic-1.1-archivos", "docs/05-specs/epic-1.2-notas", "docs/07-reviews/review-epic-1.1-archivos-01-subir-2026-09-01.md", "docs/06-debug-logs/2026-09-02-subida-lenta.md", "docs/.specture-meta/coverage/01-subir.map"]) {
    assert.ok(!fs.existsSync(path.join(dir, gone)), `${gone} deleted`);
  }
  for (const kept of ["docs/estandares/guia.md", "docs/05-specs/epic-2.1-reportes/01-listar.spec.md", "docs/05-specs/_reviews/R-1.md", "docs/07-reviews/cumplimiento-milestone-1-2026-09-10.md", "docs/07-reviews/review-epic-2.1-reportes-01-listar-2026-10-01.md", "docs/06-debug-logs/2026-10-02-reportes.md", "docs/01-requirements/business_requirements.md", "docs/04-roadmap/ROADMAP.md", ".specture/decisions/001-stack.md", "tests/archivos/listar.test.js"]) {
    assert.ok(fs.existsSync(path.join(dir, kept)), `${kept} kept`);
  }
  // tracked files were staged for deletion, nothing committed
  const status = git(dir, "status", "--porcelain");
  assert.match(status, /^D  docs\/05-specs\/epic-1\.1-archivos\/01-subir\.spec\.md$/m);
  assert.match(status, /^\s?M \.specture\/rules\.yml$/m);
  assert.equal(git(dir, "log", "--oneline").split("\n").length, 1, "no commit");

  // the honesty check still protects the promoted guard — now through rules.yml
  const hc = spawnSync(process.execPath, [path.join(root, "hooks", "lib", "honesty-check.js"), "protected", "--epic-dir", "docs/05-specs/epic-2.1-reportes", "--project", dir], { cwd: dir, encoding: "utf8" });
  assert.match(hc.stdout, /ninguna sobre los 2 tests protegidos/, hc.stdout + hc.stderr);
});

test("refuses an open milestone and a missing one; --force overrides the first", () => {
  const dir = project();
  const open = cli(closeCli, dir, "--milestone", "2");
  assert.equal(open.status, 1);
  assert.match(open.lines[0], /^MILESTONE-CLOSE: REFUSED el Milestone 2 no está cerrado \(2\.1 sin \[x\]\)/);
  const missing = cli(closeCli, dir, "--milestone", "9");
  assert.equal(missing.status, 1);
  assert.match(missing.lines[0], /no tiene un "Milestone 9"/);
  const forced = cli(closeCli, dir, "--milestone", "2", "--force");
  assert.equal(forced.status, 0, forced.stdout);
  assert.ok(forced.lines.includes("DELETE docs/05-specs/epic-2.1-reportes"));
  assert.equal(cli(closeCli, dir).status, 2, "usage");
});

test("guards.js promote on its own: idempotent, dry-run writes nothing", () => {
  const dir = project();
  const dry = cli(guardsCli, dir, "promote", "--epic", "docs/05-specs/epic-1.1-archivos", "--dry-run");
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.lines[0], /^GUARDS promote: 1 promovido\(s\), 1 ya protegido\(s\) \(1 spec\(s\) en docs\/05-specs\/epic-1\.1-archivos\) — dry-run, nada escrito$/);
  assert.equal(fs.readFileSync(path.join(dir, ".specture", "rules.yml"), "utf8"), RULES);
  const first = cli(guardsCli, dir, "promote", "--epic", "docs/05-specs/epic-1.1-archivos");
  assert.match(first.lines[0], /^GUARDS promote: 1 promovido/);
  const again = cli(guardsCli, dir, "promote", "--epic", "docs/05-specs/epic-1.1-archivos", "--json");
  const json = JSON.parse(again.stdout);
  assert.deepEqual(json.added, []);
  assert.equal(json.skipped.length, 2);
});
