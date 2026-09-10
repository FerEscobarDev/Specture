# [Nombre] — `docs/03-ux-ui/components/[Nombre].md`

> Un archivo por componente del inventario. Se autora **perezosamente**, justo antes del epic que
> lo consume — no los cincuenta de golpe en la Fase 3. Lo lee `ux-implementer` como rebanada
> resuelta, y el `code-reviewer` en su dimensión de frontend.
>
> Modelado sobre los `.reference.md` que ya probaron funcionar en proyectos reales: contrato de
> props tipado, anatomía citando tokens, matriz de estados, y la composición de ejemplo.

- **Nivel:** `primitive` | `composite` | `domain` | `pattern`
- **Deriva de:** [enum, agregado del contrato, o pantalla del mapa de navegación que lo exige]
- **Procedencia:** `autorado` | `medido del DOM` | `traído por canal`
  *(`medido del DOM` es autoritativo: un pull posterior del canal **no lo sobrescribe**)*

## Contrato de props

| Prop | Tipo | Default | Requerido | Qué hace |
|---|---|---|---|---|
| `variant` | `'primary' \| 'secondary'` | `'primary'` | no | |
| | | | | |

## Anatomía

> Las partes del componente y **el token semántico de cada una**. Nunca un valor crudo: si una
> parte necesita un color que ningún token semántico nombra, eso es un hueco del design system y
> se registra en su §7, no se resuelve aquí con un hex.

| Parte | Token | Notas |
|---|---|---|
| contenedor | `color.bg.surface` · `radius.md` · `border.subtle` | |
| etiqueta | `color.text.primary` · `text.body` | |
| foco | `color.focus.ring` · `shadow.focus` | ≥3:1 contra ambos colores adyacentes |

## Estados

> La matriz completa. Un estado sin fila es un estado que nadie construyó.

| Estado | Cambio visual | Cambio de comportamiento |
|---|---|---|
| default | | |
| hover | | |
| focus-visible | | |
| activo | | |
| deshabilitado | | `aria-disabled` |
| cargando | | |
| error | | el color **no** es el único portador — acompaña etiqueta o ícono |

## Variantes

| Variante | Cuándo se usa | Qué cambia |
|---|---|---|

## Accesibilidad

- Rol / semántica nativa: [elemento]
- Navegación por teclado: [teclas y qué hacen]
- `aria-*` obligatorios: [lista]
- Objetivo táctil: ≥24×24 px

## Composición de ejemplo

> Cómo se usa de verdad, con **contenido real** del proyecto — la etiqueta más larga, el miembro
> de enum más largo, la cifra más grande. Nunca "Lorem" ni tres filas de relleno: diseñar sobre
> datos falsos es de dónde sale buena parte de lo genérico de una UI generada.

[descripción textual de la composición, sin código]

## Deltas de marca

> Diferencias deliberadas respecto de la librería UI declarada en `stack.yml`, con su motivo.
> Si la librería impone un default que el design system contradice y no se puede anular, se
> registra aquí como presupuesto de override consumido.

| Delta | Motivo |
|---|---|
