// Review checks — the review stage of `build` (v2.3.0): the batch registers under
// docs/05-specs/_reviews/ (grammar in templates/BATCH_REVIEW_TEMPLATE.md, procedure in
// skills/build/REVIEW_STAGE.md) and the `**Aparcado:**` lines of the ROADMAP. Every finding:
// { severity, group: "review", check, file, detail, action }.
//
//   review-open         WARNING  the current register (hooks/lib/review.js: the last by name whose
//                                ESTADO is not EJECUTADA) is PREPARANDO / RONDA-1 / RONDA-2 — a
//                                sitting of decisions was left halfway
//   review-scope-drift  WARNING  an epic of a CERRADA register, neither [x] nor parked, whose
//                                planning.scopeHash no longer matches its `## SCOPE` line (the epic
//                                block or a linked RN changed after the review), or that has no
//                                SCOPE line at all. Each epic answers to the LAST register that
//                                lists it: one re-reviewed in a later batch is judged by that one,
//                                and not at all while that one is open or malformed
//   epic-parked         INFO     an epic [ ] with a `**Aparcado:**` line: a decision waits for the
//                                next sitting
//   parked-orphan       WARNING  a `**Aparcado:**` line on an epic [/] or [x] (parking sets the epic
//                                back to [ ]), one that names no batch, or one whose batch has no
//                                register in _reviews/
//   review-malformed    WARNING  a register whose parse has errors (missing ID / ESTADO / EPICS, a
//                                malformed A-n / F-n / PR-n / SCOPE / APARCADOS / EJECUCIÓN line), or
//                                a `.md` in _reviews/ outside the `<YYYY-MM-DD>-<slug>.md` naming,
//                                which review.js never reads
//
// A project without _reviews/ and without `**Aparcado:**` lines produces nothing.

const { REVIEWS_DIR, listRegisters, currentRegister, compareScopes } = require("../../review");
const { parseRoadmapEpics } = require("../../planning");

const ROADMAP = "docs/04-roadmap/ROADMAP.md";
const REQUIREMENTS = "docs/01-requirements/business_requirements.md";
const OPEN_ESTADOS = ["PREPARANDO", "RONDA-1", "RONDA-2"];
const STATE_MARK = { pending: "[ ]", "in-progress": "[/]", done: "[x]" };

function finding(severity, check, file, detail, action) {
  return { severity, group: "review", check, file, detail, action };
}

function open(registers) {
  const current = currentRegister(registers);
  if (!current || !OPEN_ESTADOS.includes(current.review.estado)) return [];
  const { review, file } = current;
  const pending = review.agenda.filter((a) => a.respuesta === null).length;
  return [
    finding(
      "WARNING",
      "review-open",
      file,
      `la revisión de la tanda ${review.id} quedó en ${review.estado} con ${pending} pendiente(s) en la AGENDA — la cola no ejecuta sus epics hasta cerrarla`,
      `retomar con /specture:start (la etapa de revisión reanuda desde ${review.estado} sin volver a preguntar lo ya respondido)`
    )
  ];
}

// Only epics of the ROADMAP that are neither [x] nor parked ([ ] with `**Aparcado:**`) are judged.
function scopeDrift(project, registers, roadmapEpics) {
  const latest = new Map(); // epic id → the last register (by name) that lists it
  for (const register of registers) for (const id of register.review.epics) latest.set(id, register);
  const requirementsText = project.read(REQUIREMENTS);
  const out = [];
  for (const [id, register] of latest) {
    const { review, file } = register;
    if (review.errors.length > 0 || review.estado !== "CERRADA") continue;
    const epic = roadmapEpics.find((e) => e.id === id);
    if (epic && (epic.state === "done" || (epic.state === "pending" && epic.parked))) continue;
    const [cmp] = compareScopes(review, project.roadmapText, requirementsText, [id]);
    if (cmp.status === "SAME") continue;
    const where = `epic ${id} (tanda ${review.id})`;
    if (cmp.status === "MISSING") {
      out.push(
        finding(
          "WARNING",
          "review-scope-drift",
          file,
          `${where}: sin línea SCOPE en el registro CERRADA — no se puede saber si su alcance cambió desde la revisión`,
          `re-revisar ese epic antes de ejecutarlo; si su alcance no cambió, registrar la huella con \`review.js scope-hash --epic ${id}\` en \`## SCOPE\``
        )
      );
      continue;
    }
    const detail = cmp.current === null
      ? `${where}: SCOPE ${cmp.recorded} → ausente — el epic ya no está en el ROADMAP`
      : `${where}: SCOPE ${cmp.recorded} → ${cmp.current} — el bloque del epic o una RN vinculada cambió después del cierre de la revisión`;
    out.push(finding("WARNING", "review-scope-drift", file, detail, "re-revisar ese epic antes de ejecutarlo (sus decisiones se tomaron sobre otro alcance): una revisión nueva lo incluye, o se aparca"));
  }
  return out;
}

