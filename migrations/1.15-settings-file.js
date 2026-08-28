const { lines } = require("../hooks/lib/doctor/project");
const settings = require("../hooks/lib/settings");
const { eolOf } = require("./lib");

const CONVENTIONS = ".specture/conventions.md";
const SETTINGS = ".specture/settings.yml";
const POINTER = "> Migrado a `.specture/settings.yml` (Specture v1.15.0). Las líneas de toggles que sigan abajo ya no se leen; editá `settings.yml`.";

module.exports = {
  id: "1.15-settings-file",
  since: "1.15.0",
  kind: "mechanical",
  title: "Move the framework toggles from conventions.md §10 to .specture/settings.yml",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    return ctx.exists(SETTINGS) ? "done" : "pending";
  },
  apply(ctx) {
    const conventions = ctx.read(CONVENTIONS) || "";
    const legacy = settings.parseConventionsSettings(conventions);
    const values = {};
    for (const [key, value] of Object.entries(legacy)) {
      values[settings.LEGACY_ALIASES[key] || key] = value;
    }
    ctx.write(SETTINGS, settings.serializeSettings(values, { schemaVersion: "" }));
    if (conventions && !conventions.includes(POINTER)) {
      const eol = eolOf(conventions);
      const all = lines(conventions);
      const idx = all.findIndex((l) => /^##\s*10\./.test(l));
      if (idx !== -1) {
        all.splice(idx + 1, 0, "", POINTER);
        ctx.write(CONVENTIONS, all.join(eol));
      }
    }
  },
  verify(ctx) {
    return ctx.exists(SETTINGS);
  }
};
