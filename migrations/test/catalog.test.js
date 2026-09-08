const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const { pluginVersion, makeProject, contextFor, snapshot, cleanup } = require("./helpers.test");
const catalog = require("../index");
const byId = Object.fromEntries(catalog.map((m) => [m.id, m]));

const STACK = 'project:\n  name: "Mi App"\napi:\n  style: "rest"\n  contract_file: "docs/02-architecture/api-contract.openapi.json"\nstructure:\n  root_layout: custom\n';
const CONTRACT = JSON.stringify({ openapi: "3.0.0", paths: { "/citas": { post: { operationId: "crearCita", summary: "Crear" } }, "/citas/{id}": { get: { operationId: "obtenerCita" } } } });

afterEach(cleanup);

test("catalog is ordered by `since`, ids are unique, every entry has the contract shape", () => {
  const ids = catalog.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (let i = 1; i < catalog.length; i++) {
    assert.ok(catalog[i - 1].since <= catalog[i].since || catalog[i - 1].since.localeCompare(catalog[i].since, undefined, { numeric: true }) <= 0);
  }
  for (const m of catalog) {
    assert.match(m.since, /^\d+\.\d+\.\d+$/, m.id);
    assert.ok(["mechanical", "assisted", "content"].includes(m.kind), m.id);
    assert.equal(typeof m.detect, "function", m.id);
    assert.equal(typeof m.verify, "function", m.id);
    if (m.kind === "mechanical") assert.equal(typeof m.apply, "function", m.id);
    if (m.kind === "assisted") assert.equal(typeof m.planInputs, "function", m.id);
    if (m.kind === "content") assert.ok(m.ownerSkill, m.id);
  }
});

// Runs the mechanical lifecycle: pending → apply → verify/done → apply again changes nothing.
function mechanicalLifecycle(id, files, extraAssert) {
  const migration = byId[id];
  const root = makeProject(files);
  assert.equal(migration.detect(contextFor(root)), "pending", `${id} should be pending`);
  migration.apply(contextFor(root));
  assert.equal(migration.verify(contextFor(root)), true, `${id} verify after apply`);
  assert.equal(migration.detect(contextFor(root)), "done", `${id} detect after apply`);
  const before = snapshot(root);
  migration.apply(contextFor(root));
  assert.deepEqual(snapshot(root), before, `${id} must be idempotent`);
  if (extraAssert) extraAssert(root);
}

