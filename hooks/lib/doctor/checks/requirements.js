// Requirements lint — mechanical checks over docs/01-requirements/business_requirements.md
// (the discover deliverable). Every finding: { severity, group: "requirements", check, file, detail, action }.
// No-op when the file does not exist (pre-discover projects and fresh setups).

const { lines } = require("../project");
const { extractSection } = require("../../../../migrations/lib");

const REQ = "docs/01-requirements/business_requirements.md";
const HU_ID = /\b(HU-[A-Z0-9-]+)\b/i;
const STABLE_ID = { rn: /\bRN-[A-Z0-9]*-?\d+\b/, cl: /\bCL-[A-Z0-9]*-?\d+\b/, fa: /\bFA-[A-Z0-9]*-?\d+\b/ };
const PLACEHOLDER = /\b(?:TBD|TODO)\b|\bdefinir (?:luego|despu[eé]s|m[aá]s adelante)\b/;
const EXPOSICION = /Exposici[oó]n/i;

function finding(severity, check, detail, action) {
  return { severity, group: "requirements", check, file: REQ, detail, action };
}

// Splits a section body into top-level bullet blocks (a `- ` line plus its indented continuation).
function bulletBlocks(sectionText) {
  const blocks = [];
  for (const line of lines(sectionText)) {
    if (/^-\s+\S/.test(line)) blocks.push([line]);
    else if (/^\s+\S/.test(line) && blocks.length > 0) blocks[blocks.length - 1].push(line);
  }
  return blocks.map((b) => b.join("\n"));
}

function isEmptyMarker(block) {
  return /^-\s*\**\s*(?:Ninguna|Ninguno|N\/A|No aplica)\b/i.test(block.trim());
}

function placeholders(text) {
  const hits = [];
  for (const line of lines(text)) {
    if (line.startsWith(">")) continue; // template guidance quotes
    const match = line.match(PLACEHOLDER);
    if (match) hits.push(match[0]);
  }
  if (hits.length === 0) return [];
  return [finding("ERROR", "req-placeholder", `${hits.length} unresolved placeholder(s) (e.g. "${hits[0]}")`, "resolve every TBD/TODO with the user before handing off to architecture")];
}

function stories(text) {
  const out = [];
  const section = extractSection(text, /^#{2,4}\s.*Historias/i);
  if (section === null) return out;
  const noExposicion = [];
  const external = [];
  for (const block of bulletBlocks(section)) {
    const id = block.match(HU_ID);
    if (!id) continue;
    if (!EXPOSICION.test(block)) noExposicion.push(id[1]);
    if (/\bAPI-externa\b/.test(block) || /Exposici[oó]n:?[^\n]*\bUI\b/i.test(block)) external.push(id[1]);
  }
  if (noExposicion.length > 0) {
    out.push(finding("WARNING", "req-hu-exposicion", `${noExposicion.length} user stor${noExposicion.length === 1 ? "y" : "ies"} without an Exposición mark (${noExposicion.slice(0, 3).join(", ")})`, "mark every HU with `Exposición: UI | API-externa | Interna`"));
  }
  const boundary = extractSection(text, /^#{2,4}\s.*Capacidades de Frontera/i);
  const uncovered = external.filter((id) => !boundary || !boundary.toUpperCase().includes(id.toUpperCase()));
  if (uncovered.length > 0) {
    out.push(finding("WARNING", "req-boundary-coverage", `${uncovered.length} UI/API-externa stor${uncovered.length === 1 ? "y is" : "ies are"} missing from "Capacidades de Frontera" (${uncovered.slice(0, 3).join(", ")})`, "consolidate every UI / API-externa HU in the Capacidades de Frontera section — it is the deterministic input for the API contract"));
  }
  return out;
}

function ruleIds(text) {
  const out = [];
  const sections = [
    { heading: /^#{2,4}\s.*Reglas de Negocio/i, id: STABLE_ID.rn, label: "RN-nnn", name: "Reglas de Negocio" },
    { heading: /^#{2,4}\s.*Casos L[ií]mite/i, id: STABLE_ID.cl, label: "CL-nnn", name: "Casos Límite" },
    { heading: /^#{2,4}\s.*Fuera de Alcance/i, id: STABLE_ID.fa, label: "FA-nnn", name: "Fuera de Alcance" }
  ];
  for (const { heading, id, label, name } of sections) {
    const section = extractSection(text, heading);
    if (section === null) continue;
    const missing = bulletBlocks(section).filter((b) => !isEmptyMarker(b) && !id.test(b)).length;
    if (missing > 0) {
      out.push(finding("WARNING", "req-rule-ids", `${missing} item(s) in "${name}" without a stable ${label} ID`, `give every item a sequential ${label} ID (domain prefix allowed) — specs, ROADMAP and _current/ cite by ID, never by section`));
    }
  }
  return out;
}

function run(project) {
  const text = project.read(REQ);
  if (text === null) return [];
  return [...placeholders(text), ...stories(text), ...ruleIds(text)];
}

module.exports = { run, REQ };
