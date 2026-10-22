// v3.0.0 retired the living-behaviour directory `docs/05-specs/_current/` together with
// `knowledge reconcile` / `characterize`: the truth of built behaviour is the code and its tests,
// the decisions are the ADRs, and a closed milestone deletes its specs instead of consolidating
// them into a summary nobody read (Psikora never built `_current/` and worked the same).
//
// A project that reconciled before v3.0.0 still carries the directory. This migration OFFERS to
// delete it — ASSISTED and DECLINABLE: the user may keep the files as plain documentation (nothing
// in the framework reads them any more), in which case "no" is logged and the migration is done.

const ID = "3.0-retire-current-state";
const LOG = ".specture/migrations.log";
const DIR = "docs/05-specs/_current";

function declined(ctx) {
  const log = ctx.read(LOG);
  if (!log) return false;
  return log.split(/\r?\n/).some((l) => {
    const parts = l.split(/\s+/);
    return parts[1] === ID && parts[3] === "declined";
  });
}

module.exports = {
  id: ID,
  since: "3.0.0",
  kind: "assisted",
  declinable: true,
  title: "Retirar `docs/05-specs/_current/` (verdad viva por componente): el framework ya no lo lee ni lo escribe",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    if (!ctx.exists(DIR)) return "done";
    return declined(ctx) ? "done" : "pending";
  },
  planInputs(ctx) {
    return {
      directory: DIR,
      files: ctx.list(DIR),
      guidance: [
        "Since v3.0.0 nothing in Specture reads or writes `docs/05-specs/_current/`: the build does not resolve it, the planner and the reviewer do not receive it, `knowledge reconcile` and `characterize` no longer exist, and a milestone deletes its specs when it closes.",
        "Show the user the files and ask whether to delete the directory (`git rm -r docs/05-specs/_current`) or keep it as plain documentation of the project — both are valid; keeping it costs nothing and protects nothing.",
        `If the user keeps it: \`node scripts/doctor.js migrate --decline ${ID} --by skill\` — logged, never asked again.`,
        "Never delete it without the user's explicit answer."
      ].join(" ")
    };
  },
  verify(ctx) {
    return !ctx.exists(DIR) || declined(ctx);
  }
};
