// 1.20-brand-brief — content migration.
//
// Before v1.20.0 nothing in the flow asked for brand: `discover` never raised tone or
// identity, and the Phase 3 template only accepted "Referencias visuales: [URLs que el
// usuario provea — no inventar]". A frontend project whose requirements predate v1.20.0
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
  id: "1.20-brand-brief",
  since: "1.20.0",
  kind: "content",
  title: "Brand identity in business_requirements.md for frontend projects that predate v1.20.0",
  ownerSkill: "discover — adds `## Identidad de Marca` (MK-nnn) by asking the user; `ux-design` reads it in Phase 3",
  detect(ctx) {
    if (!ctx.exists(REQUIREMENTS)) return "n/a";
    if (!hasFrontend(ctx.stackText || "")) return "n/a";
    return HEADING.test(ctx.read(REQUIREMENTS) || "") ? "done" : "pending";
  },
  verify(ctx) {
    return HEADING.test(ctx.read(REQUIREMENTS) || "");
  }
};
