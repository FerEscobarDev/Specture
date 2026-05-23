# Análisis y rediseño del flujo de diseño de UI en Specture

> **Estado:** propuesta de diseño · **Fecha:** 2026-05-23 · **Autor:** análisis experto a partir de la experiencia de uso en proyectos reales (caso de referencia: Psikora).
>
> Este documento (1) diagnostica el flujo actual de UI/UX, (2) identifica la falla raíz, y (3) define un plan de implementación en tres niveles. El alcance aprobado es **Niveles 1 + 2 + 3** con **OpenAPI + doc legible** como contrato de API.

---

## 1. Resumen ejecutivo

El flujo de UI de Specture es sólido en **planeación de información** (navigation map, specs para IA) pero tiene **una falla raíz y un vacío estructural**:

- **Falla raíz — no hay contrato de API compartido.** El frontend "inventa" los endpoints que espera (en `navigation_map.md`) y el backend "inventa" los que construye (en sus specs). Nada los reconcilia. Esto produce el bug observado: el front espera URLs y formatos que el back nunca entrega.
- **Vacío estructural — el flujo de `build` está modelado para backend.** El loop `spec → TDD RED → GREEN → review` certifica lógica determinista, no calidad de UI. No hay agente de frontend, ni gate de aprobación visual, ni paso de "design system primero". Resultado: al generar el código del front "no hay orden".

Todo lo reportado por el usuario se deriva de estas dos causas. La mayoría de las mejoras son altamente factibles; hay límites honestos en "convertir un handoff al pie de la letra" entre tecnologías distintas y en "detectar automáticamente" desajustes en backends sin tipado.

---

## 2. Qué funciona hoy

| Funciona | Por qué es correcto |
|---|---|
| `navigation_map.md` rico (rutas, auth por rol, elementos, HU, flujos críticos) | Es la arquitectura de información que consume el resto del flujo. |
| Ruta 1 → `design_specs_for_ai.md` para delegar a una IA de diseño | Aprovecha que una IA especializada en diseño visual supera al generalista. |
| `HARD-GATE`: nada de código en Fase 03 | Separar "qué ve el usuario" de "cómo se implementa" es disciplina correcta. |
| El handoff de Claude Design es un paquete auto-describible | README design-system + tokens CSS + previews + prototipo JSX + `SKILL.md`. Insumo de alta calidad que hoy se desperdicia. |

---

## 3. Diagnóstico raíz

### 3.1 El contrato de API es el problema #1

Cadena actual:
1. `architecture.md` describe comunicación a nivel **componente** (Origen→Destino, sync/async), no a nivel **endpoint**.
2. `navigation_map.md` lista "APIs que consume" — pero son **deseos del front** escritos por el diseñador UX leyendo arquitectura (ej. `GET /psicologos/{slug}/disponibilidad`).
3. En `build`, cada spec de backend tiene su propio "Contrato" aislado e **inventa su propia URL y shape**.

**No existe un documento único que ambos lados estén obligados a cumplir.** Una IA no recuerda entre sesiones ni entre epics; solo cumple el contrato que tiene enfrente. Dos contratos divergentes ⇒ dos verdades. La cura es **un contrato único, machine-readable, generado una vez y consumido por ambos tracks**, y **verificable** (no solo prosa).

### 3.2 El loop de `build` está modelado para backend

TDD RED→GREEN es ideal para lógica determinista. Para UI, "los tests pasan" ≠ "se ve y se siente bien". Faltan: agente de front, dimensión de review visual/a11y/tokens, y gate de aprobación humana. Por eso el generalista improvisa.

### 3.3 Asimetría de rutas innecesaria

Ruta 1 produce `design_specs_for_ai.md` *sin* design system; Ruta 2 produce `design_system.md` *sin* specs. En ambas rutas el render lo hace una IA (externa o Claude Code). El **design system es el artefacto universal**; lo único que varía es *quién lo renderiza* y *si se ingiere un handoff*.

---

