const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");
const planning = require("../lib/planning");
const review = require("../lib/review");

const scriptPath = path.resolve(__dirname, "..", "lib", "review.js");
const temporaryDirectories = [];

function write(root, rel, text) {
  const abs = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

// Three epics of one batch: `states` maps id → checkbox mark, `parked` lists the ids carrying
// an `**Aparcado:**` line, `descriptions` overrides a description.
function roadmap({ states = {}, parked = [], descriptions = {} } = {}) {
  const epic = (id, name, description, rules) =>
    [
      `- [${states[id] || " "}] **Epic ${id}:** ${name}`,
      "  - **Dependencias:** Ninguna",
      `  - **Descripción:** ${descriptions[id] || description}`,
      `  - **Reglas de negocio clave:** ${rules}`,
      parked.includes(id) ? "  - **Aparcado:** 2026-09-30T10:00:00-03:00 — datos — retención del recibo — tanda 2026-09-29-cobros" : null
    ]
      .filter(Boolean)
      .join("\n");
  return [
    "# ROADMAP",
    "",
    "### Milestone 2: Cobros",
    "",
    epic("2.1", "Tarifas", "Definir la tarifa por paciente.", "RN-001"),
    "",
    epic("2.2", "Cobro de sesiones", "Cobrar la sesión al cerrarla.", "RN-001, RN-002"),
    "",
    epic("2.3", "Recibos", "Emitir el recibo.", "RN-003"),
    ""
  ].join("\n");
}

function requirements({ rn002 = "Una sesión cancelada con menos de 24 h se cobra al 50 %." } = {}) {
  return [
    "# Requerimientos de Negocio",
    "",
    "## Reglas de Negocio",
    "- **RN-001:** La tarifa se fija por paciente.",
    `- **RN-002:** ${rn002}`,
    "- **RN-003:** El recibo no muestra el diagnóstico.",
    ""
  ].join("\n");
}

const COMPLETE = [
  "# Revisión de tanda — cobros",
  "",
  "> prosa libre que el parser ignora",
  "",
  "- ID: 2026-09-29-cobros",
  "- ESTADO: RONDA-2",
  "- EPICS: 2.1, 2.2, 2.3",
  "- REGULATORIOS: 2.3 (datos personales en el recibo)",
  "",
  "## POLÍTICAS",
  "- P-1 — tope de rondas del refresco: 2 — fuente: usuario 2026-09-29",
  "",
  "## AGENDA",
  "### Ronda 1",
  "- A-1 — 2.2 — dinero — ¿Se cobra la sesión cancelada con menos de 24 h? — respuesta: sí, el 50 % — fuente: usuario 2026-09-29",
  "- A-2 — 2.3 — datos — ¿El recibo muestra el diagnóstico? — respuesta: pendiente — fuente: pendiente",
  "",
  "### Ronda 2",
  "- A-3 — 2.2 — derivada de A-1 — ¿El 50 % aplica a la primera sesión? — respuesta: pendiente — fuente: pendiente",
  "- A-4 — 2.2 — LATE — ¿Reemplaza al ADR-004? — respuesta: no — con matiz — fuente: usuario 2026-09-30",
  "",
  "## FILTRADAS",
  '- F-1 — 2.1 — ¿La tarifa es por paciente? — resuelta por: RN-001 — cita: "La tarifa se fija por paciente."',
  "",
  "## PREMISAS",
  '- PR-1 — 2.2 — 01-cobro: "como hoy, la sesión cerrada queda CERRADA" — VERIFICADA src/sesiones/estado.js:12',
  '- PR-2 — 2.3 — borrador: "el recibo ya existe" — FALSA src/recibos/index.js:1 → A-2',
  "",
  "## DECISIONES PERSISTIDAS",
  "- A-1 → business_requirements.md RN-002 (aclarado en revisión 2026-09-29-cobros)",
  "",
  "## SCOPE",
  "- 2.1: SCOPE 0123456789ab — 2026-09-29T18:00:00-03:00",
  "- 2.2: SCOPE abcdef012345 — 2026-09-29T18:00:00-03:00",
  "",
  "## APARCADOS",
  "(epics aparcados durante la ejecución)",
  "- 2.3 — 2026-09-30T10:00:00-03:00 — datos — retención — del recibo",
  "",
  "## EJECUCIÓN",
  "- 2.1: [x] 2026-09-30T09:00:00-03:00",
  "- 2.2: en curso",
  "- 2.3: aparcado",
  "",
  "## MÉTRICAS",
  "- review_rounds: 2 · review_questions: 4 · review_filtered: 1 · review_human_contacts: 2 · late_questions: 1 · premises_false: 1",
  ""
].join("\n");

// A register with the given header and SCOPE lines; the agenda has `pending` unanswered items.
function register({ id = "2026-09-29-cobros", estado = "CERRADA", epics = "2.1, 2.2, 2.3", pending = 0, scope = [] } = {}) {
  const agenda = [`- A-1 — 2.2 — dinero — ¿Se cobra la cancelada? — respuesta: sí — fuente: usuario 2026-09-29`];
  for (let i = 0; i < pending; i++) agenda.push(`- A-${i + 2} — 2.3 — datos — ¿Pregunta ${i + 2}? — respuesta: pendiente — fuente: pendiente`);
  return [
    `# Revisión de tanda — ${id}`,
    "",
    `- ID: ${id}`,
    `- ESTADO: ${estado}`,
    `- EPICS: ${epics}`,
    "- REGULATORIOS: (ninguno)",
    "",
    "## AGENDA",
    "### Ronda 1",
    ...agenda,
    "",
    "## SCOPE",
    ...scope,
    "",
    "## MÉTRICAS",
    "- review_rounds: 1 · review_questions: 1",
    ""
  ].join("\n");
}

function createProject({ roadmap: rm = roadmap(), requirements: req = requirements(), reviews = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-review-"));
  temporaryDirectories.push(root);
  write(root, ".specture/stack.yml", "schema: 1\n");
  if (rm !== null) write(root, "docs/04-roadmap/ROADMAP.md", rm);
  if (req !== null) write(root, "docs/01-requirements/business_requirements.md", req);
  for (const [name, text] of Object.entries(reviews)) write(root, `docs/05-specs/_reviews/${name}`, text);
  return root;
}

function runReview(root, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args, "--project", root], { encoding: "utf8" });
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, lines, token: lines[0] || "", json: args.includes("--json") && result.stdout ? JSON.parse(result.stdout) : null };
}

