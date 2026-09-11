const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const inventory = require("../../scripts/design-inventory");
const scriptPath = path.resolve(__dirname, "..", "..", "scripts", "design-inventory.js");
const temporaryDirectories = [];

const CONTRACT = "docs/02-architecture/api-contract.openapi.json";
const STACK = `project:\n  name: "App"\napi:\n  style: "rest"\n  contract_file: "${CONTRACT}"\n`;

function makeProject({ nav, ds, contract = null, stack = STACK } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-design-inv-"));
  temporaryDirectories.push(root);
  const write = (rel, text) => {
    const abs = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  };
  write(".specture/stack.yml", stack);
  if (nav !== null) write("docs/03-ux-ui/navigation_map.md", nav);
  if (ds !== null) write("docs/03-ux-ui/design_system.md", ds);
  if (contract !== null) write(CONTRACT, typeof contract === "string" ? contract : JSON.stringify(contract));
  return root;
}

function run(root) {
  const result = spawnSync(process.execPath, [scriptPath, "--verify", "--project", root], { encoding: "utf8" });
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  return { status: result.status, lines, token: lines[0] || "", stderr: result.stderr };
}

const navMap = (rows) =>
  ["## 1. Pantallas", "| Ruta | Pantalla | Auth | Operaciones consumidas | Estados declarados |", "|---|---|---|---|---|", ...rows].join("\n");

const CLEAN_NAV = navMap([
  "| `/archivos` | Mis archivos | `rol:empleado` | `listarArchivos` | `vacío`, `cargando`, `error`, `sin-permiso` |",
  "| `/acerca` | Acerca | `pública` | — | — |"
]);

const invTable = (rows) =>
  ["## 3. Inventario", "| Componente | Nivel | Deriva de | Estado |", "|---|---|---|---|", ...rows].join("\n");

const CLEAN_INV = invTable([
  "| `Button` | primitive | — | `done` |",
  "| `EstadoBadge` | domain | enum `estado` de `listarArchivos` | `pending` |"
]);

const CLEAN_CONTRACT = {
  openapi: "3.1.0",
  paths: { "/archivos": { get: { operationId: "listarArchivos" } } },
  components: { schemas: { Archivo: { properties: { estado: { enum: ["subido", "procesando"] } } } } }
};

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------
// the loud failure — an unrecognised grammar is never an empty PASS
// ---------------------------------------------------------------------------------------

test("a navigation map in the old per-screen grammar is UNVERIFIABLE, not a PASS over zero screens", () => {
  const old = "### `/archivos` — Mis archivos\n- **Auth requerida:** Sí (empleado)\n- **Operaciones que consume:** `listarArchivos`\n";
  const { status, token } = run(makeProject({ nav: old, ds: CLEAN_INV }));
  assert.equal(status, 2, "cero pantallas implicaría cero requisitos incumplidos: eso no puede ser un PASS");
  assert.match(token, /UNVERIFIABLE.*no se reconoció ninguna pantalla/);
});

test("a missing navigation map or design system is UNVERIFIABLE", () => {
  assert.match(run(makeProject({ nav: null, ds: CLEAN_INV })).token, /UNVERIFIABLE no existe docs[\\/]03-ux-ui[\\/]navigation_map\.md/);
  assert.match(run(makeProject({ nav: CLEAN_NAV, ds: null })).token, /UNVERIFIABLE no existe docs[\\/]03-ux-ui[\\/]design_system\.md/);
});

test("a clean project passes with a 12-hex token", () => {
  const { status, token, lines, stderr } = run(makeProject({ nav: CLEAN_NAV, ds: CLEAN_INV, contract: CLEAN_CONTRACT }));
  assert.equal(status, 0, stderr + lines.join("\n"));
  assert.match(token, /^DESIGN_CHECK: inventory PASS [0-9a-f]{12}$/);
});

// ---------------------------------------------------------------------------------------
// I1 — declared states
// ---------------------------------------------------------------------------------------

test("I1: a screen that consumes operations must declare cargando and error", () => {
  const nav = navMap(["| `/archivos` | Mis archivos | `pública` | `listarArchivos` | `vacío` |"]);
  const { status, lines } = run(makeProject({ nav, ds: CLEAN_INV, contract: CLEAN_CONTRACT }));
  assert.equal(status, 1);
  assert.ok(lines.some((l) => /^I1 BLOCKER .*no declara `cargando`/.test(l)), lines.join("\n"));
  assert.ok(lines.some((l) => /^I1 BLOCKER .*no declara `error`/.test(l)));
});

test("I1: a role-gated screen must declare sin-permiso, and an unknown state is a WARNING", () => {
  const nav = navMap(["| `/panel` | Panel | `rol:admin` | `listarArchivos` | `cargando`, `error`, `pendiente` |"]);
  const { lines } = run(makeProject({ nav, ds: CLEAN_INV, contract: CLEAN_CONTRACT }));
  assert.ok(lines.some((l) => /^I1 BLOCKER .*`rol:admin` y no declara `sin-permiso`/.test(l)), lines.join("\n"));
  assert.ok(lines.some((l) => /^I1 WARNING .*`pendiente` fuera del vocabulario/.test(l)));
});

test("I1: a screen with no operations and no states is fine", () => {
  const nav = navMap(["| `/acerca` | Acerca | `pública` | — | — |"]);
  assert.equal(run(makeProject({ nav, ds: CLEAN_INV, contract: CLEAN_CONTRACT })).status, 0);
});

// ---------------------------------------------------------------------------------------
// I2 / I5 — the contract
// ---------------------------------------------------------------------------------------

