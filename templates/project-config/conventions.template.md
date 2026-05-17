# Convenciones del Proyecto

> Este archivo describe las convenciones específicas que el equipo (humano + IA) debe seguir en este proyecto. Es leído por todos los skills y agentes de Specture antes de generar código, specs o reviews. Cuando una convención aquí entra en conflicto con una regla genérica del framework, **gana esta convención**.

## 1. Naming

- **Variables y funciones:** [ej. camelCase | snake_case]
- **Clases / tipos:** [ej. PascalCase]
- **Constantes globales:** [ej. UPPER_SNAKE_CASE]
- **Archivos:** [ej. kebab-case.ts | PascalCase.cs | snake_case.py]
- **Tests:** [ej. `*.test.ts` | `*_test.go` | `test_*.py`]
- **Carpetas:** [ej. kebab-case | snake_case]

## 2. Organización de Archivos

- **Estructura por:** [feature | layer | módulo de dominio]
- **Co-localización:** [tests junto al código | tests en carpeta separada]
- **Tamaño máximo de archivo (líneas):** [ej. 300]
- **Ejemplos de jerarquía esperada:**
  ```
  [Pegar aquí un árbol de carpetas representativo del proyecto]
  ```

## 3. Patrones Permitidos (Allow-list)

- [ej. Repository pattern para acceso a datos]
- [ej. Dependency Injection vía constructor]
- [ej. Pure functions en la capa de dominio]
- [ej. Result type para errores recuperables]

## 4. Patrones Prohibidos (Deny-list)

> Estas son cosas que **explícitamente no queremos** en este proyecto, aunque el lenguaje las permita o sean comunes en otros proyectos.

- [ej. Repositorios genéricos `Repository<T>`]
- [ej. Singletons mutables]
- [ej. Excepciones para flujo de control]
- [ej. Lógica de negocio en controllers]
- [ej. Acceso directo a la base desde la capa de presentación]

## 5. Estilo de Código

- **Indentación:** [ej. 2 espacios | 4 espacios | tabs]
- **Comillas:** [ej. simples | dobles]
- **Punto y coma:** [ej. obligatorios | opcionales]
- **Longitud máxima de línea:** [ej. 100]
- **Comentarios:** [ej. solo para "por qué", no para "qué hace"]

## 6. Manejo de Errores

- **Estrategia primaria:** [ej. Result<T,E> | exceptions | error-as-value]
- **Logging obligatorio en:** [ej. boundary errors, integraciones externas]
- **Política con `null`/`undefined`:** [ej. prohibido en tipos públicos | usar Option/Maybe]

## 7. Testing

- **Política TDD:** [Estricta (test antes de código) | Recomendada | Test-After permitido]
- **Niveles requeridos:** [unit | integration | e2e]
- **Mocks:** [ej. permitidos solo para integraciones externas]
- **Setup/teardown:** [ej. usar fixtures | builder pattern para datos de prueba]

## 8. Idioma del Código

- **Identificadores (variables, clases, funciones):** [ej. inglés]
- **Comentarios:** [ej. español | inglés]
- **Mensajes de commit:** [ej. inglés con conventional commits]
- **Documentación pública (READMEs, ADRs):** [ej. español]

## 9. Reglas Específicas del Equipo / Cliente

> Espacio libre para cualquier regla que no encaje en las anteriores.

- [Regla 1]
- [Regla 2]

## 10. Specture / Claude Code Integration

> Toggles opt-in para las capacidades nativas de Claude Code que Specture integra. Por defecto todos quedan en `false`: Specture funciona como en v1.1.0 (skill-based, sin hooks, sin MCP externo). Activá lo que quieras usar.

- **hooks.enabled**: [true | false]      # activa el TDD Honesty Gate (bloqueo mecánico de edits a tests durante GREEN). Nota: desde v1.5.0 el routing NO es automático — se entra a Specture invocando `/specture:start`; el antiguo hook SessionStart fue deregistrado.
- **context7.enabled**: [true | false]   # permite consultas a Context7 MCP en code-reviewer (Dimension 5: stack idiomaticity) y en modernize (gap analysis con docs vivas)
- **build.max_parallel_epics**: 3         # tope de epic-agents concurrentes en el modo "Agentes por Epic en Paralelo (Olas)" de /specture:build. `1` = comportamiento secuencial. Default 3 si se omite.

Cuando `hooks.enabled: false`, los scripts del plugin se cargan pero retornan sin actuar. Cuando `context7.enabled: false`, los agentes/skills que lo consultarían omiten esa fuente y marcan secciones afectadas como "needs manual verification" si aplica. `build.max_parallel_epics` solo aplica al modo paralelo de build; los modos Inline y secuencial lo ignoran.
