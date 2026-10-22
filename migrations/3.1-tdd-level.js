const { eolOf } = require("./lib");
const { parseSettingsYaml, TDD_LEVELS } = require("../hooks/lib/settings");

// v3.1.0 — `tdd.level: strict | essential | none` in `.specture/settings.yml`: how much test
// discipline the build loop enforces. A project that predates it reads the default (`strict`,
// the loop as it always was), so nothing changes until the team writes another value; this
// migration only makes the knob visible in the file, next to the other toggles, so the choice
// is explicit. `setup` writes it for new projects (template); `n/a` for a project still on the
// conventions.md §10 block (`1.15-settings-file` moves it first).

const SETTINGS = ".specture/settings.yml";
const LINE = "tdd.level: strict                         # strict | essential | none — test discipline of the build loop (any profile; frozen per epic when it opens)";

module.exports = {
  id: "3.1-tdd-level",
  since: "3.1.0",
  kind: "mechanical",
  title: "`.specture/settings.yml`: add `tdd.level: strict` — the test discipline of the build loop (strict | essential | none)",
  detect(ctx) {
    const text = ctx.read(SETTINGS);
    if (text === null) return "n/a";
    return "tdd.level" in parseSettingsYaml(text) ? "done" : "pending";
  },
  apply(ctx) {
    const text = ctx.read(SETTINGS);
    if (text === null || "tdd.level" in parseSettingsYaml(text)) return { notes: [] };
    const eol = eolOf(text);
    const all = text.replace(/\r\n/g, "\n").split("\n");
    // Right after `mutation.enabled` when it exists (the last toggle), else after the last key.
    let after = all.findIndex((l) => /^mutation\.enabled\s*:/.test(l));
    if (after === -1) {
      for (let i = all.length - 1; i >= 0; i--) if (/^[A-Za-z0-9_.-]+\s*:/.test(all[i])) { after = i; break; }
    }
    all.splice(after + 1, 0, LINE);
    ctx.write(SETTINGS, all.join(eol));
    return {
      notes: [
        `\`tdd.level: strict\` added to ${SETTINGS} — the loop keeps working exactly as before. Change it to \`essential\` (one test per AC, no variants, no mutation) for a small or internal project, or \`none\` (no RED, no honesty gate: spec → implement → review → verify with type_check/lint) for an experiment. The epic coordinator freezes the value per epic when it opens it. Valid values: ${TDD_LEVELS.join(" | ")}.`
      ]
    };
  },
  verify(ctx) {
    const text = ctx.read(SETTINGS);
    return text === null || "tdd.level" in parseSettingsYaml(text);
  }
};
