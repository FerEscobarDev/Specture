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

function finding(severity, check, file, detail, action) {
  return { severity, group: "quality", check, file, detail, action };
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
      `quality.commands: ${undefinedKeys.join(", ")} still \`sin definir\` — red-check, build Step 6 and the compliance review SKIP those checks and the agents inspect by eye what a tool would report in seconds`,
      "declare the command your project runs for each slot (`{files}` = the files under check) or write `none` when it does not apply; examples per stack in docs/quality-catalog.md; `/specture:setup` (reconfigure) asks for them"
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
