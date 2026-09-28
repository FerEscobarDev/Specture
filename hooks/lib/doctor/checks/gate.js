// Gate checks — what a project still carries from the v2.1 Spec Planning Gate once v2.2.0 is
// installed. Every finding: { severity, group: "gate", check, file, detail, action }.
//
//   gate-legacy-rejection     WARNING  an epic [/] whose last verdict for a target in its
//                                      `_planning.md` is REJECTED over supersessions (Dim 4 /
//                                      Coherencia: "Supersede", "supersesi…", "sellados") with no
//                                      APPROVED after it. v2.1 rejected an incomplete supersession
//                                      list in the gate; v2.2 resolves it in execution, so that
//                                      verdict no longer holds the epic back — re-validate it
//   claude-md-gate-overrides  INFO     the project's CLAUDE.md still carries the temporary
//                                      "Spec Planning Gate — instrucciones temporales" block the
//                                      user wrote for v2.1; v2.2.0 ships what it asked for
//
// "Last" is document order: `## VEREDICTOS` is append-only (the coordinator adds one block per
// dispatch), exactly as the last `MECH_CHECK:` line is the one in force.

const { lines } = require("../project");
const { parseVerdictHeaders } = require("../../planning");

const PLANNING = /^docs\/05-specs\/([^/_][^/]*)\/_planning\.md$/;
const STATUS = /STATUS:\s*\**\s*(APPROVED|REJECTED|BLOCKED)\b/;
// "Supersede" as a word (an ADR "Superseded by …" is another matter), supersesión/supersession,
// tests sellados / sealed tests — the validator writes either language.
const SUPERSESSION = /\bsupersede\b|superses+i|sellad[oa]s?\b|sealed\s+tests?/i;
const WARNING_ONLY = /(?:Severity|Severidad)\s*:\s*\**\s*WARNING\b/i;
const CLAUDE_MD = ["CLAUDE.md", ".claude/CLAUDE.md"];

function finding(severity, check, file, detail, action) {
  return { severity, group: "gate", check, file, detail, action };
}

function slug(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Spec directories follow `epic-<X.Y>-<name>`; brownfield roadmaps also use `<id>-<name>`
// (`HC-IHCE.5` → `hc-ihce-5-…`). Both compare on the slugged id followed by `-` or the end.
function dirBelongsTo(dir, epicId) {
  const id = slug(epicId);
  if (!id) return false;
  const name = slug(dir);
  return [id, `epic-${id}`].some((prefix) => name === prefix || name.startsWith(`${prefix}-`));
}

// Every `### <target> — dispatch N …` block with its body, up to the next heading outside a
// code fence (verdicts are pasted verbatim, usually fenced).
function verdictBlocks(text) {
  const blocks = [];
  let current = null;
  let fenced = false;
  for (const line of lines(text)) {
    if (!fenced) {
      const [header] = parseVerdictHeaders(line);
      if (header) {
        current = { ...header, body: [] };
        blocks.push(current);
        continue;
      }
      if (/^#{1,3}\s/.test(line)) {
        current = null;
        continue;
      }
    }
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (current) current.body.push(line);
  }
  return blocks.map((b) => {
    const status = b.body.map((l) => l.match(STATUS)).find(Boolean);
    return { ...b, status: status ? status[1] : null };
  });
}

// The violation entries of a verdict body that are not WARNING-only: the top-level bullets of
// its VIOLATIONS block (the whole body when the label is absent) up to NOTES, each with its
// indented continuation. A body with no bullets counts as one entry.
function blockingViolations(body) {
  const start = body.findIndex((l) => /^\s*VIOLATIONS\s*:/i.test(l));
  let block = start === -1 ? body : body.slice(start + 1);
  const notes = block.findIndex((l) => /^\s*NOTES\s*:/i.test(l));
  if (notes !== -1) block = block.slice(0, notes);
  block = block.filter((l) => l.trim() !== "" && !/^\s*```/.test(l));
  const bullets = block.filter((l) => /^\s*-\s+\S/.test(l));
  if (bullets.length === 0) return block.length === 0 ? [] : [block.join("\n")];
  const indent = Math.min(...bullets.map((l) => l.match(/^\s*/)[0].length));
  const entries = [];
  for (const line of block) {
    const bullet = line.match(/^(\s*)-\s+\S/);
    if (bullet && bullet[1].length === indent) entries.push([line]);
    else if (entries.length > 0) entries[entries.length - 1].push(line);
  }
  return entries.map((e) => e.join("\n")).filter((e) => !WARNING_ONLY.test(e));
}

function legacyRejections(project) {
  if (!project.roadmap) return [];
  const inProgress = project.roadmap.epics.filter((e) => e.state === "in-progress" && e.id);
  if (inProgress.length === 0) return [];
  const out = [];
  for (const rel of project.files) {
    const m = rel.match(PLANNING);
    if (!m) continue;
    const epic = inProgress.find((e) => dirBelongsTo(m[1], e.id));
    if (!epic) continue;
    const last = new Map();
    for (const block of verdictBlocks(project.read(rel) || "")) last.set(block.target, block);
    const stuck = [...last.values()].filter((v) => v.status === "REJECTED" && blockingViolations(v.body).some((e) => SUPERSESSION.test(e)));
    if (stuck.length === 0) continue;
    out.push(
      finding(
        "WARNING",
        "gate-legacy-rejection",
        rel,
        `epic ${epic.id} [/]: último veredicto REJECTED por supersesiones sin APPROVED posterior — ${stuck.map((v) => `${v.target} (dispatch ${v.dispatch})`).join(", ")}; desde v2.2 la completitud de la lista de supersesiones no es criterio de rechazo del gate`,
        "re-validar bajo v2.2 (re-validación delta)"
      )
    );
  }
  return out;
}

function claudeMdOverrides(project) {
  return CLAUDE_MD.filter((rel) => {
    const text = project.read(rel);
    return text !== null && /instrucciones temporales/i.test(text) && /Spec Planning Gate/i.test(text);
  }).map((rel) =>
    finding("INFO", "claude-md-gate-overrides", rel, "contiene el bloque «Spec Planning Gate — instrucciones temporales» escrito para v2.1", "retirar el bloque temporal: v2.2.0 lo incorpora")
  );
}

function run(project) {
  return [...legacyRejections(project), ...claudeMdOverrides(project)];
}

module.exports = { run };
