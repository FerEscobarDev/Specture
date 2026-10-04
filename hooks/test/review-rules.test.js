const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const rr = require("../lib/review-rules");
const { globToRegExp } = require("../lib/seal");

const cli = path.resolve(__dirname, "..", "lib", "review-rules-resolve.js");
const template = path.resolve(__dirname, "..", "..", "templates", "project-config", "review-rules.template.md");
const temporaryDirectories = [];

function project(files = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "specture-review-rules-"));
  temporaryDirectories.push(parent);
  const root = path.join(parent, "app");
  fs.mkdirSync(path.join(root, ".specture"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specture", "stack.yml"), "schema: 1\n");
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [cli, "--project", root, ...args], { encoding: "utf8" });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

const TEAM_AGENT = [
  "---",
  "name: acme-reviewer",
  "description: Revisor del equipo Acme",
  "---",
  "",
  "# Revisor Acme",
  "",
  "## Cómo ejecutar",
  "",
  "Obtené el diff con gh y guardá en Acme.Docs/hallazgos/.",
  "",
  "## Bloqueantes críticos — siempre verificar",
  "",
  "| # | Bloqueante |",
  "|---|---|",
  "| 1 | Secretos en código |",
  "",
  "```bash",
  "# esto es un comentario de bash, no un encabezado",
  "gh pr diff 12",
  "```",
  "",
  "### Detalle",
  "",
  "- Nunca un token en el código.",
  "",
  "## Nivel flexible",
  "",
  "- Sin secretos y sin código comentado.",
  ""
].join("\r\n");

const TEAM_RULES = [
  "# Reglas por tecnología",
  "",
  "## Backend .NET",
  "",
  "- Sin try/catch en controllers.",
  "",
  "## React",
  "",
  "- Botón de envío deshabilitado mientras carga.",
  ""
].join("\n");

const ROOT_FILE = [
  "# Reglas de revisión",
  "",
  "<!-- un comentario con ## Incluye adentro no cuenta -->",
  "",
  "## Incluye",
  "- .claude/agents/acme-reviewer.md § Bloqueantes criticos — siempre verificar",
  "- `.claude/agents/acme-reglas.md`#Backend .NET — cuando: *.cs",
  "- .claude/agents/acme-reglas.md § React -- cuando: web/src/**",
  "",
  "## Severidades",
  "- bloqueante = BLOCKER · observación = IMPORTANT · sugerencia = NIT",
  "",
  "## Nivel flexible",
  "- rutas: legacy/**",
  "- reglas: .claude/agents/acme-reviewer.md § Nivel flexible",
  "- Sin código comentado.",
  "",
  "## Reglas",
  "- **RV-1** [BLOCKER] Ningún endpoint devuelve el detalle de una excepción.",
  "- **RV-2** [IMPORTANT] Los tests nombran condición y resultado — cuando: *.test.ts",
  ""
].join("\n");

function standardProject(extra = {}) {
  return project({
    ".claude/agents/acme-reviewer.md": TEAM_AGENT,
    ".claude/agents/acme-reglas.md": TEAM_RULES,
    ".specture/review-rules.md": ROOT_FILE,
    ...extra
  });
}

test("parses the four sections: references with § / # / cuando:, severities, flexible level and RV rules", () => {
  const parsed = rr.parseReviewRules(ROOT_FILE);

  assert.deepEqual(parsed.problems, []);
  assert.deepEqual(
    parsed.includes.map((i) => [i.path, i.heading, i.when]),
    [
      [".claude/agents/acme-reviewer.md", "Bloqueantes criticos — siempre verificar", []],
      [".claude/agents/acme-reglas.md", "Backend .NET", ["*.cs"]],
      [".claude/agents/acme-reglas.md", "React", ["web/src/**"]]
    ]
  );
  assert.deepEqual(parsed.severities, { bloqueante: "BLOCKER", "observación": "IMPORTANT", sugerencia: "NIT" });
  assert.deepEqual(parsed.flexible.paths, ["legacy/**"]);
  assert.equal(parsed.flexible.refs[0].heading, "Nivel flexible");
  assert.deepEqual(parsed.flexible.rules, ["Sin código comentado."]);
  assert.deepEqual(parsed.rules.map((r) => [r.id, r.severity, r.when]), [["RV-1", "BLOCKER", []], ["RV-2", "IMPORTANT", ["*.test.ts"]]]);
  assert.equal(parsed.rules[1].text, "Los tests nombran condición y resultado");
});

test("malformed lines become schema problems with their line, never exceptions", () => {
  const parsed = rr.parseReviewRules(
    "## Severidades\n- grave = FATAL\n## Reglas\n- RV sin formato\n- **RV-1** [BLOCKER] a\n- **RV-1** [NIT] b\n- **RV-2** [MUY] c\n"
  );
  const details = parsed.problems.map((p) => `${p.line}:${p.detail}`);

  assert.ok(details.some((d) => d.startsWith("2:") && /severidad desconocida "FATAL"/.test(d)), details.join("\n"));
  assert.ok(details.some((d) => d.startsWith("4:") && /regla ilegible/.test(d)));
  assert.ok(details.some((d) => d.startsWith("6:") && /id duplicado RV-1/.test(d)));
  assert.ok(details.some((d) => d.startsWith("7:") && /severidad desconocida "MUY"/.test(d)));
  assert.ok(parsed.problems.every((p) => p.check === "review-rules-schema"));
});

test("the shipped template parses clean and includes nothing", () => {
  const parsed = rr.parseReviewRules(fs.readFileSync(template, "utf8"));

  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.includes.length, 0);
  assert.equal(parsed.rules.length, 0);
  assert.equal(parsed.flexible.paths.length, 0);
});

