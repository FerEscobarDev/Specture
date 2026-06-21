# SPEC: [Nombre] — id: <epic-slug>/<task-slug>

**Epic:** [ref ROADMAP]   **Módulo:** [ref architecture.md]

## Objetivo
[2-3 líneas, lenguaje de negocio — español]

## Fuera de Scope (NO testear, NO implementar)
- [Lo que explícitamente NO entra en este spec]

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
> Referencia las operaciones por `operationId` de `docs/02-architecture/api-contract.md`. NO redefinas el shape aquí: el contrato es la fuente de verdad. Si necesitas un shape que no existe en el contrato, primero agrégalo al contrato (es un cambio de arquitectura), no lo inventes en el spec.
- **Implementa** (spec de backend): `operationId` — `[obtenerDisponibilidad, crearCita]`
- **Consume** (spec de frontend): `operationId` — `[obtenerDisponibilidad]` (vía cliente tipado generado, nunca URL escrita a mano)
- **Sin boundary HTTP:** escribir "N/A — lógica interna".

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
> Para specs que tocan el API, esta tabla **resume** lo que ya define el contrato (no lo contradice). Para lógica interna sin boundary, es la definición completa.

| Aspecto | Detalle |
|---------|---------|
| Entradas | `nombre`: tipo (restricción) |
| Salidas (éxito) | shape + código/estado |
| Salidas (error) | condición → código/tipo de error |
| Efectos secundarios | persistencia / eventos emitidos |
| Idempotencia | sí/no + comportamiento en reintento |

## Reglas de Negocio
- **BR-1:** [regla] — fuente: business_requirements.md §X
- **BR-2:** ...

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** [comportamiento observable y verificable]
- **AC-2:** ...

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** [caso] → [resultado esperado]

## Superficie de Código Existente (para el implementer — lo llena el orquestador en Step 2)
> Los `<path>` de archivos nuevos se anclan a la **carpeta raíz del componente** del epic (campo "Carpeta raíz" en `architecture.md`, respaldado por `stack.yml.structure`). Si es "n/a" (`root_layout` flat/custom o componente no desplegable), usar el layout del proyecto.
- Llama a: `<símbolo existente>` en `<path>` — firma: `[...]`
- Crea: `<símbolo nuevo>` en `<path>`
- Fixtures disponibles: `<path>` (no duplicar)

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
