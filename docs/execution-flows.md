# Diagramas de Flujo de Ejecución — Specture

> Mapa visual de **todos los flujos que el framework ejecuta en tiempo real**: cómo se entra,
> cómo se enruta por estado, cómo cada fase y cada capacidad transversal corre, qué agentes de
> contexto restringido se despachan y qué gates bloquean el avance.

Los diagramas están en **Mermaid** — se renderizan automáticamente en GitHub, VS Code (con la
extensión Mermaid), Obsidian y la mayoría de visores Markdown. Si tu visor no soporta Mermaid,
cada diagrama va acompañado de prosa que describe el flujo.

## Cómo leer estos diagramas (notación)

| Forma | Significado |
|-------|-------------|
| `([texto])` (estadio) | Entrada / salida del flujo (trigger, artefacto, fin) |
| `[texto]` (rectángulo) | Paso de proceso / acción |
| `{texto}` (rombo) | **Gate** o decisión: bloquea el avance hasta resolverse |
| `[[texto]]` (subrutina) | **Enrutamiento** a otro skill (handoff) |
| Línea sólida `-->` | Flujo principal |
| Línea punteada `-.->` | Flujo condicional / de excepción / retorno |
| Etiqueta de arista `-->|"cond"|` | Condición que dispara esa transición |

**Convención de color en SVG:** un solo acento para gates/decisiones, neutro para el resto.

---

## 1. Mapa general

### 1.1 Ciclo de vida — las 5 fases + capacidades transversales

Specture lleva un proyecto **de la idea al código** en 5 fases secuenciales. El router (`start`)
decide en qué fase está el proyecto **mirando el filesystem**, no el historial de chat. Las
capacidades transversales no se enrutan por estado: se activan por **síntoma** durante cualquier fase.

```mermaid
flowchart TB
    U(["Usuario: 'inicia/continúa el proyecto'<br/>o invoca /specture:start"]) --> R{"start<br/>Router de estado<br/>(inspecciona el filesystem)"}

    subgraph FASES["Las 5 fases — secuenciales y gated"]
      direction LR
      F0["Fase 0 · setup<br/>.specture/ + CLAUDE.md"] --> F1["Fase 1 · discover<br/>business_requirements.md"]
      F1 --> F2["Fase 2 · architecture<br/>arquitectura + contrato API + ROADMAP"]
      F2 -->|"hay frontend"| F3["Fase 3 · ux-design<br/>navigation_map + design_system"]
      F2 -->|"sin frontend"| F4
      F3 --> F4["Fase 4 · build<br/>código testeado, revisado, verificado"]
    end

    R --> FASES

    subgraph TRANS["Capacidades transversales — activadas por síntoma"]
      direction LR
      T1["debug"]
      T2["new-feature"]
      T3["verify"]
      T4["modernize"]
      T5["knowledge<br/>capture · audit"]
      T6["handoff-ingest"]
      T7["contract-sync-audit"]
      T8["setup-docs-bridge"]
    end

    F4 -.->|"test falla 2× / reviewer rechaza / BLOCKED"| T1
    F4 -.->|"feature fuera del ROADMAP"| T2
    F4 -.->|"antes de 'completado'"| T3
    FASES -.->|"migrar/subir versión"| T4
```

### 1.2 Router de estado (`start`) — máquina de estados

El router corre un chequeo de esquema (Step 0, desde v1.15.0) y cinco chequeos de fase **en
orden**, y se detiene en el primero que falle, enrutando a la fase dueña. **Regla de costo:** nunca
lee archivos completos — usa chequeos de existencia, `grep` de una línea, la lectura de un solo
campo y una llamada al script del doctor. Confía en el filesystem por encima de la memoria.