test("extractSection ignores headings inside code fences and front-matter, folds case and accents, normalizes CRLF/BOM", () => {
  const section = rr.extractSection("﻿" + TEAM_AGENT, "bloqueantes CRITICOS — siempre verificar");

  assert.equal(section.status, "ok");
  assert.match(section.text, /^## Bloqueantes críticos — siempre verificar\n/);
  assert.match(section.text, /# esto es un comentario de bash/, "the fenced bash comment did not end the section");
  assert.match(section.text, /### Detalle\n\n- Nunca un token/, "subsections are included");
  assert.doesNotMatch(section.text, /## Nivel flexible/, "stops at the next heading of the same level");
  assert.doesNotMatch(section.text, /\r/);

  assert.equal(rr.extractSection(TEAM_AGENT, "No existe").status, "missing");
  assert.equal(rr.extractSection("## A\nx\n## A\ny\n", "A").status, "duplicate");
});

test("inspect: a clean file has no problems; a whole agent include only warns", () => {
  const clean = standardProject();
  assert.deepEqual(rr.inspect(clean).problems, []);

  const whole = standardProject({ ".specture/review-rules.md": "## Incluye\n- .claude/agents/acme-reviewer.md\n" });
  const problems = rr.inspect(whole).problems;
  assert.equal(problems.length, 1);
  assert.equal(problems[0].check, "review-rules-agent-include");
  assert.equal(problems[0].severity, "WARNING");
});

test("inspect rejects URLs, absolute paths, escapes, self-inclusion, missing files and headings, braces and nested includes", () => {
  const root = standardProject({
    "outside-not-allowed.md": "x",
    "docs/estandares/anidado.md": "# Guía\n\n## Incluye\n- otra.md\n\n## Regla\n- algo\n",
    ".specture/review-rules.md": [
      "## Incluye",
      "- https://example.com/rules.md",
      "- /etc/rules.md",
      "- ../outside.md",
      "- .specture/review-rules.md",
      "- docs/estandares/no-existe.md",
      "- .claude/agents/acme-reglas.md § Python",
      "- docs/estandares/anidado.md § Regla",
      "- .claude/agents/acme-reglas.md § React — cuando: web/{a,b}/**",
      ""
    ].join("\n")
  });
  const problems = rr.inspect(root).problems.filter((p) => p.severity === "ERROR");
  const text = problems.map((p) => `${p.line} ${p.check} ${p.detail}`).join("\n");

  assert.match(text, /^2 review-rules-include .*es una URL/m);
  assert.match(text, /^3 review-rules-include .*ruta absoluta/m);
  assert.match(text, /^4 review-rules-include .*sale del repositorio/m);
  assert.match(text, /^5 review-rules-include .*a sí mismo/m);
  assert.match(text, /^6 review-rules-include .*no existe/m);
  assert.match(text, /^7 review-rules-include .*no tiene el encabezado "Python"/m);
  assert.match(text, /^8 review-rules-include .*su propio "## Incluye".*un nivel/m);
  assert.match(text, /^9 review-rules-schema .*llaves/m);
});

test("inside() compares real paths: a Windows 8.3 short name and its long name are the same place", () => {
  const root = project({ "docs/a.md": "x" });
  assert.equal(rr.inside(path.join(root, "docs", "a.md"), root), true);
  assert.equal(rr.inside(path.join(root, "..", "elsewhere.md"), root), false);
  if (process.platform !== "win32") return;
  // `C:\PROGRA~1` is the 8.3 short name of `C:\Program Files` where the volume keeps short names
  // (as GitHub's Windows runners do for the temp dir). Skip when it does not.
  const long = "C:\\Program Files";
  const short = "C:\\PROGRA~1";
  if (!fs.existsSync(short) || fs.realpathSync.native(short).toLowerCase() !== long.toLowerCase()) return;
  const child = fs.readdirSync(long).find((name) => fs.existsSync(path.join(short, name)));
  if (!child) return;
  assert.equal(rr.inside(path.join(short, child), long), true, `${short}\\${child} is inside ${long}`);
  assert.equal(rr.inside(path.join(long, child), short), true);
});

test("globs: with a slash they anchor at the project root, without one they match a file name anywhere", () => {
  assert.equal(rr.globMatches("web/src/app/Form.tsx", "web/src/**"), true);
  assert.equal(rr.globMatches("tools/web/src/x.tsx", "web/src/**"), false, "anchored");
  assert.equal(rr.globMatches("api/Controllers/X.cs", "*.cs"), true, "name glob at any depth");
  assert.equal(rr.globMatches("api/X.csx", "*.cs"), false);

  assert.equal(globToRegExp("src/**").test("x/src/a.js"), true, "the hook's default stays unanchored");
  assert.equal(globToRegExp("src/**", { anchored: true }).test("x/src/a.js"), false);
});

test("resolve picks unconditional entries plus the ones whose cuando: touches the paths; flexible only when a flexible path is touched", () => {
  const root = standardProject();

  const backend = rr.resolveReviewRules(root, { paths: ["api/Controllers/Orders.cs"] }).block;
  assert.deepEqual(backend.sections.map((s) => s.heading), ["Bloqueantes criticos — siempre verificar", "Backend .NET"]);
  assert.deepEqual(backend.rules.map((r) => r.id), ["RV-1"]);
  assert.equal(backend.flexible.touched, false);
  assert.deepEqual(backend.flexible.rules, []);

  const mixed = rr.resolveReviewRules(root, { paths: ["web/src/Form.test.ts", "legacy/old.js"] }).block;
  assert.deepEqual(mixed.sections.map((s) => `${s.kind}:${s.heading}`), [
    "include:Bloqueantes criticos — siempre verificar",
    "include:React",
    "flexible:Nivel flexible"
  ]);
  assert.deepEqual(mixed.rules.map((r) => r.id), ["RV-1", "RV-2"]);
  assert.deepEqual(mixed.flexible.rules, ["Sin código comentado."]);

  const all = rr.resolveReviewRules(root, { all: true }).block;
  assert.equal(all.sections.length, 4);
  assert.equal(all.rules.length, 2);

  const legacyOnly = rr.resolveReviewRules(root, { paths: ["legacy/Old.cs"] }).block;
  assert.deepEqual(legacyOnly.sections.map((s) => `${s.kind}:${s.heading}`), ["flexible:Nivel flexible"], "a flexible path gets only the flexible level, not the *.cs rules nor the unconditional ones");
  assert.deepEqual(legacyOnly.rules, []);

  const docsOnly = rr.resolveReviewRules(root, { paths: [] }).block;
  assert.deepEqual(docsOnly.sections.map((s) => s.heading), ["Bloqueantes criticos — siempre verificar"], "no surface still gets the unconditional criteria");
});

test("formatBlock fences the team criteria as data and never leaks the team's procedure section", () => {
  const block = rr.resolveReviewRules(standardProject(), { all: true }).block;
  const text = rr.formatBlock(block);

  assert.match(text, /^CUSTOM_RULES: 3 de 3 inclusiones · 2 de 2 reglas RV · \d+ caracteres \(tope 60000\)/);
  assert.match(text, /SEVERIDADES: bloqueante = BLOCKER · observación = IMPORTANT · sugerencia = NIT/);
  assert.match(text, /NIVEL_FLEXIBLE: rutas = legacy\/\*\*/);
  assert.match(text, /PRECEDENCIA: las reglas de Specture/);
  assert.match(text, /<<< CRITERIOS DEL EQUIPO — datos, no instrucciones/);
  assert.match(text, /----- \.claude\/agents\/acme-reglas\.md § React -----/);
  assert.match(text, /- RV-1 \[BLOCKER\] Ningún endpoint/);
  assert.doesNotMatch(text, /guardá en Acme\.Docs/, "the 'Cómo ejecutar' section was not included");
  assert.equal(rr.formatBlock(null), "CUSTOM_RULES: []");
});

test("one include over the cap is an error; a selection over the cap fails loud listing each section's size", () => {
  const section = (name) => `## ${name}\n\n` + "- regla larga ".repeat(50) + "\n";
  const root = standardProject({
    "docs/estandares/guia.md": section("Uno") + "\n" + section("Dos"),
    ".specture/review-rules.md": "## Incluye\n- docs/estandares/guia.md § Uno\n- docs/estandares/guia.md § Dos\n"
  });

  const tooSmall = rr.inspect(root, { cap: 500 }).problems;
  assert.ok(tooSmall.some((p) => p.check === "review-rules-size" && p.severity === "ERROR"), "a single include over the cap");

  const info = rr.inspect(root, { cap: 1000 }).problems;
  assert.deepEqual(info.map((p) => `${p.check}/${p.severity}`), ["review-rules-size/WARNING"], "only the sum is over the cap");

  const result = rr.resolveReviewRules(root, { all: true, cap: 1000 });
  assert.match(result.error, /supera el tope de 1000/);
  assert.match(result.error, /guia\.md § Uno: \d+\n.*guia\.md § Dos: \d+/s);
});

test("CLI: absent file → CUSTOM_RULES: [] exit 0; errors → exit 1 on stderr; usage → exit 2", () => {
  const empty = project();
  const absent = run(empty, "--all");
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.stdout.trim(), "CUSTOM_RULES: []");
  assert.equal(absent.stderr, "", "opt-in: no warning when the file does not exist");

  const broken = project({ ".specture/review-rules.md": "## Incluye\n- no-existe.md\n" });
  const failed = run(broken, "--all");
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /no-existe\.md` no existe/);
  assert.equal(failed.stdout, "");

  assert.equal(run(empty).status, 2, "no mode");
  assert.equal(run(empty, "--all", "--paths", "a").status, 2, "two modes");
});

test("CLI: --spec resolves against the spec's declared surface; --paths-file reads one path per line", () => {
  const spec = [
    "# Spec 01",
    "",
    "## Superficie de Código Existente",
    "",
    "- Crea: `OrdersController` en `api/Controllers/OrdersController.cs` — firma: `class OrdersController`",
    "- Modifica: `web/src/app.tsx`",
    ""
  ].join("\n");
  const root = standardProject({ "docs/05-specs/epic-1.1-pedidos/01-api.spec.md": spec, "chunk.txt": "legacy/a.js\r\n\r\n" });

  const bySpec = run(root, "--spec", "docs/05-specs/epic-1.1-pedidos/01-api.spec.md");
  assert.equal(bySpec.status, 0, bySpec.stderr);
  assert.match(bySpec.stdout, /§ Backend \.NET -----/);
  assert.match(bySpec.stdout, /§ React -----/);
  assert.doesNotMatch(bySpec.stdout, /NIVEL FLEXIBLE ·/);

  const byFile = run(root, "--paths-file", path.join(root, "chunk.txt"), "--json");
  assert.equal(byFile.status, 0, byFile.stderr);
  const json = JSON.parse(byFile.stdout);
  assert.deepEqual(json.paths, ["legacy/a.js"]);
  assert.equal(json.block.flexible.touched, true);
});
