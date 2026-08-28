// Migration catalog — ordered by `since`. Each entry:
//   { id, since, kind: "mechanical" | "assisted" | "content", title,
//     detect(ctx) → "pending" | "done" | "n/a",
//     apply(ctx)        (mechanical only — idempotent),
//     planInputs(ctx)   (assisted only — material for the skill's Plan-mode delta),
//     verify(ctx) → boolean,
//     ownerSkill        (content only) }
//
// `ctx` comes from hooks/lib/doctor/project.js createContext().
// The catalog is filled in the migrations commit; an empty catalog is valid.

const semver = require("../hooks/lib/doctor/semver");

const catalog = [];

module.exports = catalog.sort((a, b) => semver.compare(a.since, b.since) || a.id.localeCompare(b.id));
