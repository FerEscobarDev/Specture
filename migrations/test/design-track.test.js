const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");

const { makeProject, contextFor, snapshot, cleanup } = require("./helpers.test");
const catalog = require("../index");

const migration = Object.fromEntries(catalog.map((m) => [m.id, m]))["2.0-brand-brief"];
const REQUIREMENTS = "docs/01-requirements/business_requirements.md";
const FRONTEND = 'project:\n  name: "Mi App"\nfrontend:\n  framework: "react"\n';
const NO_FRONTEND = 'project:\n  name: "Mi API"\nfrontend:\n  framework: "none"\n';
const UNFILLED = 'project:\n  name: "Mi App"\nfrontend:\n  framework: "[e.g. react | angular | none]"\n';

afterEach(cleanup);

function detect(stack, requirements) {
  const files = { ".specture/stack.yml": stack };
  if (requirements !== null) files[REQUIREMENTS] = requirements;
  return migration.detect(contextFor(makeProject(files)));
}

test("2.0-brand-brief is pending only for a frontend project whose requirements lack the section", () => {
  assert.equal(detect(FRONTEND, "# Req\n\n## Reglas de Negocio\n- **RN-001:** x\n"), "pending");
});

test("2.0-brand-brief is done once the section exists", () => {
  assert.equal(detect(FRONTEND, "# Req\n\n## Identidad de Marca\n- **MK-001 — Marca preexistente:** ninguna\n"), "done");
  assert.equal(migration.verify(contextFor(makeProject({ ".specture/stack.yml": FRONTEND, [REQUIREMENTS]: "## Identidad de Marca\n- x\n" }))), true);
});

test("2.0-brand-brief is n/a without a frontend, without requirements, or on an unfilled stack template", () => {
  assert.equal(detect(NO_FRONTEND, "# Req\n\n## Reglas de Negocio\n- **RN-001:** x\n"), "n/a", "backend-only project");
  assert.equal(detect(FRONTEND, null), "n/a", "no requirements document yet");
  assert.equal(detect(UNFILLED, "# Req\n"), "n/a", "`[e.g. …]` placeholder is not a frontend");
});

// ---------------------------------------------------------------------------------------

const layers = Object.fromEntries(catalog.map((m) => [m.id, m]))["2.0-design-system-layers"];
const DESIGN_SYSTEM = "docs/03-ux-ui/design_system.md";

test("2.0-design-system-layers is pending on a single-layer design system", () => {
  const ctx = contextFor(makeProject({ [DESIGN_SYSTEM]: "## Tokens\n| `color.primary.500` | #0D9488 |\n| `color.neutral.900` | #0F172A |\n" }));
  assert.equal(layers.detect(ctx), "pending");
});

test("2.0-design-system-layers is done once a semantic role is named", () => {
  const ctx = contextFor(makeProject({ [DESIGN_SYSTEM]: "| `color.bg.surface` | `neutral.0` | `neutral.900` |\n" }));
  assert.equal(layers.detect(ctx), "done");
  assert.equal(layers.verify(ctx), true);
});

test("2.0-design-system-layers is n/a without a design system", () => {
  assert.equal(layers.detect(contextFor(makeProject({}))), "n/a");
});

// ---------------------------------------------------------------------------------------
// 2.0-design-channel
// ---------------------------------------------------------------------------------------

const byId = Object.fromEntries(catalog.map((m) => [m.id, m]));
const channel = byId["2.0-design-channel"];
const spine = byId["2.0-design-spine"];
const STACK = ".specture/stack.yml";
const FRONT = 'project:\n  name: "App"\nfrontend:\n  framework: "react"\n  ui_defined: false\napi:\n  style: "rest"\n';

function applied(files) {
  const root = makeProject(files);
  channel.apply(contextFor(root));
  return contextFor(root).read(STACK);
}

test("2.0-design-channel detects claude-design from .design-sync/config.json, with its projectId", () => {
  const stack = applied({ [STACK]: FRONT, ".design-sync/config.json": JSON.stringify({ projectId: "ds_abc123" }) });
  assert.match(stack, /design_channel: "claude-design"/);
  assert.match(stack, /design_project_id: "ds_abc123"/);
});

