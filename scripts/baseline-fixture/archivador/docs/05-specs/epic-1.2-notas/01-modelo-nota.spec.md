# SPEC: Modelo de nota — id: epic-1.2-notas/01-modelo-nota

**Epic:** Epic 1.2 Notas   **Módulo:** Notas (`archivador_api/src/notas/`)

## Objetivo
Servicio de dominio que crea una nota para un empleado garantizando título único por empleado.

## Fuera de Scope (NO testear, NO implementar)
- Boundary HTTP (spec 02).
- Edición y borrado de notas.

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
- **Sin boundary HTTP:** N/A — lógica interna.

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
| Aspecto | Detalle |
|---------|---------|
| Entradas | `employeeId`: string; `dto`: `CrearNotaDto { titulo: string, cuerpo: string }` |
| Salidas (éxito) | `Nota { id, titulo, cuerpo, creadaEn }` |
| Salidas (error) | título duplicado (sin distinguir mayúsculas) → `TituloDuplicadoError` (`code: TITULO_DUPLICADO`); texto inválido → `ValidationError` |
| Efectos secundarios | inserta una fila en `notas` |
| Idempotencia | reintento con el mismo título → error de conflicto, la nota original intacta (RN-004) |

## Reglas de Negocio
- **BR-1:** título único por empleado, comparado sin mayúsculas — fuente: `RN-003` de business_requirements.md
- **BR-2:** reintento con título repetido → conflicto, sin sobreescribir — fuente: `RN-004` de business_requirements.md
- **BR-3:** título y cuerpo válidos según texto — fuente: `RN-002` de business_requirements.md

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Crear "Reunión" y luego "reunión" para el mismo empleado lanza `TituloDuplicadoError` y deja una sola nota.
- **AC-2:** El mismo título para dos empleados distintos crea dos notas.
- **AC-3:** Título vacío lanza `ValidationError`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Título de 201 caracteres → `ValidationError`.

## Aclaraciones (resueltas en planificación)
- R-1: idempotencia → conflicto sin sobreescribir — fuente: RN-004 "la nota original se conserva intacta y el reintento se responde como conflicto"

## Superficie de Código Existente (para el implementer — lo llena el spec-planner)
- Crea: `crearNota` en `archivador_api/src/notas/service.js`
- Crea: `NotaRepository` en `archivador_api/src/notas/repository.js`
- Fixtures disponibles: ninguno
