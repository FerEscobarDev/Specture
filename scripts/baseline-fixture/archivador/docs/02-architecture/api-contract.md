# Contrato de API — Archivador (compañero legible)

Identidad: header `X-Employee-Id` obligatorio en todas las operaciones (401 `UNAUTHENTICATED` si falta). Errores: envelope `{ error: { code, message } }`.

| operationId | Método y ruta | Request | Respuestas |
|---|---|---|---|
| `subirArchivo` | POST /archivos | `{ nombre, tipo, contenidoBase64 }` | 201 `Archivo` · 400 `VALIDATION_ERROR` · 401 |
| `listarArchivos` | GET /archivos | — | 200 `Archivo[]` (orden: `subidoEn` descendente) · 401 |
| `eliminarArchivo` | DELETE /archivos/{id} | — | 204 · 404 `ARCHIVO_NO_ENCONTRADO` |
| `asignarEtiqueta` | POST /archivos/{id}/etiquetas | `{ nombre }` | 201 `{ id, nombre }` · 400 · 404 · 409 `LIMITE_ETIQUETAS` |
| `crearNota` | POST /notas | `{ titulo, cuerpo }` | 201 `Nota` · 400 `VALIDATION_ERROR` · 409 `TITULO_DUPLICADO` |

## Trazabilidad
- HU-ARC-001 → `subirArchivo` · HU-ARC-002 → `listarArchivos` · HU-ARC-003 → `eliminarArchivo` · HU-NOT-001 → `crearNota` · HU-ETQ-001 → `asignarEtiqueta`
