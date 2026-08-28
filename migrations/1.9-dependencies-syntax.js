const { lines, epicIdFrom } = require("../hooks/lib/doctor/project");
const { dependenciesValid } = require("./lib");

const ROADMAP = "docs/04-roadmap/ROADMAP.md";
const DEP_LINE = /^\s*-\s*\*{0,2}Dependencias\*{0,2}\s*:\s*\*{0,2}\s*(.*)$/i;

function invalidLines(ctx) {
  const text = ctx.read(ROADMAP);
  if (text === null) return [];
  const out = [];
  let currentEpic = null;
  lines(text).forEach((line, index) => {
    if (/^\s*-\s*\[( |\/|x)\]/.test(line)) currentEpic = epicIdFrom(line) || `line ${index + 1}`;
    const dep = line.match(DEP_LINE);
    if (dep && !dependenciesValid(dep[1])) {
      out.push({ lineNo: index + 1, epic: currentEpic, value: dep[1].trim() });
    }
  });
  return out;
}

module.exports = {
  id: "1.9-dependencies-syntax",
  since: "1.9.0",
  kind: "assisted",
  title: "ROADMAP `Dependencias:` lines in the parseable grammar (Ninguna | Epic X.Y | Milestone N completo)",
  detect(ctx) {
    if (!ctx.exists(ROADMAP)) return "n/a";
    return invalidLines(ctx).length > 0 ? "pending" : "done";
  },
  planInputs(ctx) {
    return {
      file: ROADMAP,
      invalid: invalidLines(ctx),
      grammar: "Ninguna · Epic X.Y[, Epic Z.W] · Milestone N completo · unions separated by commas",
      guidance: "Rewrite each listed line keeping its meaning; if the prose names a dependency that is not an epic ID (e.g. a human approval), move the prose to the epic's Descripción and leave only epic IDs / Ninguna."
    };
  },
  verify(ctx) {
    return invalidLines(ctx).length === 0;
  }
};
