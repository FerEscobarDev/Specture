# Contrato de API: [Nombre del Proyecto]

> **Fuente de verdad machine-readable:** `docs/02-architecture/api-contract.openapi.yaml`.
> Este documento es la versión legible del mismo contrato. **Si discrepan, gana el `.openapi.yaml`.**
>
> Este contrato es la **única fuente de verdad de la interfaz backend↔frontend**. Tanto los specs de backend (que *implementan* operaciones) como el mapa de navegación y los specs de frontend (que *consumen* operaciones) referencian las operaciones por su `operationId`. Nadie reinventa URLs, métodos ni shapes fuera de aquí.

## 1. Convenciones globales

- **Base URL:** [ej. `/api/v1`]
- **Versionado:** [ej. prefijo de path `/v1` | header | ninguno]
- **Esquema de autenticación:** [ej. Bearer JWT en header `Authorization` | cookie de sesión | token único en path]
- **Formato de fecha/hora:** [ej. ISO-8601 UTC]
- **Envelope de error estándar:** [describir el shape único de error, ej. `{ code: string, message: string, details?: object }`]
- **Códigos de estado usados:** [ej. 200, 201, 400, 401, 403, 404, 409, 422, 500]
- **Paginación:** [ej. `?page=&size=` → `{ items: [], total, page, size }`]
- **Filtros / búsqueda:** [convención común, ej. `?search=&estado=`]

## 2. Esquemas compartidos (DTOs)

> Los shapes reutilizados por varias operaciones. Cada uno corresponde a un `components/schemas/<Nombre>` en el OpenAPI. Identificadores en el idioma de `conventions.md` §8.

### `[NombreDTO]`
| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `[campo]` | `[string\|number\|boolean\|<DTO>\|<DTO>[]]` | sí/no | [restricción / enum / formato] |

*(repetir por DTO)*

## 3. Operaciones

> Una fila por operación. El `operationId` es el identificador estable que citan specs, nav map y el cliente tipado. **El `operationId` nunca cambia una vez consumido por un epic** (cambiarlo es un breaking change que requiere ADR).

| operationId | Método | Path | Auth / Rol | Request | Response éxito | Response error | Idempotente | Epic(s) |
|-------------|--------|------|------------|---------|----------------|----------------|-------------|---------|
| `[obtenerDisponibilidad]` | GET | `/psicologos/{slug}/disponibilidad` | Público | query: `desde`, `hasta` | `200` → `Disponibilidad[]` | `404` slug inexistente | sí | [Epic X.Y back] / [Epic Z.W front] |
| `[crearCita]` | POST | `/citas` | Público | body: `SolicitudCita` | `201` → `Cita` | `409` bloque ocupado · `422` datos inválidos | no | ... |

### Detalle por operación (solo las que necesitan más que la fila)

#### `[operationId]`
- **Propósito:** [una frase de negocio].
- **Request shape:** [referencia a DTO de §2, o inline].
- **Response éxito:** [status + DTO].
- **Errores de negocio:** [condición → status + `code` del envelope].
- **Efectos secundarios:** [persistencia / eventos / correos].
- **Notas de consumo frontend:** [paginación, polling, optimistic update, etc.].

*(repetir solo cuando aplique)*

## 4. Trazabilidad

> Cada operación debe trazar **hacia arriba** a la capacidad de frontera (`HU-...` de `business_requirements.md` §Capacidades de Frontera) que la origina, **y hacia abajo** a quién la implementa y la consume. Reglas:
> - **Cobertura bidireccional:** toda capacidad de frontera (`UI` o `API-externa`) tiene ≥1 operación; toda operación traza a una capacidad. Una operación sin capacidad de origen es sobre-diseño; una capacidad sin operación es un hueco de cobertura.
> - **Implementación:** toda operación la implementa exactamente un epic de backend.
> - **Consumo:** lo consume al menos una pantalla del `navigation_map.md` (si la capacidad es `UI`) o un consumidor externo declarado (si es `API-externa`).

| operationId | Capacidad / HU origen | Exposición | Implementa (epic back) | Consume (pantalla / consumidor) | Estado |
|-------------|----------------------|------------|------------------------|---------------------------------|--------|
| `[obtenerDisponibilidad]` | HU-AGENDA-003 | UI | Epic 5.1 | `/agenda/[slug]`, `/cita/[token]` | ☐ |
| `[obtenerDisponibilidadIntegracion]` | HU-INTEG-002 | API-externa | Epic 5.1 | Integrador externo (sistema de agendas) | ☐ |

## 5. Reglas de evolución del contrato

- **Aditivo es seguro:** agregar una operación nueva o un campo opcional no rompe consumidores.
- **Breaking changes requieren ADR:** renombrar/eliminar un `operationId`, cambiar un método/path, quitar un campo, o cambiar el tipo de un campo existente. Registrar en `.specture/decisions/` y notificar a los epics afectados (impacto en back y front simultáneo).
- **El cliente tipado del frontend se regenera desde el `.openapi.yaml`** tras cualquier cambio — nunca se editan URLs a mano.

---

*Mantener sincronizado con `api-contract.openapi.yaml`. Prosa de negocio en español; identificadores y nombres de operación en el idioma de `conventions.md` §8.*
