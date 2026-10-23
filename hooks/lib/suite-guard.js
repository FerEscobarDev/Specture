// Suite guard (v3.2.0) — classifies a shell command that runs the FULL test suite out of phase.
//
// Measured on a real spec (Psikora HC-IHCE.17/01, 2026-10-22): the implementer ran a 15-minute
// integration filter although its manifest said `test_scoped`, and the epic-agent ran the
// 21-minute suite twice in Step 7. The rule has been textual since v2.9.0 ("the full suite runs
// only at the baseline and at Step 7"); this module makes it mechanical. The seal carries the
// execution phase (`seal-cli.js phase --set …`): the command of `quality.commands.test` is denied
// while the phase is anything but `baseline` (Step 3.9) or `verify` (Step 6/7).
//
//   classifyFullSuite({ command, seal, quality }) → null (fine) | { kind: "full-suite", phase, matched }
//
// Fail open, like every gate: no seal, a corrupt seal, a seal without `phase`, a `test` slot
// `sin definir` / `none` → null. What makes a command "the full suite":
//   - the sanctioned CLI itself: `quality.js run test` / `quality.js expand test` (a bypass otherwise);
//   - the declared `test` command as a whole word sequence, UNLESS the command also carries what
//     distinguishes `test_scoped` from it — a token of `test_scoped` absent from `test` (`--filter`,
//     `--tests`, …) or, when `test_scoped` is only `test` + placeholders (`pytest -q {files}`), a
//     path-like argument right after the match.
// `test` identical to `test_scoped` cannot be told apart: denied, and the reason says to declare a
// distinguishing `test_scoped`.

const { SUITE_PHASES } = require("./seal");

const CLI_FULL = /quality\.js["']?\s+(?:run|expand)\s+test(?![\w-])/i;
const PLACEHOLDERS = /\{files\}|\{names\}/g;
const SHELL_SPLIT = /\s*(?:&&|\|\||;|\|)\s*/;
const GLUE = /^[|&;()$`'"<>]*$/;

function normalize(command) {
  return String(command || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokens(command) {
  return normalize(command)
    .replace(PLACEHOLDERS, " ")
    .split(" ")
    .map((t) => t.replace(/^[("'`$]+|[)"'`]+$/g, ""))
    .filter((t) => t.length >= 2 && !GLUE.test(t));
}

// The tokens of `test_scoped` that `test` lacks — what a scoped run carries that the suite does not.
function distinguishingTokens(test, scoped) {
  const base = new Set(tokens(test));
  return [...new Set(tokens(scoped).filter((t) => !base.has(t)))];
}

function matchFull(command, test) {
  const re = new RegExp(`(?:^|[\\s;&|(])${escapeRegExp(test)}(?=$|[\\s;&|)])`, "i");
  const m = re.exec(command);
  return m ? { index: m.index + m[0].length - test.length, end: m.index + m[0].length } : null;
}

function hit(phase, matched, note) {
  return { kind: "full-suite", phase, matched, note: note || null };
}

function classifyFullSuite({ command, seal, quality }) {
  if (!seal || seal.corrupt || !seal.phase) return null;
  if (SUITE_PHASES.includes(seal.phase)) return null;
  const cmd = normalize(command);
  if (!cmd) return null;
  if (CLI_FULL.test(cmd)) return hit(seal.phase, "quality.js run|expand test");
  const test = quality && quality.commands ? quality.commands.test : null;
  if (!test) return null;
  const t = normalize(test);
  const at = matchFull(cmd, t);
  if (!at) return null;
  const scoped = quality.commands.test_scoped ? normalize(quality.commands.test_scoped) : null;
  if (scoped && scoped !== t) {
    const distinct = distinguishingTokens(t, scoped);
    if (distinct.length > 0) {
      if (distinct.some((tok) => cmd.includes(tok))) return null;
    } else {
      // `test_scoped` = `test` + placeholders: a path-like argument after the match is the scope.
      const rest = cmd.slice(at.end).split(SHELL_SPLIT)[0];
      if (/(?:^|\s)\S*(?:\/|\\|\.[A-Za-z0-9]+)\S*/.test(rest)) return null;
    }
    return hit(seal.phase, t);
  }
  return hit(seal.phase, t, scoped === t ? "test_scoped is identical to test — declare a distinguishing test_scoped in stack.yml quality.commands" : "test_scoped sin definir");
}

// The reason the hook returns — names the phase, the rule and the recovery path.
function denyReason(command, found) {
  const shown = normalize(command).slice(0, 120);
  return (
    `Specture suite guard: \`${shown}\` runs the full suite (\`quality.commands.test\`: \`${found.matched}\`) while the epic is in phase \`${found.phase}\`. ` +
    "The full run belongs to Step 3.9 (phase baseline) and Step 7 (phase verify) only, and the epic-agent runs it with " +
    "`quality.js run test --log` and reads the log. Run `TEST_COMMAND` instead — `test_scoped` over the files under work " +
    "(`node \"${CLAUDE_PLUGIN_ROOT}/hooks/lib/quality.js\" expand test_scoped --files …`). If you are the epic-agent at Step 3.9 or Step 7, " +
    "set the phase first: `seal-cli.js phase --set baseline|verify`. " +
    (found.note ? `Note: ${found.note}. ` : "") +
    "Switch it off only by project decision: `hooks.enabled: false` in .specture/settings.yml (build/EPIC_LOOP.md)."
  );
}

module.exports = { classifyFullSuite, denyReason, distinguishingTokens, normalize };
