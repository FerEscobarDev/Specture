const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test } = require("node:test");
const planning = require("../lib/planning");

test("parseSpec: Supersede lines accept BR, AC and GAP motives and an optional acción", () => {
  const text = [
    "# SPEC: x",
    "",
    "## 10. Supersesiones de tests sellados",
    "- Supersede: `tests/a.test.js::rechaza titulo repetido` — motivo: BR-2 — epic origen: epic-0.9",
    "- Supersede: `tests/b.test.js::mantiene el campo viejo` — motivo: AC-3 — epic origen: epic-1.2 — acción: retirar",
    "- Supersede: `tests/c.test.js::usa la tabla vieja` -- motivo: GAP-DB-003 -- epic origen: 2.1 -- acción: reescribir",
    "- Supersede: `tests/d.test.js::sin motivo valido` — motivo: RN-001 — epic origen: 1.1",
    ""
  ].join("\n");
  const { supersedes } = planning.parseSpec(text, "01-x");
  assert.deepEqual(supersedes, [
    { path: "tests/a.test.js", test: "rechaza titulo repetido", motivo: "BR-2", br: "BR-2", accion: null },
    { path: "tests/b.test.js", test: "mantiene el campo viejo", motivo: "AC-3", br: null, accion: "retirar" },
    { path: "tests/c.test.js", test: "usa la tabla vieja", motivo: "GAP-DB-003", br: null, accion: "reescribir" }
  ]);
});

test("parseCoverageTable: sup: rows accept BR, AC and GAP motives without moving the hash", () => {
  const doc = (rows) => `# Planning\n\n## COVERAGE_TABLE\n${rows}\n\n## OPEN_QUESTIONS\n- (ninguna)\n`;
  const rows = [
    "- sup: tests/a.test.js::rechaza titulo repetido → 01-x (BR-2)",
    "- sup: tests/b.test.js::mantiene el campo viejo → 01-x (AC-3)",
    "- sup: tests/c.test.js::usa la tabla vieja → 02-y (GAP-DB-003)"
  ].join("\n");
  const parsed = planning.parseCoverageTable(doc(rows));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    parsed.rows.sup.map((r) => [r.path, r.test, r.slug, r.motivo, r.br]),
    [
      ["tests/a.test.js", "rechaza titulo repetido", "01-x", "BR-2", "BR-2"],
      ["tests/b.test.js", "mantiene el campo viejo", "01-x", "AC-3", null],
      ["tests/c.test.js", "usa la tabla vieja", "02-y", "GAP-DB-003", null]
    ]
  );
  // The hash is over the raw row lines: parsing more motives never moves an existing token.
  assert.equal(planning.coverageHash(doc(rows)), planning.coverageHash(doc(rows) + "\n## VEREDICTOS\n### set — dispatch 1\n"));
});

test("parseSupersessionRegister: supersede and red-fix lines with the v2.2 fields; legacy lines still parse", () => {
  const text = [
    "# Planning — e",
    "",
    "## SUPERSESIONES (registro; lo completa el epic-agent)",
    "- tests/a.test.js::rechaza titulo repetido — motivo: BR-2 — spec: 01-x — commit: pendiente",
    "- tests/b.test.js::mantiene el campo viejo — motivo: AC-3 — spec: 01-x — commit: 1a2b3c4d — loop: runtime — j9: SÍ — acción: retirar",
    "- tests/c.test.js::usa la tabla vieja — motivo: GAP-001 — spec: 02-y — commit: sin cambio — loop: compilación",
    "- red-fix: tests/01-x.test.js — spec: 01-x — commit: abcdef0",
    "",
    "## VEREDICTOS",
    "- tests/z.test.js::no es del registro — motivo: BR-1 — spec: 01-x — commit: 1234567"
  ].join("\n");
  const reg = planning.parseSupersessionRegister(text);
  assert.equal(reg.length, 4);
  assert.deepEqual(
    reg.map(({ raw, ...rest }) => rest),
    [
      { kind: "supersede", path: "tests/a.test.js", test: "rechaza titulo repetido", motivo: "BR-2", slug: "01-x", commit: null, loop: null, j9: null, accion: null },
      { kind: "supersede", path: "tests/b.test.js", test: "mantiene el campo viejo", motivo: "AC-3", slug: "01-x", commit: "1a2b3c4d", loop: "runtime", j9: "SÍ", accion: "retirar" },
      { kind: "supersede", path: "tests/c.test.js", test: "usa la tabla vieja", motivo: "GAP-001", slug: "02-y", commit: "sin cambio", loop: "compilación", j9: null, accion: null },
      { kind: "red-fix", path: "tests/01-x.test.js", test: null, motivo: null, slug: "01-x", commit: "abcdef0", loop: null, j9: null, accion: null }
    ]
  );
  // The bare `SUPERSESIONES:` label form of the v1.17.0 planner parses too.
  const label = "SUPERSESIONES:\n- tests/a.test.js::t — motivo: BR-1 — spec: 01-x — commit: pendiente\n\nCHANGELOG:\n- x";
  assert.equal(planning.parseSupersessionRegister(label).length, 1);
  assert.deepEqual(planning.parseSupersessionRegister("# nada"), []);
});