```mermaid
flowchart TD
    Start(["/specture:start o 'continuemos con el roadmap'"]) --> S0{"Step 0<br/>doctor check --brief<br/>¿migraciones pendientes?"}
    S0 -->|"sí: avisa y ofrece<br/>/specture:doctor migrate (no bloquea)"| S1
    S0 -->|"no / sin node"| S1{"Step 1<br/>.specture/stack.yml<br/>¿existe?"}
    S1 -->|No| SETUP[["→ setup · Fase 0"]]
    S1 -->|Sí| S2{"Step 2<br/>business_requirements.md<br/>¿existe?"}
    S2 -->|No| S2b{"¿docs-index.yml con<br/>entradas tag 'requirements'?"}
    S2b -->|No| DISCOVER[["→ discover · Fase 1"]]
    S2b -->|Sí| ASK1{"Preguntar al usuario:<br/>(a) bridge · (b) discover · (c) seguir"}
    ASK1 -->|a| BRIDGE[["→ setup-docs-bridge"]]
    ASK1 -->|b| DISCOVER
    ASK1 -->|c| S3
    S2 -->|Sí| S3{"Step 3<br/>ROADMAP.md ¿existe?"}
    S3 -->|No| ARCH[["→ architecture · Fase 2"]]
    S3 -->|Sí| S4{"Step 4<br/>frontend.framework definido<br/>Y faltan docs UX?"}
    S4 -->|Sí| UX[["→ ux-design · Fase 3"]]
    S4 -->|No| S5{"Step 5<br/>estado de los epics<br/>en ROADMAP"}
    S5 -->|"algún [ ] o [/]"| BUILD[["→ build · Fase 4"]]
    S5 -->|"todos [x]"| ASK2{"Preguntar: (a) auditar ·<br/>(b) nueva feature · (c) finalizar"}
    ASK2 -->|a| AUD[["→ knowledge (audit) / auditoría"]]
    ASK2 -->|b| NF[["→ new-feature"]]
    ASK2 -->|c| FIN(["Fin"])
```

---

## 2. Modelo de agentes de contexto restringido

El corazón de Specture: las fases despachan **agentes funcionales**, cada uno recibe **solo** los
archivos que necesita — nunca la conversación entera, memoria personal ni docs externos (salvo
Context7 en la Dimensión 5 del reviewer, cuando está habilitado). Esto previene el *drift* y la
alucinación acumulada. No hay "agente backend vs frontend por capa": hay **funciones cognitivas**
distintas.

```mermaid
flowchart LR
    O["Orquestador<br/>(build / architecture / modernize / new-feature)<br/>ensambla contexto RESTRINGIDO por agente"]

    O -->|"documento + .specture/<br/>(SIN código)"| AV["architecture-validator · Opus<br/>APPROVED / REJECTED / BLOCKED"]
    O -->|"spec + business rules + framework de test<br/>(SIN implementación — anti-bias)"| TW["tdd-test-writer · Sonnet<br/>tests RED (fallidos)"]
    O -->|"spec + tests RED + archivos a tocar + RED_SHA"| IM["implementer · Sonnet<br/>código GREEN (lógica)"]
    O -->|"spec + design_system + slice contrato<br/>+ tests + checklist de marca"| UX["ux-implementer · Sonnet<br/>UI fiel a tokens/contrato/a11y"]
    O -->|"diff + spec + .specture/<br/>+ resultado del gate 5.5"| CR["code-reviewer · Opus<br/>APPROVED / REJECTED_MINOR / REJECTED_MAJOR"]

    AV -.->|"NO recibe"| X1["código de implementación"]
    TW -.->|"NO recibe"| X2["archivos de implementación"]
    IM -.->|"NO recibe"| X3["conversación · memoria · resto del repo"]
    CR -.->|"NO hace"| X4["modificar código (solo reporta)"]
```

**Verdicts comunes:** `APPROVED` · `REJECTED` / `REJECTED_MINOR` / `REJECTED_MAJOR` ·
`NEEDS_CONTEXT` (falta input → falla barata en turno 1) · `BLOCKED` (no puede avanzar).
Todos los implementadores validan el **Dispatch Manifest** como primera acción (Step 0).

---

## 3. El Build Loop — el núcleo

### 3.1 Modelo coordinador / cola secuencial

Hay **un solo** modo de ejecución. El chat es **solo coordinador**: no genera specs ni corre tests.
Construye una cola de hasta **N** epics y despacha **un epic-agent aislado a la vez**
(concurrencia = 1). El contexto del coordinador se mantiene O(n_epics) — solo checkboxes + reportes.

