# SPEC: [Nombre] — id: <epic-slug>/<task-slug>

**Epic:** [ref ROADMAP]   **Módulo:** [ref architecture.md]

## Objetivo
[2-3 líneas, lenguaje de negocio — español]

## Fuera de Scope (NO testear, NO implementar)
- [Lo que explícitamente NO entra en este spec]

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
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
- Llama a: `<símbolo existente>` en `<path>` — firma: `[...]`
- Crea: `<símbolo nuevo>` en `<path>`
- Fixtures disponibles: `<path>` (no duplicar)

---
*Prohibido código de implementación. Solo contratos, reglas e IDs estables.
Prosa de negocio en español; identificadores y firmas en el idioma de conventions.md §8.*
