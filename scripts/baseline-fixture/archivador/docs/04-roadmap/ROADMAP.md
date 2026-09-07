# ROADMAP: Archivador

## Visión General
Archivo personal de documentos y notas por empleado, con etiquetas.

## Convención de Estados
| Símbolo | Estado |
|---------|--------|
| `[ ]` | Pendiente |
| `[/]` | En Progreso (solo uno a la vez; reanudable si `_planning.md` tiene veredicto APPROVED) |
| `[x]` | Completado |

## Hitos (Milestones) y Epics

### Milestone 1: Núcleo del archivador
*Objetivo:* subir, listar, eliminar y etiquetar archivos; crear notas.

- [ ] **Epic 1.1:** Archivos
  - **Dependencias:** Ninguna
  - **Descripción:** Subida, listado y baja de archivos del empleado.
  - **Reglas de negocio clave:** RN-001, RN-002, RN-006
  - **Componentes de arquitectura involucrados:** Archivos
  - **Operaciones del contrato:** `subirArchivo`, `listarArchivos`, `eliminarArchivo`
  - **Specs estimados:** 2

- [ ] **Epic 1.2:** Notas
  - **Dependencias:** Ninguna
  - **Descripción:** Creación de notas con título único por empleado.
  - **Reglas de negocio clave:** RN-002, RN-003, RN-004
  - **Componentes de arquitectura involucrados:** Notas
  - **Operaciones del contrato:** `crearNota`
  - **Specs estimados:** 2

- [ ] **Epic 1.3:** Etiquetas
  - **Dependencias:** Epic 1.1
  - **Descripción:** Asignar etiquetas normalizadas a un archivo reutilizando el módulo `tags` existente.
  - **Reglas de negocio clave:** RN-002, RN-005
  - **Componentes de arquitectura involucrados:** Etiquetas, Archivos
  - **Operaciones del contrato:** `asignarEtiqueta`
  - **Specs estimados:** 1

### Milestone 2: Modernización del módulo tags
*Objetivo:* dejar `tags` en async/await sin cambiar su interfaz.

- [ ] **Epic 2.1:** Migración de `tags` a async/await
  - **Dependencias:** Epic 1.3
  - **Template:** MIGRATION_SPEC_TEMPLATE.md
  - **Breaking changes in scope:** GAP-001, GAP-002, GAP-003
  - **Descripción:** Migrar `archivador_api/src/tags/` de callbacks a Promises nativas preservando su interfaz.
  - **Reglas de negocio clave:** RN-005
  - **Componentes de arquitectura involucrados:** Etiquetas
  - **Specs estimados:** 1

### Milestone 3: App web
*Objetivo:* primera página de la SPA.

- [ ] **Epic 3.1:** Página "Mis archivos"
  - **Dependencias:** Epic 1.1
  - **Descripción:** Página que lista los archivos del empleado consumiendo el cliente tipado generado del contrato.
  - **Reglas de negocio clave:** RN-006
  - **Componentes de arquitectura involucrados:** App web
  - **Operaciones del contrato:** `listarArchivos` (consume)
  - **Specs estimados:** 1