```mermaid
flowchart TD
    A(["Usuario: 'ejecuta N'<br/>(sin número → N=1 · 'todas' → todos los pendientes)"]) --> B["Leer solo los checkbox + línea Dependencias<br/>de cada epic en ROADMAP"]
    B --> C["Construir la cola: hasta N epics<br/>en orden de dependencia"]
    C --> Br{"¿§13 define reglas de rama?"}
    Br -->|Sí| Br2["Crear UNA rama de sesión<br/>(sin stacked-branches · sin auto-merge)"]
    Br -->|No| D["TaskCreate por epic encolado<br/>(cola visible)"]
    Br2 --> D
    D --> L{"¿Quedan epics en la cola?"}
    L -->|Sí| E["Marcar epic [/] + commit<br/>despachar 1 epic-agent fresco"]
    E --> F["epic-agent ejecuta Steps 2–8<br/>(contexto aislado, se descarta al terminar)"]
    F --> G{"Procesar el reporte"}
    G -->|DONE| H["Verificar [x] + commit por git log<br/>(no confiar en el reporte)"]
    G -->|"BLOCKED / REJECTED_MAJOR"| ESC(["Escalar al usuario · sin auto-retry"])
    H --> L
    L -->|No| FIN(["Cola drenada · sugerir merge/PR (W-4)<br/>Specture nunca mergea solo"])
```

### 3.2 El loop por epic — `spec → validate → RED → GREEN → review → verify`

El diagrama central del framework. Cada epic recorre estos pasos dentro de su epic-agent. Los
**gates** (rombos) son innegociables: validación de arquitectura, RED commit, TDD Honesty Gate,
code review y verificación.

```mermaid
flowchart TD
    S1["Step 1 · Pick & Lock<br/>epic → [/] · commit"] --> S2["Step 2 · Generar spec(s)<br/>granular · sin código · self-contained"]
    S2 --> S25["Step 2.5 · TaskCreate por spec<br/>(visibilidad en vivo)"]
    S25 --> S3{"Step 3 · GATE<br/>architecture-validator"}
    S3 -->|REJECTED| FIXS["Corregir spec<br/>(o escalar → nuevo ADR)"]
    FIXS --> S3
    S3 -->|APPROVED| S4["Step 4 · RED · tdd-test-writer<br/>escribe tests que FALLAN (sin ver código)"]
    S4 --> S4c{"Post-checks: ¿fallan por la razón correcta?<br/>¿RED commit solo-tests? · capturar RED_SHA<br/>· sellar .specture/state/build-locked.json"}
    S4c -->|No| S4
    S4c -->|Sí| S5["Step 5 · GREEN · implementer / ux-implementer<br/>código mínimo · tests sellados"]
    S5 --> S55{"Step 5.5 · TDD Honesty Gate (mecánico)<br/>git diff RED_SHA..HEAD -- tests"}
    S55 -->|"diff ≠ vacío ❌"| VIOL["Violación TDD →<br/>docs/tdd-honesty-violations.md"]
    S55 -->|"vacío ✅"| S6{"Step 6 · GATE · code-reviewer<br/>(+ linter + type-check en paralelo)"}
    S6 -->|REJECTED_MINOR| S5
    S6 -->|REJECTED_MAJOR| ESC["Fix grande con contexto fresco<br/>o escalar al usuario"]
    S6 -.->|"3 loops sin APPROVED"| CAP["Iteration Cap → arreglar spec<br/>o invocar debug"]
    S6 -->|APPROVED| S7{"Step 7 · Verificación<br/>correr tests fresh · leer salida completa"}
    S7 -->|"rojo"| ESC
    S7 -->|"verde"| S8["Step 8 · epic → [x] · commit<br/>· borrar build-locked.json"]
    S8 --> S85["Step 8.5 · Capturar aprendizajes<br/>(opt-in default No → knowledge)"]
    S85 --> S87["Step 8.7 · Reconciliación de milestone<br/>(si cierra: _current/ + lápidas en ROADMAP)"]
    S87 --> S9(["Step 9 · Reset de contexto (automático)<br/>el epic-agent se descarta → siguiente epic"])
```

### 3.3 TDD Honesty Gate — secuencia

El contrato de tests se **sella** en el RED commit. El implementer tiene prohibido tocar los tests;
un hook opcional lo bloquea mecánicamente, y el coordinador siempre corre el `git diff` como
defensa en profundidad.

