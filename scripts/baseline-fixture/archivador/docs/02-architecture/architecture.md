# Arquitectura — Archivador

## Visión
Monolito modular Express + PostgreSQL (`archivador_api/`) y SPA React (`archivador_app/`). Un módulo por feature bajo `archivador_api/src/<feature>/`.

## Componentes

### Archivos
- **Responsabilidad:** subida, listado y baja de archivos por empleado (RN-001, RN-006).
- **Carpeta raíz:** `archivador_api/`
- **Ubicación:** `archivador_api/src/archivos/`
- **Persistencia:** tabla `archivos` (bytea, ADR-001).

### Notas
- **Responsabilidad:** notas de texto por empleado (RN-002, RN-003, RN-004).
- **Carpeta raíz:** `archivador_api/`
- **Ubicación:** `archivador_api/src/notas/`

### Etiquetas
- **Responsabilidad:** normalización y asignación de etiquetas a archivos (RN-005).
- **Carpeta raíz:** `archivador_api/`
- **Ubicación:** `archivador_api/src/tags/` (código existente, en callbacks — ver `docs/migration/gap_analysis.md`).

### App web
- **Responsabilidad:** SPA que consume el contrato a través del cliente tipado generado.
- **Carpeta raíz:** `archivador_app/`

## Identidad
Todo request lleva `X-Employee-Id` (conventions §12 R-1). No hay autenticación adicional en este alcance.

## Errores
Envelope único `{ error: { code, message } }` (conventions §12 R-2). Códigos: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `ARCHIVO_NO_ENCONTRADO` (404), `TITULO_DUPLICADO` (409), `LIMITE_ETIQUETAS` (409).
