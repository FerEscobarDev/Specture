const { extractSection } = require("./lib");

const BR = "docs/01-requirements/business_requirements.md";
const RN_ID = /\bRN-[A-Z0-9]*-?\d+\b/;

module.exports = {
  id: "1.16-requirements-ids",
  since: "1.16.0",
  kind: "assisted",
  title: "business_requirements.md: stable RN-nnn / CL-nnn / FA-nnn IDs on rules, edge cases and out-of-scope items",
  detect(ctx) {
    const text = ctx.read(BR);
    if (text === null) return "n/a";
    const rules = extractSection(text, /^#{2,4}\s.*Reglas de Negocio/i);
    // No rules section yet → the document predates the ID convention entirely.
    if (rules === null) return "pending";
    return RN_ID.test(rules) ? "done" : "pending";
  },
  // Material for the skill: it assigns the IDs in Plan mode (one atomic delta over the doc).
  planInputs(ctx) {
    const text = ctx.read(BR) || "";
    return {
      file: BR,
      rules: extractSection(text, /^#{2,4}\s.*Reglas de Negocio/i),
      edgeCases: extractSection(text, /^#{2,4}\s.*Casos L[ií]mite/i),
      outOfScope: extractSection(text, /^#{2,4}\s.*Fuera de Alcance/i),
      guidance:
        "Assign sequential 3-digit IDs in place: `- **RN-nnn:** …` for every business rule, `- **CL-nnn:** …` for every edge case, `- **FA-nnn:** …` for every out-of-scope item (a domain prefix like RN-SEG-007 is allowed). Never renumber or reuse an ID. Then update citations that point at these items by section (`business_requirements.md §X`) in specs, ROADMAP and _current/ to cite the ID instead."
    };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
