# Requerimientos de Negocio — [Nombre del Proyecto]

> Producido por la Fase 1 (`discover`). Lenguaje de negocio, sin tecnología.
> **IDs estables:** toda regla (`RN-nnn`), caso límite (`CL-nnn`) y exclusión (`FA-nnn`)
> lleva un ID secuencial de 3 dígitos. Se admite un prefijo de dominio (`RN-SEG-007`).
> Los IDs nunca se renumeran ni se reutilizan: specs, ROADMAP y `_current/` citan por ID.
> **Fusión de features:** las adiciones posteriores (fase `new-feature`) se fusionan en su
> sección con el marcador `(añadido por feature <slug>, <fecha>)` — prohibidas las "Adendas"
> apendizadas al final; los `RN/CL/FA` nuevos continúan la numeración existente.

## Propósito
[Qué problema resuelve, para quién, por qué ahora. 2-4 frases.]

## Actores
> Humanos y no-humanos; marca cuáles son consumidores externos.
- **[Actor]** — [rol, objetivos, restricciones]
- **[Sistema externo / integrador]** — [qué consume] *(consumidor externo)*

## Historias de Usuario
> Cada una con ID estable, actor y **Exposición** (`UI` / `API-externa` / `Interna`).
> Una capacidad puede ser `UI` **y** `API-externa` a la vez.
- **HU-[DOMINIO]-001:** [Como actor quiero…] · Actor: [actor] · Exposición: `UI`
- **HU-[DOMINIO]-002:** [...] · Actor: [actor] · Exposición: `Interna`

## Capacidades de Frontera
> Consolida, como lista, las historias marcadas `UI` o `API-externa` con su consumidor.
> Es el input directo de la Fase 2 para el contrato de API: cada ítem debe convertirse en
> ≥1 operación del contrato. Si el proyecto no tiene ningún boundary (librería, CLI puro),
> escribir "Ninguna" y decirlo explícitamente.
- **HU-[DOMINIO]-001** — consumidor: [actor] — [capacidad en una frase]

## Reglas de Negocio
> Invariantes que el sistema debe garantizar. Una regla por bullet, con ID.
- **RN-001:** [regla verificable, ej. "un usuario no puede tener dos suscripciones activas"]
- **RN-002:** [...]

## Casos Límite
> Qué pasa cuando las cosas salen mal. Uno por bullet, con ID.
- **CL-001:** [caso] → [comportamiento esperado]
- **CL-002:** [...]

## Restricciones No Funcionales (de Negocio)
> Privacidad, regulación, multi-tenancy, idiomas, zonas horarias. NO performance técnica.
- [restricción]

## Fuera de Alcance
> Qué explícitamente NO está en este proyecto. Uno por bullet, con ID.
- **FA-001:** [exclusión explícita]

## Glosario
- **[Término]** — [definición en lenguaje del dominio]
