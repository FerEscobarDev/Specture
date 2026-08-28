const { templateText, extractSection, eolOf } = require("./lib");

const CONVENTIONS = ".specture/conventions.md";
const HAS_12 = /^##\s*12\./m;
const HAS_13 = /^##\s*13\./m;

module.exports = {
  id: "1.10-rules-sections",
  since: "1.10.0",
  kind: "mechanical",
  title: "conventions.md §12 Invariantes (R-*) and §13 Workflow (W-*) sections",
  detect(ctx) {
    const text = ctx.read(CONVENTIONS);
    if (text === null) return "n/a";
    return HAS_12.test(text) && HAS_13.test(text) ? "done" : "pending";
  },
  apply(ctx) {
    const text = ctx.read(CONVENTIONS);
    const eol = eolOf(text);
    const template = templateText("project-config/conventions.template.md");
    const section = (regex) => extractSection(template, regex).replace(/\s*$/, "").replace(/\n/g, eol);
    let out = text.replace(/\s*$/, "");
    if (!HAS_12.test(out)) out += eol + eol + section(/^##\s*12\./);
    if (!HAS_13.test(out)) out += eol + eol + section(/^##\s*13\./);
    ctx.write(CONVENTIONS, out.replace(/\s*$/, "") + eol);
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