```mermaid
sequenceDiagram
    participant O as Orquestador
    participant TW as tdd-test-writer
    participant H as Hook PreToolUse<br/>(opcional)
    participant IM as implementer

    O->>TW: spec validado (sin código)
    TW->>TW: escribe tests que FALLAN
    TW-->>O: RED commit (solo tests) + RED_SHA
    O->>O: sella .specture/state/build-locked.json
    O->>IM: spec + tests + RED_SHA<br/>"los tests están sellados"
    IM->>H: intenta Edit/Write
    H-->>IM: si toca un test sellado → DENY
    IM-->>O: código GREEN + HEAD_SHA (tests intactos)
    O->>O: git diff RED_SHA..HEAD -- <test-globs>
    Note over O: vacío → ✅ continúa a code review<br/>no vacío → ❌ violación TDD (recovery)
```

### 3.4 Epics de frontend — Design-System-First + Visual Approval Gate

Para UI, "los tests pasan" nunca significa "se ve bien". La lógica se testea; la **calidad visual la
aprueba un humano**, nunca Claude. El epic de design system se construye primero y pasa por un gate
de aprobación visual antes de que pueda empezar cualquier página.

```mermaid
flowchart TD
    A(["Epic de frontend<br/>(toca UI · frontend.framework ≠ none)"]) --> B{"¿Es el epic de<br/>Design System Foundation?"}
    B -->|Sí| C["ux-implementer: tokens + librería de componentes<br/>+ ruta /dev/design-system (solo dev)"]
    C --> D{"GATE de Aprobación Visual (humano)<br/>screenshots vía Playwright si está disponible"}
    D -->|"pide ajustes"| C
    D -->|"aprobado"| E(["epic [x] · habilita los epics de página"])
    B -->|"No · epic de página"| F{"¿Design System ya aprobado?"}
    F -->|No| BLOCK["No está realmente 'ready'<br/>(aprobación = dependencia implícita)"]
    F -->|Sí| G["ux-implementer: la página consume el backend<br/>SOLO vía el cliente tipado del contrato"]
    G --> H["code-reviewer · Dimensión 6 (fidelidad frontend):<br/>tokens · a11y · contrato · reglas de marca"]
```

---

## 4. Flujos de fase

### 4.1 Setup — 3 modos (Bootstrap / Adopt / Reconfigure)

```mermaid
flowchart TD
    M{"Detectar modo<br/>(.specture/stack.yml + contenido del proyecto)"}
    M -->|"proyecto vacío"| A["Bootstrap"]
    M -->|"con código"| B["Adopt"]
    M -->|"ya existe .specture/"| C["Reconfigure"]

    A --> A2["Wizard (preguntas 2-3 a la vez): tipo · lenguaje ·<br/>framework/ORM/DB · frontend · patrón · §10/§12/§13"]
    A2 --> A3{"Validar coherencia<br/>(antes de escribir archivos)"}
    A3 --> A4["Generar stack.yml + conventions.md<br/>+ ADR 001 + CLAUDE.md del proyecto"]

    B --> B2["Escaneo de detección: manifests<br/>(package.json, *.csproj, go.mod…)"]
    B2 --> B3["Escaneo estructural → patrón de arquitectura,<br/>tests, naming, superficie de API"]
    B3 --> B5{"Mostrar borrador del stack.yml<br/>· confirmar con el usuario"}
    B5 --> B6["conventions.md (muestreo 3-5 archivos)<br/>+ ADR 'adopted-stack'"]
    B6 --> B85{"¿Carpeta de docs preexistente ≥10 .md?"}
    B85 -->|"Sí + acepta"| BR[["→ setup-docs-bridge"]]
    B85 -->|No| B9["Sugerir siguiente paso según estado"]
    BR --> B9

    C --> C2["Leer .specture/ completo"]
    C2 --> C3{"¿El cambio rompe un ADR?"}
    C3 -->|"siempre"| C4["Nuevo ADR Supersedes · viejo Superseded by<br/>(jamás borrar/reescribir un ADR previo)"]

    A4 --> V
    B9 --> V
    C4 --> V{"Checklist de verificación antes de salir"}
    V --> R(["Anunciar (ES) + enrutar:<br/>discover / new-feature / contract-sync-audit / architecture"])
```

### 4.2 Discover — levantamiento socrático (sin tecnología)

