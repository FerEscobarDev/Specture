#!/usr/bin/env node
// Custom Rules Resolution — the orchestrator's pre-flight for `.specture/review-rules.md`
// (since v2.4.0).
//
//   node hooks/lib/review-rules-resolve.js --project <root> --spec <file.spec.md> [--json] [--cap N]
//   node hooks/lib/review-rules-resolve.js --project <root> --paths a,b,c [--json] [--cap N]
//   node hooks/lib/review-rules-resolve.js --project <root> --paths-file <list.txt> [--json] [--cap N]
//   node hooks/lib/review-rules-resolve.js --project <root> --all [--json] [--cap N]
//
// Prints the `CUSTOM_RULES:` block to paste into a dispatch: the included sections and the
// project's own `RV-n` rules whose `cuando:` globs touch the given paths (`--spec` takes the
// spec's declared surface, `Crea:` ∪ `Modifica:`; `--paths-file` reads one path per line — the
// files of a compliance-review chunk), plus every unconditional one; `--all` returns everything.
// Agents never open the file or the included files — the orchestrator injects the block.
//
// Exit 0 with `CUSTOM_RULES: []` when the file does not exist (it is opt-in: no warning), 1
// when the file has errors or the selected text exceeds the cap (fail loud: a broken rules
// file must not silently drop criteria — `/specture:doctor check` names the line), 2 on usage
// errors.

const fs = require("fs");
const path = require("path");
const { findProjectRoot } = require("./specture-guard");
const { parseSpec } = require("./planning");
const { resolveReviewRules, formatBlock, REVIEW_RULES_FILE, DEFAULT_CAP } = require("./review-rules");

function usage(message) {
  if (message) process.stderr.write(`review-rules-resolve: ${message}\n`);
  process.stderr.write("usage: node hooks/lib/review-rules-resolve.js --project <root> (--spec <file> | --paths a,b | --paths-file <file> | --all) [--json] [--cap N]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { project: null, spec: null, paths: null, pathsFile: null, all: false, json: false, cap: DEFAULT_CAP };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--spec") args.spec = argv[++i];
    else if (a === "--paths") args.paths = String(argv[++i] || "").split(",").map((p) => p.trim()).filter(Boolean);
    else if (a === "--paths-file") args.pathsFile = argv[++i];
    else if (a === "--all") args.all = true;
    else if (a === "--json") args.json = true;
    else if (a === "--cap") {
      args.cap = Number(argv[++i]);
      if (!Number.isInteger(args.cap) || args.cap <= 0) usage("--cap needs a positive integer");
    } else usage(`unknown argument ${a}`);
  }
  const modes = [args.spec, args.paths, args.pathsFile, args.all || null].filter((m) => m !== null);
  if (modes.length !== 1) usage("pass exactly one of --spec, --paths, --paths-file or --all");
  return args;
}

function targetPaths(args, root) {
  if (args.paths) return args.paths;
  if (args.pathsFile) {
    let text;
    try {
      text = fs.readFileSync(path.resolve(args.pathsFile), "utf8");
    } catch {
      usage(`cannot read --paths-file ${args.pathsFile}`);
    }
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  if (args.spec) {
    const file = path.resolve(root, args.spec);
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      usage(`cannot read --spec ${args.spec}`);
    }
    const spec = parseSpec(text, path.basename(file).replace(/\.spec\.md$/, ""));
    return [...spec.createdPaths, ...spec.modifiedPaths];
  }
  return [];
}

function main(argv) {
  const args = parseArgs(argv);
  const start = path.resolve(args.project || ".");
  const root = findProjectRoot(start);
  if (!root) usage(`not a Specture project (no .specture/stack.yml found from ${start})`);

  const paths = targetPaths(args, root);
  const result = resolveReviewRules(root, { paths, all: args.all, cap: args.cap });
  const file = REVIEW_RULES_FILE.split(path.sep).join("/");
  if (!result.exists) {
    process.stdout.write((args.json ? JSON.stringify({ file: null, paths, all: args.all, block: null }) : "CUSTOM_RULES: []") + "\n");
    return 0;
  }
  if (result.error) {
    process.stderr.write(`review-rules-resolve: ${result.error}\n`);
    for (const p of result.problems.filter((x) => x.severity === "ERROR")) {
      process.stderr.write(`  - ${p.check}${p.line ? ` (línea ${p.line})` : ""}: ${p.detail}\n`);
    }
    process.stderr.write("  → corregí el archivo; /specture:doctor check lista lo mismo\n");
    return 1;
  }
  for (const p of result.problems.filter((x) => x.severity === "WARNING")) {
    process.stderr.write(`⚠ ${file}: ${p.check} — ${p.detail}\n`);
  }
  if (args.json) {
    process.stdout.write(JSON.stringify({ file, paths, all: args.all, block: result.block }) + "\n");
  } else {
    process.stdout.write(formatBlock(result.block) + "\n");
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { main };
