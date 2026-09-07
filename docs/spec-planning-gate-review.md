> **Estado: REVISIÓN CRÍTICA — 2026-08-28; etapa 1 APLICADA en v1.17.0** (M1, M3, M6, M7 +
> planner/preguntas/C7); **etapa 2 APLICADA en v1.18.0** (M2 → reviewer Dim 1 verifica firmas
> `Crea:`; M4 → Code Surface Resolution, el planner no lee código; M5 → token `MECH_CHECK`;
> C-6 → validator de set + por spec, decisión A6 se cierra con métricas; C-8 → 4a mecánico;
> C-9a → gramática de migración `gap:`; C-9b → brecha de espejos documentada; G5 →
> `allowed_paths`; G7 → `metrics-report.js` + `knowledge stats`). Reporte solicitado por el usuario:
> (1) juzgar si `docs/spec-planning-gate-design.md` aporta valor real al framework,
> (2) analizar lo ya implementado, (3) proponer otras oportunidades de mejora.
> Perspectiva: diseño de sistemas multi-agente de generación de código, SDD con IA
> y comportamiento real de LLMs bajo instrucciones. **No modifica ningún archivo del
> framework** — solo existe este documento. Toda cita `archivo:línea` fue verificada
> contra HEAD (`c8365c8`).

# Revisión: Spec Planning Gate + estado del framework Specture v1.14.0

## 0. Resumen ejecutivo

1. **El Spec Planning Gate SÍ beneficia al framework — y no marginalmente.** Cierra
   la única fase del hot path sin autor especializado (el spec, que todos los demás
   agentes tratan como contrato sellado) y el único punto donde "preguntar al usuario"
   es estructuralmente imposible hoy (un subagente no tiene `AskUserQuestion`). El
   diagnóstico (§2 del diseño) es correcto línea por línea. Recomendación:
   **implementar, con 7 modificaciones y en dos etapas** (§1.4-1.5).
2. **Tres decisiones del diseño merecen corrección antes de codificar:** el overlay
   de firmas (§4.7) resuelve un problema que el propio diseño crea y lo resuelve en
   el lugar equivocado; la evidencia de planificación vive en un commit message y un
   archivo gitignoreado (contradice "trust the filesystem"); y el crecimiento de
   `build/SKILL.md` (ya 512 líneas, hot path) no es ≈ 0 como afirma el diseño — sin
   partir el archivo, el gate agrava el riesgo de erosión que el mismo diseño lista.
3. **Hay prerrequisitos que hacen al gate más barato y más mecánico:** IDs estables
   para reglas de negocio (hoy `business_requirements.md` no tiene template ni
   anclas estables → C2 no puede ser mecánico), y un gate de validación del ROADMAP
   (Part C de `architecture` es la única entrega de Fase 2 sin validator — el planner
   heredará basura si el bloque de epic está mal).
4. **El framework implementado es sólido y poco común** en su disciplina (evidencia
   encadenada RED_SHA→hook→git diff→Dim 4; contexto restringido por función
   cognitiva; TDD para prompts; iteración guiada por datos de costo). Los hallazgos
   son de higiene y de bordes, no de fundamentos.
5. **Hallazgo inmediato:** el repo está en estado de release inconsistente. El test
   de contrato `hooks/test/copilot-plugin-contract.test.js` **falla en HEAD**
   (`1.14.0 !== 1.13.0`), el README no tiene changelog de v1.13/v1.14, y no hay CI
   ni `package.json` que corra los tests. Un framework cuya tercera ley es "cero
   completado sin verificar" no verifica su propio release.

---

## 1. Veredicto sobre el diseño del Spec Planning Gate

### 1.1 El diagnóstico es correcto (verificado)