```mermaid
flowchart TD
    G["HARD-GATE: nada de stack/frameworks/DB/código<br/>(si el usuario lo intenta, redirigir)"] --> M{"Modo"}
    M -->|"greenfield"| S["Socrático puro:<br/>'describe la idea en 2-3 oraciones'"]
    M -->|"adopted"| S2["Resumir el código observado,<br/>luego preguntar qué falta / nueva dirección"]
    S --> T
    S2 --> T["7 temas, uno a la vez (3-5 preguntas, multiple-choice):<br/>1 propósito · 2 actores · 3 historias + exposición ·<br/>4 reglas de negocio · 5 casos límite · 6 NF · 7 fuera de scope"]
    T --> DC{"¿El scope abarca varios subsistemas independientes?"}
    DC -->|Sí| SPLIT["Proponer dividir en sub-proyectos<br/>(construir uno por completo primero)"]
    DC -->|No| AG{"Esperar a que el usuario diga<br/>'ya está' / 'podemos seguir'"}
    SPLIT --> AG
    AG --> D1["Generar business_requirements.md<br/>(con Capacidades de Frontera marcadas)"]
    D1 --> D2{"Self-review: placeholders · contradicciones ·<br/>actores indefinidos · marcas de exposición"}
    D2 -->|"problemas"| T
    D2 -->|"limpio"| D3{"Validación explícita del usuario<br/>(NO auto-enruta)"}
    D3 -->|"aprueba"| ARCH[["→ architecture · Fase 2"]]
```

### 4.3 Architecture — arquitectura + contrato de API + ROADMAP (A/B/C)

Tres partes secuenciales, cada una con su gate. El **contrato de API** es la fuente única de verdad
backend↔frontend: nadie inventa URLs ni shapes fuera de él.

```mermaid
flowchart TD
    I{"¿Inputs presentes?<br/>stack · conventions · ADRs · requirements"}
    I -->|"falta alguno"| RB[["→ start (re-enrutar a la fase faltante)"]]
    I -->|"OK"| A["Parte A · architecture.md<br/>(7 secciones · agnóstico al stack · sin código · slugs estables)"]
    A --> GA{"GATE · architecture-validator"}
    GA -->|REJECTED| A
    GA -->|APPROVED| BW{"¿Hay frontera de red?<br/>(backend+frontend o API externa)"}
    BW -->|"No (CLI/lib/desktop)"| Croad
    BW -->|Sí| Bc["Parte B · contrato de API<br/>openapi.yaml + .md · operationId estables · 1 error envelope"]
    Bc --> GB{"GATE · architecture-validator<br/>cobertura bidireccional capacidad ↔ operación"}
    GB -->|REJECTED| Bc
    GB -->|APPROVED| Croad["Parte C · ROADMAP.md<br/>Standard Milestone Order · dependencias explícitas<br/>· frontend tras el backend que consume"]
    Croad --> SR{"Self-review del ROADMAP (5 puntos)"}
    SR --> W{"Anunciar (ES) y esperar al usuario<br/>(no auto-avanza)"}
    W -->|"hay frontend"| UX[["→ ux-design · Fase 3"]]
    W -->|"sin frontend"| BLD[["→ build · Fase 4"]]
```

### 4.4 UX Design — 2 rutas (ambas producen los mismos 2 documentos)

La ruta solo decide **quién renderiza** el design system a código; ambas entregan `navigation_map.md`
+ `design_system.md` completo.

```mermaid
flowchart TD
    AC{"Activación: frontend en stack<br/>+ docs/03-ux-ui/ incompleto"}
    AC -->|"sin frontend"| BLD[["→ build"]]
    AC -->|"Adopt con UI existente"| RE["Reverse-engineer design_system.md<br/>+ nav map desde las rutas reales"]
    AC -->|"ya hay un handoff de diseño"| HI[["→ handoff-ingest"]]
    AC -->|"greenfield"| L{"Step 1 · confirmar / elegir<br/>la librería de UI"}
    L --> RT{"Step 2 · elegir ruta"}
    RT -->|"Ruta 1 · delegar a IA de diseño externa"| SPECS["+ design_specs_for_ai.md<br/>(exige entregar un design system)"]
    RT -->|"Ruta 2 · Specture renderiza en build"| NAV
    SPECS --> NAV["Step 3 · navigation_map.md<br/>(referencia operationId del contrato · no inventa URLs)"]
    NAV --> DS["Step 3 · design_system.md (siempre · completo)"]
    DS --> SR{"Step 4 · self-review (checklist)"}
    SR --> HO{"Step 5 · hand-off (espera al usuario)"}
    HO -->|"Ruta 1 (al volver el handoff)"| HI
    HO -->|"Ruta 2"| BLD2[["→ build · Modo Frontend"]]
```