test("I2: an operationId the contract does not declare is a contract gap, not something to invent", () => {
  const nav = navMap(["| `/archivos` | Mis archivos | `pública` | `listarArchivos`, `borrarArchivo` | `cargando`, `error` |"]);
  const { status, lines } = run(makeProject({ nav, ds: CLEAN_INV, contract: CLEAN_CONTRACT }));
  assert.equal(status, 1);
  assert.match(lines.find((l) => l.startsWith("I2")), /`borrarArchivo`, que no existe en el contrato/);
});

test("I2 and I5 say they were skipped instead of contributing a silent zero", () => {
  const { lines } = run(makeProject({ nav: CLEAN_NAV, ds: CLEAN_INV, contract: null }));
  assert.ok(lines.some((l) => /^I2 INFO .*omitido/.test(l)), lines.join("\n"));
  assert.ok(lines.some((l) => /^I5 INFO .*omitido/.test(l)));
});

test("I5: an enum no component accounts for is a BLOCKER; YAML contracts say so instead of guessing", () => {
  const orphanEnum = invTable(["| `Button` | primitive | — | `done` |", "| `OtroBadge` | domain | agregado `Cupo` | `pending` |"]);
  const { status, lines } = run(makeProject({ nav: CLEAN_NAV, ds: orphanEnum, contract: CLEAN_CONTRACT }));
  assert.equal(status, 1);
  assert.match(lines.find((l) => l.startsWith("I5")), /el enum `estado` del contrato no lo cubre ningún componente/);

  const yaml = makeProject({
    nav: CLEAN_NAV,
    ds: CLEAN_INV,
    stack: 'project:\n  name: "App"\napi:\n  contract_file: "docs/02-architecture/api-contract.openapi.yaml"\n',
    contract: null
  });
  fs.mkdirSync(path.join(yaml, "docs", "02-architecture"), { recursive: true });
  fs.writeFileSync(path.join(yaml, "docs", "02-architecture", "api-contract.openapi.yaml"), "paths:\n  /archivos:\n    get:\n      operationId: listarArchivos\n");
  const result = run(yaml);
  assert.ok(result.lines.some((l) => /^I5 INFO .*no legibles/.test(l)), result.lines.join("\n"));
  assert.ok(!result.lines.some((l) => l.startsWith("I2 INFO")), "los operationId sí se leen de un YAML");
});

// ---------------------------------------------------------------------------------------
// I3 / I4 — the inventory itself
// ---------------------------------------------------------------------------------------

test("I3: an inventory with no domain component is generic by definition", () => {
  const noDomain = invTable(["| `Button` | primitive | — | `done` |", "| `Card` | composite | — | `done` |"]);
  const { status, lines } = run(makeProject({ nav: CLEAN_NAV, ds: noDomain, contract: CLEAN_CONTRACT }));
  assert.equal(status, 1);
  assert.match(lines.find((l) => l.startsWith("I3")), /ninguno de nivel `domain`/);
});

test("I4: a deferred row must name where it is deferred to", () => {
  const bad = invTable(["| `EstadoBadge` | domain | enum `estado` | `deferred` |"]);
  const good = invTable(["| `EstadoBadge` | domain | enum `estado` | `deferred → Epic 3.4` |"]);
  assert.match(run(makeProject({ nav: CLEAN_NAV, ds: bad, contract: CLEAN_CONTRACT })).lines.find((l) => l.startsWith("I4")), /sin destino/);
  assert.equal(run(makeProject({ nav: CLEAN_NAV, ds: good, contract: CLEAN_CONTRACT })).status, 0);
});

test("parseScreens and parseInventory ignore prose tables that are not the grammar", () => {
  assert.deepEqual(inventory.parseScreens("| a | b | c | d | e |\n|---|---|---|---|---|\n| x | y | z | w | v |"), []);
  assert.deepEqual(inventory.parseInventory("| `Button` | inventado | — | `done` |"), [], "nivel desconocido");
  assert.deepEqual(inventory.enumsFrom("paths: {}", "c.yaml"), null, "YAML no se adivina");
});

test("I4: a destination epic that does not exist in the ROADMAP is a BLOCKER, not a promise", () => {
  const roadmap = "# ROADMAP\n\n### Milestone 1: M\n\n- [ ] **Epic 1.1:** Base\n  - **Dependencias:** Ninguna\n";
  const deferred = invTable(["| `EstadoBadge` | domain | enum `estado` | `deferred → Epic 9.9` |"]);
  const root = makeProject({ nav: CLEAN_NAV, ds: deferred, contract: CLEAN_CONTRACT });
  fs.mkdirSync(path.join(root, "docs", "04-roadmap"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "04-roadmap", "ROADMAP.md"), roadmap);
  const { status, lines } = run(root);
  assert.equal(status, 1);
  assert.match(lines.find((l) => l.startsWith("I4")), /`Epic 9\.9`, que no existe en el ROADMAP/);
});

test("I4: `sin epic asignado` is declared debt and passes; a real epic passes too", () => {
  const roadmap = "# ROADMAP\n\n### Milestone 3: M\n\n- [ ] **Epic 3.4:** Cupos\n  - **Dependencias:** Ninguna\n";
  for (const status of ["deferred → sin epic asignado", "deferred → fuera del roadmap", "deferred → Epic 3.4"]) {
    const root = makeProject({ nav: CLEAN_NAV, ds: invTable([`| \`EstadoBadge\` | domain | enum \`estado\` | \`${status}\` |`]), contract: CLEAN_CONTRACT });
    fs.mkdirSync(path.join(root, "docs", "04-roadmap"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "04-roadmap", "ROADMAP.md"), roadmap);
    assert.equal(run(root).status, 0, `"${status}" debería pasar`);
  }
});