test("2.0-design-channel detects claude-design from the mirror README, and canvas from a .dc.html", () => {
  assert.match(applied({ [STACK]: FRONT, "docs/03-ux-ui/handoff/README.md": "Espejo del proyecto claude.ai/design traído vía DesignSync.\n" }), /design_channel: "claude-design"/);
  assert.match(applied({ [STACK]: FRONT, "docs/03-ux-ui/Splity Design.dc.html": "<html></html>" }), /design_channel: "canvas"/);
  assert.match(applied({ [STACK]: FRONT }), /design_channel: "none"/);
});

test("2.0-design-channel is n/a without a frontend and idempotent once declared", () => {
  const noFront = makeProject({ [STACK]: 'project:\n  name: "API"\nfrontend:\n  framework: "none"\n' });
  assert.equal(channel.detect(contextFor(noFront)), "n/a");

  const root = makeProject({ [STACK]: FRONT });
  assert.equal(channel.detect(contextFor(root)), "pending");
  channel.apply(contextFor(root));
  assert.equal(channel.verify(contextFor(root)), true);
  assert.equal(channel.detect(contextFor(root)), "done");
  const once = contextFor(root).read(STACK);
  channel.apply(contextFor(root));
  assert.equal(contextFor(root).read(STACK), once, "idempotente");
});

// ---------------------------------------------------------------------------------------
// 2.0-design-spine
// ---------------------------------------------------------------------------------------

const MIRROR_PROJECT = {
  [STACK]: FRONT,
  "docs/03-ux-ui/handoff/README.md": "Espejo parcial del proyecto claude.ai/design.\n",
  "docs/03-ux-ui/handoff/components/domain/CupoProgress.reference.md": "## Anatomía\n- barra con `--color-menta`\n",
  "docs/03-ux-ui/handoff/components/forms/FranjaEditor.reference.md": "## Props\n| `value` | `string` |\n",
  "docs/03-ux-ui/design_system.md": "Ver `docs/03-ux-ui/handoff/components/domain/CupoProgress.reference.md` y el mapeo en `docs/03-ux-ui/handoff-mapping.md`.\n",
  "docs/03-ux-ui/handoff-mapping.md": "| pantalla | ruta |\n"
};

test("2.0-design-spine moves each component doc, preserving its tier and marking it measured", () => {
  const root = makeProject(MIRROR_PROJECT);
  assert.equal(spine.detect(contextFor(root)), "pending");
  spine.apply(contextFor(root));
  const ctx = contextFor(root);

  const cupo = ctx.read("docs/03-ux-ui/components/CupoProgress.md");
  assert.match(cupo, /\*\*Nivel:\*\* domain/);
  assert.match(cupo, /Procedencia:\*\* `medido del DOM`/, "lo que impide que un pull del canal lo pise");
  assert.match(cupo, /barra con `--color-menta`/, "el contenido original se conserva");
  // `forms` is a UI category, not a tier: the migration records the origin and leaves the
  // decision to a human rather than writing a guess that then looks authored.
  assert.match(ctx.read("docs/03-ux-ui/components/FranjaEditor.md"), /categoría de origen: `forms`/);
});

test("2.0-design-spine rewrites every citation — sin esto el corpus lint emite un ERROR por cita", () => {
  const root = makeProject(MIRROR_PROJECT);
  spine.apply(contextFor(root));
  const ds = contextFor(root).read("docs/03-ux-ui/design_system.md");
  assert.match(ds, /docs\/03-ux-ui\/components\/CupoProgress\.md/);
  assert.ok(!ds.includes("handoff/components"), ds);
  assert.match(ds, /design_system\.md §3 \(inventario\)/, "el mapeo apunta al inventario");
});

test("2.0-design-spine names the scaffolding to remove and verifies, then is idempotent", () => {
  const root = makeProject(MIRROR_PROJECT);
  const result = spine.apply(contextFor(root));
  assert.ok(result.notes.some((n) => /git rm -r/.test(n)), result.notes.join(" | "));
  assert.equal(spine.verify(contextFor(root)), true);
  assert.equal(spine.detect(contextFor(root)), "done");
  const before = snapshot(root);
  spine.apply(contextFor(root));
  assert.deepEqual(snapshot(root), before, "idempotente");
});

test("2.0-design-spine is n/a on a project with no mirror", () => {
  assert.equal(spine.detect(contextFor(makeProject({ [STACK]: FRONT }))), "n/a");
});
