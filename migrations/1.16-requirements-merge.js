const { extractSection } = require("./lib");

const REQ_DIR = "docs/01-requirements";
const BR = `${REQ_DIR}/business_requirements.md`;
const ADENDA_HEADING = /^#{2,4}\s.*\b(?:Adenda|New Features)\b/im;

function featureFiles(ctx) {
  return ctx.list(REQ_DIR).filter((rel) => /\/feature-[^/]+\.md$/.test(rel));
}

module.exports = {
  id: "1.16-requirements-merge",
  since: "1.16.0",
  kind: "assisted",
  title: "business_requirements.md: feature-*.md drafts and Adenda sections merged per-section into the single file",
  detect(ctx) {
    if (!ctx.exists(REQ_DIR)) return "n/a";
    if (featureFiles(ctx).length > 0) return "pending";
    const text = ctx.read(BR);
    if (text !== null && ADENDA_HEADING.test(text)) return "pending";
    return "done";
  },
  // Material for the skill: it merges per-section in Plan mode, then deletes the drafts.
  planInputs(ctx) {
    const files = featureFiles(ctx).map((rel) => {
      const text = ctx.read(rel) || "";
      return { file: rel, headings: text.split(/\r?\n/).filter((l) => /^#{2,4}\s/.test(l)) };
    });
    const brText = ctx.read(BR) || "";
    return {
      file: BR,
      featureFiles: files,
      adendaSections: ADENDA_HEADING.test(brText) ? [extractSection(brText, ADENDA_HEADING)] : [],
      guidance:
        "Merge each feature-*.md per-section into business_requirements.md: every HU/RN/CL/FA lands in its home section with the marker `(añadido por feature <slug>, <fecha>)`, continuing the existing ID numbering (never renumber). Fold any `Adenda` / `New Features` section into the home sections the same way. Then delete the feature-*.md files — build hands the epic-agent only business_requirements.md, so anything left outside never reaches it."
    };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
