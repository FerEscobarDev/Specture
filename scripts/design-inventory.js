#!/usr/bin/env node
// Design inventory verification — cross-checks the component inventory against the navigation
// map and the API contract.
//
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/design-inventory.js" --verify [--project <root>] [--json]
//
// **It verifies; it does not derive.** A deriving script would have to read enums, `format`,
// `maxLength` and `required` out of the contract's readable companion, which keeps them in a
// free-text cell, and out of a navigation map that had no canonical grammar — it would emit an
// empty inventory *in silence* and the gate would always pass. So the inventory is written by
// `ux-design` and this script checks it is not lying.
//
// Every dimension that cannot be computed says so (`INFO … omitido`) instead of quietly
// contributing zero findings. A grammar it does not recognise is `UNVERIFIABLE`, never an empty
// PASS: "cero pantallas" would imply "cero requisitos incumplidos".
//
// Checks:
//   I1  every screen declares the states its row implies                        BLOCKER
//   I2  every operationId a screen consumes exists in the contract              BLOCKER
//   I3  the inventory has at least one `domain` component                       BLOCKER
//   I4  every `deferred` row names where it is deferred to                      BLOCKER
//   I5  every enum of the contract is accounted for by some inventory row       BLOCKER
//
// stdout: `DESIGN_CHECK: inventory PASS <sha12>` | `… FAIL <sha12>` | `… UNVERIFIABLE <reason>`,
// then one `<check> <severity> <detail>` per finding. Exit 0 / 1 / 2.
//
// No dependencies (repo invariant).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { operationIdsFrom } = require("../migrations/lib");
const { stackField } = require("../hooks/lib/doctor/project");

const NAV_MAP = path.join("docs", "03-ux-ui", "navigation_map.md");
const DESIGN_SYSTEM = path.join("docs", "03-ux-ui", "design_system.md");
const STATES = ["vacío", "cargando", "error", "sin-permiso"];
const TIERS = ["foundation", "primitive", "composite", "domain", "pattern"];

// ---------------------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------------------

function rows(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && !/^\s*\|[\s:|-]+\|\s*$/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((c) => c.trim()));
}

const ticked = (cell) => [...String(cell).matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
const isEmDash = (cell) => /^[—–-]$/.test(String(cell).trim());

// Screens from NAVIGATION_MAP_TEMPLATE.md §1: ruta | pantalla | auth | operaciones | estados.
function parseScreens(text) {
  const out = [];
  for (const cells of rows(text)) {
    if (cells.length < 5) continue;
    const route = ticked(cells[0])[0];
    if (!route || !route.startsWith("/")) continue; // header row, or prose table
    const auth = ticked(cells[2])[0] || cells[2];
    out.push({
      route,
      name: cells[1],
      auth,
      operations: isEmDash(cells[3]) ? [] : ticked(cells[3]),
      states: isEmDash(cells[4]) ? [] : ticked(cells[4])
    });
  }
  return out;
}

// Components from DESIGN_SYSTEM_TEMPLATE.md §3: componente | nivel | deriva de | estado.
function parseInventory(text) {
  const out = [];
  for (const cells of rows(text)) {
    if (cells.length < 4) continue;
    const name = ticked(cells[0])[0];
    const tier = String(cells[1]).replace(/`/g, "").trim().toLowerCase();
    if (!name || !TIERS.includes(tier)) continue;
    out.push({ name, tier, derivedFrom: cells[2], status: String(cells[3]).replace(/`/g, "").trim() });
  }
  return out;
}

// Enum names declared in a JSON OpenAPI document. YAML is not parsed — see check I5.
function enumsFrom(text, file) {
  if (!/\.json$/i.test(file)) return null;
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  const found = new Set();
  const walk = (node, name) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.enum) && name) found.add(name);
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") walk(value, key === "properties" || key === "schemas" ? name : key);
    }
  };
  walk(doc.components || {}, null);
  walk(doc.paths || {}, null);
  return [...found];
}

// ---------------------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------------------

