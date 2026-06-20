> **Estado: DISEÑO — no implementado aún.** Documento de diseño de la Fase 2 del
> plan maestro (reconciliación: verdad viva + ROADMAP-como-cola). Objetivo de
> release: **v1.9.0**. Las decisiones aquí están cerradas (forks A/C/D resueltos
> con el usuario el 2026-06-19); la implementación ocurre en una fase posterior
> siguiendo la disciplina `write-skill` (baseline → cambio → verify).

# Plan de diseño: Reconciliación — verdad viva del comportamiento + ROADMAP-como-cola

## Context

Specture no tiene **ninguna fuente de verdad viva del comportamiento**. Confirmado por exploración:
- El **contrato de API** es append-only (breaking changes vía ADR), no se reconcilia.
- Los **specs** son artefactos **inmutables** (`new-feature`: "specs are immutable artifacts").
- Lo único "vivo" es el ROADMAP (checkboxes) y los ADRs/docs-index (por supersesión).

Consecuencia 1 (**spec rot**): para saber "qué hace hoy el módulo X" hay que replayear specs históricos + impact-analyses dispersos en `docs/05-specs/<epic>/`. No hay vista consolidada del presente.

Consecuencia 2 (**ROADMAP como libro mayor**): `ROADMAP_TEMPLATE.md` regla 3 ("NUNCA borres un epic completado") lo hace crecer sin techo (epics completados + superseded + notas).

**Insight unificador:** son el mismo problema. Completar un milestone debe ser una **transferencia**: drenar de la *intención* (ROADMAP) → reconciliar en la *realidad* (una verdad viva por componente). Un evento, dos efectos. Y la lógica de "epics en orden de dependencia" ya existe (cola de ejecución de la Fase 1) — esto la reusa del otro lado.

## Decisiones cerradas

| # | Decisión | Elección |
|---|----------|----------|
| Cuándo/quién | reconciliación | **Por milestone, por el coordinador** (carga los specs del hito transitoriamente) |
| **A** | clave de `_current/<X>.md` | **Componente de arquitectura** (de `architecture.md` High-Level Components) |
| **C** | inyección a agentes de build | **Sí**, vía el patrón "Docs Index Resolution" (los agentes no leen el índice) |
| **D** | agresividad del archivado | **Colapso diferido sin toggle**: reconcilia siempre; colapsa a lápida los milestones que dejan de estar entre los ~2 cerrados más recientes |
| Método | reconciliación | **Incremental** (merge de los specs del milestone + el `_current/` previo); rebuild total del componente solo si el coordinador detecta ambigüedad de supersesión |

## 1. El artefacto `docs/05-specs/_current/<component-slug>.md`

Un archivo por **componente de arquitectura**. Vista materializada *sobre* los specs inmutables — **no los reemplaza**, los consolida en presente. **No se edita a mano**; lo regenera el coordinador. Nuevo template: `templates/CURRENT_CAPABILITY_TEMPLATE.md`.

`component-slug` = slug estable del componente declarado en `architecture.md` (los epics ya lo citan en "Componentes de arquitectura involucrados").

### Esquema (espeja las secciones de comportamiento de SPEC_TEMPLATE, consolidadas)

```markdown
# Estado actual — <Componente>

> Verdad viva del comportamiento de este componente. Vista materializada sobre los
> specs (inmutables) que lo construyeron. La regenera el coordinador al cerrar cada
> milestone que toca este componente. NO editar a mano.
>
> Specs de origen: docs/05-specs/<epic-a>/<task>.spec.md, docs/05-specs/<epic-b>/...
> Última reconciliación: Milestone N — <fecha>

## Reglas de negocio vigentes
- **BR — <enunciado>** · origen: `<epic/task>` · business_requirements §X

## Comportamiento observable vigente
- **AC — <comportamiento observable>** · origen: `<epic/task>`

## Edge cases manejados
- **EC — <caso> → <resultado>** · origen: `<epic/task>`

## Operaciones del contrato implementadas
- `operationId` — <una frase> (shape en `api-contract.md`)

## Contrato de comportamiento (consolidado)
| Aspecto | Detalle |
|---------|---------|
| Entradas / Salidas / Errores / Efectos / Idempotencia | (consolidado por operación o por el componente) |

## Historial / supersesiones
- "<regla vieja>" (origen `<epic/task>`) → superseded por "<regla nueva>" (`<epic/task>`) en Milestone N
```

