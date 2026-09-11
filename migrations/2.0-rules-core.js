const { templateText, insertRuleItems, eolOf } = require("./lib");
const { parseRulesYaml, serializeRulesList, lintCore, CORE_RULES, CORE_SOURCE } = require("../hooks/lib/rules");

// v2.0.0 makes four invariants mandatory in every Specture project (`framework-core`):
// one component per file, one exported class/service per file, types/interfaces/constants/hooks
// outside the component or class file, and SOLID front and back. `rules.template.yml` ships
// them, so a project created from v2.0.0 is already conformant and so is one that runs
// `1.19-rules-file` (it builds the file from that template) — this migration exists for the
// projects that ALREADY have a `.specture/rules.yml` written before the core existed.
//
// It only ever ADDS a missing id or RAISES a severity to its floor. It never rewrites a rule's
// text: a project is allowed to sharpen or translate the wording, and `lintCore` deliberately
// compares ids and severities only. Everything else in the file — comments, ordering, the
// project's own rules — survives byte-for-byte.

const STACK = ".specture/stack.yml";
const RULES = ".specture/rules.yml";

const SEVERITY_LINE = /^(\s*severity\s*:\s*)(\S+)(\s*)$/;

// The physical lines of one rule: from its `- id:` line to the line before the next rule.
function blockEnd(all, startIndex) {
  for (let i = startIndex + 1; i < all.length; i++) {
    if (/^\s*-\s+id\s*:/.test(all[i])) return i - 1;
    if (!/^\s/.test(all[i]) && all[i].trim() !== "") return i - 1;
  }
  return all.length - 1;
}

function raiseSeverity(all, rule, floor) {
  const start = (rule._line || 0) - 1;
  if (start < 0 || !/^\s*-\s+id\s*:/.test(all[start] || "")) return false;
  for (let i = start; i <= blockEnd(all, start); i++) {
    const m = all[i].match(SEVERITY_LINE);
    if (m) {
      all[i] = `${m[1]}${floor}${m[3]}`;
      return true;
    }
  }
  // A rule with no `severity:` line at all: the schema lint already reports it; give it the floor.
  all.splice(start + 1, 0, `    severity: ${floor}`);
  return true;
}

module.exports = {
  id: "2.0-rules-core",
  since: "2.0.0",
  kind: "mechanical",
  title: "`.specture/rules.yml`: restore the mandatory `framework-core` invariants (R-FILE-001/002/003, R-SOLID-001)",
  detect(ctx) {
    if (ctx.read(STACK) === null) return "n/a";
    const text = ctx.read(RULES);
    // No file yet: `1.19-rules-file` creates it from the template, core included. Only when
    // there is no conventions.md either — so 1.19 is n/a — does this migration create it.
    if (text === null) return ctx.read(".specture/conventions.md") === null ? "pending" : "n/a";
    let parsed;
    try {
      parsed = parseRulesYaml(text);
    } catch {
      return "n/a"; // the doctor reports `rules-schema`; a broken file is not ours to rewrite
    }
    return lintCore(parsed.rules).length > 0 ? "pending" : "done";
  },
  apply(ctx) {
    if (ctx.read(STACK) === null) return { notes: [] };
    const raw = ctx.read(RULES);

    if (raw === null) {
      if (ctx.read(".specture/conventions.md") !== null) return { notes: [] };
      const template = templateText("project-config/rules.template.yml").replace(/\r\n/g, "\n");
      ctx.write(RULES, template);
      return { notes: [`${RULES} created from the template with the \`${CORE_SOURCE}\` rules (the project had no conventions.md, so \`1.19-rules-file\` did not run).`] };
    }

    let parsed;
    try {
      parsed = parseRulesYaml(raw);
    } catch (error) {
      return { notes: [`${RULES} does not parse (${error.message}) — fix it and run \`/specture:doctor migrate\` again; nothing was written.`] };
    }

    const findings = lintCore(parsed.rules);
    if (findings.length === 0) return { notes: [] };

    const eol = eolOf(raw);
    const all = raw.replace(/\r\n/g, "\n").split("\n");
    const byId = new Map(parsed.rules.filter((r) => typeof r.id === "string").map((r) => [r.id, r]));

    // Severities first: raising them in place keeps every `_line` valid. Adding items comes
    // after, because splicing new lines in would shift the line numbers of everything below.
    const raised = [];
    for (const finding of findings.filter((f) => f.check === "rules-core-weakened")) {
      const core = CORE_RULES.find((c) => c.id === finding.id);
      if (raiseSeverity(all, byId.get(finding.id), core.severity)) raised.push(`${finding.id} → ${core.severity}`);
    }

    const missing = findings.filter((f) => f.check === "rules-core-missing").map((f) => CORE_RULES.find((c) => c.id === f.id));
    const items = missing.length > 0 ? serializeRulesList(missing).split("\n").slice(1).filter((l) => l !== "") : [];
    const text = insertRuleItems(all.join("\n"), items);
    ctx.write(RULES, text.replace(/\n/g, eol));

    const notes = [];
    if (missing.length > 0) notes.push(`${missing.length} \`${CORE_SOURCE}\` rule(s) restored in ${RULES}: ${missing.map((r) => r.id).join(", ")}. They are mandatory in every Specture project; the project's own rules were not touched.`);
    if (raised.length > 0) notes.push(`${raised.length} \`${CORE_SOURCE}\` rule(s) raised back to their floor: ${raised.join(", ")} — the core can be tightened, never weakened.`);
    notes.push("`conventions.md` §2 must declare WHERE types, constants and hooks live (R-FILE-003); `2.0-file-org-conventions` asks for it.");
    return { notes };
  },
  verify(ctx) {
    const text = ctx.read(RULES);
    if (text === null) return this.detect(ctx) === "n/a";
    try {
      return lintCore(parseRulesYaml(text).rules).length === 0;
    } catch {
      return false;
    }
  }
};
