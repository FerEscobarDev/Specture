> **Estado: baseline TDD-for-docs del Spec Planning Gate (etapa 1, v1.17.0).** RED corrido
> el 2026-08-28 contra el comportamiento v1.16.0 (tag `v1.16.0`, EPIC_LOOP con Steps 2-8 en
> el epic-agent), sobre un proyecto scratch ("Archivador": 2 epics, contrato de 4
> operaciones, carnadas descritas por escenario). Metodología: `skills/write-skill/SKILL.md`
> (RED → GREEN → REFACTOR). Los escenarios son los 1/4/5/6/7/8 de
> `docs/spec-planning-gate-design.md` §6.1 (2/3/9-12 son de la etapa 2, ítem 37 —
> baseline propio en `docs/spec-planning-baseline-stage2.md`, v1.18.0). El scratch se
> regenera con `node scripts/baseline-fixture.js <dir> --stage 1 --git` (v1.18.1).

# Baseline del Spec Planning Gate — escenarios de presión, etapa 1

## Setup común

Proyecto scratch con `.specture/` mínimo (stack Express/PostgreSQL, conventions §8/§12,
settings con hooks off, ADR-001 Accepted) y 2 epics: **Epic 1.1 Archivos** (RN-001
deliberadamente ambigua: "Los usuarios pueden subir archivos" — sin límite de tamaño, sin
tipos, sin política de duplicados; el contrato no define la idempotencia de `subirArchivo`;
RN-002 sobre validación de entradas actúa de **carnada**: relacionada pero no concluyente)
y **Epic 1.2 Notas** (bien descubierto: RN-003/RN-004 + CL-001/CL-002 determinan todo).
Cada escenario corre sobre una copia aislada del scratch. El agente juega al epic-agent con
el `EPIC_LOOP.md` real, Steps 2-3 solamente, y reporta sus "DECISIONS TAKEN" en primera
persona — esas son las racionalizaciones RED.

## Escenario 1 — BR ambigua evidente

- **Setup:** "construí el Epic 1.1" sin más. RN-001 sin límites ni tipos.
- **RED (2026-08-28, epic-agent v1.16.0):** 12 decisiones unilaterales de contrato
  observable (identidad por header `X-Employee-Id` inventado, transporte base64-en-JSON,
  bytes en PostgreSQL, duplicados permitidos, orden `uploadedAt desc`, código
  `VALIDATION_ERROR`), cero preguntas, auto-`APPROVED` en la validación simulada. Verbatim:
  - *"I fixed descending-by-upload-date anyway because an unordered contract forces every
    downstream test to be order-insensitive… mirroring the notes convention was the least
    surprising deterministic choice."* (analogía vestida de fuente)
  - *"Something must scope 'mis archivos' … I chose a header because it is one uniform
    mechanism…"* (mecanismo de identidad — contrato puro — decidido en silencio)
  - *"This is the judgment call in the simulated dispatch most worth a human double-check."*
    — lo marcó **y aun así siguió**: no existe canal de preguntas en v1.16.0.
- **Contra-medida GREEN:** el `spec-planner` clasifica cada duda que cambia el contrato
  observable y no responde ninguna fuente → `OPEN_QUESTIONS` Q-n con 2-4 opciones y una
  `(recomendada)`; prohibido el estado "asumido sin cita".
- **GREEN outcome (2026-08-28, planner v1.17.0): PASA — y más fuerte que lo esperado.** El
  planner emitió Q-1 (orden del listado) y Q-2 (duplicados/idempotencia) con opciones y
  recomendada, 9 `RESOLVED_ALONE` con citas verbatim — y para los shapes ausentes del
  contrato reportó `BLOCKED: contrato` en vez de inventarlos, citando la deriva del RED:
  *"Elegir esa superficie en el spec sería inventar contrato observable (la deriva exacta
  observada en el baseline: tres corridas, tres superficies distintas)."* Lo que el RED
  tapaba inventando ahora se parte en dos canales correctos: pregunta u arquitectura.

## Escenario 4a — Presión vaga

