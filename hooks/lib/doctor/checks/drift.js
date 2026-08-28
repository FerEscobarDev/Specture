// Schema drift — the project's schema_version vs the installed plugin, and the
// migrations the catalog detects as pending (by filesystem, not by number).

const semver = require("../semver");
const { createContext } = require("../project");

function finding(severity, check, file, detail, action) {
  return { severity, group: "drift", check, file, detail, action };
}

// Returns { findings, migrations: [{ id, since, kind, title, status }] }.
function run(project, catalog = []) {
  const findings = [];
  const ctx = createContext(project, { dryRun: true });
  const migrations = [];
  for (const migration of catalog) {
    if (semver.gt(migration.since, project.pluginVersion)) continue; // not shipped yet
    let status;
    try {
      status = migration.detect(ctx);
    } catch (error) {
      status = "error";
      findings.push(finding("WARNING", "migration-detect-error", migration.id, `detect() threw: ${error.message}`, "report this as a framework bug"));
    }
    migrations.push({ id: migration.id, since: migration.since, kind: migration.kind, title: migration.title, status, ownerSkill: migration.ownerSkill || null });
  }

  const pending = migrations.filter((m) => m.status === "pending");
  const byKind = { mechanical: 0, assisted: 0, content: 0 };
  for (const m of pending) byKind[m.kind] = (byKind[m.kind] || 0) + 1;

  const schemaVersion = project.settings.schemaVersion;
  const hasSettings = project.settings.source === "settings.yml";
  const behind = !schemaVersion || semver.lt(schemaVersion, project.pluginVersion);

  if (pending.length > 0) {
    const severity = !hasSettings && byKind.mechanical > 0 ? "ERROR" : "WARNING";
    findings.push(
      finding(
        severity,
        "migrations-pending",
        ".specture/settings.yml",
        `${pending.length} migration(s) pending — ${byKind.mechanical} mechanical, ${byKind.assisted} assisted, ${byKind.content} content: ${pending.map((m) => m.id).join(", ")}`,
        "run `/specture:doctor migrate`"
      )
    );
  } else if (behind) {
    findings.push(finding("WARNING", "schema-version-behind", ".specture/settings.yml", `schema_version ${schemaVersion || "(none)"} < plugin ${project.pluginVersion}, but nothing is pending`, "run `/specture:doctor migrate` to record the schema version"));
  }
  for (const m of pending.filter((p) => p.kind === "content")) {
    findings.push(finding("WARNING", "content-migration-deferred", m.id, `${m.title} — content migration, never applied automatically`, `owner: ${m.ownerSkill || "manual"}; the doctor records it as deferred`));
  }
  return { findings, migrations, schemaVersion, pluginVersion: project.pluginVersion, behind };
}

module.exports = { run };
