const { hasGitignoreEntry, hasGitignoreLine, ensureGitignoreEntry } = require("./lib");

// Since v1.18.0 (1.18-metrics-tracked) the entry may be the glob form `docs/.specture-meta/*`
// (+ a negation for the tracked metrics file): both forms count as done, so this migration
// never re-adds the directory form on top of the glob.
function ignored(ctx) {
  return hasGitignoreEntry(ctx, "docs/.specture-meta/") || hasGitignoreLine(ctx, "docs/.specture-meta/*");
}

module.exports = {
  id: "1.7-meta-gitignore",
  since: "1.7.0",
  kind: "mechanical",
  title: "Ignore docs/.specture-meta/ (local telemetry) in .gitignore",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    return ignored(ctx) ? "done" : "pending";
  },
  apply(ctx) {
    if (ignored(ctx)) return { notes: [] };
    ensureGitignoreEntry(ctx, "docs/.specture-meta/", "Specture local telemetry (index-usage, learn-history) — per machine");
    return {
      notes: ctx.exists("docs/.specture-meta")
        ? ["docs/.specture-meta/ has files: if they are tracked, run `git rm --cached -r docs/.specture-meta` (not done automatically)."]
        : []
    };
  },
  verify(ctx) {
    return ignored(ctx);
  }
};
