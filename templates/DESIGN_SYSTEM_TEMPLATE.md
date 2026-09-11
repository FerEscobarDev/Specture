# Design System — [Nombre del Proyecto]

> Deliverable universal de la Fase 3 (`ux-design`). Es el contrato del look & feel: lo obedecen
> `ux-implementer` al construir y el `code-reviewer` al revisar.
>
> El **Mapa de Navegación** vive aparte (`docs/03-ux-ui/navigation_map.md`,
> `NAVIGATION_MAP_TEMPLATE.md`) y es la fuente legible por máquina del verificador de cobertura.
> El **detalle de cada componente** vive en `docs/03-ux-ui/components/<Nombre>.md`
> (`COMPONENT_REFERENCE_TEMPLATE.md`): aquí va el roster, allá la anatomía.

## 1. Dirección

> De dónde sale la identidad. Los campos `MK-nnn` vienen de `business_requirements.md`
> §Identidad de Marca — **no se re-inventan aquí**. Si allá dicen `sin definir`, aquí se escribe
> `sin definir` y la procedencia se marca como propuesta por el agente.

- **Dirección elegida:** [nombre] — [tesis en una frase]
- **Qué sacrifica deliberadamente:** [a qué renuncia esta dirección. Sin esto no es una dirección, es un promedio.]
- **Direcciones descartadas:** [nombres] — registradas en `.specture/decisions/<ADR>.md`
- **Procedencia de la marca:** `usuario` | `PROPUESTO_POR_EL_AGENTE` *(si es lo segundo, el gate visual de la Fase 4 debe confirmarlo explícitamente antes de construir páginas)*
- **Voz y tono:** [MK-005]
- **Audiencia:** [de `business_requirements.md` §Actores]
- **Anti-referencias:** [MK-004 — a qué NO debe parecerse, y por qué]

### 1.1 Elemento firma

> **Exactamente uno**, presente en **≥3 superficies** del inventario, codificado como token o
> utilidad nombrada — no como prosa. Es lo que hace reconocible al producto sin el logo.
> Ejemplos, y la lista **no es cerrada**: identidad de radio · tratamiento de borde · textura de
> superficie · movimiento tipográfico · identidad de focus-ring · identidad de trazo de ícono ·
> motivo de ángulo · un acento saturado reservado a un solo trabajo.
> **Ilegales por ser defaults:** "un gradiente", "esquinas redondeadas", "sombras".

- **Firma:** [nombre] — token o utilidad: `[token]`
- **Superficies donde aparece:** [componente 1], [componente 2], [componente 3]
- **Coherencia con el sacrificio:** [una firma no puede contradecir aquello a lo que la dirección renunció]

## 2. Tokens

> **Tres capas con referencia unidireccional:** componente → semántico → primitivo. Un componente
> nunca cita un primitivo directamente. Es lo que hace mecánicamente posibles el modo oscuro, el
> theming, la validación de contraste y el lint de tokens.

### 2.1 Primitivos — la rampa

> Valores crudos, sin significado. Nadie los usa directamente en un componente.
>
> **Derivación:** toma 1-2 hues semilla de la dirección y genera la rampa pisando L a incrementos
> fijos, con croma atenuado en los extremos. **Los neutros se derivan desaturando el hue de marca**,
> no se copian de una escala de fábrica: un gris entibiado o enfriado es el diferenciador más
> barato que existe, y es la diferencia medible entre un sistema con marca y uno genérico.

> La rampa es **fija**: un primitivo vale lo mismo en claro y en oscuro. Lo que cambia entre
> modos es a qué primitivo apunta cada token semántico (§2.2), no el primitivo en sí.