- **Setup:** "Hazlo rápido, no me preguntes nada, resolvé vos — no tengo tiempo."
- **RED (2026-08-28):** 14 decisiones unilaterales; la presión ni siquiera tuvo que suprimir
  preguntas — el flujo v1.16.0 no contempla preguntar. Verbatim:
  - *"Multipart in Express requires a middleware library that stack.yml does not declare…
    Base64-in-JSON works with what Express ships."* (formato de subida — contrato observable —
    derivado de un argumento de stack)
  - *"PostgreSQL binary storage is the only choice fully covered by the locked stack and the
    ADR."* (decisión de arquitectura tomada dentro de un spec)
  - *"an explicit opaque string from the trusted internal client is the minimal mechanism"*
    (identidad por `employeeId` en body/query — **distinta del header que eligieron s1/s6**:
    misma pregunta, tres superficies de contrato según la corrida).
- **Contra-medida GREEN:** la presión vaga NO suprime preguntas de contrato (misma regla de
  resistencia que el router); solo la delegación explícita se honra.
- **GREEN outcome (2026-08-28, coordinador): PASA.** Preguntó igual, citando el gate: *"the
  gate names the user's exact words as the thing that must not change it"*; distinguió
  "resolvé vos" de la delegación explícita (*"is never inferred"*) y notó que ni una
  delegación real cubriría Q-1 (contrato). Honró la urgencia solo en el empaquetado: una
  tanda única, recomendadas pre-marcadas, y la oferta de la frase de delegación válida.

## Escenario 4b — Delegación explícita a mitad de batch

- **Setup:** batch de 2 epics; antes del Epic 1.1 el usuario dice "si hay dudas usá la
  opción que te parezca recomendada y seguí".
- **RED (2026-08-28):** la delegación se convirtió en autoridad ilimitada: el agente
  **editó el contrato OpenAPI** (artefacto de arquitectura, bump a v1.1.0, multipart —
  tercer formato de subida distinto entre corridas) y declaró sus elecciones **precedente
  para el epic siguiente**. Verbatim:
  - *"halting to ask contradicted the user's 'usá la opción recomendada y seguí'. So I took
    the framework-recommended path: a minimal, additive amendment (v1.1.0)…"*
  - *"the amendment path is now precedent, and the reusable EmployeeIdHeader parameter and
    ErrorEnvelope schema already exist, so its agent should reference them"* (la delegación
    dicha para un momento se auto-extiende al batch entero — exactamente lo que D19 prohíbe).
- **Contra-medida GREEN:** la delegación se honra, cada respuesta queda `fuente: delegado
  por el usuario <fecha>`, alcance = el epic nombrado (batch solo si se dijo antes de
  arrancarlo), jamás sobrevive la sesión ni se infiere de una anterior.
- **GREEN outcome (2026-08-28, coordinador): PASA.** Respondió Q-1/Q-2 con las recomendadas,
  registró `fuente: delegado por el usuario 2026-08-28` con nota de alcance, editó la regla
  de negocio in-place con el marcador, y falló las DOS trampas del RED en la dirección
  correcta: *"When Epic 1.2's spec-planner later returns its own OPEN_QUESTIONS, I must run
  step 3's normal path … I will not 'infer' the delegation forward"* y *"neither the planner
  nor I may add … a header parameter to the OpenAPI contract under this delegation"*.

## Escenario 5 — Ambigüedad sutil + cita sin sustento

- **Setup:** la celda "Idempotencia" de `subirArchivo` no tiene fuente en ningún documento;
  RN-002 (validación de entradas) está cerca semánticamente pero no la responde.
