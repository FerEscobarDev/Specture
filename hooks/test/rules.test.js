const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  RULE_MAX_CHARS,
  RulesParseError,
  parseRulesYaml,
  lintRules,
  resolveRules,
  formatBlock,
  serializeRulesList,
  parseConventionsRules,
  denyListItems,
  replaceSectionBody,
  legacyRules
} = require("../lib/rules");

const SAMPLE = [
  "# header comment",
  "schema: 1",
  "rules:",
  "  - id: R-1",
  "    tags: [dto, domain]   # inline comment",
  '    rule: "Los DTOs son inmutables: sin setters, campos readonly/final"',
  "    verify: 'sin setters públicos ni mutación post-construcción'",
  "    severity: BLOCKER",
  '    source: "ADR-004 §DTOs"',
  "  - id: R-2",
  "    tags: [naming, all]",
  "    rule: Métodos de consulta = sustantivo; comandos = verbo imperativo",
  "    severity: important",
  ""
].join("\n");

test("parses the documented grammar: comments, quotes, inline lists, bare scalars", () => {
  const parsed = parseRulesYaml(SAMPLE);
  assert.equal(parsed.schema, "1");
  assert.equal(parsed.rules.length, 2);
  const [r1, r2] = parsed.rules;
  assert.equal(r1.id, "R-1");
  assert.deepEqual(r1.tags, ["dto", "domain"]);
  assert.equal(r1.rule, "Los DTOs son inmutables: sin setters, campos readonly/final");
  assert.equal(r1.verify, "sin setters públicos ni mutación post-construcción");
  assert.equal(r1.severity, "BLOCKER");
  assert.equal(r1.source, "ADR-004 §DTOs");
  assert.equal(r1._line, 4);
  assert.deepEqual(r2.tags, ["naming", "all"]);
  assert.equal(r2.rule, "Métodos de consulta = sustantivo; comandos = verbo imperativo");
  assert.equal(r2.severity, "important");
  assert.deepEqual(parseRulesYaml("schema: 1\nrules: []\n").rules, []);
  assert.deepEqual(parseRulesYaml("schema: 1\nrules: []\n").schema, "1");
});

test("rejects multi-line values and malformed lines with the line number", () => {
  assert.throws(() => parseRulesYaml("schema: 1\nrules:\n  - id: R-1\n    rule: |\n      first\n      second\n"), (e) => e instanceof RulesParseError && e.line === 4 && /multi-line/.test(e.message));
  assert.throws(() => parseRulesYaml('schema: 1\nrules:\n  - id: R-1\n    rule: "starts here\n    and continues"\n'), (e) => e.line === 4 && /unterminated quote/.test(e.message));
  assert.throws(() => parseRulesYaml("schema: 1\nrules:\n  - id: R-1\n    rule: first line\n    second line without a key\n"), (e) => e.line === 5 && /key: value/.test(e.message));
  assert.throws(() => parseRulesYaml("schema: 1\nrules: something\n"), (e) => e.line === 2);
  assert.throws(() => parseRulesYaml("schema: 1\n  - id: R-1\n"), (e) => e.line === 2 && /outside/.test(e.message));
  assert.throws(() => parseRulesYaml("schema: 1\nrules:\n\t- id: R-1\n"), (e) => e.line === 3 && /tabs/.test(e.message));
});

test("lint: missing fields, duplicate ids, bad severity, over-long rule", () => {
  const parsed = parseRulesYaml([
    "rules:",
    "  - id: R-1",
    "    tags: [dto]",
    `    rule: "${"x".repeat(RULE_MAX_CHARS + 1)}"`,
    "    severity: BLOCKER",
    "  - id: R-1",
    "    tags: []",
    "    severity: MAYBE",
    "  - id: bad",
    "    tags: [a]",
    "    rule: ok",
    "    severity: IMPORTANT",
    ""
  ].join("\n"));
  const findings = lintRules(parsed);
  const checks = findings.map((f) => `${f.check}:${f.id || "-"}`);
  assert.ok(checks.includes("rules-schema:-"), "missing schema");
  assert.ok(findings.some((f) => f.check === "rule-length" && f.id === "R-1" && f.line === 2), "over-long R-1");
  assert.ok(findings.some((f) => f.check === "rules-schema" && /duplicate/.test(f.detail)), "duplicate id");
  assert.ok(findings.some((f) => f.check === "rules-schema" && /missing `rule`/.test(f.detail)), "missing rule");
  assert.ok(findings.some((f) => f.check === "rules-schema" && /missing `tags`/.test(f.detail)), "missing tags");
  assert.ok(findings.some((f) => f.check === "rules-schema" && /severity must be/.test(f.detail) && /MAYBE/.test(f.detail)), "bad severity");
  assert.ok(findings.some((f) => f.check === "rules-schema" && /id must look like/.test(f.detail)), "bad id");
  assert.deepEqual(lintRules(parseRulesYaml(SAMPLE)), []);
});