test("parseVerdictHeaders: the v2.2 header with rounds, trees and flags; the legacy headers still parse", () => {
  const text = [
    "## VEREDICTOS",
    "### set — dispatch 1 — 2026-09-23",
    "STATUS: REJECTED",
    "### 03-consentimiento — dispatch 2 — 2026-09-24 (loop de corrección)",
    "### set — dispatch 3 — ronda 2 — 2026-09-28T14:05:00-05:00 — tree 0123456789ab — head ba9876543210 — delta",
    "### 01-x — dispatch 4 — ronda 1 — 2026-09-28T15:00:00Z — tree aaaaaaaaaaaa — head bbbbbbbbbbbb — loop — J9"
  ].join("\n");
  const headers = planning.parseVerdictHeaders(text);
  assert.deepEqual(
    headers.map(({ raw, ...rest }) => rest),
    [
      { target: "set", dispatch: 1, ronda: null, ts: "2026-09-23", tree: null, head: null, delta: false, loop: false, j9: false },
      { target: "03-consentimiento", dispatch: 2, ronda: null, ts: "2026-09-24", tree: null, head: null, delta: false, loop: true, j9: false },
      { target: "set", dispatch: 3, ronda: 2, ts: "2026-09-28T14:05:00-05:00", tree: "0123456789ab", head: "ba9876543210", delta: true, loop: false, j9: false },
      { target: "01-x", dispatch: 4, ronda: 1, ts: "2026-09-28T15:00:00Z", tree: "aaaaaaaaaaaa", head: "bbbbbbbbbbbb", delta: false, loop: true, j9: true }
    ]
  );
  assert.deepEqual(planning.parseVerdictHeaders("### not a verdict\n## VEREDICTOS\n"), []);
});

// ---------------------------------------------------------------------------------------
// scopeHash — the fingerprint of an epic's scope the review stage records (v2.3.0)
// ---------------------------------------------------------------------------------------

function scopeRoadmap({ mark = " ", description = "Cobrar la sesión al cerrarla.", extra = [] } = {}) {
  return [
    "# ROADMAP",
    "",
    "### Milestone 2: Cobros",
    "",
    `- [${mark}] **Epic 2.1:** Cobro de sesiones`,
    "  - **Dependencias:** Ninguna",
    `  - **Descripción:** ${description}`,
    "  - **Reglas de negocio clave:** RN-001, RN-SEG-007, RN-009",
    ...extra,
    "  - **Operaciones del contrato:** `cobrarSesion`",
    "",
    "- [ ] **Epic 2.2:** Recibos",
    "  - **Dependencias:** Epic 2.1",
    "  - **Descripción:** Emitir el recibo.",
    "  - **Reglas de negocio clave:** RN-002",
    ""
  ].join("\n");
}

function scopeRequirements({ rn001 = "Toda sesión se cobra al cerrarla.", rn002 = "El recibo lleva el RUT." } = {}) {
  return [
    "# Requerimientos de Negocio",
    "",
    "## Historias de Usuario",
    "- **HU-COB-001:** Como psicóloga quiero cobrar · Actor: psicóloga · Exposición: `UI`",
    "",
    "## Reglas de Negocio",
    `- **RN-001:** ${rn001}`,
    "  El cobro usa la tarifa vigente del paciente.",
    `- **RN-002:** ${rn002}`,
    "",
    "| ID | Regla |",
    "|----|-------|",
    "| RN-SEG-007 | Solo el titular ve el cobro |",
    "| RN-SEG-008 | Otra regla de seguridad |",
    "",
    "## Casos Límite",
    "- **CL-001:** sesión sin tarifa → no se cobra",
    ""
  ].join("\n");
}

