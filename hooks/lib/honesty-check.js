#!/usr/bin/env node
// honesty-check — mechanical TDD-honesty safeguards of the light supersession loop (F1-10).
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/honesty-check.js" <command> [options] [--project <root>] [--json]
//
// The loop lets a test-writer rewrite SEALED tests of closed epics without a full re-RED. These
// checks are what keeps that honest (docs/spec-gate-convergence-design.md, F1-10 salvaguardas):
//   clean-tree    [--test-globs a,b]                        (5) nothing uncommitted/untracked under the
//                 test globs (flag, else the seal's test_globs) — no edit can be "laundered" into a
//                 registered commit.
//   range         --slug <s> --epic-dir <d> [--head <rev>]  (4) every commit in RED_ORIG..HEAD that
//                 touches a test (test_globs ∪ specs[].test_paths) is a SHA of the `## SUPERSESIONES`
//                 register of <d>/_planning.md, touching only the paths registered with it — or the
//                 first RED of a sibling spec touching no other spec's sealed tests; and
//                 `supersede_paths` is empty. RED_ORIG = specs[s].red_sha_orig ‖ red_sha.
//   red-lines     [--slug <s>]                              (3) every non-blank line the RED_ORIG commit
//                 added to the spec's test_paths survives in HEAD (multiset); a deleted file fails.
//   spec-delta    --epic-dir <d> --base <SPEC_SHA> --slug <s>  (6) against `git show <base>:…`, the tree
//                 changed only the `## Supersesiones` section of <s>.spec.md; every other spec is
//                 identical; `_planning.md` changed only its `- sup:` rows and the coordinator
//                 registers (SUPERSESIONES, VEREDICTOS, MECH_CHECK, SPEC_SHA, GATE_NOTES, DIFERIDOS,
//                 BASELINE_FALLOS). CRLF and trailing blank lines never count.
//   protected     --epic-dir <d> [--slug <s>]               (7) no `Supersede:` of <d> (or of <s>) names a
//                 PROTECTED test: a `<path>::<test>` token in the `verify:` of a rule of
//                 .specture/rules.yml, or a GUARD (`→ test: <path>::<name>`) of a spec of ANOTHER epic
//                 under docs/05-specs/. A `verify:` in prose, without `::`, protects nothing.
//   base-worktree --lock <sha> [--files a,b] --dir <tmp> | --remove <dir>
//                 (2) `git worktree add --detach <dir> <sha>` plus a copy of the listed files from the
//                 current tree — the base where rewritten tests must FAIL (retroactive RED).
//
// stdout: first line is the token — `HONESTY <cmd>: PASS <detalle>` | `HONESTY <cmd>: FAIL <n>` |
// `HONESTY <cmd>: UNVERIFIABLE <motivo>` (base-worktree: `READY <dir>` | `REMOVED <dir>`); then one
// `- <hallazgo>` per finding. Exit 0 = PASS/READY/REMOVED, 1 = FAIL, 2 = UNVERIFIABLE or usage.
// FAIL only on universal facts (git history, files, the seal). What the check cannot establish —
// no git, no seal when it is needed, a missing input — is UNVERIFIABLE, never a silent PASS.
// `--json` prints the result object (with its `token`) instead. `--project` defaults to cwd.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { STATE_FILE, readSeal, pathMatchesAnyGlob } = require("./seal");
const { parseSupersessionRegister, parseGuards, parseSpec } = require("./planning");
const { readRules } = require("./rules");

const COMMAND_FLAGS = {
  "clean-tree": ["test-globs"],
  range: ["slug", "epic-dir", "head"],
  "red-lines": ["slug"],
  "spec-delta": ["epic-dir", "base", "slug"],
  protected: ["epic-dir", "slug"],
  "base-worktree": ["lock", "files", "dir", "remove"]
};
const LIST_FLAGS = ["test-globs", "files"];
const SPECS_DIR = path.join("docs", "05-specs");
const SUPERSESSION_SECTION = /^##\s+(?:\d+\.\s*)?Supersesiones/i;
const PLANNING_IGNORED = "SUPERSESIONES|VEREDICTOS|MECH_CHECK|SPEC_SHA|GATE_NOTES|DIFERIDOS|BASELINE_FALLOS";
const PLANNING_LABELS = /^\s*(COVERAGE_TABLE|OPEN_QUESTIONS|RESOLVED_ALONE|SUPERSESIONES|CODE_SURFACE|MECH_CHECK|VEREDICTOS|SPEC_SHA|CHANGELOG|CONCERNS|GATE_NOTES|DIFERIDOS|BASELINE_FALLOS)\s*:/;
const SHA = /^[0-9a-f]{7,40}$/i;

