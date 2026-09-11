// 2.0-brand-brief — content migration.
//
// Before v2.0.0 nothing in the flow asked for brand: `discover` never raised tone or
// identity, and the Phase 3 template only accepted "Referencias visuales: [URLs que el
// usuario provea — no inventar]". A frontend project whose requirements predate v2.0.0
// therefore has nowhere for its brand to live, and the design agent supplies it from its
// own taste. This migration names that gap; the fix is judgment (a conversation with the
// user), never a text transform, so it has no `apply`.

const { stackField } = require("../hooks/lib/doctor/project");

const REQUIREMENTS = "docs/01-requirements/business_requirements.md";
const HEADING = /^#{2,4}\s.*Identidad de Marca/im;

function hasFrontend(stackText) {
  const framework = (stackField(stackText, "frontend", "framework") || "")
    .replace(/["'`]/g, "")
    .trim()
    .toLowerCase();
  if (framework === "" || framework === "none" || framework === "null") return false;
  return !/^\[/.test(framework); // an unfilled template placeholder is not a frontend
}

module.exports = {
  id: "2.0-brand-brief",
  since: "2.0.0",
  kind: "content",
  title: "Brand identity in business_requirements.md for frontend projects that predate v2.0.0",
  ownerSkill: "`/specture:discover --marca` — five questions, brand-only mode: it does NOT re-open the questionnaire. Writes `## Identidad de Marca` (MK-nnn) from the user's answers; `ux-design` refuses to author a design system without it",
  detect(ctx) {
    if (!ctx.exists(REQUIREMENTS)) return "n/a";
    if (!hasFrontend(ctx.stackText || "")) return "n/a";
    return HEADING.test(ctx.read(REQUIREMENTS) || "") ? "done" : "pending";
  },
  verify(ctx) {
    return HEADING.test(ctx.read(REQUIREMENTS) || "");
  }
};
