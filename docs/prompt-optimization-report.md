# Reporte: Oportunidades de Mejora en los Prompts del Framework

## Tesis central

El síntoma "tarda mucho en creación de tests e implementación" NO se origina
en los prompts del tdd-test-writer ni del implementer. Se origina aguas arriba,
en el SPEC_TEMPLATE.md y en cómo build/SKILL.md arma el contexto antes de
despachar. Los dos agentes lentos son lentos porque reciben un artefacto pobre
y tienen que reconstruir estructura desde prosa en cada dispatch.

Cadena causal:
ROADMAP (macro, sin archivos) → build/SKILL.md Step 2 genera spec usando
SPEC_TEMPLATE.md (26 líneas, 4 secciones en prosa) → tdd-test-writer
(re-deriva estructura, sin cota de tests) → implementer (re-descubre firmas,
NEEDS_CONTEXT round-trips) → code-reviewer.

Cada eslabón hereda la ambigüedad del anterior y la amplifica. La latencia es
la suma de: (a) tokens interpretando prosa, (b) sobre-generación de tests,
(c) round-trips NEEDS_CONTEXT que reinician el agente con contexto fresco.

## Inventario de prompts (cobertura)

- templates/SPEC_TEMPLATE.md — Causa raíz — CRÍTICO
- agents/tdd-test-writer/AGENT.md — sin cota, mapa post-hoc, frontera ambigua — ALTO
- agents/implementer/AGENT.md — re-descubre firmas, round-trips caros — ALTO
- skills/build/SKILL.md Step 2/4/5 — spec pobre, sin gate de completitud — ALTO
- skills/architecture/SKILL.md — difiere todo el detalle file-level a Step 2 — CONTRIBUYE
- code-reviewer / architecture-validator — bien estructurados — OK
- start/setup/debug/new-feature/modernize — fuera de la ruta caliente — FUERA DE SCOPE

## Hallazgos por leverage

F1 — SPEC_TEMPLATE.md demasiado delgado (palanca #1). 26 líneas, prosa libre,
sin IDs estables, sin contrato I/O riguroso, sin sección de superficie de código
existente, sin fuera-de-scope. Contradicción: build Step 2 exige spec
"self-contained" pero el template no tiene slots para sostenerlo.
architecture/SKILL.md confirma: el ROADMAP es macro, todo el detalle accionable
nace en Step 2 con un template que no lo puede contener.

F2 — Ni test-writer ni implementer tienen exemplar (few-shot). Reglas +
checklists pero cero ejemplo de spec→tests o tests→impl-mínima. El LLM
reconstruye la forma del output cada dispatch.

F3 — No hay gate de completitud de contexto pre-dispatch. NEEDS_CONTEXT
detectado DESPUÉS de trabajo parcial → re-dispatch fresco que re-lee todo.
Cada round-trip ≈ un ciclo completo desperdiciado.

F4 — tdd-test-writer sin disciplina de cantidad de tests. "Every edge case →
a test" sin cota. CRUD se infla a 30+ tests; el tiempo de GREEN del implementer
es ~lineal en cantidad de tests. Bloat de tests = multiplicador directo sobre
la fase lenta.

F5 — Frontera de responsabilidad ambigua. "Run the test command yourself (or
instruct the orchestrator)" — el "or" fuerza negociación por ciclo + doble
corrida.

F6 — COVERAGE_MAP post-hoc, no dirigido por spec. Sin IDs estables el agente
arma el mapa en segunda pasada interpretativa.

F7 — implementer redescubre firmas. Recibe archivos pero no la API existente
que debe invocar → lee archivos para encontrar firmas.

Menores: mezcla de idiomas (headers ES, agentes EN, tests código); model:sonnet
correcto (la latencia no se arregla con modelo más grande sino con menos tokens
y menos round-trips).

## Roadmap de remediación (priorizado)

1. Reescribir SPEC_TEMPLATE.md con secciones ID'd y machine-parseable — Bajo
   esfuerzo, Alto impacto (cascada a ambos agentes).
2. Dispatch Manifest gate en build/SKILL.md — Medio esfuerzo, Alto impacto
   (mata round-trips).
3. Cota de proporcionalidad de tests en tdd-test-writer — Bajo, Medio-Alto.
4. Exemplar resuelto en test-writer e implementer — Bajo, Medio.
5. F5 (determinizar ejecución) + F6 (mapa spec-driven) + F7 (firmas en
   dispatch) — Bajo, Medio.

Decisiones de implementación confirmadas: spec híbrido (prosa ES + contrato/IDs
en idioma de identificadores), Manifest con enforcement dual (orquestador llena
+ agente valida primero), exemplars en pseudo-estructura agnóstica, release
v1.3.0 con changelog.