| Afirmación del diseño | Verificación en HEAD | Veredicto |
|---|---|---|
| §2.1 Step 2 dice "1-3 specs" pero Steps 3-7 hablan de "the spec" en singular, sin loop ni gate generar→ejecutar | `build/SKILL.md:174` ("decompose into 1-3 specs"); `:290-437` todos en singular; solo `:440` ("After all specs…") implica pluralidad | **Correcto.** El epic-agent es libre de intercalar spec 1 → ejecutar → spec 2. |
| §2.2 El spec lo escribe el único actor no especializado | `build/SKILL.md:79` pasa "the full text of this build/SKILL.md" a un agente "general-purpose" (`:85`) sin `model`, sin Required Inputs, sin Step 0, sin formato de salida. Los 5 workers sí tienen todo eso. | **Correcto y es el argumento más fuerte.** `docs/prompt-optimization-report.md:26` ya ubicó la causa raíz en el spec; v1.3.0 arregló la *forma* (template + Manifest), no el *contenido*. |
| §2.3 El actor no puede hablar con el usuario | Subagentes no tienen `AskUserQuestion`. `start/SKILL.md:97` prohíbe asumir reglas de negocio. Salida real: `BLOCKED` → `build/SKILL.md:115` escala → re-dispatch del epic entero. | **Correcto.** La regla existe; el mecanismo no. Contradicción estructural, no de prompt. |
| §2.4 Nadie revisa el conjunto | `architecture-validator/AGENT.md:15` recibe "a `.spec.md`" (uno). `architecture/SKILL.md:144` chequea contrato→epic, nadie chequea epic→specs. | **Correcto.** |
| §2.5 La ambigüedad aflora tarde y caro | `tdd-test-writer:171` / `implementer:166` `NEEDS_CONTEXT`; `build:414-419` Iteration Cap; `:112-118` BLOCKED. Un `NEEDS_CONTEXT` del implementer ya tiene un RED commit sellado detrás. | **Correcto.** El costo de corregir un spec crece con cada gate que cruzó. |

### 1.2 Qué aporta realmente (por orden de valor)

1. **Autor especializado del contrato central.** Completa el patrón "cada artefacto
   del hot path tiene un worker con Required Inputs + Step 0 + formato estricto".
   Es la corrección de simetría más importante desde v1.3.0.
2. **Preguntar es posible sin gate humano obligatorio.** `OPEN_QUESTIONS` con el
   criterio de dos condiciones (§4.3: cambia el contrato observable **y** no es
   resoluble con las fuentes) es un criterio de escalado bien calibrado: acota el
   over-asking sin habilitar el "asumo y sigo". D2/D3 (sin aprobación por epic, sin
   Plan mode) son correctas: la fatiga de aprobación convierte el gate humano en
   firma sin lectura desde el epic 5, y "todas" dejaría de ser desatendido.