## 4. Evaluación punto por punto

| # | Solicitud | Factible | Cómo / Caveat |
|---|---|---|---|
| 1 | Mismos documentos en ambas rutas; siempre design system completo (salvo Adopt con UI) | Sí | `design_system.md` obligatorio siempre; `design_specs_for_ai.md` se vuelve envoltorio de Ruta 1 que **incluye el mandato de crear el design system**. Excepción: Adopt con UI existente. |
| 2 | UI/UX en toda la fase, del diseño a la implementación | Sí | Extender `build` con sub-flujo de frontend. Hoy la UX "muere" al cerrar Fase 03. |
| 3 | Coordinar UI con backend (endpoints y formatos garantizados) | Sí — mayor impacto | **Contrato OpenAPI único** + contract-tests + cliente tipado generado. |
| 4 | Agente especializado UI/UX | Sí | Nuevo `ux-implementer` + dimensión de review front. El `implementer` genérico es backend-shaped. |
| 5 | Skills/flujos para implementar el frontend | Sí | Nuevo modo de `build` para frontend: tokens→componentes→showcase→páginas. |
| 6 | Página dev con design system, aprobada antes de seguir | Sí — clave | Ruta `/dev/design-system` + **gate de aprobación humana** (Claude screenshot vía Playwright; aprueba el usuario). |
| 7 | El documento para IA debe especificar crear el design system | Sí | Cae de #1: el template de specs-para-IA incluye sección obligatoria de design system. |
| 8 | Optimizar para el handoff; validar el de Psikora; herramientas de conversión | Sí, con límite | Skill `handoff-ingest`: extracción **determinista** de tokens + traducción **asistida** de componentes + checklist de fidelidad. "Al pie de la letra" solo si stack destino == stack del handoff; si difiere ⇒ *paridad visual*, no copia de código. |
| 9 | Escaneo evaluativo de sync back/front en proyectos existentes | Sí, con caveat | Skill `contract-sync-audit`: extrae rutas back + llamadas front, diffea, reporta. Robusto con stacks tipados u OpenAPI; heurístico en backends dinámicos. |

---

## 5. Límites honestos (lo que NO se puede, o solo parcialmente)

- **No hay conversión 100% automática y pixel-perfect de un handoff entre frameworks distintos.** JSX→Angular es traducción semántica con criterio; requiere gate visual humano.
- **"Copiar al pie de la letra"** solo es literal si el stack destino coincide con el del handoff (React/Next). Si difiere, lo honesto es prometer *paridad visual y de tokens*.
- **El scanner no detecta de forma fiable desajustes de *shape* en backends dinámicos sin tipos.** Pleno con TS/OpenAPI/contract-tests; heurístico en Python/JS sin tipado.
- **TDD no certifica calidad visual.** El gate correcto es aprobación humana, no "tests verdes".
- **El scanner no debe "arreglar" solo.** Reporta y propone; quién es canónico (front o back) es decisión humana — y a partir de ahí manda el contrato.

---

## 6. Plan de implementación (alcance aprobado: Niveles 1 + 2 + 3)

### Nivel 1 — Contrato de API como cimiento (resuelve #3)

**Objetivo:** una fuente única de verdad para la interfaz back↔front, machine-readable y verificable.

1. **Nueva fase / extensión de `architecture`:** tras aprobar `architecture.md`, generar
   - `docs/02-architecture/api-contract.openapi.yaml` — fuente de verdad (OpenAPI 3.1).
   - `docs/02-architecture/api-contract.md` — versión legible (tabla de operaciones: `operationId`, método, path, request, response éxito/error, auth, idempotencia).