class UsageError extends Error {}

function usage() {
  return [
    "usage: honesty-check.js <command> [options] [--project <root>] [--json]",
    "  clean-tree    [--test-globs a,b]",
    "  range         --slug <task-slug> --epic-dir <dir> [--head <rev>]",
    "  red-lines     [--slug <task-slug>]",
    "  spec-delta    --epic-dir <dir> --base <SPEC_SHA> --slug <task-slug>",
    "  protected     --epic-dir <dir> [--slug <task-slug>]",
    "  base-worktree --lock <sha> [--files a,b] --dir <tmp> | --remove <dir>"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = { command: argv[0], flags: {}, lists: {}, json: false, project: null };
  const known = COMMAND_FLAGS[opts.command];
  if (!known) throw new UsageError(`unknown command ${opts.command || "(none)"}`);
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new UsageError(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === "json") {
      opts.json = true;
      continue;
    }
    if (key !== "project" && !known.includes(key)) throw new UsageError(`unknown option --${key} for ${opts.command}`);
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`missing value for --${key}`);
    if (key === "project") opts.project = value;
    else if (LIST_FLAGS.includes(key)) opts.lists[key] = (opts.lists[key] || []).concat(splitList(value));
    else opts.flags[key] = value;
  }
  return opts;
}

function splitList(value) {
  return String(value)
    .split(/\s*,\s*|\n/)
    .map((v) => posix(v.trim()))
    .filter(Boolean);
}

function requireFlags(opts, ...keys) {
  for (const key of keys) {
    if (!(key in opts.flags)) throw new UsageError(`--${key} is required for ${opts.command}`);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for the tests)
// ---------------------------------------------------------------------------

function posix(p) {
  return String(p).replace(/\\/g, "/").replace(/^\.\//, "");
}

function firstLine(text) {
  return String(text || "").split(/\r?\n/).find((l) => l.trim()) || "";
}

function short(sha) {
  return String(sha).slice(0, 7);
}

// A path as git prints it (relative to the repo toplevel) → project-relative, or null when it
// lives outside the project (the project may be a subdirectory of the repo).
function toProject(gitPath, prefix) {
  const p = posix(gitPath);
  if (!prefix) return p;
  return p.startsWith(prefix) ? p.slice(prefix.length) : null;
}

// `git status --porcelain=v1 -z` → [{ xy, path }] (both sides of a rename/copy).
function parseStatusZ(out) {
  const parts = String(out).split("\0");
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.length < 4) continue;
    const xy = part.slice(0, 2);
    entries.push({ xy, path: part.slice(3) });
    if (/[RC]/.test(xy[0]) && parts[i + 1]) entries.push({ xy, path: parts[++i] });
  }
  return entries;
}

// `git log -m --name-only --format=%x01%H` → [{ sha, files }] (a merge's files, unioned per sha).
function parseLogNameOnly(out) {
  const commits = new Map();
  let current = null;
  for (const raw of String(out).split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("\x01")) {
      const sha = line.slice(1).trim();
      current = commits.get(sha) || { sha, files: [] };
      commits.set(sha, current);
    } else if (line.trim() && current && !current.files.includes(line)) {
      current.files.push(line);
    }
  }
  return [...commits.values()];
}