function parked(roadmapEpics, registers) {
  const out = [];
  for (const epic of roadmapEpics) {
    if (!epic.parked) continue;
    const p = epic.parked;
    const decision = [p.clase, p.motivo].filter(Boolean).join(" — ") || "sin clase ni motivo";
    if (epic.state === "pending") {
      out.push(
        finding(
          "INFO",
          "epic-parked",
          ROADMAP,
          `epic ${epic.id} aparcado${p.ts ? ` el ${p.ts}` : ""}${p.tanda ? ` (tanda ${p.tanda})` : ""}: decisión pendiente: ${decision}`,
          "llevar la decisión a la próxima sesión de revisión (/specture:start la abre cuando la tanda actual se drena); decidida, quitar la línea `**Aparcado:**` y el epic vuelve a la cola"
        )
      );
    }
    const reasons = [];
    if (epic.state !== "pending") reasons.push(`está ${STATE_MARK[epic.state]} con una línea \`**Aparcado:**\` — aparcar devuelve el epic a [ ]`);
    if (!p.tanda) reasons.push("la línea `**Aparcado:**` no nombra su tanda (`<ISO-8601> — <clase> — <motivo> — tanda <id>`)");
    else if (!registers.some((r) => r.review.id === p.tanda || r.name === `${p.tanda}.md`)) reasons.push(`la línea \`**Aparcado:**\` nombra la tanda ${p.tanda}, que no tiene registro en ${REVIEWS_DIR}/`);
    if (reasons.length === 0) continue;
    const action = epic.state !== "pending"
      ? "si la decisión ya se tomó, quitar la línea `**Aparcado:**`; si no, volver el epic a [ ] (build/SKILL.md «Parked epics»)"
      : "completar la línea con la tanda cuyo registro anota el aparcamiento (`## APARCADOS`), o quitarla si la decisión ya se tomó";
    out.push(finding("WARNING", "parked-orphan", ROADMAP, `epic ${epic.id}: ${reasons.join("; ")}`, action));
  }
  return out;
}

function malformed(project, registers) {
  const current = currentRegister(registers);
  const out = [];
  for (const register of registers) {
    if (register.review.errors.length === 0) continue;
    const consequence = register === current
      ? "mientras tanto `review.js status` responde UNVERIFIABLE y la cola no avanza"
      : "si no, `review.js scope-check --batch` sobre esa tanda responde UNVERIFIABLE";
    out.push(finding("WARNING", "review-malformed", register.file, `registro mal formado: ${register.review.errors.join(" · ")}`, `corregir el registro según templates/BATCH_REVIEW_TEMPLATE.md — ${consequence}`));
  }
  // `.md` files directly under _reviews/ that review.js skips (it only reads the dated names).
  const read = new Set(registers.map((r) => r.file));
  for (const rel of project.files) {
    if (!rel.startsWith(`${REVIEWS_DIR}/`) || !rel.endsWith(".md") || rel.slice(REVIEWS_DIR.length + 1).includes("/") || read.has(rel)) continue;
    out.push(
      finding(
        "WARNING",
        "review-malformed",
        rel,
        "nombre fuera del formato `<YYYY-MM-DD>-<slug>.md`: `review.js` no lo lee, así que ni `status` ni el doctor lo ven como registro",
        "renombrarlo a `<YYYY-MM-DD>-<slug>.md` (fecha de apertura de la tanda) o sacarlo de `_reviews/`"
      )
    );
  }
  return out;
}

function run(project) {
  const registers = listRegisters(project.root);
  const roadmapEpics = project.roadmapText === null ? null : parseRoadmapEpics(project.roadmapText);
  return [
    ...open(registers),
    ...(roadmapEpics ? scopeDrift(project, registers, roadmapEpics) : []),
    ...(roadmapEpics ? parked(roadmapEpics, registers) : []),
    ...malformed(project, registers)
  ];
}

module.exports = { run };
