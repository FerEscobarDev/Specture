const { eolOf } = require("./lib");
const { parseQualityCommands, COMMAND_KEYS } = require("../hooks/lib/quality");

// v2.8.0 makes the build EXECUTE the project's quality tooling instead of guessing it from the
// names in `quality:` (`linter: eslint` says nothing about how to run it in this repo):
// `red-check.js` runs type_check / lint / format_check on the RED tests before sealing them,
// Step 6 runs them on the spec's files for the code-reviewer (plus `mutation` when
// settings.yml `mutation.enabled`), and the compliance review gets lint + format_check.
//
// This migration only adds the `commands:` block under an existing `quality:` section, every
// slot `sin definir` — a value nobody chose is not a command the framework may run. The doctor
// then warns (`quality-commands-undefined`) until the team fills it in or writes `none`.
// A `stack.yml` without `quality:` is `n/a` (setup writes the whole block from the template).

const STACK = ".specture/stack.yml";

const BLOCK = [
  "  # What the framework EXECUTES (since v2.8.0) — any language, any tool. `{files}` = the files",
  "  # under check; `none` = does not apply; `sin definir` = not decided (the check is SKIPPED).",
  "  # Examples per stack: docs/quality-catalog.md.",
  "  commands:",
  ...COMMAND_KEYS.map((key) => `    ${key}: "sin definir"`)
];

function qualityRange(all) {
  const start = all.findIndex((line) => /^quality\s*:/.test(line));
  if (start === -1) return null;
  let end = all.length;
  for (let i = start + 1; i < all.length; i++) {
    if (/^\S/.test(all[i])) {
      end = i;
      break;
    }
  }
  // Trim trailing blank lines of the section so the block lands right after its last entry.
  while (end - 1 > start && all[end - 1].trim() === "") end--;
  return { start, end };
}

module.exports = {
  id: "2.8-quality-commands",
  since: "2.8.0",
  kind: "mechanical",
  title: "`.specture/stack.yml`: add `quality.commands` (test / type_check / lint / format_check / mutation) as `sin definir` — the commands the build runs, declared by the project",
  detect(ctx) {
    const text = ctx.read(STACK);
    if (text === null) return "n/a";
    if (!/^quality\s*:/m.test(text)) return "n/a";
    return parseQualityCommands(text) ? "done" : "pending";
  },
  apply(ctx) {
    const text = ctx.read(STACK);
    if (text === null || parseQualityCommands(text)) return { notes: [] };
    const eol = eolOf(text);
    const all = text.replace(/\r\n/g, "\n").split("\n");
    const range = qualityRange(all);
    if (!range) return { notes: [] };
    all.splice(range.end, 0, ...BLOCK);
    ctx.write(STACK, all.join(eol));
    return {
      notes: [
        `\`quality.commands\` added to ${STACK} with every slot \`sin definir\`. Fill in the commands your project really runs (test, type_check, lint, format_check; mutation only if you enable \`mutation.enabled\`) or write \`none\` — \`/specture:setup\` asks for them, and \`docs/quality-catalog.md\` has examples per stack. Until then the mechanical checks that use them are SKIPPED and the doctor warns.`
      ]
    };
  },
  verify(ctx) {
    const text = ctx.read(STACK);
    return text === null || !/^quality\s*:/m.test(text) || parseQualityCommands(text) !== null;
  }
};