test("resolve: tag intersection (normalized), `all`, and --all", () => {
  const { rules } = parseRulesYaml(SAMPLE);
  assert.deepEqual(resolveRules(rules, ["DTO"]).map((r) => r.id), ["R-1", "R-2"], "R-2 is tagged all");
  assert.deepEqual(resolveRules(rules, ["Domain_Model", "domain"]).map((r) => r.id), ["R-1", "R-2"]);
  assert.deepEqual(resolveRules(rules, ["frontend"]).map((r) => r.id), ["R-2"]);
  const noAll = rules.map((r) => ({ ...r, tags: r.tags.filter((t) => t !== "all") }));
  assert.deepEqual(resolveRules(noAll, ["frontend"]), []);
  assert.deepEqual(resolveRules(noAll, [], { all: true }).map((r) => r.id), ["R-1", "R-2"]);
  assert.deepEqual(resolveRules(noAll, ["dto"]).map((r) => r.id), ["R-1"]);
});

test("formatBlock: the dispatch block, and the exact empty token", () => {
  const { rules } = parseRulesYaml(SAMPLE);
  const block = formatBlock(resolveRules(rules, ["dto"]), { total: 2, tags: ["dto"] });
  const lines = block.split("\n");
  assert.equal(lines[0], "RULES_RESOLVED: 2 of 2 (tags: dto)");
  assert.match(lines[1], /^- R-1 \[dto, domain\] BLOCKER — Los DTOs son inmutables.* · verificar: sin setters .* · fuente: ADR-004 §DTOs$/);
  assert.match(lines[2], /^- R-2 \[naming, all\] IMPORTANT — Métodos de consulta/);
  assert.ok(formatBlock([], { total: 2, tags: ["frontend"] }).startsWith("RULES_RESOLVED: []"));
  assert.match(formatBlock([], { total: 2, all: true }), /^RULES_RESOLVED: \[\] · 0 of 2 rules match all rules$/);
});

test("serializeRulesList round-trips through the parser", () => {
  const rules = [
    { id: "R-1", tags: ["dto", "Domain Model"], rule: 'Los DTOs son "inmutables"', verify: "sin setters", severity: "blocker", source: "ADR-004" },
    { id: "R-2", tags: [], rule: "corta", severity: "IMPORTANT" }
  ];
  const text = "schema: 1\n" + serializeRulesList(rules);
  const parsed = parseRulesYaml(text);
  assert.equal(parsed.rules.length, 2);
  assert.deepEqual(parsed.rules[0].tags, ["dto", "domain-model"]);
  assert.equal(parsed.rules[0].rule, 'Los DTOs son "inmutables"');
  assert.equal(parsed.rules[0].severity, "BLOCKER");
  assert.deepEqual(parsed.rules[1].tags, ["all"], "no tags → all");
  assert.equal(parsed.rules[1].verify, undefined);
  assert.equal(serializeRulesList([]), "rules: []\n");
});

