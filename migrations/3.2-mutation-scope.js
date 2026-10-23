const { eolOf } = require("./lib");
const { parseSettingsYaml, MUTATION_SCOPES } = require("../hooks/lib/settings");

// v3.2.0 — `mutation.scope: spec | epic` in `.specture/settings.yml`: WHEN the mutation command
// runs once `mutation.enabled` is on. A project that predates it reads the default (`spec`, one
// run per spec in Step 6 — the behaviour since v2.8.0), so nothing changes until the team writes
// `epic` (one run per epic in Step 7.5 over every spec's production files); this migration only
// makes the knob visible next to `mutation.enabled`. `n/a` for a project still on the
// conventions.md §10 block (`1.15-settings-file` moves it first).

const SETTINGS = ".specture/settings.yml";
const LINE = "mutation.scope: spec                     # spec | epic — one mutation run per spec (Step 6) or one per epic over every spec's production files (Step 7.5)";

module.exports = {
  id: "3.2-mutation-scope",
  since: "3.2.0",
  kind: "mechanical",
  title: "`.specture/settings.yml`: add `mutation.scope: spec` — when the mutation command runs (spec | epic)",
  detect(ctx) {
    const text = ctx.read(SETTINGS);
    if (text === null) return "n/a";
    return "mutation.scope" in parseSettingsYaml(text) ? "done" : "pending";
  },
  apply(ctx) {
    const text = ctx.read(SETTINGS);
    if (text === null || "mutation.scope" in parseSettingsYaml(text)) return { notes: [] };
    const eol = eolOf(text);
    const all = text.replace(/\r\n/g, "\n").split("\n");
    // Right after `mutation.enabled` when it exists, else after `tdd.level`, else after the last key.
    let after = all.findIndex((l) => /^mutation\.enabled\s*:/.test(l));
    if (after === -1) after = all.findIndex((l) => /^tdd\.level\s*:/.test(l));
    if (after === -1) {
      for (let i = all.length - 1; i >= 0; i--) if (/^[A-Za-z0-9_.-]+\s*:/.test(all[i])) { after = i; break; }
    }
    all.splice(after + 1, 0, LINE);
    ctx.write(SETTINGS, all.join(eol));
    return {
      notes: [
        `\`mutation.scope: spec\` added to ${SETTINGS} — the mutation command keeps running once per spec in Step 6, exactly as before. Write \`epic\` to run it once per epic (Step 7.5) over every spec's production files, with a bounded MODE: MUTATION review before the [x]: one run per epic instead of one per spec, and a weak test is caught one spec later. Valid values: ${MUTATION_SCOPES.join(" | ")}.`
      ]
    };
  },
  verify(ctx) {
    const text = ctx.read(SETTINGS);
    return text === null || "mutation.scope" in parseSettingsYaml(text);
  }
};
