const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const doctorPath = path.join(root, "scripts", "doctor.js");
const pluginVersion = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8")).version;
const temporaryDirectories = [];

function write(projectRoot, rel, text) {
  const abs = path.join(projectRoot, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function createProject(files) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-doctor-"));
  temporaryDirectories.push(projectRoot);
  for (const [rel, text] of Object.entries(files)) write(projectRoot, rel, text);
  return projectRoot;
}

function runDoctor(projectRoot, ...extra) {
  const result = spawnSync(process.execPath, [doctorPath, "check", "--project", projectRoot, "--json", ...extra], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json: result.stdout ? JSON.parse(result.stdout) : null };
}

// `rules.yml` exactly as the template installs it — since v2.0.0 that includes the
// mandatory `framework-core` rules, so a CLEAN project is core-conformant by construction.
const TEMPLATE_RULES = fs.readFileSync(path.join(__dirname, "..", "..", "templates", "project-config", "rules.template.yml"), "utf8").replace(/\r\n/g, "\n");

// A project exactly as `setup` leaves it at the installed plugin version: no migration pending.
const CLEAN = {
  ".gitignore": ".specture/state/\ndocs/.specture-meta/*\n!docs/.specture-meta/build-metrics.jsonl\n!docs/.specture-meta/design-metrics.jsonl\n",
  ".specture/stack.yml": 'project:\n  name: "Demo"\n  slug: "demo"\napi:\n  style: "rest"\n  contract_file: "docs/02-architecture/api-contract.openapi.yaml"\nstructure:\n  root_layout: custom\n',
  ".specture/settings.yml": `schema_version: ${pluginVersion}\nprofile: custom\nhooks.enabled: true\n`,
  ".specture/conventions.md": "# Convenciones\n\n## 10. Specture\n\n> ver settings.yml\n\n## 12. Invariantes del Proyecto (R-*)\n\n> ver .specture/rules.yml\n\n## 13. Workflow / Proceso (W-*)\n\n- W-3: Conventional Commits\n",
  ".specture/rules.yml": TEMPLATE_RULES,
  ".specture/decisions/001-initial-stack.md": "# ADR-001\n\n## Status\n\nAccepted\n",
  "docs/04-roadmap/ROADMAP.md": "# ROADMAP\n\n### Milestone 1: Foundation\n\n- [ ] **Epic 1.1:** Scaffold\n  - **Dependencias:** Ninguna\n"
};

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("a clean project in sync with the plugin has no findings and exits 0", () => {
  const projectRoot = createProject(CLEAN);
  const { status, json, stderr } = runDoctor(projectRoot);

  assert.equal(status, 0, stderr);
  assert.deepEqual(json.findings, []);
  assert.equal(json.settingsSource, "settings.yml");
});

test("reports broken paths, placeholders, duplicate ADRs, missing statuses, stale seal and missing _current", () => {
  const projectRoot = createProject({
    ...CLEAN,
    ".specture/decisions/012-http-conventions.md": "# ADR-012\n\n## Status\n\nAccepted\n",
    ".specture/decisions/012-response-contract.md": "# ADR-012 bis\n\nno status here\n",
    ".specture/state/build-locked.json": JSON.stringify({ epic: "epic-1.1", red_sha: "abc", test_paths: ["tests/**/*.test.js"] }),
    "docs/04-roadmap/ROADMAP.md": "# ROADMAP\n\n### Milestone 1: Foundation\n\n- [x] **Epic 1.1:** Scaffold — spec `docs/05-specs/epic-1.1/01-...spec.md`\n  - **Dependencias:** Ninguna\n",
    "docs/02-architecture/architecture.md": "# Arquitectura\n\nVer `docs/02-architecture/api-contract.md` y `docs/02-architecture/nope.md`.\n",
    "docs/07-reviews/review-epic-1.1-01-2026-01-01.md": "# Review\n\nno verdict block\n",
    "docs/05-specs/epic-1.1/01-scaffold.spec.md": "# SPEC\n\nno ids at all\n",
    ".claude/worktrees/agent-x/file.txt": "leftover"
  });
  const { status, json } = runDoctor(projectRoot);
  const checks = json.findings.map((f) => f.check);

  assert.equal(status, 1);
  assert.ok(checks.includes("broken-path"), "broken-path");
  assert.ok(checks.includes("placeholder-path"), "placeholder-path");
  assert.ok(checks.includes("adr-duplicate"), "adr-duplicate");
  assert.ok(checks.includes("adr-status"), "adr-status");
  assert.ok(checks.includes("review-status"), "review-status");
  assert.ok(checks.includes("spec-ids"), "spec-ids");
  assert.ok(checks.includes("seal-stale"), "seal-stale");
  assert.ok(checks.includes("current-state-missing"), "current-state-missing");
  assert.ok(checks.includes("worktree-residue"), "worktree-residue");

  const broken = json.findings.filter((f) => f.check === "broken-path").map((f) => f.detail);
  assert.ok(broken.some((d) => d.includes("docs/02-architecture/nope.md")));
  assert.ok(broken.some((d) => d.includes("docs/02-architecture/api-contract.md")));
});

test("historical documents (reviews, debug logs, closed specs) are not linted for broken paths", () => {
  const projectRoot = createProject({
    ...CLEAN,
    "docs/07-reviews/review-old.md": "STATUS: APPROVED\n\nSee `docs/05-specs/gone/01-x.spec.md`.\n",
    "docs/06-debug-logs/2026-01-01-x.md": "See `docs/05-specs/gone/02-x.spec.md`.\n",
    "docs/05-specs/epic-0.1/01-x.spec.md": "AC-1 see `docs/02-architecture/missing.md`\n"
  });
  const { json } = runDoctor(projectRoot);

  assert.equal(json.findings.filter((f) => f.check === "broken-path").length, 0);
});

test("a seal whose epic is [/] is accepted; a project without settings.yml is reported from conventions", () => {
  const projectRoot = createProject({
    ...CLEAN,
    ".specture/state/build-locked.json": JSON.stringify({ epic: "epic-1.1", test_paths: ["tests/**"] }),
    "docs/04-roadmap/ROADMAP.md": "### Milestone 1: Foundation\n\n- [/] **Epic 1.1:** Scaffold\n"
  });
  fs.rmSync(path.join(projectRoot, ".specture", "settings.yml"));
  write(projectRoot, ".specture/conventions.md", "## 10. Specture\n\n- **hooks.enabled**: true\n");
  const { json } = runDoctor(projectRoot);

  assert.equal(json.settingsSource, "conventions.md");
  assert.equal(json.findings.filter((f) => f.check.startsWith("seal-")).length, 0);
});

test("a milestone whose title merely contains 'archivador' is not a tombstone; 'archivado <fecha>' is", () => {
  const { parseRoadmap } = require("../lib/doctor/project");
  const open = parseRoadmap("### Milestone 1: Núcleo del archivador\n\n- [ ] **Epic 1.1:** Archivos\n");
  assert.equal(open.milestones[0].tombstone, false);
  assert.equal(open.milestones[0].closed, false);
  const tomb = parseRoadmap("### Milestone 3: Billing  ✅ archivado 2026-08-01 · verdad viva → docs/05-specs/_current/billing.md\n- [x] Epic 3.1, Epic 3.2\n");
  assert.equal(tomb.milestones[0].tombstone, true);
  const plain = parseRoadmap("### Milestone 2: Reportes archivados\n- [ ] **Epic 2.1:** A\n");
  assert.equal(plain.milestones[0].tombstone, true, "the word form still counts (heading text is the marker the template prescribes)");

  const projectRoot = createProject({ ...CLEAN, "docs/04-roadmap/ROADMAP.md": "# ROADMAP\n\n### Milestone 1: Núcleo del archivador\n\n- [ ] **Epic 1.1:** Archivos\n  - **Dependencias:** Ninguna\n" });
  const { json } = runDoctor(projectRoot);
  assert.ok(!json.findings.some((f) => f.check === "current-state-missing"), JSON.stringify(json.findings));
});

test("a v3 seal (spec_sha/spec_paths/allowed_paths, no specs[]) is accepted while its epic is [/] and reported stale afterwards", () => {
  const V3 = JSON.stringify({
    epic: "epic-1.1-scaffold",
    sealed_at: "2026-09-07T10:00:00Z",
    spec_sha: "abc1234",
    spec_paths: ["docs/05-specs/epic-1.1-scaffold/*.spec.md"],
    test_globs: ["tests/**/*.test.js", "tests/**"],
    allowed_paths: ["src/scaffold/"],
    supersede_paths: [],
    specs: []
  });
  const inProgress = createProject({ ...CLEAN, ".specture/state/build-locked.json": V3, "docs/04-roadmap/ROADMAP.md": "### Milestone 1: Foundation\n\n- [/] **Epic 1.1:** Scaffold\n" });
  assert.deepEqual(runDoctor(inProgress).json.findings.filter((f) => f.check.startsWith("seal-")), []);

  const otherEpic = createProject({ ...CLEAN, ".specture/state/build-locked.json": V3, "docs/04-roadmap/ROADMAP.md": "### Milestone 1: Foundation\n\n- [x] **Epic 1.1:** Scaffold\n- [/] **Epic 1.2:** Notas\n" });
  const mismatch = runDoctor(otherEpic).json.findings.find((f) => f.check === "seal-mismatch");
  assert.ok(mismatch, "a seal for epic 1.1 while epic 1.2 is [/] is a mismatch");
  assert.match(mismatch.action, /seal-cli\.js show/);

  const closed = createProject({ ...CLEAN, ".specture/state/build-locked.json": V3, "docs/04-roadmap/ROADMAP.md": "### Milestone 1: Foundation\n\n- [x] **Epic 1.1:** Scaffold\n" });
  const { status, json } = runDoctor(closed);
  const stale = json.findings.find((f) => f.check === "seal-stale");
  assert.equal(status, 1);
  assert.ok(stale, JSON.stringify(json.findings));
  assert.match(stale.detail, /sealed tests, specs and allowed paths/);
  assert.match(stale.action, /seal-cli\.js.*release/);
});

test("--brief prints a one-line summary", () => {
  const projectRoot = createProject(CLEAN);
  const result = spawnSync(process.execPath, [doctorPath, "check", "--project", projectRoot, "--brief"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^doctor: 0 ERROR, 0 WARNING · schema \d+\.\d+\.\d+ → plugin \d+\.\d+\.\d+ · pending migrations: 0/);
});

test("refuses a directory that is not a Specture project", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "not-specture-"));
  temporaryDirectories.push(dir);
  const result = spawnSync(process.execPath, [doctorPath, "check", "--project", dir], { encoding: "utf8" });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a Specture project/);
});