2. **Plantilla nueva:** `templates/API_CONTRACT_TEMPLATE.md` + `templates/api-contract.openapi.template.yaml`.
3. **`navigation_map.md` deja de inventar endpoints:** su sección "APIs que consume" referencia `operationId` del contrato (no URLs sueltas). Actualizar `ux-design/SKILL.md` y `DESIGN_SYSTEM_TEMPLATE.md` §5.
4. **`SPEC_TEMPLATE.md`:** los specs de backend declaran "implemento `operationId: X`"; los specs de frontend declaran "consumo `operationId: X`". El contrato es referencia obligatoria, no se redefine en el spec.
5. **Gate de contrato (verificable):**
   - Backend: contract-test que valida que la respuesta real cumple el schema del contrato.
   - Frontend: **cliente tipado generado desde el OpenAPI** (imposible divergir en URL/método).
6. **`architecture-validator`:** nueva regla — todo endpoint citado en `navigation_map` o en un spec debe existir en el contrato; todo `operationId` del contrato debe trazar a algún epic.

### Nivel 2 — Disciplina de frontend (resuelve #1, #2, #4, #5, #6, #7)

1. **Unificar Fase 03 (`ux-design/SKILL.md`):**
   - Salida siempre = `navigation_map.md` + `design_system.md`.
   - Ruta 1 añade `design_specs_for_ai.md`, que **incluye el mandato explícito de entregar un design system** con la lista de componentes reutilizables.
   - Excepción única: `setup` Adopt con UI ya definida (documentar la detección).
2. **Sub-flujo de frontend en `build/SKILL.md`** (nuevo "Modo: Frontend" o pasos dedicados), orden forzado por dependencias:
   1. Tokens como código (de `design_system.md` o del handoff).
   2. Librería de componentes base.
   3. Ruta `/dev/design-system` (showcase, solo dev).
   4. **Gate de aprobación humana** (Claude screenshot con Playwright → el usuario aprueba). No se construyen páginas sin aprobación.
   5. Páginas, en orden de dependencia del **contrato de API**.
3. **Nuevo agente `agents/ux-implementer/AGENT.md`:** consume tokens + contrato + (opcional) handoff; respeta reglas de marca, a11y y cliente tipado. Restringido a contexto de front.
4. **Dimensión de review de frontend:** extender `agents/code-reviewer/AGENT.md` (o nuevo `ux-reviewer`) con: fidelidad visual, adherencia a tokens, a11y (WCAG AA), y adherencia al contrato de API.
5. **ROADMAP:** la fase de arquitectura inserta los epics de frontend en el orden correcto (design system → showcase → páginas por dependencia de contrato).

### Nivel 3 — Herramientas (resuelve #8, #9)

1. **Skill `handoff-ingest` (`skills/handoff-ingest/SKILL.md`):**
   - Detecta la estructura del handoff (README design-system, tokens CSS, prototipos JSX/HTML, navigation_map, `SKILL.md`).
   - **Extracción determinista** de `colors_and_type.css` → tokens en el formato del stack destino.
   - Convierte las **reglas de marca** del README (ej. "sin emoji", "iconos stroke 1.8", "badges con alpha") en un **checklist de fidelidad** verificable.
   - Trata los `.jsx`/`.html` como **objetivo de paridad visual**, no como código a copiar — salvo que el stack destino sea idéntico (entonces copia + cablea datos).
   - Registra el `SKILL.md` del handoff como skill de proyecto para que el agente "se vuelva experto en la marca".
   - Caso de validación de referencia: `C:\Proyectos\Psikora\spec\Psikora-handoff`.
2. **Skill `contract-sync-audit` (`skills/contract-sync-audit/SKILL.md`):**
   - Extrae rutas del backend (parseo por framework o vía OpenAPI expuesto).
   - Extrae llamadas del frontend (fetch/axios/httpClient: base URL + path + shape esperado desde tipos TS).
   - Diffea: mismatches de URL, método, y shape de respuesta.
   - Emite reporte de reconciliación señalando qué lado se declara **canónico** (el contrato) y propone cambios; **no aplica fixes automáticos**.

---

## 7. Workstream de documentación (qué cambia para el usuario del framework)

Toda la implementación anterior cambia la experiencia del usuario de Specture; estos docs deben actualizarse/crearse en el mismo entregable:

