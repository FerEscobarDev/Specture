const assert = require("node:assert/strict");
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