test("1.2-state-gitignore adds the entry once", () => {
  mechanicalLifecycle("1.2-state-gitignore", { ".specture/stack.yml": STACK, ".gitignore": "node_modules/\n" }, (root) => {
    const text = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    assert.equal((text.match(/\.specture\/state\//g) || []).length, 1);
    assert.ok(text.startsWith("node_modules/\n"));
  });
  const done = makeProject({ ".specture/stack.yml": STACK, ".gitignore": ".specture/state\n" });
  assert.equal(byId["1.2-state-gitignore"].detect(contextFor(done)), "done", "trailing slash is optional");
});

test("1.7-meta-gitignore adds the entry and suggests git rm --cached when files exist", () => {
  mechanicalLifecycle("1.7-meta-gitignore", { ".specture/stack.yml": STACK, ".gitignore": ".specture/state/\n", "docs/.specture-meta/learn-history.jsonl": "{}\n" });
  const root = makeProject({ ".specture/stack.yml": STACK, "docs/.specture-meta/x.jsonl": "{}\n" });
  const result = byId["1.7-meta-gitignore"].apply(contextFor(root));
  assert.ok(result.notes.some((n) => n.includes("git rm --cached")));
});

test("1.8-drop-parallel-toggle removes toggle lines but not prose mentions", () => {
  mechanicalLifecycle(
    "1.8-drop-parallel-toggle",
    { ".specture/conventions.md": "## 10. Specture\n\n- **hooks.enabled**: true\n- **build.max_parallel_epics**: 3\n\n> Retirado — build.max_parallel_epics: 3 ya no se lee.\n" },
    (root) => {
      const text = fs.readFileSync(path.join(root, ".specture", "conventions.md"), "utf8");
      assert.ok(!/^\s*-\s*\*\*build\.max_parallel_epics/m.test(text));
      assert.ok(text.includes("> Retirado — build.max_parallel_epics"), "prose survives");
      assert.ok(text.includes("- **hooks.enabled**: true"));
    }
  );
});

test("1.9-dependencies-syntax accepts the grammar and flags prose", () => {
  const m = byId["1.9-dependencies-syntax"];
  const ok = makeProject({
    "docs/04-roadmap/ROADMAP.md": "- [ ] **Epic 1.1:** A\n  - **Dependencias:** Ninguna\n- [ ] **Epic 1.2:** B\n  - **Dependencias:** Epic 1.1, Epic 1.3\n- [ ] **Epic 2.1:** C\n  - **Dependencias:** Milestone 1 completo\n- [ ] **Epic 2.2:** D\n  - **Dependencias:** Epic 2.1, Milestone 1 completo (ver nota)\n"
  });
  assert.equal(m.detect(contextFor(ok)), "done");
  const bad = makeProject({
    "docs/04-roadmap/ROADMAP.md": "- [ ] **Epic 3.1:** E\n  - **Dependencias:** Epic 2.1 y aprobación del usuario del design system\n"
  });
  assert.equal(m.detect(contextFor(bad)), "pending");
  const inputs = m.planInputs(contextFor(bad));
  assert.equal(inputs.invalid.length, 1);
  assert.equal(inputs.invalid[0].epic, "3.1");
  assert.equal(m.detect(contextFor(makeProject({}))), "n/a");
});

test("1.9-current-state-init is content-only: pending with closed milestones, never writes", () => {
  const m = byId["1.9-current-state-init"];
  const closed = makeProject({ "docs/04-roadmap/ROADMAP.md": "### Milestone 1: F\n\n- [x] **Epic 1.1:** A\n" });
  const ctx = contextFor(closed);
  assert.equal(m.detect(ctx), "pending");
  assert.deepEqual(ctx.writes, []);
  assert.equal(m.apply, undefined);
  const open = makeProject({ "docs/04-roadmap/ROADMAP.md": "### Milestone 1: F\n\n- [ ] **Epic 1.1:** A\n" });
  assert.equal(m.detect(contextFor(open)), "n/a");
  const withCurrent = makeProject({ "docs/04-roadmap/ROADMAP.md": "### Milestone 1: F\n\n- [x] **Epic 1.1:** A\n", "docs/05-specs/_current/.keep": "" });
  assert.equal(m.detect(contextFor(withCurrent)), "done");
});

test("1.9-tombstones collapses all but the two most recent closed milestones, preserving every epic ID", () => {
  const milestone = (n, state) => `### Milestone ${n}: Hito ${n}\n*Objetivo:* algo\n\n- [${state}] **Epic ${n}.1:** Uno\n  - **Dependencias:** Ninguna\n  - **Descripción:** cuerpo ${n}.1\n- [${state}] **Epic ${n}.2:** Dos\n  - **Dependencias:** Epic ${n}.1\n\n`;
  const roadmap = "# ROADMAP\n\n## Hitos\n\n" + milestone(1, "x") + milestone(2, "x") + milestone(3, "x") + milestone(4, "x") + milestone(5, " ") + "---\n\n## Reglas\n\nno tocar\n";
  mechanicalLifecycle("1.9-tombstones", { "docs/04-roadmap/ROADMAP.md": roadmap }, (root) => {
    const text = fs.readFileSync(path.join(root, "docs", "04-roadmap", "ROADMAP.md"), "utf8");
    assert.match(text, /^### Milestone 1: Hito 1  ✅ archivado \d{4}-\d{2}-\d{2} · verdad viva → docs\/05-specs\/ \(pending:_current\)/m);
    assert.match(text, /^- \[x\] Epic 1\.1, Epic 1\.2/m);
    assert.match(text, /^- \[x\] Epic 2\.1, Epic 2\.2/m);
    assert.match(text, /^### Milestone 3: Hito 3\n/m, "the two most recent closed milestones stay expanded");
    assert.match(text, /cuerpo 3\.1/);
    assert.match(text, /^- \[ \] \*\*Epic 5\.1:\*\*/m, "open milestone untouched");
    assert.match(text, /## Reglas\n\nno tocar/);
    assert.ok(!/cuerpo 1\.1/.test(text), "collapsed bodies leave the ROADMAP");
    const archive = fs.readFileSync(path.join(root, "docs", "04-roadmap", "archive", "milestone-1-hito-1.md"), "utf8");
    assert.match(archive, /cuerpo 1\.1/);
  });
});

test("1.9-tombstones flags tombstones that lost their epic IDs", () => {
  const root = makeProject({ "docs/04-roadmap/ROADMAP.md": "### Milestone 1: F  ✅ archivado 2026-08-22\n- [x]\n\n### Milestone 2: G\n\n- [ ] **Epic 2.1:** A\n" });
  const m = byId["1.9-tombstones"];
  assert.equal(m.detect(contextFor(root)), "pending");
  const result = m.apply(contextFor(root));
  assert.ok(result.notes.some((n) => n.includes("without epic IDs")));
});

test("1.10-rules-sections appends §12 and §13 from the template", () => {
  mechanicalLifecycle("1.10-rules-sections", { ".specture/conventions.md": "# Convenciones\n\n## 1. Naming\n\n- x\n\n## 10. Specture\n\n> ver settings\n\n## 11. Índice\n\n- No aplica\n" }, (root) => {
    const text = fs.readFileSync(path.join(root, ".specture", "conventions.md"), "utf8");
    assert.match(text, /^## 12\. Invariantes del Proyecto/m);
    assert.match(text, /^## 13\. Workflow \/ Proceso/m);
    assert.match(text, /## 11\. Índice[\s\S]*## 12\./, "appended after existing sections");
  });
});

test("1.19-rules-file moves the §12 table to rules.yml, leaves the pointer, skips placeholders, is idempotent", () => {
  const { parseRulesYaml } = require("../../hooks/lib/rules");
  const conventions = [
    "# Convenciones",
    "",
    "## 4. Patrones Prohibidos",
    "",
    "- Singletons mutables",
    "",
    "## 12. Invariantes del Proyecto (R-*)",
    "",
    "> Reglas que nunca cambian.",
    "",
    "| ID  | Ámbito (tag) | Regla | Cómo verificar | Severidad | Racional / ADR |",
    "|-----|--------------|-------|----------------|-----------|----------------|",
    "| R-1 | dto, domain  | Los DTOs son inmutables: sin setters | sin setters públicos | BLOCKER | DDD — ADR-004 |",
    "| R-2 | naming       | [ej. Métodos de consulta = sustantivo] | [ej. nombres de métodos nuevos] | IMPORTANT | §1 Naming |",
    "",
    "## 13. Workflow / Proceso (W-*)",
    "",
    "- W-3: Conventional Commits",
    ""
  ].join("\n");
  mechanicalLifecycle("1.19-rules-file", { ".specture/stack.yml": STACK, ".specture/conventions.md": conventions }, (root) => {
    const yml = fs.readFileSync(path.join(root, ".specture", "rules.yml"), "utf8");
    const parsed = parseRulesYaml(yml);
    assert.equal(parsed.schema, "1");
    assert.deepEqual(parsed.rules.map((r) => r.id), ["R-1"], "placeholder row skipped");
    assert.deepEqual(parsed.rules[0].tags, ["dto", "domain"]);
    assert.equal(parsed.rules[0].rule, "Los DTOs son inmutables: sin setters");
    assert.equal(parsed.rules[0].verify, "sin setters públicos");
    assert.equal(parsed.rules[0].severity, "BLOCKER");
    assert.equal(parsed.rules[0].source, "DDD — ADR-004");
    assert.match(yml, /^# Specture — Project Rules/, "template header kept");
    const text = fs.readFileSync(path.join(root, ".specture", "conventions.md"), "utf8");
    assert.match(text, /^## 12\. Invariantes del Proyecto \(R-\*\)\n\n> \*\*Desde v1\.19\.0 las invariantes viven en `\.specture\/rules\.yml`\*\*/m);
    assert.ok(!/\| R-1 \|/.test(text), "table rows leave conventions.md");
    assert.match(text, /## 4\. Patrones Prohibidos\n\n- Singletons mutables\n\n## 12\./, "§4 untouched");
    assert.match(text, /## 13\. Workflow \/ Proceso \(W-\*\)\n\n- W-3: Conventional Commits\n$/, "§13 untouched");
  });

  const bullets = makeProject({ ".specture/stack.yml": STACK, ".specture/conventions.md": "## 12. Invariantes del proyecto\n- **R-1:** toda operación HTTP lleva `X-Employee-Id`.\n- **R-2:** el envelope de error es único.\n\n## 13. Workflow\n\n- W-3: cc\n" });
  const result = byId["1.19-rules-file"].apply(contextFor(bullets));
  const parsedBullets = parseRulesYaml(fs.readFileSync(path.join(bullets, ".specture", "rules.yml"), "utf8"));
  assert.deepEqual(parsedBullets.rules.map((r) => [r.id, r.tags, r.severity]), [["R-1", ["all"], "IMPORTANT"], ["R-2", ["all"], "IMPORTANT"]]);
  assert.ok(result.notes.some((n) => /2 rule\(s\) moved/.test(n)));
  assert.ok(result.notes.some((n) => /tagged `all` and IMPORTANT — review them/.test(n)));
  assert.equal(byId["1.19-rules-file"].detect(contextFor(bullets)), "done");

  const none = makeProject({ ".specture/stack.yml": STACK, ".specture/conventions.md": "# Convenciones\n\n## 1. Naming\n\n- x\n" });
  const empty = byId["1.19-rules-file"].apply(contextFor(none));
  assert.match(fs.readFileSync(path.join(none, ".specture", "rules.yml"), "utf8"), /^rules: \[\]$/m);
  assert.equal(fs.readFileSync(path.join(none, ".specture", "conventions.md"), "utf8"), "# Convenciones\n\n## 1. Naming\n\n- x\n", "no §12 → conventions untouched");
  assert.ok(empty.notes.some((n) => /created empty/.test(n)));

  assert.equal(byId["1.19-rules-file"].detect(contextFor(makeProject({ ".specture/stack.yml": STACK }))), "n/a", "no conventions.md → n/a");
});

test("1.11-profile-and-knowledge renames learn.enabled and adds a profile (conventions and settings variants)", () => {
  mechanicalLifecycle("1.11-profile-and-knowledge", { ".specture/conventions.md": "## 10. Specture\n\n- **hooks.enabled**: true\n- **learn.enabled**: true\n" }, (root) => {
    const text = fs.readFileSync(path.join(root, ".specture", "conventions.md"), "utf8");
    assert.match(text, /- \*\*knowledge\.enabled\*\*: true/);
    assert.ok(!text.includes("learn.enabled"));
    assert.ok(text.indexOf("specture.profile") < text.indexOf("hooks.enabled"), "profile inserted before the first toggle");
  });
  mechanicalLifecycle("1.11-profile-and-knowledge", { ".specture/settings.yml": "hooks.enabled: true\nlearn.enabled: false\n" }, (root) => {
    const text = fs.readFileSync(path.join(root, ".specture", "settings.yml"), "utf8");
    assert.ok(text.startsWith("profile: custom\n"));
    assert.match(text, /^knowledge\.enabled: false$/m);
  });
});

test("1.12-structure-block derives the slug and finds matching root folders", () => {
  const m = byId["1.12-structure-block"];
  const root = makeProject({ ".specture/stack.yml": 'project:\n  name: "Mi App"\n', "mi_app_api/.keep": "", "mi_app_web/.keep": "", "otro/.keep": "" });
  assert.equal(m.detect(contextFor(root)), "pending");
  const inputs = m.planInputs(contextFor(root));
  assert.equal(inputs.slug, "mi_app");
  assert.deepEqual(inputs.matching.map((c) => c.role), ["api", "web"]);
  assert.equal(inputs.suggestedRootLayout, "by-app-suffix");
  assert.equal(m.detect(contextFor(makeProject({ ".specture/stack.yml": STACK }))), "done");
});

test("1.6 assisted migrations detect and expose plan inputs without writing", () => {
  const root = makeProject({
    ".specture/stack.yml": STACK,
    "docs/02-architecture/api-contract.openapi.json": CONTRACT,
    "docs/01-requirements/business_requirements.md": "## 3. Historias\n\n- **HU-AGENDA-001:** Reservar cita\n- **HU-AGENDA-002:** Ver cita\n"
  });
  const boundary = byId["1.6-boundary-capabilities"];
  const companion = byId["1.6-contract-companion"];
  const ctx = contextFor(root);
  assert.equal(boundary.detect(ctx), "pending");
  assert.equal(companion.detect(ctx), "pending");
  const b = boundary.planInputs(ctx);
  assert.equal(b.userStories.length, 2);
  assert.deepEqual(b.operations.map((o) => o.operationId), ["crearCita", "obtenerCita"]);
  const c = companion.planInputs(ctx);
  assert.equal(c.operations[0].method, "POST");
  assert.equal(c.operations[0].path, "/citas");
  assert.deepEqual(ctx.writes, []);

  const migrated = makeProject({
    ".specture/stack.yml": STACK,
    "docs/02-architecture/api-contract.openapi.json": CONTRACT,
    "docs/02-architecture/api-contract.md": "# Contrato\n",
    "docs/01-requirements/business_requirements.md": "## Capacidades de Frontera\n\n- HU-1 → crearCita\n"
  });
  assert.equal(boundary.detect(contextFor(migrated)), "done");
  assert.equal(companion.detect(contextFor(migrated)), "done");
  assert.equal(companion.detect(contextFor(makeProject({ ".specture/stack.yml": STACK }))), "n/a", "no contract file → n/a");
});

test("1.15-settings-file creates settings.yml from the legacy §10 block and leaves a pointer", () => {
  mechanicalLifecycle(
    "1.15-settings-file",
    { ".specture/stack.yml": STACK, ".specture/conventions.md": "## 10. Specture\n\n- **specture.profile**: custom\n- **hooks.enabled**: true\n- **learn.enabled**: true\n\n## 11. Índice\n" },
    (root) => {
      const settings = fs.readFileSync(path.join(root, ".specture", "settings.yml"), "utf8");
      assert.match(settings, /^hooks\.enabled: true\b/m);
      assert.match(settings, /^knowledge\.enabled: true\b/m, "learn.enabled alias resolved");
      assert.match(settings, /^profile: custom\b/m);
      const conventions = fs.readFileSync(path.join(root, ".specture", "conventions.md"), "utf8");
      assert.match(conventions, /## 10\. Specture\n\n> Migrado a `\.specture\/settings\.yml`/);
      assert.ok(conventions.includes("- **hooks.enabled**: true"), "legacy lines are left in place (inert)");
    }
  );
});

test("1.15-schema-version records the plugin version when nothing is pending, else the last fully-applied version", () => {
  const m = byId["1.15-schema-version"];
  const clean = makeProject({
    ".specture/stack.yml": STACK,
    ".specture/settings.yml": "profile: custom\nhooks.enabled: true\n",
    ".specture/conventions.md": "## 12. Invariantes\n\n## 13. Workflow\n",
    ".specture/rules.yml": "schema: 1\nrules: []\n",
    ".gitignore": ".specture/state/\ndocs/.specture-meta/*\n!docs/.specture-meta/build-metrics.jsonl\n"
  });
  assert.equal(m.detect(contextFor(clean)), "pending");
  m.apply(contextFor(clean));
  assert.match(fs.readFileSync(path.join(clean, ".specture", "settings.yml"), "utf8"), new RegExp(`^schema_version: ${pluginVersion.replace(/\\./g, "\\\\.")}`, "m"));
  assert.equal(m.detect(contextFor(clean)), "done");

  const behind = makeProject({
    ".specture/stack.yml": STACK,
    ".specture/settings.yml": "profile: custom\n",
    ".specture/conventions.md": "## 12. Invariantes\n\n## 13. Workflow\n",
    ".gitignore": ".specture/state/\ndocs/.specture-meta/*\n!docs/.specture-meta/build-metrics.jsonl\n",
    "docs/04-roadmap/ROADMAP.md": "- [ ] **Epic 1.1:** A\n  - **Dependencias:** depende de que el usuario apruebe\n"
  });
  assert.equal(m.inferSchemaVersion(contextFor(behind)), "1.8.0", "1.9-dependencies-syntax pending → schema stays at 1.8.0");
});

test("1.16-requirements-ids detects missing RN IDs and exposes plan inputs without writing", () => {
  const m = byId["1.16-requirements-ids"];
  const pending = makeProject({
    ".specture/stack.yml": STACK,
    "docs/01-requirements/business_requirements.md":
      "## Reglas de Negocio\n\n- Un usuario no puede tener dos suscripciones activas\n\n## Casos Límite\n\n- Pago falla a la mitad\n\n## Fuera de Alcance\n\n- Facturación electrónica\n"
  });
  const ctx = contextFor(pending);
  assert.equal(m.detect(ctx), "pending");
  const inputs = m.planInputs(ctx);
  assert.ok(inputs.rules.includes("suscripciones activas"));
  assert.ok(inputs.edgeCases.includes("Pago falla"));
  assert.ok(inputs.outOfScope.includes("Facturación"));
  assert.ok(inputs.guidance.includes("RN-nnn"));
  assert.deepEqual(ctx.writes, []);

  const done = makeProject({
    ".specture/stack.yml": STACK,
    "docs/01-requirements/business_requirements.md": "## Reglas de Negocio\n\n- **RN-001:** regla\n"
  });
  assert.equal(m.detect(contextFor(done)), "done");
  assert.equal(m.verify(contextFor(done)), true);
  const prefixed = makeProject({
    ".specture/stack.yml": STACK,
    "docs/01-requirements/business_requirements.md": "## Reglas de Negocio\n\n- **RN-SEG-007:** regla\n"
  });
  assert.equal(m.detect(contextFor(prefixed)), "done", "domain prefix counts as an ID");
  assert.equal(m.detect(contextFor(makeProject({ ".specture/stack.yml": STACK }))), "n/a", "no business_requirements.md → n/a");
});

test("1.16-requirements-merge detects drafts and Adenda sections and exposes the merge plan", () => {
  const m = byId["1.16-requirements-merge"];
  const withDraft = makeProject({
    ".specture/stack.yml": STACK,
    "docs/01-requirements/business_requirements.md": "## Reglas de Negocio\n\n- **RN-001:** regla\n",
    "docs/01-requirements/feature-pagos.md": "## Reglas de Negocio\n\n- Nueva regla de pagos\n"
  });
  const ctx = contextFor(withDraft);
  assert.equal(m.detect(ctx), "pending");
  const inputs = m.planInputs(ctx);
  assert.deepEqual(inputs.featureFiles.map((f) => f.file), ["docs/01-requirements/feature-pagos.md"]);
  assert.deepEqual(inputs.featureFiles[0].headings, ["## Reglas de Negocio"]);
  assert.ok(inputs.guidance.includes("añadido por feature"));
  assert.deepEqual(ctx.writes, []);

  const withAdenda = makeProject({
    ".specture/stack.yml": STACK,
    "docs/01-requirements/business_requirements.md": "## Reglas de Negocio\n\n- **RN-001:** regla\n\n## Adenda v1.2\n\n- extra\n"
  });
  assert.equal(m.detect(contextFor(withAdenda)), "pending", "Adenda section counts as pending");
  assert.ok(m.planInputs(contextFor(withAdenda)).adendaSections[0].includes("extra"));

  const clean = makeProject({
    ".specture/stack.yml": STACK,
    "docs/01-requirements/business_requirements.md": "## Reglas de Negocio\n\n- **RN-001:** regla\n"
  });
  assert.equal(m.detect(contextFor(clean)), "done");
  assert.equal(m.verify(contextFor(clean)), true);
  assert.equal(m.detect(contextFor(makeProject({ ".specture/stack.yml": STACK }))), "n/a", "no requirements dir → n/a");
});
