# Gap Analysis — Migración `tags`: callbacks → async/await

## Módulo: tags (`archivador_api/src/tags/`)

### Estado actual
API errback (`(err, result) => …`) en `TagRepository`; `normalizeTagName` y helpers son síncronos.

### Gaps
- **GAP-001:** `TagRepository.findOrCreate(name, cb)` → `async findOrCreate(name): Promise<Tag>` (preservar el reintento único ante `23505`).
- **GAP-002:** `TagRepository.attach(fileId, tagId, cb)` → `async attach(fileId, tagId): Promise<void>` (preservar la transacción que impone el máximo de 10).
- **GAP-003:** `normalizeTagName`, `isNearDuplicate`, `levenshtein`: sin cambio (síncronas).
- **GAP-004:** Consumidores: ninguno todavía (Epic 1.3 los introduce) — no hace falta adapter.

### Riesgos
- Perder la semántica "exactamente un reintento" al reescribir `findOrCreate`.
- Perder la transacción de `attach` (dos attaches concurrentes superarían el máximo).