// `git show -U0 <sha>` → Map<git path, added lines[]> (CR stripped; `+++` headers skipped).
function addedLinesByFile(diff) {
  const out = new Map();
  let file = null;
  let inHunk = false;
  for (const raw of String(diff).split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("diff --git ")) {
      file = null;
      inHunk = false;
    } else if (!inHunk) {
      if (line.startsWith("+++ ")) {
        const target = line.slice(4).replace(/\t$/, "").replace(/^"(.*)"$/, "$1");
        file = target === "/dev/null" ? null : target.replace(/^b\//, "");
      } else if (line.startsWith("@@")) {
        inHunk = true;
      }
    } else if (line.startsWith("+") && file) {
      if (!out.has(file)) out.set(file, []);
      out.get(file).push(line.slice(1));
    }
  }
  return out;
}

function countLines(list) {
  const counts = new Map();
  for (const line of list) counts.set(line, (counts.get(line) || 0) + 1);
  return counts;
}

// Lines of `added` (blank ones ignored) that `headText` holds fewer times than the RED added them.
function missingLines(added, headText) {
  const have = countLines(String(headText).split(/\r?\n/));
  const need = countLines(added.filter((l) => l.trim() !== ""));
  const out = [];
  for (const [line, n] of need) {
    const got = have.get(line) || 0;
    if (got < n) out.push({ line, need: n, have: got });
  }
  return out;
}

// Text → [{ n, text }] with CRLF normalized and trailing blank lines dropped.
function numbered(text) {
  const rows = String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((t, i) => ({ n: i + 1, text: t }));
  while (rows.length > 0 && rows[rows.length - 1].text.trim() === "") rows.pop();
  return rows;
}

// Drops every section whose first line matches `isStart`, up to the first line matching `isEnd`.
function dropSections(rows, isStart, isEnd) {
  const out = [];
  let skipping = false;
  for (const row of rows) {
    if (skipping && isEnd(row.text)) skipping = false;
    if (!skipping && isStart(row.text)) {
      skipping = true;
      continue;
    }
    if (!skipping) out.push(row);
  }
  return out;
}

const endsAtH2 = (text) => /^#{1,2}\s/.test(text);

// What spec-delta compares for the superseding spec: everything but its Supersesiones section.
function slugSpecView(text) {
  return dropSections(numbered(text), (t) => SUPERSESSION_SECTION.test(t), endsAtH2);
}

// What spec-delta compares for `_planning.md`: everything but the `- sup:` rows and the
// coordinator registers (heading `## NAME …` or v1.17.0 label `NAME:`).
function planningView(text) {
  const heading = new RegExp(`^##\\s+(?:${PLANNING_IGNORED})\\b`);
  const label = new RegExp(`^\\s*(?:${PLANNING_IGNORED})\\s*:`);
  const rows = dropSections(numbered(text), (t) => heading.test(t) || label.test(t), (t) => endsAtH2(t) || PLANNING_LABELS.test(t));
  return rows.filter((row) => !/^\s*-\s*sup\s*:/.test(row.text));
}

// First differing row of two views → { line (tree side), base, tree } or null.
function firstDifference(baseRows, treeRows) {
  const total = Math.max(baseRows.length, treeRows.length);
  for (let i = 0; i < total; i++) {
    const b = baseRows[i];
    const t = treeRows[i];
    if (b && t && b.text === t.text) continue;
    const line = t ? t.n : treeRows.length > 0 ? treeRows[treeRows.length - 1].n + 1 : 1;
    return { line, base: b ? b.text : "(fin del archivo)", tree: t ? t.text : "(fin del archivo)" };
  }
  return null;
}

// `<path>::<test>` tokens of a rule's `verify:` (string or inline list). Backticked spans win;
// otherwise each `<path>::` starts a token that runs to the next one. A `<path>` must look like
// a path (a `/` or an extension), so `Clase::Metodo` inside a test name never starts a token.
function verifyTokens(verify) {
  const values = Array.isArray(verify) ? verify : [verify];
  const out = [];
  for (const value of values) {
    if (typeof value !== "string" || !value.includes("::")) continue;
    const ticked = [...value.matchAll(/`([^`]*::[^`]*)`/g)].map((m) => m[1]);
    for (const chunk of ticked.length > 0 ? ticked : [value]) out.push(...bareTokens(chunk));
  }
  return out;
}

