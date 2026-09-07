# SPEC: Listar archivos — id: epic-1.1-archivos/02-listar-archivos

**Epic:** Epic 1.1 Archivos   **Módulo:** Archivos (`archivador_api/src/archivos/`)

## Objetivo
Un empleado ve la lista de sus propios archivos, del más reciente al más antiguo.

## Fuera de Scope (NO testear, NO implementar)
- Subir archivos (spec 01).
- Eliminar archivos.
- Paginación.

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
- **Implementa** (spec de backend): `operationId` — `[listarArchivos]`

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
| Aspecto | Detalle |
|---------|---------|
| Entradas | header `X-Employee-Id` (obligatorio) |
| Salidas (éxito) | 200 `Archivo[]` ordenado por `subidoEn` descendente; `[]` si no hay archivos |
| Salidas (error) | sin header → 401 `UNAUTHENTICATED` |
| Efectos secundarios | ninguno |
| Idempotencia | sí (lectura) |

## Reglas de Negocio
- **BR-1:** Solo se listan los archivos del empleado del header — fuente: `RN-006` de business_requirements.md

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Con dos archivos propios y uno ajeno, devuelve solo los dos propios.
- **AC-2:** Los archivos vienen ordenados por `subidoEn` descendente.
- **AC-3:** Sin archivos devuelve `[]` con 200.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** Sin `X-Employee-Id` → 401 `UNAUTHENTICATED`.

## Aclaraciones (resueltas en planificación)
- R-1: orden del listado → `subidoEn` descendente — fuente: api-contract.md "orden: `subidoEn` descendente"

## Superficie de Código Existente (para el implementer — lo llena el spec-planner)
- Llama a: `ArchivoRepository` en `archivador_api/src/archivos/repository.js` — firma: `class ArchivoRepository { constructor(db); insert(row): Promise<Archivo>; listByEmployee(employeeId): Promise<Archivo[]> }` `(planeada — re-anclar)`
- Crea: `listarArchivos` en `archivador_api/src/archivos/service.js`
- Fixtures disponibles: ninguno