test("scopeHash: 12 hex, stable across the checkbox [ ] → [/] → [x], CRLF, spacing and the Aparcado/Diferidos lines", () => {
  const req = scopeRequirements();
  const base = planning.scopeHash(scopeRoadmap(), "2.1", req);
  assert.match(base, /^[0-9a-f]{12}$/);
  assert.equal(planning.scopeHash(scopeRoadmap({ mark: "/" }), "2.1", req), base);
  assert.equal(planning.scopeHash(scopeRoadmap({ mark: "x" }), "2.1", req), base);
  assert.equal(planning.scopeHash(scopeRoadmap().replace(/\n/g, "\r\n"), "2.1", req.replace(/\n/g, "\r\n")), base);
  assert.equal(planning.scopeHash(scopeRoadmap().replace(/\n/g, "   \n").replace("Cobrar la", "Cobrar    la"), "2.1", req), base);
  assert.equal(planning.scopeHash(scopeRoadmap().replace(/\n {2}- /g, "\n    - "), "2.1", req), base, "indentation is not scope");
  const parked = scopeRoadmap({
    extra: [
      "  - **Aparcado:** 2026-09-30T10:00:00-05:00 — datos — retención de fichas — tanda 2026-09-29-cobros",
      "  - **Diferidos heredados:** validar RUT — de Epic 1.3 (dispatch 2) · recibo en PDF — de Epic 1.4 (dispatch 1)"
    ]
  });
  assert.equal(planning.scopeHash(parked, "2.1", req), base);
  // The requirements file may change anywhere else: only the linked RN count.
  assert.equal(planning.scopeHash(scopeRoadmap(), "2.1", scopeRequirements({ rn002: "El recibo lleva el RUT y la fecha." })), base);
  assert.equal(planning.scopeHash(scopeRoadmap(), "9.9", req), null, "unknown epic");
});

test("scopeHash: moves when the epic block or the text of a linked RN changes; an absent RN counts as RN-xxx:MISSING", () => {
  const req = scopeRequirements();
  const base = planning.scopeHash(scopeRoadmap(), "2.1", req);
  assert.notEqual(planning.scopeHash(scopeRoadmap({ description: "Cobrar la sesión al agendarla." }), "2.1", req), base);
  assert.notEqual(planning.scopeHash(scopeRoadmap(), "2.1", scopeRequirements({ rn001: "Toda sesión se cobra al agendarla." })), base);
  assert.notEqual(planning.scopeHash(scopeRoadmap(), "2.1", req.replace("tarifa vigente del paciente", "tarifa base")), base, "a continuation line is part of the RN");
  assert.notEqual(planning.scopeHash(scopeRoadmap(), "2.1", req.replace("Solo el titular ve el cobro", "El titular y su tutor ven el cobro")), base, "a table row");

  const material = planning.scopeMaterial(scopeRoadmap(), "2.1", req);
  assert.ok(material.includes("RN-009:MISSING"), material);
  assert.ok(!material.includes("RN-001:MISSING"), material);
  assert.equal(planning.scopeHash(scopeRoadmap(), "2.1", req), crypto.createHash("sha256").update(material).digest("hex").slice(0, 12));
  const defined = req.replace("| RN-SEG-008 |", "- **RN-009:** Un cobro anulado no se borra.\n\n| RN-SEG-008 |");
  assert.notEqual(planning.scopeHash(scopeRoadmap(), "2.1", defined), base, "defining the missing RN moves the hash");
  // No requirements file at all: every linked RN is MISSING, never a silent skip.
  const bare = planning.scopeMaterial(scopeRoadmap(), "2.1", null);
  for (const rn of ["RN-001", "RN-SEG-007", "RN-009"]) assert.ok(bare.includes(`${rn}:MISSING`), bare);
});

