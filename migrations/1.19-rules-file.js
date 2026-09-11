const { templateText, extractSection, eolOf } = require("./lib");
const { parseConventionsRules, serializeRulesList, parseRulesYaml, replaceSectionBody, RULE_MAX_CHARS, SECTION_12 } = require("../hooks/lib/rules");

// v1.19.0 graduates the invariants R-* from a table in conventions.md §12 (delivered whole to
// every worker) to `.specture/rules.yml`: one line per rule, tags, and selective injection by
// the build coordinator (Rules Resolution). This migration moves every real row — table form
// or bullet form — into the file, keeps §12 as a pointer (same pattern as §10 → settings.yml)
// and reports the rules that will need a human hand (defaulted severity, over-long text).

const CONVENTIONS = ".specture/conventions.md";
const RULES = ".specture/rules.yml";

// The template ships the `framework-core` rules already inside `rules:` (v1.20.0), so a
// project's own rules are APPENDED after the last item of that list — never by replacing a
// `rules: []` placeholder, which stopped existing and would have dropped every migrated
// rule in silence. The core stays first; the project's rules follow in the order read.
function appendRules(template, rules) {
  const lines = template.split("\n");
  const start = lines.findIndex((l) => /^rules:/.test(l));
  if (start === -1) throw new Error("rules.template.yml no declara `rules:`");
  let end = start;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s+\S/.test(lines[i])) end = i;
    else if (lines[i].trim() !== "") break;
  }
  const items = serializeRulesList(rules).split("\n").slice(1).filter((l) => l !== "");
  lines.splice(end + 1, 0, ...items);
  return lines.join("\n");
}

module.exports = {
  id: "1.19-rules-file",
  since: "1.19.0",
  kind: "mechanical",
  title: "Invariants R-* from conventions.md §12 → .specture/rules.yml (one-line rules, tag injection); §12 becomes a pointer",
  detect(ctx) {
    if (ctx.read(CONVENTIONS) === null) return "n/a";
    return ctx.exists(RULES) ? "done" : "pending";
  },
  apply(ctx) {
    if (ctx.exists(RULES)) return { notes: [] };
    const text = ctx.read(CONVENTIONS);
    const eol = eolOf(text);
    const section = SECTION_12.test(text) ? extractSection(text, SECTION_12) : null;
    const { rules, placeholders, defaulted } = section ? parseConventionsRules(section) : { rules: [], placeholders: 0, defaulted: 0 };

    const template = templateText("project-config/rules.template.yml").replace(/\r\n/g, "\n");
    const yml = rules.length > 0 ? appendRules(template, rules) : template;
    ctx.write(RULES, yml.replace(/\n/g, eol));

    if (section) {
      const pointer = extractSection(templateText("project-config/conventions.template.md").replace(/\r\n/g, "\n"), SECTION_12);
      const body = pointer.split("\n").slice(1).join("\n");
      ctx.write(CONVENTIONS, replaceSectionBody(text, SECTION_12, body));
    }

    const notes = [];
    if (rules.length > 0) notes.push(`${rules.length} rule(s) moved to ${RULES}: ${rules.map((r) => r.id).join(", ")}; conventions.md §12 is now a pointer. The file also ships the mandatory \`framework-core\` rules.`);
    else notes.push(`${RULES} created with the \`framework-core\` rules only (no project rules in §12)${placeholders ? ` — ${placeholders} placeholder row(s) skipped` : ""}.`);
    if (defaulted > 0) notes.push(`${defaulted} rule(s) had no tags/severity (bullet or short-table form): tagged \`all\` and IMPORTANT — review them.`);
    const long = rules.filter((r) => r.rule.length > RULE_MAX_CHARS).map((r) => r.id);
    if (long.length > 0) notes.push(`over ${RULE_MAX_CHARS} characters (the doctor will flag rule-length): ${long.join(", ")} — move the story to an ADR / debug log and link it in \`source\`.`);
    return { notes };
  },
  verify(ctx) {
    const text = ctx.read(RULES);
    if (text === null) return false;
    try {
      parseRulesYaml(text);
      return true;
    } catch {
      return false;
    }
  }
};