function bareTokens(text) {
  const hits = [...text.matchAll(/([^\s`;,:]*(?:\/|\.[A-Za-z0-9]+)[^\s`;,:]*)::/g)];
  return hits
    .map((m, i) => {
      const start = m.index + m[0].length;
      const last = i + 1 >= hits.length;
      let test = text.slice(start, last ? text.length : hits[i + 1].index);
      test = last ? test.replace(/[\s;,]+$/, "") : test.replace(/[\s;,]*(?:\b(?:y|e|o|and|or)\b)?[\s;,]*$/i, "");
      return { path: posix(m[1]), test: test.replace(/\s+/g, " ").trim() };
    })
    .filter((t) => t.test.length > 0);
}

function normalizeTest(name) {
  return String(name || "").replace(/`/g, "").replace(/\s+/g, " ").trim();
}

// Same test: equal names, or one is the other's last segment after a `>` or `::` separator
// (`Suite > nombre` ≡ `nombre`).
function sameTest(a, b) {
  const x = normalizeTest(a);
  const y = normalizeTest(b);
  if (x === y) return true;
  const [long, tail] = x.length > y.length ? [x, y] : [y, x];
  return tail.length > 0 && long.endsWith(tail) && /(?:>|::)\s*$/.test(long.slice(0, long.length - tail.length));
}

function samePath(a, b) {
  return posix(a) === posix(b);
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

function git(root, args) {
  const result = spawnSync("git", ["-c", "core.quotePath=false", ...args], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) return { ok: false, stdout: "", stderr: result.error.message };
  return { ok: result.status === 0, stdout: result.stdout || "", stderr: (result.stderr || "").trim() };
}

// { prefix } of the project inside its repo ("" at the toplevel), or { error }.
function repoContext(root) {
  if (!fs.existsSync(root)) return { error: `no existe el proyecto ${root}` };
  const r = git(root, ["rev-parse", "--show-prefix"]);
  if (!r.ok) return { error: `sin git en ${root}: ${firstLine(r.stderr) || "no es un repositorio"}` };
  return { prefix: posix(r.stdout.trim()) };
}

function resolveCommit(root, rev) {
  const r = git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  return r.ok ? r.stdout.trim() : null;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function unverifiable(command, reason, extra = {}) {
  return { command, status: "UNVERIFIABLE", reason, detail: null, findings: [], notes: [], ...extra };
}

function verdict(command, findings, detail, extra = {}) {
  return { command, status: findings.length > 0 ? "FAIL" : "PASS", reason: null, detail, findings, notes: [], ...extra };
}

function loadSeal(command, root) {
  const seal = readSeal(root);
  if (!seal) return { error: unverifiable(command, `sin sello (${posix(STATE_FILE)})`) };
  if (seal.corrupt) return { error: unverifiable(command, `sello corrupto (${posix(STATE_FILE)})`) };
  return { seal };
}

function epicDirOf(root, dir) {
  const abs = path.resolve(root, dir);
  return { abs, rel: posix(path.relative(root, abs)) };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cleanTree(opts, root) {
  const cmd = "clean-tree";
  let globs = opts.lists["test-globs"] || null;
  if (!globs) {
    const loaded = loadSeal(cmd, root);
    if (loaded.error) return unverifiable(cmd, `${loaded.error.reason} — pasa --test-globs`);
    globs = loaded.seal.test_globs;
    if (globs.length === 0) return unverifiable(cmd, "el sello no declara test_globs — pasa --test-globs");
  }
  const ctx = repoContext(root);
  if (ctx.error) return unverifiable(cmd, ctx.error);
  const r = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."]);
  if (!r.ok) return unverifiable(cmd, `git status falló: ${firstLine(r.stderr)}`);
  const findings = [];
  for (const entry of parseStatusZ(r.stdout)) {
    const rel = toProject(entry.path, ctx.prefix);
    if (rel !== null && pathMatchesAnyGlob(rel, globs)) findings.push(`${entry.xy.trim()} ${rel}`);
  }
  return verdict(cmd, findings, `árbol de tests limpio (${globs.length} globs)`, { globs });
}

function range(opts, root) {
  const cmd = "range";
  requireFlags(opts, "slug", "epic-dir");
  const ctx = repoContext(root);
  if (ctx.error) return unverifiable(cmd, ctx.error);
  const loaded = loadSeal(cmd, root);
  if (loaded.error) return loaded.error;
  const { seal } = loaded;
  const slug = opts.flags.slug;
  const spec = seal.specs.find((s) => s.slug === slug);
  if (!spec) return unverifiable(cmd, `el sello no tiene specs[${slug}]`);
  const redOrig = spec.red_sha_orig || spec.red_sha;
  if (!redOrig) return unverifiable(cmd, `specs[${slug}] sin red_sha_orig ni red_sha`);
  const from = resolveCommit(root, redOrig);
  if (!from) return unverifiable(cmd, `commit desconocido: RED_ORIG ${redOrig}`);
  const headRev = opts.flags.head || "HEAD";
  const to = resolveCommit(root, headRev);
  if (!to) return unverifiable(cmd, `commit desconocido: ${headRev}`);
  if (seal.test_globs.length === 0) return unverifiable(cmd, "el sello no declara test_globs");
  const dir = epicDirOf(root, opts.flags["epic-dir"]);
  const planningFile = path.join(dir.abs, "_planning.md");
  if (!fs.existsSync(planningFile)) return unverifiable(cmd, `no existe ${dir.rel}/_planning.md`);
  const register = parseSupersessionRegister(fs.readFileSync(planningFile, "utf8")).filter((e) => e.commit && SHA.test(e.commit));

  const log = git(root, ["log", "-m", "--no-renames", "--name-only", "--format=%x01%H", `${from}..${to}`]);
  if (!log.ok) return unverifiable(cmd, `git log falló: ${firstLine(log.stderr)}`);
  const testGlobs = [...new Set([...seal.test_globs, ...seal.specs.flatMap((s) => s.test_paths)])];
  const commits = parseLogNameOnly(log.stdout)
    .map((c) => ({ sha: c.sha, tests: c.files.map((f) => toProject(f, ctx.prefix)).filter((f) => f !== null && pathMatchesAnyGlob(f, testGlobs)) }))
    .filter((c) => c.tests.length > 0)
    .reverse();

  const findings = [];
  if (seal.supersede_paths.length > 0) {
    findings.push(`supersede_paths no está vacío (${seal.supersede_paths.join(", ")}) — cierra el despacho con \`seal-cli supersede --clear\``);
  }
  const firstRedOf = (s) => {
    const sha = s.red_sha_orig || s.red_sha;
    return sha && SHA.test(sha) ? sha.toLowerCase() : null;
  };
  let registered = 0;
  let reds = 0;
  for (const c of commits) {
    const entries = register.filter((e) => c.sha.startsWith(e.commit.toLowerCase()));
    if (entries.length > 0) {
      const allowed = entries.map((e) => e.path);
      const extra = c.tests.filter((f) => !allowed.some((a) => samePath(a, f)));
      if (extra.length > 0) findings.push(`commit ${short(c.sha)} registrado para ${[...new Set(allowed)].join(", ")} también toca ${extra.join(", ")}`);
      else registered++;
      continue;
    }
    const owner = seal.specs.find((s) => firstRedOf(s) && c.sha.startsWith(firstRedOf(s)));
    if (owner) {
      const foreign = c.tests.filter((f) => !pathMatchesAnyGlob(f, owner.test_paths) && seal.specs.some((o) => o !== owner && pathMatchesAnyGlob(f, o.test_paths)));
      if (foreign.length > 0) {
        const victims = [...new Set(foreign.flatMap((f) => seal.specs.filter((o) => o !== owner && pathMatchesAnyGlob(f, o.test_paths)).map((o) => o.slug)))];
        findings.push(`commit ${short(c.sha)} (RED de ${owner.slug}) toca tests sellados de specs[${victims.join(", ")}]: ${foreign.join(", ")}`);
      } else {
        reds++;
      }
      continue;
    }
    findings.push(`commit ${short(c.sha)} toca tests sin registro en SUPERSESIONES de ${dir.rel}/_planning.md: ${c.tests.join(", ")}`);
  }
  const detail = `${registered} registrados${reds > 0 ? `, ${reds} RED de specs hermanos` : ""} (${short(from)}..${short(to)})`;
  return verdict(cmd, findings, detail, { from, to, commits: commits.length });
}

