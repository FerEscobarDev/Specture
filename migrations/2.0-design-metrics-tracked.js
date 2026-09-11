// 2.0-design-metrics-tracked — mechanical.
//
// Phase 03 writes its own metrics file, a sibling of the build one: a design run has no `epic`,
// and `hooks/lib/metrics-report.js` discards every line without that field while `summarize()`
// folds everything that is not `source: "baseline"` into the gate aggregate. Sharing the file
// would either drop the design lines or poison the Spec Planning Gate reading.
//
// `docs/.specture-meta/*` is ignored (1.7) with one negation for the build metrics (1.18), so
// the design metrics need their own negation or git cannot re-include them.

const { gitignoreLines, hasGitignoreLine, eolOf } = require("./lib");

const GLOB_ENTRY = "docs/.specture-meta/*";
const BUILD_NEGATION = "!docs/.specture-meta/build-metrics.jsonl";
const NEGATION = "!docs/.specture-meta/design-metrics.jsonl";

module.exports = {
  id: "2.0-design-metrics-tracked",
  since: "2.0.0",
  kind: "mechanical",
  title: "Track docs/.specture-meta/design-metrics.jsonl (gitignore negation, sibling of the build metrics)",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    // Only meaningful once the ignore glob exists — 1.18 runs first and writes it.
    if (!hasGitignoreLine(ctx, GLOB_ENTRY)) return "n/a";
    return hasGitignoreLine(ctx, NEGATION) ? "done" : "pending";
  },
  apply(ctx) {
    const current = ctx.read(".gitignore") || "";
    const eol = eolOf(current);
    const all = current === "" ? [] : current.split(/\r?\n/);
    if (all.length > 0 && all[all.length - 1] === "") all.pop();

    const trimmed = gitignoreLines(ctx);
    const after = trimmed.indexOf(BUILD_NEGATION);
    const at = after !== -1 ? after + 1 : trimmed.indexOf(GLOB_ENTRY) + 1;
    all.splice(at, 0, NEGATION);
    ctx.write(".gitignore", `${all.join(eol)}${eol}`);
    return { notes: [`\`${NEGATION}\` añadido — las métricas de diseño se versionan, como las de build (decisión A7)`] };
  },
  verify(ctx) {
    return hasGitignoreLine(ctx, NEGATION);
  }
};