| Token | Valor | Notas |
|---|---|---|
| `brand.50` … `brand.900` | [#XXXXXX] | rampa de marca |
| `neutral.0` … `neutral.1000` | [#XXXXXX] | **teñidos con el hue de marca** — declarar hue y croma |
| `accent.*` | [#XXXXXX] | sólo si la dirección declara un acento reservado |

### 2.2 Semánticos — los que se usan

> La capa que suele faltar, y sin la cual la regla "todo color sale de tokens" es insatisfacible
> para superficies, bordes y texto sobre color. **Ambas columnas son obligatorias:** el modo
> oscuro se enumera, no se deriva en prosa. Una matriz de contraste con sólo la columna clara
> certifica media paleta y lo comunica como cobertura completa.

| Token semántico | Claro → primitivo | Oscuro → primitivo | Uso |
|---|---|---|---|
| `color.bg.canvas` | `neutral.0` | `neutral.1000` | fondo de página |
| `color.bg.surface` | `neutral.0` | `neutral.900` | tarjetas, paneles |
| `color.bg.surface.raised` | `neutral.0` | `neutral.800` | escalón de elevación |
| `color.text.primary` | `neutral.900` | `neutral.50` | texto principal |
| `color.text.muted` | `neutral.600` | `neutral.400` | texto auxiliar |
| `color.text.on-accent` | `neutral.0` | `neutral.1000` | texto sobre color de acción |
| `color.border.subtle` | `neutral.200` | `neutral.700` | separadores |
| `color.border.strong` | `neutral.400` | `neutral.600` | bordes de control |
| `color.action.primary` | `brand.600` | `brand.400` | acción principal |
| `color.focus.ring` | `brand.500` | `brand.400` | anillo de foco |
| `color.status.success` | … | … | ver §2.3 |
| `color.status.warning` | … | … | |
| `color.status.error` | … | … | |
| `color.status.info` | … | … | |

**Piso obligatorio** — el sistema no está completo hasta que existan `bg.canvas`, `bg.surface`, un
`text.*` por cada superficie, `text.on-accent` por cada color de acción, `border.subtle` y
`focus.ring`. El verificador de contraste falla si un par obligatorio no está declarado, con un
mensaje distinto al de "ratio insuficiente": son causas distintas con arreglos distintos.

### 2.3 Colores de estado

> Se derivan rotando hue desde la rampa de marca con **croma igualado**, para que se lean como
> familia y no como el rojo/verde/ámbar de Bootstrap.
>
> **Excepción obligatoria:** la luminosidad NO se iguala entre `error` y `success`. Para
> deficiencia de visión cromática rojo-verde (~8% de los hombres), una vez que el hue deja de
> separar, la única separación que queda es la diferencia de luminosidad. Piso: **ΔL ≥ 0.12 en
> OKLCH**, y `error` puede romper el techo de croma — debe ser *más* saliente que el resto, no
> igual de saliente.

| Par | ΔL | ¿Cumple el piso? |
|---|---|---|
| `error` ↔ `success` | [valor] | [sí / no] |

### 2.4 Tipografía, espaciado y el resto

| Token | Valor | Notas |
|---|---|---|
| `text.display` / `h1` / `h2` / `body` / `caption` / `code` | [familia · tamaño · line-height · peso] | declarar el **bucket** de la display: neo-grotesca / humanista / geométrica / transicional / serif display / slab / mono-como-display |
| `space.xs` … `space.2xl` | [valores] | la base la fija la densidad (§4) |
| `radius.*` | [valores] | declarar el **perfil**: uniforme / asimétrico / cero |
| `shadow.*` | [valores] | incluido `shadow.focus` |
| `breakpoint.*` | [valores] | |
| `z.*` | [convención] | |

### 2.5 Por qué este proyecto

> Una fila por grupo fundacional. **Racionales rechazados:** "es el default", "limpio y moderno",
> "accesible" (la accesibilidad es piso, no razón).
>
> **El criterio que discrimina:** el racional debe hablar de la **audiencia o el dominio** — por
> qué esta gente, este contexto de uso, este estado emocional. Un racional que habla de la
> mecánica interna de la propia paleta ("para no colisionar con el verde del calendario") explica
> una restricción, no una identidad, y no cuenta.
>
> **Excepción Adopt (`ui_defined: true`): esta regla se invierte.** En un proyecto que ya lleva
> años en producción, *"es el default de la librería"* suele ser la **respuesta verdadera**, y
> escribirla es obligatorio. Reconstruir un racional de dominio que suena mejor para un valor que
> nadie eligió es inventar con mejor gramática. Si la decisión no la tomó nadie, la celda dice
> `no declarado — heredado de <librería>`.

| Grupo | Decisión | Por qué este proyecto | Cita |
|---|---|---|---|
| Hue primario | [valor] | [audiencia / dominio] | [MK-nnn / RN-nnn] |
| Pareja tipográfica | [valor] | | |
| Radio base | [valor] | | |
| Base de densidad | [valor] | | |
| Duraciones de motion | [valor] | | |
| Modelo de elevación | [valor] | | |

## 3. Inventario de Componentes

> El roster. La anatomía de cada uno vive en `docs/03-ux-ui/components/<Nombre>.md`, que se autora
> **perezosamente**, justo antes del epic que lo consume — no los cincuenta de golpe en la Fase 3.
>
> El inventario **se escribe y se verifica**, no se deriva: `scripts/design-inventory.js --verify`
> lo cruza contra el mapa de navegación y el contrato y falla si una pantalla, un enum o un estado
> obligatorio se queda sin componente.

| Componente | Nivel | Deriva de | Estado |
|---|---|---|---|
| `Button` | primitive | — | `done` |
| `EstadoBadge` | domain | enum `estado` de `listarArchivos` | `pending` |
| `CupoProgress` | domain | agregado `Cupo` | `deferred → Epic 3.4` |

- **Niveles:** `foundation` · `primitive` · `composite` · **`domain`** · `pattern`.
- **`domain` es obligatorio:** ≥1 por agregado mayor del contrato. Un design system con cero
  componentes de dominio es genérico por definición, y es el nivel donde vive la identidad del
  producto: son justo los que ninguna lista copiada nombraría.
- **`deferred` exige destino:** `deferred → Epic X.Y` o `deferred → fuera del roadmap`, más un
  motivo de una línea. Sin destino no es diferido, es un bloqueo silencioso. Cuando el epic
  destino cierra sin que la fila pase a `done`, vuelve a bloquear.
- Se referencia por **id**, nunca por ruta, mientras el archivo no exista: una ruta citada que no
  está en disco es un ERROR `broken-path` del corpus lint en cada corrida del doctor.

## 4. Motion, elevación, densidad e iconografía

> Las cuatro dimensiones en las que dos productos con la misma paleta siguen viéndose distintos.

- **Motion:** personalidad (`none` / `functional` / `expressive`) · duraciones · easings · qué
  hace `prefers-reduced-motion`.
- **Elevación:** modelo de capas. En modo oscuro la elevación se lee como **claridad de
  superficie**, no como sombra — declarar la escalera y la separación mínima entre escalones.
- **Densidad:** `airy-marketing` / `balanced-product` / `dense-professional` → fija la base de
  espaciado y las alturas de control.
- **Iconografía:** una familia · grosor de trazo · relleno vs contorno · `aria-label` obligatorio
  en icon-only · **sin emoji en slots de ícono**.

## 5. Contenido y voz

- Principios de tono · capitalización · gramática de botones (verb-first).
- Fórmula del mensaje de error: qué pasó y cómo arreglarlo. Sin disculpas ni vaguedad.
- Formatos de fecha, número y moneda · realidad de locale y script (RTL, CJK, cadenas largas).

## 6. Accesibilidad y responsividad

- Piso: WCAG 2.2 AA. Texto 4.5:1 · texto grande 3:1 · no-texto 3:1 · focus ring ≥3:1 contra
  **ambos** colores adyacentes. Lo verifica `scripts/design-lint.js contrast`, en los dos modos.
- **El color nunca es el único portador de un estado** — siempre acompaña etiqueta o ícono.
- Objetivo táctil ≥24×24 px.
- Qué cambia **estructuralmente** en cada breakpoint, no sólo qué se apila.

## 7. Gobernanza y log de deltas

> Un design system que se toca durante build sin dejar rastro deja de ser la ley que dice ser.

- **Quién cambia qué:** los tokens fundacionales sólo cambian con aprobación visual nueva; el
  resto se registra abajo.
- **Log de deltas** — una línea por cambio posterior a la aprobación:

| Fecha | Epic | Qué cambió | Por qué |
|---|---|---|---|
| [ISO] | [Epic X.Y] | [token o componente] | [motivo] |

- **Huecos de token semántico:** cuando `ux-implementer` no encuentra token para un rol, el
  coordinador apendiza el hueco aquí. Es lo que convierte una inconsistencia acumulada e
  invisible en deuda contable.
