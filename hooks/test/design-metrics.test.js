const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const metrics = require("../lib/design-metrics");
const dirs = [];

function project(lines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specture-design-metrics-"));
  dirs.push(root);
  if (lines !== null) {
    const abs = path.join(root, "docs", ".specture-meta", "design-metrics.jsonl");
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");
  }
  return root;
}

const run = (over = {}) => ({
  phase: "design", ts: "2026-09-11T10:00:00Z", level: "C", brand_provenance: "usuario",
  directions_generated: 3, directions_regenerated: 0, components_total: 20, components_deferred: 2,
  enums_total: 4, enums_covered: 4, contrast_blockers: 0, allow_overrides: 0, outcome: "completa", ...over
});

afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true }); });

test("a missing file is not an error — the phase creates it", () => {
  const result = metrics.summarize(project(null));
  assert.equal(result.exists, false);
  assert.match(metrics.render(result), /no existe todavía/);
});

test("malformed lines and foreign lines are skipped, never fatal", () => {
  const result = metrics.summarize(project([run(), "{no es json", { epic: "1.1", source: "gate" }]));
  assert.equal(result.total, 1, "la línea de build-metrics no cuenta como corrida de diseño");
  assert.equal(result.skipped, 2);
});

test("aggregates sum, and a field nobody measured stays null instead of collapsing to zero", () => {
  const result = metrics.summarize(project([run(), run({ components_deferred: 8, enums_covered: 2, contrast_blockers: null })]));
  assert.equal(result.aggregate.runs, 2);
  assert.equal(result.aggregate.components_deferred, 10);
  assert.equal(result.aggregate.enums_covered, 6);
  assert.equal(metrics.aggregate([run({ contrast_blockers: null })]).contrast_blockers, null, "null no es 0");
});

test("the reading flags a proposed brand, a high deferral share, and uncovered enums", () => {
  const r = metrics.summarize(project([run({ brand_provenance: "PROPUESTO_POR_EL_AGENTE", components_deferred: 15, enums_covered: 1 })])).reading;
  assert.ok(r.some((l) => /marca propuesta por el agente/.test(l)), r.join(" | "));
  assert.ok(r.some((l) => /por encima del 30%/.test(l)));
  assert.ok(r.some((l) => /3 enum\(s\) sin componente/.test(l)));
});

test("the reading never claims to measure design quality", () => {
  const r = metrics.summarize(project([run()])).reading;
  assert.ok(r.some((l) => /miden el proceso, nunca la calidad/.test(l)), r.join(" | "));
});
