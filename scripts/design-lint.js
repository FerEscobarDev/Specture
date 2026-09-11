#!/usr/bin/env node
// Design lint — deterministic checks over docs/03-ux-ui/design_system.md.
//
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/design-lint.js" contrast [--project <root>] [--json]
//   node "${CLAUDE_PLUGIN_ROOT}/scripts/design-lint.js" tokens   [--project <root>] [--json]
//
// `contrast` — WCAG 2.2 arithmetic over the semantic token table, run once per mode (light and
//   dark). It is the one design check that needs no corpus calibration: the thresholds are the
//   legal floor, not a matter of taste. Fails on an insufficient ratio AND on a mandatory pair
//   that was never declared — different causes, different messages. Without that floor the check
//   iterates an empty set and emits PASS over a system that declares nothing, which is the
//   vacuous-green failure `code-reviewer` already guards against for tests.
//
// `tokens` — token adherence over the project's UI code: factory neutral scales, uniform radius,
//   gradient text, the unedited shadcn Card chain. WARNING only, never blocking. Measured against
//   four real codebases (see docs/frontend-design-baseline.md): what it detects is code bypassing
//   the project's own palette, not "generic design". There is deliberately **no genericity gate**
//   — that measurement was prototyped against the five real design systems and did not separate
//   the classes (a role-blind pass over hex values cannot tell a brand primary from a domain
//   colour), so it is not shipped, not even as a signal.
//
// stdout: first line is the token — `DESIGN_CHECK: <check> PASS <sha12>` | `… FAIL <sha12>` |
// `DESIGN_CHECK: <check> UNVERIFIABLE <reason>`; then one `<severity> <detail>` per finding.
// Exit 0 = PASS (warnings allowed), 1 = FAIL (>= 1 BLOCKER), 2 = UNVERIFIABLE.
//
// No dependencies (repo invariant).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DESIGN_SYSTEM = path.join("docs", "03-ux-ui", "design_system.md");
const UI_EXTENSIONS = [".tsx", ".jsx", ".vue", ".svelte", ".html", ".astro", ".blade.php"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "vendor", "docs"]);

// ---------------------------------------------------------------------------------------
// colour
// ---------------------------------------------------------------------------------------

