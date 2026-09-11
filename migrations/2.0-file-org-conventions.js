const fs = require("fs");
const path = require("path");
const { templateText, extractSection } = require("./lib");
const { IGNORED_DIRS } = require("../hooks/lib/doctor/project");

// v2.0.0's `R-FILE-003` says types, interfaces, constants and hooks live OUTSIDE the component
// or class file, "at the location conventions.md §2 declares". Before this migration §2 declared
// no such location: it had structure-by-feature, test co-location and a max file size, and
// nothing about where each kind of thing goes. A BLOCKER that points at an undeclared location
// is unenforceable, so the map has to exist.
//
// It is ASSISTED, not mechanical, on purpose: the map is a team decision. What the code shows is
// a proposal, never the answer — an inferred slot written as if confirmed turns a decision nobody
// made into an invisible convention. `sin definir` is a legal, VISIBLE value; it is the signal to
// ask. The skill drafts the delta in Plan mode and the user confirms it.

const CONVENTIONS = ".specture/conventions.md";
const SECTION_2 = /^##\s*2\.\s/m;
const MAP_HEADING = /^###\s*Mapa de ubicaciones\s*$/m;

// Directories whose name is a strong hint for one slot of the map. Presence is evidence, never a
// decision: two projects with a `hooks/` folder can still disagree about what belongs in it.
const HINTS = [
  { slot: "Componentes", patterns: ["components", "componentes", "views", "pages", "screens"] },
  { slot: "Types e interfaces", patterns: ["types", "typings", "interfaces", "models", "dto", "dtos"] },
  { slot: "Constantes", patterns: ["constants", "constantes", "config"] },
  { slot: "Hooks / composables", patterns: ["hooks", "composables"] },
  { slot: "Servicios / casos de uso", patterns: ["services", "servicios", "application", "usecases", "use-cases", "domain"] },
  { slot: "Tests", patterns: ["tests", "test", "__tests__", "spec", "specs"] }
];

// Every directory of the project, relative and slash-separated, to a shallow depth: deeper than
// this the listing stops being evidence and starts being noise in the skill's context.
function directories(root, relative = "", depth = 0, out = []) {
  if (depth > 3) return out;
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, relative), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) continue;
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    out.push(next);
    directories(root, next, depth + 1, out);
  }
  return out;
}

module.exports = {
  id: "2.0-file-org-conventions",
  since: "2.0.0",
  kind: "assisted",
  title: "`conventions.md` §2: the location map R-FILE-003 cites (components, types, constants, hooks, services, tests)",
  detect(ctx) {
    const text = ctx.read(CONVENTIONS);
    if (text === null) return "n/a";
    const section = extractSection(text, SECTION_2);
    if (section === null) return "n/a";
    return MAP_HEADING.test(section) ? "done" : "pending";
  },
  planInputs(ctx) {
    const text = ctx.read(CONVENTIONS) || "";
    const dirs = directories(ctx.projectRoot);
    const evidence = HINTS.map(({ slot, patterns }) => ({
      slot,
      candidates: dirs.filter((d) => patterns.includes(d.split("/").pop().toLowerCase())).slice(0, 6)
    }));
    return {
      file: CONVENTIONS,
      currentSection: extractSection(text, SECTION_2),
      template: "templates/project-config/conventions.template.md (§2 → `### Mapa de ubicaciones`)",
      templateSection: extractSection(templateText("project-config/conventions.template.md").replace(/\r\n/g, "\n"), SECTION_2),
      evidence,
      directoriesScanned: dirs.length,
      guidance: [
        "Add the `### Mapa de ubicaciones` table of the template to §2, filled in for THIS project.",
        "`evidence` is what the folder names suggest — a proposal to put to the user, never an answer.",
        "Valid values per slot: a path pattern · `co-localizado` · `no aplica` · `sin definir`.",
        "A slot you cannot confirm with the user stays `sin definir`. Do NOT fill it in: `R-FILE-003`",
        "reads this table, and an invented location is an invisible convention nobody chose.",
        "Never move or rename existing files — this migration declares where things go from now on."
      ].join(" ")
    };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