test("reports requirements findings: placeholders, missing Exposición, boundary coverage and rule IDs", () => {
  const projectRoot = createProject({
    ...CLEAN,
    "docs/01-requirements/business_requirements.md": [
      "# Requerimientos",
      "",
      "## Historias de Usuario",
      "",
      "- **HU-PAGO-001:** Cobrar suscripción · Actor: Admin · Exposición: `UI`",
      "- **HU-PAGO-002:** Reintentar cobro · Actor: Sistema",
      "",
      "## Capacidades de Frontera",
      "",
      "- Ninguna",
      "",
      "## Reglas de Negocio",
      "",
      "- Un usuario no puede tener dos suscripciones activas (TBD)",
      "",
      "## Casos Límite",
      "",
      "- **CL-001:** Pago falla a la mitad → reintentar",
      "",
      "## Fuera de Alcance",
      "",
      "- Facturación electrónica",
      ""
    ].join("\n")
  });
  const { status, json } = runDoctor(projectRoot);
  const checks = json.findings.map((f) => f.check);

  assert.equal(status, 1, "unresolved placeholder is an ERROR");
  assert.ok(checks.includes("req-placeholder"), "req-placeholder");
  assert.ok(checks.includes("req-hu-exposicion"), "req-hu-exposicion (HU-PAGO-002)");
  assert.ok(checks.includes("req-boundary-coverage"), "req-boundary-coverage (HU-PAGO-001 not consolidated)");
  const ruleFindings = json.findings.filter((f) => f.check === "req-rule-ids");
  assert.equal(ruleFindings.length, 2, "Reglas + Fuera de Alcance lack IDs; Casos Límite has CL-001");
});

