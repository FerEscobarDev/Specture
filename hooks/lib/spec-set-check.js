#!/usr/bin/env node
// Spec Planning Gate — step 4a: mechanical checks over the SET of specs of one epic.
//
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/spec-set-check.js" <epic-dir> [<epic-block-file>]
//        [--roadmap docs/04-roadmap/ROADMAP.md --epic <X.Y>] [--json] [--hash-only] [--allowed-paths]
//
// Inputs: <epic-dir>/_planning.md (COVERAGE_TABLE — grammar in templates/PLANNING_TEMPLATE.md),
// the epic block (a file with the block, or extracted from the ROADMAP with --roadmap/--epic)
// and every <epic-dir>/*.spec.md in lexical order. Every table row is cross-checked against
// the spec files, so a hand-written table cannot lie.
//
// Checks (framework roadmap item 29 / gate design §4.4):
//   C1  every operationId of the epic in exactly one spec (hole / overlap)    BLOCKER
//       C1-consume: a consumed op is implemented by another epic in [x]      BLOCKER
//   C-design  a `Tipo: pagina` epic requires the `Tipo: design-system` epic to record
//       VISUAL_APPROVAL in its `_planning.md` (never the `[x]` checkbox)        BLOCKER
//   C2  every RN-nnn linked by the epic is cited by >= 1 spec                  BLOCKER
//   C4  every `(planeada — re-anclar)` symbol is created by an EARLIER spec
//       with a string-identical signature                                     BLOCKER
//   C5  <= 3 specs; <= 15 AC/BR/EC per spec (proxy for "<= 3 commits")        WARNING
//   C6  no `sym: … consume` points at an earlier (or the same) spec           BLOCKER / WARNING
//   C-path  every `Crea:` / `Modifica:` line carries `en <path>`              BLOCKER
//   C-gap   migration epics: every GAP-nnn of the epic in exactly one spec    BLOCKER
//   C-sup   every `Supersede:` line has its `sup:` row, and the path exists   BLOCKER
//
// stdout: first line is the token — `MECH_CHECK: PASS <sha12>` | `MECH_CHECK: FAIL <sha12>` |
// `MECH_CHECK: UNVERIFIABLE <reason>`; then one `<check> <severity> <slug>: <detail>` per finding.
// Exit 0 = PASS (warnings allowed), 1 = FAIL (>= 1 BLOCKER), 2 = UNVERIFIABLE.
// `--hash-only` prints `MECH_CHECK: HASH <sha12>` without running the checks (the coordinator
// compares it with the last PASS token before committing). `--allowed-paths` prints the union
// of `Crea:`/`Modifica:` paths, one per line (item 36). The sha covers only the table rows.

const fs = require("fs");
const path = require("path");
const planning = require("./planning");
const { findProjectRoot } = require("./specture-guard");

const SEVERITY_ORDER = { BLOCKER: 0, WARNING: 1, INFO: 2 };
const MAX_SPECS = 3;
const MAX_IDS_PER_SPEC = 15;

function usage() {
  return "usage: spec-set-check.js <epic-dir> [<epic-block-file>] [--roadmap <ROADMAP.md> --epic <X.Y>] [--json] [--hash-only] [--allowed-paths]";
}

