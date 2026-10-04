const { inspect, listHeadings } = require("../hooks/lib/review-rules");

// v2.4.0 added `.specture/review-rules.md`: the team's review criteria, linked by file or section
// instead of copied, so the implementer follows them and the compliance review checks them. A new
// project gets the offer from `setup` (Adopt, step 8.6). A project that already used Specture and
// just upgraded never sees `setup` again — this migration makes the offer there.
//
// It is ASSISTED and only appears with strong evidence: a review agent or skill the team already
// keeps (`.claude/agents/*review*`, `.claude/skills/*review*/SKILL.md`, `.github/agents|instructions`
// with review in the name…). Which sections are criteria and which are procedure is the user's
// call, so the skill drafts the file in Plan mode and the user approves it. It is DECLINABLE:
// "no" is a legitimate answer (`doctor migrate --decline`), logged in migrations.log, and the
// project is then done with it — otherwise a pending assisted migration would hold schema_version
// back forever. A project without such files never sees it (n/a), which keeps the setup invariant:
// a project fresh from the templates has nothing pending.

const ID = "2.6-review-rules-adopt";
const LOG = ".specture/migrations.log";
const REVIEW_NAME = /review|revis|reviewer|code-?review/i;

function declined(ctx) {
  const log = ctx.read(LOG);
  if (!log) return false;
  return log.split(/\r?\n/).some((l) => {
    const parts = l.split(/\s+/);
    return parts[1] === ID && parts[3] === "declined";
  });
}

// Strong signals only: a review agent / skill / instructions file the team maintains.
function strongCandidates(ctx) {
  const base = (p) => p.split("/").pop();
  const files = [
    ...ctx.list(".claude/agents").filter((p) => p.endsWith(".md") && REVIEW_NAME.test(base(p))),
    ...ctx.list(".claude/skills").filter((p) => /\/SKILL\.md$/i.test(p) && REVIEW_NAME.test(p.split("/").slice(-2, -1)[0] || "")),
    ...ctx.list(".claude/commands").filter((p) => p.endsWith(".md") && REVIEW_NAME.test(base(p))),
    ...ctx.list(".github/agents").filter((p) => p.endsWith(".md") && REVIEW_NAME.test(base(p))),
    ...ctx.list(".github/instructions").filter((p) => p.endsWith(".md") && REVIEW_NAME.test(base(p))),
    ...ctx.list(".github/prompts").filter((p) => p.endsWith(".md") && REVIEW_NAME.test(base(p)))
  ];
  return [...new Set(files)].sort();
}

// Weaker sources, offered next to the strong ones but never enough to make this pending.
function optionalCandidates(ctx) {
  const out = [];
  for (const p of ["CONTRIBUTING.md", ".github/CONTRIBUTING.md", ".github/copilot-instructions.md", "docs/CONTRIBUTING.md"]) {
    if (ctx.exists(p)) out.push(p);
  }
  return out;
}

function describe(ctx, file) {
  const text = ctx.read(file) || "";
  return {
    file,
    chars: text.length,
    agentFrontMatter: /^---\r?\n[\s\S]*?^name\s*:[\s\S]*?^---/m.test(text),
    headings: listHeadings(text).map((h) => `${"#".repeat(h.level)} ${h.text}`)
  };
}

module.exports = {
  id: ID,
  since: "2.6.0",
  kind: "assisted",
  declinable: true,
  title: "Reglas de revisión del equipo: enlazar en `.specture/review-rules.md` los criterios del agente o skill de revisión que el repositorio ya tiene",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    if (ctx.exists(".specture/review-rules.md")) return "done";
    if (declined(ctx)) return "done";
    return strongCandidates(ctx).length > 0 ? "pending" : "n/a";
  },
  planInputs(ctx) {
    return {
      file: ".specture/review-rules.md",
      template: "templates/project-config/review-rules.template.md (gramática en su comentario de cabecera)",
      candidates: strongCandidates(ctx).map((f) => describe(ctx, f)),
      optional: optionalCandidates(ctx).map((f) => describe(ctx, f)),
      guidance: [
        "Show the user each candidate with its headings and ask which SECTIONS are review criteria (blockers, rules per technology, levels, checklists) — leave out procedure (how to get the diff, where to save, output format): it never applies here.",
        "Write `.specture/review-rules.md` from the template with only what the user chose: one `## Incluye` line per section (`<ruta> § <encabezado>`, the heading copied exactly).",
        "`— cuando: <globs>` only with evidence (a section named after a technology → the paths stack.yml or the folders show for it); when unsure, no condition.",
        "`## Severidades` only with the words the source uses; `## Nivel flexible` only if the source declares legacy paths with reduced criteria — never inferred.",
        "A section about WHERE files live goes to the location map of conventions.md §2 instead (the planner sees §2).",
        "Never edit the team's files. Validate with `review-rules-resolve.js --all` (exit 0) before `migrate --verify`.",
        `If the user does not want it: \`node scripts/doctor.js migrate --decline ${ID} --by skill\` — logged, never asked again.`
      ].join(" ")
    };
  },
  verify(ctx) {
    if (declined(ctx)) return true;
    if (!ctx.exists(".specture/review-rules.md")) return false;
    const info = inspect(ctx.projectRoot);
    return info.exists && !info.problems.some((p) => p.severity === "ERROR");
  }
};
