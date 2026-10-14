const { eolOf } = require("./lib");
const { parseQualityCommands } = require("../hooks/lib/quality");

// v2.9.0 splits the test command in two: `test` (the whole suite — Step 3.9 baseline and
// Step 7 only) and `test_scoped` (only the tests in `{files}` / `{names}` — what the
// tdd-test-writer, the implementer and the epic-agent's post-checks run). Measured on Psikora
// HC-IHCE.14: the implementer ran the full suite 38 times in one epic (66 minutes of a 20-40
// minute suite, each run a cache miss on return).
//
// This migration adds the `test_scoped` slot as `sin definir` to a `quality.commands` block
// that already exists (v2.8.0 projects). `n/a` without the block: `2.8-quality-commands`
// writes every slot, this one included. The doctor warns (`quality-commands-undefined`) until
// the team fills it in or writes `none`; while it is undefined the scoped runs are SKIPPED and
// the agents say so — the framework never guesses a runner.

const STACK = ".specture/stack.yml";
const LINE = (indent) => `${indent}test_scoped: "sin definir"    # only the tests in {files} / {names} — every run but the baseline and Step 7 (v2.9.0)`;

module.exports = {
  id: "2.9-test-scoped-command",
  since: "2.9.0",
  kind: "mechanical",
  title: "`.specture/stack.yml`: add `quality.commands.test_scoped` (`sin definir`) — the command that runs only the tests under work; `test` stays for the baseline and Step 7",
  detect(ctx) {
    const text = ctx.read(STACK);
    if (text === null) return "n/a";
    const block = parseQualityCommands(text);
    if (!block) return "n/a";
    return "test_scoped" in block.values ? "done" : "pending";
  },
  apply(ctx) {
    const text = ctx.read(STACK);
    if (text === null) return { notes: [] };
    const block = parseQualityCommands(text);
    if (!block || "test_scoped" in block.values) return { notes: [] };
    const eol = eolOf(text);
    const all = text.replace(/\r\n/g, "\n").split("\n");
    // Right after `test:` when it exists, else after the last entry of the block.
    const after = block.lineOf.test || Math.max(...Object.values(block.lineOf));
    const indent = (all[after - 1].match(/^ */) || [""])[0];
    all.splice(after, 0, LINE(indent));
    ctx.write(STACK, all.join(eol));
    return {
      notes: [
        `\`quality.commands.test_scoped\` added to ${STACK} as \`sin definir\`. Declare the command that runs ONLY the tests in \`{files}\` (or \`{names}\` for runners that filter by class name) — \`docs/quality-catalog.md\` has examples per stack, \`/specture:setup\` (reconfigure) asks for it. Until then every scoped run is SKIPPED and the agents say so; \`test\` keeps running the whole suite at the baseline (Step 3.9) and at Step 7 only.`
      ]
    };
  },
  verify(ctx) {
    const text = ctx.read(STACK);
    if (text === null) return true;
    const block = parseQualityCommands(text);
    return !block || "test_scoped" in block.values;
  }
};