---

## 5. Flujos transversales

### 5.1 Debug — causa raíz obligatoria

Modo emergencia. Prohíbe fixes sin investigación. La hipótesis se escribe **dentro de Plan mode** —
hasta que el usuario aprueba, no se puede tocar código. Límite duro de **3 hipótesis** antes de
escalar arquitectónicamente.

```mermaid
flowchart TD
    L["Iron Law: cero fixes sin causa raíz<br/>+ cero fixes sin DEBUG_LOG escrito"] --> P1["Fase 1 · Investigación de causa raíz<br/>leer error completo · reproducir · git diff · trazar al origen"]
    P1 --> P2["Fase 2 · Análisis de patrones<br/>comparar con un ejemplo que SÍ funciona, línea por línea"]
    P2 --> P3{"Fase 3 · Hipótesis + Log<br/>EnterPlanMode → escribir el log como plan → ExitPlanMode"}
    P3 -->|"usuario NO aprueba"| P3
    P3 -->|"aprueba"| WRITE["Escribir DEBUG_LOG en docs/06-debug-logs/<br/>(idéntico al plan aprobado)"]
    WRITE --> P4{"Fase 4 · Probar la hipótesis<br/>cambio mínimo · una variable · correr el test"}
    P4 -->|"correcta"| OK["Documentar resolución<br/>+ verificar que nada más se rompió"]
    P4 -->|"incorrecta"| H{"¿Menos de 3 hipótesis probadas?"}
    H -->|Sí| P3
    H -->|"3 fallidas"| ESC(["Escalación arquitectónica<br/>refactor / nuevo ADR"])
    OK --> P45["Fase 4.5 · capturar aprendizajes<br/>(opt-in default No → knowledge)"]
    P45 --> EX{"Exit Criteria (5 ítems)<br/>causa raíz · fix al origen · suite verde · log commiteado"}
    EX --> RET[["→ build / fase llamante"]]
```

### 5.2 New-feature — Impact Ripple Analysis

```mermaid
flowchart TD
    S1["Step 1 · Mini-discovery socrático scopeado<br/>→ docs/01-requirements/feature-<slug>.md"] --> S2{"Step 2 · Impact Ripple Analysis<br/>EnterPlanMode · lee _current/ (verdad viva)"}
    S2 -.->|"contradice un ADR Accepted"| ADR["Rechazar la feature como incompatible<br/>o crear un ADR que lo supersede"]
    S2 --> EX["ExitPlanMode (pide aprobación)<br/>Edit/Write/ROADMAP bloqueados hasta aprobar"]
    EX --> S3{"Step 3 · Validación del usuario<br/>(coste declarado honestamente)"}
    S3 -->|"re-scope"| S2
    S3 -->|"acepta"| S4["Step 4 · Actualizar ROADMAP (nuevo Milestone/Epic [ ])<br/>+ architecture/ADRs si cambian"]
    S4 -.->|"cambian componentes"| AV["architecture-validator valida"]
    S4 --> S5[["Step 5 · → build (work type = feature)"]]
```

### 5.3 Verify — la función gate de 5 pasos

Gate puro (no enruta por estado). Evidencia antes que afirmaciones: ningún "completado" sin correr
el comando de verificación **en este turno** y leer su salida.

```mermaid
flowchart LR
    L(["Iron Law: cero claims de 'completado'<br/>sin evidencia fresca corrida este turno"]) --> G1["IDENTIFY<br/>¿qué comando prueba el claim?"]
    G1 --> G2["RUN<br/>ejecutar completo · sin atajos · sin caché"]
    G2 --> G3["READ<br/>leer salida completa · exit code · contar fallos"]
    G3 --> G4{"VERIFY<br/>¿la salida confirma el claim?"}
    G4 -->|No| AC(["Declarar el estado REAL<br/>con la evidencia"])
    G4 -->|Sí| G5(["THEN · afirmar CON evidencia"])
```

