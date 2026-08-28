const { operationIdsFrom } = require("./lib");

const COMPANION = "docs/02-architecture/api-contract.md";

module.exports = {
  id: "1.6-contract-companion",
  since: "1.6.0",
  kind: "assisted",
  title: "Readable companion docs/02-architecture/api-contract.md for the declared contract file",
  detect(ctx) {
    if (!ctx.contractFile || !ctx.exists(ctx.contractFile)) return "n/a";
    return ctx.exists(COMPANION) ? "done" : "pending";
  },
  planInputs(ctx) {
    const text = ctx.read(ctx.contractFile) || "";
    return {
      file: COMPANION,
      contractFile: ctx.contractFile,
      template: "templates/API_CONTRACT_TEMPLATE.md",
      operations: operationIdsFrom(text, ctx.contractFile),
      guidance:
        "Generate the companion from API_CONTRACT_TEMPLATE.md: global conventions, shared DTOs, one row per operation (operationId, method, path, auth, request, success, errors, idempotent, epic) and an EMPTY traceability table to be completed with HU ↔ operationId ↔ epic. The machine-readable file stays the source of truth."
    };
  },
  verify(ctx) {
    return ctx.exists(COMPANION);
  }
};
