const { gitignoreLines, hasGitignoreLine, eolOf } = require("./lib");

// v1.18.0 tracks `docs/.specture-meta/build-metrics.jsonl` (process evidence — decision A7 of
// the framework roadmap). git cannot re-include a file under an ignored directory, so the
// `docs/.specture-meta/` entry written by 1.7-meta-gitignore becomes `docs/.specture-meta/*`
// plus a negation for the metrics file. 1.7's detect() accepts both forms.

const OLD_ENTRIES = ["docs/.specture-meta/", "docs/.specture-meta"];
const GLOB_ENTRY = "docs/.specture-meta/*";
const NEGATION = "!docs/.specture-meta/build-metrics.jsonl";
const METRICS_FILE = "docs/.specture-meta/build-metrics.jsonl";

module.exports = {
  id: "1.18-metrics-tracked",
  since: "1.18.0",
  kind: "mechanical",
  title: "Track docs/.specture-meta/build-metrics.jsonl (gitignore docs/.specture-meta/* + negation)",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    return hasGitignoreLine(ctx, GLOB_ENTRY) && hasGitignoreLine(ctx, NEGATION) ? "done" : "pending";
  },
  apply(ctx) {
    const current = ctx.read(".gitignore") || "";
    const eol = eolOf(current);
    const all = current === "" ? [] : current.split(/\r?\n/);
    if (all.length > 0 && all[all.length - 1] === "") all.pop();
    const trimmed = gitignoreLines(ctx);
    let globIndex = trimmed.indexOf(GLOB_ENTRY);
    if (globIndex === -1) {
      const oldIndex = trimmed.findIndex((l) => OLD_ENTRIES.includes(l));
      if (oldIndex !== -1) {
        all[oldIndex] = GLOB_ENTRY;
        globIndex = oldIndex;
      } else {
        all.push("# Specture local telemetry (index-usage, learn-history) — per machine; build-metrics.jsonl is tracked", GLOB_ENTRY);
        globIndex = all.length - 1;
      }
    }
    if (!trimmed.includes(NEGATION)) all.splice(globIndex + 1, 0, NEGATION);
    ctx.write(".gitignore", all.join(eol) + eol);
    return {
      notes: ctx.exists(METRICS_FILE)
        ? [`${METRICS_FILE} exists: run \`git add ${METRICS_FILE}\` to start tracking it (not done automatically).`]
        : []
    };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
