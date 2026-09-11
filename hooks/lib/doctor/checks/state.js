// State checks — runtime/transient artifacts that can get out of sync with the ROADMAP.

const { walk } = require("../project");

function finding(severity, check, file, detail, action) {
  return { severity, group: "state", check, file, detail, action };
}

function seal(project) {
  const rel = ".specture/state/build-locked.json";
  if (!project.exists(rel)) return [];
  let state;
  try {
    state = JSON.parse(project.read(rel));
  } catch {
    return [finding("ERROR", "seal-corrupt", rel, "build-locked.json is not valid JSON", 'release it: node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" release (the hooks fail open on it anyway)')];
  }
  const inProgress = project.roadmap ? project.roadmap.epics.filter((e) => e.state === "in-progress") : [];
  const epic = String(state.epic || "");
  if (project.roadmap && inProgress.length === 0) {
    return [finding("ERROR", "seal-stale", rel, `seal for epic "${epic}" but no epic is [/] in ROADMAP.md — sealed tests, specs and allowed paths stay blocked for any future work`, 'release it: node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/seal-cli.js" release (the epic is already closed)')];
  }
  if (epic && inProgress.length > 0) {
    // Seal slugs follow the spec-dir convention `epic-<X.Y>-<name>` (or just `epic-<X.Y>`):
    // the epic id inside the slug is the reliable key; the substring rule stays as fallback.
    const needle = epic.toLowerCase().replace(/^epic-/, "");
    const idInSlug = (epic.match(/(\d+(?:\.\d+)+)/) || [])[1] || null;
    const matches = inProgress.some((e) => (idInSlug && e.id === idInSlug) || `${e.id || ""} ${e.text}`.toLowerCase().includes(needle));
    if (!matches) {
      return [finding("WARNING", "seal-mismatch", rel, `seal for epic "${epic}" but the [/] epic is "${inProgress[0].id || inProgress[0].text}"`, 'confirm the seal belongs to the running epic (seal-cli.js show); release it with seal-cli.js release if it is a leftover')];
    }
  }
  return [];
}

const { missingCurrent } = require("../../current-state");

function roadmap(project) {
  if (!project.roadmap) return [];
  const out = [];
  const inProgress = project.roadmap.epics.filter((e) => e.state === "in-progress");
  if (inProgress.length > 1) {
    out.push(finding("WARNING", "roadmap-multiple-in-progress", "docs/04-roadmap/ROADMAP.md", `${inProgress.length} epics are [/] (${inProgress.map((e) => e.id || "?").join(", ")}); the queue runs one at a time`, "leave exactly one [/] epic; the coordinator asks which one to continue"));
  }
  const closed = project.roadmap.milestones.filter((m) => m.closed).length;
  const missing = missingCurrent(project.root);
  if (closed > 0 && !project.exists("docs/05-specs/_current")) {
    const hint = missing.length > 0 ? missing.map((c) => c.slug).join(", ") : "<slug>";
    out.push(finding("WARNING", "current-state-missing", "docs/05-specs/_current/", `${closed} closed milestone(s) but no living-behaviour directory — reviewers and impact analyses see no current behaviour`, `run /specture:knowledge reconcile --component ${hint} (one component at a time — migration 1.9-current-state-init)`));
  } else if (project.exists("docs/05-specs/_current")) {
    for (const c of missing) {
      out.push(finding("WARNING", "current-state-partial", `docs/05-specs/_current/${c.slug}.md`, `component "${c.name}" has ${c.specsDone} [x] spec(s) but no living-behaviour file — its reviewers and impact analyses see no current behaviour`, `run /specture:knowledge reconcile --component ${c.slug}`));
    }
  }
  return out;
}

function docsIndex(project) {
  const present = project.exists(".specture/docs-index.yml");
  const enabled = project.settings.values["docs_index.enabled"];
  if (present && enabled === false) {
    return [finding("WARNING", "docs-index-disabled", ".specture/docs-index.yml", "docs-index.yml exists but docs_index.enabled is false", "delete the index or enable the toggle in .specture/settings.yml")];
  }
  return [];
}

function worktrees(project) {
  const leftovers = walk(project.root, ".claude/worktrees");
  if (leftovers.length === 0) return [];
  return [finding("WARNING", "worktree-residue", ".claude/worktrees/", `${leftovers.length} file(s) left behind by agent worktrees`, "run `git worktree prune` and delete .claude/worktrees/")];
}

// The handoff scaffolding that `2.0-design-spine` moves aside but cannot delete: a migration
// context has no deletion primitive, so the migration names the files once, in the output of the
// run that applied it, and never again — its `verify()` only looks at the moved documents and the
// rewritten citations, so it reports `done` with the scaffolding still on disk. Said once is said
// to nobody: this reports it on every run until it is gone, and it looks at disk rather than at
// `.specture/migrations.log`, so a half-finished deletion is caught too.
const HANDOFF_SCAFFOLD = [
  "docs/03-ux-ui/handoff-mapping.md",
  "docs/03-ux-ui/fidelity-checklist.md",
  "docs/03-ux-ui/design_specs_for_ai.md"
];

function handoffResidue(project) {
  // Only AFTER the spine exists. Before the migration runs, the mirror is the only copy of work
  // that was measured off a running DOM and that no channel returns — telling the user to delete
  // it then would destroy it.
  if (walk(project.root, "docs/03-ux-ui/components").length === 0) return [];
  const files = HANDOFF_SCAFFOLD.filter((rel) => project.exists(rel));
  const mirror = walk(project.root, "docs/03-ux-ui/handoff");
  if (files.length === 0 && mirror.length === 0) return [];
  const targets = [...files, ...(mirror.length > 0 ? ["docs/03-ux-ui/handoff/"] : [])];
  const what = mirror.length > 0 ? `${files.length} scaffolding file(s) and the ${mirror.length}-file handoff mirror` : `${files.length} scaffolding file(s)`;
  return [finding("WARNING", "handoff-residue", "docs/03-ux-ui/", `${what} left after the design spine migration — the per-component documents already live in docs/03-ux-ui/components/`, `delete them: \`git rm -r ${targets.join(" ")}\` (a migration cannot delete files, so this is the one step that stays manual)`)];
}

function run(project) {
  return [...seal(project), ...roadmap(project), ...docsIndex(project), ...worktrees(project), ...handoffResidue(project)];
}

module.exports = { run };
