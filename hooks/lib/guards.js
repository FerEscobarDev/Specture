#!/usr/bin/env node
// Guards — promote the `GUARD-n` lines of an epic's specs into `.specture/rules.yml` before the
// specs are deleted (milestone close, v3.0.0).
//
//   node hooks/lib/guards.js promote --epic <dir> [--project <root>] [--dry-run] [--json]
//
// A spec's "Guards de no-regresión" names tests that protect behaviour the epic must not break
// (`- **GUARD-1:** <behaviour> → test: `<path>::<name>``). `honesty-check protected` builds its
// PROTECTED list from those lines AND from the `verify:` tokens of rules.yml, so once the spec is
// gone the protection survives only if the token moved to a rule. This writes one `R-G-<n>` rule
// per guard (IMPORTANT, tagged with the spec's module), idempotent: a token already present in
// any rule's `verify:` is skipped. Exit 0 = ok, 2 = usage.

const fs = require("fs");
const path = require("path");
const { findProjectRoot } = require("./specture-guard");
const { readRules, serializeRulesList, moduleTag, RULES_FILE } = require("./rules");
const { specModule } = require("./components");

const GUARD = /^\s*-\s*\*\*(GUARD-\d+)\s*:?\s*\*\*\s*(.*?)\s*→\s*test\s*:\s*`?([^`\s:]+)::([^`]+?)`?\s*$/;
const RULE_MAX = 240;

function posix(p) {
  return p.split(path.sep).join("/");
}

// [{ id, text, path, test }] — the guards a spec declares.
function parseGuardLines(specText) {
  const out = [];
  for (const line of String(specText).split(/\r?\n/)) {
    const m = line.match(GUARD);
    if (m) out.push({ id: m[1], text: m[2].replace(/\s+/g, " ").trim(), path: posix(m[3]), test: m[4].replace(/\s+/g, " ").trim() });
  }
  return out;
}

function nextGuardRuleId(rules) {
  let max = 0;
  for (const r of rules) {
    const m = String(r.id || "").match(/^R-G-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `R-G-${max + 1}`;
}

function alreadyProtected(rules, guard) {
  const token = `${guard.path}::${guard.test}`;
  return rules.some((r) => String(r.verify || "").includes(token));
}

// Appends serialized rules to the file text (keeps the file's EOL; handles `rules: []`).
function appendRules(text, newRules) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const items = serializeRulesList(newRules).split("\n").slice(1).filter((l) => l.length > 0); // drop the "rules:" line
  let body = text;
  if (/^rules:\s*\[\s*\]\s*$/m.test(body)) body = body.replace(/^rules:\s*\[\s*\]\s*$/m, "rules:");
  else if (!/^rules:\s*$/m.test(body)) body = body.replace(/\s*$/, "") + eol + "rules:";
  body = body.replace(/\s*$/, "") + eol + items.join(eol) + eol;
  return body;
}

// { added: [{ id, guard, spec }], skipped: [{ guard, spec, reason }], file } — writes rules.yml
// unless dryRun. `epicDir` is absolute.
function promoteGuards(root, epicDir, { dryRun = false } = {}) {
  const rel = posix(path.relative(root, epicDir));
  const specs = fs.existsSync(epicDir) ? fs.readdirSync(epicDir).filter((n) => n.endsWith(".spec.md")).sort() : [];
  const rules = readRules(root);
  if (rules.exists && rules.error) throw new Error(`${posix(RULES_FILE)} no parsea: ${rules.error.message}`);
  const existing = rules.parsed ? [...rules.parsed.rules] : [];
  const added = [];
  const skipped = [];
  const toWrite = [];
  for (const name of specs) {
    const text = fs.readFileSync(path.join(epicDir, name), "utf8");
    const slug = name.replace(/\.spec\.md$/, "");
    const tag = moduleTag(specModule(text)) || "all";
    for (const guard of parseGuardLines(text)) {
      const spec = `${rel}/${name}`;
      if (alreadyProtected([...existing, ...toWrite], guard)) {
        skipped.push({ guard: guard.id, spec, reason: `ya protegido: \`${guard.path}::${guard.test}\`` });
        continue;
      }
      const id = nextGuardRuleId([...existing, ...toWrite]);
      const prefix = `Guard heredado de ${rel}/${slug} ${guard.id}: `;
      const rule = {
        id,
        tags: [tag],
        rule: (prefix + guard.text).slice(0, RULE_MAX),
        verify: `\`${guard.path}::${guard.test}\``,
        severity: "IMPORTANT",
        source: `${spec} ${guard.id} — promovido al cerrar el milestone`
      };
      toWrite.push(rule);
      added.push({ id, guard: guard.id, spec, test: `${guard.path}::${guard.test}` });
    }
  }
  const file = path.join(root, RULES_FILE);
  if (!dryRun && toWrite.length > 0) {
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "schema: 1\nrules: []\n";
    fs.writeFileSync(file, appendRules(text, toWrite));
  }
  return { added, skipped, file: posix(RULES_FILE), specs: specs.length };
}

function usage(message) {
  if (message) process.stderr.write(`guards: ${message}\n`);
  process.stderr.write("usage: node hooks/lib/guards.js promote --epic <dir> [--project <root>] [--dry-run] [--json]\n");
  return 2;
}

function main(argv) {
  const args = { mode: null, epic: null, project: null, dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--epic") args.epic = argv[++i];
    else if (a === "--project") args.project = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--json") args.json = true;
    else if (a.startsWith("--")) return usage(`unknown option ${a}`);
    else if (!args.mode) args.mode = a;
    else return usage(`unexpected argument ${a}`);
  }
  if (args.mode !== "promote") return usage("mode must be promote");
  if (!args.epic) return usage("promote needs --epic <dir>");
  const root = findProjectRoot(path.resolve(args.project || "."));
  if (!root) return usage("not a Specture project (no .specture/stack.yml)");
  const epicDir = path.resolve(root, args.epic);
  let result;
  try {
    result = promoteGuards(root, epicDir, { dryRun: args.dryRun });
  } catch (error) {
    process.stderr.write(`guards: ${error.message}\n`);
    return 2;
  }
  if (args.json) {
    process.stdout.write(JSON.stringify({ dryRun: args.dryRun, ...result }) + "\n");
    return 0;
  }
  process.stdout.write(`GUARDS promote: ${result.added.length} promovido(s), ${result.skipped.length} ya protegido(s) (${result.specs} spec(s) en ${posix(path.relative(root, epicDir))})${args.dryRun ? " — dry-run, nada escrito" : ""}\n`);
  for (const a of result.added) process.stdout.write(`- ${a.id} ← ${a.spec} ${a.guard} (${a.test})\n`);
  for (const s of result.skipped) process.stdout.write(`- nota: ${s.spec} ${s.guard} — ${s.reason}\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { parseGuardLines, promoteGuards, appendRules };
