// Text rendering of a doctor result.

const ORDER = { ERROR: 0, WARNING: 1, INFO: 2 };

function sortFindings(findings) {
  return [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.group.localeCompare(b.group) || a.check.localeCompare(b.check) || String(a.file).localeCompare(String(b.file)));
}

function pad(text, width) {
  const s = String(text);
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function formatBrief(result) {
  const drift = result.drift;
  const pending = drift.migrations.filter((m) => m.status === "pending");
  const kinds = ["mechanical", "assisted", "content"].map((k) => `${pending.filter((m) => m.kind === k).length} ${k}`).join(", ");
  return `doctor: ${result.counts.ERROR} ERROR, ${result.counts.WARNING} WARNING · schema ${drift.schemaVersion || "(none)"} → plugin ${drift.pluginVersion} · pending migrations: ${pending.length} (${kinds})`;
}

function formatTable(result) {
  const out = [];
  out.push(`Specture doctor — ${result.root}`);
  out.push(`plugin ${result.drift.pluginVersion} · schema_version ${result.drift.schemaVersion || "(none)"} · settings from ${result.settingsSource}`);
  out.push("");
  const findings = sortFindings(result.findings);
  if (findings.length === 0) {
    out.push("No findings. The project is in sync with the installed plugin.");
  } else {
    const w1 = Math.max(8, ...findings.map((f) => f.severity.length));
    const w2 = Math.max(5, ...findings.map((f) => f.check.length));
    out.push(`${pad("SEVERITY", w1)}  ${pad("CHECK", w2)}  DETAIL`);
    for (const f of findings) {
      out.push(`${pad(f.severity, w1)}  ${pad(f.check, w2)}  ${f.file ? `${f.file} — ` : ""}${f.detail}`);
      out.push(`${pad("", w1)}  ${pad("", w2)}  → ${f.action}`);
    }
  }
  out.push("");
  const migrations = result.drift.migrations;
  if (migrations.length > 0) {
    out.push("Migrations (catalog ≤ plugin version):");
    for (const m of migrations) {
      out.push(`  ${pad(m.status, 8)} ${pad(m.kind, 10)} ${m.id} — ${m.title}`);
    }
    out.push("");
  }
  out.push(`${result.counts.ERROR} ERROR · ${result.counts.WARNING} WARNING · ${result.counts.INFO} INFO`);
  return out.join("\n");
}

module.exports = { formatBrief, formatTable, sortFindings };
