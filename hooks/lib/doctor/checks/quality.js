// Quality commands lint — `stack.yml` → `quality.commands` and settings `mutation.enabled`.
// Every finding: { severity, group: "quality", check, file, detail, action }.
//
//   quality-commands-undefined   WARNING  the `commands:` block exists but a slot is still
//                                         `sin definir`: the mechanical checks that would run it
//                                         (red-check, build Step 6, compliance review) are
//                                         SKIPPED and the agents fall back to reading code by eye
//   mutation-enabled-no-command  WARNING  settings.yml `mutation.enabled: true` but
//                                         `quality.commands.mutation` is `none` / undefined —
//                                         the build has nothing to run, the toggle is a no-op
//
// A `stack.yml` without `commands:` is the migration's business (`2.8-quality-commands`,
// reported as drift), not this check's. The framework never fills a slot by itself: a command it
// guessed from a tool name would run in the user's repo without anyone having chosen it.

const { readQualityCommands, COMMAND_KEYS } = require("../../quality");

const STACK = ".specture/stack.yml";
const SETTINGS = ".specture/settings.yml";

// `route` (v2.9.0): the command that closes the finding — `check --brief`, `migrate --apply` and
// `start` name it, so a project never runs a batch without knowing its quality commands are
// still undefined (a real project did exactly that: migrated in silence, every check SKIPPED).
function finding(severity, check, file, detail, action, route) {
  const out = { severity, group: "quality", check, file, detail, action };
  if (route) out.route = route;
  return out;
}

function run(project) {
  const quality = readQualityCommands(project.root);
  if (!quality.exists || !quality.block) return [];
  const out = [];
  const undefinedKeys = COMMAND_KEYS.filter((key) => quality.states[key] === "undefined");
  if (undefinedKeys.length > 0) {
    out.push(finding(
      "WARNING",
      "quality-commands-undefined",
      STACK,
      `quality.commands: ${undefinedKeys.join(", ")} still \`sin definir\` — red-check, build Step 6, the compliance review and the scoped test runs (\`test_scoped\`, v2.9.0) SKIP those checks and the agents inspect by eye what a tool would report in seconds`,
      "declare the command your project runs for each slot (`{files}` = the files under check, `{names}` = their base names) or write `none` when it does not apply; examples per stack in docs/quality-catalog.md; `/specture:setup` (reconfigure) asks for them",
      "/specture:setup (reconfigure) → quality.commands"
    ));
  }
  if (project.settings.values["mutation.enabled"] === true && quality.states.mutation !== "defined") {
    out.push(finding(
      "WARNING",
      "mutation-enabled-no-command",
      SETTINGS,
      "`mutation.enabled: true` but `quality.commands.mutation` in stack.yml is not a command — build Step 6 has nothing to run and the code-reviewer never gets a MUTATION_REPORT",
      "declare `quality.commands.mutation` (the mutation tool of your stack over `{files}`; examples in docs/quality-catalog.md) or set `mutation.enabled: false`"
    ));
  }
  return out;
}

module.exports = { run };
