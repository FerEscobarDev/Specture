const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");

const { makeProject, contextFor, cleanup } = require("./helpers.test");
const catalog = require("../index");

const migration = Object.fromEntries(catalog.map((m) => [m.id, m]))["1.20-brand-brief"];
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

test("1.20-brand-brief is pending only for a frontend project whose requirements lack the section", () => {
  assert.equal(detect(FRONTEND, "# Req\n\n## Reglas de Negocio\n- **RN-001:** x\n"), "pending");
});

test("1.20-brand-brief is done once the section exists", () => {
  assert.equal(detect(FRONTEND, "# Req\n\n## Identidad de Marca\n- **MK-001 — Marca preexistente:** ninguna\n"), "done");
  assert.equal(migration.verify(contextFor(makeProject({ ".specture/stack.yml": FRONTEND, [REQUIREMENTS]: "## Identidad de Marca\n- x\n" }))), true);
});

test("1.20-brand-brief is n/a without a frontend, without requirements, or on an unfilled stack template", () => {
  assert.equal(detect(NO_FRONTEND, "# Req\n\n## Reglas de Negocio\n- **RN-001:** x\n"), "n/a", "backend-only project");
  assert.equal(detect(FRONTEND, null), "n/a", "no requirements document yet");
  assert.equal(detect(UNFILLED, "# Req\n"), "n/a", "`[e.g. …]` placeholder is not a frontend");
});
