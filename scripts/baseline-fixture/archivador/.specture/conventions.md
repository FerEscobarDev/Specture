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

## 12. Invariantes del Proyecto (R-*)

> **Desde v1.19.0 las invariantes viven en `.specture/rules.yml`** (R-1 header `X-Employee-Id`, R-2 envelope de error — tags `backend, api, http`). El coordinador de `build` inyecta solo las reglas cuyos tags cruzan con el spec (Rules Resolution); el `code-reviewer` las enforça por ID (Dimensión 7). Esta sección es solo un **puntero** — no declares reglas aquí.

## 13. Workflow / Proceso (W-*)

- **W-3:** Conventional Commits en todos los commits.
