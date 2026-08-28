const { userStoriesFrom, operationIdsFrom } = require("./lib");

const BR = "docs/01-requirements/business_requirements.md";

module.exports = {
  id: "1.6-boundary-capabilities",
  since: "1.6.0",
  kind: "assisted",
  title: "business_requirements.md: Exposición marks on user stories + 'Capacidades de Frontera' section",
  detect(ctx) {
    const text = ctx.read(BR);
    if (text === null) return "n/a";
    const hasSection = /^#{2,4}\s.*Capacidades de Frontera/im.test(text);
    return hasSection ? "done" : "pending";
  },
  // Material for the skill: it drafts the section (and the Exposición marks) in Plan mode.
  planInputs(ctx) {
    const text = ctx.read(BR) || "";
    const contractText = ctx.contractFile ? ctx.read(ctx.contractFile) : null;
    return {
      file: BR,
      userStories: userStoriesFrom(text),
      operations: contractText ? operationIdsFrom(contractText, ctx.contractFile) : [],
      guidance:
        "Add `Exposición: UI | API-externa | Interna` to every HU, then a `## Capacidades de Frontera` section listing every UI / API-externa story with its consumer. Every item must map to ≥1 operationId (derive the inverse trace operationId → HU by name); a story with no operation is a contract gap, an operation with no story is over-design."
    };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
