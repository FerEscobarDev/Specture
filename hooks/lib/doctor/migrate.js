// Doctor — migrate mode.
//
//   runMigrate(projectRoot, { pluginVersion, catalog, apply, by })
//     → { applied, wouldApply, assisted, deferred, failed, schema: { before, after }, log }
//
// Walks the catalog in `since` order. Mechanical migrations are applied (when
// `apply` is true) and verified one by one; the chain stops at the first
// verify() failure. Assisted migrations are returned with their planInputs for
// the skill to draft in Plan mode. Content migrations are recorded as
// `deferred` with their owner and never touched. Finally schema_version is
// advanced to the last fully-applied version (inferSchemaVersion).

const path = require("path");
const fs = require("fs");
const semver = require("./semver");
const { loadProject, createContext } = require("./project");

const LOG_FILE = path.join(".specture", "migrations.log");

function readLog(projectRoot) {
  try {
    return fs.readFileSync(path.join(projectRoot, LOG_FILE), "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function appendLog(projectRoot, id, kind, outcome, by) {
  const line = `${new Date().toISOString()} ${id} ${kind} ${outcome} ${by}`;
  const abs = path.join(projectRoot, LOG_FILE);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.appendFileSync(abs, line + "\n");
  return line;
}

function alreadyLogged(projectRoot, id, outcome) {
  return readLog(projectRoot).some((l) => l.split(/\s+/)[1] === id && l.split(/\s+/)[3] === outcome);
}

function schemaVersionOf(project) {
  return project.settings.schemaVersion;
}

function runMigrate(projectRoot, options = {}) {
  const { pluginVersion, catalog = [], apply = false, by = "doctor" } = options;
  if (!pluginVersion) throw new Error("runMigrate: pluginVersion is required");
  const project = loadProject(projectRoot, pluginVersion);
  const result = { applied: [], wouldApply: [], assisted: [], deferred: [], failed: [], log: [], schema: { before: schemaVersionOf(project), after: null } };

  const shipped = catalog.filter((m) => semver.lte(m.since, pluginVersion));
  for (const migration of shipped) {
    const ctx = createContext(project, { dryRun: !apply });
    let status;
    try {
      status = migration.detect(ctx);
    } catch (error) {
      result.failed.push({ id: migration.id, reason: `detect() threw: ${error.message}` });
      continue;
    }
    if (status !== "pending") continue;

    if (migration.kind === "mechanical") {
      if (!apply) {
        result.wouldApply.push({ id: migration.id, title: migration.title });
        continue;
      }
      let notes = [];
      try {
        const outcome = migration.apply(ctx) || {};
        notes = outcome.notes || [];
      } catch (error) {
        result.failed.push({ id: migration.id, reason: `apply() threw: ${error.message}` });
        break;
      }
      ctx.refresh();
      const ok = migration.verify(createContext(project, { dryRun: true }));
      if (!ok) {
        result.failed.push({ id: migration.id, reason: "verify() returned false after apply()" });
        result.log.push(appendLog(projectRoot, migration.id, migration.kind, "failed", by));
        break;
      }
      result.applied.push({ id: migration.id, title: migration.title, writes: ctx.writes, notes });
      result.log.push(appendLog(projectRoot, migration.id, migration.kind, "applied", by));
    } else if (migration.kind === "assisted") {
      let planInputs = null;
      try {
        planInputs = migration.planInputs ? migration.planInputs(ctx) : null;
      } catch (error) {
        planInputs = { error: error.message };
      }
      result.assisted.push({ id: migration.id, title: migration.title, planInputs });
    } else {
      result.deferred.push({ id: migration.id, title: migration.title, ownerSkill: migration.ownerSkill || null });
      if (apply && !alreadyLogged(projectRoot, migration.id, "deferred")) {
        result.log.push(appendLog(projectRoot, migration.id, migration.kind, "deferred", by));
      }
    }
  }

  if (apply && result.failed.length === 0) {
    const schemaMigration = catalog.find((m) => m.id === "1.15-schema-version");
    if (schemaMigration && semver.lte(schemaMigration.since, pluginVersion)) {
      const ctx = createContext(project, { dryRun: false });
      const target = schemaMigration.inferSchemaVersion(ctx);
      const current = schemaMigration.currentSchema(ctx);
      if (current !== null && current !== target) {
        schemaMigration.setSchemaVersion(ctx, target);
        ctx.refresh();
      }
    }
  }
  result.schema.after = schemaVersionOf(loadProject(projectRoot, pluginVersion));
  return result;
}

// Confirms an assisted (or manual) migration: verify() must pass; then it is logged as applied.
function verifyMigration(projectRoot, options = {}) {
  const { pluginVersion, catalog = [], id, by = "skill" } = options;
  const migration = catalog.find((m) => m.id === id);
  if (!migration) return { ok: false, reason: `unknown migration ${id}` };
  const project = loadProject(projectRoot, pluginVersion);
  const ctx = createContext(project, { dryRun: true });
  const ok = Boolean(migration.verify(ctx));
  let logged = null;
  if (ok && !alreadyLogged(projectRoot, id, "applied")) logged = appendLog(projectRoot, id, migration.kind, "applied", by);
  return { ok, id, logged, reason: ok ? null : "verify() returned false — the migration is not complete" };
}

function planFor(projectRoot, options = {}) {
  const { pluginVersion, catalog = [], id } = options;
  const migration = catalog.find((m) => m.id === id);
  if (!migration) return { error: `unknown migration ${id}` };
  const project = loadProject(projectRoot, pluginVersion);
  const ctx = createContext(project, { dryRun: true });
  return {
    id: migration.id,
    kind: migration.kind,
    title: migration.title,
    status: migration.detect(ctx),
    ownerSkill: migration.ownerSkill || null,
    planInputs: migration.planInputs ? migration.planInputs(ctx) : null
  };
}

module.exports = { runMigrate, verifyMigration, planFor, readLog, appendLog, LOG_FILE };
