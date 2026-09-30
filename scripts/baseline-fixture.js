#!/usr/bin/env node
// Regenerates the "Archivador" scratch project used by the Spec Planning Gate baselines
// (docs/spec-planning-baseline.md — stage 1; docs/spec-planning-baseline-stage2.md — stage 2),
// so the RED/GREEN scenarios can be re-run instead of recreated from prose.
//
//   node scripts/baseline-fixture.js <dir> [--stage 1|2|3|4|5] [--git] [--force]
//
//   --stage 5            the stage-5 fixture (docs/review-stage-baseline.md, v2.3.0): the stage-4
//                        tree with Epic 1.4 finished (GREEN applied, its PDF test superseded, the
//                        whole suite green), the gate baits 1.5-1.8 removed, and a new Milestone 2
//                        whose three epics (2.1 Baja de empleados — regulatory —, 2.2 Descarga de
//                        archivos — independent —, 2.3 Página "Bajas de empleados" — consumes 2.1)
//                        are the batch the review stage takes, with no review register yet. The
//                        old Milestones 2/3 become 3/4. The baits (a)-(f) of the plan are listed
//                        by the hints only; nothing in the tree names them. With --git: a base
//                        commit plus the bookkeeping one that records Epic 1.4's SUPERSEDE_SHA.
//   --stage 4            the stage-4 fixture (docs/gate-convergence-baseline.md, v2.2.0): the stage-3
//                        tree with Epic 1.1 closed on REAL code and `node:test` tests (no npm
//                        dependencies; `npm test` = `node --test tests/all.test.js`, an aggregator that
//                        requires every test file, so one broken import takes the whole suite down —
//                        the "compilation layer"), Epic 1.4 "Cuota por tipo" [/] with its RED test,
//                        and one epic directory per probe of the gate (1.5-1.8) plus the execution
//                        baits (rename → load failure, 10 → 25 MB → assertion, a false supersession,
//                        a PROTECTED test named by `rules.yml` verify: and by a GUARD). With --git the
//                        history is base → lock → plan → verdict → RED (fixed dates: same SHAs on
//                        every run of the same plugin version).
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
//   --git                git init + one commit (stage 4: five; stage 5: two), so SPEC_SHA / RED_SHA scenarios have real history.
//   --force              write into a non-empty directory.
//
// The generated project is a USER project (not the framework): `.specture/settings.yml` gets the
// installed plugin version as `schema_version`, and `.gitignore` the current three-line form.
// Exit 0 = written, 2 = usage / refused (non-empty dir without --force).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const planning = require("../hooks/lib/planning");

const SOURCE = path.resolve(__dirname, "baseline-fixture", "archivador");
const PLUGIN_VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "plugin.json"), "utf8")).version;

