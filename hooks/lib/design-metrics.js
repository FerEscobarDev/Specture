#!/usr/bin/env node
// Design-phase metrics — reader for `docs/.specture-meta/design-metrics.jsonl`.
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/design-metrics.js" [--project <root>] [--json] [--last N]
//
// A sibling of `build-metrics.jsonl`, deliberately NOT the same file: a Phase 03 run has no
// `epic`, and `metrics-report.js` discards every line without that field, while `summarize()`
// folds everything that is not `source: "baseline"` into the gate aggregate. Sharing would drop
// the design lines or poison the Spec Planning Gate reading — the exact failure this file avoids.
//
// One JSON line per Phase 03 run, appended by `ux-design` (Step 6). Fail-open: a malformed line
// is skipped, never fatal.
//
// Why it exists: three open decisions — whether the coverage gate blocks or reports, how
// genericity would be measured at all, and whether the baseline is worth repeating — all depend
// on data nobody was collecting. Shipping gates without instrumenting them means closing those
// by opinion. No dependencies (repo invariant).

const fs = require("fs");
const path = require("path");

const METRICS_FILE = path.join("docs", ".specture-meta", "design-metrics.jsonl");

// Numeric fields aggregated across runs. `null` in a line means "not measured", not zero.
const NUMERIC = [
  "directions_generated",
  "directions_regenerated",
  "visual_approval_rounds",
  "components_total",
  "components_deferred",
  "enums_total",
  "enums_covered",
  "contrast_blockers",
  "allow_overrides"
];

function read(projectRoot) {
  const file = path.join(projectRoot, METRICS_FILE);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { exists: false, entries: [], skipped: 0 };
  }
  const entries = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === "object" && obj.phase === "design") entries.push(obj);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { exists: true, entries, skipped };
}

const sum = (entries, key) => {
  const present = entries.map((e) => e[key]).filter((v) => typeof v === "number");
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
};

function aggregate(entries) {
  const out = { runs: entries.length };
  for (const key of NUMERIC) out[key] = sum(entries, key);
  out.levels = entries.reduce((acc, e) => {
    const level = e.level || "sin declarar";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  out.provenance = entries.reduce((acc, e) => {
    const p = e.brand_provenance || "sin declarar";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  return out;
}

// What the numbers are allowed to conclude — and what they are not.
function reading(agg) {
  const out = [];
  if (agg.runs === 0) return ["Sin corridas registradas todavía."];

  const proposed = agg.provenance["PROPUESTO_POR_EL_AGENTE"] || 0;
  if (proposed > 0) {
    out.push(`${proposed} de ${agg.runs} corrida(s) con la marca propuesta por el agente: el gate visual debe confirmarlas antes de construir páginas.`);
  }
  if (agg.components_total && agg.components_deferred !== null) {
    const share = Math.round((agg.components_deferred / agg.components_total) * 100);
    out.push(
      share > 30
        ? `${share}% del inventario diferido — por encima del 30%: revisar si la escotilla \`deferred\` se está usando para esquivar el gate de cobertura.`
        : `${share}% del inventario diferido.`
    );
  }
  if (agg.enums_total !== null && agg.enums_covered !== null && agg.enums_total > agg.enums_covered) {
    out.push(`${agg.enums_total - agg.enums_covered} enum(s) sin componente: cada enum necesita un tratamiento visual con una variante por miembro.`);
  }
  if (agg.directions_regenerated) {
    out.push(`${agg.directions_regenerated} regeneración(es) por divergencia insuficiente — el gate está mordiendo.`);
  }
  out.push("Estas cifras miden el proceso, nunca la calidad del diseño: no hay medida de genericidad y no se envió ninguna (ver docs/frontend-design-baseline.md).");
  return out;
}

function summarize(projectRoot, opts = {}) {
  const { exists, entries, skipped } = read(projectRoot);
  const selected = opts.last ? entries.slice(-opts.last) : entries;
  const agg = aggregate(selected);
  return { file: METRICS_FILE.replace(/\\/g, "/"), exists, total: entries.length, shown: selected.length, skipped, entries: selected, aggregate: agg, reading: exists ? reading(agg) : [] };
}

function render(result) {
  if (!result.exists) return `design-metrics: ${result.file} no existe todavía — la Fase 03 lo crea en su Step 6.`;
  const a = result.aggregate;
  const n = (v) => (v === null ? "—" : v);
  const pairs = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(" · ") || "—";
  return [
    `design-metrics: ${result.shown} de ${result.total} corrida(s)${result.skipped ? ` · ${result.skipped} línea(s) malformada(s) ignorada(s)` : ""}`,
    `  niveles        ${pairs(a.levels)}`,
    `  procedencia    ${pairs(a.provenance)}`,
    `  direcciones    generadas:${n(a.directions_generated)} · regeneradas:${n(a.directions_regenerated)}`,
    `  aprobación     rondas:${n(a.visual_approval_rounds)}`,
    `  inventario     total:${n(a.components_total)} · diferidos:${n(a.components_deferred)}`,
    `  enums          ${n(a.enums_covered)}/${n(a.enums_total)} cubiertos`,
    `  contraste      bloqueos:${n(a.contrast_blockers)} · overrides allow:${n(a.allow_overrides)}`,
    "",
    ...result.reading.map((r) => `  → ${r}`)
  ].join("\n");
}

function main(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  const root = path.resolve(flag("--project") || process.cwd());
  const last = flag("--last");
  const result = summarize(root, { last: last ? Number(last) : null });
  process.stdout.write(`${argv.includes("--json") ? JSON.stringify(result, null, 2) : render(result)}\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { METRICS_FILE, NUMERIC, read, aggregate, reading, summarize, render };