function parseHex(value) {
  const m = String(value).match(/#([0-9a-f]{6})\b/i);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function relativeLuminance(hex) {
  const channel = (h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.x contrast ratio, rounded to two decimals the way the spec's examples are quoted.
function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// ---------------------------------------------------------------------------------------
// parsing — the grammar of DESIGN_SYSTEM_TEMPLATE.md §2.1 and §2.2
// ---------------------------------------------------------------------------------------

function tableRows(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && !/^\s*\|[\s:|-]+\|\s*$/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells.length >= 3);
}

const tokenName = (cell) => (String(cell).match(/`([A-Za-z0-9._-]+)`/) || [])[1] || null;

// { primitives: {name: {light, dark}}, semantics: {name: {light, dark}} }
function parseTokens(text) {
  const primitives = {};
  const semantics = {};
  for (const cells of tableRows(text)) {
    const name = tokenName(cells[0]);
    if (!name) continue;
    const light = cells[1];
    const dark = cells[2];
    const litLight = parseHex(light);
    if (litLight) {
      primitives[name] = { light: litLight, dark: parseHex(dark) || litLight };
      continue;
    }
    const refLight = tokenName(light);
    const refDark = tokenName(dark);
    if (refLight) semantics[name] = { light: refLight, dark: refDark || refLight };
  }
  return { primitives, semantics };
}

// A semantic token resolved to a literal colour for one mode, or null.
function resolve(name, mode, { primitives, semantics }, seen = new Set()) {
  if (seen.has(name)) return null; // reference cycle
  seen.add(name);
  if (primitives[name]) return primitives[name][mode] || null;
  const ref = semantics[name];
  return ref ? resolve(ref[mode], mode, { primitives, semantics }, seen) : null;
}

// ---------------------------------------------------------------------------------------
// contrast
// ---------------------------------------------------------------------------------------

// The mandatory floor. `min` is the WCAG 2.2 threshold for that pair's role.
//
// `border.subtle` is deliberately absent: a decorative separator is not a meaningful boundary
// under SC 1.4.11, and requiring 3:1 of it fails honest systems. `border.strong` — the one that
// draws control boundaries — is the one that must hold.
//
// The focus ring against the control it sits on is a WARNING, not a BLOCKER. SC 2.4.11 does
// require 3:1 against adjacent colours, but the standard way to satisfy it is an offset or a
// two-tone ring, and a token table cannot express either. Measured: no flat colour clears 3:1
// against both a white canvas and a mid-dark action colour, so blocking here would fail every
// real system while proving nothing.
const REQUIRED_PAIRS = [
  { fg: "color.text.primary", bg: "color.bg.canvas", min: 4.5, severity: "BLOCKER", what: "texto principal sobre el fondo de página" },
  { fg: "color.text.primary", bg: "color.bg.surface", min: 4.5, severity: "BLOCKER", what: "texto principal sobre superficie" },
  { fg: "color.text.muted", bg: "color.bg.surface", min: 4.5, severity: "BLOCKER", what: "texto auxiliar sobre superficie" },
  { fg: "color.text.on-accent", bg: "color.action.primary", min: 4.5, severity: "BLOCKER", what: "texto sobre el color de acción" },
  { fg: "color.border.strong", bg: "color.bg.surface", min: 3, severity: "BLOCKER", what: "borde de control sobre superficie (no-texto)" },
  { fg: "color.focus.ring", bg: "color.bg.canvas", min: 3, severity: "BLOCKER", what: "anillo de foco contra el fondo de página" },
  { fg: "color.focus.ring", bg: "color.action.primary", min: 3, severity: "WARNING", what: "anillo de foco sobre el control que enfoca — si no llega, declarar offset o anillo bitono" }
];

function checkContrast(text) {
  const tokens = parseTokens(text);
  const findings = [];
  const declared = new Set([...Object.keys(tokens.semantics), ...Object.keys(tokens.primitives)]);

  if (declared.size === 0) {
    return { status: "UNVERIFIABLE", reason: "no se reconoció ninguna tabla de tokens — ¿sigue design_system.md la gramática de DESIGN_SYSTEM_TEMPLATE.md §2?", findings };
  }

  const reported = new Set();
  for (const pair of REQUIRED_PAIRS) {
    for (const missing of [pair.fg, pair.bg].filter((t) => !declared.has(t) && !reported.has(t))) {
      reported.add(missing);
      findings.push({ severity: pair.severity, detail: `par obligatorio no declarado: falta \`${missing}\` (${pair.what})` });
    }
  }

  for (const mode of ["light", "dark"]) {
    for (const pair of REQUIRED_PAIRS) {
      const fg = resolve(pair.fg, mode, tokens);
      const bg = resolve(pair.bg, mode, tokens);
      if (!fg || !bg) continue; // already reported as undeclared, or unresolvable
      const ratio = contrastRatio(fg, bg);
      if (ratio < pair.min) {
        findings.push({
          severity: pair.severity,
          detail: `modo ${mode === "light" ? "claro" : "oscuro"}: \`${pair.fg}\` sobre \`${pair.bg}\` = ${ratio}:1, por debajo de ${pair.min}:1 (${pair.what})`
        });
      }
    }
  }

  return { status: findings.some((f) => f.severity === "BLOCKER") ? "FAIL" : "PASS", findings };
}

// ---------------------------------------------------------------------------------------
// tokens — adherence over UI code
// ---------------------------------------------------------------------------------------

const CODE_TELLS = [
  { id: "neutros-de-fabrica", re: /\b(?:bg|text|border|ring|divide)-(?:slate|zinc|gray|neutral)-(?:50|[1-9]00|950)\b/g,
    detail: "escala neutra de fábrica en el código: el sistema declara sus propios neutros y esto los esquiva" },
  { id: "cadena-card-shadcn", re: /rounded-lg\s+border\s+bg-card\s+text-card-foreground\s+shadow-sm/g,
    detail: "la cadena de Card de shadcn sin editar" },
  { id: "base-color-slate", re: /"baseColor"\s*:\s*"slate"/g,
    detail: "`components.json` con `baseColor: \"slate\"` sin editar" },
  { id: "texto-con-gradiente", re: /bg-clip-text/g, detail: "texto con gradiente" },
  { id: "radio-uniforme", re: /rounded-2xl/g, detail: "`rounded-2xl` — revisar que sea el perfil de radio declarado y no el default" }
];

function walkUi(root, dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walkUi(root, rel, out);
    } else if (UI_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel);
    }
  }
  return out;
}

