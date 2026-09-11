const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const { makeProject, contextFor, snapshot, cleanup } = require("./helpers.test");
const catalog = require("../index");
const { parseRulesYaml, lintCore, CORE_RULES } = require("../../hooks/lib/rules");

const byId = Object.fromEntries(catalog.map((m) => [m.id, m]));
const core = byId["1.20-rules-core"];
const fileOrg = byId["1.20-file-org-conventions"];

const STACK = 'project:\n  name: "Demo"\n  slug: "demo"\n';
const RULES = ".specture/rules.yml";
const CONVENTIONS = ".specture/conventions.md";
const CONV_MIN = "# Convenciones\n\n## 1. Naming\n\n- x\n";

const OWN =
  "# Reglas del proyecto\n" +
  "# Un comentario que el equipo escribió a mano.\n" +
  "\n" +
  "schema: 1\n" +
  "rules:\n" +
  "  - id: R-1\n" +
  "    tags: [backend, api]\n" +
  '    rule: "Toda operación HTTP identifica al empleado por el header X-Employee-Id"\n' +
  "    severity: BLOCKER\n" +
  '    source: "ADR-004"\n' +
  "\n" +
  "# Y un comentario al final.\n";

const readRules = (root) => fs.readFileSync(path.join(root, ".specture", "rules.yml"), "utf8");
const ids = (text) => parseRulesYaml(text).rules.map((r) => r.id);

afterEach(cleanup);

// --- 1.20-rules-core ---------------------------------------------------------------------

test("1.20-rules-core is pending on a rules.yml written before the core existed", () => {
  const ctx = contextFor(makeProject({ ".specture/stack.yml": STACK, [RULES]: OWN, [CONVENTIONS]: CONV_MIN }));
  assert.equal(core.detect(ctx), "pending");
});

test("1.20-rules-core restores what is missing and leaves the project's own file alone", () => {
  const root = makeProject({ ".specture/stack.yml": STACK, [RULES]: OWN, [CONVENTIONS]: CONV_MIN });
  const result = core.apply(contextFor(root));
  const text = readRules(root);

  assert.deepEqual(lintCore(parseRulesYaml(text).rules), [], "conformant after applying");
  assert.deepEqual(ids(text), ["R-1", ...CORE_RULES.map((r) => r.id)], "the project's rule keeps its place; the core is appended");
  assert.ok(text.includes("# Un comentario que el equipo escribió a mano."), "comments survive");
  assert.ok(text.includes("# Y un comentario al final."), "including the trailing one");
  assert.ok(text.includes('rule: "Toda operación HTTP identifica al empleado por el header X-Employee-Id"'), "R-1 untouched");
  assert.ok(result.notes.some((n) => /4 `framework-core` rule\(s\) restored/.test(n)));

  assert.equal(core.verify(contextFor(root)), true);
  assert.equal(core.detect(contextFor(root)), "done");
  const before = snapshot(root);
  core.apply(contextFor(root));
  assert.deepEqual(snapshot(root), before, "idempotent");
});

test("1.20-rules-core raises a weakened severity back to its floor and says so", () => {
  const weakened = OWN.replace("rules:\n", "rules:\n  - id: R-FILE-001\n    tags: [frontend]\n    rule: \"Un componente por archivo\"\n    severity: IMPORTANT\n    source: \"framework-core\"\n");
  const root = makeProject({ ".specture/stack.yml": STACK, [RULES]: weakened, [CONVENTIONS]: CONV_MIN });
  const result = core.apply(contextFor(root));
  const text = readRules(root);

  assert.deepEqual(lintCore(parseRulesYaml(text).rules), []);
  const restored = parseRulesYaml(text).rules.find((r) => r.id === "R-FILE-001");
  assert.equal(restored.severity, "BLOCKER", "raised to the floor");
  assert.equal(restored.rule, "Un componente por archivo", "the project's own wording is NOT rewritten");
  assert.deepEqual(restored.tags, ["frontend"], "nor its tags");
  assert.ok(result.notes.some((n) => /raised back to their floor: R-FILE-001 → BLOCKER/.test(n)));
  assert.equal((text.match(/R-FILE-001/g) || []).length, 1, "raised in place, not duplicated");
});

test("1.20-rules-core does not weaken a core rule the project tightened", () => {
  const hardened = OWN.replace("rules:\n", "rules:\n  - id: R-SOLID-001\n    tags: [all]\n    rule: \"SOLID, y lo tomamos en serio\"\n    severity: BLOCKER\n    source: \"framework-core\"\n");
  const root = makeProject({ ".specture/stack.yml": STACK, [RULES]: hardened, [CONVENTIONS]: CONV_MIN });
  core.apply(contextFor(root));
  const solid = parseRulesYaml(readRules(root)).rules.find((r) => r.id === "R-SOLID-001");
  assert.equal(solid.severity, "BLOCKER", "IMPORTANT is a floor, not a ceiling");
  assert.equal(solid.rule, "SOLID, y lo tomamos en serio");
});

test("1.20-rules-core converts the legacy `rules: []` placeholder instead of writing broken YAML", () => {
  const root = makeProject({ ".specture/stack.yml": STACK, [RULES]: "schema: 1\nrules: []\n", [CONVENTIONS]: CONV_MIN });
  core.apply(contextFor(root));
  const text = readRules(root);
  assert.ok(!/rules:\s*\[\s*\]/.test(text), "the empty placeholder is gone");
  assert.deepEqual(ids(text), CORE_RULES.map((r) => r.id));
  assert.deepEqual(lintCore(parseRulesYaml(text).rules), []);
});