test("a business_requirements.md following the template produces no requirements findings", () => {
  const projectRoot = createProject({
    ...CLEAN,
    "docs/01-requirements/business_requirements.md": [
      "# Requerimientos",
      "",
      "## Historias de Usuario",
      "",
      "- **HU-PAGO-001:** Cobrar suscripción · Actor: Admin · Exposición: `UI`",
      "- **HU-PAGO-002:** Reintentar cobro · Actor: Sistema · Exposición: `Interna`",
      "",
      "## Capacidades de Frontera",
      "",
      "- **HU-PAGO-001** — consumidor: Admin — cobro de suscripción",
      "",
      "## Reglas de Negocio",
      "",
      "- **RN-001:** Un usuario no puede tener dos suscripciones activas",
      "",
      "## Casos Límite",
      "",
      "- **CL-001:** Pago falla a la mitad → reintentar",
      "",
      "## Fuera de Alcance",
      "",
      "- **FA-001:** Facturación electrónica",
      ""
    ].join("\n")
  });
  const { json } = runDoctor(projectRoot);

  assert.deepEqual(json.findings.filter((f) => f.group === "requirements"), []);
});

test("current-state-partial: a component with [x] specs and no _current/<slug>.md is reported with the reconcile command", () => {
  const files = {
    ...CLEAN,
    "docs/02-architecture/architecture.md": "# Arquitectura\n\n## Componentes\n\n### Archivos\n- **Carpeta raíz:** `demo_api/`\n\n### Notas\n- **Carpeta raíz:** `demo_api/`\n",
    "docs/04-roadmap/ROADMAP.md": "# ROADMAP\n\n### Milestone 1: Foundation\n\n- [x] **Epic 1.1:** Archivos\n  - **Dependencias:** Ninguna\n  - **Componentes de arquitectura involucrados:** Archivos\n- [x] **Epic 1.2:** Notas\n  - **Dependencias:** Ninguna\n  - **Componentes de arquitectura involucrados:** Notas\n",
    "docs/05-specs/epic-1.1-archivos/01-subir.spec.md": "# SPEC: Subir\n\n**Epic:** Epic 1.1 Archivos   **Módulo:** Archivos (`demo_api/src/archivos/`)\n\n## Criterios de Aceptación (≥1 test por ID)\n- **AC-1:** sube\n",
    "docs/05-specs/epic-1.2-notas/01-crear.spec.md": "# SPEC: Crear\n\n**Epic:** Epic 1.2 Notas   **Módulo:** Notas (`demo_api/src/notas/`)\n\n## Criterios de Aceptación (≥1 test por ID)\n- **AC-1:** crea\n"
  };
  const withoutDir = createProject(files);
  const missing = runDoctor(withoutDir).json.findings.find((f) => f.check === "current-state-missing");
  assert.ok(missing, "closed milestone without the directory");
  assert.match(missing.action, /knowledge reconcile --component archivos, notas/);

  const partial = createProject({ ...files, "docs/05-specs/_current/notas.md": "# Estado actual — Notas\n\n> - **Confianza:** spec_reconciled\n" });
  const { json } = runDoctor(partial);
  assert.ok(!json.findings.some((f) => f.check === "current-state-missing"));
  const partials = json.findings.filter((f) => f.check === "current-state-partial");
  assert.equal(partials.length, 1, JSON.stringify(json.findings));
  assert.equal(partials[0].file, "docs/05-specs/_current/archivos.md");
  assert.equal(partials[0].severity, "WARNING");
  assert.match(partials[0].detail, /"Archivos" has 1 \[x\] spec\(s\)/);
  assert.match(partials[0].action, /knowledge reconcile --component archivos/);

  const complete = createProject({ ...files, "docs/05-specs/_current/notas.md": "# Notas\n", "docs/05-specs/_current/archivos.md": "# Archivos\n" });
  assert.ok(!runDoctor(complete).json.findings.some((f) => f.check.startsWith("current-state")));
});

