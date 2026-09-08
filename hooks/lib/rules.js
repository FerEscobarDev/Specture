// Specture project rules — `.specture/rules.yml` (invariants R-*), since v1.19.0.
//
// The invariants a project declares (immutable DTOs, method naming, error envelopes…)
// live in a small machine-readable file so that the build coordinator can inject ONLY the
// rules whose tags intersect the spec (Rules Resolution — same doctrine as Docs Index
// Resolution: agents never open the file), the doctor can lint them mechanically and
// knowledge capture can append to them. Before v1.19.0 they were a table in
// `conventions.md` §12 that reached every worker in full (migration `1.19-rules-file`).
//
// No dependencies: the YAML subset is a list of flat maps with scalar / inline-list values.
// Multi-line values are rejected on purpose — a rule is one line (≤ RULE_MAX_CHARS).

const fs = require("fs");
const path = require("path");
const { lines, extractSection } = require("./doctor/project");

const RULES_FILE = path.join(".specture", "rules.yml");
const RULE_MAX_CHARS = 240;
const DENY_LIST_MAX_LINES = 2;
const SEVERITIES = ["BLOCKER", "IMPORTANT"];
const ID_PATTERN = /^R-[A-Za-z0-9][A-Za-z0-9-]*$/;
const ALL_TAG = "all";
const SECTION_12 = /^##\s*12\./m;
const SECTION_4 = /^##\s*4\./m;

class RulesParseError extends Error {
  constructor(message, line) {
    super(line ? `${message} (line ${line})` : message);
    this.name = "RulesParseError";
    this.line = line || null;
  }
}

function stripComment(line) {
  let inQuote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(text) {
  if (/^'(?:[^']|'')*'$/.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^"(?:[^"\\]|\\.)*"$/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}

function splitList(inner) {
  return inner.split(",").map((t) => unquote(t.trim())).filter((t) => t !== "");
}

function parseScalar(raw, lineNo) {
  const text = raw.trim();
  if (/^[|>][+-]?$/.test(text)) {
    throw new RulesParseError("multi-line values are not supported — a rule is one line", lineNo);
  }
  if (/^\[.*\]$/.test(text)) return splitList(text.slice(1, -1));
  if ((text.startsWith('"') && !/"$/.test(text)) || (text.startsWith("'") && !/'$/.test(text))) {
    throw new RulesParseError("unterminated quote — a value must close on the same line (multi-line values are not supported)", lineNo);
  }
  return unquote(text);
}

function assignField(rule, body, lineNo) {
  const match = body.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*)|\s*)$/);
  if (!match) {
    throw new RulesParseError(`expected \`key: value\`, got "${body}" — multi-line values are not supported (a rule is one line)`, lineNo);
  }
  rule[match[1]] = parseScalar(match[2] || "", lineNo);
}

// Parses rules.yml → { schema, rules: [{ id, tags, rule, verify, severity, source, _line }] }.
// Throws RulesParseError (with .line) on anything outside the documented grammar.
function parseRulesYaml(text) {
  const out = { schema: null, rules: [] };
  let inRules = false;
  let current = null;
  lines(text).forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = stripComment(rawLine).replace(/\s+$/, "");
    if (!line.trim()) return;
    if (/^\t/.test(line)) throw new RulesParseError("tabs are not allowed for indentation", lineNo);
    const indent = line.match(/^ */)[0].length;
    const body = line.trim();
    if (indent === 0) {
      current = null;
      inRules = false;
      const match = body.match(/^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|\s*)$/);
      if (!match) throw new RulesParseError(`unexpected top-level line "${body}"`, lineNo);
      const value = (match[2] || "").trim();
      if (match[1] === "rules") {
        inRules = true;
        if (value !== "" && value !== "[]") throw new RulesParseError("`rules:` must be a list (one `- id:` item per rule) or `[]`", lineNo);
      } else {
        out[match[1]] = parseScalar(value, lineNo);
      }
      return;
    }
    if (!inRules) throw new RulesParseError(`indented line outside \`rules:\`: "${body}"`, lineNo);
    if (body === "-") throw new RulesParseError("empty list item", lineNo);
    if (body.startsWith("- ")) {
      current = { _line: lineNo };
      out.rules.push(current);
      assignField(current, body.slice(2).trim(), lineNo);
      return;
    }
    if (!current) throw new RulesParseError("expected `- id: …` to start a rule", lineNo);
    assignField(current, body, lineNo);
  });
  for (const rule of out.rules) {
    if (typeof rule.tags === "string") rule.tags = splitList(rule.tags);
  }
  return out;
}

function normalizeTag(tag) {
  return String(tag).trim().toLowerCase().replace(/[\s_]+/g, "-");
}

