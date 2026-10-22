// Skill size contract — what Anthropic's Agent Skills guidance and Antigravity's loader require
// of every skill file, checked mechanically so the limits are never crossed by accident.
//
//   1. A SKILL.md body (after the frontmatter) stays under 24,000 bytes: Antigravity loads only
//      the first 24,000 and drops the rest without failing; Anthropic recommends "under 500 lines"
//      for the same progressive-disclosure reason.
//   2. A frontmatter `description` has at most 1,024 characters (Agent Skills spec limit).
//   3. Every companion (reference) file over 100 lines under skills/ starts with a `## Contents`
//      table, so a reader that previews it with `head` knows what lies below. SKILL.md itself is
//      read whole on every trigger and is exempt — its size limit is the first rule.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const skillsDir = path.join(root, "skills");

const BODY_LIMIT = 24000;
const DESCRIPTION_LIMIT = 1024;
const CONTENTS_FROM_LINES = 100;

function skillDirs() {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, "SKILL.md must start with a YAML frontmatter block");
  return { frontmatter: match[1], body: text.slice(match[0].length) };
}

function descriptionOf(frontmatter) {
  const line = frontmatter.match(/^description:\s*(.*)$/m);
  assert.ok(line, "frontmatter must declare `description:`");
  let value = line[1].trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  return value.replace(/''/g, "'");
}

function markdownFilesUnderSkills() {
  const out = [];
  for (const dir of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(skillsDir, dir.name))) {
      if (file.endsWith(".md") && file !== "SKILL.md") out.push(path.join("skills", dir.name, file));
    }
  }
  return out.sort();
}

test(`every SKILL.md body stays under ${BODY_LIMIT} bytes`, () => {
  const offenders = [];
  for (const name of skillDirs()) {
    const text = fs.readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8");
    const { body } = splitFrontmatter(text);
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes >= BODY_LIMIT) offenders.push(`skills/${name}/SKILL.md: ${bytes} bytes`);
  }
  assert.deepEqual(offenders, [], `move procedures to a companion file (skills/write-skill/SKILL.md § Size limits):\n${offenders.join("\n")}`);
});

test(`every SKILL.md description has at most ${DESCRIPTION_LIMIT} characters`, () => {
  const offenders = [];
  for (const name of skillDirs()) {
    const text = fs.readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8");
    const description = descriptionOf(splitFrontmatter(text).frontmatter);
    assert.ok(description.length > 0, `skills/${name}/SKILL.md: empty description`);
    if (description.length > DESCRIPTION_LIMIT) offenders.push(`skills/${name}/SKILL.md: ${description.length} chars`);
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test(`every companion file over ${CONTENTS_FROM_LINES} lines under skills/ opens with a Contents table`, () => {
  const offenders = [];
  for (const rel of markdownFilesUnderSkills()) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const lineCount = text.split(/\r?\n/).length;
    if (lineCount <= CONTENTS_FROM_LINES) continue;
    // The table must appear before the first `## ` heading that is not the Contents heading
    // itself, i.e. right after the H1 or the frontmatter intro.
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    const firstHeading = headings.find((h) => !/^(Contents|Índice)$/i.test(h));
    const contentsAt = text.search(/^## (Contents|Índice)$/m);
    const firstAt = firstHeading ? text.indexOf(`## ${firstHeading}`) : text.length;
    if (contentsAt === -1 || contentsAt > firstAt) offenders.push(`${rel} (${lineCount} lines)`);
  }
  assert.deepEqual(offenders, [], `add a "## Contents" table at the top:\n${offenders.join("\n")}`);
});