- **`CLAUDE.md` (raíz) y tabla de "Quick command reference":** añadir entradas para `handoff-ingest` y `contract-sync-audit`.
- **`skills/start/SKILL.md` (router):** enrutar a la nueva fase de contrato de API, al sub-flujo de frontend, y a las dos skills nuevas según estado del proyecto.
- **`skills/ux-design/SKILL.md`:** reescribir Step 2/3 con la unificación de rutas y el mandato de design system.
- **`skills/architecture/SKILL.md`:** documentar la generación del contrato de API tras `architecture.md`.
- **`skills/build/SKILL.md`:** documentar el sub-flujo de frontend y el gate de aprobación visual.
- **`skills/setup/SKILL.md`:** documentar la excepción "Adopt con UI definida".
- **Nuevos READMEs de skill** para `handoff-ingest` y `contract-sync-audit`, y `AGENT.md` para `ux-implementer`.
- **CHANGELOG / bump de versión** del framework reflejando el rediseño del flujo de UI.
- **Guía de usuario** ("cómo entrego un handoff de Claude Design y lo convierto a mi stack" y "cómo audito un proyecto existente con desajuste back/front").

---

## 8. Secuencia recomendada

Empezar por **Nivel 1 (contrato)** porque desbloquea todo lo demás y ataca el peor problema (desajuste back/front). Luego **Nivel 2 (disciplina de frontend)**, que depende del contrato para ordenar las páginas. Finalmente **Nivel 3 (herramientas)**, que se apoya en los artefactos de los niveles previos (`handoff-ingest` alimenta el design system; `contract-sync-audit` usa el contrato como pivote).

---

## 9. Addendum — ¿De dónde nacen los endpoints? (refuerzo de planificación)

Pregunta surgida tras la implementación: en proyectos **sin UI** o **nuevos desde cero**, ¿cómo se define qué endpoints se necesitan, y debería definirse desde la planificación inicial?

**Principio:** los endpoints se **derivan**, no se declaran en config ni se inventan en build. Bajan por una cadena donde cada fase responde una pregunta distinta:

| Fase | Pregunta | Sobre la interfaz |
|------|----------|-------------------|
| Setup | ¿Con qué tecnología/forma? | `api.style` (la forma del contrato, NO los endpoints — setup es agnóstico al dominio y corre antes de discovery) |
| Discovery | ¿Qué debe poder hacer cada actor? | **Capacidades de frontera** (la *necesidad* nace aquí, en lenguaje de negocio, sin HTTP) |
| Architecture | ¿Qué operaciones las realizan y con qué shape? | El **contrato** (el endpoint concreto nace aquí: path/método/shape dependen del modelo de datos y auth) |
| Build | ¿Cómo se implementa/consume? | Código + cliente tipado |

**Insight clave:** el contrato se deriva de las **capacidades**, no de las pantallas. Las pantallas son una *vista* sobre las capacidades. Por eso el orden *architecture→contrato→UX* es sólido: no necesitas las pantallas para definir el contrato; necesitas las capacidades completas. Un dato que una pantalla pide y el contrato no expone = una **capacidad faltante en discovery**, no un endpoint mal adivinado.

**Refuerzo implementado** (cierra el eslabón que estaba implícito):
- `discover` captura **actores no-humanos** (consumidores externos) y marca la **Exposición** de cada historia (`UI` / `API-externa` / `Interna`), consolidando una sección **Capacidades de Frontera** en `business_requirements.md`.
- `architecture` Parte B **deriva el contrato de esa lista** y valida **cobertura bidireccional**: toda capacidad de frontera → ≥1 operación; toda operación → una capacidad/HU. La plantilla del contrato gana columnas de traza (HU origen + exposición).
- `architecture-validator` Dimensión 6 hace cumplir la cobertura bidireccional.

Resultado: **qué endpoints se necesitan queda determinado desde la Fase 1 (como capacidades de frontera), con o sin UI**, y formalizado en Fase 2 (como contrato), de forma auditable.
