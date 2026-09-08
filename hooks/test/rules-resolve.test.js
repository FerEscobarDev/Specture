const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "hooks", "lib", "rules-resolve.js");
const temporaryDirectories = [];

const STACK = 'project:\n  name: "Demo"\n  slug: "demo"\n';
const RULES = [
  "schema: 1",
  "rules:",
  "  - id: R-1",
  "    tags: [dto, domain]",
  '    rule: "Los DTOs son inmutables"',
  "    severity: BLOCKER",
  '    source: "ADR-004"',
  "  - id: R-2",
  "    tags: [all]",
  '    rule: "Métodos de consulta = sustantivo"',
  "    severity: IMPORTANT",
  "  - id: R-3",
  "    tags: [frontend, a11y]",
  '    rule: "Todo control interactivo tiene nombre accesible"',
  "    severity: BLOCKER",
  ""
].join("\n");

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-rules-"));
  temporaryDirectories.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function run(dir, ...args) {
  return spawnSync(process.execPath, [cli, "--project", dir, ...args], { encoding: "utf8" });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

test("prints the RULES_RESOLVED block for the tags that intersect, plus `all` rules", () => {
  const dir = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": RULES });
  const result = run(dir, "--tags", "backend,dto");
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines[0], "RULES_RESOLVED: 2 of 3 (tags: backend, dto)");
  assert.match(lines[1], /^- R-1 \[dto, domain\] BLOCKER — Los DTOs son inmutables · fuente: ADR-004$/);
  assert.match(lines[2], /^- R-2 \[all\] IMPORTANT — Métodos de consulta = sustantivo$/);
  assert.equal(result.stderr, "");

  const json = run(dir, "--tags", "frontend", "--json");
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.total, 3);
  assert.deepEqual(parsed.resolved.map((r) => r.id), ["R-2", "R-3"]);
  assert.ok(!("_line" in parsed.resolved[0]));

  const all = run(dir, "--all");
  assert.match(all.stdout, /^RULES_RESOLVED: 3 of 3 \(all rules\)/);
});

test("no rules.yml → the legacy §12 rules are injected whole with a migration warning; nothing declared → RULES_RESOLVED: []", () => {
  const legacy = project({ ".specture/stack.yml": STACK, ".specture/conventions.md": "## 12. Invariantes\n- **R-1:** algo\n- **R-2:** otra cosa\n" });
  const result = run(legacy, "--tags", "dto");
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines[0], "RULES_RESOLVED: 2 of 2 (all rules)", "tolerant read: every legacy rule, tag filter ignored");
  assert.match(lines[1], /^- R-1 \[all\] IMPORTANT — algo$/);
  assert.match(lines[2], /^- R-2 \[all\] IMPORTANT — otra cosa$/);
  assert.match(result.stderr, /rules\.yml` no inicializado — conventions\.md §12 declara 2 regla\(s\); se inyectan todas.*1\.19-rules-file/);
  const json = JSON.parse(run(legacy, "--tags", "dto", "--json").stdout);
  assert.equal(json.legacy, true);
  assert.equal(json.file, ".specture/conventions.md#12");
  assert.deepEqual(json.resolved.map((r) => r.id), ["R-1", "R-2"]);

  const fresh = project({ ".specture/stack.yml": STACK, ".specture/conventions.md": "## 12. Invariantes\n\n> puntero\n" });
  const quiet = run(fresh, "--tags", "dto", "--json");
  assert.equal(quiet.status, 0);
  assert.equal(quiet.stderr, "");
  assert.deepEqual(JSON.parse(quiet.stdout).resolved, []);
});

test("a rules.yml that does not parse fails loud (exit 1); usage errors exit 2", () => {
  const broken = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": "schema: 1\nrules:\n  - id: R-1\n    rule: |\n      multi\n" });
  const result = run(broken, "--tags", "dto");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not parse — multi-line values are not supported.*\(line 4\)/);

  const ok = project({ ".specture/stack.yml": STACK, ".specture/rules.yml": RULES });
  assert.equal(run(ok).status, 2, "neither --tags nor --all");
  assert.equal(run(ok, "--bogus").status, 2);
  const notProject = fs.mkdtempSync(path.join(os.tmpdir(), "not-specture-"));
  temporaryDirectories.push(notProject);
  assert.equal(spawnSync(process.execPath, [cli, "--project", notProject, "--all"], { encoding: "utf8" }).status, 2);
});