test("rules lint: schema errors and over-long rules in rules.yml, over-long deny-list items in conventions §4", () => {
  const conventions = [
    "# Convenciones",
    "",
    "## 4. Patrones Prohibidos (Deny-list)",
    "",
    "- Repositorios genéricos `Repository<T>`",
    "- Singletons mutables porque en 2024",
    "  tuvimos un bug en el módulo de pagos",
    "  que tardó tres días en diagnosticarse",
    "",
    "## 10. Specture",
    "",
    "> ver settings.yml",
    "",
    "## 12. Invariantes del Proyecto (R-*)",
    "",
    "> ver .specture/rules.yml",
    "",
    "## 13. Workflow / Proceso (W-*)",
    "",
    "- W-3: Conventional Commits",
    ""
  ].join("\n");
  const projectRoot = createProject({
    ...CLEAN,
    ".specture/conventions.md": conventions,
    ".specture/rules.yml": ["schema: 1", "rules:", "  - id: R-1", "    tags: [dto]", `    rule: "${"x".repeat(300)}"`, "    severity: BLOCKER", "  - id: R-1", "    tags: [naming]", '    rule: "corta"', "    severity: MAYBE", ""].join("\n")
  });
  const { status, json } = runDoctor(projectRoot);
  const rules = json.findings.filter((f) => f.group === "rules");

  assert.equal(status, 1, "schema errors are ERROR");
  const lengths = rules.filter((f) => f.check === "rule-length");
  assert.equal(lengths.length, 2, JSON.stringify(rules));
  assert.ok(lengths.some((f) => f.file === ".specture/rules.yml" && /R-1: rule is 300 characters/.test(f.detail) && /\(line 3\)/.test(f.detail)));
  assert.ok(lengths.some((f) => f.file === ".specture/conventions.md" && /Singletons mutables/.test(f.detail) && /spans 3 lines/.test(f.detail)));
  assert.ok(lengths.every((f) => f.severity === "WARNING"));
  const schema = rules.filter((f) => f.check === "rules-schema");
  assert.equal(schema.length, 2, JSON.stringify(schema));
  assert.ok(schema.some((f) => /duplicate id/.test(f.detail)));
  assert.ok(schema.some((f) => /severity must be/.test(f.detail)));
  assert.ok(schema.every((f) => f.severity === "ERROR"));

  const broken = createProject({ ...CLEAN, ".specture/rules.yml": "schema: 1\nrules:\n  - id: R-1\n    rule: |\n      multi\n" });
  const parse = runDoctor(broken).json.findings.find((f) => f.check === "rules-schema");
  assert.ok(parse, "unparseable file is reported");
  assert.match(parse.detail, /does not parse: multi-line values are not supported.*\(line 4\)/);

  const clean = createProject({ ...CLEAN, ".specture/rules.yml": TEMPLATE_RULES + '  - id: R-1\n    tags: [dto]\n    rule: "Los DTOs son inmutables"\n    severity: BLOCKER\n' });
  assert.deepEqual(runDoctor(clean).json.findings.filter((f) => f.group === "rules"), []);
});

