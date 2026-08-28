const { lines } = require("../hooks/lib/doctor/project");
const { eolOf } = require("./lib");

const CONVENTIONS = ".specture/conventions.md";
const SETTINGS = ".specture/settings.yml";
const LEARN = /^(\s*-?\s*\*{0,2})learn\.enabled(\*{0,2}\s*:.*)$/;
const PROFILE_CONV = /^\s*-\s*\*{0,2}specture\.profile\*{0,2}\s*:/m;
const PROFILE_SETTINGS = /^profile\s*:/m;
const TOGGLE_CONV = /^\s*-\s*\*{0,2}(hooks|context7|docs_index|knowledge|learn)\.enabled\*{0,2}\s*:/m;

function state(ctx) {
  const settings = ctx.read(SETTINGS);
  if (settings !== null) {
    return {
      file: SETTINGS,
      text: settings,
      hasLearn: lines(settings).some((l) => LEARN.test(l)),
      missingProfile: !PROFILE_SETTINGS.test(settings)
    };
  }
  const conventions = ctx.read(CONVENTIONS);
  if (conventions === null) return null;
  return {
    file: CONVENTIONS,
    text: conventions,
    hasLearn: lines(conventions).some((l) => LEARN.test(l)),
    missingProfile: TOGGLE_CONV.test(conventions) && !PROFILE_CONV.test(conventions)
  };
}

module.exports = {
  id: "1.11-profile-and-knowledge",
  since: "1.11.0",
  kind: "mechanical",
  title: "learn.enabled → knowledge.enabled; explicit profile (lean | full | custom)",
  detect(ctx) {
    const s = state(ctx);
    if (!s) return "n/a";
    return s.hasLearn || s.missingProfile ? "pending" : "done";
  },
  apply(ctx) {
    const s = state(ctx);
    if (!s) return;
    const eol = eolOf(s.text);
    let out = lines(s.text).map((l) => l.replace(LEARN, "$1knowledge.enabled$2"));
    if (s.missingProfile) {
      if (s.file === SETTINGS) {
        out.unshift("profile: custom");
      } else {
        const idx = out.findIndex((l) => TOGGLE_CONV.test(l));
        out.splice(idx, 0, "- **specture.profile**: custom   # lean | full | custom — added by migration 1.11-profile-and-knowledge");
      }
    }
    ctx.write(s.file, out.join(eol));
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  }
};