function parseArgs(argv) {
  const opts = { positional: [], json: false, hashOnly: false, allowedPaths: false, roadmap: null, epic: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--hash-only") opts.hashOnly = true;
    else if (arg === "--allowed-paths") opts.allowedPaths = true;
    else if (arg === "--roadmap") opts.roadmap = argv[++i];
    else if (arg === "--epic") opts.epic = argv[++i];
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}\n${usage()}`);
    else opts.positional.push(arg);
  }
  if (opts.positional.length === 0) throw new Error(usage());
  return opts;
}

function readFile(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function unverifiable(reason, extra = {}) {
  return { status: "UNVERIFIABLE", reason, sha: null, findings: [], specs: [], epic: null, ...extra };
}

function loadSpecs(epicDir) {
  return fs
    .readdirSync(epicDir)
    .filter((name) => name.endsWith(".spec.md"))
    .sort()
    .map((name) => planning.parseSpec(readFile(path.join(epicDir, name)) || "", name.replace(/\.spec\.md$/, "")));
}

function loadEpic(opts) {
  if (opts.positional[1]) {
    const text = readFile(path.resolve(opts.positional[1]));
    if (text === null) return { error: `epic block file not found: ${opts.positional[1]}` };
    return { epic: planning.parseEpicBlock(text), roadmapEpics: null };
  }
  if (opts.roadmap && opts.epic) {
    const text = readFile(path.resolve(opts.roadmap));
    if (text === null) return { error: `roadmap not found: ${opts.roadmap}` };
    const epic = planning.findEpicBlock(text, opts.epic);
    if (!epic) return { error: `epic ${opts.epic} not found in ${opts.roadmap}` };
    return { epic, roadmapEpics: planning.parseRoadmapEpics(text) };
  }
  return { error: "epic block not provided (pass <epic-block-file> or --roadmap <ROADMAP.md> --epic <X.Y>)" };
}

// Does the design-system epic `providerId` record a VISUAL_APPROVAL?
// null = its spec directory or `_planning.md` could not be read (not verifiable);
// true / false = the line is present / absent.
function visualApprovalOf(epicDir, providerId) {
  const specsRoot = path.dirname(path.resolve(epicDir));
  const wanted = String(providerId || "").trim();
  let entries;
  try {
    entries = fs.readdirSync(specsRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  const dir = entries.find((e) => {
    if (!e.isDirectory()) return false;
    const m = e.name.match(/^epic[-\s]*(\d+\.\d+)/i);
    return m ? m[1] === wanted : false;
  });
  if (!dir) return null;
  let text;
  try {
    text = fs.readFileSync(path.join(specsRoot, dir.name, "_planning.md"), "utf8");
  } catch {
    return null;
  }
  return planning.lastVisualApproval(text) !== null;
}

function runChecks({ table, specs, epic, roadmapEpics, epicDir }) {
  const findings = [];
  const add = (check, severity, slug, detail) => findings.push({ check, severity, slug: slug || "-", detail });
  const slugs = specs.map((s) => s.slug);
  const bySlug = Object.fromEntries(specs.map((s) => [s.slug, s]));
  const known = (slug) => Object.prototype.hasOwnProperty.call(bySlug, slug);
  const isMigration = Boolean(epic.template && /MIGRATION/i.test(epic.template));
  const rows = table.rows;

  // ---- C1 — operation coverage -------------------------------------------------------
  if (!epic.hasOperationsLine || epic.operations.length === 0) {
    add("C1", "INFO", null, "el epic no declara operaciones del contrato — C1 omitido");
  } else {
    const declared = new Set(epic.operations.map((o) => o.id));
    for (const op of epic.operations) {
      const opRows = rows.op.filter((r) => r.operationId === op.id);
      if (opRows.length === 0) {
        add("C1", "BLOCKER", null, `operationId \`${op.id}\` del epic no aparece en ningún spec (hueco)`);
        continue;
      }
      const implementers = opRows.filter((r) => r.mode === "implementa");
      if (implementers.length > 1) {
        add("C1", "BLOCKER", null, `operationId \`${op.id}\` implementado por ${implementers.length} specs (solapamiento): ${implementers.map((r) => r.slug).join(", ")}`);
      }
      for (const row of opRows) {
        if (row.mode !== op.mode) {
          add("C1", "BLOCKER", row.slug, `\`${op.id}\`: el epic la declara (${op.mode}) y la tabla (${row.mode})`);
        }
        if (!known(row.slug)) {
          add("C1", "BLOCKER", row.slug, `fila op: \`${op.id}\` → ${row.slug}: slug desconocido (specs: ${slugs.join(", ") || "ninguno"})`);
          continue;
        }
        const spec = bySlug[row.slug];
        if (!spec.operations.some((o) => o.id === op.id)) {
          add("C1", "BLOCKER", row.slug, `la tabla declara \`${op.id}\` pero el spec no la lista en "Operaciones del Contrato"`);
        }
      }
      if (op.mode === "consume") {
        if (!roadmapEpics) {
          add("C1", "INFO", null, `\`${op.id}\` (consume): sin --roadmap no se verifica que el epic backend esté [x]`);
        } else {
          const provider = roadmapEpics.find((e) => e.id !== epic.id && e.operations.some((o) => o.id === op.id && o.mode === "implementa"));
          if (!provider) add("C1", "BLOCKER", null, `\`${op.id}\` (consume): ningún otro epic la declara como implementada`);
          else if (provider.state !== "done") add("C1", "BLOCKER", null, `\`${op.id}\` (consume): el epic ${provider.id} que la implementa está ${provider.state}, no [x]`);
        }
      }
    }
    for (const row of rows.op) {
      if (!declared.has(row.operationId)) {
        add("C1", "WARNING", row.slug, `fila op: \`${row.operationId}\` no está en "Operaciones del contrato" del epic`);
      }
    }
  }

  // ---- C-design — the design system was visually approved before any page epic --------
  // Anchored on the VISUAL_APPROVAL record, never on the `[x]` checkbox: the epic-agent
  // writes the checkbox itself, so a checkbox proves nothing about the human gate.
  if (epic.hasTipoLine && epic.tipo === null) {
    add("C-design", "WARNING", null, `\`Tipo: ${String(epic.tipoRaw).trim()}\` no es un tipo conocido (${planning.EPIC_KINDS.join(" | ")}) — se trata como backend`);
  }
  if (epic.tipo !== "pagina") {
    // Only page epics are gated. Roadmaps without `Tipo:` never reach this branch.
  } else if (!roadmapEpics) {
    add("C-design", "INFO", null, "sin --roadmap no se verifica la aprobación visual del design system");
  } else {
    const providers = roadmapEpics.filter((e) => e.tipo === "design-system");
    if (providers.length === 0) {
      add("C-design", "INFO", null, "ningún epic declara `Tipo: design-system` — C-design omitido");
    } else {
      const provider = providers[0];
      const approval = visualApprovalOf(epicDir, provider.id);
      if (approval === null) {
        add("C-design", "BLOCKER", null, `no se encontró el \`_planning.md\` del epic ${provider.id} (design system): la aprobación visual no es verificable`);
      } else if (!approval) {
        add("C-design", "BLOCKER", null, `el epic ${provider.id} (design system) no registra \`VISUAL_APPROVAL\` en su \`_planning.md\`: el gate visual no ha pasado y ningún epic de página puede arrancar`);
      }
    }
  }

  // ---- C2 — business-rule coverage ----------------------------------------------------
  if (isMigration) {
    add("C2", "INFO", null, "epic de migración: filas br: opcionales — C2 omitido (el validator lo cubre por juicio)");
  } else if (!epic.hasRulesLine || epic.rules.length === 0) {
    add("C2", "INFO", null, "el epic no enlaza RN-nnn — C2 omitido");
  } else {
    for (const rn of epic.rules) {
      const brRows = rows.br.filter((r) => r.rule.includes(rn));
      if (brRows.length === 0) {
        add("C2", "BLOCKER", null, `${rn} enlazada por el epic no la cita ningún spec`);
        continue;
      }
      for (const row of brRows) {
        if (!known(row.slug)) add("C2", "BLOCKER", row.slug, `fila br: ${rn} → ${row.slug}: slug desconocido`);
        else if (!bySlug[row.slug].rules.includes(rn)) add("C2", "BLOCKER", row.slug, `la tabla declara ${rn} pero el spec no la cita`);
      }
    }
  }

  // ---- C4 — signature handoff ---------------------------------------------------------
  const planned = specs.flatMap((s) => s.plannedSymbols.map((p) => ({ spec: s, ...p })));
  if (planned.length === 0) {
    add("C4", "INFO", null, "ningún símbolo (planeada — re-anclar) — C4 sin trabajo");
  }
  for (const p of planned) {
    const row = rows.sym.find((r) => r.symbol === p.symbol);
    if (!row) {
      add("C4", "BLOCKER", p.spec.slug, `\`${p.symbol}\` (planeada — re-anclar) sin fila sym: … crea: en la COVERAGE_TABLE`);
    } else if (!(row.crea < p.spec.slug)) {
      add("C4", "BLOCKER", p.spec.slug, `\`${p.symbol}\` la crea ${row.crea}, que no es un spec anterior`);
    } else if (!p.firma) {
      add("C4", "WARNING", p.spec.slug, `\`${p.symbol}\` (planeada — re-anclar) sin firma declarada — nada que comparar`);
    } else if (p.firma !== row.firma) {
      add("C4", "BLOCKER", p.spec.slug, `\`${p.symbol}\` planeada "${p.firma}" ≠ creada en ${row.crea} "${row.firma}"`);
    }
  }

  // ---- C5 — sizing --------------------------------------------------------------------
  if (specs.length > MAX_SPECS) add("C5", "WARNING", null, `${specs.length} specs (> ${MAX_SPECS}) — split sugerido`);
  for (const spec of specs) {
    if (spec.idCount > MAX_IDS_PER_SPEC) {
      add("C5", "WARNING", spec.slug, `${spec.idCount} AC/BR/EC (> ${MAX_IDS_PER_SPEC}) — probable > 3 commits; split sugerido (proxy heurístico)`);
    }
  }

  // ---- C6 — dependency order ----------------------------------------------------------
  for (const row of rows.sym) {
    if (!known(row.crea)) {
      add("C6", "BLOCKER", row.crea, `fila sym: \`${row.symbol}\` — crea: ${row.crea}: slug desconocido`);
      continue;
    }
    for (const consumer of row.consume) {
      if (!known(consumer)) add("C6", "BLOCKER", consumer, `fila sym: \`${row.symbol}\` — consume: ${consumer}: slug desconocido`);
      else if (consumer < row.crea) add("C6", "BLOCKER", consumer, `\`${row.symbol}\`: ${consumer} consume un símbolo que crea ${row.crea}, un spec posterior`);
      else if (consumer === row.crea) add("C6", "WARNING", consumer, `\`${row.symbol}\`: el spec se consume a sí mismo — no es un handoff`);
    }
  }

  // ---- C-path — every Crea:/Modifica: line carries a path (feeds allowed_paths) -----------
  for (const spec of specs) {
    for (const line of spec.surfaceWithoutPath) {
      add("C-path", "BLOCKER", spec.slug, `"${line.kind === "crea" ? "Crea" : "Modifica"}: ${line.symbol}" sin \`en <path>\``);
    }
  }

  // ---- C-gap — migration epics: gap coverage ------------------------------------------
  if (isMigration || epic.gaps.length > 0) {
    if (!epic.hasGapsLine || epic.gaps.length === 0) {
      add("C-gap", "INFO", null, "el epic no declara GAP-nnn — C-gap omitido");
    } else {
      for (const gap of epic.gaps) {
        const gapRows = rows.gap.filter((r) => r.gap === gap);
        if (gapRows.length === 0) add("C-gap", "BLOCKER", null, `${gap} del epic no lo cubre ningún spec (hueco)`);
        if (gapRows.length > 1) add("C-gap", "BLOCKER", null, `${gap} cubierto por ${gapRows.length} specs (solapamiento): ${gapRows.map((r) => r.slug).join(", ")}`);
        for (const row of gapRows) {
          if (!known(row.slug)) add("C-gap", "BLOCKER", row.slug, `fila gap: ${gap} → ${row.slug}: slug desconocido`);
          else if (!bySlug[row.slug].gaps.includes(gap)) add("C-gap", "BLOCKER", row.slug, `la tabla declara ${gap} pero el spec no lo lista en "Gaps cubiertos"`);
        }
      }
    }
  }

  // ---- C-sup — sanctioned supersessions -----------------------------------------------
  const projectRoot = findProjectRoot(epicDir) || process.cwd();
  for (const spec of specs) {
    for (const sup of spec.supersedes) {
      const row = rows.sup.find((r) => r.path === sup.path && r.test === sup.test);
      if (!row) add("C-sup", "BLOCKER", spec.slug, `Supersede \`${sup.path}::${sup.test}\` sin fila sup: en la COVERAGE_TABLE`);
      else if (row.slug !== spec.slug) add("C-sup", "BLOCKER", spec.slug, `Supersede \`${sup.path}::${sup.test}\` la tabla la asigna a ${row.slug}`);
      if (!fs.existsSync(path.join(projectRoot, sup.path))) add("C-sup", "BLOCKER", spec.slug, `Supersede \`${sup.path}\` no existe en disco (raíz ${projectRoot})`);
    }
  }
  for (const row of rows.sup) {
    if (!known(row.slug)) add("C-sup", "BLOCKER", row.slug, `fila sup: \`${row.path}::${row.test}\` → ${row.slug}: slug desconocido`);
    else if (!bySlug[row.slug].supersedes.some((s) => s.path === row.path && s.test === row.test)) {
      add("C-sup", "BLOCKER", row.slug, `fila sup: \`${row.path}::${row.test}\` sin línea Supersede: en el spec`);
    }
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.check.localeCompare(b.check));
  return findings;
}