test("flags off-template spec sections with a suggested destination; template sections pass", () => {
  const projectRoot = createProject({
    ...CLEAN,
    "docs/05-specs/epic-1.1/01-scaffold.spec.md": [
      "# SPEC: Scaffold",
      "",
      "## Objetivo",
      "algo",
      "",
      "## Criterios de Aceptación (≥1 test por ID)",
      "- **AC-1:** pasa",
      "",
      "## Guards de no-regresión (nacen verdes)",
      "- **GUARD-1:** x → test: `t.spec.js::y`",
      "",
      "## Aclaraciones (resueltas en planificación)",
      "- Q-1: ver _planning.md",
      "",
      "## Supersesiones de tests sellados (omitir si no aplica)",
      "- Supersede: `tests/old.test.js::t` — motivo: BR-1 — epic origen: epic-0.9",
      "",
      "## 🔴 Decisión de usuario",
      "- elegir A o B",
      "",
      "## Deuda que NO salda",
      "- deuda X",
      "",
      "## 🔴 Supersesión de tests sellados (bitácora)",
      "- se cambió el test X porque sí",
      ""
    ].join("\n")
  });
  const { json } = runDoctor(projectRoot);
  const sections = json.findings.filter((f) => f.check === "spec-section");

  assert.equal(sections.length, 3, JSON.stringify(sections));
  assert.ok(sections.some((f) => f.detail.includes("Decisión de usuario") && f.action.includes("_planning.md")));
  assert.ok(sections.some((f) => f.detail.includes("Deuda") && f.action.includes("ROADMAP")));
  assert.ok(sections.some((f) => f.detail.includes("bitácora") && f.action.includes("Supersede:") && f.action.includes("Supersesiones de tests sellados")));
  assert.ok(!sections.some((f) => f.detail.includes("omitir si no aplica")), "the template's own supersession section is canonical");
});
