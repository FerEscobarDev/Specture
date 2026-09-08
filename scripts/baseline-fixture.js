#!/usr/bin/env node
// Regenerates the "Archivador" scratch project used by the Spec Planning Gate baselines
// (docs/spec-planning-baseline.md — stage 1; docs/spec-planning-baseline-stage2.md — stage 2),
// so the RED/GREEN scenarios can be re-run instead of recreated from prose.
//
//   node scripts/baseline-fixture.js <dir> [--stage 1|2|3] [--git] [--force]
//
//   --stage 3            the stage-3 fixture (docs/knowledge-reconcile-baseline.md, v1.19.0): the
//                        stage-2 tree with Milestone 1 closed (Epics 1.1-1.3 [x] + a new Epic 1.4
//                        "Cuota por tipo" [x] whose spec supersedes the 10 MB limit of spec 1.1/01 —
//                        the "último gana" bait), no docs/05-specs/_current/, and a component
//                        "Auditoría" with inherited code under archivador_api/src/auditoria/ and no
//                        specs at all (the `characterize` bait).
//   --stage 2 (default)  the stage-2 fixture ("Archivador v2"): 5 epics, 5-operation contract,
//                        hand-written baits for scenarios 2/3/11/12, existing code in
//                        archivador_api/src/tags/ (scenario 9), migration epic + gap_analysis.md
//                        with GAP ids (scenario 10). Source tree: scripts/baseline-fixture/archivador/.
//   --stage 1            the stage-1 fixture derived from it: only Epics 1.1/1.2, 4-operation
//                        contract, RN-001 deliberately ambiguous, RN-002 as bait, no hand-written
//                        specs, no existing code (the planner authors the specs in those scenarios).
//   --git                git init + one commit, so SPEC_SHA / RED_SHA scenarios have real history.
//   --force              write into a non-empty directory.
//
// The generated project is a USER project (not the framework): `.specture/settings.yml` gets the
// installed plugin version as `schema_version`, and `.gitignore` the current three-line form.
// Exit 0 = written, 2 = usage / refused (non-empty dir without --force).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SOURCE = path.resolve(__dirname, "baseline-fixture", "archivador");
const PLUGIN_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "plugin.json"), "utf8")).version;

function usage(message) {
  if (message) process.stderr.write(`baseline-fixture: ${message}\n`);
  process.stderr.write("usage: node scripts/baseline-fixture.js <dir> [--stage 1|2|3] [--git] [--force]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { dir: null, stage: 2, git: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stage") args.stage = Number(argv[++i]);
    else if (a === "--git") args.git = true;
    else if (a === "--force") args.force = true;
    else if (a.startsWith("--")) usage(`unknown option ${a}`);
    else if (args.dir === null) args.dir = a;
    else usage(`unexpected argument ${a}`);
  }
  if (!args.dir) usage("missing <dir>");
  if (![1, 2, 3].includes(args.stage)) usage("--stage must be 1, 2 or 3");
  return args;
}

function walk(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, next));
    else out.push(next);
  }
  return out.sort();
}

// { rel: text } of the stage-2 tree, with the two substitutions every stage needs.
function stage2Files() {
  const files = {};
  for (const rel of walk(SOURCE)) {
    const target = rel === "_gitignore" ? ".gitignore" : rel;
    let text = fs.readFileSync(path.join(SOURCE, rel), "utf8").replace(/\r\n/g, "\n"); // LF regardless of autocrlf
    if (target === ".specture/settings.yml") text = text.replace("[PLUGIN_VERSION]", PLUGIN_VERSION);
    files[target] = text;
  }
  return files;
}

