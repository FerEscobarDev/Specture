#!/usr/bin/env node
// Schema manifest — the release gate for project-schema changes.
//
// Hashes every file that defines the structure of a Specture project
// (templates/project-config/**, ROADMAP_TEMPLATE, SPEC_TEMPLATE) and the
// "Required Inputs" section of every skill. If any of them changes, the
// manifest must be regenerated (`npm run schema:sync`) — which is the moment
// to decide whether a migration in migrations/ is needed. The test
// migrations/test/schema-manifest.test.js fails on drift.
//
//   node scripts/schema-manifest.js          rewrite migrations/schema-manifest.json
//   node scripts/schema-manifest.js --check  exit 1 if the manifest is stale

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "migrations", "schema-manifest.json");

function sha256(text) {
  return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function requiredInputs(text) {
  const all = text.split(/\r?\n/);
  const start = all.findIndex((l) => /^## Required Inputs/.test(l));
  if (start === -1) return null;
  let end = all.length;
  for (let i = start + 1; i < all.length; i++) {
    if (/^## /.test(all[i])) {
      end = i;
      break;
    }
  }
  return all.slice(start, end).join("\n");
}

function compute() {
  const files = {};
  const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");
  for (const abs of walk(path.join(ROOT, "templates", "project-config"))) {
    files[rel(abs)] = sha256(fs.readFileSync(abs, "utf8"));
  }
  for (const name of ["ROADMAP_TEMPLATE.md", "SPEC_TEMPLATE.md", "MIGRATION_SPEC_TEMPLATE.md", "CURRENT_CAPABILITY_TEMPLATE.md"]) {
    const abs = path.join(ROOT, "templates", name);
    if (fs.existsSync(abs)) files[rel(abs)] = sha256(fs.readFileSync(abs, "utf8"));
  }
  const skillsDir = path.join(ROOT, "skills");
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(abs)) continue;
    const section = requiredInputs(fs.readFileSync(abs, "utf8"));
    if (section !== null) files[`${rel(abs)}#required-inputs`] = sha256(section);
  }
  return { files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) };
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return null;
  }
}

function diff(current, stored) {
  const changes = [];
  const a = (stored && stored.files) || {};
  const b = current.files;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in a)) changes.push(`added:   ${key}`);
    else if (!(key in b)) changes.push(`removed: ${key}`);
    else if (a[key] !== b[key]) changes.push(`changed: ${key}`);
  }
  return changes;
}

const current = compute();
if (process.argv.includes("--check")) {
  const changes = diff(current, readManifest());
  if (changes.length > 0) {
    process.stderr.write("schema-manifest: project schema changed without regenerating migrations/schema-manifest.json:\n");
    for (const c of changes) process.stderr.write(`  ${c}\n`);
    process.stderr.write("→ decide whether a migration is needed (migrations/<version>-<slug>.js), then run `npm run schema:sync`.\n");
    process.exit(1);
  }
  process.stdout.write(`schema-manifest: OK (${Object.keys(current.files).length} schema files)\n`);
} else {
  fs.writeFileSync(MANIFEST, JSON.stringify(current, null, 2) + "\n");
  process.stdout.write(`schema-manifest: written (${Object.keys(current.files).length} schema files)\n`);
}
