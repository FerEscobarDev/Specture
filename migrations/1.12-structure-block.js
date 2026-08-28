const fs = require("fs");
const path = require("path");
const { stackField } = require("../hooks/lib/doctor/project");
const { IGNORED_DIRS } = require("../hooks/lib/doctor/project");

const STACK = ".specture/stack.yml";
const ROLES = ["api", "web", "app", "landing"];

function slugFrom(stackText) {
  const explicit = stackField(stackText, "project", "slug");
  if (explicit && !/^\[/.test(explicit)) return explicit;
  const name = stackField(stackText, "project", "name") || "";
  return name.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

module.exports = {
  id: "1.12-structure-block",
  since: "1.12.0",
  kind: "assisted",
  title: "stack.yml `project.slug` + `structure` block (root-folder naming by app role)",
  detect(ctx) {
    const text = ctx.read(STACK);
    if (text === null) return "n/a";
    return /^structure\s*:/m.test(text) ? "done" : "pending";
  },
  planInputs(ctx) {
    const text = ctx.read(STACK) || "";
    const slug = slugFrom(text);
    let topLevel = [];
    try {
      topLevel = fs.readdirSync(ctx.projectRoot, { withFileTypes: true }).filter((d) => d.isDirectory() && !IGNORED_DIRS.has(d.name) && !d.name.startsWith(".")).map((d) => d.name);
    } catch {
      topLevel = [];
    }
    const matching = ROLES.map((role) => ({ role, dir: `${slug}_${role}` })).filter((c) => topLevel.includes(c.dir));
    return {
      file: STACK,
      slug,
      topLevelDirs: topLevel,
      matching,
      suggestedRootLayout: matching.length > 0 ? "by-app-suffix" : "custom",
      template: "templates/project-config/stack.template.yml (block `structure`)",
      guidance: "Add `project.slug` and the `structure` block. Adopted projects keep `root_layout: custom` unless the existing folders already follow `<slug>_<role>` — then `by-app-suffix` with only the roles that exist. Never rename folders."
    };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