function redLines(opts, root) {
  const cmd = "red-lines";
  const ctx = repoContext(root);
  if (ctx.error) return unverifiable(cmd, ctx.error);
  const loaded = loadSeal(cmd, root);
  if (loaded.error) return loaded.error;
  const { seal } = loaded;
  const slug = opts.flags.slug || null;
  const specs = slug ? seal.specs.filter((s) => s.slug === slug) : seal.specs;
  if (specs.length === 0) return unverifiable(cmd, slug ? `el sello no tiene specs[${slug}]` : "el sello no tiene specs[]");

  const findings = [];
  const notes = [];
  let lines = 0;
  let files = 0;
  for (const spec of specs) {
    const label = spec.slug || "(legado)";
    const red = spec.red_sha_orig || spec.red_sha;
    if (!red) return unverifiable(cmd, `specs[${label}] sin red_sha_orig ni red_sha`);
    const sha = resolveCommit(root, red);
    if (!sha) return unverifiable(cmd, `commit desconocido: RED ${red} de ${label}`);
    const show = git(root, ["show", "-U0", "--no-renames", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", "--format=", sha]);
    if (!show.ok) return unverifiable(cmd, `git show ${short(sha)} falló: ${firstLine(show.stderr)}`);
    let checked = 0;
    for (const [gitPath, added] of addedLinesByFile(show.stdout)) {
      const rel = toProject(gitPath, ctx.prefix);
      if (rel === null || !pathMatchesAnyGlob(rel, spec.test_paths)) continue;
      const nonBlank = added.filter((l) => l.trim() !== "");
      if (nonBlank.length === 0) continue;
      checked++;
      files++;
      lines += nonBlank.length;
      const head = git(root, ["show", `HEAD:${gitPath}`]);
      if (!head.ok) {
        findings.push(`${rel}: archivo borrado en HEAD (RED ${short(sha)} de ${label})`);
        continue;
      }
      for (const miss of missingLines(added, head.stdout)) {
        findings.push(`${rel}: falta «${miss.line}» (RED ${short(sha)} de ${label}: ${miss.need}×, HEAD: ${miss.have}×)`);
      }
    }
    if (checked === 0) notes.push(`el RED ${short(sha)} de ${label} no añade líneas en sus test_paths (${spec.test_paths.join(", ")})`);
  }
  if (findings.length === 0 && notes.length > 0) return unverifiable(cmd, notes[0], { notes });
  return { ...verdict(cmd, findings, `${lines} líneas del RED intactas en ${files} archivo${files === 1 ? "" : "s"}`), notes };
}

function specDelta(opts, root) {
  const cmd = "spec-delta";
  requireFlags(opts, "epic-dir", "base", "slug");
  const ctx = repoContext(root);
  if (ctx.error) return unverifiable(cmd, ctx.error);
  const base = resolveCommit(root, opts.flags.base);
  if (!base) return unverifiable(cmd, `commit desconocido: base ${opts.flags.base}`);
  const dir = epicDirOf(root, opts.flags["epic-dir"]);
  if (!fs.existsSync(dir.abs) || !fs.statSync(dir.abs).isDirectory()) return unverifiable(cmd, `no existe ${dir.rel}`);
  const gitDir = ctx.prefix + dir.rel;
  // --full-tree: ls-tree resolves pathspecs against cwd, and the project may be a subdirectory.
  const listing = git(root, ["ls-tree", "--full-tree", "--name-only", base, "--", `${gitDir}/`]);
  if (!listing.ok) return unverifiable(cmd, `git ls-tree falló: ${firstLine(listing.stderr)}`);
  const relevant = (name) => name.endsWith(".spec.md") || name === "_planning.md";
  const inBase = listing.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => path.posix.basename(posix(p)))
    .filter(relevant);
  if (inBase.length === 0) return unverifiable(cmd, `el base ${short(base)} no contiene ${dir.rel}`);
  const inTree = fs.readdirSync(dir.abs).filter(relevant);
  const slugFile = `${opts.flags.slug}.spec.md`;
  if (!inBase.includes(slugFile) && !inTree.includes(slugFile)) return unverifiable(cmd, `no existe ${dir.rel}/${slugFile}`);

  const findings = [];
  const names = [...new Set([...inBase, ...inTree])].sort();
  for (const name of names) {
    const rel = `${dir.rel}/${name}`;
    if (!inBase.includes(name)) {
      findings.push(`${rel}: archivo nuevo desde el base ${short(base)}`);
      continue;
    }
    if (!inTree.includes(name)) {
      findings.push(`${rel}: borrado desde el base ${short(base)}`);
      continue;
    }
    const shown = git(root, ["show", `${base}:${gitDir}/${name}`]);
    if (!shown.ok) return unverifiable(cmd, `git show ${short(base)}:${rel} falló: ${firstLine(shown.stderr)}`);
    const view = name === "_planning.md" ? planningView : name === slugFile ? slugSpecView : numbered;
    const diff = firstDifference(view(shown.stdout), view(fs.readFileSync(path.join(dir.abs, name), "utf8")));
    if (diff) findings.push(`${rel}:${diff.line}: «${diff.tree}» (base ${short(base)}: «${diff.base}»)`);
  }
  return verdict(cmd, findings, `solo cambió la sección Supersesiones de ${opts.flags.slug} (${names.length} archivos contra ${short(base)})`);
}

function specFilesUnder(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...specFilesUnder(abs));
    else if (entry.isFile() && entry.name.endsWith(".spec.md")) out.push(abs);
  }
  return out;
}

