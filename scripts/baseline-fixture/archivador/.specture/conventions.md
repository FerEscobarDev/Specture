# Convenciones del Proyecto — Archivador

## 1. Naming
- **Variables y funciones:** camelCase
- **Clases / tipos:** PascalCase
- **Archivos:** kebab-case.js
- **Tests:** `*.test.js` bajo `tests/`

## 2. Organización de Archivos
- **Estructura por:** feature (`archivador_api/src/<feature>/`)
- **Co-localización:** tests en carpeta separada `tests/<feature>/`
- **Tamaño máximo de archivo (líneas):** 300

## 3. Patrones Permitidos
- Repository pattern para acceso a datos
- Inyección de dependencias por constructor

## 4. Patrones Prohibidos
- Lógica de negocio en controllers
- Acceso directo a la base desde la capa HTTP

## 6. Manejo de Errores
- Errores de dominio como clases `XxxError` con `code`; la capa HTTP los traduce al envelope del contrato.

## 7. Testing
- **Política TDD:** Estricta
- **Globs de tests:** `tests/**/*.test.js`
- **Mocks:** solo para integraciones externas

## 8. Idioma del Código
- **Identificadores:** inglés · **Prosa de negocio, specs y ADRs:** español

## 12. Invariantes del proyecto
- **R-1:** toda operación HTTP identifica al empleado por el header `X-Employee-Id`; sin header → 401 `UNAUTHENTICATED`.
- **R-2:** ninguna respuesta de error usa un shape distinto del envelope `{ error: { code, message } }`.

## 13. Workflow / Proceso (W-*)

- **W-3:** Conventional Commits en todos los commits.
