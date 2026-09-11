// 2.0-design-spine — mechanical.
//
// Moves the per-component documents of a handoff mirror into the spine
// (`docs/03-ux-ui/components/<Nombre>.md`) and rewrites every citation of the old paths.
//
// Those documents are NOT handoff scaffolding: in a real project they are dozens of files
// hand-authored by measuring a running DOM — prop contracts, anatomies citing exact classes,
// adjudicated brand deltas. The channel does not return them (it returns component source and
// prop types), so deleting them would lose work that cannot be re-fetched. They are transcribed
// with `Procedencia: medido del DOM`, which is what stops a later channel pull from overwriting
// them (`build/EPIC_LOOP.md`, Design Surface Resolution).
//
// What IS scaffolding — `handoff-mapping.md`, `fidelity-checklist.md`, `design_specs_for_ai.md`,
// the mirror's README — is left in place and named for removal: the migration context has no
// deletion primitive (same constraint as `1.9-tombstones`, which archives by writing elsewhere).
// Removing them is one `git rm`, reported in the notes.

const { isLivingDoc } = require("../hooks/lib/doctor/project");

const MIRROR = "docs/03-ux-ui/handoff";
const COMPONENTS = "docs/03-ux-ui/components";
const SCAFFOLD = [
  "docs/03-ux-ui/handoff-mapping.md",
  "docs/03-ux-ui/fidelity-checklist.md",
  "docs/03-ux-ui/design_specs_for_ai.md",
  `${MIRROR}/README.md`
];

// `docs/03-ux-ui/handoff/components/domain/CupoProgress.reference.md`
//   → { name: "CupoProgress", tier: "domain", target: "docs/03-ux-ui/components/CupoProgress.md" }
// Only `domain` is inferred. A real mirror groups by UI *category* — `forms`, `feedback`,
// `navigation`, `containers`, `data` — which are not tiers: most map to `composite`, some to
// `primitive`, and deciding which is a design judgment. Guessing would write a wrong tier that
// then looks authored. `domain` is the exception: it is unambiguous, and it is the tier that
// carries the product's identity, so losing it in the move would lose the point of the move.
function planMove(rel) {
  const match = rel.match(/^docs\/03-ux-ui\/handoff\/components\/(?:([^/]+)\/)?([^/]+)\.reference\.md$/);
  if (!match) return null;
  const [, group, name] = match;
  return {
    name,
    tier: group === "domain" ? "domain" : null,
    group: group || null,
    source: rel,
    target: `${COMPONENTS}/${name}.md`
  };
}

function moves(ctx) {
  return (ctx.list(MIRROR) || []).map(planMove).filter(Boolean);
}

// Only LIVING documents get their citations rewritten — the same set the corpus lint holds to
// account (`isLivingDoc`). A review, a debug log or the spec of a closed epic records what was
// true on its date: rewriting a path inside it makes it claim it cited a file that did not exist
// yet. The lint already ignores those files, so there is nothing to fix there either.
// `.specture/*.yml` joins the set: config is always current, and `isLivingDoc` only admits .md.
function rewritable(rel) {
  if (rel.startsWith(MIRROR)) return false;
  if (rel.startsWith(".specture/") && rel.endsWith(".yml")) return true;
  return isLivingDoc(rel);
}

// Scaffolding is replaced by a PATH, never by prose. A prose destination produced
// `design_system.md §3 (inventario) §3` — the section twice — and glued a line range onto a
// section reference (`…:77-78`). Where the content went is said in the notes, once.
const SCAFFOLD_MOVED_TO = [
  ["docs/03-ux-ui/handoff-mapping.md", "docs/03-ux-ui/design_system.md"],
  ["docs/03-ux-ui/fidelity-checklist.md", ".specture/rules.yml"]
];

function header(move) {
  return [
    `# ${move.name} — \`${move.target}\``,
    "",
    `- **Nivel:** ${move.tier || `[primitive | composite | pattern] — categoría de origen: \`${move.group || "sin agrupar"}\`; el nivel lo decide quien revise`}`,
    "- **Procedencia:** `medido del DOM` — autoritativo: un pull posterior del canal NO lo sobrescribe.",
    `- **Origen:** movido desde \`${move.source}\` por la migración \`2.0-design-spine\`.`,
    "",
    "---",
    ""
  ].join("\n");
}