// Mechanical lint: [{ check: "rules-schema" | "rule-length", id, line, detail, action }].
function lintRules(parsed) {
  const out = [];
  const push = (check, rule, detail, action) => out.push({ check, id: rule ? rule.id || null : null, line: rule ? rule._line : null, detail, action });
  if (parsed.schema === null || parsed.schema === undefined || parsed.schema === "") {
    push("rules-schema", null, "missing `schema: 1`", "add `schema: 1` at the top of .specture/rules.yml");
  } else if (String(parsed.schema) !== "1") {
    push("rules-schema", null, `unsupported schema ${JSON.stringify(parsed.schema)}`, "this plugin reads `schema: 1`");
  }
  const seen = new Set();
  for (const rule of parsed.rules) {
    const label = rule.id || `item at line ${rule._line}`;
    if (typeof rule.id !== "string" || !ID_PATTERN.test(rule.id)) {
      push("rules-schema", rule, `${label}: id must look like R-<n> (R-1, R-SEG-3)`, "give the rule a stable `R-` id — the reviewer cites it");
    } else if (seen.has(rule.id)) {
      push("rules-schema", rule, `${rule.id}: duplicate id`, "ids are cited by the reviewer — keep them unique");
    }
    if (typeof rule.id === "string") seen.add(rule.id);
    if (typeof rule.rule !== "string" || rule.rule.trim() === "") {
      push("rules-schema", rule, `${label}: missing \`rule\``, "state the invariant in one sentence");
    }
    if (!Array.isArray(rule.tags) || rule.tags.length === 0) {
      push("rules-schema", rule, `${label}: missing \`tags\``, "declare the tags the rule applies to (`[all]` = every dispatch)");
    }
    if (!SEVERITIES.includes(String(rule.severity || "").toUpperCase())) {
      push("rules-schema", rule, `${label}: severity must be BLOCKER or IMPORTANT (got ${rule.severity === undefined ? "nothing" : JSON.stringify(rule.severity)})`, "declare the severity the reviewer must use");
    }
    if (typeof rule.rule === "string" && rule.rule.length > RULE_MAX_CHARS) {
      push("rule-length", rule, `${label}: rule is ${rule.rule.length} characters (max ${RULE_MAX_CHARS}) — it tells the story instead of stating the invariant`, "keep `rule` to one sentence; move the story to an ADR or debug log and link it in `source`");
    }
  }
  return out;
}

// The rules whose tags intersect `tags` (normalized), plus every rule tagged `all`.
function resolveRules(rules, tags, options = {}) {
  const wanted = new Set((tags || []).map(normalizeTag).filter(Boolean));
  return rules.filter((rule) => {
    if (options.all) return true;
    const own = (Array.isArray(rule.tags) ? rule.tags : []).map(normalizeTag);
    return own.includes(ALL_TAG) || own.some((t) => wanted.has(t));
  });
}