**IDs y supersesión:** los IDs `BR-1/AC-1/EC-1` son **por-spec** (no globales). En `_current/` cada ítem lleva su **origen** (`<epic/task>`) en vez de re-numerar. Cuando un spec posterior cambia un comportamiento vigente (mismo `operationId` o mismo sujeto de regla), el ítem viejo **baja a "Historial / supersesiones"** y entra el nuevo en la sección vigente — así la traza nunca se pierde pero las secciones vigentes solo muestran el presente.

## 2. El evento de reconciliación (nuevo paso en `build/SKILL.md`)

Lo corre el **coordinador** (no el epic-agent), tras procesar el reporte de un epic. Se ubica entre el Step 8.5 (learn, opt-in) y el Step 9 (context hygiene):

### Step 8.7 — Milestone Reconciliation (solo cuando se cierra un milestone)

1. **Detectar cierre de milestone:** tras marcar el epic `[x]`, ¿quedan todos los epics de su milestone en `[x]`? Si no, saltar este step.
2. **Componentes tocados:** unión de "Componentes de arquitectura involucrados" de los epics del milestone.
3. **Reconciliar (incremental):** por cada componente tocado, el coordinador lee el `_current/<component>.md` actual (si existe) + los specs del milestone que tocan ese componente, y produce el `_current/` actualizado (mergeando vigentes, bajando superseded a Historial, refrescando "Specs de origen" y "Última reconciliación"). Si el solapamiento es ambiguo, hace **rebuild total** de ese componente (relee todos los specs listados en "Specs de origen" + los nuevos).
4. **Colapso diferido del ROADMAP:** tras reconciliar, colapsar a lápida cualquier milestone cerrado que ya **no** esté entre los ~2 milestones cerrados más recientes (umbral fijo, sin toggle).
5. **Commit:** `docs: reconcile <componentes> + archive milestone N`.

> Costo de contexto: el coordinador sube transitoriamente los specs del milestone + los `_current/` de los componentes tocados. Es por-milestone (poco frecuente) y acotado al componente — aceptado en la decisión Q2.

## 3. Archivado del ROADMAP — lápida + colapso diferido

**Mantener expandidos** los milestones pendientes/activos + los ~2 cerrados más recientes. **Colapsar** los cerrados más viejos a una lápida:

```markdown
### Milestone 3: Billing  ✅ archivado 2026-05 · verdad viva → docs/05-specs/_current/{billing,payments}.md
- [x] Epic 3.1, Epic 3.2, Epic 3.3   — detalle de comportamiento en el espejo de capacidad
```

La lápida **conserva**: el heading del milestone, los **IDs de epic** y su estado `[x]`, y el puntero a los `_current/` relevantes. **Elimina**: los cuerpos verbosos de epic (Descripción, Reglas, Componentes, Operaciones, Specs estimados) — ese detalle vive ahora en `_current/` + en los specs inmutables + git.

### Resolución de dependencias contra epics archivados (sin índice extra)

El parser de la cola (Fase 1) resuelve `Epic X.Y` / `Milestone N completo` escaneando el ROADMAP. Como la lápida **conserva los IDs**:
- ID hallado en una lápida → estado `[x]` (las lápidas son cerradas por definición) → **satisfecho**.
- `Milestone N completo` con N en lápida → **satisfecho**.
- ID **no hallado en ningún lado** (ni activo ni lápida) → typo/desconocido → **escalar al usuario** (no pasar en silencio).

No se requiere un índice de IDs archivados: la lápida ES el índice.

## 4. Reescritura de la regla 3 de `ROADMAP_TEMPLATE.md` (cambio de doctrina)

De: *"NUNCA borres un epic ya completado…"*
A:

> **Al cerrar un milestone**, el coordinador lo **reconcilia** en `docs/05-specs/_current/<componente>.md` y lo **colapsa a lápida** una vez que deja de estar entre los ~2 milestones cerrados más recientes. **Nunca borres la lápida ni los IDs de epic** — las dependencias los resuelven. La **verdad de comportamiento** vive en `_current/`; el **historial completo**, en git + los specs inmutables de `docs/05-specs/<epic>/`.

