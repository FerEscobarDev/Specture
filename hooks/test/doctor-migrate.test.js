const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const doctorPath = path.join(root, "scripts", "doctor.js");
const catalog = require("../../migrations");
const { runMigrate, verifyMigration, readLog } = require("../lib/doctor/migrate");
const PLUGIN = "1.16.0"; // exercise migrations through 1.16 regardless of the installed version

const temporaryDirectories = [];

function write(projectRoot, rel, text) {
  const abs = path.join(projectRoot, ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

// A project set up around v1.5: toggles in conventions §10, no gitignore entries,
// no §12/§13, stack without `structure`, no requirements/roadmap/contract.
function legacyProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specture-migrate-"));
  temporaryDirectories.push(projectRoot);
  write(projectRoot, ".specture/stack.yml", 'project:\n  name: "Legacy App"\n');
  write(projectRoot, ".specture/conventions.md", "# Convenciones\n\n## 10. Specture\n\n- **hooks.enabled**: true\n- **learn.enabled**: true\n- **build.max_parallel_epics**: 3\n\n## 11. Índice\n\n- No aplica\n");
  write(projectRoot, "legacy_app_api/.keep", "");
  return projectRoot;
}

function read(projectRoot, rel) {
  return fs.readFileSync(path.join(projectRoot, ...rel.split("/")), "utf8");
}

function cli(projectRoot, ...extra) {
  return spawnSync(process.execPath, [doctorPath, ...extra, "--project", projectRoot, "--plugin-version", PLUGIN], { encoding: "utf8" });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test("dry run lists what would be applied and writes nothing", () => {
  const projectRoot = legacyProject();
  const before = read(projectRoot, ".specture/conventions.md");
  const result = runMigrate(projectRoot, { pluginVersion: PLUGIN, catalog, apply: false });

  assert.deepEqual(result.applied, []);
  assert.ok(result.wouldApply.map((m) => m.id).includes("1.15-settings-file"));
  assert.ok(result.assisted.map((m) => m.id).includes("1.12-structure-block"));
  assert.equal(read(projectRoot, ".specture/conventions.md"), before);
  assert.ok(!fs.existsSync(path.join(projectRoot, ".specture", "settings.yml")));
  assert.deepEqual(readLog(projectRoot), []);
});

test("apply runs the mechanical chain in order, logs it, and stops the schema at the first pending assisted migration", () => {
  const projectRoot = legacyProject();
  const result = runMigrate(projectRoot, { pluginVersion: PLUGIN, catalog, apply: true, by: "test" });

  assert.deepEqual(result.failed, []);
  assert.deepEqual(
    result.applied.map((m) => m.id),
    ["1.2-state-gitignore", "1.7-meta-gitignore", "1.8-drop-parallel-toggle", "1.10-rules-sections", "1.11-profile-and-knowledge", "1.15-settings-file", "1.15-schema-version"]
  );
  assert.deepEqual(result.assisted.map((m) => m.id), ["1.12-structure-block"]);
  assert.equal(result.assisted[0].planInputs.slug, "legacy_app");
  assert.deepEqual(result.deferred, []);

  const gitignore = read(projectRoot, ".gitignore");
  assert.match(gitignore, /^\.specture\/state\/$/m);
  assert.match(gitignore, /^docs\/\.specture-meta\/$/m);
  const conventions = read(projectRoot, ".specture/conventions.md");
  assert.ok(!/max_parallel_epics/.test(conventions));
  assert.match(conventions, /^## 12\./m);
  assert.match(conventions, /Migrado a `\.specture\/settings\.yml`/);
  const settings = read(projectRoot, ".specture/settings.yml");
  assert.match(settings, /^hooks\.enabled: true\b/m);
  assert.match(settings, /^knowledge\.enabled: true\b/m);
  assert.match(settings, /^schema_version: 1\.11\.0\b/m, "1.12-structure-block pending → schema stops at 1.11.0");
  assert.equal(result.schema.after, "1.11.0");

  const log = readLog(projectRoot);
  assert.equal(log.length, 7);
  assert.match(log[0], /^\d{4}-\d{2}-\d{2}T\S+ 1\.2-state-gitignore mechanical applied test$/);
});

test("a second apply is a no-op; verifying the assisted migration advances the schema to the plugin version", () => {
  const projectRoot = legacyProject();
  runMigrate(projectRoot, { pluginVersion: PLUGIN, catalog, apply: true });
  const again = runMigrate(projectRoot, { pluginVersion: PLUGIN, catalog, apply: true });
  assert.deepEqual(again.applied, []);
  assert.equal(readLog(projectRoot).length, 7);

  // the skill drafts the structure block in Plan mode and writes it
  write(projectRoot, ".specture/stack.yml", 'project:\n  name: "Legacy App"\n  slug: "legacy_app"\nstructure:\n  root_layout: by-app-suffix\n  apps:\n    api: "legacy_app_api"\n');
  const verified = verifyMigration(projectRoot, { pluginVersion: PLUGIN, catalog, id: "1.12-structure-block", by: "skill" });
  assert.equal(verified.ok, true);
  assert.match(verified.logged, / 1\.12-structure-block assisted applied skill$/);

  const after = runMigrate(projectRoot, { pluginVersion: PLUGIN, catalog, apply: true });
  assert.deepEqual(after.assisted, []);
  assert.equal(after.schema.after, PLUGIN);
  assert.match(read(projectRoot, ".specture/settings.yml"), /^schema_version: 1\.16\.0\b/m);
});

test("verify refuses an incomplete migration and content migrations are deferred with their owner", () => {
  const projectRoot = legacyProject();
  const refused = verifyMigration(projectRoot, { pluginVersion: PLUGIN, catalog, id: "1.12-structure-block" });
  assert.equal(refused.ok, false);
  assert.deepEqual(readLog(projectRoot), []);

  write(projectRoot, "docs/04-roadmap/ROADMAP.md", "### Milestone 1: F\n\n- [x] **Epic 1.1:** A\n  - **Dependencias:** Ninguna\n");
  const result = runMigrate(projectRoot, { pluginVersion: PLUGIN, catalog, apply: true });
  assert.deepEqual(result.deferred.map((m) => m.id), ["1.9-current-state-init"]);
  assert.ok(result.deferred[0].ownerSkill.includes("knowledge reconcile"));
  assert.ok(readLog(projectRoot).some((l) => / 1\.9-current-state-init content deferred /.test(l)));
  assert.ok(!fs.existsSync(path.join(projectRoot, "docs", "05-specs", "_current")), "content migrations never write");
});

test("CLI: migrate (dry run) exits 0, --plan prints inputs, --verify exits 1 when incomplete, sync applies and checks", () => {
  const projectRoot = legacyProject();
  const dry = cli(projectRoot, "migrate", "--json");
  assert.equal(dry.status, 0, dry.stderr);
  assert.ok(JSON.parse(dry.stdout).wouldApply.length > 0);

  const plan = cli(projectRoot, "migrate", "--plan", "1.12-structure-block", "--json");
  assert.equal(plan.status, 0, plan.stderr);
  assert.equal(JSON.parse(plan.stdout).planInputs.slug, "legacy_app");

  const verify = cli(projectRoot, "migrate", "--verify", "1.12-structure-block");
  assert.equal(verify.status, 1);

  const sync = cli(projectRoot, "sync", "--json");
  const out = JSON.parse(sync.stdout);
  assert.ok(out.migrate.applied.length >= 6, sync.stderr);
  assert.equal(out.check.settingsSource, "settings.yml");
  assert.ok(fs.existsSync(path.join(projectRoot, ".specture", "migrations.log")));
});
