# Design System — [Nombre del Proyecto]

> Deliverable universal de la Fase 3 (`ux-design`), en ambas rutas: la ruta sólo decide quién
> lo renderiza a código, nunca si existe.
> - **Ruta 1 (Delegada):** además se llena §4 (Specs para IA de Diseño) — un brief que **exige**
>   a la IA externa entregar un Design System. El handoff que vuelva se convierte con `handoff-ingest`.
> - **Ruta 2 (Specture renderiza):** el Design System aquí descrito se codifica en los epics de
>   frontend de la Fase 4.
> - Excepción Adopt-con-UI: se documenta a partir del código existente, no se diseña de cero.
>
> El **Mapa de Navegación** ya no vive aquí: tiene archivo y plantilla propios
> (`docs/03-ux-ui/navigation_map.md`, `NAVIGATION_MAP_TEMPLATE.md`). Tener dos gramáticas en dos
> archivos era la razón de que ningún script pudiera leerlo.

## 1. Identidad de Marca

- **Nombre del producto:** [Nombre]
- **Voz y tono:** [ej. profesional pero cercana, técnica, lúdica]
- **Audiencia:** [perfil del usuario objetivo]
- **Referencias visuales:** [URLs que el usuario provea — no inventar]

## 2. Tokens del Design System (Ambas rutas)

> Los tokens son la fuente de verdad del estilo. La librería UI declarada en `.specture/stack.yml` (`frontend.ui_library`) los consumirá.

### 2.1 Color

| Token | Valor (HEX) | Uso |
|-------|-------------|-----|
| `color.primary.500` | [#XXXXXX] | Acción principal, links activos |
| `color.primary.600` | [#XXXXXX] | Hover de acción principal |
| `color.secondary.500` | [#XXXXXX] | Acción secundaria |
| `color.success` | [#XXXXXX] | Estados de éxito |
| `color.warning` | [#XXXXXX] | Estados de advertencia |
| `color.error` | [#XXXXXX] | Estados de error |
| `color.info` | [#XXXXXX] | Estados informativos |
| `color.neutral.0` | [#FFFFFF] | Fondo claro |
| `color.neutral.900` | [#0A0A0A] | Texto principal modo claro |
| `color.neutral.50..800` | [escala] | Grises intermedios |

> **Validación:** todos los pares texto/fondo usados en componentes deben cumplir contraste WCAG AA (4.5:1 para texto normal, 3:1 para texto grande).

### 2.2 Tipografía

| Token | Familia | Tamaño | Line-height | Peso | Uso |
|-------|---------|--------|-------------|------|-----|
| `text.display` | [Familia] | [px/rem] | [valor] | [peso] | Headers de hero |
| `text.h1` | ... | ... | ... | ... | Título de página |
| `text.h2` | ... | ... | ... | ... | Subtítulo de sección |
| `text.body` | ... | ... | ... | ... | Texto general |
| `text.caption` | ... | ... | ... | ... | Texto auxiliar / labels |
| `text.code` | [monospace] | ... | ... | ... | Inline code |

### 2.3 Spacing

| Token | Valor |
|-------|-------|
| `space.xs` | [4px / 0.25rem] |
| `space.sm` | [8px / 0.5rem] |
| `space.md` | [16px / 1rem] |
| `space.lg` | [24px / 1.5rem] |
| `space.xl` | [32px / 2rem] |
| `space.2xl` | [48px / 3rem] |

### 2.4 Otros

- **Border radius:** `xs/sm/md/lg/full` → [valores]
- **Shadows:** `sm/md/lg/focus` → [valores]
- **Breakpoints:** `sm/md/lg/xl` → [valores]
- **Z-index:** convención (ej. modal=1000, toast=2000, tooltip=3000)

## 3. Especificación de Componentes Base (Ambas rutas)

> Texto descriptivo, NO código. La implementación se hará en los epics de frontend del ROADMAP.

### Button
- **Variantes:** primary | secondary | ghost | danger | link
- **Estados:** default | hover | focus | active | disabled | loading
- **Tamaños:** sm | md | lg
- **Iconos:** soporta icono a la izquierda, derecha, o solo icono
- **Accesibilidad:** focus visible, aria-disabled cuando aplica, role implícito

### Input
- **Variantes:** text | email | password | number | search
- **Estados:** default | hover | focus | error | disabled | readonly
- **Affordances:** label encima, helper text debajo, mensaje de error
- **Iconos:** prefix/suffix opcionales

### Card, Modal, Toast, Avatar, Badge, Tabs, Tooltip, Table…
*(repetir patrón con variantes/estados/accesibilidad)*

## 4. Specs para IA de Diseño (Solo Ruta 1)

> Este bloque se entrega a la IA externa (Claude Design, v0, Lovable). Después se trae el código generado y se valida contra `architecture.md` y `conventions.md`.

- **Voz/tono:** [§1]
- **Audiencia:** [§1]
- **Identidad visual existente:** [logo URL, paleta si ya existe]
- **Restricciones:** [marca corporativa, requisitos legales, accesibilidad mínima WCAG AA]
- **Patrones prohibidos:** [ej. "no carousels en home", "no modales para acciones primarias"]
- **Responsividad:** [mobile-first / desktop-first]
- **Modo oscuro:** [sí/no]
- **Stack que consumirá la UI:** [`frontend.framework` + `frontend.ui_library`] (de `.specture/stack.yml`)

## 5. Reglas de Accesibilidad y Responsividad

- **Nivel WCAG mínimo:** [AA recomendado]
- **Modo oscuro:** [sí/no, con qué tokens cambia]
- **Mobile-first:** [sí/no]
- **Tamaño mínimo soportado:** [ej. 320px ancho]
- **Patrones requeridos:** focus visible, navegación por teclado completa, aria-labels en iconos sin texto, contraste validado
- **Reducción de movimiento:** respetar `prefers-reduced-motion`

## 6. Notas de Decisión

> Si elegiste cierta librería, paleta, o patrón sobre otro, registra el "por qué" aquí. Si la decisión es importante, conviértela en un ADR en `.specture/decisions/`.
