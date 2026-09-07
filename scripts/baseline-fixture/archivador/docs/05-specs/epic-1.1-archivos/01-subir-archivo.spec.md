# SPEC: Subir archivo — id: epic-1.1-archivos/01-subir-archivo

**Epic:** Epic 1.1 Archivos   **Módulo:** Archivos (`archivador_api/src/archivos/`)

## Objetivo
Un empleado sube un archivo (PDF/PNG/JPEG de hasta 10 MB) y queda guardado en su archivador con sus metadatos.

## Fuera de Scope (NO testear, NO implementar)
- Listar archivos (spec 02).
- Eliminar archivos.
- Etiquetas (Epic 1.3).

## Operaciones del Contrato de API (si el spec toca un boundary HTTP)
- **Implementa** (spec de backend): `operationId` — `[subirArchivo]`

## Contrato (machine-readable — identificadores en el idioma de conventions.md §8)
| Aspecto | Detalle |
|---------|---------|
| Entradas | header `X-Employee-Id` (obligatorio); body `nombre`: string (RN-002), `tipo`: string (uno de `application/pdf`, `image/png`, `image/jpeg`), `contenidoBase64`: string (≤ 10 MB decodificado) |
| Salidas (éxito) | 201 `Archivo` `{ id, nombre, tipo, tamanoBytes, subidoEn }` |
| Salidas (error) | tipo o tamaño inválidos → 400 `VALIDATION_ERROR`; sin header → 401 `UNAUTHENTICATED` |
| Efectos secundarios | inserta una fila en `archivos` (bytea, ADR-001) |
| Idempotencia | no: cada llamada crea un archivo nuevo aunque el nombre se repita |

## Reglas de Negocio
- **BR-1:** Máximo 10 MB y tipo permitido — fuente: `RN-001` de business_requirements.md
- **BR-2:** `nombre` sin espacios sobrantes, no vacío, ≤ 200 caracteres — fuente: `RN-002` de business_requirements.md

## Criterios de Aceptación (≥1 test por ID)
- **AC-1:** Un PDF de 1 MB con nombre válido devuelve 201 con `tamanoBytes` igual al tamaño decodificado.
- **AC-2:** Un archivo `text/plain` devuelve 400 `VALIDATION_ERROR`.
- **AC-3:** Un archivo de 10 MB + 1 byte devuelve 400 `VALIDATION_ERROR`.
- **AC-4:** Sin `X-Employee-Id` devuelve 401 `UNAUTHENTICATED`.

## Edge Cases (los que cambian comportamiento — NO exhaustivo)
- **EC-1:** `contenidoBase64` que no es base64 válido → 400 `VALIDATION_ERROR`.

## Aclaraciones (resueltas en planificación)
- R-1: idempotencia de `subirArchivo` → no idempotente — fuente: RN-001 "cualquier otro caso se rechaza" (solo valida; nada prohíbe duplicados)

## Superficie de Código Existente (para el implementer — lo llena el spec-planner)
- Crea: `subirArchivo` en `archivador_api/src/archivos/service.js`
- Crea: `ArchivoRepository` en `archivador_api/src/archivos/repository.js`
- Crea: `archivosRouter` en `archivador_api/src/archivos/router.js`
- Fixtures disponibles: ninguno