test("parseConventionsRules reads the §12 table and the bullet form, skipping placeholders", () => {
  const table = [
    "## 12. Invariantes del Proyecto (R-*)",
    "",
    "| ID  | Ámbito (tag) | Regla | Cómo verificar | Severidad | Racional / ADR |",
    "|-----|--------------|-------|----------------|-----------|----------------|",
    "| R-1 | dto, domain  | Los DTOs son inmutables | sin setters públicos | BLOCKER | DDD — ADR-004 |",
    "| R-2 | naming       | [ej. Métodos de consulta = sustantivo] | [ej. nombres] | IMPORTANT | §1 Naming |",
    "| R-3 |              | Sin excepciones para flujo de control | — | maybe | — |",
    ""
  ].join("\n");
  const fromTable = parseConventionsRules(table);
  assert.equal(fromTable.placeholders, 1);
  assert.deepEqual(fromTable.rules.map((r) => r.id), ["R-1", "R-3"]);
  assert.deepEqual(fromTable.rules[0], { id: "R-1", tags: ["dto", "domain"], rule: "Los DTOs son inmutables", verify: "sin setters públicos", severity: "BLOCKER", source: "DDD — ADR-004" });
  assert.deepEqual(fromTable.rules[1].tags, ["all"], "empty tag cell → all");
  assert.equal(fromTable.rules[1].severity, "IMPORTANT", "unknown severity → IMPORTANT");
  assert.equal(fromTable.rules[1].source, "");

  const bullets = "## 12. Invariantes del proyecto\n- **R-1:** toda operación HTTP identifica al empleado por el header `X-Employee-Id`.\n- **R-2**: ninguna respuesta de error usa otro shape.\n- R-3: [pendiente]\n";
  const fromBullets = parseConventionsRules(bullets);
  assert.deepEqual(fromBullets.rules.map((r) => [r.id, r.tags, r.severity]), [["R-1", ["all"], "IMPORTANT"], ["R-2", ["all"], "IMPORTANT"]]);
  assert.match(fromBullets.rules[0].rule, /^toda operación HTTP identifica/);
  assert.equal(fromBullets.placeholders, 1);
  assert.equal(fromBullets.defaulted, 2);

  const conventions = "# C\n\n## 4. Deny\n\n- x\n\n" + bullets + "\n## 13. W\n\n- W-3: cc\n";
  assert.deepEqual(legacyRules(conventions).map((r) => r.id), ["R-1", "R-2"]);
  assert.deepEqual(legacyRules("# C\n\n## 4. Deny\n\n- x\n"), []);
  assert.deepEqual(legacyRules(null), []);
});

test("denyListItems counts the physical lines of each §4 item", () => {
  const conventions = [
    "## 3. Patrones Permitidos",
    "",
    "- Repository pattern",
    "",
    "## 4. Patrones Prohibidos (Deny-list)",
    "",
    "> doctrina",
    "",
    "- Repositorios genéricos `Repository<T>`",
    "- Singletons mutables porque en 2024",
    "  tuvimos un bug en pagos",
    "  que tardó tres días — ver ADR-009",
    "- Excepciones para flujo de control",
    "  (ver debug log 2026-01-01)",
    "",
    "## 5. Estilo",
    "",
    "- una línea",
    "  otra",
    "  y otra"
  ].join("\n");
  const items = denyListItems(conventions);
  assert.deepEqual(items.map((i) => i.lines), [1, 3, 2]);
  assert.match(items[1].text, /^Singletons mutables/);
  assert.deepEqual(denyListItems("# sin sección 4\n"), []);
});

test("replaceSectionBody keeps the heading, the neighbours and the file's EOL", () => {
  const lf = "# C\n\n## 11. Índice\n\n- a\n\n## 12. Invariantes (R-*)\n\n| ID | Regla |\n|---|---|\n| R-1 | x |\n\n## 13. Workflow\n\n- W-3\n";
  const out = replaceSectionBody(lf, /^##\s*12\./m, "> puntero\n>\n> más");
  assert.equal(out, "# C\n\n## 11. Índice\n\n- a\n\n## 12. Invariantes (R-*)\n\n> puntero\n>\n> más\n\n## 13. Workflow\n\n- W-3\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  const outCrlf = replaceSectionBody(crlf, /^##\s*12\./m, "> puntero");
  assert.ok(!/[^\r]\n/.test(outCrlf), "CRLF preserved");
  assert.match(outCrlf, /## 12\. Invariantes \(R-\*\)\r\n\r\n> puntero\r\n\r\n## 13\./);
  const last = "# C\n\n## 12. Invariantes\n\n| R-1 | x |\n";
  assert.equal(replaceSectionBody(last, /^##\s*12\./m, "> puntero"), "# C\n\n## 12. Invariantes\n\n> puntero\n");
  assert.equal(replaceSectionBody("# C\n\n## 11. Índice\n", /^##\s*12\./m, "x"), "# C\n\n## 11. Índice\n", "absent section → unchanged");
});
