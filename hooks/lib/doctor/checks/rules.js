// Rules lint — `.specture/rules.yml` (invariants R-*) and the §4 deny-list of conventions.md.
// Every finding: { severity, group: "rules", check, file, detail, action }.
//
//   rules-schema  ERROR    the file does not parse, or a rule lacks id/rule/tags/severity,
//                          repeats an id or declares an unknown severity
//   rule-length   WARNING  a `rule` exceeds RULE_MAX_CHARS or a §4 deny-list item spans more
//                          than DENY_LIST_MAX_LINES physical lines — the story belongs in an
//                          ADR / debug log linked from `source`, never inline (roadmap item 39)
//   rules-core-missing   ERROR  a `framework-core` invariant is absent (since v1.20.0)
//   rules-core-weakened  ERROR  a `framework-core` invariant declares a severity below its floor
//
// The core is the one thing in this file the framework owns rather than the team: a project may
// tighten it and may add rules of its own, but removing an id or lowering a severity breaks the
// contract every Specture project is meant to share. `/specture:doctor migrate` restores it.

const { readRules, lintRules, lintCore, denyListItems, DENY_LIST_MAX_LINES } = require("../../rules");

const RULES = ".specture/rules.yml";
const CONVENTIONS = ".specture/conventions.md";

function finding(severity, check, file, detail, action) {
  return { severity, group: "rules", check, file, detail, action };
}

function rulesFile(project) {
  const rules = readRules(project.root);
  if (!rules.exists) return [];
  if (rules.error) {
    return [finding("ERROR", "rules-schema", RULES, `does not parse: ${rules.error.message}`, "fix the file — the grammar is in its header comment (one `- id:` item per rule, `key: value` lines, no multi-line values)")];
  }
  const lint = lintRules(rules.parsed).map((f) => finding(f.check === "rule-length" ? "WARNING" : "ERROR", f.check, RULES, f.line ? `${f.detail} (line ${f.line})` : f.detail, f.action));
  const core = lintCore(rules.parsed.rules).map((f) => finding("ERROR", f.check, RULES, f.line ? `${f.detail} (line ${f.line})` : f.detail, f.action));
  return [...lint, ...core];
}

function denyList(project) {
  const text = project.read(CONVENTIONS);
  if (text === null) return [];
  return denyListItems(text)
    .filter((item) => item.lines > DENY_LIST_MAX_LINES)
    .map((item) => finding("WARNING", "rule-length", CONVENTIONS, `§4 deny-list item «${item.text.slice(0, 60)}${item.text.length > 60 ? "…" : ""}» spans ${item.lines} lines (max ${DENY_LIST_MAX_LINES})`, "keep each §4 item to the pattern plus a link; move the story to an ADR or debug log"));
}

function run(project) {
  return [...rulesFile(project), ...denyList(project)];
}

module.exports = { run };