function checkTokens(root) {
  const files = walkUi(root, ".", []);
  if (files.length === 0) {
    return { status: "UNVERIFIABLE", reason: "no se encontró código de UI en el proyecto", findings: [] };
  }
  const counts = new Map();
  for (const rel of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    for (const tell of CODE_TELLS) {
      const hits = (text.match(tell.re) || []).length;
      if (hits === 0) continue;
      const current = counts.get(tell.id) || { tell, total: 0, files: new Set() };
      current.total += hits;
      current.files.add(rel);
      counts.set(tell.id, current);
    }
  }
  const findings = [...counts.values()]
    .sort((a, b) => b.total - a.total)
    .map(({ tell, total, files: where }) => ({
      severity: "WARNING",
      detail: `${tell.detail} — ${total} ocurrencia(s) en ${where.size} archivo(s), p.ej. ${[...where][0]}`
    }));
  return { status: "PASS", findings }; // never blocking: adherence is a reviewer signal, not a gate
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

function main(argv) {
  const check = argv[0];
  if (!["contrast", "tokens"].includes(check)) {
    process.stderr.write("usage: design-lint.js <contrast|tokens> [--project <root>] [--json]\n");
    return 2;
  }
  const json = argv.includes("--json");
  const projectFlag = argv.indexOf("--project");
  const root = projectFlag !== -1 ? path.resolve(argv[projectFlag + 1]) : findProjectRoot(process.cwd());
  if (!root) {
    process.stdout.write(`DESIGN_CHECK: ${check} UNVERIFIABLE no se encontró la raíz del proyecto (.specture/)\n`);
    return 2;
  }

  let result;
  if (check === "contrast") {
    const file = path.join(root, DESIGN_SYSTEM);
    if (!fs.existsSync(file)) {
      result = { status: "UNVERIFIABLE", reason: `no existe ${DESIGN_SYSTEM}`, findings: [] };
    } else {
      result = checkContrast(fs.readFileSync(file, "utf8"));
    }
  } else {
    result = checkTokens(root);
  }

  const sha = crypto.createHash("sha256").update(JSON.stringify(result.findings)).digest("hex").slice(0, 12);
  const token = result.status === "UNVERIFIABLE"
    ? `DESIGN_CHECK: ${check} UNVERIFIABLE ${result.reason}`
    : `DESIGN_CHECK: ${check} ${result.status} ${sha}`;

  if (json) {
    process.stdout.write(`${JSON.stringify({ check, ...result, sha }, null, 2)}\n`);
  } else {
    process.stdout.write(`${token}\n`);
    for (const f of result.findings) process.stdout.write(`${f.severity} ${f.detail}\n`);
  }
  return result.status === "UNVERIFIABLE" ? 2 : result.status === "FAIL" ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { contrastRatio, parseTokens, resolve, checkContrast, checkTokens, REQUIRED_PAIRS };
