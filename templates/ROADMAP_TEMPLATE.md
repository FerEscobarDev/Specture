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
| `[/]` | En Progreso | Hay un spec activo o un epic-agent trabajando en él. En modo **Inline** y **Agentes por Epic secuencial**, solo UN epic puede estar en `[/]` a la vez. En modo **Agentes por Epic en Paralelo (Olas)**, varios epics pueden estar en `[/]` simultáneamente — uno por cada epic-agent activo de la ola. |
| `[x]` | Completado | Todos los specs del epic han sido implementados, revisados (`code-reviewer` APPROVED), y verificados (tests pasan, lint limpio). En modo paralelo, además, el epic pasó el **gate de integración** (merge + suite completa sobre el árbol integrado). |

---

## Hitos (Milestones) y Epics

> Los hitos están ordenados por dependencia. No empieces el Milestone N+1 si N tiene epics pendientes que el N+1 necesita.

> **Sintaxis parseable del campo `Dependencias`** (la lee el coordinador de `build` para computar el "ready set", crítico en modo paralelo). Usa **exactamente** una de estas formas, o su unión separada por comas:
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
3. **NUNCA borres un epic ya completado.** Si una funcionalidad cambia, márcala con un nuevo epic que la sustituya y deja el anterior como `[x]` con una nota de superseded.
4. **Cuando agregues un epic nuevo**, declara explícitamente sus dependencias contra los epics existentes.
