module.exports = {
  id: "1.9-current-state-init",
  since: "1.9.0",
  kind: "content",
  title: "Living behaviour docs/05-specs/_current/ for projects that closed milestones before v1.9.0",
  ownerSkill: "knowledge reconcile --component <slug> (since v1.19.0; `characterize` for a component without specs) — lazy, one component at a time; `doctor check` names the components",
  detect(ctx) {
    if (!ctx.roadmap) return "n/a";
    if (ctx.exists("docs/05-specs/_current")) return "done";
    const closed = ctx.roadmap.milestones.filter((m) => m.closed).length;
    return closed > 0 ? "pending" : "n/a";
  },
  verify(ctx) {
    return ctx.exists("docs/05-specs/_current");
  }
};