// PROTECTED = `verify:` tokens of rules.yml ∪ GUARDs of every spec outside `epicAbs`.
function protectedTests(root, epicAbs) {
  const rules = readRules(root);
  if (rules.exists && rules.error) return { error: `.specture/rules.yml no parsea: ${rules.error.message}` };
  const list = [];
  for (const rule of rules.parsed ? rules.parsed.rules : []) {
    for (const token of verifyTokens(rule.verify)) list.push({ ...token, by: `protegido por ${rule.id}` });
  }
  const specsRoot = path.join(root, SPECS_DIR);
  const inside = (file) => path.resolve(file).startsWith(path.resolve(epicAbs) + path.sep);
  for (const file of specFilesUnder(specsRoot).filter((f) => !inside(f))) {
    const owner = posix(path.relative(specsRoot, path.dirname(file)));
    const slug = path.basename(file, ".spec.md");
    for (const guard of parseGuards(fs.readFileSync(file, "utf8"))) {
      list.push({ path: posix(guard.path), test: guard.test, by: `protegido por ${guard.id} de ${owner}/${slug}` });
    }
  }
  return { list };
}

function protectedCheck(opts, root) {
  const cmd = "protected";
  requireFlags(opts, "epic-dir");
  const dir = epicDirOf(root, opts.flags["epic-dir"]);
  if (!fs.existsSync(dir.abs) || !fs.statSync(dir.abs).isDirectory()) return unverifiable(cmd, `no existe ${dir.rel}`);
  const slug = opts.flags.slug || null;
  const files = fs.readdirSync(dir.abs).filter((n) => n.endsWith(".spec.md") && (!slug || n === `${slug}.spec.md`)).sort();
  if (slug && files.length === 0) return unverifiable(cmd, `no existe ${dir.rel}/${slug}.spec.md`);
  const guarded = protectedTests(root, dir.abs);
  if (guarded.error) return unverifiable(cmd, guarded.error);

  const findings = [];
  let supersedes = 0;
  for (const name of files) {
    const spec = parseSpec(fs.readFileSync(path.join(dir.abs, name), "utf8"), name.replace(/\.spec\.md$/, ""));
    for (const sup of spec.supersedes) {
      supersedes++;
      for (const hit of guarded.list.filter((p) => samePath(p.path, sup.path) && sameTest(p.test, sup.test))) {
        findings.push(`${dir.rel}/${name}: Supersede \`${sup.path}::${sup.test}\` — ${hit.by}`);
      }
    }
  }
  return verdict(cmd, findings, `${supersedes} supersesiones, ninguna sobre los ${guarded.list.length} tests protegidos`);
}