### 5.4 Modernize — migración incremental (Strangler Fig)

Cubre upgrade de versión y migración de tecnología. La ley de hierro: **tests de caracterización
antes del primer cambio de código**; nunca Big Bang; un módulo por epic.

```mermaid
flowchart TD
    AC{"¿stack.yml + ROADMAP existen?"}
    AC -->|No| RB[["→ start"]]
    AC -->|Sí| S1{"Step 1 · Discovery (tipo de migración)"}
    S1 -->|"misma tech, +versión mayor"| UP["Version Upgrade"]
    S1 -->|"otra tech equivalente"| MG["Tech Migration"]
    UP --> S1b{"Confirmar el tipo con el usuario"}
    MG --> S1b
    S1b --> S2["Step 2 · Gap Analysis<br/>(Context7 como fuente si está habilitado)"]
    S2 --> G2{"GATE · architecture-validator (gap analysis)"}
    G2 --> S3{"Step 3 · Estrategia Strangler Fig (orden inside-out)<br/>· el usuario aprueba la lista de módulos"}
    S3 --> S4["Step 4 · stack.yml (sección migration:) + ADR de apertura"]
    S4 --> S5{"Step 5 · GATE OBLIGATORIO · tests de caracterización<br/>deben pasar en el stack VIEJO → CHARACTERIZATION_SHA"}
    S5 -->|"alguno falla"| DBG[["→ debug (arreglar fallos previos)"]]
    S5 -->|"todos verdes"| S6["Step 6 · ROADMAP de migración<br/>1 epic por módulo + epic de cleanup final"]
    S6 --> S7["Step 7 · loop por epic (igual que build)<br/>+ Dimensión extra: 'no Mixed Tech Debt'"]
    S7 --> RG{"Step 7.7 · regresión · caracterización 100% verde"}
    RG -->|"falla"| DBG
    RG -->|"verde + quedan epics"| S7
    RG -->|"solo queda cleanup"| S8["Step 8 · Completion Gate · correr cleanup<br/>· quitar sección migration: · ADR de cierre"]
```

### 5.5 Knowledge — captura + auditoría (una skill, dos modos)

Higiene de conocimiento. **Nunca escribe a la memoria personal de Claude.** Captura genera drafts con
aprobación atómica vía Plan mode; auditoría es read-only y nunca auto-corrige.

```mermaid
flowchart TD
    M{"Elegir modo (si no se da, preguntar)"}

    M -->|"capture"| C0{"§10 knowledge.enabled ?"}
    C0 -->|"false (sin --force)"| STOP1(["Mensaje 'deshabilitado' · parar"])
    C0 -->|"true / --force"| C1["Filtro de relevancia → recolectar evidencia<br/>→ cross-reference (budget ~30K tokens)"]
    C1 --> C3["Generar máx 3 drafts (prioridad: ADR Proposed ><br/>entrada de índice > patch conventions > bridge > test TODO)"]
    C3 --> C4{"Plan mode · aprobación ATÓMICA"}
    C4 -->|"rechaza"| LOG(["Log rejected_all (igual tiene valor)"])
    C4 -->|"aprueba"| C5(["Aplicar + commit + log<br/>(ADR siempre Proposed · entrada ai_categorized)"])

    M -->|"audit"| A0{"¿docs-index.yml existe?"}
    A0 -->|No| BRG[["→ setup-docs-bridge"]]
    A0 -->|Sí| A2["Detectar drift (read-only):<br/>orphan (HIGH) · stale · duplicate · uncovered"]
    A2 --> A4(["Health score 0-100 + last-audit.md<br/>(propone acciones · JAMÁS auto-corrige)"])
```

### 5.6 Handoff-ingest — convertir un handoff de diseño al stack

Cuatro HARD-GATE gobiernan todo: sin código de producción, extracción de tokens determinista, no
inventar reglas de marca, fidelidad acotada al stack (copia literal si coincide, paridad visual si no).

