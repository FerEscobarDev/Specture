# Arquitectura: [Nombre del Proyecto]

> Este documento describe la arquitectura técnica del proyecto. La fuente de verdad del **stack** vive en `.vibecoding/stack.yml`; este documento explica cómo se organiza el código sobre ese stack.

## 1. Stack de Referencia

> Refleja el contenido de `.vibecoding/stack.yml`. Si discrepan, `stack.yml` gana.

- **Backend:** [`backend.language` + `backend.framework` + `backend.runtime`]
- **Base de Datos:** [`database.primary`] con [`database.orm_or_driver`]
- **Frontend:** [`frontend.framework` + `frontend.ui_library`] *(o "no aplica")*
- **Patrón Arquitectónico:** [`architecture.pattern`]
- **Estrategia de Módulos:** [`architecture.module_strategy`]
- **Convenciones detalladas:** ver `.vibecoding/conventions.md`
- **Decisiones registradas (ADRs):** ver `.vibecoding/decisions/`

## 2. Componentes de Alto Nivel

> Listado de los grandes bloques del sistema y su responsabilidad. NO listes archivos — listas componentes lógicos.

### 2.1 [Nombre del Componente / Módulo]
- **Responsabilidad:** [Qué hace, en una frase.]
- **Entradas:** [De qué otros componentes / actores recibe llamadas o eventos.]
- **Salidas:** [A qué otros componentes / actores emite llamadas o eventos.]
- **Datos que posee:** [Tablas / colecciones / agregados que son su responsabilidad exclusiva.]
- **Dependencias permitidas:** [Lista de otros componentes a los que puede llamar.]

### 2.2 [Otro Componente]
*(repetir)*

## 3. Patrones de Comunicación

| Origen | Destino | Mecanismo | Síncrono/Asíncrono | Notas |
|--------|---------|-----------|--------------------|-------|
| [Componente A] | [Componente B] | [HTTP / función / evento de dominio] | [sync/async] | [Reglas de retry, idempotencia, etc.] |

## 4. Modelo de Datos Inicial

> Diagrama Mermaid o lista textual. NUNCA pegar SQL/DDL aquí — eso vive en migraciones.

```mermaid
erDiagram
    [Entidad1] ||--o{ [Entidad2] : "[verbo de relación]"
    [Entidad1] {
        [tipo] [campo_clave]
        [tipo] [campo]
    }
```

### Entidades principales

- **[Entidad 1]** — propósito, campos clave, relaciones.
- **[Entidad 2]** — propósito, campos clave, relaciones.

## 5. Cross-Cutting Concerns

### 5.1 Autenticación y Autorización
- **Estrategia:** [JWT / sesión / OAuth / etc.]
- **Roles definidos:** [lista]
- **Componente responsable:** [Componente X]

### 5.2 Logging y Observabilidad
- **Niveles usados:** [debug/info/warn/error]
- **Qué se loggea siempre:** [boundary errors, integraciones externas, decisiones de seguridad]
- **Qué NO se loggea:** [datos sensibles — listar]

### 5.3 Manejo de Errores
- **Estrategia primaria:** [ver `conventions.md`]
- **Errores recuperables vs no recuperables:** [criterio]
- **Códigos de error de negocio:** [enumeración o link]

### 5.4 Validación
- **Capa donde ocurre:** [boundary / domain / both]
- **Librerías permitidas:** [ver `stack.yml` o `conventions.md`]

## 6. Boundaries y Restricciones

> Reglas que la implementación DEBE respetar. Estas se traducen en checks que el `architecture-validator` verificará.

- [ ] La capa de presentación nunca accede directamente a la base de datos.
- [ ] Los componentes solo se comunican siguiendo la matriz de §3.
- [ ] [Otra regla]

## 7. Decisiones Pendientes / Open Questions

> Anota lo que NO se ha decidido. Cada item debe convertirse en una pregunta al usuario o en un ADR antes de empezar a construir.

- [ ] [Pregunta abierta 1]
- [ ] [Pregunta abierta 2]

---

*Este documento debe ser actualizado al cierre de cada Milestone si la arquitectura evolucionó. Cualquier cambio significativo debe quedar registrado en un ADR en `.vibecoding/decisions/`.*
