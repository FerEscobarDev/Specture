const { hasGitignoreEntry, ensureGitignoreEntry } = require("./lib");

module.exports = {
  id: "1.7-meta-gitignore",
  since: "1.7.0",
  kind: "mechanical",
  title: "Ignore docs/.specture-meta/ (local telemetry) in .gitignore",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    return hasGitignoreEntry(ctx, "docs/.specture-meta/") ? "done" : "pending";
  },
  apply(ctx) {
    ensureGitignoreEntry(ctx, "docs/.specture-meta/", "Specture local telemetry (index-usage, learn-history) — per machine");
    return {
      notes: ctx.exists("docs/.specture-meta")
        ? ["docs/.specture-meta/ has files: if they are tracked, run `git rm --cached -r docs/.specture-meta` (not done automatically)."]
        : []
    };
  },
  verify(ctx) {
    return hasGitignoreEntry(ctx, "docs/.specture-meta/");
  }
};
