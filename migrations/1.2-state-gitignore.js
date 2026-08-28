const { hasGitignoreEntry, ensureGitignoreEntry } = require("./lib");

module.exports = {
  id: "1.2-state-gitignore",
  since: "1.2.0",
  kind: "mechanical",
  title: "Ignore .specture/state/ (hook runtime state) in .gitignore",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    return hasGitignoreEntry(ctx, ".specture/state/") ? "done" : "pending";
  },
  apply(ctx) {
    ensureGitignoreEntry(ctx, ".specture/state/", "Specture runtime state (build-locked.json) — never commit");
  },
  verify(ctx) {
    return hasGitignoreEntry(ctx, ".specture/state/");
  }
};