function baseWorktree(opts, root) {
  const cmd = "base-worktree";
  const ctx = repoContext(root);
  if (opts.flags.remove) {
    if (opts.flags.lock || opts.flags.dir || opts.lists.files) throw new UsageError("--remove cannot be combined with --lock, --dir or --files");
    if (ctx.error) return unverifiable(cmd, ctx.error);
    const dir = path.resolve(root, opts.flags.remove);
    const r = git(root, ["worktree", "remove", "--force", dir]);
    if (!r.ok) return unverifiable(cmd, `git worktree remove falló: ${firstLine(r.stderr)}`);
    return { command: cmd, status: "REMOVED", reason: null, detail: dir, findings: [], notes: [], dir };
  }
  requireFlags(opts, "lock", "dir");
  if (ctx.error) return unverifiable(cmd, ctx.error);
  const sha = resolveCommit(root, opts.flags.lock);
  if (!sha) return unverifiable(cmd, `commit desconocido: lock ${opts.flags.lock}`);
  const files = opts.lists.files || [];
  for (const file of files) {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return unverifiable(cmd, `no existe en el árbol actual: ${file}`);
  }
  const dir = path.resolve(root, opts.flags.dir);
  const added = git(root, ["worktree", "add", "--detach", dir, sha]);
  if (!added.ok) return unverifiable(cmd, `git worktree add falló: ${firstLine(added.stderr)}`);
  const projectInWorktree = path.join(dir, ...ctx.prefix.split("/").filter(Boolean));
  try {
    for (const file of files) {
      const dest = path.join(projectInWorktree, ...file.split("/"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(root, file), dest);
    }
  } catch (error) {
    git(root, ["worktree", "remove", "--force", dir]);
    return unverifiable(cmd, `no se pudo superponer los archivos: ${error.message}`);
  }
  const notes = files.map((f) => `superpuesto desde el árbol actual: ${f}`);
  if (ctx.prefix) notes.push(`raíz del proyecto en el worktree: ${projectInWorktree}`);
  return { command: cmd, status: "READY", reason: null, detail: dir, findings: [], notes, dir, sha };
}

const COMMANDS = {
  "clean-tree": cleanTree,
  range,
  "red-lines": redLines,
  "spec-delta": specDelta,
  protected: protectedCheck,
  "base-worktree": baseWorktree
};

// A usage error or an unexpected exception is UNVERIFIABLE (exit 2) — never an exit 1 that
// would read as a FAIL the facts did not establish.
function run(opts) {
  const root = path.resolve(opts.project || process.cwd());
  try {
    return COMMANDS[opts.command](opts, root);
  } catch (error) {
    if (error instanceof UsageError) return unverifiable(opts.command, error.message, { usage: true });
    return unverifiable(opts.command, `error inesperado: ${firstLine(error && error.message)}`);
  }
}

function token(result) {
  const head = `HONESTY ${result.command}:`;
  if (result.status === "UNVERIFIABLE") return `${head} UNVERIFIABLE ${result.reason}`;
  if (result.status === "FAIL") return `${head} FAIL ${result.findings.length}`;
  return `${head} ${result.status} ${result.detail}`;
}

function render(result) {
  const body = [...result.findings.map((f) => `- ${f}`), ...(result.notes || []).map((n) => `- nota: ${n}`)];
  return [token(result), ...body].join("\n") + "\n";
}

function exitCode(result) {
  if (result.status === "UNVERIFIABLE") return 2;
  return result.status === "FAIL" ? 1 : 0;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    process.stdout.write(`HONESTY ${argv[0] || "(none)"}: UNVERIFIABLE ${error.message}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  const result = run(opts);
  if (result.usage) process.stderr.write(`${usage()}\n`);
  process.stdout.write(opts.json ? JSON.stringify({ token: token(result), ...result }, null, 2) + "\n" : render(result));
  process.exit(exitCode(result));
}

module.exports = {
  COMMAND_FLAGS,
  parseArgs,
  run,
  token,
  render,
  exitCode,
  toProject,
  parseStatusZ,
  parseLogNameOnly,
  addedLinesByFile,
  missingLines,
  numbered,
  slugSpecView,
  planningView,
  firstDifference,
  verifyTokens,
  sameTest,
  protectedTests
};
