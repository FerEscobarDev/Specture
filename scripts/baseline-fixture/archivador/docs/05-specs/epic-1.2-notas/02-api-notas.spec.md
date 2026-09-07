# SPEC: API de notas — id: epic-1.2-notas/02-api-notas

**Epic:** Epic 1.2 Notas   **Módulo:** Notas (`archivador_api/src/notas/`)

## Objetivo
Exponer `crearNota` por HTTP traduciendo los errores de dominio al envelope del contrato.

## Fuera de Scope (NO testear, NO implementar)
- La lógica de unicidad (spec 01).

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
- **Implementa** (spec de backend): `operationId` — `[crearNota]`

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
| Aspecto | Detalle |
|---------|---------|
| Entradas | header `X-Employee-Id`; body `{ titulo, cuerpo }` |
| Salidas (éxito) | 201 `Nota` |
| Salidas (error) | `ValidationError` → 400 `VALIDATION_ERROR`; `TituloDuplicadoError` → 409 `TITULO_DUPLICADO`; sin header → 401 `UNAUTHENTICATED` |
| Efectos secundarios | los del servicio |
| Idempotencia | reintento → 409 (RN-004) |

## Reglas de Negocio
- **BR-1:** título repetido → 409 — fuente: `RN-004` de business_requirements.md
- **BR-2:** validación de texto → 400 — fuente: `RN-002` de business_requirements.md

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** POST /notas válido devuelve 201 con la `Nota`.
- **AC-2:** Título repetido devuelve 409 `TITULO_DUPLICADO`.
- **AC-3:** Título vacío devuelve 400 `VALIDATION_ERROR` (CL-001).

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Sin `X-Employee-Id` → 401.

## Aclaraciones (resueltas en planificación)
- R-1: código de conflicto → 409 `TITULO_DUPLICADO` — fuente: api-contract.md "409 `TITULO_DUPLICADO`"

## Superficie de Código Existente (para el implementer — lo llena el spec-planner)
- Crea (spec hermano anterior): `crearNota` — firma: `crearNota(employeeId: string, titulo: string, cuerpo: string): Promise<Nota>` `(planeada — re-anclar)`
- Crea: `notasRouter` en `archivador_api/src/notas/router.js`
- Fixtures disponibles: ninguno
