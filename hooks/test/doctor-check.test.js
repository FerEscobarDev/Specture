const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const doctorPath = path.join(root, "scripts", "doctor.js");
const pluginVersion = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8")).version;
const temporaryDirectories = [];

function write(projectRoot, rel, text) {
  const abs = path.join(projectRoot, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function createProject(files) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-doctor-"));
  temporaryDirectories.push(projectRoot);
  for (const [rel, text] of Object.entries(files)) write(projectRoot, rel, text);
  return projectRoot;
}

function runDoctor(projectRoot, ...extra) {
  const result = spawnSync(process.execPath, [doctorPath, "check", "--project", projectRoot, "--json", ...extra], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json: result.stdout ? JSON.parse(result.stdout) : null };
}

const CLEAN = {
  ".specture/stack.yml": 'project:\n  name: "Demo"\napi:\n  style: "rest"\n  contract_file: "docs/02-architecture/api-contract.openapi.yaml"\n',
  ".specture/settings.yml": `schema_version: ${pluginVersion}\nprofile: custom\nhooks.enabled: true\n`,
  ".specture/conventions.md": "# Convenciones\n\n## 10. Specture\n\n> ver settings.yml\n",
  ".specture/decisions/001-initial-stack.md": "# ADR-001\n\n## Status\n\nAccepted\n",
  "docs/04-roadmap/ROADMAP.md": "# ROADMAP\n\n### Milestone 1: Foundation\n\n- [ ] **Epic 1.1:** Scaffold\n  - **Dependencias:** Ninguna\n"
};

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("a clean project in sync with the plugin has no findings and exits 0", () => {
  const projectRoot = createProject(CLEAN);
  const { status, json, stderr } = runDoctor(projectRoot);

  assert.equal(status, 0, stderr);
  assert.deepEqual(json.findings, []);
  assert.equal(json.settingsSource, "settings.yml");
});

test("reports broken paths, placeholders, duplicate ADRs, missing statuses, stale seal and missing _current", () => {
  const projectRoot = createProject({
    ...CLEAN,
    ".specture/decisions/012-http-conventions.md": "# ADR-012\n\n## Status\n\nAccepted\n",
    ".specture/decisions/012-response-contract.md": "# ADR-012 bis\n\nno status here\n",
    ".specture/state/build-locked.json": JSON.stringify({ epic: "epic-1.1", red_sha: "abc", test_paths: ["tests/**/*.test.js"] }),
    "docs/04-roadmap/ROADMAP.md": "# ROADMAP\n\n### Milestone 1: Foundation\n\n- [x] **Epic 1.1:** Scaffold — spec `docs/05-specs/epic-1.1/01-...spec.md`\n  - **Dependencias:** Ninguna\n",
    "docs/02-architecture/architecture.md": "# Arquitectura\n\nVer `docs/02-architecture/api-contract.md` y `docs/02-architecture/nope.md`.\n",
    "docs/07-reviews/review-epic-1.1-01-2026-01-01.md": "# Review\n\nno verdict block\n",
    "docs/05-specs/epic-1.1/01-scaffold.spec.md": "# SPEC\n\nno ids at all\n",
    ".claude/worktrees/agent-x/file.txt": "leftover"
  });
  const { status, json } = runDoctor(projectRoot);
  const checks = json.findings.map((f) => f.check);

  assert.equal(status, 1);
  assert.ok(checks.includes("broken-path"), "broken-path");
  assert.ok(checks.includes("placeholder-path"), "placeholder-path");
  assert.ok(checks.includes("adr-duplicate"), "adr-duplicate");
  assert.ok(checks.includes("adr-status"), "adr-status");
  assert.ok(checks.includes("review-status"), "review-status");
  assert.ok(checks.includes("spec-ids"), "spec-ids");
  assert.ok(checks.includes("seal-stale"), "seal-stale");
  assert.ok(checks.includes("current-state-missing"), "current-state-missing");
  assert.ok(checks.includes("worktree-residue"), "worktree-residue");

  const broken = json.findings.filter((f) => f.check === "broken-path").map((f) => f.detail);
  assert.ok(broken.some((d) => d.includes("docs/02-architecture/nope.md")));
  assert.ok(broken.some((d) => d.includes("docs/02-architecture/api-contract.md")));
});

test("historical documents (reviews, debug logs, closed specs) are not linted for broken paths", () => {
  const projectRoot = createProject({
    ...CLEAN,
    "docs/07-reviews/review-old.md": "STATUS: APPROVED\n\nSee `docs/05-specs/gone/01-x.spec.md`.\n",
    "docs/06-debug-logs/2026-01-01-x.md": "See `docs/05-specs/gone/02-x.spec.md`.\n",
    "docs/05-specs/epic-0.1/01-x.spec.md": "AC-1 see `docs/02-architecture/missing.md`\n"
  });
  const { json } = runDoctor(projectRoot);

  assert.equal(json.findings.filter((f) => f.check === "broken-path").length, 0);
});

test("a seal whose epic is [/] is accepted; a project without settings.yml is reported from conventions", () => {
  const projectRoot = createProject({
    ...CLEAN,
    ".specture/state/build-locked.json": JSON.stringify({ epic: "epic-1.1", test_paths: ["tests/**"] }),
    "docs/04-roadmap/ROADMAP.md": "### Milestone 1: Foundation\n\n- [/] **Epic 1.1:** Scaffold\n"
  });
  fs.rmSync(path.join(projectRoot, ".specture", "settings.yml"));
  write(projectRoot, ".specture/conventions.md", "## 10. Specture\n\n- **hooks.enabled**: true\n");
  const { json } = runDoctor(projectRoot);

  assert.equal(json.settingsSource, "conventions.md");
  assert.equal(json.findings.filter((f) => f.check.startsWith("seal-")).length, 0);
});

test("--brief prints a one-line summary", () => {
  const projectRoot = createProject(CLEAN);
  const result = spawnSync(process.execPath, [doctorPath, "check", "--project", projectRoot, "--brief"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^doctor: 0 ERROR, 0 WARNING · schema \d+\.\d+\.\d+ → plugin \d+\.\d+\.\d+ · pending migrations: 0/);
});

test("refuses a directory that is not a Specture project", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "not-specture-"));
  temporaryDirectories.push(dir);
  const result = spawnSync(process.execPath, [doctorPath, "check", "--project", dir], { encoding: "utf8" });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a Specture project/);
});
