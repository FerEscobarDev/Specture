// 2.0-design-system-layers — content migration.
//
// Before v2.0.0 the design-system template had a single, primitive token layer: `color.primary.500`,
// `color.neutral.900`, and semantic tokens only for the four status colours. The family that was
// missing — surface / text / border / on-accent / focus-ring — is the one that carries dark mode
// and the one that makes `ux-implementer`'s "every colour comes from a token" rule satisfiable at
// all. Without it the contrast verifier has no semantic pairs to compute and would emit PASS over
// an empty matrix.
//
// Backfilling is judgment (which grey is "surface" and which is "subtle border" is a design
// decision, not a rename), so this has no `apply`: `ux-design` re-runs the token section with the
// user, one project at a time.

const DESIGN_SYSTEM = "docs/03-ux-ui/design_system.md";

// The semantic layer is present when the document names roles, not just ramps.
const SEMANTIC = /`?color\.(bg|text|border|focus)\./i;

module.exports = {
  id: "2.0-design-system-layers",
  since: "2.0.0",
  kind: "content",
  title: "Semantic token layer (surface / text / border / on-accent / focus) in design_system.md",
  ownerSkill: "`/specture:ux-design` — Step 4 rebuilds the semantic layer with the user over the primitives already in the file; without it `design-lint contrast` has not one pair to compute and blocks",
  detect(ctx) {
    if (!ctx.exists(DESIGN_SYSTEM)) return "n/a";
    return SEMANTIC.test(ctx.read(DESIGN_SYSTEM) || "") ? "done" : "pending";
  },
  verify(ctx) {
    return SEMANTIC.test(ctx.read(DESIGN_SYSTEM) || "");
  }
};