```mermaid
flowchart TD
    HR["4 HARD-GATE: sin código · tokens deterministas<br/>· no inventar marca · fidelidad acotada al stack"] --> S1["Step 1 · Mapear el handoff (inventario)"]
    S1 --> S2{"Step 2 · Modo de conversión<br/>¿stack del handoff = stack destino?"}
    S2 -->|"igual"| V["Copia literal"]
    S2 -->|"distinto"| P["Traducción por paridad visual<br/>(preserva tokens/estructura/estados/reglas)"]
    V --> S3
    P --> S3["Step 3 · Extraer tokens → design_system.md<br/>· validar WCAG AA (flag, no 'arreglar' la marca)"]
    S3 --> S4["Step 4 · fidelity-checklist.md<br/>(cada ítem cita su línea de origen)"]
    S4 --> S5{"Step 5 · Mapear pantallas → nav map → contrato"}
    S5 -.->|"pantalla sin operationId"| GAP["Log de contract gap → escalar a Fase 2"]
    S5 --> S6["Step 6 · Copiar assets (+ registrar SKILL.md de marca opcional)"]
    S6 --> S7{"Step 7 · self-review (6 ítems)"}
    S7 --> S8[["Step 8 · hand-off → build · Modo Frontend (ux-implementer)"]]
```

### 5.7 Contract-sync-audit — reconciliar backend ↔ frontend desincronizados

No auto-aplica: reporta y propone contra una **fuente canónica**, luego enruta el trabajo real.

```mermaid
flowchart TD
    S0{"Step 0 · Elegir la fuente canónica<br/>contrato existente / backend / frontend / reconciliado propuesto"}
    S0 --> S1["Step 1 · Extraer rutas del backend<br/>(OpenAPI servido, o extracción estática por framework)"]
    S1 --> S2["Step 2 · Extraer las llamadas API del frontend<br/>(método · URL · shape esperado)"]
    S2 --> S3["Step 3 · Diff → 7 categorías (cada una cita file:line):<br/>missing · URL · método · shape · orphan · auth · unresolved"]
    S3 --> S4["Step 4 · contract-sync-report.md<br/>(+ api-contract.openapi.yaml propuesto si no existía)"]
    S4 --> S5{"Step 5 · Enrutar los fixes (NO auto-aplica código)"}
    S5 -->|"endpoints faltantes / nuevas operaciones"| NF[["→ new-feature"]]
    S5 -->|"alinear un epic existente"| BLD[["→ build"]]
    S5 -->|"mismatch = bug con causa poco clara"| DBG[["→ debug"]]
```

### 5.8 Setup-docs-bridge — integrar docs preexistentes sin duplicarlos

Cuatro Iron Rules: no reorganizar, no duplicar, ADRs solo `Proposed`, nada categorizado en silencio.
Genera bridges referenciales que apuntan a los originales y un índice machine-readable.

```mermaid
flowchart TD
    IR["4 Iron Rules: no reorganizar · no duplicar<br/>· ADRs solo Proposed · nada en silencio"] --> P1["Phase 1 · Detección (carpetas con ≥10 .md)"]
    P1 --> P2{"Phase 2 · Draft de categorización (leer 30 líneas)<br/>· el usuario aprueba (a/b/c)"}
    P2 -->|"reclasificar"| P2
    P2 --> P3{"Phase 3 · Generar bridges en docs/01-/02-/03-<br/>· ROADMAP: el usuario elige la fuente (a/b/c/d)"}
    P3 --> P4{"Phase 4 · ADRs implícitos<br/>(Status: Proposed — el validator los ignora)"}
    P4 --> P5["Phase 5 · Escribir .specture/docs-index.yml<br/>(confidence: ai_categorized)"]
    P5 --> P6["Phase 6 · Actualizar conventions.md §11"]
    P6 --> P7{"Phase 7 + Verificación antes de salir (5 checks)"}
```

---

## Apéndice — Invariantes que atraviesan todos los flujos

- **Tres leyes de hierro:** cero código sin spec · cero fix sin causa raíz · cero "completado" sin verificar.
- **Contexto restringido:** cada agente recibe solo lo que necesita; nunca la conversación entera ni memoria personal.
- **Filesystem > memoria:** el router y todos los gates confían en los archivos en disco, no en el historial de chat.
- **El contrato de API es la fuente única de verdad** backend↔frontend desde v1.6.0 (operationId, no URLs inventadas).
- **ADRs nunca se borran:** se superseden (`Supersedes` / `Superseded by`); los auto-generados nacen `Proposed`.
- **Gates innegociables:** validación de arquitectura, RED commit, TDD Honesty Gate, code review, verificación, aprobación visual humana (UI).
