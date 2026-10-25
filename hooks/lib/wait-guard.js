// Wait guard (v2.9.0) — classifies a shell command that WAITS instead of working.
//
// Measured on a real batch (Psikora HC-IHCE.14, 2026-10-14): the epic-agent polled its workers
// with `sleep 90; echo tick` and `until grep -q DONE …; do sleep 20; done` (34 turns, 222 of its
// 510 minutes), the coordinator set itself a clock with `sleep 3060` (a "55-minute cutoff" no
// rule ever defined) and the implementer slept between test runs. Each of those turns re-reads
// the agent's whole context (200K–600K tokens) and, after five minutes, pays a full cache
// rewrite. The framework's rule has been there since v2.7.0 ("wait for the notification; never
// poll"); this module makes it mechanical.
//
//   classifyWait(command) → null (fine) | { kind, reason }
//
// Denied:
//   - a plain sleep of 30 s or more: `sleep 90`, `sleep 2m`, `Start-Sleep -Seconds 300`,
//     `Start-Sleep -Minutes 5`, cmd.exe `timeout /t 60`, bash `read -t 60 <> <(:)`
//   - ANY sleep inside a loop (`for | while | until … sleep …`), whatever the number: that is a
//     poll by construction. `read -t N` counts as a sleep: Psikora HC-IHCE.17 (2026-10-23) polled
//     its run logs with `until grep -q 'exit:' …; do read -t 20 <> <(:); done` once `sleep` was denied
// Allowed: a sleep under 30 s outside a loop (a port that needs a second to open), and
// coreutils `timeout 590 <cmd>` — a time LIMIT on real work is not a wait.

const READ_T = String.raw`(?:^|[\s;&|(\x60"'])read\s[^;\n|&]*?-[a-zA-Z]*t\s*(\d+(?:\.\d+)?)`;
const LOOP = new RegExp(String.raw`\b(for|while|until|foreach)\b[^\n]*\b(do|\{)\b[\s\S]*?(\b(sleep|Start-Sleep)\b|${READ_T})`, "i");
const SLEEP = /(?:^|[\s;&|(`])sleep\s+(\d+(?:\.\d+)?)\s*([smhd])?\b/gi;
const READ_SLEEP = new RegExp(READ_T, "gi");
const PS_SLEEP = /\bStart-Sleep\b([^\n;|&]*)/gi;
const CMD_TIMEOUT = /\btimeout\s+\/t\s+(\d+)/gi;
const THRESHOLD_SECONDS = 30;

function seconds(value, unit) {
  const n = Number(value);
  switch ((unit || "s").toLowerCase()) {
    case "m": return n * 60;
    case "h": return n * 3600;
    case "d": return n * 86400;
    default: return n;
  }
}

function psSeconds(args) {
  const named = args.match(/-(Seconds|s|Milliseconds|ms|Minutes|m|Hours|h)\s+(\d+(?:\.\d+)?)/i);
  if (named) {
    const unit = named[1].toLowerCase();
    const n = Number(named[2]);
    if (unit.startsWith("mi") || unit === "ms") return unit === "ms" || unit === "milliseconds" ? n / 1000 : n * 60;
    if (unit.startsWith("h")) return n * 3600;
    if (unit === "m") return n * 60;
    return n;
  }
  const positional = args.match(/^\s+(\d+(?:\.\d+)?)/);
  return positional ? Number(positional[1]) : THRESHOLD_SECONDS; // a bare `Start-Sleep` is a wait
}

function classifyWait(command) {
  const text = String(command || "");
  if (!text.trim()) return null;

  if (LOOP.test(text)) {
    return { kind: "poll", reason: "a loop around `sleep` (or `read -t`) is polling: the command waits for something else to happen instead of doing work" };
  }

  let longest = 0;
  for (const m of text.matchAll(SLEEP)) longest = Math.max(longest, seconds(m[1], m[2]));
  for (const m of text.matchAll(READ_SLEEP)) longest = Math.max(longest, Number(m[1]));
  for (const m of text.matchAll(PS_SLEEP)) longest = Math.max(longest, psSeconds(m[1] || ""));
  for (const m of text.matchAll(CMD_TIMEOUT)) longest = Math.max(longest, Number(m[1]));
  if (longest >= THRESHOLD_SECONDS) {
    return { kind: "sleep", reason: `a sleep of ${Math.round(longest)} s is a wait, not work` };
  }
  return null;
}

// The reason the hook returns — names the rule and the recovery path, never just "denied".
function denyReason(command, hit) {
  const shown = String(command).replace(/\s+/g, " ").trim().slice(0, 120);
  return (
    `Specture wait guard: \`${shown}\` — ${hit.reason}. ` +
    "Every waiting turn re-reads your whole context and, after five minutes, pays a full cache rewrite. " +
    "Dispatch the work and wait for its result: a foreground Agent call returns when the worker finishes; " +
    "a background Bash returns through its notification (or the Monitor tool). Never sleep, never poll, and never " +
    "set yourself a clock budget — no Specture dispatch has a time limit (build/EPIC_COORDINATOR.md, build/EPIC_LOOP.md). " +
    "Switch it off only by project decision: `hooks.enabled: false` in .specture/settings.yml."
  );
}

module.exports = { classifyWait, denyReason, THRESHOLD_SECONDS };