test("1.20-rules-core keeps the file's CRLF", () => {
  const root = makeProject({ ".specture/stack.yml": STACK, [RULES]: OWN.replace(/\n/g, "\r\n"), [CONVENTIONS]: CONV_MIN });
  core.apply(contextFor(root));
  const text = readRules(root);
  assert.ok(!/[^\r]\n/.test(text), "no bare LF slipped in");
  assert.deepEqual(lintCore(parseRulesYaml(text).rules), []);
});

test("1.20-rules-core is n/a when 1.19-rules-file will create the file, and when the file is broken", () => {
  assert.equal(core.detect(contextFor(makeProject({ ".specture/stack.yml": STACK, [CONVENTIONS]: CONV_MIN }))), "n/a", "no rules.yml but conventions.md exists → 1.19 owns it");
  assert.equal(core.detect(contextFor(makeProject({ ".specture/stack.yml": STACK, [RULES]: "schema: 1\nrules:\n  - id: R-1\n    rule: |\n      multi\n", [CONVENTIONS]: CONV_MIN }))), "n/a", "unparseable → the doctor reports rules-schema, we do not rewrite it");
  assert.equal(core.detect(contextFor(makeProject({ [RULES]: OWN }))), "n/a", "not a Specture project");
});

test("1.20-rules-core creates the file when there is no conventions.md for 1.19 to read", () => {
  const root = makeProject({ ".specture/stack.yml": STACK });
  assert.equal(core.detect(contextFor(root)), "pending");
  const result = core.apply(contextFor(root));
  assert.deepEqual(lintCore(parseRulesYaml(readRules(root)).rules), []);
  assert.ok(result.notes.some((n) => /created from the template/.test(n)));
  assert.equal(core.detect(contextFor(root)), "done");
});

test("a project set up from the templates is born conformant — 1.20-rules-core never fires", () => {
  const template = fs.readFileSync(path.join(__dirname, "..", "..", "templates", "project-config", "rules.template.yml"), "utf8");
  const root = makeProject({ ".specture/stack.yml": STACK, [RULES]: template, [CONVENTIONS]: CONV_MIN });
  assert.equal(core.detect(contextFor(root)), "done");
});

// --- 1.20-file-org-conventions -----------------------------------------------------------

const CONV_NO_MAP = "# Convenciones\n\n## 1. Naming\n\n- camelCase\n\n## 2. Organización de Archivos\n\n- **Estructura por:** feature\n\n## 3. Patrones Permitidos\n\n- x\n";

test("1.20-file-org-conventions is pending while §2 declares no location map", () => {
  assert.equal(fileOrg.detect(contextFor(makeProject({ [CONVENTIONS]: CONV_NO_MAP }))), "pending");
});

test("1.20-file-org-conventions is done once the map heading is in §2", () => {
  const withMap = CONV_NO_MAP.replace("- **Estructura por:** feature\n", "- **Estructura por:** feature\n\n### Mapa de ubicaciones\n\n| Qué | Dónde |\n|---|---|\n| Componentes | `src/components/<N>/<N>.tsx` |\n");
  const ctx = contextFor(makeProject({ [CONVENTIONS]: withMap }));
  assert.equal(fileOrg.detect(ctx), "done");
  assert.equal(fileOrg.verify(ctx), true);
});

test("1.20-file-org-conventions is n/a without conventions.md and without a §2", () => {
  assert.equal(fileOrg.detect(contextFor(makeProject({ ".specture/stack.yml": STACK }))), "n/a");
  assert.equal(fileOrg.detect(contextFor(makeProject({ [CONVENTIONS]: "# Convenciones\n\n## 1. Naming\n\n- x\n" }))), "n/a", "no §2 to extend");
});

test("1.20-file-org-conventions proposes from the folders it finds and never decides", () => {
  const root = makeProject({
    [CONVENTIONS]: CONV_NO_MAP,
    "src/components/Card/Card.tsx": "export const Card = () => null;\n",
    "src/hooks/useCard.ts": "export const useCard = () => null;\n",
    "src/types/card.ts": "export interface Card {}\n",
    "tests/card.test.ts": "test('x', () => {});\n"
  });
  const inputs = fileOrg.planInputs(contextFor(root));

  const slot = (name) => inputs.evidence.find((e) => e.slot === name).candidates;
  assert.deepEqual(slot("Componentes"), ["src/components"]);
  assert.deepEqual(slot("Hooks / composables"), ["src/hooks"]);
  assert.deepEqual(slot("Types e interfaces"), ["src/types"]);
  assert.deepEqual(slot("Tests"), ["tests"]);
  assert.deepEqual(slot("Constantes"), [], "nothing found stays empty — it is not guessed");

  assert.match(inputs.currentSection, /^## 2\. Organización de Archivos/);
  assert.match(inputs.templateSection, /### Mapa de ubicaciones/, "the skill gets the canonical table to fill in");
  assert.match(inputs.guidance, /never an answer/);
  assert.match(inputs.guidance, /sin definir/);
  assert.equal(fileOrg.verify(contextFor(root)), false, "planInputs writes nothing");
});
