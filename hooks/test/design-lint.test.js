const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const lint = require("../../scripts/design-lint");
const scriptPath = path.resolve(__dirname, "..", "..", "scripts", "design-lint.js");
const temporaryDirectories = [];

function makeProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-design-lint-"));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, ".specture"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "stack.yml"), "schema: 1\n");
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return root;
}

function run(root, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args, "--project", root], { encoding: "utf8" });
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  return { status: result.status, lines, token: lines[0] || "", stderr: result.stderr };
}

// A design system with the full semantic floor, every pair passing, in both modes.
function designSystem({ textPrimary = "neutral.900", darkTextPrimary = "neutral.50" } = {}) {
  return [
    "## 2.1 Primitivos — la rampa es fija; lo que cambia por modo es el mapeo de §2.2",
    "| Token | Valor | Notas |",
    "|---|---|---|",
    "| `neutral.0` | #ffffff | |",
    "| `neutral.50` | #f6f8f9 | |",
    "| `neutral.400` | #9aa7ad | |",
    "| `neutral.500` | #6e7a80 | |",
    "| `neutral.600` | #55656d | |",
    "| `neutral.900` | #16232a | |",
    "| `neutral.1000` | #0b0f14 | |",
    "| `brand.400` | #4fb3a4 | |",
    "| `brand.700` | #1f6b5e | |",
    "",
    "## 2.2 Semánticos",
    "| Token semántico | Claro | Oscuro | Uso |",
    "|---|---|---|---|",
    "| `color.bg.canvas` | `neutral.0` | `neutral.1000` | fondo |",
    "| `color.bg.surface` | `neutral.0` | `neutral.900` | superficie |",
    `| \`color.text.primary\` | \`${textPrimary}\` | \`${darkTextPrimary}\` | texto |`,
    "| `color.text.muted` | `neutral.600` | `neutral.400` | auxiliar |",
    "| `color.text.on-accent` | `neutral.0` | `neutral.1000` | sobre acción |",
    "| `color.border.strong` | `neutral.500` | `neutral.400` | bordes de control |",
    "| `color.action.primary` | `brand.700` | `brand.400` | acción |",
    "| `color.focus.ring` | `brand.700` | `brand.400` | foco |"
  ].join("\n");
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------
// contrast arithmetic — values from the WCAG 2.x definition
// ---------------------------------------------------------------------------------------

test("contrastRatio matches the WCAG reference values", () => {
  assert.equal(lint.contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(lint.contrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(lint.contrastRatio("#ffffff", "#000000"), 21, "symmetric");
  assert.equal(lint.contrastRatio("#777777", "#ffffff"), 4.48, "the classic just-below-AA grey");
});

test("semantic tokens resolve through the primitive layer, per mode", () => {
  const tokens = lint.parseTokens(designSystem());
  assert.equal(lint.resolve("color.text.primary", "light", tokens), "#16232a");
  assert.equal(lint.resolve("color.bg.canvas", "dark", tokens), "#0b0f14", "el modo oscuro remapea el semántico, no cambia el primitivo");
  assert.equal(lint.resolve("color.no.existe", "light", tokens), null);
});

// ---------------------------------------------------------------------------------------
// the mandatory floor — the vacuous-green guard
// ---------------------------------------------------------------------------------------

test("contrast: a system with no token table is UNVERIFIABLE, never a silent PASS", () => {
  const root = makeProject({ "docs/03-ux-ui/design_system.md": "# Design System\n\nProsa sin tablas.\n" });
  const { status, token } = run(root, ["contrast"]);
  assert.equal(status, 2);
  assert.match(token, /^DESIGN_CHECK: contrast UNVERIFIABLE /);
});

test("contrast: a single-layer system FAILS naming its cause, not eight times the same fact", () => {
  const singleLayer = ["| Token | Valor (HEX) | Uso |", "|---|---|---|", "| `color.primary.500` | #0d9488 | acción |", "| `color.neutral.900` | #0f172a | texto |"].join("\n");
  const root = makeProject({ "docs/03-ux-ui/design_system.md": singleLayer });
  const { status, lines } = run(root, ["contrast"]);
  assert.equal(status, 1, "must not be a PASS over zero pairs");
  // No semantic layer at all: one BLOCKER that says WHY, and names the migration that fixes it.
  // Enumerating the eight missing tokens would repeat one fact eight times and still not answer
  // the reader's question.
  assert.equal(lines.length, 2, `token + one finding, got:\n${lines.join("\n")}`);
  assert.match(lines[1], /^BLOCKER no hay capa semántica de color/);
  assert.match(lines[1], /2\.0-design-system-layers/, "names the content migration");
  assert.match(lines[1], /\/specture:ux-design/, "and the command that resolves it");
});

test("contrast: a PARTIAL semantic layer still enumerates the tokens that are missing", () => {
  // Here the per-token list is exactly the right answer: the layer exists, these two are absent.
  const partial = [
    "| Token | Valor (HEX) | Uso |",
    "|---|---|---|",
    "| `color.bg.canvas` | #ffffff | fondo |",
    "| `color.bg.surface` | #ffffff | superficie |",
    "| `color.text.primary` | #0f172a | texto |",
    "| `color.text.muted` | #475569 | auxiliar |",
    "| `color.text.on-accent` | #ffffff | sobre acción |",
    "| `color.action.primary` | #0d9488 | acción |"
  ].join("\n");
  const root = makeProject({ "docs/03-ux-ui/design_system.md": partial });
  const { status, lines } = run(root, ["contrast"]);
  assert.equal(status, 1);
  assert.ok(lines.some((l) => /par obligatorio no declarado.*color\.border\.strong/.test(l)), lines.join("\n"));
  assert.ok(lines.some((l) => /par obligatorio no declarado.*color\.focus\.ring/.test(l)));
  assert.ok(!lines.some((l) => /no hay capa semántica/.test(l)), "the layer is not absent — do not collapse");
});

test("contrast: a complete system with passing pairs is a PASS with a 12-hex token", () => {
  const root = makeProject({ "docs/03-ux-ui/design_system.md": designSystem() });
  const { status, token, lines, stderr } = run(root, ["contrast"]);
  assert.equal(status, 0, stderr + lines.join("\n"));
  assert.match(token, /^DESIGN_CHECK: contrast PASS [0-9a-f]{12}$/);
});

test("contrast: an insufficient ratio is a BLOCKER that names the mode and the number", () => {
  // neutral.400 on white is ~2.8:1 — fine as a border, far below AA as body text.
  const root = makeProject({ "docs/03-ux-ui/design_system.md": designSystem({ textPrimary: "neutral.400" }) });
  const { status, lines } = run(root, ["contrast"]);
  assert.equal(status, 1);
  const finding = lines.find((l) => /color\.text\.primary` sobre `color\.bg\.canvas/.test(l));
  assert.match(finding, /BLOCKER/);
  assert.match(finding, /modo claro/);
  assert.match(finding, /por debajo de 4\.5:1/);
});

test("contrast: the dark mode is checked too — it is enumerated, not derived", () => {
  // Light column fine, dark column puts near-black text on the near-black dark canvas.
  const root = makeProject({ "docs/03-ux-ui/design_system.md": designSystem({ darkTextPrimary: "neutral.900" }) });
  const { status, lines } = run(root, ["contrast"]);
  assert.equal(status, 1);
  assert.ok(lines.some((l) => /modo oscuro/.test(l)), lines.join("\n"));
  assert.ok(!lines.some((l) => /modo claro.*text\.primary` sobre `color\.bg\.canvas/.test(l)), "el modo claro estaba bien");
});

// ---------------------------------------------------------------------------------------
// tokens — adherence over code, never blocking
// ---------------------------------------------------------------------------------------

test("tokens: factory neutral scales in code are a WARNING, never a BLOCKER", () => {
  const root = makeProject({ "src/Page.tsx": 'export const P = () => <div className="bg-slate-100 text-gray-700" />;\n' });
  const { status, token, lines } = run(root, ["tokens"]);
  assert.equal(status, 0, "adherence is a reviewer signal, not a gate");
  assert.match(token, /^DESIGN_CHECK: tokens PASS /);
  const finding = lines.find((l) => /escala neutra de fábrica/.test(l));
  assert.match(finding, /^WARNING/);
  assert.match(finding, /2 ocurrencia\(s\) en 1 archivo\(s\)/);
});

test("tokens: clean code reports nothing, and a project with no UI is UNVERIFIABLE", () => {
  const clean = makeProject({ "src/Page.tsx": 'export const P = () => <div className="bg-surface text-primary" />;\n' });
  assert.deepEqual(run(clean, ["tokens"]).lines.slice(1), []);

  const empty = makeProject({ "README.md": "sin UI\n" });
  const { status, token } = run(empty, ["tokens"]);
  assert.equal(status, 2);
  assert.match(token, /UNVERIFIABLE no se encontró código de UI/);
});

test("tokens: node_modules and build output are not scanned", () => {
  const root = makeProject({
    "node_modules/lib/Comp.tsx": 'const C = () => <div className="bg-slate-100 bg-slate-200 bg-slate-300" />;\n',
    "dist/bundle.html": '<div class="bg-gray-500"></div>\n',
    "src/Ok.tsx": 'export const Ok = () => <div className="bg-surface" />;\n'
  });
  assert.deepEqual(run(root, ["tokens"]).lines.slice(1), []);
});
