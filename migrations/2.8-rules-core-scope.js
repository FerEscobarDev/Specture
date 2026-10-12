const { eolOf } = require("./lib");
const { parseRulesYaml, CORE_RULES } = require("../hooks/lib/rules");

// v2.8.0 splits the v2.0 `R-FILE-003` ("interfaces, types, constants and hooks live outside the
// component or class file", tagged [all]) in two: `R-FILE-003` keeps interfaces and types for the
// whole project, and the new `R-FILE-004` [frontend, mobile] takes hooks and constants — with the
// exception the teams asked for: a constant that is not exported nor used in another file may stay
// in the component. In backend, constants may live in their class.
//
// The missing `R-FILE-004` is restored by `2.0-rules-core` (its detect reads `CORE_RULES`, so a
// project without the id is pending there and that migration appends it). This one only narrows
// the wording of `R-FILE-003`, and only when the project never touched it: the text must still be
// the literal v2.0 core text. A sharpened or translated rule is the team's — it is left alone
// (`done`), and the doctor's `rules-core-overlap` warns while it still demands constants or hooks
// outside the file. Tags, severity, comments and every other rule survive byte-for-byte.

const STACK = ".specture/stack.yml";
const RULES = ".specture/rules.yml";
const ID = "R-FILE-003";

const LEGACY = {
  rule: "Interfaces, types, constantes y hooks/composables viven fuera del archivo del componente o de la clase, en la ubicación que declara conventions.md §2.",
  verify: "el archivo de un componente o clase no exporta types, interfaces, constantes ni hooks; están en la ruta del mapa de §2"
};
const CURRENT = CORE_RULES.find((r) => r.id === ID);

const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

function blockEnd(all, startIndex) {
  for (let i = startIndex + 1; i < all.length; i++) {
    if (/^\s*-\s+id\s*:/.test(all[i])) return i - 1;
    if (!/^\s/.test(all[i]) && all[i].trim() !== "") return i - 1;
  }
  return all.length - 1;
}

// "legacy" | "current" | "edited" | "absent" | "unparseable" | "n/a"
function state(ctx) {
  if (ctx.read(STACK) === null) return { kind: "n/a" };
  const text = ctx.read(RULES);
  if (text === null) return { kind: "n/a" };
  let parsed;
  try {
    parsed = parseRulesYaml(text);
  } catch {
    return { kind: "unparseable" };
  }
  const rule = parsed.rules.find((r) => r.id === ID);
  if (!rule) return { kind: "absent" };
  const isLegacy = normalize(rule.rule) === normalize(LEGACY.rule);
  if (isLegacy) return { kind: "legacy", rule, text };
  if (normalize(rule.rule) === normalize(CURRENT.rule)) return { kind: "current" };
  return { kind: "edited" };
}

function replaceKey(all, start, end, key, value) {
  const pattern = new RegExp(`^(\\s*${key}\\s*:\\s*).*$`);
  for (let i = start; i <= end; i++) {
    const m = all[i].match(pattern);
    if (m) {
      all[i] = `${m[1]}${JSON.stringify(value)}`;
      return true;
    }
  }
  return false;
}

module.exports = {
  id: "2.8-rules-core-scope",
  since: "2.8.0",
  kind: "mechanical",
  title: "`.specture/rules.yml`: narrow `R-FILE-003` to interfaces and types (hooks and shared constants moved to `R-FILE-004`, frontend/mobile)",
  detect(ctx) {
    const s = state(ctx);
    if (s.kind === "legacy") return "pending";
    if (s.kind === "current" || s.kind === "edited") return "done";
    // No file, no id (2.0-rules-core restores it with the new text) or a broken file (the doctor
    // reports `rules-schema`; not ours to rewrite).
    return "n/a";
  },
  apply(ctx) {
    const s = state(ctx);
    // `edited` is `done` for detect(), so the runner never reaches apply() for it: a wording the
    // team adapted is the doctor's business (`rules-core-overlap`), not a migration's.
    if (s.kind !== "legacy") return { notes: [] };

    const eol = eolOf(s.text);
    const all = s.text.replace(/\r\n/g, "\n").split("\n");
    const start = (s.rule._line || 0) - 1;
    if (start < 0 || !/^\s*-\s+id\s*:/.test(all[start] || "")) {
      return { notes: [`${ID}: could not locate its block in ${RULES}; nothing was written.`] };
    }
    const end = blockEnd(all, start);
    replaceKey(all, start, end, "rule", CURRENT.rule);
    if (normalize(s.rule.verify) === normalize(LEGACY.verify)) replaceKey(all, start, end, "verify", CURRENT.verify);
    ctx.write(RULES, all.join("\n").replace(/\n/g, eol));
    return { notes: [`${ID} narrowed to interfaces and types in ${RULES}; hooks and shared constants are now \`R-FILE-004\` [frontend, mobile] (a local, non-exported constant may stay in the component). Tags and severity were not touched.`] };
  },
  verify(ctx) {
    const s = state(ctx);
    return s.kind !== "legacy" && s.kind !== "unparseable";
  }
};
