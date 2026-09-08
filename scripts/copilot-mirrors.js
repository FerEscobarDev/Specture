#!/usr/bin/env node
// Copilot mirrors — generates copilot/agents/<name>.agent.md from agents/<name>/AGENT.md.
//
// The Copilot custom-agent format (`.agent.md`: YAML frontmatter + a Markdown prompt of at
// most 30,000 characters) admits the full body of every Claude agent, so the mirrors are
// generated, never hand-written (framework roadmap item 40 / gap C-9b). The frontmatter keeps
// `name`, takes `description` from the source, `tools` from
// copilot/compatibility-matrix.json → platformAdaptations.agentTools and pins
// `disable-model-invocation: true`; `model` is dropped (Copilot model names differ).
//
//   node scripts/copilot-mirrors.js            rewrite every mirror
//   node scripts/copilot-mirrors.js --check    exit 1 if any mirror is stale, missing or orphan
//   node scripts/copilot-mirrors.js --root D   operate on another checkout (tests)
//
// Exit codes: 0 = ok · 1 = drift (--check only) · 2 = refused (agent without a tools entry,
// body over the Copilot cap, malformed frontmatter). A body over the cap is never truncated:
// shorten the source AGENT.md instead.

const fs = require("fs");
const path = require("path");

const BODY_CAP = 30000;
const FRONTMATTER_KEYS = ["name", "description", "tools", "disable-model-invocation"];
const SUBSTITUTIONS = [
  ["${CLAUDE_PLUGIN_ROOT}", "${PLUGIN_ROOT}"],
  ["`AskUserQuestion`", "a closed question in chat (2-4 options, one recommended)"],
  ["AskUserQuestion", "a closed question in chat (2-4 options, one recommended)"],
  ["`EnterPlanMode`", "a closed proposal in chat (Copilot plan workflow)"],
  ["EnterPlanMode", "a closed proposal in chat (Copilot plan workflow)"],
  ["`ExitPlanMode`", "explicit user approval of that proposal"],
  ["ExitPlanMode", "explicit user approval of that proposal"]
];

function notice(name) {
  return `> Generated from \`agents/${name}/AGENT.md\` by \`scripts/copilot-mirrors.js\` — edit the source, never this file.`;
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

function parseAgent(text, name) {
  const lines = normalize(text).split("\n");
  if (lines[0] !== "---") throw new Error(`${name}: AGENT.md must start with a frontmatter block`);
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new Error(`${name}: unterminated frontmatter in AGENT.md`);
  const meta = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (match) meta[match[1]] = unquote(match[2]);
  }
  if (!meta.name) throw new Error(`${name}: AGENT.md frontmatter has no name`);
  if (meta.name !== name) throw new Error(`${name}: frontmatter name is "${meta.name}"`);
  if (!meta.description) throw new Error(`${name}: AGENT.md frontmatter has no description`);
  const body = lines.slice(end + 1).join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
  return { meta, body };
}

function unquote(value) {
  const v = value.trim();
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (/^".*"$/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
}

function substitute(body) {
  let out = body;
  for (const [from, to] of SUBSTITUTIONS) out = out.split(from).join(to);
  return out;
}

function render(name, agent, tools) {
  const body = substitute(agent.body);
  if (body.length > BODY_CAP) {
    throw new Error(`${name}: mirror body is ${body.length} characters, over the Copilot cap of ${BODY_CAP} (${body.length - BODY_CAP} over) — shorten agents/${name}/AGENT.md, the generator never truncates`);
  }
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(agent.meta.description)}`,
    `tools: ${JSON.stringify(tools)}`,
    "disable-model-invocation: true",
    "---",
    "",
    notice(name),
    "",
    body,
    ""
  ].join("\n");
}

function agentNames(root) {
  const dir = path.join(root, "agents");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "AGENT.md")))
    .map((e) => e.name)
    .sort();
}

function mirrorNames(root) {
  const dir = path.join(root, "copilot", "agents");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".agent.md"))
    .map((f) => f.replace(/\.agent\.md$/, ""))
    .sort();
}

function toolsMap(root) {
  const file = path.join(root, "copilot", "compatibility-matrix.json");
  const matrix = JSON.parse(fs.readFileSync(file, "utf8"));
  const map = matrix.platformAdaptations && matrix.platformAdaptations.agentTools;
  if (!map || typeof map !== "object") {
    throw new Error("copilot/compatibility-matrix.json has no platformAdaptations.agentTools map");
  }
  return map;
}

function generate(root) {
  const tools = toolsMap(root);
  const out = [];
  for (const name of agentNames(root)) {
    if (!Array.isArray(tools[name])) {
      throw new Error(`${name}: no tools entry in copilot/compatibility-matrix.json → platformAdaptations.agentTools`);
    }
    const agent = parseAgent(fs.readFileSync(path.join(root, "agents", name, "AGENT.md"), "utf8"), name);
    out.push({ name, file: path.join(root, "copilot", "agents", `${name}.agent.md`), text: render(name, agent, tools[name]) });
  }
  return out;
}

function main(argv) {
  const check = argv.includes("--check");
  const rootIndex = argv.indexOf("--root");
  const root = rootIndex === -1 ? path.resolve(__dirname, "..") : path.resolve(argv[rootIndex + 1] || ".");
  let mirrors;
  try {
    mirrors = generate(root);
  } catch (error) {
    process.stderr.write(`copilot-mirrors: ${error.message}\n`);
    return 2;
  }
  const expected = new Set(mirrors.map((m) => m.name));
  const orphans = mirrorNames(root).filter((name) => !expected.has(name));

  if (check) {
    const drift = [];
    for (const m of mirrors) {
      if (!fs.existsSync(m.file)) drift.push(`missing: copilot/agents/${m.name}.agent.md`);
      else if (normalize(fs.readFileSync(m.file, "utf8")) !== m.text) drift.push(`stale:   copilot/agents/${m.name}.agent.md`);
    }
    for (const name of orphans) drift.push(`orphan:  copilot/agents/${name}.agent.md (no agents/${name}/AGENT.md)`);
    if (drift.length > 0) {
      process.stderr.write("copilot-mirrors: the Copilot mirrors do not match agents/*/AGENT.md:\n");
      for (const line of drift) process.stderr.write(`  ${line}\n`);
      process.stderr.write("→ run `npm run mirrors:sync` (and delete orphans by hand); never edit a mirror directly.\n");
      return 1;
    }
    process.stdout.write(`copilot-mirrors: OK (${mirrors.length} mirrors in sync)\n`);
    return 0;
  }

  fs.mkdirSync(path.join(root, "copilot", "agents"), { recursive: true });
  let written = 0;
  for (const m of mirrors) {
    const current = fs.existsSync(m.file) ? normalize(fs.readFileSync(m.file, "utf8")) : null;
    if (current !== m.text) {
      fs.writeFileSync(m.file, m.text);
      written += 1;
    }
  }
  process.stdout.write(`copilot-mirrors: written (${written} of ${mirrors.length} mirrors changed)\n`);
  for (const name of orphans) process.stdout.write(`copilot-mirrors: orphan copilot/agents/${name}.agent.md has no agents/${name}/AGENT.md — delete it by hand\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { BODY_CAP, FRONTMATTER_KEYS, SUBSTITUTIONS, generate, notice, parseAgent, render, substitute };