// The SCOPE lines of a register, computed from the project's current ROADMAP and requirements.
function scopeLines(root, ids) {
  const rm = fs.readFileSync(path.join(root, "docs", "04-roadmap", "ROADMAP.md"), "utf8");
  const req = fs.readFileSync(path.join(root, "docs", "01-requirements", "business_requirements.md"), "utf8");
  return ids.map((id) => `- ${id}: SCOPE ${planning.scopeHash(rm, id, req)} — 2026-09-29T18:00:00-03:00`);
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------
// parseBatchReview
// ---------------------------------------------------------------------------------------

test("parseBatchReview: a complete register parses every grammar line and has no errors", () => {
  const r = review.parseBatchReview(COMPLETE);
  assert.deepEqual(r.errors, []);
  assert.equal(r.id, "2026-09-29-cobros");
  assert.equal(r.estado, "RONDA-2");
  assert.deepEqual(r.epics, ["2.1", "2.2", "2.3"]);
  assert.deepEqual(r.regulatorios, ["2.3"]);
  assert.deepEqual(r.agenda, [
    { id: "A-1", ronda: 1, epic: "2.2", clase: "dinero", pregunta: "¿Se cobra la sesión cancelada con menos de 24 h?", respuesta: "sí, el 50 %", fuente: "usuario 2026-09-29" },
    { id: "A-2", ronda: 1, epic: "2.3", clase: "datos", pregunta: "¿El recibo muestra el diagnóstico?", respuesta: null, fuente: null },
    { id: "A-3", ronda: 2, epic: "2.2", clase: "derivada de A-1", pregunta: "¿El 50 % aplica a la primera sesión?", respuesta: null, fuente: null },
    { id: "A-4", ronda: 2, epic: "2.2", clase: "LATE", pregunta: "¿Reemplaza al ADR-004?", respuesta: "no — con matiz", fuente: "usuario 2026-09-30" }
  ]);
  assert.deepEqual(r.filtradas, [{ id: "F-1", epic: "2.1", pregunta: "¿La tarifa es por paciente?", resueltaPor: "RN-001", cita: "La tarifa se fija por paciente." }]);
  assert.deepEqual(r.premisas, [
    { id: "PR-1", epic: "2.2", estado: "VERIFICADA", ref: "src/sesiones/estado.js:12", destino: null },
    { id: "PR-2", epic: "2.3", estado: "FALSA", ref: "src/recibos/index.js:1", destino: "A-2" }
  ]);
  assert.deepEqual(r.scope, {
    "2.1": { sha: "0123456789ab", ts: "2026-09-29T18:00:00-03:00" },
    "2.2": { sha: "abcdef012345", ts: "2026-09-29T18:00:00-03:00" }
  });
  assert.deepEqual(r.aparcados, [{ epic: "2.3", ts: "2026-09-30T10:00:00-03:00", clase: "datos", motivo: "retención — del recibo" }]);
  assert.deepEqual(r.ejecucion, { "2.1": "hecho", "2.2": "en curso", "2.3": "aparcado" });
  assert.deepEqual(r.metricas, { review_rounds: 2, review_questions: 4, review_filtered: 1, review_human_contacts: 2, late_questions: 1, premises_false: 1 });
  // CRLF parses the same.
  assert.deepEqual(review.parseBatchReview(COMPLETE.replace(/\n/g, "\r\n")), r);
});

test("parseBatchReview: missing ID/ESTADO/EPICS, malformed item lines (A-n, F-n, PR-n, SCOPE, APARCADOS, EJECUCIÓN) and template leftovers are errors", () => {
  const text = [
    "# Revisión de tanda — x",
    "",
    "- ESTADO: ABIERTA",
    "- EPICS: <X.Y>, 2.2",
    "",
    "## AGENDA",
    "### Ronda 1",
    "- A-1 — 2.2 — dinero — sin respuesta",
    "- A-2: 2.2 — pregunta — respuesta: sí",
    "- A-3 — <X.Y> — <dinero | legal> — <pregunta cerrada> — respuesta: pendiente — fuente: pendiente",
    "",
    "## FILTRADAS",
    "- F-1 — 2.2 — sin fuente que la resuelva",
    "",
    "## PREMISAS",
    "- PR-1 — 2.2 — premisa sin estado",
    "",
    "## SCOPE",
    "- 2.2: SCOPE xyz",
    "- <X.Y>: SCOPE <sha12> — <ISO-8601>",
    "",
    "## APARCADOS",
    "- 2.2 aparcado sin gramática",
    "",
    "## EJECUCIÓN",
    "- 2.2: quizás"
  ].join("\n");
  const r = review.parseBatchReview(text);
  const expected = [
    /^falta la línea `- ID:`/,
    /^ESTADO desconocido: ABIERTA/,
    /^EPICS: .*<X\.Y>.*plantilla/,
    /^AGENDA: línea A-n mal formada: - A-1 — 2\.2 — dinero — sin respuesta/,
    /^AGENDA: línea A-n mal formada: - A-2: 2\.2/,
    /^AGENDA: .*plantilla.*A-3/,
    /^FILTRADAS: línea F-n mal formada: - F-1/,
    /^PREMISAS: línea PR-n mal formada: - PR-1/,
    /^SCOPE: línea mal formada: - 2\.2: SCOPE xyz/,
    /^SCOPE: .*plantilla/,
    /^APARCADOS: línea mal formada: - 2\.2 aparcado sin gramática/,
    /^EJECUCIÓN: línea mal formada: - 2\.2: quizás/
  ];
  for (const re of expected) assert.ok(r.errors.some((e) => re.test(e)), `${re}\n${r.errors.join("\n")}`);
  assert.equal(r.errors.length, expected.length, r.errors.join("\n"));
  assert.equal(r.estado, null);
  assert.deepEqual(r.epics, ["2.2"]);
  assert.deepEqual(r.agenda, []);

  const empty = review.parseBatchReview("# nada\n");
  assert.deepEqual(empty.errors, ["falta la línea `- ID:`", "falta la línea `- ESTADO:`", "falta la línea `- EPICS:`"]);
});

// ---------------------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------------------

test("status NONE: no _reviews folder, or every register EJECUTADA", () => {
  const none = runReview(createProject(), ["status"]);
  assert.equal(none.status, 0, none.stderr);
  assert.equal(none.token, "REVIEW: NONE");

  const executed = runReview(createProject({ reviews: { "2026-09-01-a.md": register({ id: "2026-09-01-a", estado: "EJECUTADA" }) } }), ["status"]);
  assert.equal(executed.status, 0);
  assert.equal(executed.token, "REVIEW: NONE");
});

test("status OPEN: the current register in PREPARANDO/RONDA-n with its pending agenda items", () => {
  const root = createProject({ reviews: { "2026-09-29-cobros.md": register({ estado: "RONDA-1", pending: 2 }) } });
  const r = runReview(root, ["status"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.token, "REVIEW: OPEN 2026-09-29-cobros RONDA-1 pendientes:2");
  assert.ok(r.lines.some((l) => /A-2/.test(l)), r.stdout);

  const json = runReview(root, ["status", "--json"]).json;
  assert.equal(json.token, "REVIEW: OPEN 2026-09-29-cobros RONDA-1 pendientes:2");
  assert.equal(json.status, "OPEN");
  assert.equal(json.pendientes, 2);
});

test("status CLOSED / DRAINED: por-ejecutar and aparcados come from the ROADMAP", () => {
  const reviews = { "2026-09-29-cobros.md": register({ estado: "CERRADA" }) };
  const closed = runReview(createProject({ roadmap: roadmap({ states: { "2.1": "x" }, parked: ["2.2"] }), reviews }), ["status"]);
  assert.equal(closed.status, 0, closed.stderr);
  assert.equal(closed.token, "REVIEW: CLOSED 2026-09-29-cobros por-ejecutar:1 aparcados:1");
  assert.ok(closed.lines.some((l) => /por ejecutar: 2\.3/.test(l)), closed.stdout);

  // A [/] epic is still to execute; nothing parked.
  const running = runReview(createProject({ roadmap: roadmap({ states: { "2.1": "x", "2.2": "/" } }), reviews }), ["status"]);
  assert.equal(running.token, "REVIEW: CLOSED 2026-09-29-cobros por-ejecutar:2 aparcados:0");

  const drained = runReview(createProject({ roadmap: roadmap({ states: { "2.1": "x", "2.3": "x" }, parked: ["2.2"] }), reviews }), ["status"]);
  assert.equal(drained.status, 0);
  assert.equal(drained.token, "REVIEW: DRAINED 2026-09-29-cobros");
});

test("status: the current register is the last by name whose ESTADO is not EJECUTADA; a malformed one is exit 2", () => {
  const older = register({ id: "2026-09-01-a", estado: "CERRADA", epics: "2.3" });
  const newer = register({ id: "2026-09-15-b", estado: "EJECUTADA" });
  const r = runReview(createProject({ reviews: { "2026-09-01-a.md": older, "2026-09-15-b.md": newer } }), ["status"]);
  assert.equal(r.token, "REVIEW: CLOSED 2026-09-01-a por-ejecutar:1 aparcados:0");

  const malformed = register({ id: "2026-09-20-c", estado: "RONDA-1" }).replace("- A-1 — 2.2 — dinero —", "- A-1 — 2.2 —");
  const bad = runReview(createProject({ reviews: { "2026-09-01-a.md": older, "2026-09-20-c.md": malformed } }), ["status"]);
  assert.equal(bad.status, 2, bad.stdout);
  assert.match(bad.token, /^REVIEW: UNVERIFIABLE registro mal formado: docs\/05-specs\/_reviews\/2026-09-20-c\.md/);
  assert.ok(bad.lines.some((l) => /^- AGENDA: línea A-n mal formada/.test(l)), bad.stdout);
});

// ---------------------------------------------------------------------------------------
// scope-hash / scope-check
// ---------------------------------------------------------------------------------------

test("scope-hash --epic prints SCOPE <X.Y>: <sha12> equal to planning.scopeHash; an unknown epic is exit 2", () => {
  const root = createProject();
  const r = runReview(root, ["scope-hash", "--epic", "2.2"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.token, `SCOPE 2.2: ${planning.scopeHash(roadmap(), "2.2", requirements())}`);
  assert.match(r.token, /^SCOPE 2\.2: [0-9a-f]{12}$/);

  const unknown = runReview(root, ["scope-hash", "--epic", "9.9"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.token, /^SCOPE 9\.9: UNVERIFIABLE/);
  assert.equal(runReview(root, ["scope-hash"]).status, 2, "--epic is required");
});

test("scope-check: SAME (the checkbox does not count), CHANGED (epic description or linked RN), MISSING; exit 0/1/2", () => {
  const root = createProject();
  const scope = scopeLines(root, ["2.1", "2.2"]);
  write(root, "docs/05-specs/_reviews/2026-09-29-cobros.md", register({ scope }));
  const [, old22] = scope[1].match(/SCOPE ([0-9a-f]{12})/);

  const same = runReview(root, ["scope-check", "--batch", "2026-09-29-cobros", "--epic", "2.2"]);
  assert.equal(same.status, 0, same.stdout + same.stderr);
  assert.equal(same.token, "REVIEW scope-check: SAME 1");
  assert.deepEqual(same.lines.slice(1), ["- SCOPE 2.2: SAME"]);

  write(root, "docs/04-roadmap/ROADMAP.md", roadmap({ states: { "2.1": "x", "2.2": "/" } }));
  assert.equal(runReview(root, ["scope-check", "--batch", "2026-09-29-cobros", "--epic", "2.2"]).status, 0, "[ ] → [/] is not a scope change");

  write(root, "docs/04-roadmap/ROADMAP.md", roadmap({ descriptions: { "2.2": "Cobrar la sesión al agendarla." } }));
  const changed = runReview(root, ["scope-check", "--batch", "2026-09-29-cobros", "--epic", "2.2"]);
  assert.equal(changed.status, 1);
  assert.equal(changed.token, "REVIEW scope-check: CHANGED 1");
  const now22 = planning.scopeHash(roadmap({ descriptions: { "2.2": "Cobrar la sesión al agendarla." } }), "2.2", requirements());
  assert.deepEqual(changed.lines.slice(1), [`- SCOPE 2.2: CHANGED ${old22}→${now22}`]);

  write(root, "docs/04-roadmap/ROADMAP.md", roadmap());
  write(root, "docs/01-requirements/business_requirements.md", requirements({ rn002: "Una sesión cancelada se cobra completa." }));
  const rn = runReview(root, ["scope-check", "--batch", "2026-09-29-cobros"]);
  assert.equal(rn.status, 1);
  assert.equal(rn.token, "REVIEW scope-check: CHANGED 2");
  assert.deepEqual(rn.lines.slice(1).map((l) => l.replace(/[0-9a-f]{12}→[0-9a-f]{12}/, "<sha>")), ["- SCOPE 2.1: SAME", "- SCOPE 2.2: CHANGED <sha>", "- SCOPE 2.3: MISSING"]);

  write(root, "docs/01-requirements/business_requirements.md", requirements());
  const missing = runReview(root, ["scope-check", "--batch", "2026-09-29-cobros", "--epic", "2.3"]);
  assert.equal(missing.status, 1);
  assert.equal(missing.token, "REVIEW scope-check: CHANGED 1");
  assert.deepEqual(missing.lines.slice(1), ["- SCOPE 2.3: MISSING"]);

  const noRegister = runReview(root, ["scope-check", "--batch", "2026-01-01-otra"]);
  assert.equal(noRegister.status, 2);
  assert.match(noRegister.token, /^REVIEW scope-check: UNVERIFIABLE/);
  assert.equal(runReview(root, ["scope-check"]).status, 2, "--batch is required");
});

test("CLI: an unknown option or command is a usage error (exit 2), never ignored", () => {
  const root = createProject();
  const option = runReview(root, ["status", "--epic", "2.1"]);
  assert.equal(option.status, 2);
  assert.match(option.stdout + option.stderr, /unknown option --epic/);
  const flag = runReview(root, ["scope-hash", "--epic", "2.1", "--draft"]);
  assert.equal(flag.status, 2);
  assert.match(flag.stdout + flag.stderr, /unknown option --draft/);
  const command = runReview(root, ["close"]);
  assert.equal(command.status, 2);
  assert.match(command.stdout + command.stderr, /unknown command close/);
});

test("scope-hash / scope-check: hyphenated epic ids (HC-IHCE.5) are kept whole", () => {
  const rm = roadmap().replace(/Epic 2\.2:/, "Epic HC-IHCE.5:");
  const root = createProject({ roadmap: rm });
  const hash = runReview(root, ["scope-hash", "--epic", "HC-IHCE.5"]);
  assert.equal(hash.status, 0, hash.stdout);
  assert.equal(hash.token, `SCOPE HC-IHCE.5: ${planning.scopeHash(rm, "HC-IHCE.5", requirements())}`);
  write(root, "docs/05-specs/_reviews/2026-09-29-cobros.md", register({ epics: "2.1, HC-IHCE.5", scope: [`- HC-IHCE.5: SCOPE ${hash.token.split(" ")[2]} — 2026-09-29T18:00:00-03:00`] }));
  const check = runReview(root, ["scope-check", "--batch", "2026-09-29-cobros", "--epic", "HC-IHCE.5"]);
  assert.equal(check.status, 0, check.stdout);
  assert.deepEqual(check.lines.slice(1), ["- SCOPE HC-IHCE.5: SAME"]);
});