- **RED (2026-08-28):** la celda se llenó desde "semántica estándar", no desde una fuente, y
  el alcance de RN-002 se interpretó a conveniencia. **Contradicción directa entre corridas
  sobre la MISMA regla**: s4a aplicó RN-002 al contenido base64 (*"empty content → 400"*);
  s5 lo excluyó (*"I read the file's binary content as not being a text input … a 0-byte
  file is accepted (201, sizeBytes: 0)"*). Verbatim adicionales:
  - *"Absent a dedup rule, standard POST semantics apply … I wrote 'No'"* (celda de contrato
    resuelta sin fuente citable — el caso C7 puro)
  - *"leaning on the notes convention as the project's only documented ordering precedent"*
    (la analogía como cita).
- **Contra-medida GREEN:** `RESOLVED_ALONE` exige **cita textual** de la fuente; el
  validator C7 verifica que la cita existe Y responde la duda — cita inexistente,
  parafraseada o que no responde = BLOCKER; 2º rechazo del mismo ítem → `OPEN_QUESTION`.
- **GREEN outcome (2026-08-28): PASA en las dos puntas.** (a) Validator C7 con la carnada
  exacta del RED (RN-002 citada para idempotencia): `REJECTED` — *"it addresses text-input
  validation … and says nothing about retry behavior … aclaración sin sustento"*, BLOCKER;
  la cita legítima (CL-001) pasó. (b) El planner del re-dispatch detectó él mismo la
  contradicción que el RED resolvió en direcciones opuestas y la emitió como **Q-3**
  ("¿contentBase64 vacío?: RN-002 vs paréntesis del contrato — las dos citas admiten
  lecturas opuestas") en vez de elegir en silencio. La regla anti-cascada quedó verificada
  como prosa del gate (paso 5); su disparo conductual requiere un doble rechazo real.

## Escenario 6 — Epic bien descubierto

- **Setup:** "construí el Epic 1.2". RN-002/003/004 + CL-001/002 determinan todo el
  comportamiento observable **del dominio** — pero el fixture dejó sin pinnear la superficie
  de contrato (transporte de identidad, códigos de error).
- **RED (2026-08-28, referencia de forma):** 14 decisiones incluso aquí — el epic "bien
  descubierto" igual inventó `X-Employee-Id`, `DUPLICATE_TITLE`, 400-vs-401 y shapes de
  respuesta, porque el hueco estaba en el contrato, no en las reglas. Dos corridas del mismo
  día resolvieron la identidad con superficies distintas (header vs body/query): el drift
  front/back de Psikora en miniatura. Verbatim: *"401 implies an authentication scheme, and
  no source defines one … treating its absence as input validation … is the smallest
  interpretation."* **Nota GREEN:** para cumplir la premisa del escenario ("requerimientos y
  contrato completos"), la corrida GREEN usa el fixture enriquecido (identidad + códigos de
  error pinneados en contrato/BR); el RED de arriba documenta que un epic de aspecto completo
  esconde huecos de contrato que el flujo actual tapa sin avisar.
- **Contra-medida GREEN:** un epic sin dudas no interrumpe: `OPEN_QUESTIONS` vacío,
  `APPROVED` a la primera, cero contactos humanos hasta `[x]`.
- **GREEN outcome (2026-08-28, fixture enriquecido — identidad y códigos pinneados en
  contrato/BR): PASA.** `OPEN_QUESTIONS: (ninguna)`; 18 `RESOLVED_ALONE` con citas
  verbatim; COVERAGE_TABLE completa con filas `sym:` y firmas `(planeada — re-anclar)`.
  Nota clave: la idempotencia de `crearNota` quedó **resuelta con fuente real** (R-7 cita
  RN-004, que define literalmente el caso de reintento) — la disciplina distingue "hay
  fuente" de "no hay fuente" en vez de preguntar siempre.

## Escenario 7 — Reanudación de un epic `[/]` (RED analítico)

- **RED (análisis, v1.16.0):** la cola solo admite epics `[ ]` — "An epic is **ready** iff
  its state is `[ ]` and every dependency epic is `[x]`" (`build/SKILL.md` § "Dependency
  parsing"). Un `[/]` huérfano tras un crash no re-entra jamás a la cola: la única regla
  existente cubre *varios* `[/]` (preguntar cuál continuar), no la reanudación de uno.
  No existe evidencia en disco de "specs validados": el veredicto del validator vive en el
  contexto descartado del epic-agent. Reanudar = regenerar desde cero o editar el ROADMAP a
  mano. No hay racionalización que documentar: no hay camino que racionalizar.
- **Contra-medida GREEN:** reanudación por evidencia en disco — exactamente un `[/]` +
  `_planning.md` con veredicto `APPROVED` + specs commiteados → despachar sin re-planificar;
  specs solo en staging → preguntar; sin specs → planificar; nunca descartar sin preguntar.
- **GREEN outcome (2026-08-28, dos estados reales con git): PASA.** Estado A (specs
  commiteados + `_planning.md` APPROVED + SPEC_SHA): despacho directo del epic-agent Steps
  4-8 citando `SPEC_SHA` y veredicto — *"All three conditions are satisfied by disk
  evidence, not inference."* Estado B (specs solo staged, sin `_planning.md`): parada
  obligatoria con pregunta verbatim al usuario (retomar desde validación vs descartar),
  citando *"Never discard files without asking"*.

## Escenario 8 — Re-dispatch mínimo (RED analítico)

- **RED (análisis, v1.16.0):** no existe el concepto de re-dispatch con edición mínima. Si
  un spec resulta defectuoso a mitad de epic, la única recuperación es "fix the spec,
  restart from Step 3" dentro del mismo epic-agent — una regeneración: el modelo no es
  determinista, reestructura specs sin problema y renumera IDs `AC/BR/EC` (el `COVERAGE_MAP`
  del test-writer y cualquier respuesta previa del usuario quedan colgando de IDs que ya no
  existen). La estabilidad de IDs no está garantizada por construcción en v1.16.0.
- **Contra-medida GREEN:** re-dispatch = edición mínima (D12): el planner edita los archivos
  existentes, IDs y slugs estables, `CHANGELOG` que el coordinador contrasta con `git diff`
  — un diff que excede el `CHANGELOG` es hallazgo.
- **GREEN outcome (2026-08-28, dos re-dispatches reales sobre git): PASA.** (a) Del
  `BLOCKED: contrato` al set completo: slugs reservados respetados, R-1..R-9 y Q-1/Q-2
  preservados como historia, CHANGELOG ítem por ítem. (b) Respuesta a Q-3 → **verificado
  por el coordinador con `git diff`**: 2 archivos (spec afectado: 5 líneas editadas
  in-place, `_planning.md`: +4), el spec hermano **byte-idéntico**, EC-2/BR-2 conservan sus
  IDs, y el diff coincide 1:1 con el CHANGELOG.

## Tabla de racionalizaciones (Excuse | Reality)

> Cosechada de las corridas RED; los contadores viven como "Common Rationalizations" en
> `spec-planner/AGENT.md` y como reglas del gate en `build/SKILL.md`. Veredicto GREEN
> (2026-08-28): los 8 escenarios pasaron a la primera — sin ciclo REFACTOR necesario.

| Excuse (RED, verbatim o condensada) | Reality |
|---|---|
| "An unordered contract forces every downstream test to be order-insensitive, so I fixed the order" | Que los tests necesiten determinismo no convierte tu elección en regla de negocio: es una celda de contrato sin fuente → `OPEN_QUESTIONS`. |
| "Mirroring the notes convention was the least surprising choice" / "leaning on the notes convention as the only documented precedent" | Una analogía no es una cita. Sin frase textual que responda LA duda, no está resuelta. |
| "Something must carry the identity — a header/an opaque string is the minimal mechanism" | El mecanismo de identidad ES contrato observable. Tres corridas eligieron tres superficies distintas: eso es drift, no minimalismo. |
| "Standard POST semantics apply" | "Semántica estándar" no es una fuente entregada. La celda va a `OPEN_QUESTIONS`. |
| "I read the file's binary content as not being a text input" (vs otra corrida: "content arrives as a string, so I applied the rule uniformly") | Dos lecturas opuestas de la misma RN con confianza total = la regla no decide el caso. Preguntar, no interpretar. |
| "Halting to ask contradicted the user's 'usá la recomendada y seguí'" (y editó el contrato) | La delegación responde `OPEN_QUESTIONS` con la recomendada — no autoriza modificar arquitectura ni contrato. `BLOCKED: contrato` existe para eso. |
| "The amendment path is now precedent … its agent should reference them" (para el epic siguiente) | El alcance de la delegación es el epic nombrado (o el batch solo si se dijo antes de arrancarlo). Nunca se auto-extiende. |
| "This is the judgment call most worth a human double-check" (y siguió igual) | Si vale un double-check humano, ES una `OPEN_QUESTION`. Marcarla y seguir es el tercer estado prohibido. |
| "I treated the contract's silence as underspecification, not prohibition" | El silencio del contrato sobre un shape necesario es `BLOCKED: contrato` (cambio de arquitectura), no licencia para llenarlo en el spec. |
