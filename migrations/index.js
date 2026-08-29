// Migration catalog — ordered by `since`. Each entry:
//   { id, since, kind: "mechanical" | "assisted" | "content", title,
//     detect(ctx) → "pending" | "done" | "n/a",
//     apply(ctx)        (mechanical only — idempotent),
//     planInputs(ctx)   (assisted only — material for the skill's Plan-mode delta),
//     verify(ctx) → boolean,
//     ownerSkill        (content only) }
//
// `ctx` comes from hooks/lib/doctor/project.js createContext().
// Adding a migration = adding a file here. Keep ids as `<since-minor>-<slug>`.

const semver = require("../hooks/lib/doctor/semver");

const catalog = [
  require("./1.2-state-gitignore"),
  require("./1.6-boundary-capabilities"),
  require("./1.6-contract-companion"),
  require("./1.7-meta-gitignore"),
  require("./1.8-drop-parallel-toggle"),
  require("./1.9-dependencies-syntax"),
  require("./1.9-current-state-init"),
  require("./1.9-tombstones"),
  require("./1.10-rules-sections"),
  require("./1.11-profile-and-knowledge"),
  require("./1.12-structure-block"),
  require("./1.15-settings-file"),
  require("./1.15-schema-version"),
  require("./1.16-requirements-ids"),
  require("./1.16-requirements-merge")
];

// Stable sort by `since` only: entries that share a version keep their declared
// order (e.g. 1.15-settings-file must run before 1.15-schema-version).
module.exports = catalog.sort((a, b) => semver.compare(a.since, b.since));
