// Doctor — check mode. Read-only.
//
//   runCheck(projectRoot, { pluginVersion, catalog }) → result
//
// result = { root, pluginVersion, settingsSource, findings, drift, counts, exitCode }
//   exitCode: 0 = no ERROR, 1 = at least one ERROR.

const { loadProject } = require("./project");
const corpus = require("./checks/corpus");
const state = require("./checks/state");
const drift = require("./checks/drift");
const requirements = require("./checks/requirements");
const rules = require("./checks/rules");

function runCheck(projectRoot, options = {}) {
  const pluginVersion = options.pluginVersion;
  if (!pluginVersion) throw new Error("runCheck: pluginVersion is required");
  const catalog = options.catalog || [];
  const project = loadProject(projectRoot, pluginVersion);

  const driftResult = drift.run(project, catalog);
  const findings = [...corpus.run(project), ...requirements.run(project), ...rules.run(project), ...state.run(project), ...driftResult.findings];
  const counts = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;

  return {
    root: project.root,
    pluginVersion,
    settingsSource: project.settings.source,
    findings,
    drift: driftResult,
    counts,
    exitCode: counts.ERROR > 0 ? 1 : 0
  };
}

module.exports = { runCheck };