// The block the coordinator pastes into a dispatch. Empty → exactly `RULES_RESOLVED: []`.
function formatBlock(resolved, options = {}) {
  const total = options.total === undefined ? resolved.length : options.total;
  const scope = options.all ? "all rules" : `tags: ${(options.tags || []).map(normalizeTag).join(", ") || "(none)"}`;
  if (resolved.length === 0) return `RULES_RESOLVED: [] · 0 of ${total} rules match ${scope}`;
  const out = [`RULES_RESOLVED: ${resolved.length} of ${total} (${scope})`];
  for (const rule of resolved) {
    const parts = [`- ${rule.id} [${(rule.tags || []).map(normalizeTag).join(", ")}] ${String(rule.severity || "").toUpperCase()} — ${rule.rule}`];
    if (rule.verify) parts.push(`verificar: ${rule.verify}`);
    if (rule.source) parts.push(`fuente: ${rule.source}`);
    out.push(parts.join(" · "));
  }
  return out.join("\n");
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function yamlTag(tag) {
  return /^[a-z0-9][a-z0-9-]*$/.test(tag) ? tag : JSON.stringify(tag);
}

// `rules:` block in the template's shape (LF). Empty list → `rules: []`.
function serializeRulesList(rules) {
  if (rules.length === 0) return "rules: []\n";
  const out = ["rules:"];
  for (const rule of rules) {
    out.push(`  - id: ${rule.id}`);
    out.push(`    tags: [${(rule.tags && rule.tags.length ? rule.tags : [ALL_TAG]).map(normalizeTag).map(yamlTag).join(", ")}]`);
    out.push(`    rule: ${yamlString(rule.rule)}`);
    if (rule.verify) out.push(`    verify: ${yamlString(rule.verify)}`);
    out.push(`    severity: ${String(rule.severity || "IMPORTANT").toUpperCase()}`);
    if (rule.source) out.push(`    source: ${yamlString(rule.source)}`);
  }
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// conventions.md — the legacy §12 (table or bullets) and the §4 deny-list.
// ---------------------------------------------------------------------------

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const BULLET_RULE = /^\s*[-*]\s+\**(R-[A-Za-z0-9][A-Za-z0-9-]*)\**\s*:?\**\s*:?\s*(.*)$/;

function isPlaceholder(cell) {
  const text = (cell || "").trim();
  return text === "" || /^\[.*\]$/.test(text) || /^\[ej\./.test(text) || /^—$/.test(text);
}

function clean(cell) {
  return (cell || "").replace(/\s+/g, " ").trim();
}

function tagsFrom(cell) {
  const text = clean(cell);
  if (isPlaceholder(text)) return [ALL_TAG];
  const tags = text.replace(/[[\]`]/g, "").split(/[,;]/).map(normalizeTag).filter(Boolean);
  return tags.length > 0 ? tags : [ALL_TAG];
}

function severityFrom(cell) {
  const text = clean(cell).toUpperCase();
  return SEVERITIES.includes(text) ? text : "IMPORTANT";
}

// Rules declared in a conventions.md §12 section (pre-v1.19 shapes):
//   | R-1 | tags | rule | verify | severity | source |     (template table, 6 columns)
//   - **R-1:** rule text                                  (bullet form, tags = all)
// Placeholder rows (`[ej. …]`, `[…]`, empty rule) are skipped and counted.
function parseConventionsRules(sectionText) {
  const rules = [];
  let placeholders = 0;
  let defaulted = 0;
  for (const line of lines(sectionText)) {
    const row = line.match(TABLE_ROW);
    if (row) {
      const cells = row[1].split("|").map((c) => c.trim());
      if (!/^\**R-/i.test(cells[0])) continue;
      const id = cells[0].replace(/\*/g, "").trim();
      if (cells.length >= 6) {
        const [, tags, rule, verify, severity, source] = cells;
        if (isPlaceholder(rule)) {
          placeholders += 1;
          continue;
        }
        rules.push({ id, tags: tagsFrom(tags), rule: clean(rule), verify: isPlaceholder(verify) ? "" : clean(verify), severity: severityFrom(severity), source: isPlaceholder(source) ? "" : clean(source) });
      } else {
        const rule = clean(cells[cells.length - 1]);
        if (isPlaceholder(rule)) {
          placeholders += 1;
          continue;
        }
        defaulted += 1;
        rules.push({ id, tags: [ALL_TAG], rule, verify: "", severity: "IMPORTANT", source: "" });
      }
      continue;
    }
    const bullet = line.match(BULLET_RULE);
    if (bullet) {
      const text = clean(bullet[2]);
      if (isPlaceholder(text)) {
        placeholders += 1;
        continue;
      }
      defaulted += 1;
      rules.push({ id: bullet[1], tags: [ALL_TAG], rule: text, verify: "", severity: "IMPORTANT", source: "" });
    }
  }
  return { rules, placeholders, defaulted };
}

// Items of the §4 deny-list with the number of physical lines each one spans.
function denyListItems(conventionsText) {
  const section = extractSection(conventionsText, SECTION_4);
  if (!section) return [];
  const items = [];
  let current = null;
  for (const line of lines(section).slice(1)) {
    if (/^\s*[-*]\s+/.test(line)) {
      current = { text: line.replace(/^\s*[-*]\s+/, "").trim(), lines: 1 };
      items.push(current);
      continue;
    }
    if (!line.trim() || /^\s*(>|#|\|)/.test(line)) {
      current = null;
      continue;
    }
    if (current) current.lines += 1;
  }
  return items;
}

// Replaces the body of the markdown section headed by `headingRegex` (heading line kept,
// project EOL kept). Returns the text unchanged when the section is absent.
function replaceSectionBody(text, headingRegex, newBody) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const all = lines(text);
  const start = all.findIndex((l) => headingRegex.test(l));
  if (start === -1) return text;
  const level = (all[start].match(/^#+/) || ["##"])[0].length;
  let end = all.length;
  for (let i = start + 1; i < all.length; i++) {
    const h = all[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) {
      end = i;
      break;
    }
  }
  const body = newBody.replace(/\r?\n/g, "\n").replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
  const tail = end < all.length ? [""] : [];
  const rebuilt = [...all.slice(0, start + 1), "", ...body, ...tail, ...all.slice(end)];
  return rebuilt.join(eol).replace(/(\r?\n)*$/, eol);
}

function readRules(projectRoot) {
  const file = path.join(projectRoot, RULES_FILE);
  if (!fs.existsSync(file)) return { exists: false, path: file, parsed: null, error: null };
  try {
    return { exists: true, path: file, parsed: parseRulesYaml(fs.readFileSync(file, "utf8")), error: null };
  } catch (error) {
    return { exists: true, path: file, parsed: null, error };
  }
}

// Rules still declared in conventions.md §12 (a project not yet migrated to rules.yml).
function legacyRules(conventionsText) {
  if (!conventionsText || !SECTION_12.test(conventionsText)) return [];
  const section = extractSection(conventionsText, SECTION_12);
  return section ? parseConventionsRules(section).rules : [];
}

module.exports = {
  RULES_FILE,
  RULE_MAX_CHARS,
  DENY_LIST_MAX_LINES,
  SEVERITIES,
  ID_PATTERN,
  ALL_TAG,
  SECTION_12,
  RulesParseError,
  parseRulesYaml,
  normalizeTag,
  lintRules,
  resolveRules,
  formatBlock,
  serializeRulesList,
  parseConventionsRules,
  denyListItems,
  replaceSectionBody,
  readRules,
  legacyRules
};
