const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "hooks", "lib", "rules-resolve.js");
const temporaryDirectories = [];

const STACK = 'project:\n  name: "Demo"\n  slug: "demo"\n';
const RULES = [
  "schema: 1",
  "rules:",
  "  - id: R-1",
  "    tags: [dto, domain]",
  '    rule: "Los DTOs son inmutables"',
  "    severity: BLOCKER",
  '    source: "ADR-004"',
  "  - id: R-2",
  "    tags: [all]",
  '    rule: "Métodos de consulta = sustantivo"',
  "    severity: IMPORTANT",
  "  - id: R-3",
  "    tags: [frontend, a11y]",
  '    rule: "Todo control interactivo tiene nombre accesible"',
  "    severity: BLOCKER",
  ""
].join("\n");

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-rules-"));
  temporaryDirectories.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function run(dir, ...args) {
  return spawnSync(process.execPath, [cli, "--project", dir, ...args], { encoding: "utf8" });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("prints the RULES_RESOLVED block for the tags that intersect, plus `all` rules", () => {
  const dir = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": RULES });
  const result = run(dir, "--tags", "backend,dto");
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines[0], "RULES_RESOLVED: 2 of 3 (tags: backend, dto)");
  assert.match(lines[1], /^- R-1 \[dto, domain\] BLOCKER — Los DTOs son inmutables · fuente: ADR-004$/);
  assert.match(lines[2], /^- R-2 \[all\] IMPORTANT — Métodos de consulta = sustantivo$/);
  assert.equal(result.stderr, "");

  const json = run(dir, "--tags", "frontend", "--json");
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.total, 3);
  assert.deepEqual(parsed.resolved.map((r) => r.id), ["R-2", "R-3"]);
  assert.ok(!("_line" in parsed.resolved[0]));

  const all = run(dir, "--all");
  assert.match(all.stdout, /^RULES_RESOLVED: 3 of 3 \(all rules\)/);
});

test("--spec derives the tags from the spec: Módulo, the epic's components and the layer; --tags adds; diacritics never split a tag", () => {
  const ROADMAP = "# ROADMAP\n\n### Milestone 1\n\n- [/] **Epic 1.1:** Facturación básica\n  - **Componentes de arquitectura involucrados:** Facturación, Gestión de Pacientes\n  - **Dependencias:** Ninguna\n";
  const SPEC = "# Spec\n\n**Epic:** 1.1   **Módulo:** Facturación\n\n## Operaciones del Contrato de API\n\n- **Implementa** (spec de backend): `operationId` — `[crearFactura]`\n\n- **AC-1:** x\n";
  const RULES_ACCENTS = RULES + '  - id: R-4\n    tags: [facturacion]\n    rule: "Toda factura tiene CUFE"\n    severity: BLOCKER\n  - id: R-5\n    tags: [gestion-de-pacientes]\n    rule: "Paciente con documento"\n    severity: IMPORTANT\n  - id: R-6\n    tags: [backend]\n    rule: "Sin SQL concatenado"\n    severity: BLOCKER\n';
  const dir = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": RULES_ACCENTS, "docs/04-roadmap/ROADMAP.md": ROADMAP, "docs/05-specs/epic-1.1-facturacion/crear-factura.spec.md": SPEC });
  const result = run(dir, "--spec", "docs/05-specs/epic-1.1-facturacion/crear-factura.spec.md", "--json");
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.tags, ["facturacion", "gestion-de-pacientes", "backend"]);
  assert.deepEqual(parsed.resolved.map((r) => r.id), ["R-2", "R-4", "R-5", "R-6"]);
  assert.deepEqual(parsed.spec, { path: "docs/05-specs/epic-1.1-facturacion/crear-factura.spec.md", epic: "1.1", module: "Facturación", components: ["Facturación", "Gestión de Pacientes"], layer: "backend" });

  const extra = JSON.parse(run(dir, "--spec", "docs/05-specs/epic-1.1-facturacion/crear-factura.spec.md", "--tags", "A11y,backend", "--json").stdout);
  assert.deepEqual(extra.tags, ["facturacion", "gestion-de-pacientes", "backend", "a11y"], "--tags merges, normalized, without duplicates");
  assert.ok(extra.resolved.some((r) => r.id === "R-3"), "a11y reaches R-3");

  const missing = run(dir, "--spec", "docs/05-specs/epic-1.1-facturacion/nope.spec.md");
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no existe/);
  const outside = run(dir, "--spec", ".specture/stack.yml");
  assert.equal(outside.status, 2);
  assert.match(outside.stderr, /no está bajo docs\/05-specs/);
});

test("no rules.yml → the legacy §12 rules are injected whole with a migration warning; nothing declared → RULES_RESOLVED: []", () => {
  const legacy = project({ ".specture/stack.yml": STACK, ".specture/conventions.md": "## 12. Invariantes\n- **R-1:** algo\n- **R-2:** otra cosa\n" });
  const result = run(legacy, "--tags", "dto");
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines[0], "RULES_RESOLVED: 2 of 2 (all rules)", "tolerant read: every legacy rule, tag filter ignored");
  assert.match(lines[1], /^- R-1 \[all\] IMPORTANT — algo$/);
  assert.match(lines[2], /^- R-2 \[all\] IMPORTANT — otra cosa$/);
  assert.match(result.stderr, /rules\.yml` no inicializado — conventions\.md §12 declara 2 regla\(s\); se inyectan todas.*1\.19-rules-file/);
  const json = JSON.parse(run(legacy, "--tags", "dto", "--json").stdout);
  assert.equal(json.legacy, true);
  assert.equal(json.file, ".specture/conventions.md#12");
  assert.deepEqual(json.resolved.map((r) => r.id), ["R-1", "R-2"]);

  const fresh = project({ ".specture/stack.yml": STACK, ".specture/conventions.md": "## 12. Invariantes\n\n> puntero\n" });
  const quiet = run(fresh, "--tags", "dto", "--json");
  assert.equal(quiet.status, 0);
  assert.equal(quiet.stderr, "");
  assert.deepEqual(JSON.parse(quiet.stdout).resolved, []);
});

test("a rules.yml that does not parse fails loud (exit 1); usage errors exit 2", () => {
  const broken = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": "schema: 1\nrules:\n  - id: R-1\n    rule: |\n      multi\n" });
  const result = run(broken, "--tags", "dto");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not parse — multi-line values are not supported.*\(line 4\)/);

  const ok = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": RULES });
  assert.equal(run(ok).status, 2, "neither --tags nor --all");
  assert.equal(run(ok, "--bogus").status, 2);
  const notProject = fs.mkdtempSync(path.join(os.tmpdir(), "not-specture-"));
  temporaryDirectories.push(notProject);
  assert.equal(spawnSync(process.execPath, [cli, "--project", notProject, "--all"], { encoding: "utf8" }).status, 2);
});
