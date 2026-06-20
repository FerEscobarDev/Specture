# ROADMAP: [Nombre del Proyecto]

## Visión General

[Breve descripción del proyecto y su objetivo principal — máximo 2 párrafos. Esta sección es el "elevator pitch" que cualquier IA o humano lee en 30 segundos para entender de qué va el sistema.]

## Contexto Técnico

- **Configuración del stack:** [`.specture/stack.yml`](../.specture/stack.yml) *(fuente de verdad)*
- **Convenciones del proyecto:** [`.specture/conventions.md`](../.specture/conventions.md)
- **Decisiones registradas (ADRs):** [`.specture/decisions/`](../.specture/decisions/)
- **Requerimientos de negocio:** [`docs/01-requirements/business_requirements.md`](../01-requirements/business_requirements.md)
- **Arquitectura:** [`docs/02-architecture/architecture.md`](../02-architecture/architecture.md)
- **UX/UI** *(si aplica)*: [`docs/03-ux-ui/`](../03-ux-ui/)

---

## Convención de Estados

*Reglas estrictas para la IA al actualizar este archivo:*

| Símbolo | Estado | Significado |
|---------|--------|-------------|
| `[ ]` | Pendiente | El epic aún no se ha tocado. |
| `[/]` | En Progreso | Hay un spec activo o un epic-agent trabajando en él. La ejecución es secuencial: solo UN epic puede estar en `[/]` a la vez. |
| `[x]` | Completado | Todos los specs del epic han sido implementados, revisados (`code-reviewer` APPROVED), y verificados (tests pasan, lint limpio). |

---

## Hitos (Milestones) y Epics

> Los hitos están ordenados por dependencia. No empieces el Milestone N+1 si N tiene epics pendientes que el N+1 necesita.

> **Sintaxis parseable del campo `Dependencias`** (la lee el coordinador de `build` para computar la cola de ejecución en orden de dependencia). Usa **exactamente** una de estas formas, o su unión separada por comas:
> - `Ninguna` — sin dependencias.
> - `Epic X.Y` — depende de ese epic. Varios: `Epic 1.1, Epic 1.3`.
> - `Milestone N completo` — depende de **todos** los epics del Milestone N.
> Un epic está "ready" cuando su estado es `[ ]` y **todos** sus epics-dependencia están `[x]`. Evita prosa libre en este campo: cualquier otra cosa rompe el parseo determinístico.

### Milestone 1: [Nombre del Hito, ej. "Foundation"]
*Objetivo:* [Una frase que describe qué se logra al cerrar este hito.]

- [ ] **Epic 1.1:** [Nombre del Epic]
  - **Dependencias:** Ninguna
  - **Descripción:** [1-2 frases.]
  - **Reglas de negocio clave:** [Links a secciones de `business_requirements.md`]
  - **Componentes de arquitectura involucrados:** [Links a secciones de `architecture.md`]
  - **Operaciones del contrato:** [`operationId`s que este epic *implementa* (backend) o *consume* (frontend), de `api-contract.md`. Omitir si el epic no toca el boundary HTTP. Un epic de página frontend que consume una operación debe depender del epic backend que la implementa.]
  - **Specs estimados:** [N — orientativo, se concretará en Fase 4]

- [ ] **Epic 1.2:** [Nombre del Epic]
  - **Dependencias:** Epic 1.1
  - **Descripción:** ...

### Milestone 2: [Nombre del Hito]
*Objetivo:* ...

- [ ] **Epic 2.1:** ...
  - **Dependencias:** Milestone 1 completo

### Milestone N: [...]

---

## Reglas para Modificar este Archivo

1. **Solo el orquestador (`skills/build/SKILL.md`)** modifica los checkboxes durante construcción.
2. **Solo `skills/new-feature/SKILL.md`** agrega nuevos Milestones/Epics después de la planificación inicial.
3. **Al cerrar un milestone, reconcílialo y archívalo — no lo borres.** El coordinador de `build` (Step 8.7) consolida el comportamiento del milestone en `docs/05-specs/_current/<componente>.md` y, cuando el milestone deja de estar entre los ~2 cerrados más recientes, **colapsa su bloque a una lápida** (ver "Archivado a Lápida" abajo). Nunca borres la lápida ni los IDs de epic. La verdad de comportamiento vive en `_current/`; el historial completo, en git + los specs inmutables. Si una funcionalidad cambia, agrégala como **epic nuevo** (nunca edites un spec completado in-place).
4. **Cuando agregues un epic nuevo**, declara explícitamente sus dependencias contra los epics existentes.

---

## Archivado a Lápida (milestones cerrados)

Cuando el coordinador de `build` cierra un milestone (Step 8.7), lo reconcilia en `docs/05-specs/_current/` y, una vez que deja de estar entre los **~2 milestones cerrados más recientes**, **colapsa su bloque a una lápida**: conserva el heading, los IDs de epic con su `[x]`, y un puntero a los `_current/` relevantes; elimina los cuerpos verbosos de epic (Descripción, Reglas, Componentes, Operaciones, Specs).

Formato de lápida:

```
### Milestone 3: Billing  ✅ archivado <fecha> · verdad viva → docs/05-specs/_current/{billing,payments}.md
- [x] Epic 3.1, Epic 3.2, Epic 3.3   — detalle de comportamiento en el espejo de capacidad
```

**Resolución de dependencias contra lápidas** (la usa el parser de la cola de `build`): como la lápida conserva los IDs de epic,
- `Epic X.Y` o `Milestone N completo` hallado en una lápida → estado `[x]` → **satisfecho** (las lápidas son cerradas por definición).
- ID **no hallado en ningún lado** (ni activo ni lápida) → typo/desconocido → **escalar al usuario**, no asumir satisfecho.

Los ~2 milestones cerrados más recientes se mantienen **expandidos** (detalle completo). En proyectos con < 3 milestones cerrados todavía no hay lápidas.
