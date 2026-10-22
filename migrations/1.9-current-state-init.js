// Retired in v3.0.0. `docs/05-specs/_current/` (the living-behaviour file per component) and
// `knowledge reconcile` / `characterize` no longer exist: a closed milestone deletes its specs,
// and the truth of built behaviour is the code and its tests. The entry stays in the catalog so a
// project whose `.specture/migrations.log` names this id keeps a known migration; it is never
// pending any more. The directory itself is offered for deletion by `3.0-retire-current-state`.
module.exports = {
  id: "1.9-current-state-init",
  since: "1.9.0",
  kind: "content",
  title: "(retirada en v3.0.0) Verdad viva docs/05-specs/_current/ — ya no existe en el framework",
  ownerSkill: "ninguna — retirada en v3.0.0; `3.0-retire-current-state` ofrece borrar el directorio si quedó",
  detect() {
    return "n/a";
  },
  verify() {
    return true;
  }
};
