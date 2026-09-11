# Design System — Archivador

## 1. Dirección

- **Dirección elegida:** Registro sobrio — el archivador de una oficina, no una app de consumo.
- **Qué sacrifica deliberadamente:** calidez. Prioriza densidad y legibilidad en tablas largas.
- **Procedencia de la marca:** `usuario`
- **Voz y tono:** directo, sin jerga. El empleado confirma que su archivo llegó, nada más.

### 1.1 Elemento firma

- **Firma:** regla doble bajo la cabecera de tabla — token `border.header`
- **Superficies donde aparece:** `Table`, `EmptyState`, `AppShell`

## 2. Tokens

### 2.1 Primitivos

| Token | Valor | Notas |
|---|---|---|
| `neutral.0` | #ffffff | |
| `neutral.400` | #8b99a3 | |
| `neutral.500` | #6b7780 | teñido con el hue de marca (azul, croma bajo) |
| `neutral.600` | #55636d | |
| `neutral.900` | #16222b | |
| `neutral.1000` | #0b1116 | |
| `brand.400` | #5b93c7 | |
| `brand.700` | #1f4e79 | |

### 2.2 Semánticos

| Token semántico | Claro | Oscuro | Uso |
|---|---|---|---|
| `color.bg.canvas` | `neutral.0` | `neutral.1000` | fondo de página |
| `color.bg.surface` | `neutral.0` | `neutral.900` | tarjetas y tablas |
| `color.text.primary` | `neutral.900` | `neutral.0` | texto principal |
| `color.text.muted` | `neutral.600` | `neutral.400` | texto auxiliar |
| `color.text.on-accent` | `neutral.0` | `neutral.1000` | texto sobre acción |
| `color.border.strong` | `neutral.500` | `neutral.500` | límites de control |
| `color.action.primary` | `brand.700` | `brand.400` | acción principal |
| `color.focus.ring` | `brand.700` | `brand.400` | anillo de foco |

### 2.4 Tipografía, espaciado y el resto

| Token | Valor | Notas |
|---|---|---|
| `text.body` | Inter · 14px · 1.5 | bucket: neo-grotesca |
| `space.2` / `space.4` | 8px / 16px | densidad `dense-professional` |
| `radius.md` | 6px | perfil uniforme |

## 3. Inventario de Componentes

| Componente | Nivel | Deriva de | Estado |
|---|---|---|---|
| `Button` | primitive | acción de descarga | `done` |
| `Table` | composite | `/archivos` — colección de `listarArchivos` | `done` |
| `EmptyState` | composite | estado `vacío` de `/archivos` | `done` |
| `TipoArchivoBadge` | domain | enum `tipo` de `listarArchivos` | `done` |

## 6. Accesibilidad y responsividad

- WCAG 2.2 AA. El color nunca es el único portador de un estado: los errores llevan texto.
- Sin colores fuera de los tokens.
