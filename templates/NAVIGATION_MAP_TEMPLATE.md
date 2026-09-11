# Mapa de Navegación — [Nombre del Proyecto]

> Producido por la Fase 3 (`ux-design`). **La tabla de §1 es la fuente legible por máquina:**
> `scripts/design-inventory.js --verify` la parsea para comprobar que el inventario de
> componentes cubre cada pantalla, cada operación y cada estado. Respeta las cinco columnas y
> su orden — con otra forma el verificador falla *ruidosamente* (`UNVERIFIABLE`), nunca en
> silencio con una lista vacía.
>
> Una pantalla que necesite un dato que el contrato no expone **no se inventa**: es un hueco
> del contrato, se registra en §4 y se escala a la Fase 2.

## 1. Pantallas

| Ruta | Pantalla | Auth | Operaciones consumidas | Estados declarados |
|---|---|---|---|---|
| `/` | [Nombre] | `pública` | — | `cargando`, `error` |
| `/archivos` | Mis archivos | `rol:empleado` | `listarArchivos`, `subirArchivo` | `vacío`, `cargando`, `error`, `sin-permiso` |

**Gramática de las columnas** (la respeta el parser):

- **Ruta** — el path entre backticks, con sus parámetros: `` `/usuarios/:id` ``.
- **Pantalla** — nombre en lenguaje de negocio.
- **Auth** — `pública` · `autenticada` · `rol:<rol>` (varios roles separados por coma).
- **Operaciones consumidas** — `operationId`s del contrato entre backticks, separados por
  coma; `—` si la pantalla no consume ninguna; **`por-confirmar`** si todavía no se verificaron
  contra la spec. **Nunca URLs ni shapes.**
  > **Prohibido asignar operaciones por plausibilidad de nombre.** Que `listarFacturas` exista en
  > el contrato no lo convierte en la operación correcta para `/facturas`, y el verificador no
  > distingue esos dos casos: sólo comprueba que el id exista. Una adivinanza con la aprobación
  > del gate es peor que un hueco declarado. Si no está verificada, es `por-confirmar`.
- **Estados declarados** — de `vacío` · `cargando` · `error` · `sin-permiso`. Toda pantalla
  que consuma una operación declara al menos `cargando` y `error`; toda pantalla que liste
  una colección declara además `vacío`; toda pantalla tras `rol:` declara `sin-permiso`.

## 2. Detalle por pantalla

> Lo que la tabla no puede llevar. Una subsección por pantalla, con su ruta como título.

### `/archivos` — Mis archivos
- **Propósito:** [una frase]
- **Elementos clave:** [header con avatar, tabla de archivos, botón de subida — texto, no diseño]
- **Historias de usuario:** [HU-nnn de `business_requirements.md`]
- **Contenido real:** [la etiqueta más larga que mostrará, el nombre más largo, la cifra más
  grande, el miembro de enum más largo. Se diseña contra esto, no contra "Lorem" y tres filas
  — buena parte de lo genérico de una UI generada viene de haberse diseñado sobre datos falsos.]

## 3. Flujos críticos

> Los caminos que importan, entre pantallas.

```
[Landing] → [Sign Up] → [Verificación] → [Onboarding] → [Dashboard]
```

## 4. Huecos del contrato

> Pantallas que necesitan un dato que ninguna operación del contrato expone. Se escalan a la
> Fase 2 como operación faltante. Escribir "Ninguno" si no hay.

- **G-01:** `/[ruta]` necesita [dato] — ninguna operación lo expone.