test("rnDefinition: from the id line to a blank line, a heading or the next RN/CL/FA/HU id", () => {
  const req = scopeRequirements();
  assert.equal(planning.rnDefinition(req, "RN-001"), "- **RN-001:** Toda sesión se cobra al cerrarla.\nEl cobro usa la tarifa vigente del paciente.");
  assert.equal(planning.rnDefinition(req, "RN-002"), "- **RN-002:** El recibo lleva el RUT.");
  assert.equal(planning.rnDefinition(req, "RN-SEG-007"), "| RN-SEG-007 | Solo el titular ve el cobro |");
  assert.equal(planning.rnDefinition(req, "RN-009"), null);
  const heading = "## Reglas\n### RN-010 — Anulaciones\nUna anulación conserva el cobro.\n## Casos\n";
  assert.equal(planning.rnDefinition(heading, "RN-010"), "### RN-010 — Anulaciones\nUna anulación conserva el cobro.");
  assert.equal(planning.rnDefinition("- **RN-0010:** otra\n- **RN-001:** la buena\n", "RN-001"), "- **RN-001:** la buena", "RN-001 is not a prefix of RN-0010");
  assert.equal(planning.rnDefinition("- **RN-001:** a\n- **FA-001:** fuera\n", "RN-001"), "- **RN-001:** a");
});

test("parseEpicBlock: parked (the **Aparcado:** line) and diferidos (the **Diferidos heredados:** lines)", () => {
  const block = [
    "- [ ] **Epic 2.1:** Cobro de sesiones",
    "  - **Descripción:** d",
    "  - **Aparcado:** 2026-09-30T10:00:00-05:00 — datos — retención — de fichas — tanda 2026-09-29-cobros",
    "  - **Diferidos heredados:** validar RUT — de Epic 1.3 (dispatch 2) · recibo en PDF — de Epic 1.4 (dispatch 1)",
    "  - **Diferidos heredados:** folio correlativo — de Epic 1.5 (dispatch 1)"
  ].join("\n");
  const epic = planning.parseEpicBlock(block);
  assert.deepEqual(epic.parked, { ts: "2026-09-30T10:00:00-05:00", clase: "datos", motivo: "retención — de fichas", tanda: "2026-09-29-cobros" });
  assert.deepEqual(epic.diferidos, ["validar RUT — de Epic 1.3 (dispatch 2)", "recibo en PDF — de Epic 1.4 (dispatch 1)", "folio correlativo — de Epic 1.5 (dispatch 1)"]);

  const plain = planning.parseEpicBlock("- [ ] **Epic 2.2:** Recibos\n  - **Descripción:** d\n");
  assert.equal(plain.parked, null);
  assert.deepEqual(plain.diferidos, []);

  // A parked line without its tanda still parses what it has — the doctor reports the rest.
  const noBatch = planning.parseEpicBlock("- [ ] **Epic 2.3:** X\n  - **Aparcado:** 2026-09-30 — dinero — cobro parcial\n");
  assert.deepEqual(noBatch.parked, { ts: "2026-09-30", clase: "dinero", motivo: "cobro parcial", tanda: null });

  // parseRoadmapEpics carries both fields.
  const epics = planning.parseRoadmapEpics(scopeRoadmap({ extra: ["  - **Aparcado:** 2026-09-30 — legal — consentimiento — tanda 2026-09-29-cobros"] }));
  assert.equal(epics.find((e) => e.id === "2.1").parked.tanda, "2026-09-29-cobros");
  assert.equal(epics.find((e) => e.id === "2.2").parked, null);
});

test("parseGuards: GUARD lines with their test pointer; lines without a pointer are skipped", () => {
  const text = [
    "## Guards",
    "- **GUARD-1:** nunca borra el consentimiento firmado → test: `tests/consent.test.js::no borra el firmado`",
    "- **GUARD-2:** conserva la auditoría → test: tests/audit.test.js::conserva auditoria",
    "- **GUARD-3:** sin test declarado"
  ].join("\n");
  assert.deepEqual(planning.parseGuards(text), [
    { id: "GUARD-1", path: "tests/consent.test.js", test: "no borra el firmado" },
    { id: "GUARD-2", path: "tests/audit.test.js", test: "conserva auditoria" }
  ]);
});