function run(opts) {
  const epicDir = path.resolve(opts.positional[0]);
  if (!fs.existsSync(epicDir) || !fs.statSync(epicDir).isDirectory()) return unverifiable(`epic dir not found: ${opts.positional[0]}`);
  const planningText = readFile(path.join(epicDir, "_planning.md"));
  if (planningText === null) return unverifiable("_planning.md not found in the epic dir");
  const table = planning.parseCoverageTable(planningText);
  if (!table.found) return unverifiable("COVERAGE_TABLE not found in _planning.md");
  const sha = planning.coverageHash(planningText);
  if (opts.hashOnly) return { status: "HASH", sha, findings: [], specs: [], epic: null };
  if (table.errors.length > 0) {
    return unverifiable(`malformed COVERAGE_TABLE row: ${table.errors[0].line}`, { sha, malformed: table.errors.map((e) => e.line) });
  }
  const specs = loadSpecs(epicDir);
  if (opts.allowedPaths) {
    const paths = [...new Set(specs.flatMap((s) => [...s.createdPaths, ...s.modifiedPaths]))].sort();
    return { status: "PATHS", sha, paths, findings: [], specs: specs.map((s) => s.slug), epic: null };
  }
  const loaded = loadEpic(opts);
  if (loaded.error) return unverifiable(loaded.error, { sha });
  const findings = runChecks({ table, specs, epic: loaded.epic, roadmapEpics: loaded.roadmapEpics, epicDir });
  const status = findings.some((f) => f.severity === "BLOCKER") ? "FAIL" : "PASS";
  const { id, state, template, operations, rules, gaps } = loaded.epic;
  return { status, sha, findings, specs: specs.map((s) => s.slug), epic: { id, state, template, operations, rules, gaps } };
}

function render(result) {
  if (result.status === "PATHS") return result.paths.join("\n") + (result.paths.length ? "\n" : "");
  const token = result.status === "UNVERIFIABLE" ? `MECH_CHECK: UNVERIFIABLE ${result.reason}` : `MECH_CHECK: ${result.status} ${result.sha}`;
  const body = (result.malformed || []).map((l) => `  ${l}`).concat(result.findings.map((f) => `${f.check} ${f.severity} ${f.slug}: ${f.detail}`));
  return [token, ...body].join("\n") + "\n";
}

function exitCode(result) {
  if (result.status === "UNVERIFIABLE") return 2;
  return result.status === "FAIL" ? 1 : 0;
}

if (require.main === module) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exit(2);
  }
  const result = run(opts);
  process.stdout.write(opts.json ? JSON.stringify(result, null, 2) + "\n" : render(result));
  process.exit(exitCode(result));
}

module.exports = { run, runChecks, render, exitCode, parseArgs, MAX_SPECS, MAX_IDS_PER_SPEC };
