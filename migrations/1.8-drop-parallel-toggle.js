const { lines } = require("../hooks/lib/doctor/project");
const { eolOf } = require("./lib");

const TOGGLE_LINE = /^\s*-?\s*\*{0,2}build\.max_parallel_epics\*{0,2}\s*:.*$/;
const FILES = [".specture/conventions.md", ".specture/settings.yml"];

function offendingFiles(ctx) {
  return FILES.filter((rel) => {
    const text = ctx.read(rel);
    return text !== null && lines(text).some((l) => TOGGLE_LINE.test(l));
  });
}

module.exports = {
  id: "1.8-drop-parallel-toggle",
  since: "1.8.0",
  kind: "mechanical",
  title: "Remove build.max_parallel_epics (parallel mode retired in v1.8.0)",
  detect(ctx) {
    if (!ctx.exists(".specture/conventions.md") && !ctx.exists(".specture/settings.yml")) return "n/a";
    return offendingFiles(ctx).length > 0 ? "pending" : "done";
  },
  apply(ctx) {
    for (const rel of offendingFiles(ctx)) {
      const text = ctx.read(rel);
      const kept = lines(text).filter((l) => !TOGGLE_LINE.test(l));
      ctx.write(rel, kept.join(eolOf(text)));
    }
  },
  verify(ctx) {
    return offendingFiles(ctx).length === 0;
  }
};
