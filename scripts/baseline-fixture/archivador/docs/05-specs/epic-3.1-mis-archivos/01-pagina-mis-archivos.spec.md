# SPEC: Página Mis archivos — id: epic-3.1-mis-archivos/01-pagina-mis-archivos

**Epic:** Epic 3.1 Página "Mis archivos"   **Módulo:** App web (`archivador_app/`)

## Objetivo
La página `/archivos` muestra los archivos del empleado tal como los devuelve el API.

## Fuera de Scope (NO testear, NO implementar)
- Subir o eliminar desde la página.

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
- **Consume** (spec de frontend): `operationId` — `[listarArchivos]` (vía cliente tipado generado, nunca URL escrita a mano)

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
| Aspecto | Detalle |
|---------|---------|
| Entradas | `X-Employee-Id` del cliente tipado |
| Salidas (éxito) | tabla con nombre, tipo, tamaño, fecha; estado vacío "Todavía no subiste archivos" |
| Salidas (error) | 401 → redirección a login |
| Efectos secundarios | ninguno |
| Idempotencia | sí |

## Reglas de Negocio
- **BR-1:** solo los archivos del empleado — fuente: `RN-006` de business_requirements.md

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Con dos archivos, la tabla muestra dos filas en el orden del API.
- **AC-2:** Sin archivos, muestra el estado vacío.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** 401 → redirección.

## Superficie de Código Existente (para el implementer — lo llena el spec-planner)
- Crea: `ArchivosPage` en `archivador_app/src/pages/archivos-page.tsx` — firma: `ArchivosPage(): JSX.Element`
- Llama a: `listarArchivos` en `archivador_app/src/api/client.ts` — firma: `listarArchivos(): Promise<Archivo[]>`