module.exports = {
  id: "2.0-design-spine",
  since: "2.0.0",
  kind: "mechanical",
  title: "Handoff mirror → docs/03-ux-ui/components/, with every citation rewritten",
  detect(ctx) {
    if (!ctx.exists(MIRROR)) return "n/a";
    const pending = moves(ctx).filter((m) => !ctx.exists(m.target));
    return pending.length > 0 ? "pending" : "done";
  },
  apply(ctx) {
    const planned = moves(ctx);
    const notes = [];

    // 1. Transcribe each component document into the spine, keeping its tier and provenance.
    let moved = 0;
    for (const move of planned) {
      if (ctx.exists(move.target)) continue;
      ctx.write(move.target, header(move) + (ctx.read(move.source) || ""));
      moved++;
    }
    if (moved > 0) notes.push(`${moved} documento(s) de componente movidos a \`${COMPONENTS}/\` con \`Procedencia: medido del DOM\``);
    const sinNivel = planned.filter((m) => !m.tier).length;
    if (sinNivel > 0) {
      notes.push(`${sinNivel} sin nivel inferible: las carpetas del espejo son categorías de UI, no niveles — sólo \`domain\` se infiere, el resto lo decide quien revise`);
    }

    // 2. Rewrite every citation of an old path. Without this the corpus lint emits one ERROR
    //    `broken-path` per citation, on every doctor run, in a project that touched nothing.
    const byOldPath = new Map(planned.map((m) => [m.source, m.target]));
    let rewritten = 0;
    for (const rel of [...(ctx.list("docs") || []), ...(ctx.list(".specture") || [])]) {
      if (!rewritable(rel)) continue;
      const text = ctx.read(rel);
      if (!text || !text.includes("03-ux-ui/handoff")) continue;
      let next = text;
      for (const [oldPath, target] of byOldPath) next = next.split(oldPath).join(target);
      for (const [oldPath, target] of SCAFFOLD_MOVED_TO) next = next.split(oldPath).join(target);
      if (next !== text) {
        ctx.write(rel, next);
        rewritten++;
      }
    }
    if (rewritten > 0) {
      notes.push(`${rewritten} documento(s) VIVOS con citas reescritas — la historia (reviews, debug logs, specs de epics cerrados) no se toca: es el registro de lo que era cierto entonces`);
      notes.push("el inventario del handoff vive ahora en `docs/03-ux-ui/design_system.md` §3, y la checklist de fidelidad en las reglas `R-*` con tag `frontend` de `.specture/rules.yml`");
    }

    // 3. Name what is left to remove — the context has no deletion primitive.
    const leftovers = [...SCAFFOLD.filter((f) => ctx.exists(f)), ...(ctx.exists(`${MIRROR}/components`) ? [`${MIRROR}/`] : [])];
    if (leftovers.length > 0) {
      notes.push(`andamiaje del handoff a borrar a mano (una migración no puede eliminar archivos): \`git rm -r ${leftovers.join(" ")}\``);
    }
    return { notes };
  },
  verify(ctx) {
    const planned = moves(ctx);
    if (planned.some((m) => !ctx.exists(m.target))) return false;
    // No LIVING document may still cite a path this migration actually moved. Checking for the
    // SHAPE of an old path would fail on what apply cannot rewrite — a glob like
    // `handoff/components/domain/*.reference.md` has no single destination — making verify
    // stricter than apply can ever satisfy.
    for (const rel of [...(ctx.list("docs") || []), ...(ctx.list(".specture") || [])]) {
      if (!rewritable(rel)) continue;
      const text = ctx.read(rel) || "";
      if (planned.some((m) => text.includes(m.source))) return false;
      if (SCAFFOLD_MOVED_TO.some(([oldPath]) => text.includes(oldPath))) return false;
    }
    return true;
  }
};
