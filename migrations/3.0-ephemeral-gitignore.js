const { hasGitignoreLine, ensureGitignoreEntry } = require("./lib");

// v3.0.0 — the artefacts of the build that are not decisions stop being committed: code reviews
// (`docs/07-reviews/review-*.md`), PR / branch compliance reports and debug logs are read while
// the epic is open and deleted when the milestone closes (`milestone-close.js`); nothing of
// Specture or of the project depends on them afterwards. The milestone compliance reports
// (`cumplimiento-milestone-*.md`) stay tracked: the triage and the doctor read them until the
// user closes them. `setup` writes the same lines for a new project (MODE_BOOTSTRAP 4.5,
// MODE_ADOPT 8) — the setup-invariant test keeps both in sync.

const ENTRIES = [
  ["docs/07-reviews/review-*.md", "Specture code reviews — read while the epic is open, deleted when its milestone closes"],
  ["docs/07-reviews/cumplimiento-pr-*.md", "Specture PR compliance reports — local"],
  ["docs/07-reviews/cumplimiento-rama-*.md", "Specture branch compliance reports — local"],
  ["docs/06-debug-logs/", "Specture debug logs — the root cause becomes a rule or an ADR; the log is local"]
];

function missing(ctx) {
  return ENTRIES.filter(([entry]) => !hasGitignoreLine(ctx, entry));
}

module.exports = {
  id: "3.0-ephemeral-gitignore",
  since: "3.0.0",
  kind: "mechanical",
  title: "Dejar de versionar reviews, reportes de PR/rama y debug logs (.gitignore)",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    return missing(ctx).length === 0 ? "done" : "pending";
  },
  apply(ctx) {
    const notes = [];
    for (const [entry, comment] of missing(ctx)) ensureGitignoreEntry(ctx, entry, comment);
    const tracked = ["docs/07-reviews", "docs/06-debug-logs"].filter((dir) => ctx.exists(dir));
    if (tracked.length > 0) {
      notes.push(`${tracked.join(" and ")} have files: if they are tracked, run \`git rm --cached -r <dir>\` for the ignored patterns (not done automatically — milestone compliance reports stay tracked).`);
    }
    return { notes };
  },
  verify(ctx) {
    return missing(ctx).length === 0;
  }
};
