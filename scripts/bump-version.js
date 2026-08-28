#!/usr/bin/env node
// Specture release tooling — keeps the plugin version consistent across every
// manifest and the README changelog.
//
//   node scripts/bump-version.js <X.Y.Z>      write <X.Y.Z> into all manifests
//   node scripts/bump-version.js --check      verify manifests agree + README has a changelog entry
//   node scripts/bump-version.js --title <X.Y.Z>   print "vX.Y.Z — <title>" from the README changelog
//   node scripts/bump-version.js --notes <X.Y.Z>   print the changelog body for <X.Y.Z> (release notes)
//
// Exit code 0 on success, 1 on any failure. No dependencies.
//
// The four manifests (the "release contract", asserted by hooks/test/release-contract.test.js):
//   plugin.json                        .version       (Copilot CLI / Antigravity CLI)
//   .claude-plugin/plugin.json         .version       (Claude Code)
//   .github/plugin/marketplace.json    .metadata.version + .plugins[0].version (Copilot marketplace)
//   copilot/compatibility-matrix.json  .claudeSource  (version of the Claude source the mirrors track)
//
// Writes are done by string replacement so each file keeps its formatting.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const README = path.join(ROOT, "README.md");
const SEMVER = /^\d+\.\d+\.\d+$/;

const MANIFESTS = [
  { file: "plugin.json", read: (j) => [j.version], pattern: /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/g },
  { file: ".claude-plugin/plugin.json", read: (j) => [j.version], pattern: /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/g },
  {
    file: ".github/plugin/marketplace.json",
    read: (j) => [j.metadata && j.metadata.version, j.plugins && j.plugins[0] && j.plugins[0].version],
    pattern: /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/g
  },
  { file: "copilot/compatibility-matrix.json", read: (j) => [j.claudeSource], pattern: /("claudeSource"\s*:\s*")(\d+\.\d+\.\d+)(")/g }
];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function fail(message) {
  process.stderr.write(`bump-version: ${message}\n`);
  process.exit(1);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns { version, mismatches } — every version value found across the manifests.
function collectVersions() {
  const found = [];
  for (const m of MANIFESTS) {
    const values = m.read(readJson(m.file));
    values.forEach((value, index) => found.push({ file: m.file, field: index, value }));
  }
  const distinct = [...new Set(found.map((f) => f.value))];
  return { found, distinct };
}

// Locates "### v<version>[ — <title>]" in the README changelog. Returns null if absent.
function findChangelogSection(version) {
  const text = fs.readFileSync(README, "utf8");
  const lines = text.split(/\r?\n/);
  const heading = new RegExp(`^### v${escapeRegExp(version)}(?:\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###? /.test(lines[i])) {
      end = i;
      break;
    }
  }
  const headingText = lines[start].replace(/^### /, "").trim();
  const body = lines.slice(start + 1, end).join("\n").trim();
  return { headingText, body };
}

function tagCommit(version) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "--quiet", `v${version}^{commit}`], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function headCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function check() {
  const { found, distinct } = collectVersions();
  const problems = [];
  if (distinct.length !== 1) {
    problems.push(
      `manifests disagree: ${found.map((f) => `${f.file}${f.field ? `#${f.field}` : ""}=${f.value}`).join(", ")}`
    );
  }
  const version = distinct[0];
  if (version && !SEMVER.test(version)) problems.push(`version "${version}" is not X.Y.Z`);
  if (version && !findChangelogSection(version)) {
    problems.push(`README.md has no "### v${version}" changelog heading`);
  }
  if (problems.length > 0) {
    problems.forEach((p) => process.stderr.write(`bump-version: ${p}\n`));
    process.exit(1);
  }
  const tagged = tagCommit(version);
  const head = headCommit();
  if (tagged && head && tagged !== head) {
    process.stderr.write(
      `bump-version: warning — tag v${version} exists at ${tagged.slice(0, 7)} but HEAD is ${head.slice(0, 7)}\n`
    );
  }
  process.stdout.write(`bump-version: OK — all manifests at ${version}, README changelog present\n`);
}

function bump(version) {
  if (!SEMVER.test(version)) fail(`"${version}" is not X.Y.Z`);
  let changed = 0;
  for (const m of MANIFESTS) {
    const file = path.join(ROOT, m.file);
    const before = fs.readFileSync(file, "utf8");
    let hits = 0;
    const after = before.replace(m.pattern, (_, open, _old, close) => {
      hits++;
      return `${open}${version}${close}`;
    });
    const expected = m.read(readJson(m.file)).length;
    if (hits !== expected) fail(`${m.file}: expected ${expected} version field(s), matched ${hits}`);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed++;
    }
  }
  process.stdout.write(`bump-version: ${changed} file(s) updated to ${version}\n`);
  if (!findChangelogSection(version)) {
    process.stdout.write(`bump-version: reminder — add "### v${version} — <title>" to README.md before releasing\n`);
  }
}

function printTitle(version) {
  const section = findChangelogSection(version);
  if (!section) fail(`README.md has no "### v${version}" changelog heading`);
  process.stdout.write(`${section.headingText}\n`);
}

function printNotes(version) {
  const section = findChangelogSection(version);
  if (!section) fail(`README.md has no "### v${version}" changelog heading`);
  process.stdout.write(`${section.body}\n`);
}

const [command, argument] = process.argv.slice(2);
if (command === "--check") check();
else if (command === "--title") printTitle(argument || fail("--title needs a version"));
else if (command === "--notes") printNotes(argument || fail("--notes needs a version"));
else if (command && SEMVER.test(command)) bump(command);
else fail("usage: bump-version.js <X.Y.Z> | --check | --title <X.Y.Z> | --notes <X.Y.Z>");