## 5. Inyección a los agentes de build — "Current-State Resolution" (decisión C)

Nueva sección reusable en `build/SKILL.md`, gemela de "Docs Index Resolution":

- Cuando el spec actual toca un componente (de su ref de Módulo / los componentes del epic), el **orquestador resuelve** el `_current/<component>.md` correspondiente y lo inyecta como contexto adicional al **architecture-validator** (Step 3) y al **code-reviewer** (Step 6).
- **Los agentes NUNCA leen el directorio `_current/` por su cuenta** — el orquestador resuelve y entrega (misma doctrina que docs-index: caché, determinismo, contexto restringido).
- Beneficio: el validator/reviewer ven el **comportamiento vigente** del componente → atrapan regresiones y conflictos con lo ya construido. Costo: 1-2 archivos `_current/` por dispatch (acotado).

## 6. `new-feature` — Impact Ripple sobre la verdad viva

El Impact Ripple Analysis (`skills/new-feature/SKILL.md` Step 2) hoy relee `docs/05-specs/` (todos los specs históricos). **Cambia a leer `docs/05-specs/_current/`**: la verdad viva por componente dice exactamente qué comportamiento existe hoy → contra qué hace ripple la feature nueva. Más limpio, actual y acotado. Se puede bajar al spec inmutable (linkeado en "Specs de origen") cuando se necesite historia profunda.

## 7. Notas de integración y bordes

- **`_current/` es verdad trackeada**, NO se gitignorea (a diferencia de `.specture/state/`). Se commitea con cada reconciliación.
- **Creación:** lazy — el directorio `_current/` y cada archivo nacen en la primera reconciliación que toca el componente. `setup` no necesita pre-crearlos.
- **`architecture/SKILL.md`:** los slugs de componente de "High-Level Components" son la clave de `_current/`; conviene que sean estables (como los `operationId`). Nota menor a agregar ahí.
- **Adopt (proyecto existente):** sin specs Specture, `_current/` arranca vacío y se llena al construir. Una caracterización one-shot del comportamiento existente hacia `_current/` queda **diferida** (enhancement futuro, no v1.9.0).
- **Relación con la Fase 3 (registro de reglas):** ortogonal. `_current/` = comportamiento (qué hace el sistema); reglas = invariantes (cómo debe escribirse). No se mezclan.

## 8. Alcance de implementación (para la fase de build futura)

- **NUEVO** `templates/CURRENT_CAPABILITY_TEMPLATE.md` — esquema de `_current/<component>.md`.
- `skills/build/SKILL.md` — Step 8.7 (Milestone Reconciliation) + sección "Current-State Resolution" + engancharla en los dispatches de Step 3 y Step 6.
- `templates/ROADMAP_TEMPLATE.md` — reescritura de regla 3 + formato de lápida + nota de resolución de dependencias archivadas.
- `skills/new-feature/SKILL.md` — Impact Ripple lee `_current/`.
- `skills/architecture/SKILL.md` — nota de slugs de componente estables (menor).
- `README.md` — nueva entrada de changelog **v1.9.0** (no reescribir historia) + bump de `plugin.json`.

## 9. Verificación

1. Disciplina `write-skill` por skill tocada (baseline → cambio → verify).
2. Proyecto de prueba con ≥3 milestones:
   - Cerrar M1 → `_current/<componentes de M1>` generado; M1 aún expandido (entre los ~2 recientes).
   - Cerrar M2, M3 → al cerrar M3, **M1 colapsa a lápida**; M2/M3 expandidos.
   - Una dependencia de M3 → epic de M1 (lápida) **resuelve como satisfecha**.
   - Un epic con `operationId` cuyo comportamiento cambia un BR vigente → el BR viejo baja a "Historial" en `_current/`.
   - Dispatch de code-reviewer en un epic que toca un componente con `_current/` previo → el reviewer recibe el slice y puede citar comportamiento vigente.
3. Grep sweep: ninguna skill operativa lee `_current/` directamente salvo el orquestador (preservación de contexto restringido).
