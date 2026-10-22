// Rules lint — `.specture/rules.yml` (invariants R-*) and the §4 deny-list of conventions.md.
// Every finding: { severity, group: "rules", check, file, detail, action }.
//
//   rules-schema  ERROR    the file does not parse, or a rule lacks id/rule/tags/severity,
//                          repeats an id or declares an unknown severity
//   rule-length   WARNING  a `rule` exceeds RULE_MAX_CHARS or a §4 deny-list item spans more
//                          than DENY_LIST_MAX_LINES physical lines — the story belongs in an
//                          ADR / debug log linked from `source`, never inline (roadmap item 39)
//   rules-core-missing   ERROR  a `framework-core` invariant is absent (since v2.0.0)
//   rules-core-weakened  ERROR  a `framework-core` invariant declares a severity below its floor
//   rules-tag-unreachable WARNING a rule none of whose tags can ever match a spec: not `all`, not
//                          a layer (backend/frontend/mobile), not a component slug of
//                          architecture.md, not a `Módulo` declared by a spec. Rules Resolution
//                          never injects it, so the implementer and the per-spec reviewer never
//                          see it — only the milestone compliance review (which reads every rule)
//                          does, which is how the same finding keeps coming back (since v2.8.0)
//   rules-core-overlap   WARNING a team-adapted `R-FILE-003` still demands constants or hooks
//                          outside the file: since v2.8.0 those belong to `R-FILE-004`
//                          [frontend, mobile] (with the local-constant exception), so the two
//                          rules contradict each other in frontend and the old one over-asks in
//                          backend. The migration `2.8-rules-core-scope` never rewrites an
//                          adapted wording — this warning is how the team learns to narrow it
//
// The core is the one thing in this file the framework owns rather than the team: a project may
// tighten it and may add rules of its own, but removing an id or lowering a severity breaks the
// contract every Specture project is meant to share. `/specture:doctor migrate` restores it.

const { readRules, lintRules, lintCore, denyListItems, normalizeTag, reachableTags, CORE_RULES, DENY_LIST_MAX_LINES } = require("../../rules");

const RULES = ".specture/rules.yml";
const CONVENTIONS = ".specture/conventions.md";
const OVERLAP_ID = "R-FILE-003";
const OVERLAP_WORDS = /\b(constante|constant|hook|composable)/i;

const plain = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

function coreOverlap(rules) {
  const rule = rules.find((r) => r.id === OVERLAP_ID);
  const core = CORE_RULES.find((r) => r.id === OVERLAP_ID);
  if (!rule || !core || !rules.some((r) => r.id === "R-FILE-004")) return [];
  const text = `${plain(rule.rule)} ${plain(rule.verify)}`;
  if (plain(rule.rule) === plain(core.rule) || !OVERLAP_WORDS.test(text)) return [];
  return [finding(
    "WARNING",
    "rules-core-overlap",
    RULES,
    `${OVERLAP_ID}: the team's wording still demands constants or hooks outside the file${rule._line ? ` (line ${rule._line})` : ""} — since v2.8.0 that is \`R-FILE-004\` [frontend, mobile], which also allows a local, non-exported constant; in backend constants may live in their class`,
    "narrow `rule` and `verify` of R-FILE-003 to interfaces and types (the template's text is in `templates/project-config/rules.template.yml`); keep any extra wording you need in R-FILE-004 instead"
  )];
}

function unreachable(project, rules) {
  const reachable = reachableTags(project.root);
  return rules
    .filter((rule) => Array.isArray(rule.tags) && rule.tags.length > 0)
    .filter((rule) => !rule.tags.map(normalizeTag).some((t) => reachable.has(t)))
    .map((rule) => finding(
      "WARNING",
      "rules-tag-unreachable",
      RULES,
      `${rule.id}: tags [${rule.tags.map(normalizeTag).join(", ")}] match no layer, no \`all\`, no component of architecture.md and no spec \`Módulo\` — the rule is never injected into the implementer or the per-spec reviewer${rule._line ? ` (line ${rule._line})` : ""}`,
      "retag it: `all` for style/structure/naming that apply everywhere, `backend`/`frontend`/`mobile` for a layer, the component slug for a domain rule (`node hooks/lib/components.js components` lists them); if the tag is a module your next specs will declare, ignore this warning"
    ));
}

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
  return [...lint, ...core, ...coreOverlap(rules.parsed.rules), ...unreachable(project, rules.parsed.rules)];
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
