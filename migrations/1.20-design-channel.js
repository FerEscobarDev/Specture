// 1.20-design-channel — mechanical.
//
// Records which design channel a project already uses, in `stack.yml` `frontend.design_channel`,
// by detecting it from files that are already on disk. Before v1.20.0 the framework had zero
// integration with any design surface (`grep DesignSync|dc.html|claude.ai/design` returned
// nothing), so projects that were working against one were doing it by hand and the framework
// could not tell.
//
// The key lives in `stack.yml`, not `settings.yml`: `settings.yml` is framework-owned and its
// values are filtered per profile — `effectiveValues()` does not walk the toggle list in the
// profile branch, so a key with no `PROFILES` entry is unreachable under `lean`/`full`, the
// two recommended profiles, and fails silently. `stack.yml` belongs to the user and no profile
// filters it.

const { stackField } = require("../hooks/lib/doctor/project");

const STACK = ".specture/stack.yml";
const CHANNELS = ["claude-design", "canvas", "none"];

function hasFrontend(stackText) {
  const framework = (stackField(stackText, "frontend", "framework") || "").replace(/["'`]/g, "").trim().toLowerCase();
  if (framework === "" || framework === "none" || framework === "null") return false;
  return !/^\[/.test(framework);
}

function declared(stackText) {
  const value = (stackField(stackText, "frontend", "design_channel") || "").replace(/["'`]/g, "").trim().toLowerCase();
  return CHANNELS.includes(value) ? value : null;
}

// The signals, in order of strength. Each one is something a project that works against a
// channel actually leaves on disk.
function detectChannel(ctx) {
  if (ctx.exists(".design-sync/config.json")) return "claude-design";
  const mirror = "docs/03-ux-ui/handoff/README.md";
  if (ctx.exists(mirror) && /claude\.ai\/design|DesignSync/i.test(ctx.read(mirror) || "")) return "claude-design";
  const uxFiles = ctx.list("docs/03-ux-ui") || [];
  if (uxFiles.some((f) => /\.dc\.html$/i.test(f))) return "canvas";
  return "none";
}

// The remote project id, when `.design-sync/config.json` carries one. Best-effort: the file is
// written by an external tool and its shape is not ours to depend on.
function detectProjectId(ctx) {
  if (!ctx.exists(".design-sync/config.json")) return null;
  try {
    const config = JSON.parse(ctx.read(".design-sync/config.json") || "{}");
    return config.projectId || config.project?.id || config.project || null;
  } catch {
    return null;
  }
}

module.exports = {
  id: "1.20-design-channel",
  since: "1.20.0",
  kind: "mechanical",
  title: "Record the design channel in stack.yml frontend.design_channel (detected from the project)",
  detect(ctx) {
    if (!ctx.exists(STACK)) return "n/a";
    const stackText = ctx.read(STACK) || "";
    if (!hasFrontend(stackText)) return "n/a";
    return declared(stackText) ? "done" : "pending";
  },
  apply(ctx) {
    const stackText = ctx.read(STACK) || "";
    if (declared(stackText)) return { notes: [] }; // already recorded — idempotent
    const channel = detectChannel(ctx);
    const projectId = channel === "claude-design" ? detectProjectId(ctx) : null;
    const eol = /\r\n/.test(stackText) ? "\r\n" : "\n";
    const lines = stackText.split(/\r?\n/);

    // Insert right after `ui_defined` inside the `frontend:` block, or at the end of that block.
    let insertAt = -1;
    let inFrontend = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^frontend\s*:/.test(lines[i])) {
        inFrontend = true;
        insertAt = i + 1;
        continue;
      }
      if (!inFrontend) continue;
      if (/^\S/.test(lines[i]) && lines[i].trim() !== "") break; // left the block
      if (lines[i].trim() !== "") insertAt = i + 1;
    }
    if (insertAt === -1) return { notes: ["`stack.yml` no declara un bloque `frontend:` — nada que registrar"] };

    const added = [`  design_channel: "${channel}"   # claude-design | canvas | none — detectado por la migración 1.20`];
    if (projectId) added.push(`  design_project_id: "${projectId}"`);
    lines.splice(insertAt, 0, ...added);
    ctx.write(STACK, lines.join(eol));

    const why = {
      "claude-design": ctx.exists(".design-sync/config.json") ? "`.design-sync/config.json`" : "el README del espejo en `docs/03-ux-ui/handoff/`",
      canvas: "un artboard `*.dc.html` en `docs/03-ux-ui/`",
      none: "ninguna señal de canal externo"
    }[channel];
    return { notes: [`canal detectado: \`${channel}\` (señal: ${why})${projectId ? ` · projectId \`${projectId}\`` : ""}`] };
  },
  verify(ctx) {
    return declared(ctx.read(STACK) || "") !== null;
  }
};