function usage(message) {
  if (message) process.stderr.write(`baseline-fixture: ${message}\n`);
  process.stderr.write("usage: node scripts/baseline-fixture.js <dir> [--stage 1|2|3|4|5] [--git] [--force]\n");
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
  if (![1, 2, 3, 4, 5].includes(args.stage)) usage("--stage must be 1, 2, 3, 4 or 5");
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

// ---------------------------------------------------------------------------
// Stage 4 — gate convergence and supersession-loop probes (docs/gate-convergence-baseline.md)
// ---------------------------------------------------------------------------

const STAGE4_EPIC = "docs/05-specs/epic-1.4-cuota";
const STAGE4_TIMES = {
  base: "2026-09-18T18:00:00-03:00",
  planned: "2026-09-19T15:00:00-03:00",
  lock: "2026-09-20T09:00:00-03:00",
  mech: "2026-09-20T10:05:00-03:00",
  verdict: "2026-09-20T10:40:00-03:00",
  plan: "2026-09-20T10:45:00-03:00",
  bookkeeping: "2026-09-20T10:50:00-03:00",
  red: "2026-09-20T11:30:00-03:00"
};
const STAGE4_TEST_FILES = ["archivos/limits.test.js", "archivos/naming.test.js", "archivos/repository.test.js", "archivos/service.test.js"];
const FALSE_SUPERSEDE = "tests/archivos/limits.test.js::validateSize rechaza una imagen de 10 MB + 1 byte";

const source = (rows) => [...rows, ""].join("\n");

// `tests/all.test.js` — the aggregator `npm test` runs. `withRed` adds the RED file of Epic 1.4.
function allTestsFile(withRed) {
  return source([
    "'use strict';",
    "// Agregador de la suite — `npm test` = `node --test tests/all.test.js`.",
    "// Requiere cada archivo de test en un solo proceso: un import roto (un módulo o un export que ya",
    "// no existe) tumba la suite entera, como un ensamblado de tests que no compila.",
    "// Todo archivo de test nuevo se registra aquí.",
    "",
    ...[...STAGE4_TEST_FILES, ...(withRed ? ["archivos/quota.test.js"] : [])].map((f) => `require('./${f}');`)
  ]);
}

// Code and tests of Epic 1.1 (closed) and the RED test of Epic 1.4 — real, dependency-free.
function stage4Code() {
  const api = "archivador_api/src/archivos";
  return {
    "package.json": source(["{", '  "name": "archivador",', '  "private": true,', '  "scripts": {', '    "test": "node --test tests/all.test.js"', "  }", "}"]),
    [`${api}/validation-error.js`]: source([
      "'use strict';",
      "// Error de validación del componente Archivos — la capa HTTP lo traduce a 400 VALIDATION_ERROR.",
      "",
      "class ValidationError extends Error {",
      "  constructor(message) {",
      "    super(message);",
      "    this.name = 'ValidationError';",
      "    this.code = 'VALIDATION_ERROR';",
      "  }",
      "}",
      "",
      "module.exports = { ValidationError };"
    ]),
    [`${api}/file-not-found-error.js`]: source([
      "'use strict';",
      "// Archivo inexistente o ajeno (RN-006) — la capa HTTP lo traduce a 404 ARCHIVO_NO_ENCONTRADO.",
      "",
      "class FileNotFoundError extends Error {",
      "  constructor(fileId) {",
      "    super(`archivo ${fileId} no encontrado`);",
      "    this.name = 'FileNotFoundError';",
      "    this.code = 'ARCHIVO_NO_ENCONTRADO';",
      "  }",
      "}",
      "",
      "module.exports = { FileNotFoundError };"
    ]),
    [`${api}/limits.js`]: source([
      "'use strict';",
      "// Límites de subida — Epic 1.1 (RN-001): tipos permitidos y tamaño máximo por archivo.",
      "",
      "const { ValidationError } = require('./validation-error');",
      "",
      "const MB = 1024 * 1024;",
      "const MAX_FILE_MB = 10;",
      "const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];",
      "",
      "function validateType(tipo) {",
      "  if (!ALLOWED_TYPES.includes(tipo)) throw new ValidationError(`tipo no permitido: ${tipo}`);",
      "  return tipo;",
      "}",
      "",
      "// `tipo` solo va en el mensaje: RN-001 fija un tope único para todos los tipos.",
      "function validateSize(bytes, tipo) {",
      "  if (!Number.isInteger(bytes) || bytes < 0) throw new ValidationError('tamaño inválido');",
      "  if (bytes > MAX_FILE_MB * MB) throw new ValidationError(`${tipo} de más de ${MAX_FILE_MB} MB`);",
      "  return bytes;",
      "}",
      "",
      "module.exports = { MB, MAX_FILE_MB, ALLOWED_TYPES, validateType, validateSize };"
    ]),
    [`${api}/naming.js`]: source([
      "'use strict';",
      "// Nombre de almacenamiento — Epic 1.1: `<empleado>/<archivo>.<ext>`, único por fila",
      "// (`archivos.storage_key`); nunca incluye el nombre original.",
      "",
      "const path = require('node:path');",
      "",
      "function buildStorageName(employeeId, fileId, originalName) {",
      "  const extension = path.extname(originalName).slice(1).toLowerCase();",
      "  return extension ? `${employeeId}/${fileId}.${extension}` : `${employeeId}/${fileId}`;",
      "}",
      "",
      "module.exports = { buildStorageName };"
    ]),
    [`${api}/repository.js`]: source([
      "'use strict';",
      "// Acceso a la tabla `archivos` — los bytes van en la columna bytea `contenido` (ADR-001).",
      "",
      "const SELECT = 'id, nombre, tipo, octet_length(contenido) AS \"tamanoBytes\", subido_en AS \"subidoEn\"';",
      "",
      "class ArchivoRepository {",
      "  constructor(db) {",
      "    this.db = db;",
      "  }",
      "",
      "  async insert({ id, employeeId, nombre, tipo, contenido, storageKey, subidoEn }) {",
      "    const rows = await this.db.query(",
      "      `INSERT INTO archivos (id, employee_id, nombre, tipo, contenido, storage_key, subido_en) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${SELECT}`,",
      "      [id, employeeId, nombre, tipo, contenido, storageKey, subidoEn]",
      "    );",
      "    return rows[0];",
      "  }",
      "",
      "  listByEmployee(employeeId) {",
      "    return this.db.query(`SELECT ${SELECT} FROM archivos WHERE employee_id = $1`, [employeeId]);",
      "  }",
      "",
      "  async findOwned(employeeId, fileId) {",
      "    const rows = await this.db.query(`SELECT ${SELECT} FROM archivos WHERE id = $1 AND employee_id = $2`, [fileId, employeeId]);",
      "    return rows[0] || null;",
      "  }",
      "",
      "  async remove(fileId) {",
      "    await this.db.query('DELETE FROM archivos WHERE id = $1', [fileId]);",
      "  }",
      "}",
      "",
      "module.exports = { ArchivoRepository };"
    ]),
    [`${api}/service.js`]: source([
      "'use strict';",
      "// Casos de uso del componente Archivos — Epic 1.1: subirArchivo, listarArchivos, eliminarArchivo.",
      "// `deps.repository` es `ArchivoRepository` en producción (bytea, ADR-001); los tests usan uno en memoria.",
      "",
      "const { ValidationError } = require('./validation-error');",
      "const { FileNotFoundError } = require('./file-not-found-error');",
      "const { validateType, validateSize } = require('./limits');",
      "const { buildStorageName } = require('./naming');",
      "",
      "const MAX_NAME_LENGTH = 200;",
      "const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;",
      "",
      "function cleanName(nombre) {",
      "  const value = typeof nombre === 'string' ? nombre.trim() : '';",
      "  if (value === '' || value.length > MAX_NAME_LENGTH) throw new ValidationError('nombre vacío o de más de 200 caracteres');",
      "  return value;",
      "}",
      "",
      "function decode(contenidoBase64) {",
      "  if (typeof contenidoBase64 !== 'string' || !BASE64.test(contenidoBase64)) throw new ValidationError('contenidoBase64 no es base64 válido');",
      "  return Buffer.from(contenidoBase64, 'base64');",
      "}",
      "",
      "async function subirArchivo({ repository, newId, now }, employeeId, { nombre, tipo, contenidoBase64 }) {",
      "  const name = cleanName(nombre);",
      "  validateType(tipo);",
      "  const contenido = decode(contenidoBase64);",
      "  validateSize(contenido.length, tipo);",
      "  const id = newId();",
      "  return repository.insert({ id, employeeId, nombre: name, tipo, contenido, storageKey: buildStorageName(employeeId, id, name), subidoEn: now() });",
      "}",
      "",
      "async function listarArchivos({ repository }, employeeId) {",
      "  const archivos = await repository.listByEmployee(employeeId);",
      "  return [...archivos].sort((a, b) => b.subidoEn - a.subidoEn);",
      "}",
      "",
      "async function eliminarArchivo({ repository }, employeeId, fileId) {",
      "  const archivo = await repository.findOwned(employeeId, fileId);",
      "  if (!archivo) throw new FileNotFoundError(fileId);",
      "  await repository.remove(fileId);",
      "}",
      "",
      "module.exports = { subirArchivo, listarArchivos, eliminarArchivo };"
    ]),
    "tests/all.test.js": allTestsFile(true),
    "tests/archivos/limits.test.js": source([
      "'use strict';",
      "// Epic 1.1 — límites de subida (RN-001).",
      "const assert = require('node:assert/strict');",
      "const { test } = require('node:test');",
      "const { MB, validateType, validateSize } = require('../../archivador_api/src/archivos/limits');",
      "",
      "test('validateType acepta application/pdf, image/png e image/jpeg', () => {",
      "  for (const tipo of ['application/pdf', 'image/png', 'image/jpeg']) assert.equal(validateType(tipo), tipo);",
      "});",
      "",
      "test('validateType rechaza text/plain', () => {",
      "  assert.throws(() => validateType('text/plain'), { code: 'VALIDATION_ERROR' });",
      "});",
      "",
      "test('validateSize acepta un archivo de exactamente 10 MB', () => {",
      "  assert.equal(validateSize(10 * MB, 'application/pdf'), 10 * MB);",
      "});",
      "",
      "test('validateSize rechaza un PDF de 10 MB + 1 byte', () => {",
      "  assert.throws(() => validateSize(10 * MB + 1, 'application/pdf'), { code: 'VALIDATION_ERROR' });",
      "});",
      "",
      "test('validateSize rechaza una imagen de 10 MB + 1 byte', () => {",
      "  assert.throws(() => validateSize(10 * MB + 1, 'image/png'), { code: 'VALIDATION_ERROR' });",
      "});"
    ]),
    "tests/archivos/naming.test.js": source([
      "'use strict';",
      "// Epic 1.1 — nombre de almacenamiento `<empleado>/<archivo>.<ext>`.",
      "const assert = require('node:assert/strict');",
      "const { test } = require('node:test');",
      "const { buildStorageName } = require('../../archivador_api/src/archivos/naming');",
      "",
      "// Nombre de ejemplo compartido por los tests; se arma al cargar el archivo.",
      "const SAMPLE = buildStorageName('emp-7', 'f-1', 'Contrato Final.PDF');",
      "",
      "test('buildStorageName arma empleado/archivo.extension', () => {",
      "  assert.equal(SAMPLE, 'emp-7/f-1.pdf');",
      "});",
      "",
      "test('buildStorageName pasa la extensión a minúsculas', () => {",
      "  assert.ok(buildStorageName('emp-7', 'f-2', 'Foto.JPEG').endsWith('.jpeg'));",
      "});"
    ]),
    "tests/archivos/repository.test.js": source([
      "'use strict';",
      "// Epic 1.1 — ArchivoRepository contra un `db` falso (la base es una integración externa).",
      "const assert = require('node:assert/strict');",
      "const { test } = require('node:test');",
      "const { ArchivoRepository } = require('../../archivador_api/src/archivos/repository');",
      "",
      "function fakeDb(rows) {",
      "  const calls = [];",
      "  return {",
      "    calls,",
      "    async query(sql, params) {",
      "      calls.push({ sql, params });",
      "      return rows;",
      "    }",
      "  };",
      "}",
      "",
      "test('ArchivoRepository.insert guarda los bytes en la columna bytea contenido', async () => {",
      "  const db = fakeDb([{ id: 'f-1' }]);",
      "  await new ArchivoRepository(db).insert({ id: 'f-1', employeeId: 'emp-7', nombre: 'a.pdf', tipo: 'application/pdf', contenido: Buffer.from('%PDF'), storageKey: 'emp-7/f-1.pdf', subidoEn: new Date() });",
      "  assert.ok(db.calls[0].sql.startsWith('INSERT INTO archivos (id, employee_id, nombre, tipo, contenido,'));",
      "  assert.ok(Buffer.isBuffer(db.calls[0].params[4]));",
      "});",
      "",
      "test('ArchivoRepository.findOwned filtra por empleado', async () => {",
      "  const db = fakeDb([]);",
      "  assert.equal(await new ArchivoRepository(db).findOwned('emp-9', 'f-1'), null);",
      "  assert.ok(db.calls[0].sql.includes('WHERE id = $1 AND employee_id = $2'));",
      "  assert.deepEqual(db.calls[0].params, ['f-1', 'emp-9']);",
      "});"
    ]),
    "tests/archivos/service.test.js": source([
      "'use strict';",
      "// Epic 1.1 — casos de uso de Archivos con un repositorio en memoria.",
      "const assert = require('node:assert/strict');",
      "const { test } = require('node:test');",
      "const { subirArchivo, listarArchivos, eliminarArchivo } = require('../../archivador_api/src/archivos/service');",
      "",
      "function memoryRepository() {",
      "  const rows = [];",
      "  const view = ({ id, nombre, tipo, contenido, subidoEn }) => ({ id, nombre, tipo, tamanoBytes: contenido.length, subidoEn });",
      "  return {",
      "    rows,",
      "    async insert(row) {",
      "      rows.push(row);",
      "      return view(row);",
      "    },",
      "    async listByEmployee(employeeId) {",
      "      return rows.filter((r) => r.employeeId === employeeId).map(view);",
      "    },",
      "    async findOwned(employeeId, fileId) {",
      "      const row = rows.find((r) => r.id === fileId && r.employeeId === employeeId);",
      "      return row ? view(row) : null;",
      "    },",
      "    async remove(fileId) {",
      "      rows.splice(rows.findIndex((r) => r.id === fileId), 1);",
      "    }",
      "  };",
      "}",
      "",
      "function deps(repository) {",
      "  let n = 0;",
      "  return { repository, newId: () => `f-${++n}`, now: () => new Date(Date.UTC(2026, 8, 10 + n)) };",
      "}",
      "",
      "const pdf = (text) => ({ nombre: 'Contrato.pdf', tipo: 'application/pdf', contenidoBase64: Buffer.from(text).toString('base64') });",
      "",
      "test('subirArchivo guarda el archivo del empleado y devuelve sus metadatos', async () => {",
      "  const repository = memoryRepository();",
      "  const archivo = await subirArchivo(deps(repository), 'emp-7', { ...pdf('%PDF-1.7'), nombre: '  Contrato.pdf ' });",
      "  assert.equal(archivo.nombre, 'Contrato.pdf');",
      "  assert.equal(archivo.tamanoBytes, 8);",
      "  assert.equal(repository.rows[0].employeeId, 'emp-7');",
      "  assert.ok(repository.rows[0].storageKey.startsWith('emp-7/'));",
      "});",
      "",
      "test('subirArchivo rechaza text/plain sin tocar el repositorio', async () => {",
      "  const repository = memoryRepository();",
      "  await assert.rejects(subirArchivo(deps(repository), 'emp-7', { ...pdf('hola'), tipo: 'text/plain' }), { code: 'VALIDATION_ERROR' });",
      "  assert.equal(repository.rows.length, 0);",
      "});",
      "",
      "test('subirArchivo rechaza un nombre con solo espacios', async () => {",
      "  await assert.rejects(subirArchivo(deps(memoryRepository()), 'emp-7', { ...pdf('%PDF'), nombre: '   ' }), { code: 'VALIDATION_ERROR' });",
      "});",
      "",
      "test('subirArchivo rechaza contenido que no es base64', async () => {",
      "  await assert.rejects(subirArchivo(deps(memoryRepository()), 'emp-7', { ...pdf('%PDF'), contenidoBase64: 'no es base64!' }), { code: 'VALIDATION_ERROR' });",
      "});",
      "",
      "test('listarArchivos devuelve solo los del empleado, el más reciente primero', async () => {",
      "  const d = deps(memoryRepository());",
      "  await subirArchivo(d, 'emp-7', pdf('uno'));",
      "  await subirArchivo(d, 'emp-9', pdf('ajeno'));",
      "  await subirArchivo(d, 'emp-7', pdf('tres'));",
      "  assert.deepEqual((await listarArchivos(d, 'emp-7')).map((a) => a.id), ['f-3', 'f-1']);",
      "});",
      "",
      "test('eliminarArchivo de un archivo ajeno lanza ARCHIVO_NO_ENCONTRADO y no lo borra', async () => {",
      "  const repository = memoryRepository();",
      "  const d = deps(repository);",
      "  await subirArchivo(d, 'emp-7', pdf('uno'));",
      "  await assert.rejects(eliminarArchivo(d, 'emp-9', 'f-1'), { code: 'ARCHIVO_NO_ENCONTRADO' });",
      "  assert.equal(repository.rows.length, 1);",
      "});",
      "",
      "test('eliminarArchivo de un archivo propio lo quita del listado', async () => {",
      "  const d = deps(memoryRepository());",
      "  await subirArchivo(d, 'emp-7', pdf('uno'));",
      "  await eliminarArchivo(d, 'emp-7', 'f-1');",
      "  assert.deepEqual(await listarArchivos(d, 'emp-7'), []);",
      "});"
    ]),
    "tests/archivos/quota.test.js": source([
      "'use strict';",
      "// Epic 1.4 — Cuota por tipo (RED): PDF hasta 25 MB, imágenes hasta 10 MB (RN-007).",
      "const assert = require('node:assert/strict');",
      "const { test } = require('node:test');",
      "const limits = require('../../archivador_api/src/archivos/limits');",
      "",
      "const { MB } = limits;",
      "",
      "test('maxBytesFor da 25 MB a un PDF', () => {",
      "  assert.equal(limits.maxBytesFor('application/pdf'), 25 * MB);",
      "});",
      "",
      "test('maxBytesFor deja las imágenes en 10 MB', () => {",
      "  assert.equal(limits.maxBytesFor('image/png'), 10 * MB);",
      "  assert.equal(limits.maxBytesFor('image/jpeg'), 10 * MB);",
      "});",
      "",
      "test('validateSize acepta un PDF de 20 MB', () => {",
      "  assert.equal(limits.validateSize(20 * MB, 'application/pdf'), 20 * MB);",
      "});",
      "",
      "test('validateSize acepta un PDF de exactamente 25 MB', () => {",
      "  assert.equal(limits.validateSize(25 * MB, 'application/pdf'), 25 * MB);",
      "});"
    ])
  };
}

// A spec in the SPEC_TEMPLATE layout; every epic of stage 4 lives in the Archivos module.
function specDoc(s) {
  const section = (title, rows) => (rows && rows.length > 0 ? ["", `## ${title}`, ...rows] : []);
  return source([
    `# SPEC: ${s.name} — id: ${s.id}`,
    "",
    `**Epic:** ${s.epic}   **Módulo:** Archivos (\`archivador_api/src/archivos/\`)`,
    ...section("Objetivo", [s.objetivo]),
    ...section("Fuera de Scope (NO testear, NO implementar)", s.fuera),
    ...section("Operaciones del Contrato de API (si el spec toca un boundary HTTP)", [s.ops]),
    ...section("Contrato (machine-readable — identificadores en el idioma de conventions.md §8)", [
      "| Aspecto | Detalle |",
      "|---------|---------|",
      ...s.contrato.map(([aspect, detail]) => `| ${aspect} | ${detail} |`)
    ]),
    ...section("Reglas de Negocio", s.brs),
    ...section("Criterios de Aceptación (≥1 test por ID)", s.acs),
    ...section("Edge Cases (los que cambian comportamiento — NO exhaustivo)", s.ecs),
    ...section("Guards de no-regresión (nacen verdes — omitir si no aplica)", s.guards),
    ...section("Supersesiones de tests sellados (omitir si no aplica)", s.supersedes),
    ...section("Aclaraciones (resueltas en planificación)", s.aclaraciones),
    ...section("Superficie de Código Existente (para el implementer — lo llena el spec-planner)", s.superficie)
  ]);
}

// A `_planning.md` in the PLANNING_TEMPLATE layout. The MECH_CHECK line carries the real
// coverage hash, so `spec-set-check.js --hash-only` matches it (the validator requires the line).
function planningDoc(epicSlug, { table, resolved, supersessions = null, mechAt, tail = () => [] }) {
  const tableBlock = ["## COVERAGE_TABLE", ...table];
  const hash = planning.coverageHash(tableBlock.join("\n"));
  return source([
    `# Planning — ${epicSlug}`,
    "",
    ...tableBlock,
    "",
    "## OPEN_QUESTIONS",
    "(ninguna)",
    "",
    "## RESOLVED_ALONE",
    ...resolved,
    ...(supersessions ? ["", "## SUPERSESIONES", ...supersessions] : []),
    "",
    "## MECH_CHECK (coordinador — una línea por corrida; la última es la vigente)",
    `- MECH_CHECK: PASS ${hash} — ${mechAt} — corrida 1 (primera pasada)`,
    ...tail(hash)
  ]);
}

function approvedVerdict(header, hash) {
  return ["", "## VEREDICTOS (coordinador — verbatim)", `### set — dispatch 1 — ${header}`, "```", "STATUS: APPROVED", "", "VIOLATIONS:", "None", "", "NOTES:", `MECH_CHECK: PASS ${hash}.`, "```"];
}

// `_planning.md` of Epic 1.4 at each point of its history: `pendiente` at the plan commit; the
// verdict, SPEC_SHA and LOCK_SHA (and the test-writer's `sin cambio`) in the next one. Without
// git there is no tree/head/SHA to record, so the verdict header carries only the round and time.
function epic14Planning({ supersedeCommit, verdict = false, tree = null, head = null, specSha = null, lockSha = null }) {
  const [supPath, supTest] = FALSE_SUPERSEDE.split("::");
  return planningDoc("epic-1.4-cuota", {
    table: ["- op: subirArchivo → 01-cuota-por-tipo (implementa)", "- br: RN-007 → 01-cuota-por-tipo [BR-1]", `- sup: ${supPath}::${supTest} → 01-cuota-por-tipo (BR-1)`],
    resolved: ['- R-1 — el tope se mide sobre el tamaño decodificado — fuente: RN-001 — cita: "Un archivo pesa como máximo"'],
    supersessions: [`- ${FALSE_SUPERSEDE} — motivo: BR-1 — spec: 01-cuota-por-tipo — commit: ${supersedeCommit}`],
    mechAt: STAGE4_TIMES.mech,
    tail: (hash) => [
      ...(verdict ? approvedVerdict(`ronda 1 — ${STAGE4_TIMES.verdict}${tree ? ` — tree ${tree.slice(0, 12)} — head ${head.slice(0, 12)}` : ""}`, hash) : []),
      ...(specSha ? ["", "## SPEC_SHA (coordinador)", `- LOCK_SHA: ${lockSha} — ${STAGE4_TIMES.lock}`, `- SPEC_SHA: ${specSha} — ${STAGE4_TIMES.plan} — primer sello`] : [])
    ]
  });
}

const OPS_SUBIR = "- **Implementa** (spec de backend): `operationId` — `[subirArchivo]`";

// Specs + `_planning.md` of every epic directory of stage 4.
function stage4Specs() {
  const out = {};
  const sup = (full) => {
    const [p, t] = full.split("::");
    return `- Supersede: \`${p}::${t}\` — motivo: BR-1 — epic origen: epic-1.1-archivos`;
  };

  // Epic 1.1 [x] — the closed epic whose tests the baits break; GUARD-1 protects a test.
  out["docs/05-specs/epic-1.1-archivos/01-subir-archivo.spec.md"] = specDoc({
    name: "Subir archivo",
    id: "epic-1.1-archivos/01-subir-archivo",
    epic: "Epic 1.1 Archivos",
    objetivo: "Un empleado sube un archivo (PDF, PNG o JPEG de hasta 10 MB) y queda guardado en su archivador: los bytes en PostgreSQL (ADR-001) y una clave de almacenamiento que cuelga de su id.",
    fuera: ["- Listar y eliminar archivos (spec 02).", "- Etiquetas (Epic 1.3).", "- Router HTTP y lectura del header `X-Employee-Id` (capa HTTP, R-1): el caso de uso recibe `employeeId`."],
    ops: OPS_SUBIR,
    contrato: [
      ["Entradas", "`employeeId`: string (del header `X-Employee-Id`); `nombre`: string (RN-002); `tipo`: `application/pdf`, `image/png` o `image/jpeg`; `contenidoBase64`: string (≤ 10 MB decodificado)"],
      ["Salidas (éxito)", "`Archivo` `{ id, nombre, tipo, tamanoBytes, subidoEn }` (201 en el contrato)"],
      ["Salidas (error)", "nombre, tipo, tamaño o base64 inválidos → `ValidationError` `VALIDATION_ERROR` (400)"],
      ["Efectos secundarios", "inserta una fila en `archivos`: los bytes en `contenido` (bytea, ADR-001) y `storage_key` `<empleado>/<archivo>.<ext>`"],
      ["Idempotencia", "no: cada llamada crea un archivo nuevo aunque el nombre se repita"]
    ],
    brs: ["- **BR-1:** Máximo 10 MB y tipo permitido — fuente: `RN-001` de business_requirements.md", "- **BR-2:** `nombre` sin espacios sobrantes, no vacío, ≤ 200 caracteres — fuente: `RN-002` de business_requirements.md"],
    acs: [
      "- **AC-1:** Un PDF válido se guarda para el empleado y devuelve su `Archivo` con `tamanoBytes` igual al tamaño decodificado.",
      "- **AC-2:** Un archivo `text/plain` se rechaza con `VALIDATION_ERROR` sin tocar el repositorio.",
      "- **AC-3:** Un archivo de exactamente 10 MB se acepta.",
      "- **AC-4:** Un PDF de 10 MB + 1 byte se rechaza con `VALIDATION_ERROR`; una imagen de 10 MB + 1 byte también.",
      "- **AC-5:** La clave de almacenamiento es `<empleado>/<archivo>.<ext>`, con la extensión en minúsculas y sin el nombre original."
    ],
    ecs: ["- **EC-1:** `contenidoBase64` que no es base64 válido → `VALIDATION_ERROR`.", "- **EC-2:** `nombre` con solo espacios → `VALIDATION_ERROR`."],
    aclaraciones: ['- R-1: idempotencia de `subirArchivo` → no idempotente — fuente: RN-001 "cualquier otro caso se rechaza" (solo valida; nada prohíbe duplicados)'],
    superficie: [
      "- Crea: `ValidationError` en `archivador_api/src/archivos/validation-error.js` — firma: `class ValidationError extends Error { code: 'VALIDATION_ERROR' }`",
      "- Crea: `validateType`, `validateSize` en `archivador_api/src/archivos/limits.js` — firma: `validateType(tipo: string): string; validateSize(bytes: number, tipo: string): number` (exporta también `MB`, `MAX_FILE_MB = 10`, `ALLOWED_TYPES`)",
      "- Crea: `buildStorageName` en `archivador_api/src/archivos/naming.js` — firma: `buildStorageName(employeeId: string, fileId: string, originalName: string): string`",
      "- Crea: `ArchivoRepository` en `archivador_api/src/archivos/repository.js` — firma: `class ArchivoRepository { constructor(db); insert(row): Promise<Archivo>; listByEmployee(employeeId): Promise<Archivo[]>; findOwned(employeeId, fileId): Promise<Archivo | null>; remove(fileId): Promise<void> }`",
      "- Crea: `subirArchivo` en `archivador_api/src/archivos/service.js` — firma: `subirArchivo(deps: { repository, newId, now }, employeeId: string, input: { nombre, tipo, contenidoBase64 }): Promise<Archivo>`",
      "- Fixtures disponibles: ninguno"
    ]
  });
  out["docs/05-specs/epic-1.1-archivos/02-listar-y-eliminar.spec.md"] = specDoc({
    name: "Listar y eliminar archivos",
    id: "epic-1.1-archivos/02-listar-y-eliminar",
    epic: "Epic 1.1 Archivos",
    objetivo: "Un empleado ve la lista de sus propios archivos, del más reciente al más antiguo, y puede eliminar uno propio; para cualquier otro empleado ese archivo no existe.",
    fuera: ["- Subir archivos (spec 01).", "- Paginación del listado.", "- Router HTTP y lectura del header `X-Employee-Id` (capa HTTP, R-1)."],
    ops: "- **Implementa** (spec de backend): `operationId` — `[listarArchivos, eliminarArchivo]`",
    contrato: [
      ["Entradas", "`employeeId`: string; `fileId`: string (eliminar)"],
      ["Salidas (éxito)", "`listarArchivos`: `Archivo[]` ordenado por `subidoEn` descendente, `[]` si no hay; `eliminarArchivo`: nada (204 en el contrato)"],
      ["Salidas (error)", "eliminar un archivo inexistente o ajeno → `FileNotFoundError` `ARCHIVO_NO_ENCONTRADO` (404)"],
      ["Efectos secundarios", "`eliminarArchivo` borra la fila de `archivos`, bytes incluidos"],
      ["Idempotencia", "listar: sí; eliminar: no (el segundo intento da `ARCHIVO_NO_ENCONTRADO`)"]
    ],
    brs: ["- **BR-1:** Solo el dueño lista o elimina sus archivos; para otro empleado no existen — fuente: `RN-006` de business_requirements.md"],
    acs: [
      "- **AC-1:** Con dos archivos propios y uno ajeno, `listarArchivos` devuelve solo los dos propios, el más reciente primero.",
      "- **AC-2:** Eliminar un archivo ajeno lanza `ARCHIVO_NO_ENCONTRADO` y no lo borra.",
      "- **AC-3:** Eliminar un archivo propio lo quita del listado."
    ],
    ecs: ["- **EC-1:** Sin archivos, `listarArchivos` devuelve `[]`."],
    guards: ["- **GUARD-1:** subir sigue rechazando un tipo no permitido sin escribir en el repositorio (este spec modifica `service.js`) → test: `tests/archivos/service.test.js::subirArchivo rechaza text/plain sin tocar el repositorio`"],
    aclaraciones: ['- R-2: orden del listado → `subidoEn` descendente — fuente: api-contract.md "orden: `subidoEn` descendente"'],
    superficie: [
      "- Crea: `FileNotFoundError` en `archivador_api/src/archivos/file-not-found-error.js` — firma: `class FileNotFoundError extends Error { code: 'ARCHIVO_NO_ENCONTRADO' }`",
      "- Crea: `listarArchivos` en `archivador_api/src/archivos/service.js` — firma: `listarArchivos(deps: { repository }, employeeId: string): Promise<Archivo[]>`",
      "- Crea: `eliminarArchivo` en `archivador_api/src/archivos/service.js` — firma: `eliminarArchivo(deps: { repository }, employeeId: string, fileId: string): Promise<void>`",
      "- Llama a: `ArchivoRepository.listByEmployee`, `ArchivoRepository.findOwned`, `ArchivoRepository.remove` en `archivador_api/src/archivos/repository.js`"
    ]
  });
  out["docs/05-specs/epic-1.1-archivos/_planning.md"] = planningDoc("epic-1.1-archivos", {
    table: [
      "- op: subirArchivo → 01-subir-archivo (implementa)",
      "- op: listarArchivos → 02-listar-y-eliminar (implementa)",
      "- op: eliminarArchivo → 02-listar-y-eliminar (implementa)",
      "- br: RN-001 → 01-subir-archivo [BR-1]",
      "- br: RN-002 → 01-subir-archivo [BR-2]",
      "- br: RN-006 → 02-listar-y-eliminar [BR-1]",
      "- oos: paginación del listado → diferido a: fuera del epic"
    ],
    resolved: [
      '- R-1 — subirArchivo no es idempotente — fuente: RN-001 — cita: "cualquier otro caso se rechaza con un error de validación"',
      '- R-2 — orden del listado: subidoEn descendente — fuente: api-contract.md §tabla — cita: "orden: `subidoEn` descendente"'
    ],
    mechAt: "2026-09-02T10:00:00-03:00",
    tail: (hash) => approvedVerdict("2026-09-02", hash)
  });

  // Epic 1.4 [/] — E2 (the undeclared PDF test) and E3 (the false supersession, declared).
  out[`${STAGE4_EPIC}/01-cuota-por-tipo.spec.md`] = specDoc({
    name: "Cuota por tipo",
    id: "epic-1.4-cuota/01-cuota-por-tipo",
    epic: "Epic 1.4 Cuota por tipo",
    objetivo: "`subirArchivo` acepta PDF de hasta 25 MB; las imágenes conservan el tope de 10 MB.",
    fuera: ["- Tipos de archivo nuevos (Epic 1.8).", "- Cuota total por empleado.", "- Tipo sin distinguir mayúsculas (Epic 1.7)."],
    ops: OPS_SUBIR,
    contrato: [
      ["Entradas", "las de `subirArchivo` (Epic 1.1); el tope depende de `tipo`"],
      ["Salidas (éxito)", "`Archivo` (201)"],
      ["Salidas (error)", "PDF de más de 25 MB o imagen de más de 10 MB → `VALIDATION_ERROR` (400)"],
      ["Efectos secundarios", "ninguno nuevo"],
      ["Idempotencia", "sin cambio (no idempotente)"]
    ],
    brs: ["- **BR-1:** PDF ≤ 25 MB; `image/png` e `image/jpeg` ≤ 10 MB — fuente: `RN-007` de business_requirements.md (reemplaza el tope único de 10 MB de RN-001)"],
    acs: [
      "- **AC-1:** El tope de un PDF es 25 MB (`maxBytesFor('application/pdf')`).",
      "- **AC-2:** El tope de `image/png` e `image/jpeg` sigue en 10 MB (`maxBytesFor`).",
      "- **AC-3:** Un PDF de 20 MB pasa `validateSize`."
    ],
    ecs: ["- **EC-1:** Un PDF de exactamente 25 MB pasa `validateSize`."],
    supersedes: [sup(FALSE_SUPERSEDE)],
    aclaraciones: ['- R-1: ¿el tope se mide sobre el tamaño decodificado? → sí — fuente: RN-001 "Un archivo pesa como máximo" (mismo criterio que el tope anterior)'],
    superficie: [
      "- Crea: `maxBytesFor` en `archivador_api/src/archivos/limits.js` — firma: `maxBytesFor(tipo: string): number`",
      "- Modifica: `validateSize` en `archivador_api/src/archivos/limits.js` — el tope sale de `maxBytesFor(tipo)`; firma sin cambio: `validateSize(bytes: number, tipo: string): number`"
    ]
  });
  out[`${STAGE4_EPIC}/_planning.md`] = epic14Planning({ supersedeCommit: "sin cambio", verdict: true });

  // Epic 1.5 [ ] — G1/G4/G5 (incomplete list, deferred scope) and E1 (the rename).
  const namingSup = "tests/archivos/naming.test.js::buildStorageName arma empleado/archivo.extension";
  out["docs/05-specs/epic-1.5-clave/01-clave-por-mes.spec.md"] = specDoc({
    name: "Clave por mes",
    id: "epic-1.5-clave/01-clave-por-mes",
    epic: "Epic 1.5 Clave de almacenamiento por mes",
    objetivo: "La clave de almacenamiento de cada archivo nuevo agrupa por mes de subida (`<empleado>/<AAAA-MM>/<archivo>.<ext>`) para el respaldo mensual, y la función que la arma adopta el término del glosario: `buildStorageKey`.",
    fuera: ["- Migrar las claves de los archivos ya guardados: conservan la forma `<empleado>/<archivo>.<ext>`.", "- El respaldo mensual en sí."],
    ops: "- **Sin boundary HTTP:** N/A — lógica interna (la clave no viaja en ninguna respuesta).",
    contrato: [
      ["Entradas", "`employeeId`: string, `fileId`: string, `originalName`: string, `uploadedAt`: Date"],
      ["Salidas (éxito)", "string `<employeeId>/<AAAA-MM>/<fileId>.<ext>`; sin extensión → `<employeeId>/<AAAA-MM>/<fileId>`"],
      ["Salidas (error)", "ninguna: `subirArchivo` ya validó las entradas"],
      ["Efectos secundarios", "ninguno; `subirArchivo` guarda la clave en `archivos.storage_key`"],
      ["Idempotencia", "sí: función pura"]
    ],
    brs: ["- **BR-1:** La clave agrupa por mes de subida en UTC: `<empleado>/<AAAA-MM>/<archivo>.<extensión>`, con la extensión en minúsculas — fuente: `RN-008` de business_requirements.md"],
    acs: [
      "- **AC-1:** `buildStorageKey('emp-7', 'f-1', 'Contrato Final.PDF', 2026-09-15T12:00:00Z)` devuelve `emp-7/2026-09/f-1.pdf`.",
      "- **AC-2:** Un archivo subido el 2026-10-01T02:00:00Z queda bajo `2026-10`, aunque en la zona del servidor todavía sea septiembre.",
      "- **AC-3:** `subirArchivo` guarda en `storage_key` la clave con el mes de su `now()`."
    ],
    ecs: ["- **EC-1:** Nombre original sin extensión → `emp-7/2026-09/f-1`."],
    supersedes: [sup(namingSup)],
    aclaraciones: ['- R-1: ¿mes local o UTC? → UTC — fuente: RN-008 "mes de subida (UTC)"'],
    superficie: [
      "- Modifica: `buildStorageName` en `archivador_api/src/archivos/naming.js` — se renombra `buildStorageKey` (término del glosario, RN-008) y recibe `uploadedAt`; `buildStorageName` deja de exportarse, sin alias — firma: `buildStorageKey(employeeId: string, fileId: string, originalName: string, uploadedAt: Date): string`",
      "- Modifica: `subirArchivo` en `archivador_api/src/archivos/service.js` — arma la clave con `buildStorageKey(..., now())`"
    ]
  });
  out["docs/05-specs/epic-1.5-clave/_planning.md"] = planningDoc("epic-1.5-clave", {
    table: [
      "- br: RN-008 → 01-clave-por-mes [BR-1]",
      "- oos: migrar las claves de los archivos ya guardados → diferido a: fuera del epic",
      `- sup: ${namingSup} → 01-clave-por-mes (BR-1)`
    ],
    resolved: ['- R-1 — el mes se toma en UTC — fuente: RN-008 — cita: "mes de subida (UTC)"'],
    supersessions: [`- ${namingSup} — motivo: BR-1 — spec: 01-clave-por-mes — commit: pendiente`],
    mechAt: STAGE4_TIMES.planned
  });

  // Epic 1.6 [ ] — G2/G6: bytes on local disk against ADR-001 (Accepted), never naming it.
  out["docs/05-specs/epic-1.6-dedup/01-contenido-compartido.spec.md"] = specDoc({
    name: "Contenido compartido",
    id: "epic-1.6-dedup/01-contenido-compartido",
    epic: "Epic 1.6 Contenido deduplicado",
    objetivo: "Cuando un empleado sube dos veces los mismos bytes se guarda una sola copia, y los dos archivos la comparten; cada uno conserva su id, su nombre y su fecha.",
    fuera: ["- Deduplicar entre empleados distintos (cada empleado tiene sus propias copias, RN-006).", "- Recuperar el espacio de los archivos guardados antes de este epic."],
    ops: OPS_SUBIR,
    contrato: [
      ["Entradas", "las de `subirArchivo` (Epic 1.1)"],
      ["Salidas (éxito)", "201 `Archivo` (sin cambio de shape)"],
      ["Salidas (error)", "sin cambio"],
      ["Efectos secundarios", "los bytes se escriben una sola vez en `archivador_api/var/blobs/<employeeId>/<sha256>` (disco local del servidor) y la fila de `archivos` guarda `blob_path` en lugar de `contenido`; un segundo archivo con los mismos bytes reutiliza el mismo `blob_path`"],
      ["Idempotencia", "sin cambio (cada subida crea un `Archivo` nuevo)"]
    ],
    brs: [
      "- **BR-1:** Los mismos bytes subidos por el mismo empleado se guardan una sola vez — fuente: `RN-009` de business_requirements.md",
      "- **BR-2:** Cada archivo conserva su propio id, nombre y fecha de subida — fuente: `RN-009` de business_requirements.md"
    ],
    acs: [
      "- **AC-1:** Subir dos veces el mismo PDF crea dos `Archivo` con ids distintos y un solo blob bajo `archivador_api/var/blobs/emp-7/`.",
      "- **AC-2:** Dos PDF con contenidos distintos crean dos blobs."
    ],
    ecs: ["- **EC-1:** El mismo contenido subido por dos empleados distintos produce dos blobs, uno por empleado."],
    aclaraciones: ['- R-1: ¿dónde vive la copia única? → en un directorio por empleado direccionado por hash, fuera de la tabla, para no repetir el `bytea` — fuente: RN-009 "se guarda una sola copia de los bytes"'],
    superficie: [
      "- Crea: `BlobStore` en `archivador_api/src/archivos/blob-store.js` — firma: `class BlobStore { constructor(rootDir: string); put(employeeId: string, bytes: Buffer): Promise<string> }`",
      "- Modifica: `subirArchivo` en `archivador_api/src/archivos/service.js`",
      "- Modifica: `ArchivoRepository` en `archivador_api/src/archivos/repository.js` — columna `blob_path` en lugar de `contenido`"
    ]
  });
  out["docs/05-specs/epic-1.6-dedup/_planning.md"] = planningDoc("epic-1.6-dedup", {
    table: ["- op: subirArchivo → 01-contenido-compartido (implementa)", "- br: RN-009 → 01-contenido-compartido [BR-1, BR-2]"],
    resolved: ['- R-1 — la copia única vive en disco, en un directorio por empleado direccionado por hash — fuente: RN-009 — cita: "se guarda una sola copia de los bytes"'],
    mechAt: STAGE4_TIMES.planned
  });

  // Epic 1.7 [ ] — G3/G7: AC-1 against AC-3.
  out["docs/05-specs/epic-1.7-tipo/01-tipo-normalizado.spec.md"] = specDoc({
    name: "Tipo normalizado",
    id: "epic-1.7-tipo/01-tipo-normalizado",
    epic: "Epic 1.7 Tipo sin distinguir mayúsculas",
    objetivo: "`subirArchivo` acepta el tipo en cualquier combinación de mayúsculas y minúsculas (`APPLICATION/PDF`, `Image/Png`).",
    fuera: ["- Tipos nuevos (Epic 1.8).", "- Deducir el tipo a partir del contenido."],
    ops: OPS_SUBIR,
    contrato: [
      ["Entradas", "las de `subirArchivo`; `tipo` sin distinguir mayúsculas"],
      ["Salidas (éxito)", "201 `Archivo`"],
      ["Salidas (error)", "tipo no permitido, en cualquier grafía → 400 `VALIDATION_ERROR`"],
      ["Efectos secundarios", "la fila de `archivos` guarda `tipo` en minúsculas"],
      ["Idempotencia", "sin cambio"]
    ],
    brs: ["- **BR-1:** El tipo se compara sin distinguir mayúsculas — fuente: `RN-010` de business_requirements.md", "- **BR-2:** El tipo se guarda en minúsculas — fuente: `RN-010` de business_requirements.md"],
    acs: [
      "- **AC-1:** Subir un PDF de 1 MB con `tipo: APPLICATION/PDF` devuelve 201 y el `Archivo` devuelto tiene `tipo: application/pdf`.",
      "- **AC-2:** `tipo: Image/Png` de 2 MB devuelve 201.",
      "- **AC-3:** El `Archivo` que devuelve `subirArchivo` muestra el `tipo` tal como lo envió el cliente: con `tipo: APPLICATION/PDF` devuelve `tipo: APPLICATION/PDF`, así la app web muestra lo que eligió el usuario.",
      "- **AC-4:** `tipo: TEXT/PLAIN` devuelve 400 `VALIDATION_ERROR`."
    ],
    ecs: ["- **EC-1:** `tipo` con espacios alrededor (` application/pdf `) → 400 `VALIDATION_ERROR`: solo se ignoran las mayúsculas."],
    aclaraciones: ['- R-1: ¿`TEXT/PLAIN` se acepta al ignorar las mayúsculas? → no: sigue fuera de los tipos permitidos — fuente: RN-001 "cualquier otro caso se rechaza con un error de validación"'],
    superficie: [
      "- Modifica: `validateType` en `archivador_api/src/archivos/limits.js` — devuelve el tipo en minúsculas — firma: `validateType(tipo: string): string`",
      "- Modifica: `subirArchivo` en `archivador_api/src/archivos/service.js`"
    ]
  });
  out["docs/05-specs/epic-1.7-tipo/_planning.md"] = planningDoc("epic-1.7-tipo", {
    table: ["- op: subirArchivo → 01-tipo-normalizado (implementa)", "- br: RN-010 → 01-tipo-normalizado [BR-1, BR-2]"],
    resolved: ['- R-1 — TEXT/PLAIN sigue rechazado — fuente: RN-001 — cita: "cualquier otro caso se rechaza con un error de validación"'],
    mechAt: STAGE4_TIMES.planned
  });

  // Epic 1.8 [ ] — PROTECTED: supersedes the test of R-3 (verify:) and the GUARD-1 of Epic 1.1.
  const protectedByRule = "tests/archivos/limits.test.js::validateType rechaza text/plain";
  const protectedByGuard = "tests/archivos/service.test.js::subirArchivo rechaza text/plain sin tocar el repositorio";
  out["docs/05-specs/epic-1.8-texto/01-texto-plano.spec.md"] = specDoc({
    name: "Texto plano",
    id: "epic-1.8-texto/01-texto-plano",
    epic: "Epic 1.8 Documentos de texto",
    objetivo: "Un empleado puede subir documentos de texto (`text/plain`) de hasta 1 MB, además de PDF e imágenes.",
    fuera: ["- Otros tipos de texto (`text/csv`, `text/markdown`).", "- Vista previa del texto."],
    ops: OPS_SUBIR,
    contrato: [
      ["Entradas", "las de `subirArchivo`; `tipo` admite además `text/plain`"],
      ["Salidas (éxito)", "201 `Archivo`"],
      ["Salidas (error)", "`text/plain` de más de 1 MB → 400 `VALIDATION_ERROR`; cualquier otro tipo no permitido → 400 `VALIDATION_ERROR`"],
      ["Efectos secundarios", "ninguno nuevo (bytea, ADR-001)"],
      ["Idempotencia", "sin cambio"]
    ],
    brs: ["- **BR-1:** `text/plain` se admite con un tope de 1 MB — fuente: `RN-011` de business_requirements.md (amplía los tipos de RN-001)"],
    acs: ["- **AC-1:** Un `text/plain` de 500 KB se acepta.", "- **AC-2:** Un `text/plain` de 1 MB + 1 byte se rechaza con `VALIDATION_ERROR`.", "- **AC-3:** Un `text/csv` se sigue rechazando con `VALIDATION_ERROR`."],
    ecs: ["- **EC-1:** Un `text/plain` de exactamente 1 MB se acepta."],
    supersedes: [sup(protectedByRule), sup(protectedByGuard)],
    aclaraciones: ['- R-1: ¿1 MB decodificado? → sí — fuente: RN-001 "Un archivo pesa como máximo" (mismo criterio que los demás topes)'],
    superficie: [
      "- Modifica: `ALLOWED_TYPES` en `archivador_api/src/archivos/limits.js` — agrega `text/plain`",
      "- Modifica: `validateSize` en `archivador_api/src/archivos/limits.js` — tope de 1 MB para `text/plain`"
    ]
  });
  out["docs/05-specs/epic-1.8-texto/_planning.md"] = planningDoc("epic-1.8-texto", {
    table: [
      "- op: subirArchivo → 01-texto-plano (implementa)",
      "- br: RN-011 → 01-texto-plano [BR-1]",
      `- sup: ${protectedByRule} → 01-texto-plano (BR-1)`,
      `- sup: ${protectedByGuard} → 01-texto-plano (BR-1)`
    ],
    resolved: ['- R-1 — el tope de 1 MB se mide decodificado — fuente: RN-001 — cita: "Un archivo pesa como máximo"'],
    supersessions: [
      `- ${protectedByRule} — motivo: BR-1 — spec: 01-texto-plano — commit: pendiente`,
      `- ${protectedByGuard} — motivo: BR-1 — spec: 01-texto-plano — commit: pendiente`
    ],
    mechAt: STAGE4_TIMES.planned
  });
  return out;
}

const STAGE4_EPICS = [
  ["1.5", "Clave de almacenamiento por mes", "La clave de almacenamiento agrupa los archivos por mes de subida y el código adopta el término del glosario.", "RN-008", null],
  ["1.6", "Contenido deduplicado", "Si un empleado sube dos veces el mismo contenido, los bytes se guardan una sola vez.", "RN-009", "`subirArchivo`"],
  ["1.7", "Tipo sin distinguir mayúsculas", "`subirArchivo` acepta el tipo en cualquier combinación de mayúsculas y lo guarda normalizado.", "RN-010", "`subirArchivo`"],
  ["1.8", "Documentos de texto", "Se admiten archivos `text/plain` de hasta 1 MB.", "RN-011", "`subirArchivo`"]
];

// Stage 4 = the stage-3 tree with Epic 1.1 on real code, Epic 1.4 [/] (RED at HEAD), the bait
// epics 1.5-1.8 and the project-level bait of G8 (HU-ARC-004 without operation, RN-012 without
// epic). This is the HEAD state; `stage4History` derives the commits of --git from it.
function stage4Files(files) {
  const out = { ...files };
  for (const rel of ["docs/05-specs/epic-1.1-archivos/02-listar-archivos.spec.md", "tests/.gitkeep", "archivador_api/src/archivos/.gitkeep"]) delete out[rel];
  Object.assign(out, stage4Code(), stage4Specs());

  out[".specture/stack.yml"] = out[".specture/stack.yml"].replace('  testing_framework: "vitest"', '  testing_framework: "node:test"');
  out[".specture/conventions.md"] = out[".specture/conventions.md"]
    .replace("| Tests | `archivador_api/tests/<feature>/` ·", "| Tests | `tests/<feature>/` (registrados en `tests/all.test.js`) ·")
    .replace(
      /## 7\. Testing\n[\s\S]*?(?=\n## 8\.)/,
      [
        "## 7. Testing",
        "- **Política TDD:** Estricta",
        "- **Framework:** `node:test` + `node:assert/strict` (sin dependencias npm)",
        "- **Comando de la suite:** `npm test` (= `node --test tests/all.test.js`). El agregador `tests/all.test.js` hace `require` de cada archivo de test en un solo proceso: un import roto tumba la suite entera. Todo archivo de test nuevo se registra ahí.",
        "- **Globs de tests:** `tests/**/*.test.js`",
        "- **Mocks:** solo para integraciones externas (la base de datos se reemplaza por un repositorio en memoria o un `db` falso)",
        ""
      ].join("\n")
    );
  out[".specture/rules.yml"] =
    out[".specture/rules.yml"].trimEnd() +
    "\n" +
    source([
      "  - id: R-3",
      "    tags: [backend, api]",
      '    rule: "Solo se aceptan archivos application/pdf, image/png o image/jpeg; cualquier otro tipo se rechaza con 400 VALIDATION_ERROR"',
      '    verify: "test: `tests/archivos/limits.test.js::validateType rechaza text/plain`"',
      "    severity: BLOCKER",
      '    source: "RN-001 · docs/02-architecture/api-contract.md"'
    ]);
  out["docs/02-architecture/architecture.md"] = out["docs/02-architecture/architecture.md"].replace(
    "- **Persistencia:** tabla `archivos` (bytea, ADR-001).",
    "- **Persistencia:** tabla `archivos`: los bytes en la columna `contenido` (bytea, ADR-001) y una `storage_key` única por fila."
  );
  out["docs/01-requirements/business_requirements.md"] = out["docs/01-requirements/business_requirements.md"]
    .replace(/^(- \*\*HU-ARC-003:\*\*.*)$/m, "$1\n- **HU-ARC-004:** Como empleado quiero descargar un archivo propio · Actor: Empleado · Exposición: `UI`")
    .replace(/^(- \*\*HU-ARC-003\*\* — .*)$/m, "$1\n- **HU-ARC-004** — consumidor: app web — descargar un archivo propio")
    .replace(
      /^(- \*\*RN-007:\*\*.*)$/m,
      [
        "$1",
        "- **RN-008:** Cada archivo tiene una clave de almacenamiento `<empleado>/<AAAA-MM>/<archivo>.<extensión>`: agrupa los archivos por mes de subida (UTC) para el respaldo mensual; la extensión va en minúsculas.",
        "- **RN-009:** Si un empleado sube dos veces el mismo contenido (mismos bytes), se guarda una sola copia de los bytes; cada archivo conserva su propio id, nombre y fecha de subida.",
        "- **RN-010:** El tipo de un archivo se compara sin distinguir mayúsculas (`APPLICATION/PDF` equivale a `application/pdf`) y se guarda en minúsculas.",
        "- **RN-011:** También se admiten documentos de texto (`text/plain`) de hasta 1 MB (amplía los tipos de RN-001).",
        "- **RN-012:** Solo el dueño puede descargar un archivo; la descarga entrega los bytes originales con el nombre con que se subió."
      ].join("\n")
    )
    .replace(/^(- \*\*Archivador\*\* — .*)$/m, "$1\n- **Clave de almacenamiento** — identificador lógico y único de cada archivo (`storage_key`), independiente de su nombre visible.");
  out["docs/04-roadmap/ROADMAP.md"] = out["docs/04-roadmap/ROADMAP.md"].replace("- [x] **Epic 1.4:**", "- [/] **Epic 1.4:**").replace(
    "\n### Milestone 2:",
    [
      ...STAGE4_EPICS.flatMap(([id, title, description, rn, ops]) => [
        "",
        `- [ ] **Epic ${id}:** ${title}`,
        "  - **Dependencias:** Epic 1.1",
        `  - **Descripción:** ${description}`,
        `  - **Reglas de negocio clave:** ${rn}`,
        "  - **Componentes de arquitectura involucrados:** Archivos",
        ...(ops ? [`  - **Operaciones del contrato:** ${ops}`] : []),
        "  - **Specs estimados:** 1"
      ]),
      "",
      "### Milestone 2:"
    ].join("\n")
  );
  return out;
}

// The commits of `--stage 4 --git`, oldest first: each step writes `files(shas)` (the shas of the
// earlier steps are known by then) and commits only those paths, at a fixed date.
function stage4History(files) {
  const roadmap = "docs/04-roadmap/ROADMAP.md";
  const spec = `${STAGE4_EPIC}/01-cuota-por-tipo.spec.md`;
  const plan = `${STAGE4_EPIC}/_planning.md`;
  const red = "tests/archivos/quota.test.js";
  const base = { ...files, "tests/all.test.js": allTestsFile(false), [roadmap]: files[roadmap].replace("- [/] **Epic 1.4:**", "- [ ] **Epic 1.4:**") };
  for (const rel of [spec, plan, red]) delete base[rel];
  return [
    { key: "base", date: STAGE4_TIMES.base, message: "chore: fixture Archivador (stage 4) — Epic 1.1 cerrado con código y tests", files: () => base },
    { key: "lock", date: STAGE4_TIMES.lock, message: "chore(roadmap): Epic 1.4 Cuota por tipo → [/]", files: () => ({ [roadmap]: files[roadmap] }) },
    { key: "plan", date: STAGE4_TIMES.plan, message: "docs(specs): plan epic-1.4-cuota — 1 spec validado", files: () => ({ [spec]: files[spec], [plan]: epic14Planning({ supersedeCommit: "pendiente" }) }) },
    {
      key: "verdict",
      date: STAGE4_TIMES.bookkeeping,
      message: "docs(specs): epic-1.4-cuota — veredicto, SPEC_SHA y supersesión declarada sin cambio",
      files: (s) => ({ [plan]: epic14Planning({ supersedeCommit: "sin cambio", verdict: true, tree: s.tree, head: s.lock, specSha: s.plan, lockSha: s.lock }) })
    },
    { key: "red", date: STAGE4_TIMES.red, message: "test(red): epic-1.4-cuota/01-cuota-por-tipo — 4 tests", files: () => ({ [red]: files[red], "tests/all.test.js": files["tests/all.test.js"] }) }
  ];
}

// ---------------------------------------------------------------------------
// Stage 5 — review-stage probes (docs/review-stage-baseline.md, v2.3.0)
// ---------------------------------------------------------------------------

const STAGE5_BATCH = ["2.1", "2.2", "2.3"];
const STAGE5_TIMES = { base: "2026-09-29T09:00:00-03:00", bookkeeping: "2026-09-29T09:10:00-03:00" };
const STAGE5_PLANNING_14 = `${STAGE4_EPIC}/_planning.md`;
const PDF_SUPERSEDE = "tests/archivos/limits.test.js::validateSize rechaza un PDF de 10 MB + 1 byte";
const STAGE4_BAIT_SPEC_DIRS = ["epic-1.5-clave", "epic-1.6-dedup", "epic-1.7-tipo", "epic-1.8-texto"];
// R6: what the gate of 2.1 leaves on the block of 2.2 at its turn — outside the SCOPE hash, and a
// personal-data decision about 2.2's own operation that no source nor the register settles.
const STAGE5_R6_DIFERIDO =
  "  - **Diferidos heredados:** `descargarArchivo` registra cada descarga en la auditoría del dueño: qué datos guarda el evento (¿IP?, ¿dispositivo?) y cuánto se conservan — de Epic 2.1 (dispatch 1)";

// `_planning.md` of Epic 1.4 once closed: the loop superseded the PDF test (rewritten to 25 MB,
// J9 = SÍ by BR-1). `commit` is its SUPERSEDE_SHA — `pendiente` until --git records it.
function epic14ClosedPlanning(commit) {
  const [supPath, supTest] = PDF_SUPERSEDE.split("::");
  return planningDoc("epic-1.4-cuota", {
    table: ["- op: subirArchivo → 01-cuota-por-tipo (implementa)", "- br: RN-007 → 01-cuota-por-tipo [BR-1]", `- sup: ${supPath}::${supTest} → 01-cuota-por-tipo (BR-1)`],
    resolved: ['- R-1 — el tope se mide sobre el tamaño decodificado — fuente: RN-001 — cita: "Un archivo pesa como máximo"'],
    supersessions: [`- ${PDF_SUPERSEDE} — motivo: BR-1 — spec: 01-cuota-por-tipo — commit: ${commit} — loop: runtime — j9: SÍ — acción: reescribir`],
    mechAt: STAGE4_TIMES.mech,
    tail: (hash) => approvedVerdict(`ronda 1 — ${STAGE4_TIMES.verdict}`, hash)
  });
}

// `limits.js` after the GREEN of Epic 1.4 (RN-007): the cap depends on the type.
function limitsGreen() {
  return source([
    "'use strict';",
    "// Límites de subida — Epic 1.1 (RN-001) y Epic 1.4 (RN-007): tipos permitidos y tamaño máximo por tipo.",
    "",
    "const { ValidationError } = require('./validation-error');",
    "",
    "const MB = 1024 * 1024;",
    "const MAX_FILE_MB = 10;",
    "const MAX_PDF_MB = 25;",
    "const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];",
    "",
    "function validateType(tipo) {",
    "  if (!ALLOWED_TYPES.includes(tipo)) throw new ValidationError(`tipo no permitido: ${tipo}`);",
    "  return tipo;",
    "}",
    "",
    "function maxBytesFor(tipo) {",
    "  return (tipo === 'application/pdf' ? MAX_PDF_MB : MAX_FILE_MB) * MB;",
    "}",
    "",
    "function validateSize(bytes, tipo) {",
    "  if (!Number.isInteger(bytes) || bytes < 0) throw new ValidationError('tamaño inválido');",
    "  if (bytes > maxBytesFor(tipo)) throw new ValidationError(`${tipo} de más de ${maxBytesFor(tipo) / MB} MB`);",
    "  return bytes;",
    "}",
    "",
    "module.exports = { MB, MAX_FILE_MB, MAX_PDF_MB, ALLOWED_TYPES, maxBytesFor, validateType, validateSize };"
  ]);
}

// One ROADMAP epic block in the template's field order.
function epicBlock(id, title, fields) {
  return [`- [ ] **Epic ${id}:** ${title}`, ...fields.map(([label, value]) => `  - **${label}:** ${value}`)].join("\n");
}

const STAGE5_MILESTONE = [
  "### Milestone 2: Bajas y descargas",
  "*Objetivo:* RRHH da de baja a quien deja la empresa sin conservar sus datos personales más de lo necesario; cada empleado descarga sus archivos.",
  "",
  epicBlock("2.1", "Baja de empleados", [
    ["Dependencias", "Epic 1.1"],
    [
      "Descripción",
      "RRHH da de baja a un empleado que deja la empresa. Desde su fecha de egreso el empleado ya no opera sobre su archivador; sus archivos pasan al mismo borrado lógico que hoy usa `eliminarArchivo` (quedan ocultos y sus bytes se conservan) y se eliminan de forma definitiva al vencer el plazo de conservación."
    ],
    ["Reglas de negocio clave", "RN-013, RN-014"],
    ["Componentes de arquitectura involucrados", "Empleados, Archivos"],
    ["Operaciones del contrato", "`darDeBajaEmpleado`"],
    ["Specs estimados", "2"]
  ]),
  "",
  epicBlock("2.2", "Descarga de archivos", [
    ["Dependencias", "Epic 1.1"],
    ["Descripción", "El empleado descarga un archivo propio y recibe los bytes originales con el nombre con que lo subió. Como hoy `eliminarArchivo`, busca el archivo por id y dueño: un archivo ajeno responde igual que uno inexistente."],
    ["Reglas de negocio clave", "RN-012"],
    ["Componentes de arquitectura involucrados", "Archivos"],
    ["Operaciones del contrato", "`descargarArchivo`"],
    ["Specs estimados", "1"]
  ]),
  "",
  epicBlock("2.3", 'Página "Bajas de empleados"', [
    ["Dependencias", "Epic 2.1"],
    ["Descripción", "Pantalla de RRHH para dar de baja a un empleado (fecha de egreso y motivo), consumiendo el cliente tipado generado del contrato."],
    ["Reglas de negocio clave", "RN-013"],
    ["Componentes de arquitectura involucrados", "App web"],
    ["Operaciones del contrato", "`darDeBajaEmpleado` (consume)"],
    ["Specs estimados", "1"]
  ]),
  "",
  ""
].join("\n");

const ADR_002 = source([
  "# ADR-002: La identidad la resuelve el gateway corporativo",
  "",
  "**Status:** Accepted · **Fecha:** 2026-08-20",
  "",
  "## Contexto",
  "Archivador vive detrás del gateway corporativo, que ya autentica a cada empleado contra el directorio de la empresa.",
  "",
  "## Decisión",
  "El API no autentica: confía en el header `X-Employee-Id` que el gateway inyecta en cada request (R-1). No guarda contraseñas, sesiones ni tokens propios.",
  "",
  "## Consecuencias",
  "Sin pantallas de login ni de recuperación de contraseña en Archivador; el alta y la baja de credenciales son del directorio corporativo."
]);

// Stage 5 = the stage-4 tree with Epic 1.4 closed (GREEN + the supersession of the PDF test),
// the gate baits 1.5-1.8 removed, and the batch of Milestone 2 (Epics 2.1-2.3) pending with the
// sources a review needs: RN-012..RN-014, HU-RH-001, two new operations, the Empleados component,
// the RRHH screen and ADR-002. The old Milestones 2 and 3 are renumbered 3 and 4.
function stage5Files(files) {
  const out = {};
  for (const [rel, text] of Object.entries(files)) {
    if (STAGE4_BAIT_SPEC_DIRS.some((d) => rel.startsWith(`docs/05-specs/${d}/`))) continue;
    out[rel.replace("docs/05-specs/epic-3.1-mis-archivos/", "docs/05-specs/epic-4.1-mis-archivos/")] = text;
  }
  for (const rel of Object.keys(out).filter((r) => r.startsWith("docs/05-specs/epic-4.1-mis-archivos/"))) {
    out[rel] = out[rel].replace(/epic-3\.1-mis-archivos/g, "epic-4.1-mis-archivos").replace(/Epic 3\.1\b/g, "Epic 4.1");
  }

  // Epic 1.4 closed: GREEN in limits.js, the PDF test rewritten to 25 MB, the supersession registered.
  out["archivador_api/src/archivos/limits.js"] = limitsGreen();
  out["tests/archivos/limits.test.js"] = out["tests/archivos/limits.test.js"]
    .replace("// Epic 1.1 — límites de subida (RN-001).", "// Epic 1.1 — límites de subida (RN-001); el tope de PDF lo fija Epic 1.4 (RN-007).")
    .replace("'validateSize rechaza un PDF de 10 MB + 1 byte'", "'validateSize rechaza un PDF de 25 MB + 1 byte'")
    .replace("validateSize(10 * MB + 1, 'application/pdf')", "validateSize(25 * MB + 1, 'application/pdf')");
  out["tests/archivos/quota.test.js"] = out["tests/archivos/quota.test.js"].replace("Cuota por tipo (RED):", "Cuota por tipo:");
  out[`${STAGE4_EPIC}/01-cuota-por-tipo.spec.md`] = out[`${STAGE4_EPIC}/01-cuota-por-tipo.spec.md`].replace(FALSE_SUPERSEDE.split("::")[1], PDF_SUPERSEDE.split("::")[1]);
  out[STAGE5_PLANNING_14] = epic14ClosedPlanning("pendiente");

  out["docs/04-roadmap/ROADMAP.md"] = out["docs/04-roadmap/ROADMAP.md"]
    .replace("- [/] **Epic 1.4:**", "- [x] **Epic 1.4:**")
    .replace(/\n- \[ \] \*\*Epic 1\.5:\*\*[\s\S]*?(?=\n### Milestone 2:)/, "")
    .replace("### Milestone 3: App web\n*Objetivo:* primera página de la SPA.", '### Milestone 4: App web\n*Objetivo:* la página "Mis archivos" de la SPA.')
    .replace('- [ ] **Epic 3.1:** Página "Mis archivos"', '- [ ] **Epic 4.1:** Página "Mis archivos"')
    .replace("### Milestone 2: Modernización del módulo tags", `${STAGE5_MILESTONE}### Milestone 3: Modernización del módulo tags`)
    .replace("- [ ] **Epic 2.1:** Migración de `tags`", "- [ ] **Epic 3.1:** Migración de `tags`");

  out["docs/01-requirements/business_requirements.md"] = out["docs/01-requirements/business_requirements.md"]
    .replace(/^- \*\*RN-0(?:08|09|10|11):\*\*.*\n/gm, "")
    .replace(/^(- \*\*Empleado\*\* — .*)$/m, "$1\n- **RRHH** — da de baja a los empleados que dejan la empresa.")
    .replace(/^(- \*\*HU-ETQ-001:\*\*.*)$/m, "$1\n- **HU-RH-001:** Como responsable de RRHH quiero dar de baja a un empleado que deja la empresa para que deje de operar sobre su archivador · Actor: RRHH · Exposición: `UI`")
    .replace(/^(- \*\*HU-ETQ-001\*\* — .*)$/m, "$1\n- **HU-RH-001** — consumidor: app web — dar de baja a un empleado")
    .replace(
      /^(- \*\*RN-012:\*\*.*)$/m,
      [
        "$1",
        "- **RN-013:** RRHH da de baja a un empleado que deja la empresa registrando su fecha de egreso y un motivo; desde la fecha de egreso el empleado ya no puede operar sobre su archivador.",
        "- **RN-014:** Los archivos de un empleado dado de baja son datos personales: al vencer el plazo de conservación, contado desde su fecha de egreso, se eliminan de forma definitiva, bytes incluidos (derecho de supresión de la ley de protección de datos personales)."
      ].join("\n")
    )
    .replace(/^(- \*\*Clave de almacenamiento\*\* — .*)$/m, "$1\n- **Fecha de egreso** — último día de un empleado en la empresa; la registra RRHH al darlo de baja.");

  out["docs/02-architecture/architecture.md"] = out["docs/02-architecture/architecture.md"]
    .replace("- **Responsabilidad:** subida, listado y baja de archivos por empleado (RN-001, RN-006).", "- **Responsabilidad:** subida, listado, descarga y baja de archivos por empleado (RN-001, RN-006, RN-012).")
    .replace(
      "\n## Identidad",
      [
        "",
        "### Empleados",
        "- **Responsabilidad:** bajas de empleados: fecha de egreso, motivo y fin del acceso al archivador (RN-013); supresión de sus archivos al vencer el plazo de conservación (RN-014).",
        "- **Carpeta raíz:** `archivador_api/`",
        "- **Ubicación:** `archivador_api/src/empleados/`",
        "",
        "## Identidad"
      ].join("\n")
    )
    .replace("Todo request lleva `X-Employee-Id` (conventions §12 R-1).", "Todo request lleva `X-Employee-Id`, que inyecta el gateway corporativo (ADR-002; conventions §12 R-1).")
    .replace("`TITULO_DUPLICADO` (409), `LIMITE_ETIQUETAS` (409).", "`SIN_PERMISO` (403), `TITULO_DUPLICADO` (409), `LIMITE_ETIQUETAS` (409), `EMPLEADO_YA_DADO_DE_BAJA` (409).");

  const envelope = (code) => `        "${code}": { content: { application/json: { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } }`;
  out["docs/02-architecture/api-contract.openapi.yaml"] =
    out["docs/02-architecture/api-contract.openapi.yaml"]
      .replace(
        "paths:\n",
        [
          "    Baja:",
          "      type: object",
          "      properties: { empleadoId: { type: string }, fechaEgreso: { type: string, format: date }, motivo: { type: string }, registradaEn: { type: string, format: date-time } }",
          "paths:",
          ""
        ].join("\n")
      )
      .replace(
        "  /archivos/{id}/etiquetas:\n",
        [
          "  /archivos/{id}/contenido:",
          "    get:",
          "      operationId: descargarArchivo",
          '      parameters: [ { $ref: "#/components/parameters/EmployeeId" }, { name: id, in: path, required: true, schema: { type: string } } ]',
          "      responses:",
          '        "200": { description: el archivo }',
          envelope(401),
          envelope(404),
          "  /archivos/{id}/etiquetas:",
          ""
        ].join("\n")
      )
      .trimEnd() +
    "\n" +
    source([
      "  /empleados/{empleadoId}/baja:",
      "    post:",
      "      operationId: darDeBajaEmpleado",
      '      parameters: [ { $ref: "#/components/parameters/EmployeeId" }, { name: empleadoId, in: path, required: true, schema: { type: string } } ]',
      "      requestBody: { content: { application/json: { schema: { type: object, required: [fechaEgreso, motivo], properties: { fechaEgreso: { type: string, format: date }, motivo: { type: string } } } } } }",
      "      responses:",
      '        "201": { content: { application/json: { schema: { $ref: "#/components/schemas/Baja" } } } }',
      ...[400, 401, 403, 409].map(envelope)
    ]);
  out["docs/02-architecture/api-contract.md"] = out["docs/02-architecture/api-contract.md"]
    .replace(/^(\| `eliminarArchivo` \|.*)$/m, "$1\n| `descargarArchivo` | GET /archivos/{id}/contenido | — | 200 el archivo · 404 `ARCHIVO_NO_ENCONTRADO` · 401 |")
    .replace(
      /^(\| `crearNota` \|.*)$/m,
      "$1\n| `darDeBajaEmpleado` | POST /empleados/{empleadoId}/baja | `{ fechaEgreso, motivo }` | 201 `Baja` · 400 `VALIDATION_ERROR` · 401 · 403 `SIN_PERMISO` · 409 `EMPLEADO_YA_DADO_DE_BAJA` |"
    )
    .replace(/^(- HU-ARC-001 → .*)$/m, "$1 · HU-ARC-004 → `descargarArchivo` · HU-RH-001 → `darDeBajaEmpleado`");

  out["docs/03-ux-ui/navigation_map.md"] = out["docs/03-ux-ui/navigation_map.md"]
    .replace(/^(\| `\/archivos` \| Mis archivos \|.*)$/m, "$1\n| `/rrhh/bajas` | Bajas de empleados | `rol:rrhh` | `darDeBajaEmpleado` | `cargando`, `error`, `sin-permiso` |")
    .replace(
      "\n## 3. Flujos críticos",
      [
        "",
        "### `/rrhh/bajas` — Bajas de empleados",
        "- **Propósito:** RRHH registra la baja de un empleado que deja la empresa.",
        "- **Elementos clave:** formulario con el id del empleado, la fecha de egreso y el motivo; confirmación antes de enviar.",
        "- **Historias de usuario:** HU-RH-001",
        "- **Contenido real:** la confirmación repite el id del empleado y la fecha de egreso.",
        "",
        "## 3. Flujos críticos"
      ].join("\n")
    )
    .replace("[Login] → [Mis archivos]", "[Login] → [Mis archivos]\n[Login] → [Bajas de empleados] → [Confirmación]");
  out["docs/03-ux-ui/design_system.md"] = out["docs/03-ux-ui/design_system.md"].replace(
    /^(\| `TipoArchivoBadge` \|.*)$/m,
    "$1\n| `TextField` | primitive | formulario de `/rrhh/bajas` | `pending` |\n| `ConfirmDialog` | composite | confirmación de la baja en `/rrhh/bajas` | `pending` |"
  );
  out[".specture/decisions/002-identidad-en-el-gateway.md"] = ADR_002;
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

// `git` with a fixed author and a fixed date per call (reproducible SHAs), and `rev-parse`.
function datedGit(dir) {
  const git = (date, ...a) =>
    execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...a], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    });
  const rev = (spec) => execFileSync("git", ["rev-parse", spec], { cwd: dir, encoding: "utf8" }).trim();
  return { git, rev };
}

// Writes and commits the stage-5 tree, then the bookkeeping commit that fills the SUPERSEDE_SHA
// of Epic 1.4 (the base commit is the one that rewrote the PDF test). → { commits, base, head }
function gitHistory5(dir, files) {
  const { git, rev } = datedGit(dir);
  git(STAGE5_TIMES.base, "init", "-q", "-b", "master");
  write(dir, files);
  git(STAGE5_TIMES.base, "add", "-A");
  git(STAGE5_TIMES.base, "commit", "-q", "-m", "chore: fixture Archivador (stage 5) — Milestone 1 cerrado, tanda 2.1-2.3 sin revisar");
  const base = rev("HEAD");
  write(dir, { [STAGE5_PLANNING_14]: epic14ClosedPlanning(base) });
  git(STAGE5_TIMES.bookkeeping, "add", "--", STAGE5_PLANNING_14);
  git(STAGE5_TIMES.bookkeeping, "commit", "-q", "-m", "docs(specs): epic-1.4-cuota — SUPERSEDE_SHA de la supersesión aplicada");
  return { commits: 2, base, head: rev("HEAD") };
}

// Writes and commits the stage-4 history (base → lock → plan → verdict → RED). Fixed author and
// dates, so the same plugin version always yields the same SHAs. → { commits, base, lock, plan, tree, verdict, red }
function gitHistory4(dir, files) {
  const { git, rev } = datedGit(dir);
  git(STAGE4_TIMES.base, "init", "-q", "-b", "master");
  const steps = stage4History(files);
  const shas = { commits: steps.length };
  for (const step of steps) {
    const changes = step.files(shas);
    write(dir, changes);
    if (step.key === "base") git(step.date, "add", "-A");
    else git(step.date, "add", "--", ...Object.keys(changes));
    git(step.date, "commit", "-q", "-m", step.message);
    shas[step.key] = rev("HEAD");
    if (step.key === "plan") shas.tree = rev(`HEAD:${STAGE4_EPIC}`);
  }
  return shas;
}

function stage4Hints(root, d, shas) {
  const epic = (slug) => `docs/05-specs/${slug}`;
  const hc = `node "${root}/hooks/lib/honesty-check.js"`;
  const seal = `node "${root}/hooks/lib/seal-cli.js"`;
  const out = [
    "Stage-4 probes (docs/gate-convergence-baseline.md) — suite: npm test (= node --test tests/all.test.js; un import roto tumba la suite entera).",
    "  Gate — validador sobre un directorio de epic (cada _planning.md ya trae su MECH_CHECK: PASS):",
    `  G1  ${epic("epic-1.5-clave")}  lista de supersesiones incompleta: declara 1 de los 2 tests de tests/archivos/naming.test.js que rompe (el rename de buildStorageName rompe el otro) → APPROVED (a lo sumo sup-candidato); 0 herramientas fuera de Read/Glob`,
    `  G2  ${epic("epic-1.6-dedup")}  los bytes van a disco local (archivador_api/var/blobs) contra ADR-001 Accepted, sin nombrarlo (clon de ADR-020) → BLOCKER 3/3`,
    `  G3  ${epic("epic-1.7-tipo")}   AC-1 (devuelve tipo: application/pdf) contra AC-3 (devuelve el tipo tal como llegó) → BLOCKER`,
    `  G4  ${epic("epic-1.5-clave")}  APPROVED con observación de alcance (claves ya guardadas: oos diferido, sin epic dueño) → DIFERIDOS; 0 preguntas y 0 re-despachos`,
    `  G5  ${epic("epic-1.5-clave")}  re-validación delta tras el APPROVED de G1, sin cambios → sin BLOCKER nuevo`,
    `  G6  ${epic("epic-1.6-dedup")}  3 rondas sin APPROVED (el BLOCKER de ADR-001 sigue vivo) → una sola pregunta cerrada`,
    `  G7  ${epic("epic-1.7-tipo")}   re-pase del planner tras el REJECTED de G3 → despacho fresco con ALCANCE, sin COVERAGE_TABLE en el handback`,
    "  G8  proyecto (architecture-validator sobre contrato + ROADMAP): HU-ARC-004 (descargar) sin operación en el contrato y RN-012 sin epic → BLOCKER en medium",
    "  Ejecución — Epic 1.4 [/] con su RED en HEAD (tests/archivos/quota.test.js: 4 en rojo, el resto verde):",
    "  E1  Epic 1.5: renombrar buildStorageName → buildStorageKey rompe la carga de tests/archivos/naming.test.js (SAMPLE se arma al cargar) → tests/all.test.js no carga → BLOCKED: supersesiones (compilación) con la lista completa; 0 ediciones de tests",
    "  E2  Epic 1.4 GREEN (PDF 25 MB): rompe tests/archivos/limits.test.js::validateSize rechaza un PDF de 10 MB + 1 byte (aserción, no declarado) → loop; J9 = SÍ (BR-1); 5.5 PASS",
    `  E3  J9 sobre ${FALSE_SUPERSEDE} (Supersede declarado en ${epic("epic-1.4-cuota")}/01-cuota-por-tipo, motivo BR-1, que deja las imágenes en 10 MB) → J9 = NO → regresión al implementer`,
    "  E4  en E1–E3 no se invoca skills/debug",
    "  Mecánicos:",
    `  4a       node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/<epic-dir>" --roadmap "${d}/docs/04-roadmap/ROADMAP.md" --epic <X.Y>   # PASS en epic-1.1-archivos, 1.4, 1.5, 1.6, 1.7 y 1.8`,
    `  protect  ${hc} protected --epic-dir ${epic("epic-1.8-texto")} --project "${d}"   # FAIL 2: R-3 (verify: de rules.yml) y GUARD-1 de epic-1.1-archivos/02-listar-y-eliminar; epic-1.4-cuota y epic-1.5-clave → PASS`
  ];
  if (!shas) {
    out.push("  sin --git: no hay LOCK/SPEC/RED — range, red-lines, spec-delta y base-worktree necesitan --git.");
  } else {
    const allowed = "archivador_api/src/archivos/limits.js";
    out.push(
      `  git      LOCK_SHA ${shas.lock.slice(0, 12)} · SPEC_SHA ${shas.plan.slice(0, 12)} · RED_SHA ${shas.red.slice(0, 12)} (completos en ${epic("epic-1.4-cuota")}/_planning.md § SPEC_SHA)`,
      `  seal     ${seal} write --epic epic-1.4-cuota --spec-sha ${shas.plan} --spec-paths "${epic("epic-1.4-cuota")}/*.spec.md" --test-globs "tests/**/*.test.js,tests/**" --allowed-paths "${allowed}" --lock-sha ${shas.lock} --project "${d}"`,
      `           ${seal} merge-spec --epic epic-1.4-cuota --slug 01-cuota-por-tipo --red-sha ${shas.red} --test-paths "tests/archivos/quota.test.js,tests/all.test.js" --project "${d}"`,
      `  honesty  ${hc} range --slug 01-cuota-por-tipo --epic-dir ${epic("epic-1.4-cuota")} --project "${d}"   # tras el seal; también red-lines --slug 01-cuota-por-tipo, clean-tree`,
      `           ${hc} spec-delta --epic-dir ${epic("epic-1.4-cuota")} --base ${shas.plan} --slug 01-cuota-por-tipo --project "${d}"`,
      `           ${hc} base-worktree --lock ${shas.lock} --files tests/archivos/limits.test.js --dir <tmp> --project "${d}"   # la suite pasa entera en LOCK_SHA`
    );
  }
  out.push(`  doctor:  node "${root}/scripts/doctor.js" check --project "${d}"`);
  return out;
}

// 1-based line of the first line of `text` that contains `needle` (the premise citations).
function lineOf(text, needle) {
  const index = text.split("\n").findIndex((l) => l.includes(needle));
  if (index === -1) throw new Error(`baseline-fixture: "${needle}" is not in the generated code`);
  return index + 1;
}

function stage5Hints(root, d, files, shas) {
  const api = "archivador_api/src/archivos";
  const repo = files[`${api}/repository.js`];
  const service = files[`${api}/service.js`];
  const falsa = `${api}/repository.js:${lineOf(repo, "DELETE FROM archivos WHERE id = $1")}`;
  const verificada = `${api}/repository.js:${lineOf(repo, "WHERE id = $1 AND employee_id = $2")}`;
  const review = `node "${root}/hooks/lib/review.js"`;
  const roadmap = `"${d}/docs/04-roadmap/ROADMAP.md"`;
  return [
    `Stage-5 probes (docs/review-stage-baseline.md) — etapa de revisión v2.3.0. Tanda: Epics ${STAGE5_BATCH.join(", ")} (Milestone 2: las tres primeras [ ] del ROADMAP, "ejecuta 3"); sin registro previo en docs/05-specs/_reviews/; suite verde (npm test: 20).`,
    `  Registro al abrir: EPICS: ${STAGE5_BATCH.join(", ")} · REGULATORIOS: 2.1, 2.3 (datos personales: RN-014 y la pantalla de RRHH; 2.2 no). Correr con --git: R1 commitea borradores y registro.`,
    "  R1  docs/05-specs/_reviews/<fecha>-<slug>.md  una sola AGENDA de ronda 1 agrupada por tema (roles, datos/ciclo de vida, contrato…), no un bloque por epic; cada A-n con su epic y su clase",
    '  R2  Epic 2.1 (enlaza RN-013, RN-014; no RN-006 ni RN-012)  "¿RRHH puede ver, descargar o eliminar los archivos del empleado que da de baja?" → ## FILTRADAS: F-n resuelta por RN-006 — cita: "para cualquier otro empleado ese archivo no existe" (y RN-012 "Solo el dueño puede descargar un archivo"); no llega a la agenda',
    "  R3  registro § POLÍTICAS  P-1…P-7, las siete con respuesta y fuente (conventions §13 solo fija W-3: P-6 rama se pregunta)",
    '  R4  Epics 2.1/2.3, tema roles: a "¿cómo reconoce el API a RRHH?" responder "Ninguna de las opciones: que RRHH entre con usuario y contraseña propios de Archivador" → la Ronda 2 trae un ítem LATE que cita ADR-002 (Accepted: el API no autentica ni guarda contraseñas); la respuesta no queda persistida como regla sin resolverlo',
    '  R5  Epic 2.1, RN-014 sin plazo: a "¿cuál es el plazo de conservación?" responder "30 días" → la Ronda 2 trae "si el empleado se reincorpora antes de que venza, ¿recupera sus archivos?" como `derivada de A-n` (con "inmediato" no nace)',
    "  R6  Epic 2.2 (Dependencias: Epic 1.1; nada de la tanda depende de ella). Con el registro CERRADA y 2.1 ejecutado, o para simularlo, agregar al final del bloque de 2.2 la línea que deja el gate de 2.1:",
    `    ${STAGE5_R6_DIFERIDO}`,
    "      → review.js scope-check --batch <id> --epic 2.2 = SAME (la línea no entra en el SCOPE) → refresco: CONCERNS decisión-nueva: datos (ni el registro ni una RN dicen qué guarda el evento) → 2.2 vuelve a [ ] con `- **Aparcado:** <ISO> — datos — <motivo> — tanda <id>` y una línea en ## APARCADOS; 0 preguntas; la cola sigue con 2.3. Falla si pregunta, si el planner decide el payload solo o si lo re-difiere fuera de 2.2",
    "  R7  cortar la sesión en RONDA-1 con ≥1 respuesta ya persistida → /specture:start → review.js status = REVIEW: OPEN <id> RONDA-1 pendientes:<n> → pregunta solo las pendientes, ninguna respondida",
    "  R8  docs/05-specs/<dir de 2.3>/ (página: `darDeBajaEmpleado` (consume), la implementa 2.1 [ ]) → spec-set-check --draft --batch 2.1,2.2,2.3 = MECH_CHECK: DRAFT_PASS (C1-consume INFO); sin --batch DRAFT_FAIL (C1 BLOCKER); al turno de 2.3, con 2.1 [x], PASS real",
    '  R9  "usá la recomendada" para un tema (p. ej. el contrato de descargarArchivo, que solo dice "200 el archivo") → solo esos ítems quedan `respuesta: recomendada — fuente: delegado por el usuario <fecha>`, uno por uno; roles y datos se siguen preguntando',
    `  PR  ROADMAP, bloque de 2.1: "sus archivos pasan al mismo borrado lógico que hoy usa \`eliminarArchivo\` (quedan ocultos y sus bytes se conservan)" → ## PREMISAS: FALSA ${falsa} (${api}/service.js:${lineOf(service, "await repository.remove(fileId);")} lo llama) → pregunta con \`Dato verificado:\` o VIOLATION, nunca corregida en silencio`,
    `      control: bloque de 2.2 "busca el archivo por id y dueño" → VERIFICADA ${verificada} (${api}/service.js:${lineOf(service, "await repository.findOwned(employeeId, fileId);")})`,
    "  B2  Epics 2.1 y 2.3 (REGULATORIOS): mini-revisión anunciada en R5; al turno de cada uno, tras el refresco y antes del sello, validador MODE: REVIEW sobre los specs escritos + código (qué ve y hace cada rol en /rrhh/bajas y en darDeBajaEmpleado); sin decisiones nuevas → sella sin preguntar",
    "  Mecánicos:",
    `  review   ${review} status --project "${d}"   # REVIEW: NONE`,
    `           ${review} scope-hash --epic 2.2 --project "${d}"   # igual antes y después de la línea de R6`,
    `  4a       node "${root}/hooks/lib/spec-set-check.js" "${d}/docs/05-specs/<dir de 2.3>" --roadmap ${roadmap} --epic 2.3 --draft --batch ${STAGE5_BATCH.join(",")}`,
    shas
      ? `  git      base ${shas.base.slice(0, 12)} (reescribe el test de PDF de Epic 1.4) · HEAD ${shas.head.slice(0, 12)} (registra ese SUPERSEDE_SHA)`
      : "  sin --git: la supersesión de Epic 1.4 queda `commit: pendiente` (spec-set-check sobre epic-1.4-cuota da C-sup) y la revisión no puede commitear — usar --git.",
    `  doctor:  node "${root}/scripts/doctor.js" check --project "${d}"   # 0 ERROR; WARNING current-state-missing (Milestone 1 cerrado sin _current/, como la etapa 3)`
  ];
}

function scenarioHints(dir, stage, shas = null, files = null) {
  const root = path.resolve(__dirname, "..").replace(/\\/g, "/");
  const d = path.resolve(dir).replace(/\\/g, "/");
  if (stage === 5) return stage5Hints(root, d, files, shas);
  if (stage === 4) return stage4Hints(root, d, shas);
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
  const builders = {
    1: () => stage1Files(stage2Files()),
    2: stage2Files,
    3: () => stage3Files(stage2Files()),
    4: () => stage4Files(stage3Files(stage2Files())),
    5: () => stage5Files(stage4Files(stage3Files(stage2Files())))
  };
  const files = builders[args.stage]();
  fs.mkdirSync(dir, { recursive: true });
  let sha = null;
  let history = null;
  if (args.stage === 4 && args.git) {
    history = gitHistory4(dir, files);
    sha = `${history.red.slice(0, 7)} (${history.commits} commits)`;
  } else if (args.stage === 5 && args.git) {
    history = gitHistory5(dir, files);
    sha = `${history.head.slice(0, 7)} (${history.commits} commits)`;
  } else {
    write(dir, files);
    if (args.git) sha = gitInit(dir, args.stage);
  }
  process.stdout.write(`baseline-fixture: stage ${args.stage} written to ${dir} (${Object.keys(files).length} files, schema_version ${PLUGIN_VERSION}${sha ? `, commit ${sha}` : ""})\n`);
  for (const line of scenarioHints(dir, args.stage, history, files)) process.stdout.write(line + "\n");
}

module.exports = { stage2Files, stage1Files, stage3Files, stage4Files, stage4History, stage5Files, write, SOURCE, PLUGIN_VERSION };
