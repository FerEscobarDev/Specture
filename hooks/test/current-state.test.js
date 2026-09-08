const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "hooks", "lib", "current-state.js");
const generator = path.join(root, "scripts", "baseline-fixture.js");
const { slugify, parseComponents, specModule, epicComponents, missingCurrent } = require("../lib/current-state");
const temporaryDirectories = [];

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-current-"));
  temporaryDirectories.push(dir);
  return dir;
}

function fixture(stage) {
  const dir = tmp();
  const result = spawnSync(process.execPath, [generator, dir, "--stage", String(stage)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return dir;
}

function run(dir, ...args) {
  return spawnSync(process.execPath, [cli, ...args, "--project", dir], { encoding: "utf8" });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("slugify and parseComponents accept the template's numbered headings and plain ones, with accents", () => {
  assert.equal(slugify("Auditoría"), "auditoria");
  assert.equal(slugify("App web"), "app-web");
  assert.equal(slugify("`Módulo` de Pagos / Cobros"), "modulo-de-pagos-cobros");

  const numbered = [
    "# Arquitectura",
    "",
    "## 1. Visión",
    "- x",
    "",
    "## 2. Componentes de Alto Nivel",
    "",
    "> no listes archivos",
    "",
    "### 2.1 Facturación",
    "- **Responsabilidad:** emitir facturas.",
    "- **Carpeta raíz:** `mi_app_api`",
    "",
    "### 2.2 App móvil",
    "- **Carpeta raíz:** n/a",
    "",
    "## 3. Patrones de Comunicación",
    "",
    "### 3.1 No es un componente",
    ""
  ].join("\n");
  const components = parseComponents(numbered);
  assert.deepEqual(components.map((c) => [c.slug, c.name, c.root]), [["facturacion", "Facturación", "mi_app_api"], ["app-movil", "App móvil", "n/a"]]);

  const plain = "## Componentes\n\n### Archivos\n- **Carpeta raíz:** `archivador_api/`\n- **Ubicación:** `archivador_api/src/archivos/`\n\n### Notas\n- **Carpeta raíz:** `archivador_api/`\n\n## Identidad\n";
  const parsed = parseComponents(plain);
  assert.deepEqual(parsed.map((c) => c.slug), ["archivos", "notas"]);
  assert.equal(parsed[0].location, "archivador_api/src/archivos/");
  assert.deepEqual(parseComponents("# Sin componentes\n"), []);
});

test("specModule reads the inline header and the migration template's bullet; epicComponents reads the ROADMAP blocks", () => {
  assert.equal(specModule("# SPEC\n\n**Epic:** Epic 1.1 Archivos   **Módulo:** Archivos (`archivador_api/src/archivos/`)\n"), "Archivos (archivador_api/src/archivos/)");
  assert.equal(specModule("# SPEC de migración\n\n- **Epic:** 2.1\n- **Módulo:** Etiquetas\n- **Gaps cubiertos:** GAP-001\n"), "Etiquetas");
  assert.equal(specModule("# SPEC sin módulo\n\n## Objetivo\n"), null);

  const roadmap = "### Milestone 1: A\n\n- [x] **Epic 1.1:** Archivos\n  - **Dependencias:** Ninguna\n  - **Componentes de arquitectura involucrados:** Archivos\n- [ ] **Epic 1.3:** Etiquetas\n  - **Componentes de arquitectura involucrados:** Etiquetas, Archivos\n\n### Milestone 2: B\n\n- [ ] **Epic 2.1:** Sin componentes\n  - **Dependencias:** Epic 1.3\n";
  assert.deepEqual(epicComponents(roadmap), { "1.1": ["Archivos"], "1.3": ["Etiquetas", "Archivos"] });
  assert.deepEqual(epicComponents(null), {});
});

test("stage 3: components, [x] specs per component in ROADMAP order, characterize hint, unknown slug", () => {
  const dir = fixture(3);
  const components = run(dir, "components");
  assert.equal(components.status, 0, components.stderr);
  const rows = components.stdout.trim().split("\n");
  assert.equal(rows[0], "SLUG | NAME | ROOT | SPECS_DONE | SPECS_OTHER | CURRENT");
  assert.deepEqual(rows.slice(1, 6), [
    "archivos | Archivos | archivador_api/ | 4 | 0 | no",
    "notas | Notas | archivador_api/ | 2 | 0 | no",
    "etiquetas | Etiquetas | archivador_api/ | 1 | 0 | no",
    "app-web | App web | archivador_app/ | 0 | 1 | no",
    "auditoria | Auditoría | archivador_api/ | 0 | 0 | no"
  ]);
  assert.match(rows[6], /^MISSING: archivos \(4 spec\[x\]\), notas \(2 spec\[x\]\), etiquetas \(1 spec\[x\]\) → \/specture:knowledge reconcile --component <slug>$/);

  const archivos = run(dir, "specs", "--component", "archivos");
  assert.equal(archivos.status, 0, archivos.stderr);
  const lines = archivos.stdout.trim().split("\n");
  assert.match(lines[0], /^COMPONENT: archivos \(Archivos\) · root: archivador_api\/ · specs \[x\]: 4 · other: 0 · current: none$/);
  assert.deepEqual(lines.slice(2), [
    "docs/05-specs/epic-1.1-archivos/01-subir-archivo.spec.md | 1.1 | done | modulo",
    "docs/05-specs/epic-1.1-archivos/02-listar-archivos.spec.md | 1.1 | done | modulo",
    "docs/05-specs/epic-1.3-etiquetas/01-asignar-etiqueta.spec.md | 1.3 | done | epic",
    "docs/05-specs/epic-1.4-cuota/01-cuota-por-tipo.spec.md | 1.4 | done | modulo"
  ], "ROADMAP order; the Etiquetas spec cites Archivos through its epic block (MATCH = epic)");

  const json = JSON.parse(run(dir, "specs", "--component", "Etiquetas", "--json").stdout);
  assert.equal(json.component.slug, "etiquetas");
  assert.deepEqual(json.specs.map((s) => [s.path, s.match]), [["docs/05-specs/epic-1.3-etiquetas/01-asignar-etiqueta.spec.md", "modulo"]]);

  const auditoria = run(dir, "specs", "--component", "auditoria");
  assert.equal(auditoria.status, 0);
  assert.match(auditoria.stdout, /^NONE: no specs cite this component — use \/specture:knowledge characterize --component auditoria \(read-only, from code under archivador_api\/src\/auditoria\/\)$/m);

  const unknown = run(dir, "specs", "--component", "archiv");
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown component "archiv" — did you mean: archivos/);

  fs.mkdirSync(path.join(dir, "docs", "05-specs", "_current"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "05-specs", "_current", "archivos.md"), "# Estado actual — Archivos\n\n> - **Confianza:** ai_reconciled\n");
  assert.deepEqual(missingCurrent(dir).map((c) => c.slug), ["notas", "etiquetas"]);
  assert.match(run(dir, "components").stdout, /^archivos \| Archivos \| archivador_api\/ \| 4 \| 0 \| yes \(ai_reconciled\)$/m);
});

test("stage 2: pending epics are hidden unless --all-states; no architecture.md → UNAVAILABLE", () => {
  const dir = fixture(2);
  const done = run(dir, "specs", "--component", "archivos");
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /NONE_DONE: 2 spec\(s\) not yet \[x\]/);
  const all = run(dir, "specs", "--component", "archivos", "--all-states");
  assert.match(all.stdout, /01-subir-archivo\.spec\.md \| 1\.1 \| pending \| modulo/);

  fs.rmSync(path.join(dir, "docs", "02-architecture", "architecture.md"));
  const unavailable = run(dir, "components");
  assert.equal(unavailable.status, 1);
  assert.match(unavailable.stdout, /^UNAVAILABLE/);

  assert.equal(run(dir, "specs").status, 2, "specs needs --component");
  assert.equal(run(dir, "bogus").status, 2);
});
