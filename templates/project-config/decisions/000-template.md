# ADR-000: [Título corto y descriptivo de la decisión]

> Plantilla de Architecture Decision Record para Specture.
> Renombra el archivo a `NNN-slug.md` (ej. `001-postgres-as-primary-db.md`) e incrementa el número por cada decisión nueva.
> Una decisión NUNCA se borra. Si se revierte, se crea un ADR nuevo con `Status: Supersedes ADR-NNN` y el ADR anterior pasa a `Status: Superseded by ADR-NNN`.

## Status

`[Proposed | Accepted | Superseded by ADR-NNN | Deprecated]`

## Context

¿Qué problema o pregunta motivó esta decisión? ¿Qué fuerzas técnicas, de negocio o de equipo están en juego? Esta sección debe ser entendible por alguien que se incorpore al proyecto en 6 meses sin contexto previo.

## Decision

¿Qué decidimos hacer? Una frase clara y verificable. Evita "deberíamos considerar" — escribe "usaremos X porque Y".

## Alternatives Considered

- **Alternativa A:** Por qué se descartó.
- **Alternativa B:** Por qué se descartó.

## Consequences

### Positivas
- [Beneficio 1]
- [Beneficio 2]

### Negativas / Trade-offs aceptados
- [Limitación 1]
- [Costo 1]

### Implicaciones operativas
- Skills/agentes afectados: [ej. el code-reviewer debe validar que no haya repositorios genéricos]
- ¿Requiere actualizar `stack.yml`? [Sí/No]
- ¿Requiere actualizar `conventions.md`? [Sí/No]

## Date

`YYYY-MM-DD`