3. **`RESOLVED_ALONE` con cita textual (D13) es la mejor idea del documento.**
   Convierte un juicio ("¿está resuelto?") en un hecho verificable ("¿existe esta
   frase en la fuente?"). Ataca de frente el sesgo dominante del modelo ("encontrar
   un §X relacionado se siente diligencia"). Que C7 exija existencia mecánica antes
   de juzgar pertinencia, y que el segundo rechazo del mismo ítem lo convierta en
   pregunta (anti-cascada), es diseño de comportamiento de LLM de primer nivel.
4. **Chequeos mecánicos antes del validator (D15).** Consistente con
   `write-skill:51` ("if a regex can enforce it, automate it"). C1/C4/C6 son
   genuinamente mecánicos y atrapan exactamente los fallos que un LLM comete en
   documentos largos (perder un `operationId`, firma no idéntica).
5. **Re-dispatch = edición mínima con `CHANGELOG` contrastado por `git diff` (D12).**
   Reconoce que "regenerar" en un LLM significa "reestructurar" y rompe el mapeo de
   IDs del que dependen las respuestas del usuario y el `COVERAGE_MAP`.
6. **Métricas antes/después como criterio de éxito (D20).** Honesto: sin medición
   no se distingue gate útil de ceremonia. Coherente con la tradición del repo
   (`docs/usage-cost-analysis.md` → R1-R5 implementados).

### 1.3 Dónde el diseño falla o deja huecos

**C-1 · El overlay de firmas (§4.7, D14) es un parche a un problema autoinfligido, y
está en el eslabón equivocado.** El modelo just-in-time actual (spec k+1 escrito
después de implementar spec k) tiene firmas *reales* gratis. Planificar todo el
epic upfront las convierte en *planeadas*, y el overlay las corrige en el Manifest
del spec k+1. Problemas: (a) introduce un tercer estado de firma (spec, overlay,
real) y una regla de precedencia que el implementer debe entender; (b) el
`tdd-test-writer` del spec k+1 ve el spec (firma planeada) mientras el implementer
ve el overlay (firma real) — si difieren en algo observable por un test, el RED
commit ya está mal, y el diseño solo dice "el epic-agent lo reporta en
`CONCERNS`". Sin procedimiento de recuperación.
**Corrección:** la firma planeada de un símbolo `Crea:` es una **obligación de spec
compliance del implementer del spec k**, no un problema del spec k+1. C4 ya exige
igualdad de string entre `crea:` y `consume:`. Basta agregar al `code-reviewer`
Dimensión 1 un chequeo explícito: *"todo símbolo `Crea:` de la Superficie existe en
HEAD con la firma declarada — divergencia = BLOCKER"*. El overlay queda como
re-lectura defensiva barata (mantenerlo), pero deja de ser el mecanismo de
corrección.

**C-2 · La evidencia de planificación no vive en el filesystem.** Principio 7 del
diseño: "Evidencia, no confianza". Pero el veredicto `APPROVED` del validator, las
`RESOLVED_ALONE` con citas y la `COVERAGE_TABLE` viven en: el commit message
(`docs(specs): plan … validados`), el sello `build-locked.json` (gitignoreado por
`setup:60`, se borra en Step 8) y "al pie de cada spec". La reanudación (§4.10)
infiere "validado" de "commiteado". La `COVERAGE_TABLE` es una propiedad del *set*,
no de cada spec — ponerla en cada spec la duplica o la fragmenta.
**Corrección:** un artefacto trackeado por epic, `docs/05-specs/<epic-slug>/_planning.md`,
con: `COVERAGE_TABLE` (única, machine-readable — es lo que lee `spec-set-check.js`),
`OPEN_QUESTIONS` + respuestas + fuente, `RESOLVED_ALONE` con citas, resultado de 4a,
veredicto del validator verbatim, `SPEC_SHA`. La sección "Aclaraciones" de cada spec
puede quedar como puntero. Beneficios: reanudación con evidencia en disco,
`knowledge capture` tiene un artefacto único que leer, el code-reviewer puede
recibirlo, y `_current/` en Step 8.7 tiene la trazabilidad de decisiones.

**C-3 · "Crecimiento neto de `build` ≈ 0" no es creíble.** El diseño mueve Step 2 +
self-review al planner (~25 líneas) pero agrega: gate de 9 pasos con 3 loops,
protocolo de preguntas y delegación, invocación del script, sello + fusión,
reanudación con 4 casos, overlay pre-flight, `git diff` vs `CHANGELOG`, `git diff
<SPEC_SHA>` al procesar el reporte, registro de métricas. Estimación realista:
**+80 a +120 líneas netas** sobre un archivo de 512 que `docs/token-optimization-report.md`
clasifica como "hot path — altísimo". Y hay un problema previo que el gate agrava:
`build/SKILL.md:79` pasa **el archivo completo** al epic-agent, incluyendo ~200 líneas
que son solo del coordinador (Execution Model, queue loop, Branching, Steps 8.5/8.7/9,
prosa del gate visual). Con el gate, el epic-agent recibiría además todo el
procedimiento de planificación que tiene prohibido ejecutar.
**Corrección:** partir `build/SKILL.md` en `build/SKILL.md` (coordinador: cola,
branching, Spec Planning Gate, procesamiento de reportes, 8.5, 8.7) y
`build/EPIC_LOOP.md` (Steps 4-8 + Manifest + resoluciones + gate 5.5 + Iteration
Cap + anti-patterns del epic-agent). El epic-agent recibe solo el segundo. Esto
reduce el riesgo "Erosión del procedimiento" (§5) que el diseño califica "Medio sin
hooks" — un coordinador con menos texto irrelevante saltea menos pasos.

**C-4 · C2 no puede ser mecánico porque las reglas de negocio no tienen ID.** El
diseño lo admite ("mecánico solo si las referencias usan el formato de ancla del
template; si no, lo cubre 4b"). La causa está aguas arriba: `discover` produce
`HU-…` estables para historias (`discover:82`) pero las reglas de negocio se citan
por "§X" (`SPEC_TEMPLATE:29`, `ROADMAP_TEMPLATE:46`), y **no existe
`templates/BUSINESS_REQUIREMENTS_TEMPLATE.md`** — es el único entregable de fase
sin template. `_current/` ya sufre esto (usa "origen `<epic/task>`" porque no hay ID
global). **Corrección (prerrequisito):** template de requerimientos con IDs estables
`RN-nnn` (reglas), `CL-nnn` (casos límite), `FA-nnn` (fuera de alcance); Dim 4 del
validator y C2 pasan a ser mecánicos; `_current/` gana trazabilidad por ID.

**C-5 · La lectura de código "acotada" del planner es circular y no enforzable.**
§4.2: "solo archivos … que contienen los símbolos que la Superficie nombra" — pero
el planner es quien decide qué símbolos nombra, así que debe explorar para saberlo.
Es prosa, no mecanismo; el residual "Bajo" de §5 es optimista.
**Corrección:** aplicar por tercera vez la doctrina que el framework ya usa dos veces
("el orquestador resuelve, el agente nunca lee": Docs Index Resolution, Current-State
Resolution). Un pre-flight **"Code Surface Resolution"** en el coordinador produce
`símbolo → path → firma` de la carpeta raíz del componente (grep de exports, o un
dispatch barato Haiku/Sonnet con formato estricto y lectura restringida a esa
carpeta) y se lo entrega al planner como input. El planner no abre código; C8
("Superficie sin comportamiento") se vuelve casi trivial.

**C-6 · Un solo dispatch del validator para 1-3 specs + dim 7 diluye atención.** El
diseño lo presenta solo como ahorro ("reemplaza 1-3 dispatches"). Un Opus leyendo 3
specs + bloque de epic + slice del contrato + fuentes citadas + resultado de 4a puede
perder una violación de dims 1-6 que sí atraparía con un spec. No se discute.
**Corrección:** medirlo. Agregar a `build-metrics.jsonl` una señal de "defecto de
spec detectado aguas abajo" (ya están `blocked_spec` e `iteration_cap_spec`;
agregar `reviewer_rejected_major_spec_defect`). Si sube, volver a dims 1-6 por spec
y dejar solo C3/C7/C8 en el dispatch de set.

**C-7 · Falta el loop de corrección de spec a mitad de epic.** Con specs sellados
(§4.8), la recuperación actual del Iteration Cap (`build:417` "fix the spec, restart
from Step 3") y del `BLOCKED: spec` del epic-agent (§4.9) no tiene camino definido.
**Corrección:** definir en el coordinador: `BLOCKED: spec <AC-n>` → des-sellar →
re-despachar planner con `VIOLATIONS` (edición mínima) → 4a/4b → nuevo `SPEC_SHA`
→ descartar el RED commit del spec afectado (`git revert`, no reset) → re-despachar
epic-agent **desde el spec afectado**, no desde el spec 1.

**C-8 · 4a necesita un token de evidencia.** El diseño pide que el coordinador corra
el script y luego despache el validator; nada obliga a que lo haya corrido. Mismo
patrón que `SPEC_SHA`: el script emite `MECH_CHECK: PASS <sha-de-la-tabla>` y ese
token es input obligatorio del validator (que responde `BLOCKED` sin él).

**C-9 · Huecos menores.** (a) `MIGRATION_SPEC_TEMPLATE.md` no tiene AC/BR/EC con ID,
ni Contrato, ni Superficie → C1/C4 no mapean; D16 lo manda por el gate sin decir
cómo se llena `COVERAGE_TABLE` para migraciones. (b) Los espejos Copilot son de
16-19 líneas (vs 100-270 del `AGENT.md`); `spec-planner` perderá el criterio de
escalado y el formato de citas en esa plataforma — documentar la brecha o generar
los espejos (ver G9). (c) El epic-agent sigue sin `model` pinneado; con el juicio
movido a planner+validator+reviewer (Opus), el epic-agent queda **procedural** y
puede pinnearse a Sonnet — un ahorro real que el gate habilita y el diseño no
menciona.

### 1.4 Modificaciones recomendadas al diseño

| # | Modificación | Resuelve | Costo |
|---|---|---|---|
| M1 | `docs/05-specs/<epic>/_planning.md` trackeado (coverage table única, preguntas+respuestas, citas, 4a, veredicto, `SPEC_SHA`) | C-2, reanudación, knowledge | Bajo |
| M2 | Chequeo en `code-reviewer` Dim 1: símbolos `Crea:` existen en HEAD con la firma declarada (BLOCKER). Overlay queda como re-lectura defensiva | C-1 | Bajo |
| M3 | Partir `build/SKILL.md` → coordinador + `EPIC_LOOP.md`; el epic-agent recibe solo el segundo | C-3, erosión, hot path | Medio |
| M4 | "Code Surface Resolution" pre-flight del coordinador; el planner no lee código | C-5, C8 | Medio |
| M5 | Token `MECH_CHECK` de 4a obligatorio en el dispatch del validator | C-8 | Trivial |
| M6 | Loop de corrección de spec mid-epic (des-sellar → planner → re-validar → revert RED → reanudar desde el spec afectado) | C-7 | Bajo |
| M7 | Pinnear `model: sonnet` al epic-agent una vez que ya no escribe specs; medir | C-9c, costo | Trivial |

### 1.5 Staging recomendado

El diseño completo toca 13 archivos y, bajo la disciplina `write-skill` (baseline por
escenario, 12 escenarios), es un esfuerzo de varias semanas. El 70 % del valor está en
dos piezas (autor especializado + preguntas). Propuesta:

- **v1.15.0 — el autor y las preguntas.** Prerrequisitos P1 (§3). `spec-planner`
  con `OPEN_QUESTIONS`/`RESOLVED_ALONE` (cita textual), protocolo de preguntas y
  delegación, `_planning.md` (M1), M3 (split de build), M6, M7. El validator sigue
  **por spec** (dims 1-6, sin cambios) — se agrega solo C7 como dimensión sobre
  `_planning.md`. Sin script 4a, sin sello, sin overlay. Escenarios 1, 4, 5, 6, 7, 8.
- **v1.16.0 — el set y la evidencia.** `spec-set-check.js` (C1/C2/C4/C5/C6) con M5,
  C3/C8, sello `spec_paths` en el hook, M2, M4, métricas. Escenarios 2, 3, 9-12.

Razón: la etapa 1 tiene el delta más chico en `build/SKILL.md` (menor riesgo de
erosión), entrega antes lo que más duele hoy (nadie puede preguntar), y la etapa 2
se diseña con datos de la 1.

### 1.6 Veredicto

**Aprobar con modificaciones.** Beneficio real: cierra una asimetría estructural
(el contrato sellado de toda la cadena es el único artefacto sin autor
especializado ni canal al usuario). No es ceremonia: para un epic bien descubierto
el costo es un dispatch Opus que reemplaza trabajo que hoy hace un agente
general-purpose dentro del epic-agent; para un epic ambiguo, ahorra el ciclo
completo RED→GREEN→review→Iteration Cap que hoy es donde aflora. Las
modificaciones M1-M7 no cambian la tesis; corrigen dónde vive la evidencia, dónde
se corrige una firma, y cuánto texto entra al hot path.

---

## 2. Análisis de lo implementado (v1.14.0, 49 commits, 2026-05-01 → 08-21)

### 2.1 Fortalezas (con evidencia)

| Fortaleza | Evidencia | Por qué importa para LLMs |
|---|---|---|
| **Especialización por función cognitiva con contexto restringido** | 5 workers con Required Inputs, Step 0 (Manifest) y formato de salida estricto; cláusulas anti-memoria/anti-Context7 (`implementer:23-30`, `tdd-test-writer:32-38`) | Reduce drift; convierte el "falta contexto" en fallo barato de turno 1 en vez de retrabajo parcial. |
| **Evidencia encadenada, no confianza** | `RED_SHA` → `build-locked.json` → hook `PreToolUse` → `git diff` (Step 5.5) → Dim 4 del reviewer (`code-reviewer:90-101`) | Tres capas independientes sobre el fallo más caro (tampering de tests). Modelo a replicar en el gate (SPEC_SHA). |
| **Progressive disclosure consciente del hot path** | `docs/tdd-honesty-violations.md` solo se lee al fallar; `token-optimization-report.md` O1-O4 aplicados | Cada línea del hot path se paga por spec; el repo lo sabe y lo mide. |
| **Filesystem como máquina de estados** | `start/SKILL.md:14,20` ("never read full file contents for routing"); router en Haiku | Determinismo y reanudación sin depender de memoria de chat. |
| **Contrato de API como fuente única (operationId)** | `architecture/SKILL.md` Part B; validator Dim 6 con cobertura bidireccional (`:76`) | Elimina la causa #1 de drift back/front. |
| **Verdad viva + ROADMAP-como-cola** | `_current/` + lápidas (`ROADMAP_TEMPLATE:74-89`); `new-feature:57` lee `_current/` | Resuelve spec rot sin romper inmutabilidad. |
| **Anti-racionalización explícita** | Tablas "Common Rationalizations" en implementer/ux-implementer/debug/verify | La herramienta correcta para moldear comportamiento de LLM: nombra la excusa exacta. |
| **TDD para prompts** | `write-skill/SKILL.md` (RED = escenario sin skill, documentar racionalización verbatim) | Raro en frameworks de agentes; evita "skills" que nunca se probó que cambien comportamiento. |
| **Iteración guiada por datos de costo** | `usage-cost-analysis.md` (router 32 % del uso) → R1-R4 implementados en v1.4-1.8 | Optimiza costo accidental, protege el esencial. |
| **Registro de decisiones con alternativas descartadas** | Tablas D-n en todos los `docs/*-design.md` | Audit trail; evita re-litigar (p. ej. worktrees v1.5→v1.8). |

### 2.2 Hallazgos (severidad · evidencia · corrección)

**G1 · Release inconsistente y sin CI — ALTA.** `plugin.json:4` = 1.14.0;
`.claude-plugin/plugin.json:4` = 1.13.0; `.github/plugin/marketplace.json:9,16` =
1.13.0; `copilot/compatibility-matrix.json:3` `claudeSource` = 1.13.0. El test
`hooks/test/copilot-plugin-contract.test.js` **falla en HEAD** (`1.14.0 !==
1.13.0`; 6/7 pasan). README changelog termina en v1.12.0 — ni v1.13.0 (Copilot/
Antigravity) ni v1.14.0 tienen entrada. No hay `package.json` ni workflow; los tests
solo corren a mano (`node --test hooks/test/*.test.js` — pasar el directorio falla
en Node 24/Windows). Corrección: `package.json` con `"test"`, workflow de GitHub
Actions, un `scripts/bump-version.js` que toque los 4 manifiestos, y un test que
exija que README contenga `### v<versión actual>`.

**G2 · El epic-agent recibe todo `build/SKILL.md` — ALTA (hot path).**
`build/SKILL.md:79`. ~200 de 512 líneas son del coordinador. Además lo invita a
ejecutar pasos que tiene prohibidos (8.5 lo aclara `:469`, pero 8.7, Branching y
la cola no). Ver M3.

**G3 · Sin template de requerimientos ni IDs de reglas de negocio — ALTA (para el
gate).** Ver C-4. `templates/` tiene template para todo entregable excepto
`business_requirements.md`. Sin anclas estables, Dim 4 del validator, C2 del gate y
la trazabilidad de `_current/` son juicio, no mecánica. Además `discover` podría
tener un chequeo mecánico de salida (placeholders, toda HU con Exposición, toda HU
`UI`/`API-externa` en Capacidades de Frontera) — hoy es self-review en prosa
(`discover:90-97`).

**G4 · El ROADMAP no pasa por el validator — ALTA.** `architecture/SKILL.md` Part A
(`:51-59`) y Part B (`:87-95`) tienen gate; Part C (`:136-146`) solo self-review. Sin
embargo el validator **ya tiene** el chequeo escrito ("When the ROADMAP is also in
scope", `architecture-validator:82`) — nunca se invoca con el ROADMAP. El ROADMAP es
el input directo del gate propuesto (bloque de epic: `operationId`s, BR, componentes,
sintaxis parseable de `Dependencias`). Un dispatch por proyecto; garbage-in evitado.

**G5 · "Cero código sin spec" no es mecánico — MEDIA.** `integration-claude-native.md:179`
lo listó como #7 ("Alto/Medio"). El hook bloquea tests durante GREEN; nada impide
que el implementer escriba fuera de los paths del spec. La Superficie ya declara
`Crea:`/`Llama a:` con paths; `build-locked.json` puede llevar `allowed_paths` y el
hook (guard + matcher ya existen) denegar `Write` fuera de ellos durante GREEN.
Encaja en la misma release que extiende el estado con `spec_paths`.

**G6 · El router como agente puede ejecutar fases dentro de un subagente Haiku —
MEDIA (verificar con transcript).** `README.md:72` documenta `/agent
specture:specture-router` como entrada. `specture-router/AGENT.md:18` ordena
invocar `start/SKILL.md`, y `start:112` dice "Then invoke that skill and follow
its instructions". Como está escrito, nada impide que el router (subagente, Haiku,
sin `AskUserQuestion`) termine corriendo `build` o `discover` — que necesitan
hablar con el usuario. `usage-cost-analysis.md:40-48` midió "subagentes bajo
specture:start = 19 %"; la respuesta fue bajar el modelo (R1), no cambiar la
estructura. Corrección: el agente router devuelve `PHASE: <name> · SKILL: <path>` y
se detiene (formato estricto como todo agente); el chat principal invoca el skill.
O eliminar el agente — los skills ya son slash commands.

**G7 · Telemetría write-only — MEDIA.** `index-usage.jsonl`, `learn-history.jsonl`,
`audit-history.jsonl` y el propuesto `build-metrics.jsonl` se escriben; ningún
skill los lee. D20 ("las métricas deciden") requiere `jq` a mano. Además
`docs/.specture-meta/` está gitignoreado (`setup:60`) → la comparación
antes/después es por máquina, no por proyecto. Corrección: `hooks/lib/metrics-report.js`
(+ modo `knowledge stats`) que resume tasas por epic; decidir si `build-metrics.jsonl`
debe ser trackeado (es evidencia de proceso, no preferencia personal).

**G8 · `_current/` arranca vacío en proyectos Adopt — MEDIA.** Diferido en
`reconciliation-design.md:131`. `new-feature:62` cae a "scan `docs/05-specs/`" — que
en Adopt no existe. El Impact Ripple en proyectos adoptados no tiene fuente de
verdad conductual. Corrección: modo `characterize` (read-only, por componente) que
puebla `_current/<slug>.md` desde código; hermano del brief de caracterización de
`modernize:180-196`.

**G9 · Espejos Copilot nominales — MEDIA.** `copilot/agents/*.agent.md` tienen
16-19 líneas vs 63-274 del `AGENT.md`; pierden Manifest, racionalizaciones,
formatos, worked examples. El test de contrato solo verifica existencia. Si el
formato de Copilot admite cuerpos largos, **generar** los espejos desde `AGENT.md`
(un script) en vez de mantenerlos a mano; si no, documentar la brecha de calidad
por plataforma.

**G10 · Texto obsoleto en warm/hot path — BAJA.** `start/SKILL.md:102-104` ("Context
Hygiene Rule … between specs … clear chat history") es de la era pre-v1.8.0; el
modelo secuencial lo hizo automático (`build:490`). `build/SKILL.md:165-170` (Step 1)
y `:197-214` (Step 2.5 con tabla de estados) conservan residuos de los 3 modos; el
epic-agent los "SKIP"ea por prompt (`:93-96`). `hooks/session-start.js` es código
muerto desde v1.5.0 (no está en `settings.json` ni `hooks.json`). El gate toca
exactamente estas secciones — limpiar en la misma pasada.

**G11 · Config muerta — BAJA.** `stack.template.yml:77`
`quality.required_test_coverage_percent` no lo lee ningún skill ni agente. O se
cablea a Step 7 / Dim 3 del reviewer, o se elimina.

**G12 · Drift de documentación — BAJA.** README "Los 5 Agentes" (hay 6 directorios);
árbol de estructura sin `hooks/`, `copilot/`, `hooks.json`; `antigravity_plugin_plan.md`
suelto en la raíz (debería vivir en `docs/`).

---

## 3. Oportunidades de mejora priorizadas

| Prio | Ítem | Tipo | Esfuerzo | Impacto | Depende de |
|---|---|---|---|---|---|
| **P0** | G1 CI + sync de versiones + changelog v1.13/1.14 | Higiene | Horas | Alto (credibilidad) | — |
| **P0** | G10/G11/G12 limpieza de texto obsoleto y config muerta | Higiene | Horas | Bajo-medio (hot path) | — |
| **P1** | G3 `BUSINESS_REQUIREMENTS_TEMPLATE.md` + IDs `RN/CL/FA` + chequeo mecánico de salida de `discover` | Prerrequisito del gate | 1-2 días | Alto (C2 mecánico, Dim 4, `_current/`) | — |
| **P1** | G4 gate del validator sobre el ROADMAP (Part C) | Prerrequisito del gate | Medio día | Alto (input del planner) | — |
| **P1** | M3 split `build/SKILL.md` coordinador / `EPIC_LOOP.md` | Prerrequisito del gate | 1 día | Alto (hot path, erosión) | — |
| **P1** | G6 router: salida estricta, nunca ejecuta fases | Corrección estructural | Medio día | Medio-alto (costo, UX) | — |
| **P2** | Spec Planning Gate etapa 1 (§1.5) con M1, M6, M7 | Feature | 1-2 semanas | Alto | P1 |
| **P2** | Spec Planning Gate etapa 2 (§1.5) con M2, M4, M5 + métricas | Feature | 1-2 semanas | Alto | etapa 1 + datos |
| **P3** | G5 `allowed_paths` en hook (cero código sin spec, mecánico) | Enforcement | 1 día | Medio-alto | etapa 2 (mismo estado) |
| **P3** | G7 lector de métricas + decidir tracking de `build-metrics.jsonl` | Observabilidad | Medio día | Medio | etapa 2 |
| **P3** | G8 `characterize` para Adopt → `_current/` | Feature | 2-3 días | Medio (proyectos adoptados) | — |
| **P3** | G9 espejos Copilot generados desde `AGENT.md` | Tooling | 1 día | Medio (paridad) | — |
| **P4** | RED de todos los specs en paralelo tras el sello (el gate lo habilita; requiere sello por lista de archivos, no por glob) | Wall-clock | Medio | Medio | etapa 2, medir primero |
| **P4** | `docs/worktree-epic-isolation-design.md` (rama por epic) | Feature | — | — | **después** del gate: ambos reescriben el paso 5.3 de la cola |

## 4. Secuencia recomendada

1. **Hoy:** P0 (arreglar el test que falla, changelog, CI). Sin esto, cualquier
   release del gate hereda un repo que ya no verifica sus propias afirmaciones.
2. **Antes de escribir `spec-planner`:** P1 completo. Los cuatro ítems hacen al gate
   más barato (C2 mecánico), más seguro (ROADMAP validado, `build` más corto) y
   eliminan una ambigüedad de entrada (router). Ninguno depende del gate; todos lo
   mejoran.
3. **v1.15.0:** etapa 1 del gate, con disciplina `write-skill` sobre un proyecto de
   prueba con `.specture/` mínimo (escenarios 1, 4, 5, 6, 7, 8 de §6.1 del diseño).
4. **v1.16.0:** etapa 2 con los datos de ~10 epics de la etapa 1 decidiendo si el
   validator de set (C-6) se mantiene o se vuelve por spec.
5. **Después:** P3 en el orden de la tabla; P4 solo con medición.