function runChecks({ screens, inventory, contract }) {
  const findings = [];
  const add = (check, severity, detail) => findings.push({ check, severity, detail });

  // ---- I1 — every screen declares the states its own row implies ----------------------
  for (const screen of screens) {
    const has = (s) => screen.states.includes(s);
    for (const unknown of screen.states.filter((s) => !STATES.includes(s))) {
      add("I1", "WARNING", `\`${screen.route}\`: estado \`${unknown}\` fuera del vocabulario (${STATES.join(" · ")})`);
    }
    if (screen.operations.length > 0) {
      for (const required of ["cargando", "error"]) {
        if (!has(required)) add("I1", "BLOCKER", `\`${screen.route}\` consume ${screen.operations.length} operación(es) y no declara \`${required}\``);
      }
    }
    if (/^rol:/i.test(screen.auth) && !has("sin-permiso")) {
      add("I1", "BLOCKER", `\`${screen.route}\` está tras \`${screen.auth}\` y no declara \`sin-permiso\``);
    }
  }

  // ---- I2 — the operations the screens cite exist -------------------------------------
  if (!contract.ids) {
    add("I2", "INFO", `no se pudo leer el contrato (${contract.file || "sin declarar"}) — I2 omitido`);
  } else {
    const known = new Set(contract.ids);
    for (const screen of screens) {
      for (const op of screen.operations.filter((o) => !known.has(o))) {
        add("I2", "BLOCKER", `\`${screen.route}\` cita \`${op}\`, que no existe en el contrato — es un hueco del contrato, no se inventa aquí`);
      }
    }
  }

  // ---- I3 — the domain tier is not empty ----------------------------------------------
  if (inventory.length === 0) {
    add("I3", "BLOCKER", "el inventario está vacío o no sigue la gramática de DESIGN_SYSTEM_TEMPLATE.md §3");
  } else if (!inventory.some((c) => c.tier === "domain")) {
    add("I3", "BLOCKER", `${inventory.length} componente(s) y ninguno de nivel \`domain\`: un design system sin componentes de dominio es genérico por definición`);
  }

  // ---- I4 — a deferral names its destination ------------------------------------------
  for (const component of inventory.filter((c) => /^deferred/i.test(c.status))) {
    if (!/→\s*\S/.test(component.status)) {
      add("I4", "BLOCKER", `\`${component.name}\` está \`deferred\` sin destino: usar \`deferred → Epic X.Y\` o \`deferred → fuera del roadmap\``);
    }
  }

  // ---- I5 — every enum is accounted for -----------------------------------------------
  if (!contract.enums) {
    add("I5", "INFO", `enums no legibles (el contrato no es JSON parseable) — I5 omitido; la cobertura de enums queda a juicio del gate visual`);
  } else if (contract.enums.length === 0) {
    add("I5", "INFO", "el contrato no declara ningún enum — I5 omitido");
  } else {
    const accounted = inventory.map((c) => `${c.derivedFrom} ${c.name}`).join(" ").toLowerCase();
    for (const name of contract.enums.filter((e) => !accounted.includes(e.toLowerCase()))) {
      add("I5", "BLOCKER", `el enum \`${name}\` del contrato no lo cubre ningún componente: cada enum necesita un tratamiento visual con una variante por miembro`);
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------------------

function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".specture"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function readContract(root) {
  const stackPath = path.join(root, ".specture", "stack.yml");
  let file = null;
  try {
    file = (stackField(fs.readFileSync(stackPath, "utf8"), "api", "contract_file") || "").replace(/["'`]/g, "").trim();
  } catch {
    return { file: null, ids: null, enums: null };
  }
  if (!file || /^\[/.test(file)) return { file: null, ids: null, enums: null };
  const abs = path.join(root, ...file.split("/"));
  if (!fs.existsSync(abs)) return { file, ids: null, enums: null };
  const text = fs.readFileSync(abs, "utf8");
  return { file, ids: operationIdsFrom(text, file).map((o) => o.operationId), enums: enumsFrom(text, file) };
}

function main(argv) {
  if (!argv.includes("--verify")) {
    process.stderr.write("usage: design-inventory.js --verify [--project <root>] [--json]\n");
    return 2;
  }
  const json = argv.includes("--json");
  const projectFlag = argv.indexOf("--project");
  const root = projectFlag !== -1 ? path.resolve(argv[projectFlag + 1]) : findProjectRoot(process.cwd());

  const fail = (reason) => {
    process.stdout.write(`DESIGN_CHECK: inventory UNVERIFIABLE ${reason}\n`);
    return 2;
  };
  if (!root) return fail("no se encontró la raíz del proyecto (.specture/)");

  const navPath = path.join(root, NAV_MAP);
  const dsPath = path.join(root, DESIGN_SYSTEM);
  if (!fs.existsSync(navPath)) return fail(`no existe ${NAV_MAP}`);
  if (!fs.existsSync(dsPath)) return fail(`no existe ${DESIGN_SYSTEM}`);

  const screens = parseScreens(fs.readFileSync(navPath, "utf8"));
  if (screens.length === 0) {
    // The loud failure that makes the silent-empty-pass impossible.
    return fail(`no se reconoció ninguna pantalla en ${NAV_MAP} — ¿sigue la tabla de cinco columnas de NAVIGATION_MAP_TEMPLATE.md §1?`);
  }

  const inventory = parseInventory(fs.readFileSync(dsPath, "utf8"));
  const findings = runChecks({ screens, inventory, contract: readContract(root) });
  const status = findings.some((f) => f.severity === "BLOCKER") ? "FAIL" : "PASS";
  const sha = crypto.createHash("sha256").update(JSON.stringify(findings)).digest("hex").slice(0, 12);

  if (json) {
    process.stdout.write(`${JSON.stringify({ check: "inventory", status, sha, screens: screens.length, components: inventory.length, findings }, null, 2)}\n`);
  } else {
    process.stdout.write(`DESIGN_CHECK: inventory ${status} ${sha}\n`);
    for (const f of findings) process.stdout.write(`${f.check} ${f.severity} ${f.detail}\n`);
  }
  return status === "FAIL" ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { parseScreens, parseInventory, enumsFrom, runChecks };
