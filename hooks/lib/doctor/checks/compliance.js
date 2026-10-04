// Compliance review — `.specture/review-rules.md` (custom review rules, since v2.4.0).
// Every finding: { severity, group: "compliance", check, file, detail, action }.
//
//   review-rules-schema         ERROR    a line of the four sections does not follow the grammar
//                                        (reference, severity mapping, RV-n rule), a repeated RV id,
//                                        an unknown severity, a glob with braces {a,b}
//   review-rules-include        ERROR    an inclusion that cannot load: URL, absolute path, outside
//                                        the repository, the file itself, missing file or heading,
//                                        a heading that appears twice, or an included file with its
//                                        own "## Incluye" (one level of inclusion only — not followed)
//   review-rules-size           ERROR    one inclusion alone exceeds the cap (60000 characters)
//                               WARNING  all inclusions together exceed it: a review that needs all
//                                        of them fails loud
//   review-rules-agent-include  WARNING  a whole agent file (front-matter with name/description) is
//                                        included: its procedure (how to get the diff, where to save)
//                                        travels with its criteria
//   review-rules-glob           WARNING  a `cuando:` or flexible-level glob matches no tracked file
//                                        (git only) — usually a typo that silently drops criteria
//   compliance-triage-pending   WARNING  a compliance report (docs/07-reviews/cumplimiento-*.md) still
//                                        waits for the user's triage, or has findings marked "corregir"
//                                        with no result under CORRECCIÓN
//   compliance-report-malformed WARNING  a compliance report whose STATUS / TRIAGE / Milestone header
//                                        or a finding's Tipo does not parse — compliance.js cannot
//                                        triage or count it
//
// Absent file → no findings (it is opt-in). The resolver (`review-rules-resolve.js`) refuses to run
// with any ERROR here, so a build or a compliance review stops on the same problems.

const { spawnSync } = require("child_process");
const { inspect, matchesAny } = require("../../review-rules");
const { listReports } = require("../../compliance");

const FILE = ".specture/review-rules.md";

const ACTIONS = {
  "review-rules-schema": "corregir la línea según la gramática del comentario de cabecera de templates/project-config/review-rules.template.md",
  "review-rules-include": "corregir la ruta o el encabezado (debe existir una sola vez); un archivo incluido no puede incluir otros",
  "review-rules-size": "incluir secciones más chicas (§ <encabezado>) o condicionarlas con «cuando:»",
  "review-rules-agent-include": "incluir solo las secciones de criterios del agente (§ <encabezado>), no el archivo entero"
};

function finding(severity, check, detail, action) {
  return { severity, group: "compliance", check, file: FILE, detail, action };
}

function trackedFiles(root) {
  const res = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) return null;
  return res.stdout.split(/\r?\n/).filter(Boolean);
}

function deadGlobs(project, parsed) {
  const files = trackedFiles(project.root);
  if (!files || files.length === 0) return [];
  const globs = [
    ...parsed.includes.flatMap((i) => i.when.map((g) => ({ g, line: i.line }))),
    ...parsed.rules.flatMap((r) => r.when.map((g) => ({ g, line: r.line }))),
    ...parsed.flexible.paths.map((g) => ({ g, line: null }))
  ];
  const seen = new Set();
  const out = [];
  for (const { g, line } of globs) {
    if (seen.has(g)) continue;
    seen.add(g);
    if (!files.some((f) => matchesAny(f, [g]))) {
      out.push(finding("WARNING", "review-rules-glob", `\`${g}\`${line ? ` (línea ${line})` : ""} no coincide con ningún archivo del repositorio`, "revisar el glob: con «/» se ancla a la raíz del proyecto, sin «/» vale para un nombre de archivo en cualquier carpeta"));
    }
  }
  return out;
}

function reviewRules(project) {
  const info = inspect(project.root);
  if (!info.exists) return [];
  const out = info.problems.map((p) =>
    finding(p.severity, p.check, p.line ? `${p.detail} (línea ${p.line})` : p.detail, ACTIONS[p.check] || ACTIONS["review-rules-schema"])
  );
  if (!out.some((f) => f.severity === "ERROR")) out.push(...deadGlobs(project, info.parsed));
  return out;
}

function reports(project) {
  const out = [];
  for (const { rel, report } of listReports(project.root)) {
    const f = (severity, check, detail, action) => ({ severity, group: "compliance", check, file: rel, detail, action });
    if (report.errors.length) {
      out.push(f("WARNING", "compliance-report-malformed", report.errors.join(" · "), "el reporte lo arma compliance.js: no lo edites a mano — regeneralo con /specture:compliance-review milestone <N>"));
      continue;
    }
    if (report.triage === "PENDIENTE") {
      out.push(f("WARNING", "compliance-triage-pending", `${report.findings.length} hallazgo(s) esperan tu decisión`, "decidí qué abordar con /specture:compliance-review triage (o al vaciar la cola de /specture:build)"));
      continue;
    }
    const open = Object.entries(report.decisions).filter(([id, d]) => d.decision === "corregir" && !report.correction[id]).map(([id]) => id);
    if (open.length) {
      out.push(f("WARNING", "compliance-triage-pending", `corrección pendiente: ${open.join(", ")}`, "retomá la corrección con /specture:compliance-review triage"));
    }
  }
  return out;
}

function run(project) {
  return [...reviewRules(project), ...reports(project)];
}

module.exports = { run };