// Stage 1 = the stage-2 tree minus everything the stage-1 scenarios must not see, with the
// baits described in docs/spec-planning-baseline.md § Setup común.
function stage1Files(files) {
  const out = {};
  for (const [rel, text] of Object.entries(files)) {
    if (/^(docs\/05-specs\/|docs\/migration\/|docs\/03-ux-ui\/|archivador_api\/)/.test(rel)) continue;
    out[rel] = text;
  }
  const dropLine = (text, regex) => text.split("\n").filter((l) => !regex.test(l)).join("\n");

  out["docs/01-requirements/business_requirements.md"] = dropLine(
    out["docs/01-requirements/business_requirements.md"]
      .replace(", y puede etiquetar sus archivos para encontrarlos.", ".")
      .replace("sube, lista, etiqueta y elimina sus propios archivos", "sube, lista y elimina sus propios archivos")
      .replace("(título, cuerpo, nombre de etiqueta)", "(título, cuerpo)")
      .replace(/- \*\*RN-001:\*\*.*$/m, "- **RN-001:** Los usuarios pueden subir archivos."),
    /HU-ETQ-001|RN-005/
  );
  out["docs/02-architecture/api-contract.openapi.yaml"] = out["docs/02-architecture/api-contract.openapi.yaml"].replace(/  \/archivos\/\{id\}\/etiquetas:[\s\S]*?(?=  \/notas:)/, "");
  out["docs/02-architecture/api-contract.md"] = dropLine(out["docs/02-architecture/api-contract.md"], /asignarEtiqueta/).replace(" · HU-ETQ-001 → `asignarEtiqueta`", "");
  out["docs/02-architecture/architecture.md"] = out["docs/02-architecture/architecture.md"].replace(/### Etiquetas[\s\S]*?(?=## Identidad)/, "");
  const roadmap = out["docs/04-roadmap/ROADMAP.md"];
  out["docs/04-roadmap/ROADMAP.md"] = roadmap
    .slice(0, roadmap.indexOf("\n- [ ] **Epic 1.3:**"))
    .replace("subir, listar, eliminar y etiquetar archivos; crear notas.", "subir, listar y eliminar archivos; crear notas.")
    .trimEnd() + "\n";
  out[".specture/stack.yml"] = out[".specture/stack.yml"].replace(/migration:[\s\S]*?\n\n/, "");
  return out;
}

// Stage 3 = the stage-2 tree with Milestone 1 closed and the two baits of the knowledge
// reconcile / characterize baseline (docs/knowledge-reconcile-baseline.md).
function stage3Files(files) {
  const out = { ...files };
  out["docs/04-roadmap/ROADMAP.md"] = out["docs/04-roadmap/ROADMAP.md"]
    .replace("- [ ] **Epic 1.1:**", "- [x] **Epic 1.1:**")
    .replace("- [ ] **Epic 1.2:**", "- [x] **Epic 1.2:**")
    .replace("- [ ] **Epic 1.3:**", "- [x] **Epic 1.3:**")
    .replace(
      "\n### Milestone 2:",
      [
        "",
        "- [x] **Epic 1.4:** Cuota por tipo",
        "  - **Dependencias:** Epic 1.1",
        "  - **Descripción:** Los PDF pueden pesar hasta 25 MB; las imágenes siguen en 10 MB. Cambia el tope de `subirArchivo`.",
        "  - **Reglas de negocio clave:** RN-007",
        "  - **Componentes de arquitectura involucrados:** Archivos",
        "  - **Operaciones del contrato:** `subirArchivo`",
        "  - **Specs estimados:** 1",
        "",
        "### Milestone 2:"
      ].join("\n")
    );
  out["docs/01-requirements/business_requirements.md"] = out["docs/01-requirements/business_requirements.md"].replace(
    /^(- \*\*RN-006:\*\*.*)$/m,
    "$1\n- **RN-007:** Un PDF pesa como máximo 25 MB; una imagen (`image/png`, `image/jpeg`) como máximo 10 MB. Reemplaza el tope único de 10 MB de RN-001 (aclarado en Epic 1.4, 2026-09-08)."
  );
  out["docs/02-architecture/architecture.md"] = out["docs/02-architecture/architecture.md"].replace(
    "\n## Identidad",
    [
      "",
      "### Auditoría",
      "- **Responsabilidad:** registro de eventos por empleado — código heredado, anterior a Specture; sin specs ni epic (se caracteriza desde el código).",
      "- **Carpeta raíz:** `archivador_api/`",
      "- **Ubicación:** `archivador_api/src/auditoria/`",
      "",
      "## Identidad"
    ].join("\n")
  );
  out["docs/05-specs/epic-1.3-etiquetas/01-asignar-etiqueta.spec.md"] = [
    "# SPEC: Asignar etiqueta — id: epic-1.3-etiquetas/01-asignar-etiqueta",
    "",
    "**Epic:** Epic 1.3 Etiquetas   **Módulo:** Etiquetas (`archivador_api/src/tags/`)",
    "",
    "## Objetivo",
    "Un empleado asigna una etiqueta normalizada a un archivo propio reutilizando `TagRepository`.",
    "",
    "## Fuera de Scope (NO testear, NO implementar)",
    "- Quitar etiquetas.",
    "- Listar archivos por etiqueta.",
    "",
    "## Operaciones del Contrato de API (si el spec toca un boundary HTTP)",
    "- **Implementa** (spec de backend): `operationId` — `[asignarEtiqueta]`",
    "",
    "## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)",
    "| Aspecto | Detalle |",
    "|---------|---------|",
    "| Entradas | header `X-Employee-Id`; path `id` del archivo; body `nombre`: string (RN-002) |",
    "| Salidas (éxito) | 200 `Archivo` con `etiquetas: string[]` |",
    "| Salidas (error) | archivo ajeno o inexistente → 404 `ARCHIVO_NO_ENCONTRADO`; undécima etiqueta → 409 `LIMITE_ETIQUETAS`; nombre inválido → 400 `VALIDATION_ERROR` |",
    "| Efectos secundarios | inserta en `tags` (si no existe una casi-duplicada) y en `file_tags` |",
    "| Idempotencia | sí: repetir la misma etiqueta no la duplica |",
    "",
    "## Reglas de Negocio",
    "- **BR-1:** El nombre se normaliza a minúsculas y sin acentos antes de guardarse — fuente: `RN-005` de business_requirements.md",
    "- **BR-2:** Un archivo admite como máximo 10 etiquetas — fuente: `RN-005` de business_requirements.md",
    "- **BR-3:** Solo el dueño del archivo puede etiquetarlo — fuente: `RN-006` de business_requirements.md",
    "",
    "## Criterios de Aceptación (≥1 test por ID)",
    "- **AC-1:** Asignar `Facturación` guarda `facturacion` y devuelve 200 con la etiqueta en `etiquetas`.",
    "- **AC-2:** La undécima etiqueta distinta devuelve 409 `LIMITE_ETIQUETAS`.",
    "- **AC-3:** Etiquetar un archivo de otro empleado devuelve 404 `ARCHIVO_NO_ENCONTRADO`.",
    "",
    "## Edge Cases (los que cambian comportamiento — NO exhaustivo)",
    "- **EC-1:** Un nombre casi duplicado (`facturacion` vs `facturación`) reutiliza la etiqueta existente en vez de crear otra.",
    "",
    "## Aclaraciones (resueltas en planificación)",
    "- R-1: ¿casi-duplicados cuentan como la misma etiqueta? → sí — fuente: RN-005 \"se normaliza a minúsculas y sin acentos antes de guardarse\"",
    "",
    "## Superficie de Código Existente (para el implementer — lo llena el spec-planner)",
    "- Crea: `asignarEtiqueta` en `archivador_api/src/tags/service.js` — firma: `asignarEtiqueta(employeeId: string, fileId: string, nombre: string): Promise<Archivo>`",
    "- Llama a: `TagRepository.findOrCreate(name, cb)` en `archivador_api/src/tags/tag-repository.js`",
    "- Llama a: `TagRepository.attach(fileId, tagId, cb)` en `archivador_api/src/tags/tag-repository.js`",
    ""
  ].join("\n");
  out["docs/05-specs/epic-1.3-etiquetas/_planning.md"] = [
    "# Planning — epic-1.3-etiquetas",
    "",
    "COVERAGE_TABLE:",
    "- op: asignarEtiqueta → 01-asignar-etiqueta (implementa)",
    "- br: RN-002 → 01-asignar-etiqueta [contrato]",
    "- br: RN-005 → 01-asignar-etiqueta [BR-1, BR-2]",
    "- sym: asignarEtiqueta — crea: 01-asignar-etiqueta — firma: asignarEtiqueta(employeeId: string, fileId: string, nombre: string): Promise<Archivo>",
    "",
    "OPEN_QUESTIONS: (ninguna)",
    "",
    "RESOLVED_ALONE:",
    "- R-1 — casi-duplicados = misma etiqueta — fuente: RN-005 — cita: \"se normaliza a minúsculas y sin acentos antes de guardarse\"",
    ""
  ].join("\n");
  out["docs/05-specs/epic-1.4-cuota/01-cuota-por-tipo.spec.md"] = [
    "# SPEC: Cuota por tipo — id: epic-1.4-cuota/01-cuota-por-tipo",
    "",
    "**Epic:** Epic 1.4 Cuota por tipo   **Módulo:** Archivos (`archivador_api/src/archivos/`)",
    "",
    "## Objetivo",
    "`subirArchivo` acepta PDF de hasta 25 MB; las imágenes conservan el tope de 10 MB.",
    "",
    "## Fuera de Scope (NO testear, NO implementar)",
    "- Tipos de archivo nuevos.",
    "- Cuota total por empleado.",
    "",
    "## Operaciones del Contrato de API (si el spec toca un boundary HTTP)",
    "- **Implementa** (spec de backend): `operationId` — `[subirArchivo]`",
    "",
    "## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)",
    "| Aspecto | Detalle |",
    "|---------|---------|",
    "| Entradas | las de `subirArchivo` (Epic 1.1): header `X-Employee-Id`, `nombre`, `tipo`, `contenidoBase64` |",
    "| Salidas (éxito) | 201 `Archivo` |",
    "| Salidas (error) | PDF de más de 25 MB o imagen de más de 10 MB → 400 `VALIDATION_ERROR` |",
    "| Efectos secundarios | ninguno nuevo |",
    "| Idempotencia | sin cambio (no idempotente) |",
    "",
    "## Reglas de Negocio",
    "- **BR-1:** PDF ≤ 25 MB; `image/png` e `image/jpeg` ≤ 10 MB — fuente: `RN-007` de business_requirements.md (reemplaza el tope único de 10 MB de RN-001)",
    "",
    "## Criterios de Aceptación (≥1 test por ID)",
    "- **AC-1:** Un PDF de 20 MB devuelve 201.",
    "- **AC-2:** Un PDF de 25 MB + 1 byte devuelve 400 `VALIDATION_ERROR`.",
    "- **AC-3:** Un PNG de 12 MB devuelve 400 `VALIDATION_ERROR`.",
    "",
    "## Edge Cases (los que cambian comportamiento — NO exhaustivo)",
    "- **EC-1:** `tipo` en mayúsculas (`APPLICATION/PDF`) se normaliza antes de elegir el tope.",
    "",
    "## Aclaraciones (resueltas en planificación)",
    "- R-1: ¿el tope de PDF aplica al tamaño decodificado? → sí — fuente: RN-001 \"pesa como máximo\" (mismo criterio que el tope anterior)",
    "",
    "## Superficie de Código Existente (para el implementer — lo llena el spec-planner)",
    "- Modifica: `subirArchivo` en `archivador_api/src/archivos/service.js`",
    "- Llama a: `ArchivoRepository.insert(row)` en `archivador_api/src/archivos/repository.js`",
    ""
  ].join("\n");
  out["docs/05-specs/epic-1.4-cuota/_planning.md"] = [
    "# Planning — epic-1.4-cuota",
    "",
    "COVERAGE_TABLE:",
    "- op: subirArchivo → 01-cuota-por-tipo (implementa)",
    "- br: RN-007 → 01-cuota-por-tipo [BR-1]",
    "",
    "OPEN_QUESTIONS: (ninguna)",
    "",
    "RESOLVED_ALONE:",
    "- R-1 — tope sobre el tamaño decodificado — fuente: RN-001 — cita: \"pesa como máximo\"",
    ""
  ].join("\n");
  out["archivador_api/src/auditoria/audit-log.js"] = [
    "'use strict';",
    "// Registro de auditoría por empleado — código heredado (anterior a Specture), sin specs.",
    "",
    "const EVENT_TYPES = ['archivo.subido', 'archivo.eliminado', 'nota.creada', 'etiqueta.asignada'];",
    "const RETENTION_DAYS = 90;",
    "const MAX_PAYLOAD_BYTES = 4096;",
    "const DEFAULT_LIMIT = 50;",
    "const MAX_LIMIT = 200;",
    "",
    "class AuditError extends Error {",
    "  constructor(code, message) {",
    "    super(message);",
    "    this.code = code;",
    "  }",
    "}",
    "",
    "class AuditLog {",
    "  constructor(db) {",
    "    this.db = db;",
    "  }",
    "",
    "  // Inserta un evento. Rechaza tipos fuera de EVENT_TYPES (TIPO_EVENTO_DESCONOCIDO) y",
    "  // payloads serializados de más de 4 KB (PAYLOAD_DEMASIADO_GRANDE). Devuelve el id.",
    "  async registrarEvento(employeeId, tipo, payload = {}) {",
    "    if (!EVENT_TYPES.includes(tipo)) throw new AuditError('TIPO_EVENTO_DESCONOCIDO', `unknown event type ${tipo}`);",
    "    const json = JSON.stringify(payload);",
    "    if (Buffer.byteLength(json) > MAX_PAYLOAD_BYTES) throw new AuditError('PAYLOAD_DEMASIADO_GRANDE', 'payload over 4 KB');",
    "    const rows = await this.db.query('INSERT INTO audit_events(employee_id, tipo, payload) VALUES ($1, $2, $3) RETURNING id', [employeeId, tipo, json]);",
    "    return rows[0].id;",
    "  }",
    "",
    "  // Lista los eventos del empleado, más recientes primero, nunca más de RETENTION_DAYS atrás;",
    "  // `limite` por defecto 50 y como máximo 200 (un valor mayor se recorta en silencio).",
    "  async listarEventos(employeeId, { desde, hasta, limite = DEFAULT_LIMIT } = {}) {",
    "    const floor = new Date(Date.now() - RETENTION_DAYS * 86400000);",
    "    const from = desde && desde > floor ? desde : floor;",
    "    const to = hasta || new Date();",
    "    const size = Math.min(Math.max(1, limite), MAX_LIMIT);",
    "    return this.db.query('SELECT id, tipo, payload, created_at FROM audit_events WHERE employee_id = $1 AND created_at BETWEEN $2 AND $3 ORDER BY created_at DESC LIMIT $4', [employeeId, from, to, size]);",
    "  }",
    "",
    "  // Borra los eventos con más de RETENTION_DAYS días. Devuelve cuántos borró.",
    "  async purgar(now = new Date()) {",
    "    const floor = new Date(now.getTime() - RETENTION_DAYS * 86400000);",
    "    const rows = await this.db.query('DELETE FROM audit_events WHERE created_at < $1 RETURNING id', [floor]);",
    "    return rows.length;",
    "  }",
    "}",
    "",
    "module.exports = { AuditLog, AuditError, EVENT_TYPES, RETENTION_DAYS, MAX_PAYLOAD_BYTES, DEFAULT_LIMIT, MAX_LIMIT };",
    ""
  ].join("\n");
  out["archivador_api/src/auditoria/index.js"] = "'use strict';\nmodule.exports = require('./audit-log');\n";
  return out;
}

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

function gitInit(dir, stage) {
  const git = (...a) => execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...a], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q", "-b", "master");
  git("add", "-A");
  git("commit", "-q", "-m", `chore: fixture Archivador (stage ${stage})`);
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function scenarioHints(dir, stage) {
  const root = path.resolve(__dirname, "..").replace(/\\/g, "/");
  const d = path.resolve(dir).replace(/\\/g, "/");
  if (stage === 1) {
    return [
      "Stage-1 scenarios (docs/spec-planning-baseline.md): dispatch the spec-planner / coordinator on Epic 1.1 (RN-001 ambiguous) and Epic 1.2 (well-discovered); the planner authors the specs.",
      `  doctor:  node "${root}/scripts/doctor.js" check --project "${d}"`
    ];
  }
  if (stage === 3) {
    return [
      "Stage-3 scenarios (docs/knowledge-reconcile-baseline.md): Milestone 1 closed, no docs/05-specs/_current/.",
      `  doctor:      node "${root}/scripts/doctor.js" check --project "${d}"                                   # current-state-missing → knowledge reconcile`,
      `  components:  node "${root}/hooks/lib/current-state.js" components --project "${d}"`,
      `  sc.1  /specture:knowledge reconcile --component archivos      # 3 specs [x]; spec 1.4/01 supersedes the 10 MB limit of 1.1/01 (último gana → Historial)`,
      `  sc.2  /specture:knowledge reconcile --component archiv        # ambiguous/unknown slug → the helper exits 2 and the skill asks`,
      `  sc.3  /specture:knowledge characterize --component auditoria  # no specs: read-only from archivador_api/src/auditoria/ → Confianza: ai_characterized`,
      `  sc.4  build on Epic 2.1 (Etiquetas has 1 spec [x] and no _current/etiquetas.md) → Current-State Resolution warns once, does not block`,
      `  sc.5  re-run sc.1 after editing _current/archivos.md by hand → incremental merge, bounded git diff`
    ];
  }
  return [
    "Stage-2 mechanical scenarios (docs/spec-planning-baseline-stage2.md):",
    `  sc.2  node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-1.1-archivos" --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic 1.1   # C1 hueco eliminarArchivo`,
    `  sc.3  node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-1.2-notas"    --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic 1.2   # C4 firmas divergentes`,
    `  sc.11 node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-3.1-mis-archivos" --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic 3.1   # C1-consume (flip Epic 1.1 to [x] to PASS)`,
    `  sc.12 hooks.enabled: true in .specture/settings.yml, Epic 1.2 → [/], then: node "${root}/hooks/lib/seal-cli.js" write --epic epic-1.2-notas --spec-sha <sha> --spec-paths "docs/05-specs/epic-1.2-notas/*.spec.md" --test-globs "tests/**/*.test.js,tests/**" --allowed-paths "$(node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/epic-1.2-notas" --allowed-paths | paste -sd,)" --project "${d}"`,
    "        and pipe a PreToolUse payload (file_path with forward slashes) into hooks/pre-tool-use-tdd-gate.js from that directory.",
    "  sc.9 / sc.10: dispatch the spec-planner on Epic 1.3 / Epic 2.1 with the CODE_SURFACE table of archivador_api/ (haiku pre-flight).",
    `  doctor: node "${root}/scripts/doctor.js" check --project "${d}"`
  ];
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.dir);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !args.force) usage(`${dir} is not empty (use --force)`);
  const files = args.stage === 1 ? stage1Files(stage2Files()) : args.stage === 3 ? stage3Files(stage2Files()) : stage2Files();
  fs.mkdirSync(dir, { recursive: true });
  write(dir, files);
  let sha = null;
  if (args.git) sha = gitInit(dir, args.stage);
  process.stdout.write(`baseline-fixture: stage ${args.stage} written to ${dir} (${Object.keys(files).length} files, schema_version ${PLUGIN_VERSION}${sha ? `, commit ${sha}` : ""})\n`);
  for (const line of scenarioHints(dir, args.stage)) process.stdout.write(line + "\n");
}

module.exports = { stage2Files, stage1Files, stage3Files, write, SOURCE, PLUGIN_VERSION };
