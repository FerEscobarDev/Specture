const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");
const planning = require("../lib/planning");

const scriptPath = path.resolve(__dirname, "..", "lib", "spec-set-check.js");
const temporaryDirectories = [];

function write(root, rel, text) {
  const abs = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

// A minimal spec following templates/SPEC_TEMPLATE.md sections.
function spec({ slug, ops = [], mode = "implementa", rules = [], surface = [], ids = 3, extra = "", fuera = ["nada"] }) {
  const opsLine = ops.length
    ? `- **${mode === "consume" ? "Consume" : "Implementa"}** (spec): \`operationId\` — \`[${ops.join(", ")}]\``
    : "- **Sin boundary HTTP:** N/A — lógica interna.";
  const br = rules.map((rn, i) => `- **BR-${i + 1}:** regla — fuente: \`${rn}\` de business_requirements.md`).join("\n");
  const ac = Array.from({ length: ids }, (_, i) => `- **AC-${i + 1}:** criterio ${i + 1}`).join("\n");
  return [
    `# SPEC: ${slug} — id: epic/${slug}`,
    "",
    "## Objetivo",
    "x",
    "",
    "## Fuera de Scope (NO testear, NO implementar)",
    ...fuera.map((f) => `- ${f}`),
    "",
    "## Operaciones del Contrato de API (si el spec toca un boundary HTTP)",
    opsLine,
    "",
    "## Reglas de Negocio",
    br,
    "",
    "## Criterios de Aceptación (≥1 test por ID)",
    ac,
    "",
    "## Superficie de Código Existente (para el implementer — lo llena el spec-planner)",
    ...surface,
    "",
    extra
  ].join("\n");
}

function roadmap(epics) {
  const blocks = epics.map((e) =>
    [
      `- [${e.state || " "}] **Epic ${e.id}:** ${e.name || "Epic"}`,
      "  - **Dependencias:** Ninguna",
      e.template ? `  - **Template:** ${e.template}` : null,
      "  - **Descripción:** d",
      e.rules !== undefined ? `  - **Reglas de negocio clave:** ${e.rules}` : null,
      e.ops !== undefined ? `  - **Operaciones del contrato:** ${e.ops}` : null,
      e.gaps !== undefined ? `  - **Breaking changes in scope:** ${e.gaps}` : null,
      "  - **Specs estimados:** 2"
    ]
      .filter(Boolean)
      .join("\n")
  );
  return `# ROADMAP\n\n### Milestone 1: M\n\n${blocks.join("\n\n")}\n`;
}

function planningDoc(rows, { labelForm = false } = {}) {
  if (labelForm) return `# Planning\n\nCOVERAGE_TABLE:\n${rows}\n\nOPEN_QUESTIONS: (ninguna)\n\nRESOLVED_ALONE:\n- R-1 — x — fuente: y — cita: "z"\n`;
  return `# Planning — e\n\n## COVERAGE_TABLE\n${rows}\n\n## OPEN_QUESTIONS\n- (ninguna)\n\n## RESOLVED_ALONE\n- R-1 — x — fuente: y — cita: "z"\n`;
}

const CLEAN_ROWS = [
  "- op: subir → 01-subir (implementa)",
  "- op: listar → 02-listar (implementa)",
  "- br: RN-001 → 01-subir [BR-1]",
  "- br: RN-002 → 01-subir [BR-2]",
  "- sym: Repo — crea: 01-subir — firma: `class Repo { insert(row) }` — consume: [02-listar]",
  "- oos: nada → diferido a: fuera del epic"
].join("\n");

const CLEAN_SPECS = {
  "01-subir": spec({
    slug: "01-subir",
    ops: ["subir"],
    rules: ["RN-001", "RN-002"],
    surface: ["- Crea: `subir` en `src/a/service.js` — firma: `subir(dto)`", "- Crea: `Repo` en `src/a/repo.js` — firma: `class Repo { insert(row) }`"]
  }),
  "02-listar": spec({
    slug: "02-listar",
    ops: ["listar"],
    rules: ["RN-002"],
    surface: [
      "- Crea (spec hermano anterior): `Repo` — firma: `class Repo { insert(row) }` `(planeada — re-anclar)`",
      "- Crea: `listar` en `src/a/service.js` — firma: `listar(id)`",
      "- Modifica: `app` en `src/app.js`"
    ]
  })
};

const CLEAN_ROADMAP = roadmap([{ id: "1.1", ops: "`subir`, `listar`", rules: "RN-001, RN-002" }]);

function createProject({ roadmap: rm = CLEAN_ROADMAP, epic = "epic-1.1-x", planning: pl = planningDoc(CLEAN_ROWS), specs = CLEAN_SPECS, files = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-set-check-"));
  temporaryDirectories.push(root);
  write(root, ".specture/stack.yml", "schema: 1\n");
  write(root, "docs/04-roadmap/ROADMAP.md", rm);
  if (pl !== null) write(root, `docs/05-specs/${epic}/_planning.md`, pl);
  for (const [slug, text] of Object.entries(specs)) write(root, `docs/05-specs/${epic}/${slug}.spec.md`, text);
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  return { root, epicDir: path.join(root, "docs", "05-specs", epic), roadmapPath: path.join(root, "docs", "04-roadmap", "ROADMAP.md") };
}

function runCheck(project, args = [], { epic = "1.1", block = null } = {}) {
  const argv = block ? [project.epicDir, block] : [project.epicDir, "--roadmap", project.roadmapPath, "--epic", epic];
  const result = spawnSync(process.execPath, [scriptPath, ...argv, ...args], { encoding: "utf8" });
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, lines, token: lines[0] || "", json: args.includes("--json") ? JSON.parse(result.stdout) : null };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------

test("a clean two-spec set passes with a 12-hex MECH_CHECK token and no BLOCKER/WARNING", () => {
  const { status, token, lines, stderr } = runCheck(createProject());
  assert.equal(status, 0, stderr);
  assert.match(token, /^MECH_CHECK: PASS [0-9a-f]{12}$/);
  assert.equal(lines.filter((l) => /BLOCKER|WARNING/.test(l)).length, 0, lines.join("\n"));
});

test("C1: an epic operation with no op: row is a hole → FAIL (exit 1), no validator spend", () => {
  const project = createProject({ roadmap: roadmap([{ id: "1.1", ops: "`subir`, `listar`, `eliminar`", rules: "RN-001, RN-002" }]) });
  const { status, token, lines } = runCheck(project);
  assert.equal(status, 1);
  assert.match(token, /^MECH_CHECK: FAIL [0-9a-f]{12}$/);
  assert.ok(lines.some((l) => /^C1 BLOCKER -: .*`eliminar`.*hueco/.test(l)), lines.join("\n"));
});

test("C1: two specs implementing the same operation overlap; a row the spec does not list is a lie", () => {
  const overlap = createProject({ planning: planningDoc(CLEAN_ROWS + "\n- op: subir → 02-listar (implementa)") });
  assert.ok(runCheck(overlap).lines.some((l) => /^C1 BLOCKER -: .*solapamiento.*01-subir, 02-listar/.test(l)));

  const lie = createProject({ planning: planningDoc(CLEAN_ROWS.replace("- op: listar → 02-listar (implementa)", "- op: listar → 01-subir (implementa)")) });
  const { status, lines } = runCheck(lie);
  assert.equal(status, 1);
  assert.ok(lines.some((l) => /^C1 BLOCKER 01-subir: .*`listar`.*no la lista/.test(l)), lines.join("\n"));
});

test("C1-consume: a consumed operation needs a backend epic in [x]", () => {
  const frontend = (backendState) =>
    createProject({
      roadmap: roadmap([
        { id: "1.1", state: backendState, ops: "`listar`", rules: "RN-001" },
        { id: "3.1", ops: "`listar` (consume)", rules: "RN-001" }
      ]),
      epic: "epic-3.1-page",
      planning: planningDoc("- op: listar → 01-page (consume)\n- br: RN-001 → 01-page [BR-1]"),
      specs: { "01-page": spec({ slug: "01-page", ops: ["listar"], mode: "consume", rules: ["RN-001"], surface: ["- Crea: `Page` en `app/page.tsx` — firma: `Page()`"] }) }
    });
  assert.equal(runCheck(frontend("x"), [], { epic: "3.1" }).status, 0);
  const pending = runCheck(frontend(" "), [], { epic: "3.1" });
  assert.equal(pending.status, 1);
  assert.ok(pending.lines.some((l) => /C1 BLOCKER -: `listar` \(consume\).*1\.1.*pending, no \[x\]/.test(l)), pending.lines.join("\n"));

  const undeclared = createProject({
    roadmap: roadmap([{ id: "3.1", ops: "`listar` (consume)", rules: "RN-001" }]),
    epic: "epic-3.1-page",
    planning: planningDoc("- op: listar → 01-page (consume)\n- br: RN-001 → 01-page [BR-1]"),
    specs: { "01-page": spec({ slug: "01-page", ops: ["listar"], mode: "consume", rules: ["RN-001"], surface: ["- Crea: `Page` en `app/page.tsx`"] }) }
  });
  assert.ok(runCheck(undeclared, [], { epic: "3.1" }).lines.some((l) => /C1 BLOCKER -: `listar` \(consume\): ningún otro epic/.test(l)));
});

test("C2: an RN linked by the epic that no spec cites, or a br: row the spec does not cite", () => {
  const uncited = createProject({ roadmap: roadmap([{ id: "1.1", ops: "`subir`, `listar`", rules: "RN-001, RN-002, RN-009" }]) });
  const a = runCheck(uncited);
  assert.equal(a.status, 1);
  assert.ok(a.lines.some((l) => /^C2 BLOCKER -: RN-009 enlazada/.test(l)), a.lines.join("\n"));

  const lie = createProject({ planning: planningDoc(CLEAN_ROWS.replace("- br: RN-001 → 01-subir [BR-1]", "- br: RN-001 → 02-listar [BR-1]")) });
  assert.ok(runCheck(lie).lines.some((l) => /^C2 BLOCKER 02-listar: la tabla declara RN-001 pero el spec no la cita/.test(l)));
});

test("C4: identical signature passes; divergent signature fails quoting both; orphan planned symbol fails", () => {
  assert.equal(runCheck(createProject()).status, 0);

  const divergent = createProject({
    specs: {
      ...CLEAN_SPECS,
      "02-listar": CLEAN_SPECS["02-listar"].replace("firma: `class Repo { insert(row) }` `(planeada", "firma: `class Repo { insert(row, opts) }` `(planeada")
    }
  });
  const d = runCheck(divergent);
  assert.equal(d.status, 1);
  const line = d.lines.find((l) => l.startsWith("C4 BLOCKER 02-listar:"));
  assert.ok(line, d.lines.join("\n"));
  assert.match(line, /planeada "class Repo \{ insert\(row, opts\) \}" ≠ creada en 01-subir "class Repo \{ insert\(row\) \}"/);

  const orphan = createProject({ planning: planningDoc(CLEAN_ROWS.replace(/- sym: Repo.*\n?/, "")) });
  assert.ok(runCheck(orphan).lines.some((l) => /^C4 BLOCKER 02-listar: `Repo` \(planeada — re-anclar\) sin fila sym/.test(l)));
});

test("C4: the creator must be an EARLIER spec", () => {
  const later = createProject({ planning: planningDoc(CLEAN_ROWS.replace("crea: 01-subir — firma: `class Repo", "crea: 02-listar — firma: `class Repo").replace("consume: [02-listar]", "consume: []")) });
  const { lines } = runCheck(later);
  assert.ok(lines.some((l) => /^C4 BLOCKER 02-listar: `Repo` la crea 02-listar, que no es un spec anterior/.test(l)), lines.join("\n"));
});

test("C5: more than 3 specs or more than 15 IDs in a spec is a WARNING, still exit 0", () => {
  const four = createProject({
    specs: { ...CLEAN_SPECS, "03-c": spec({ slug: "03-c", surface: ["- Crea: `c` en `src/c.js`"] }), "04-d": spec({ slug: "04-d", surface: ["- Crea: `d` en `src/d.js`"] }) }
  });
  const a = runCheck(four);
  assert.equal(a.status, 0);
  assert.ok(a.lines.some((l) => /^C5 WARNING -: 4 specs \(> 3\)/.test(l)), a.lines.join("\n"));

  const fat = createProject({ specs: { ...CLEAN_SPECS, "01-subir": spec({ slug: "01-subir", ops: ["subir"], rules: ["RN-001", "RN-002"], ids: 20, surface: ["- Crea: `Repo` en `src/a/repo.js`"] }) } });
  const b = runCheck(fat);
  assert.equal(b.status, 0);
  assert.ok(b.lines.some((l) => /^C5 WARNING 01-subir: 22 AC\/BR\/EC \(> 15\)/.test(l)), b.lines.join("\n"));
});

test("C6: a consumer that comes before its creator is a BLOCKER; self-consumption is a WARNING", () => {
  const rows = CLEAN_ROWS.replace("- sym: Repo — crea: 01-subir — firma: `class Repo { insert(row) }` — consume: [02-listar]", "- sym: Svc — crea: 02-listar — firma: `svc()` — consume: [01-subir]");
  const specs = { ...CLEAN_SPECS, "02-listar": spec({ slug: "02-listar", ops: ["listar"], rules: ["RN-002"], surface: ["- Crea: `Svc` en `src/svc.js`"] }) };
  const before = runCheck(createProject({ planning: planningDoc(rows), specs }));
  assert.equal(before.status, 1);
  assert.ok(before.lines.some((l) => /^C6 BLOCKER 01-subir: `Svc`: 01-subir consume un símbolo que crea 02-listar/.test(l)), before.lines.join("\n"));

  const self = runCheck(createProject({ planning: planningDoc(rows.replace("consume: [01-subir]", "consume: [02-listar]")), specs }));
  assert.equal(self.status, 0);
  assert.ok(self.lines.some((l) => /^C6 WARNING 02-listar: `Svc`: el spec se consume a sí mismo/.test(l)));
});

test("UNVERIFIABLE (exit 2): missing table, malformed row, missing epic block", () => {
  const noTable = runCheck(createProject({ planning: "# Planning\n\n## OPEN_QUESTIONS\n- (ninguna)\n" }));
  assert.equal(noTable.status, 2);
  assert.match(noTable.token, /^MECH_CHECK: UNVERIFIABLE COVERAGE_TABLE not found/);

  const malformed = runCheck(createProject({ planning: planningDoc(CLEAN_ROWS + "\n- op: subir 01-subir") }));
  assert.equal(malformed.status, 2);
  assert.match(malformed.token, /^MECH_CHECK: UNVERIFIABLE malformed COVERAGE_TABLE row: - op: subir 01-subir/);

  const noBlock = spawnSync(process.execPath, [scriptPath, createProject().epicDir], { encoding: "utf8" });
  assert.equal(noBlock.status, 2);
  assert.match(noBlock.stdout, /^MECH_CHECK: UNVERIFIABLE epic block not provided/);

  const noDir = spawnSync(process.execPath, [scriptPath, path.join(os.tmpdir(), "does-not-exist-" + Date.now())], { encoding: "utf8" });
  assert.equal(noDir.status, 2);
});

test("the sha covers only the table rows: CRLF, trailing spaces and other sections do not move it; a row does", () => {
  const base = planningDoc(CLEAN_ROWS);
  const sha = planning.coverageHash(base);
  assert.match(sha, /^[0-9a-f]{12}$/);
  assert.equal(planning.coverageHash(base.replace(/\n/g, "\r\n")), sha);
  assert.equal(planning.coverageHash(base.replace(/\n/g, "   \n")), sha);
  assert.equal(planning.coverageHash(base.replace("- (ninguna)", "- Q-1 — afecta: AC-1\n  - respuesta: A — fuente: usuario 2026-09-07")), sha);
  assert.equal(planning.coverageHash(base + "\n## MECH_CHECK\n- MECH_CHECK: PASS abc\n## SPEC_SHA\n- SPEC_SHA: 123\n"), sha);
  assert.notEqual(planning.coverageHash(base.replace("[BR-2]", "[BR-3]")), sha);
  assert.equal(planning.coverageHash(planningDoc(CLEAN_ROWS, { labelForm: true })), sha);
});

test("--hash-only prints MECH_CHECK: HASH <sha> equal to the token's sha and ignores failing checks", () => {
  const project = createProject({ roadmap: roadmap([{ id: "1.1", ops: "`subir`, `listar`, `eliminar`", rules: "RN-001" }]) });
  const failing = runCheck(project);
  assert.equal(failing.status, 1);
  const hash = spawnSync(process.execPath, [scriptPath, project.epicDir, "--hash-only"], { encoding: "utf8" });
  assert.equal(hash.status, 0);
  assert.equal(hash.stdout.trim(), `MECH_CHECK: HASH ${failing.token.split(" ")[2]}`);
});

test("--json returns status, sha, findings, specs and the parsed epic", () => {
  const { status, json } = runCheck(createProject(), ["--json"]);
  assert.equal(status, 0);
  assert.equal(json.status, "PASS");
  assert.match(json.sha, /^[0-9a-f]{12}$/);
  assert.deepEqual(json.specs, ["01-subir", "02-listar"]);
  assert.deepEqual(json.epic.operations, [{ id: "subir", mode: "implementa" }, { id: "listar", mode: "implementa" }]);
  assert.deepEqual(json.epic.rules, ["RN-001", "RN-002"]);
  assert.ok(Array.isArray(json.findings));
  assert.ok(json.findings.every((f) => f.check && f.severity && f.slug && f.detail));
});

test("the positional <epic-block-file> form gives the same status and sha as --roadmap/--epic", () => {
  const project = createProject();
  const block = path.join(project.root, "block.md");
  fs.writeFileSync(block, "- [ ] **Epic 1.1:** Epic\n  - **Reglas de negocio clave:** RN-001, RN-002\n  - **Operaciones del contrato:** `subir`, `listar`\n");
  const a = runCheck(project);
  const b = runCheck(project, [], { block });
  assert.equal(b.status, 0);
  assert.equal(a.token, b.token);
});

test("the v1.17.0 bare `COVERAGE_TABLE:` label form still parses", () => {
  const { status, token } = runCheck(createProject({ planning: planningDoc(CLEAN_ROWS, { labelForm: true }) }));
  assert.equal(status, 0);
  assert.match(token, /^MECH_CHECK: PASS/);
});

test("--allowed-paths prints the union of Crea:/Modifica: paths; a Crea: without `en <path>` is a C-path BLOCKER", () => {
  const union = spawnSync(process.execPath, [scriptPath, createProject().epicDir, "--allowed-paths"], { encoding: "utf8" });
  assert.equal(union.status, 0);
  assert.deepEqual(union.stdout.trim().split(/\r?\n/), ["src/a/repo.js", "src/a/service.js", "src/app.js"]);

  const noPath = createProject({ specs: { ...CLEAN_SPECS, "01-subir": CLEAN_SPECS["01-subir"].replace("- Crea: `subir` en `src/a/service.js` — firma: `subir(dto)`", "- Crea: `subir` — firma: `subir(dto)`") } });
  const { status, lines } = runCheck(noPath);
  assert.equal(status, 1);
  assert.ok(lines.some((l) => /^C-path BLOCKER 01-subir: "Crea: subir" sin `en <path>`/.test(l)), lines.join("\n"));
});

test("migration epics: C2 and C4 are skipped with INFO; C-gap needs every GAP exactly once", () => {
  const migrationSpec = (gaps) =>
    `# MIGRATION SPEC: tags\n\n- **Gaps cubiertos (gap_analysis.md):** ${gaps}\n\n## 1. Estado Actual\n- x\n\n## 5. Criterios de Aceptación\n- **AC-1:** a\n\n## 7. Fuera de Scope\n- nada\n`;
  const make = (gapLine, rows, specGaps) =>
    createProject({
      roadmap: roadmap([{ id: "2.1", template: "MIGRATION_SPEC_TEMPLATE.md", rules: "RN-005", gaps: gapLine }]),
      epic: "epic-2.1-mig",
      planning: planningDoc(rows),
      specs: { "01-mig": migrationSpec(specGaps) }
    });

  const ok = runCheck(make("GAP-001, GAP-002", "- gap: GAP-001 → 01-mig\n- gap: GAP-002 → 01-mig\n- oos: nada → diferido a: fuera del epic", "GAP-001, GAP-002"), [], { epic: "2.1" });
  assert.equal(ok.status, 0, ok.lines.join("\n"));
  assert.ok(ok.lines.some((l) => /^C2 INFO -: epic de migración/.test(l)));
  assert.ok(ok.lines.some((l) => /^C4 INFO/.test(l)));

  const missing = runCheck(make("GAP-001, GAP-002", "- gap: GAP-001 → 01-mig", "GAP-001"), [], { epic: "2.1" });
  assert.equal(missing.status, 1);
  assert.ok(missing.lines.some((l) => /^C-gap BLOCKER -: GAP-002 del epic no lo cubre ningún spec/.test(l)), missing.lines.join("\n"));

  const dup = runCheck(make("GAP-001", "- gap: GAP-001 → 01-mig\n- gap: GAP-001 → 01-mig", "GAP-001"), [], { epic: "2.1" });
  assert.ok(dup.lines.some((l) => /^C-gap BLOCKER -: GAP-001 cubierto por 2 specs/.test(l)));

  const lie = runCheck(make("GAP-001", "- gap: GAP-001 → 01-mig", "GAP-009"), [], { epic: "2.1" });
  assert.ok(lie.lines.some((l) => /^C-gap BLOCKER 01-mig: la tabla declara GAP-001 pero el spec no lo lista/.test(l)));
});

test("C-sup: every Supersede: line needs its sup: row (and vice-versa) and the path must exist on disk", () => {
  const supersedeSection = "\n## Supersesiones de tests sellados (omitir si no aplica)\n- Supersede: `tests/old/nota.test.js::rechaza titulo repetido` — motivo: BR-1 — epic origen: epic-0.9-old\n";
  const specs = { ...CLEAN_SPECS, "01-subir": CLEAN_SPECS["01-subir"] + supersedeSection };
  const rows = CLEAN_ROWS + "\n- sup: tests/old/nota.test.js::rechaza titulo repetido → 01-subir (BR-1)";

  const ok = runCheck(createProject({ specs, planning: planningDoc(rows), files: { "tests/old/nota.test.js": "// old\n" } }));
  assert.equal(ok.status, 0, ok.lines.join("\n"));

  const missingFile = runCheck(createProject({ specs, planning: planningDoc(rows) }));
  assert.equal(missingFile.status, 1);
  assert.ok(missingFile.lines.some((l) => /^C-sup BLOCKER 01-subir: Supersede `tests\/old\/nota\.test\.js` no existe en disco/.test(l)), missingFile.lines.join("\n"));

  const noRow = runCheck(createProject({ specs, files: { "tests/old/nota.test.js": "// old\n" } }));
  assert.ok(noRow.lines.some((l) => /^C-sup BLOCKER 01-subir: Supersede `tests\/old\/nota\.test\.js::rechaza titulo repetido` sin fila sup:/.test(l)), noRow.lines.join("\n"));

  const noLine = runCheck(createProject({ planning: planningDoc(rows), files: { "tests/old/nota.test.js": "// old\n" } }));
  assert.ok(noLine.lines.some((l) => /^C-sup BLOCKER 01-subir: fila sup: .* sin línea Supersede: en el spec/.test(l)), noLine.lines.join("\n"));

  const wrongSlug = runCheck(createProject({ specs, planning: planningDoc(rows.replace("→ 01-subir (BR-1)", "→ 02-listar (BR-1)")), files: { "tests/old/nota.test.js": "// old\n" } }));
  assert.ok(wrongSlug.lines.some((l) => /^C-sup BLOCKER 01-subir: .*la tabla la asigna a 02-listar/.test(l)), wrongSlug.lines.join("\n"));
});

test("planning.js parses the four core row kinds, the epic block and a spec's surface", () => {
  const table = planning.parseCoverageTable(planningDoc(CLEAN_ROWS));
  assert.equal(table.found, true);
  assert.deepEqual(table.errors, []);
  assert.deepEqual(table.rows.op[0], { operationId: "subir", slug: "01-subir", mode: "implementa", raw: "- op: subir → 01-subir (implementa)" });
  assert.equal(table.rows.br[1].br, "BR-2");
  assert.deepEqual(table.rows.sym[0].consume, ["02-listar"]);
  assert.equal(table.rows.sym[0].firma, "class Repo { insert(row) }");
  assert.equal(table.rows.oos[0].deferredTo, "fuera del epic");
  assert.equal(planning.parseCoverageTable(planningDoc("- sym: A -- crea: 01-a -- firma: `a()` -- consume: []")).rows.sym[0].crea, "01-a");
  const migrationBr = planning.parseCoverageTable(planningDoc("- br: RN-005 → 01-tags [AC-4]\n- br: RN-006 → 01-tags [BR-1, BR-3]"));
  assert.deepEqual(migrationBr.errors, [], "migration specs cite the covering AC-n instead of a BR-n");
  assert.equal(migrationBr.rows.br[0].br, "AC-4");
  assert.equal(migrationBr.rows.br[1].br, "BR-1, BR-3");

  const epic = planning.findEpicBlock(roadmap([{ id: "1.1", ops: "`subir`, `listar` (consume)", rules: "RN-001, RN-SEG-007" }]), "epic-1.1-x");
  assert.equal(epic.id, "1.1");
  assert.deepEqual(epic.operations.map((o) => o.mode), ["implementa", "consume"]);
  assert.deepEqual(epic.rules, ["RN-001", "RN-SEG-007"]);
  assert.deepEqual(planning.parseOperations("subirArchivo, listarArchivos"), [{ id: "subirArchivo", mode: "implementa" }, { id: "listarArchivos", mode: "implementa" }]);
  assert.deepEqual(planning.parseOperations("Omitir si el epic no toca el boundary HTTP"), []);

  // Planner variations seen in the stage-2 GREEN baseline (REFACTOR): bold-colon ops line with
  // backticked ids, `Crea (<anything>):` as the planned variant, `Modifica: \`path\`` without `en`.
  const variant = planning.parseSpec(
    "## Operaciones del Contrato de API\n- **Implementa:** `asignarEtiqueta` — `POST /archivos/{id}/etiquetas`.\n\n## Superficie de Código Existente\n- Crea (Epic 1.1 — planeada, todavía fuera del CODE_SURFACE): `ArchivoRepository` — firma: `class ArchivoRepository { insert(row) }` `(planeada — re-anclar)`\n- Modifica: `archivador_api/src/archivos/archivo-repository.js` *(solo si hace falta)*\n- Crea: `TagService` en `archivador_api/src/tags/tag-service.js` — firma: `class TagService {}`\n",
    "01-x"
  );
  assert.deepEqual(variant.operations, [{ id: "asignarEtiqueta", mode: "implementa" }]);
  assert.equal(variant.plannedSymbols.length, 1);
  assert.equal(variant.plannedSymbols[0].symbol, "ArchivoRepository");
  assert.deepEqual(variant.modifiedPaths, ["archivador_api/src/archivos/archivo-repository.js"]);
  assert.deepEqual(variant.surfaceWithoutPath, []);

  const parsed = planning.parseSpec(CLEAN_SPECS["02-listar"], "02-listar");
  assert.deepEqual(parsed.operations, [{ id: "listar", mode: "implementa" }]);
  assert.equal(parsed.plannedSymbols[0].symbol, "Repo");
  assert.equal(parsed.plannedSymbols[0].firma, "class Repo { insert(row) }");
  assert.deepEqual(parsed.createdPaths, ["src/a/service.js"]);
  assert.deepEqual(parsed.modifiedPaths, ["src/app.js"]);
  assert.equal(parsed.idCount, 4);
  assert.deepEqual(planning.lastMechCheck("x\n- MECH_CHECK: FAIL aaa — 1\n- MECH_CHECK: PASS bbb — 2\n"), { status: "PASS", value: "bbb", line: "- MECH_CHECK: PASS bbb — 2" });
});
