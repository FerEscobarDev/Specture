# Rediseño del flujo de frontend — Design Track y canales de diseño

> **Estado:** propuesta de diseño · **Fecha:** 2026-09-08 · **Versión objetivo:** v1.20.0 (Milestone 7)
>
> Sucede a [`ui-design-flow-analysis.md`](./ui-design-flow-analysis.md), que produjo el flujo actual (contrato de API + disciplina de frontend + `handoff-ingest`). Aquel documento resolvió la coordinación back↔front. Éste ataca lo que dejó abierto: **la calidad del diseño en sí** y **la integración con el Claude Design de 2026**.
>
> Investigación de respaldo: 6 agentes en paralelo sobre (a) el flujo actual, (b) el plumbing del framework, (c) la superficie nativa de Claude Design extraída del binario de Claude Code 2.1.263, (d) evidencia medida en 5 proyectos reales del usuario, (e) método de calidad de diseño con fuentes.
>
> ⚠️ **Leer §12 antes que nada.** Este documento pasó una revisión adversarial el 2026-09-08 que **invalida parte de su diagnóstico y una de sus propuestas de gate**. Las secciones §3 y §6 quedan corregidas allí. El cuerpo original se conserva sin retocar para que la corrección sea auditable.

---

> ## ⛔ SUPERADO POR LA IMPLEMENTACIÓN (2026-09-11, v1.20.0)
>
> Este documento es el **registro de la propuesta**, no la especificación de lo que se construyó.
> Lo enviado está en el **Milestone 7** de `docs/framework-roadmap.md` (ítems 43-51) y la evidencia
> medida en `docs/frontend-design-baseline.md`.
>
> Cuatro propuestas de §5 y §8 **no se enviaron**, y por qué consta en el baseline:
> el gate de genericidad (la medida se prototipó y no separa las clases), el ledger sobre
> `design_system.md` (nueve de diez entradas no disparan en ningún proyecto real; sobrevive sobre
> código midiendo adherencia a tokens), el push a la herramienta externa (no puede correr en un
> subagente) y la generación aritmética de rampas.
>
> **No leas §5 ni §8 como plan.** Su corrección vive en §12 y su resultado en el roadmap.

## 1. Resumen ejecutivo

Tres problemas distintos, con diagnósticos distintos:

| | Problema reportado | Diagnóstico real |
|---|---|---|
| **P1** | "Sin herramienta externa el design system es deficiente, genérico, con pocos componentes" | **Confirmado y medible.** El único proyecto que corrió Ruta 2 pura tiene **19 de 20 valores hex idénticos a swatches stock de Tailwind**. La causa no es el modelo: es que la Fase 03 nunca fuerza *ninguna decisión estética* y la plantilla ancla el inventario en nueve componentes y unos puntos suspensivos. |
| **P2** | "Claude Design ya no exporta handoff" | **Parcialmente falso, y por eso duele.** El handoff sigue existiendo (Export → "Hand off to Claude Code"), pero ahora llega como **URL de bundle** y su forma **cambió tres veces en cuatro meses** — los tres handoffs del usuario tienen tres estructuras distintas y `handoff-ingest` está clavada a la más vieja. |
| **P3** | "Claude Code tiene comandos específicos con Claude Design y hay que explorarlos" | **Confirmado y subexplotado.** Existen **tres** superficies nativas, no una. `grep` de `DesignSync\|dc.html\|claude.ai/design` sobre todo el framework devuelve **cero coincidencias** — mientras el usuario ya construyó a mano dos workarounds en sus proyectos. |

**La tesis del rediseño:** el diseño en Specture es hoy *una fase documental de un solo disparo* con dos rutas asimétricas y una tercera ruta apuntando a un formato muerto. Debe convertirse en un **track con tres estaciones** (Dirección → Sistema → Sync) que corre en paralelo al track del contrato de API y **sigue vivo durante build**, apoyado en una **espina de artefactos** única que cualquiera de los **canales de render** rellena de forma idéntica.

Lo decisivo: **todo lo que arregla P1 es local y determinista**. Nada de lo que sube la calidad del diseño depende de tener acceso a Claude Design. El canal solo decide *quién dibuja*, nunca *si el sistema es bueno*.

---

## 2. Qué cambió afuera — la superficie nativa hoy (Claude Code 2.1.263)

Extraído del binario (`~/.local/share/claude/versions/2.1.263`, 218 MB) y contrastado con documentación oficial. Marcado **VERIFICADO** (leído/ejecutado) vs **INFERIDO**.

### 2.1 Skill `design` — canvas de artboards, ida y vuelta, sin cuenta

**VERIFICADO.** Claude escribe artboards `<Nombre>.dc.html` + `canvas.json` como archivos de trabajo normales; un helper `seed-canvas.mjs` los inyecta en un payload precompilado del editor de canvas y se publica con la herramienta Artifact anclada a `contract: "0.1.31"`. El usuario edita visualmente y guarda; **Claude lee los cambios de vuelta** con `Artifact action:"read"` seguido de `node seed-canvas.mjs --extract <página guardada> --to <dir nuevo>`, que decodifica artboards, `canvas.json` e imágenes a disco.

- **No requiere cuenta de claude.ai/design.** Es la única superficie que degrada hasta un HTML local navegable.
- `.dc.html` es HTML plano con estilos inline — **tecnológicamente agnóstico como referencia visual**.
- Límites duros del helper: ≤200 entradas, ≤2 MiB por entrada, artifact ≤16 MiB, `Main.dc.html` es el artboard de entrada.
- Su **paso 0 ya implementa "el design system es el input"**: *"Match the existing app pixel-perfectly — by default, without being asked. Before drawing: find the design system / tokens (`tokens.css`, `theme.*`, `variables.css`, a `tailwind.config.*` theme, `design-system/`…) AND the existing screens closest to the ask. Lift EXACT values from the real component source"*.

> **Consecuencia arquitectónica:** la costura entre Specture y el canvas nativo son **archivos en disco, no una API**. Si el epic de fundación emite `tokens.css` reales *antes* de dibujar, el canvas los levanta solo, con cero código de integración. El `design_system.md` textual de hoy es **invisible** para él.

### 2.2 `DesignSync` / `/design-sync` — push de un design system real

**VERIFICADO.** Convierte un design system **React** (Storybook o paquete) al layout de proyecto DS de claude.ai/design y lo sube, *"so from then on the design agent builds with the customer's actual components"*. Es **empuje, no ingesta**: es el último paso de un proyecto Specture, no el primero.

- Sus métodos de lectura (`list_projects`, `get_project`, `list_files`, `get_file` con tope de 256 KiB) **sí** permiten bajar un proyecto DS archivo por archivo. Es el único camino de descarga disponible hoy.
- **Solo React.** *"a non-React DS has nothing for the claude.ai/design agent to build with."* Rompe la agnosticidad de Specture ⇒ debe ser opt-in según `stack.yml.frontend.framework`.
- Requiere autenticación **first-party** de claude.ai (nunca Bedrock/Vertex), la política `allow_design_sync`, tráfico no restringido, y `/design-login` una vez por máquina.

> **Restricción dura para Specture:** el permiso durable de escritura y `finalize_plan` **no se pueden emitir desde un subagente**, ni en plan mode, ni en sesión no interactiva. Todo `DesignSync` de escritura vive en la sesión principal, jamás en un agente de contexto restringido.

### 2.3 Herramienta `ClaudeDesign` + hub `/design` completo — **APAGADO, y no activable**

**VERIFICADO-NEGATIVO.** El binario contiene la herramienta `ClaudeDesign` con `import`/`export` reales (`get_project` → `list_files` → `read_file` para traer un proyecto al working directory). Pero está detrás de un flag de rollout server-side **desactivado para esta cuenta**: `ToolSearch(select:ClaudeDesign)` no devuelve nada y `/design` degrada a `consent | revoke`.

Las dos condiciones registradas en el binario son idénticas salvo por el flag — todo lo demás ya se cumple:

```js
function l9() { if(!Lt("allow_design_sync")) return false; if(bt()) return false; return Pn() }        // → true
function sSe(){ …las mismas tres… ; return x("tengu_omelette_fouet", false) }                          // → false
```

`x(...)` se evalúa **en el servidor de Anthropic**. No existe clave de `settings.json`, ni variable de entorno, ni versión posterior: **2.1.263 es la última publicada** y el CHANGELOG oficial de Claude Code no tiene una sola entrada sobre comandos de design. `/design import` no está documentado públicamente en ninguna parte — es código no lanzado. **No es activable por el usuario.**

> **El rediseño NO puede apoyarse en `/design import`.** Se modela como capacidad futura, detectable en runtime (`ToolSearch select:ClaudeDesign` → presente/ausente), con camino de upgrade documentado.

### 2.3b El servidor MCP `claude-design` — **la puerta soportada, y está viva**

**VERIFICADO (probado desde esta máquina, 2026-09-08).** El help center de Anthropic documenta:

```
claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp
claude mcp login claude-design
```

El endpoint responde `401` con desafío OAuth y **scope `user:design:read user:design:write`**:

```
www-authenticate: Bearer resource_metadata="https://api.anthropic.com/v1/design/.well-known/oauth-protected-resource",
                  scope="user:design:read user:design:write"
```

Relevante: en junio de 2026 esa misma URL devolvía `404` (issues [#69313](https://github.com/anthropics/claude-code/issues/69313) y [#69325](https://github.com/anthropics/claude-code/issues/69325), cerrados). **El servicio se desplegó desde entonces.** Las herramientas MCP las registra el cliente MCP y **nunca consultan `sSe()`**, así que este camino esquiva el flag de rollout *estructuralmente*, no por truco.

**Limitación honesta:** Anthropic no publica el inventario de herramientas de ese servidor. El scope de lectura es evidencia fuerte de que expone listar proyectos y leer archivos, pero **solo se confirma tras autenticar** (`/mcp`). Hasta confirmarlo, es INFERIDO.

> **Consecuencia para el rediseño:** el canal `claude-design-project` tiene **dos implementaciones posibles** — los métodos de lectura de `DesignSync` (disponibles hoy tras un `/design-login`) y el servidor MCP oficial (superficie probablemente más amplia). El adaptador del canal debe soportar ambas y elegir por detección, no cablearse a ninguna.

### 2.4 El handoff no murió — mutó

**VERIFICADO.** El bundle propio del usuario (`Psikora-handoff/psikora/README.md`) abre con: *"This is a **handoff bundle** from Claude Design (claude.ai/design)… exported this bundle so a coding agent can implement the designs for real."* La documentación oficial confirma que Export → "Hand off to Claude Code" sigue existiendo, ahora entregado como **URL de bundle + prompt pegable** en vez de carpeta colocada a mano.

Lo que sí cambió es la **forma**, y cambió tres veces:

| Handoff | Fecha | Forma |
|---|---|---|
| Psikora | ~mayo 2026 | Carpeta: `README.md`, `colors_and_type.css`, `preview/`, `ui_kits/`, `SKILL.md`, `uploads/` — **exactamente la que `handoff-ingest` codifica como "la referencia"** |
| Splity | ~junio 2026 | Carpeta con `tokens/` (`*-tokens.css`, `*-tokens.json`, `tailwind.preset.js`) y un **`Splity Design.dc.html`** — el formato canvas |
| CEAgenda | ~julio 2026 | **No es carpeta.** Espejo parcial bajo demanda del proyecto claude.ai/design, traído vía `DesignSync` a medida que cada componente entra a build |

> Anclar una skill a un snapshot del formato de exportación de un producto externo garantiza decadencia. Ya decayó dos veces en cuatro meses.

### 2.5 `pencil` MCP (pen.dev) — inerte sin archivo abierto

**VERIFICADO.** `read_skill`, `get_style` y `get_app_state` fallan idénticamente: *"A file needs to be open in the editor to perform this action."* Es un canal acoplado a la app del usuario; no se puede guionar desde una skill. Se soporta como fuente de handoff opcional, nunca como ruta.

---

## 3. P1 — el design system genérico, medido

> ⚠️ **Corregido en §12.1.** La mitad "pocos componentes / documento pobre" de este diagnóstico **no se reprodujo** al medirla. La mitad "la marca no se captura" sí, pero por un mecanismo distinto del que esta sección describe.

### 3.1 La evidencia

Cinco proyectos del usuario con `.specture/`, cuatro con frontend real. Es un experimento controlado natural:

| Proyecto | Camino | `design_system.md` | **% hex custom** |
|---|---|---|---|
| Psikora | Handoff carpeta + push a claude.ai/design | 149.977 B / 1.534 líneas | 63% (tokens del handoff) |
| CEAgenda | Pull incremental vía `DesignSync` | 29.965 B + **44 archivos** `.reference.md` | 77% |
| Splity | Handoff canvas `.dc.html` | 23.998 B / 388 líneas | — |
| **MiEmpleadApp** | **Ruta 2 pura** | **12.895 B / 211 líneas** | **5%** — 19 de 20 hex son swatches stock de Tailwind |
| RedContención | Fase 03 **saltada**, diseñado en código | 5.049 B / 93 líneas | **100%** |

MiEmpleadApp: primary `#0D9488` = `teal-600`, hover `#0F766E` = `teal-700`, toda la rampa neutra es la escala `slate` verbatim, tipografía Inter. El único valor no-Tailwind del documento es `#FFFFFF`.

### 3.2 El contraejemplo que prueba el mecanismo

RedContención **no usó ninguna herramienta externa** y produjo 100% de color propio. Su design system abre argumentando sobre el estado emocional de la audiencia:

> *"Lo que la paleta **evita** es tan importante como lo que incluye: nada de rojos de alarma en la interfaz general — quien llega puede estar en crisis, y una pantalla que grita empeora su estado. El coral se reserva a los dos textos que no pueden pasar desapercibidos."*

**Specture sí es capaz de diseñar con identidad. El camino documental simplemente nunca hace la pregunta que la produce.**

### 3.3 Las tres causas raíz

**(a) La Fase 03 no fuerza ninguna decisión estética.** Su único paso de "elección" (`ux-design/SKILL.md:57-76`, *Step 2 — Choose Route*) elige **quién renderiza**, no **cómo se ve**. Se salta directo a tokens sin divergencia y sin paso de rechazo. Es exactamente el fallo de *"no decision"*: con un brief subespecificado, un LLM emite el centro estadístico de su entrenamiento (Inter/Roboto, primario índigo-violeta, hero centrado + tres tarjetas redondeadas).

**(b) El brief prohíbe inventar identidad y no ofrece método para derivarla.** `DESIGN_SYSTEM_TEMPLATE.md:12` dice `**Referencias visuales:** [URLs que el usuario provea — no inventar]`. MiEmpleadApp cumplió fielmente: *"ninguna provista por el usuario (no se inventan)"* — y cayó al default más seguro que existe. Faltan los campos que producen diferenciación: **anti-referencias**, pares atributo/anti-atributo, densidad, personalidad de motion, postura tipográfica, ledger de convenciones a honrar vs romper.

**(c) El framework distribuye la lista copiada que pretende evitar.** El inventario requerido es una enumeración literal — *"Button, Input, Card, Modal, Toast, Table, Badge, Tabs, Avatar, Tooltip"* — repetida en `SKILL.md:100` y `:111`, y en la plantilla el bloque de componentes literalmente termina en:

```
### Card, Modal, Toast, Avatar, Badge, Tabs, Tooltip, Table…
*(repetir patrón con variantes/estados/accesibilidad)*
```

Eso es una lista de arranque de shadcn/Bootstrap. Mientras tanto la regla de completitud (`SKILL.md:42` y `:124`, *"must cover all reusable components the navigation map implies"*) existe **solo como prosa** y su check es una casilla de honor infalsable. **El ancla estrecha le gana a la regla amplia, siempre.**

**(d) Corolario técnico: los tokens son 100% de nivel primitivo.** No hay capa semántica (`color.bg.surface`, `color.text.on-accent`, `color.border.subtle`, `color.focus.ring`). Eso hace que la regla de hierro de `ux-implementer` — *"todo color/spacing/radius sale de tokens"* — sea **estructuralmente insatisfacible** para superficies, bordes y texto sobre color, y deja el modo oscuro sin forma de expresarse.

### 3.4 Lo que el diseñador externo entrega y el camino propio no puede

CEAgenda produjo **44 archivos** `.reference.md` en 7 grupos, incluyendo un grupo **`domain`** con 12 componentes que ninguna plantilla genérica nombraría jamás: `BloqueSlot`, `CalendarioSemana`, `CupoProgress`, `MatrizPermisos`, `TrazaEvento`… Los 45 se construyeron. Y la profundidad por componente es de otro orden de magnitud: contrato de props levantado del fuente, tabla tipada con defaults, anatomía en tres partes citando clases exactas, composición demo, lista de verificación de tokens, deltas de marca adjudicados. Contra eso, la plantilla le asigna a Button **cinco bullets**.

Psikora aporta el otro lado: categorías de token para las que la plantilla **no tiene casilla** — tintes alpha (`--color-menta-10/15/20`), tokens de dimensión de layout (`--sidebar-width: 244px`, `--drawer-width: 372px`), y colores de estado de dominio (`--status-no-asistio`, `--status-abandono`).

---

## 4. P3 — el usuario ya resolvió esto a mano, dos veces

Esta es la señal más fuerte de toda la investigación.

- **CEAgenda** (`docs/03-ux-ui/handoff/README.md`): *"Espejo parcial (bajo demanda) del proyecto claude.ai/design **"CEAgenda Design System"**, traído vía MCP `DesignSync` a medida que cada componente entra a build (Epic 2.1). Son **referencia de paridad** (React), NO código a compilar."* Incluye un orden de precedencia para fuentes en conflicto y un protocolo de medición nacido de fallos que llegaron al gate visual: extraer la demo del DOM en vez de describirla de memoria (*"Describirla 'a ojo' produjo cinco desviaciones que el usuario detectó de un vistazo"*), leer glifos del atributo `data-lucide`, y corregir `getComputedStyle` por devicePixelRatio (*"un `border-[1.6px]` llegó a producción por saltarse esto"*).
- **Psikora** (`.design-sync/config.json`): una corrida completa del `/design-sync` nativo en dirección **inversa** — código → claude.ai/design — con 40 componentes en `componentSrcMap`, overrides por componente y 8 KB de `NOTES.md`.
- **CEAgenda** (`.claude/skills/ceagenda-design/SKILL.md`): una skill de marca de 40 líneas escrita a mano por el usuario, `user-invocable: true`, que comprime la identidad en un párrafo accionable y luego indexa los archivos autoritativos. Es el **único artefacto en cualquiera de estos proyectos que sirve a la vez mocks desechables y código de producción desde una sola definición de marca**.

> El trabajo del rediseño es en gran medida **promover lo que ya funciona**, no inventar.

---

## 5. El rediseño — Design Track

### 5.1 Estructura

Tres **estaciones** sobre una **espina de artefactos** única, con un **canal** enchufable:

```
                    ┌─ Estación DT-1: DIRECCIÓN ────────────────┐
Fase 01 ─┐          │  brief.md  →  3 direcciones  →  ADR       │
Fase 02 ─┼─ contrato│  (gate de divergencia)                    │
         │          └───────────────────┬───────────────────────┘
         │                              ▼
         │          ┌─ Estación DT-2: SISTEMA ──────────────────┐
         └─ nav map │  tokens (3 capas) · inventario derivado    │
                    │  componentes 1-archivo · elemento firma    │
                    │  (gate de cobertura + lint de tokens)      │
                    └───────────────────┬───────────────────────┘
                                        ▼
                    ┌─ Estación DT-3: SYNC (vive dentro de build)┐
                    │  canal ⇄ espejo por componente · gate visual│
                    └────────────────────────────────────────────┘
```

**La espina** (lo que existe siempre, en todos los canales):

| Archivo | Mitad | Qué lleva |
|---|---|---|
| `docs/03-ux-ui/brief.md` | prosa + bloque legible por máquina | los 15 campos del brief, incluidas **anti-referencias** |
| `docs/03-ux-ui/navigation_map.md` | prosa | igual que hoy (rutas + `operationId`s) |
| `docs/03-ux-ui/design_system.md` | prosa | dirección elegida y rechazadas, principios, **§Firma**, gobernanza + log de deltas |
| `docs/03-ux-ui/components/<Nombre>.md` | prosa | **uno por componente** — contrato de props, anatomía con tokens, estados, composición |
| `docs/03-ux-ui/tokens.yml` | máquina | tres capas: primitivo → semántico → componente, con `hex` + `oklch` |
| `docs/03-ux-ui/inventory.yml` | máquina | roster derivado: `id`, `tier`, `derived_from`, `status` |
| `docs/03-ux-ui/channel.yml` | máquina | coordenadas remotas: canal, `projectId`, URL del artifact, hashes de contenido |

### 5.2 Estación DT-1 — Dirección (el gate que hoy no existe)

**a. Brief.** Cuestionario socrático que produce `brief.md`. Los campos que hoy faltan y que **son** los que producen diferenciación:

1. Posicionamiento — a quién le gana y en qué eje.
2. **3-5 atributos como pares adjetivo/anti-adjetivo** ("cálido no lindo", "preciso no clínico").
3. Objetivo emocional a los 5 segundos y al minuto 30.
4. Referencias anotadas — una lección de diseño por referencia.
5. **ANTI-referencias** — 2-3 productos a los que no debe parecerse, y por qué.
6. Ledger honrar/romper de convenciones de industria (honrar: destructivo=rojo; romper: la única apuesta de diferenciación).
7. **Densidad** (airy-marketing / balanced-product / dense-professional) → fija la base de espaciado y las alturas de control.
8. **Personalidad de motion** (none / functional / expressive) + presupuesto de duración.
9. **Postura tipográfica** (system-only / una display distintiva + texto neutro / totalmente custom) + licencias.
10. Realidad de locale y script (RTL, CJK, cadenas largas en alemán).
11. Piso legal de accesibilidad, activos existentes, longevidad, stance de ilustración/fotografía.

**b. Gate de dirección de arte.** Se generan **exactamente 3 direcciones**, cada una con: nombre · tesis de una frase · pareja tipográfica · hue semilla de paleta · lenguaje de forma · densidad · personalidad de motion · **elemento firma** · referencia madre · **qué sacrifica deliberadamente**.

> **Regla de validez (mecánica):** dos direcciones cualesquiera deben diferir en **≥2** de {pareja tipográfica, familia de hue, lenguaje de forma, densidad}. Tres direcciones que solo cambian el hue de acento **son una sola dirección** — se rechazan y se regeneran.

El usuario elige una (o una + un injerto nombrado de otra). **La elegida y las rechazadas se registran como ADR** en `.specture/decisions/` — ése es el artefacto anti-regresión que los subagentes de contexto restringido heredan en vez de regenerar una mediana.

- **Con canal `claude-design`:** las 3 direcciones se dibujan como artboards en un canvas (un artboard por dirección, el humano hace clic en el ganador). Acelerador, no requisito.
- **Sin canal:** una tabla de 3 filas en Markdown. **El mecanismo es idéntico.**

**c. Elemento firma (deliverable, no juicio).** El sistema debe nombrar **exactamente uno**, presente en **≥3 superficies distintas**, codificado como token o utilidad. Catálogo cerrado para que sea decidible: identidad de radio (radio asimétrico, una esquina cortada) · tratamiento de borde (doble regla, hairline + sombra plana offset, ring interior) · textura de superficie (grano, grilla de puntos) · movimiento tipográfico (numerales sobredimensionados, micro-labels en caps con tracking) · identidad de focus-ring · identidad de trazo de ícono · motivo de ángulo · un acento saturado reservado a exactamente un trabajo. **Ilegales por ser defaults:** "un gradiente", "esquinas redondeadas", "sombras".

**d. Test de intencionalidad.** Cada grupo de token fundacional (hue primario, pareja tipográfica, radio base, base de densidad, duraciones, modelo de elevación) lleva una celda obligatoria **"Por qué este proyecto"**. Racionales rechazados: *"es el default"*, *"limpio y moderno"*, *"accesible"* (la accesibilidad es piso, no razón). Y la pregunta de rechazo en el self-review: *"si quitaras el logo, nombra los 3 productos con los que se confundiría — si puedes nombrar alguno, revisa."*

### 5.3 Estación DT-2 — Sistema

**a. Tokens en tres capas** (componente → semántico → primitivo, referencia unidireccional). Es agnóstico: se expresa igual en CSS vars, theme de Tailwind, `ThemeData` de Flutter y paletas de Angular Material. Es lo que hace mecánicamente posibles el modo oscuro, el theming, la validación de contraste y el lint de tokens.

**b. Derivación de paleta por OKLCH** (aritmética reproducible, no "elige unos hex"):
1. Toma 1-2 hues semilla del brief o de la dirección elegida.
2. Genera la rampa pisando L a incrementos fijos, con croma atenuado en los extremos para no salirse de gamut.
3. **Deriva los neutros desaturando el hue de marca** — un gris entibiado o enfriado es diferenciación gratis, y es exactamente lo que separa un sistema con marca de `bg-slate-*`.
4. Deriva los semánticos (success/warning/error/info) **rotando hue con L y C igualados** a la rampa de marca, para que se lean como familia y no como el rojo/verde/ámbar de Bootstrap.
5. Mapea los tokens semánticos a pasos de la rampa.
6. Computa contraste de cada par semántico y registra pass/fail.

Los pasos 3-4 son la carga de distintividad; 5-6 la de accesibilidad. Se guardan `oklch()` **y** hex, porque los stacks nativos consumen hex.

**c. Derivación mecánica del inventario.** Reemplaza la lista literal. Se apoya en un invariante que Specture **ya** exige: el nav map cita `operationId`s del contrato y nunca inventa URLs. Por pantalla:

- Del auth/rol → AppShell, navegación, afordancia por rol, patrón 401/403, sesión expirada.
- Por cada `operationId`:
  - **GET colección** → List/DataTable/CardGrid + **EmptyState + LoadingSkeleton + ErrorState** + paginación + (si declara query params) filtros/orden/búsqueda + afordancia de acción de fila.
  - **GET único** → layout de detalle + NotFound + Loading + Breadcrumb.
  - **POST/PUT/PATCH** → Form + **un control por propiedad del request body, mapeado por tipo JSON-schema** (`string`→Input; `string+enum`→Select o RadioGroup según cardinalidad; `format:date`→DatePicker; `format:binary`→FileUpload; `maxLength>200`→Textarea; `boolean`→Switch; `integer`→NumberInput; `array of $ref`→Combobox múltiple; objeto anidado→Fieldset) + FormField + mensaje de validación + submit con loading + feedback de éxito + superficie de error de servidor.
  - **DELETE / operación destructiva** → ConfirmDialog + variante destructiva de Button + Toast con undo.
- **Por cada `enum` de cualquier schema que la pantalla toca → un Badge/Status con exactamente una variante por miembro.** *Éste es el paso que hace emerger los componentes de dominio*, y es precisamente donde una lista copiada siempre falla.
- Por cada campo fecha/dinero/cantidad/duración → una primitiva de formato.
- Por cada respuesta no-2xx documentada (409, 422, 429) → un patrón de mensaje.
- **Toda pantalla declara cuatro estados:** vacío, cargando, error, permiso denegado.

**Aserción de cobertura** que reemplaza la casilla de honor: toda frase de "elementos clave" mapea a ≥1 componente inventariado; toda propiedad de request body mapea a ≥1 control; todo enum tiene tratamiento visual; toda pantalla tiene sus 4 estados. **Lo que no mapea, falla la fase.**

**d. Inventario por niveles**, con un mínimo obligatorio en el que importa:

| Nivel | Contenido |
|---|---|
| Foundations | capas de token, grilla, escala tipográfica, iconografía, motion, elevación, densidad, breakpoints, focus |
| Primitives | Button, IconButton, Link, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Slider, Icon, Avatar, Badge, Tooltip, Spinner, Skeleton, ProgressBar, Divider, Kbd, VisuallyHidden |
| Composites | FormField, Form, DataTable, ListItem, Card, Pagination, Tabs, Accordion, Dialog, Drawer, Popover, DropdownMenu, CommandPalette, Toast, Banner, Breadcrumb, Stepper, DatePicker, FileUpload, EmptyState, ErrorState, set de charts |
| **Domain** | **nombrados en el lenguaje ubicuo del proyecto, derivados de enums y schemas.** Gate: **≥1 por agregado mayor del contrato.** Un design system con cero componentes de dominio es genérico por definición. |
| Patterns | AppShell, plantillas por arquetipo de pantalla (lista/detalle/form/dashboard/auth/settings), flujo CRUD, confirmación destructiva, búsqueda+filtro, onboarding, inbox, error boundary + 404 + 500, offline, vista de impresión |

**e. Un archivo por componente** (`components/<Nombre>.md`), con profundidad fija — minado de los 44 `.reference.md` validados de CEAgenda. Hace posible el trabajo y la revisión incrementales, cosa que un documento monolítico no permite.

**f. Las 14 secciones que la plantilla no tiene** y que además son palancas de distintividad (motion, elevación, densidad e ícono son exactamente las dimensiones en que dos productos con la misma paleta siguen viéndose distintos): dirección y principios · capas semántica/componente · **motion** (duraciones, easings, personalidad, `prefers-reduced-motion`) · **elevación** como modelo de capas + regla de que en oscuro la elevación se lee como claridad de superficie · **densidad** · **matriz de estados completa** + token propio de focus-ring · **paleta de data-viz** segura para daltonismo · **iconografía** (una familia, grosor de trazo, relleno vs contorno, `aria-label` obligatorio en icon-only, "sin emoji en slots de ícono") · patrones vacío/cargando/error · **contenido y voz** (principios de tono, capitalización, gramática verb-first en botones, fórmula de mensaje de error, formatos de fecha/número/moneda) · formularios y validación · estrategia responsive (qué cambia estructuralmente en cada breakpoint) · **derivación de modo oscuro** (remapeo semántico, escalera de superficies, reducción de croma — no una inversión) · arquitectura de theming y gobernanza.

**g. Ledger de defaults prohibidos** — el mecanismo anti-genérico **totalmente determinista**, generado en tiempo de diseño y re-chequeado en build por `grep`:

índigo/violeta como primario (`indigo-*`, `violet-*`, `#6366f1`, `#7c3aed`, hue ~255-280) · piloto automático de neutros Tailwind (`bg-slate-*`, `bg-zinc-*`, `bg-gray-*`) · la cadena intacta de Card de shadcn `rounded-lg border bg-card text-card-foreground shadow-sm` · `components.json` con `baseColor: "slate"` sin editar · el combo "default de buen gusto" (crema `#faf8f5` + Instrument Serif/Fraunces + verde salvia) · Inter/Geist/Roboto/Playfair como cara display · texto con gradiente (`bg-clip-text text-transparent`) · glow neón no pedido · `rounded-2xl` uniforme en todo · emoji en slot de ícono · **la franja de borde izquierdo de 3-4px de color, "el tell de IA más confiable que existe"** · hero centrado + grilla de 3 tarjetas + footer CTA.

> **Restricción de corrección, textual:** una violación **no se arregla cambiando `bg-purple-600` por `bg-emerald-700`** — eso es otro default. Se arregla aplicando el color real del proyecto, o preguntando cuál debe ser.

Con escape explícito: un proyecto cuya marca *sí* es índigo lo justifica una vez (`allow:` con racional) y no pelea con el lint para siempre.

### 5.4 Estación DT-3 — Sync (vive dentro de build)

El diseño deja de morir al cerrar la Fase 03. Antes de despachar un epic de frontend, el orquestador verifica integridad del espejo y, si falta o está stale, **trae ese componente** por el canal activo. `ux-implementer` recibe una **rebanada resuelta** (las filas de inventario del epic, los archivos de referencia de esos componentes, y los tokens semánticos que citan) — no el design system entero.

Las reglas de medición que el usuario aprendió a los golpes en CEAgenda se promueven a reglas de framework: **extraer la demo del DOM en vez de describirla de memoria**, leer glifos de `data-lucide`, y **corregir `getComputedStyle` por devicePixelRatio** (a DPR 1.25 un borde de `2px` se reporta como `1.6px`).

### 5.5 Canales

| Canal | Qué hace | Requisitos | Degradación |
|---|---|---|---|
| `specture-native` (**default**) | Specture autora todo; el humano aprueba en `/dev/design-system` | ninguno | — es el piso |
| `claude-design-canvas` | Las 3 direcciones y los mockups se dibujan como artboards `.dc.html`, el humano los edita y guarda, Specture lee de vuelta | ninguna cuenta | cae a tabla Markdown |
| `claude-design-project` | Pull por componente desde un proyecto DS de claude.ai/design; y push del sistema construido vía `/design-sync` | **pull:** `/design-login` + `DesignSync get_file`, *o* el servidor MCP `claude-design` (§2.3b). **push:** auth first-party y **solo React** | cae a `external-handoff` o a `specture-native` |
| `existing-ui` | Ingeniería inversa (hoy `frontend.ui_defined: true`) | — | — |

> **Ya no hay canal de handoff.** Si un usuario llega con un paquete exportado, se trata como material de referencia suelto que alimenta el brief y el inventario — no como una ruta con skill propia. `pencil` (pen.dev) queda fuera por la misma razón y porque es inerte sin un archivo abierto en su editor (§2.5): no se puede guionar desde una skill.

**Regla de degradación, innegociable:** un usuario con cero acceso a Claude Design pierde **un solo paso de una sola estación** (el round-trip de refinamiento visual). Corren sin cambios: el brief, el gate de 3 direcciones, el ADR, la derivación mecánica del inventario y su gate de cobertura, la capa semántica, la derivación OKLCH, la matriz de contraste, el lint de paleta stock, el ledger de defaults prohibidos, el racional obligatorio por decisión, el elemento firma, la skill de marca generada, la aserción de cobertura del showcase, las reglas `R-*` de fidelidad y el gate visual humano. **Nada que arregle P1 puede vivir detrás de una capacidad externa.**

### 5.6 La skill de marca generada

Deliverable de la estación DT-2, modelado sobre el `ceagenda-design/SKILL.md` que el usuario escribió a mano: `.claude/skills/<proyecto>-design/SKILL.md`, `user-invocable: true`, con las reglas de marca duras en un párrafo accionable (hexes exactos, la familia tipográfica y sus pesos permitidos, vocabulario de íconos y grosor, la lista explícita de NUNCA) más el índice de archivos autoritativos, y una bifurcación por intención: artefactos visuales desechables → canvas nativo; código de producción → `ux-implementer` detrás del gate visual.

Es lo que pone la marca **en contexto para cualquier sesión**, no solo dentro del loop de build. Y es el punto de integración natural de P3 que funciona con degradación total: el archivo sirve aunque no haya ningún acceso a Claude Design.

---

## 6. Verificación — qué es determinista y qué es asesor

**Honestidad sobre lo que se puede automatizar** (esto importa: el usuario no debe sobreconfiar en checks que no lo merecen).

### Determinista, sin modelo, sin flake — vale la pena

| Check | Cuándo | Qué asegura |
|---|---|---|
| **Matriz de contraste sobre el archivo de tokens** | **Fase 03, antes de que exista código** | WCAG 2.2: 4.5:1 texto, 3:1 texto grande, 3:1 no-texto, focus ring ≥3:1 contra **ambos** colores adyacentes |
| ~~**Ratio de paleta stock**~~ ⚠️ | Fase 03 | **Degradado a señal, nunca gate — ver §12.2.** Mide procedencia del hex, no genericidad: dos diseños con las mismas tres decisiones estéticas puntúan 95 % y 13 % según copien o mezclen a mano. |
| **Grep del ledger de defaults prohibidos** | Fase 03 + build | los tells literales de IA |
| **Regla de divergencia de direcciones** | Fase 03 | 3 direcciones difieren en ≥2 ejes |
| **Aserción de cobertura del inventario** | Fase 03 | pantallas × operaciones × enums × estados ⊆ inventario |
| **Lint de tokens** | build | hex crudo, `rgb()`, px crudo en style props, valores arbitrarios del framework |
| **Cobertura del showcase por DOM** | build | marcar `/dev/design-system` con `data-ds-component/variant/state` y aserir por Playwright que el set renderizado **iguala** el inventario derivado |
| **Geometría computada de a11y** | build | `boundingBox ≥ 24×24 px` (SC 2.5.8), `:focus-visible` visible con ≥3:1 — **números, no imágenes** |
| axe-core | build | piso de a11y (captura solo una fracción; es piso, no prueba) |

### Asesor o teatro — con límites explícitos

- **Crítica de screenshots por VLM: solo asesora, nunca aprueba.** Medición: 52% de sugerencias precisas, precisión 0.603 vs 0.829 humana; los expertos humanos encontraron el **62% de las violaciones que el modelo omitió**, mientras el modelo encontró únicamente el 9% que ellos omitieron. Y **degrada por ronda**: 52% de precisión en la ronda 1, 39% en las últimas. Su **peor categoría medida es "Aesthetic and Minimalist Design"** — exactamente la pregunta de P1.
  - ⇒ **Una sola pasada**, restringida a sus bandas fuertes (alineación, espaciado, contraste, consistencia, copy), cada hallazgo citando un token o regla concreta del design system, **prohibido juzgar estética y prohibido gatear**. Nada de bucles auto-crítica-y-arregla: la calidad cae por ronda y el modelo converge a sus propios priors, que **son la media** — un bucle automático *recrea* P1.
  - La regla actual de Specture (*"Claude nunca autocertifica calidad visual"*) es **correcta** y sobrevive intacta.
- **Pixel diff: protección de regresión, no oráculo de intención.** Compara contra una baseline; en el camino nativo no hay imagen de intención, solo prosa. La baseline legítima es **la captura en el momento exacto de la aprobación humana**.
- **Un "score de fidelidad %" es teatro.** La fidelidad de handoff se mide con **aserciones discretas de estilo computado** ("radio del botón primario = 2px", "alto de nav = 56px"), cada una verificable por separado.
- **No codificar APCA.** Fue retirado del working draft de WCAG 3 y no tiene respaldo legal; ADA, Section 508, EN 301 549 y la EAA apuntan todos a WCAG 2.x.

---

## 7. Qué se elimina

> **Decisión tomada (2026-09-08):** el handoff se retira **por completo** — la skill, la carpeta, los artefactos y el concepto. No queda stub de alias. Razón: el formato de exportación al que estaba clavado cambió tres veces en cuatro meses (§2.4) y ninguno de los dos canales vivos lo necesita. Esto cierra la decisión D2.

**Borrado:**

- `skills/handoff-ingest/` → **la skill entera**, y con ella el comando `/specture:handoff-ingest`.
- `docs/03-ux-ui/handoff-mapping.md` → el mapeo pantalla → ruta → operación pasa a `inventory.yml`, donde es legible por máquina.
- `docs/03-ux-ui/handoff/` → el espejo por proyecto. Lo reemplaza `components/<Nombre>.md`, uno por componente, dentro de la espina.
- `docs/03-ux-ui/fidelity-checklist.md` → se disuelve en **`.specture/rules.yml`** con tag `frontend` + tags de componente. El coordinador de build inyecta solo las reglas aplicables y la Dimensión 7 del reviewer las exige por ID — estrictamente mejor que un checklist que viaja entero o no viaja.
- `docs/03-ux-ui/design_specs_for_ai.md` → el brief para una IA de diseño externa. Con el canvas nativo, la IA de diseño ya está dentro de la sesión.
- **Ruta 1 / Ruta 2** en `ux-design` → la asimetría desaparece: hay una sola espina, y el canal es otra cosa.
- La lista literal de componentes en `SKILL.md:100` y `:111`, y el heading `### Card, Modal, Toast, …` de la plantilla → son la causa medible de P1.
- Las filas de `handoff-ingest` en `CLAUDE.md`, `README.md` (×3), `skills/start/SKILL.md` y `copilot/compatibility-matrix.json`. **El acoplamiento de `skills[]` con el listado del directorio está verificado por test** (`copilot-plugin-contract.test.js:70-75` hace `deepEqual`), así que la eliminación no puede quedar a medias o `npm test` falla.

**Lo único que sobrevive del handoff** es la regla que valía: cuando el stack destino no coincide con el del material de referencia, lo honesto es prometer *paridad visual y de tokens*, no copia de código. Deja de ser un modo de skill y pasa a ser regla del adaptador de canal — que es como el usuario ya trabaja (los `.jsx` del proyecto DS de CEAgenda son referencia de paridad para una app Angular).

**Se conserva:** `skills/ux-design/` como **stub de alias** al Design Track (patrón `learn` / `audit-knowledge`), porque su comando sí se usa y su nombre sigue describiendo la fase.

`docs/ui-design-flow-analysis.md` se marca como **superado** con puntero aquí; se conserva porque su Nivel 1 (contrato de API) sigue vigente y es la razón por la que la derivación de inventario es posible.

**Balance neto de skills: −1.** Una skill nueva (`design-track`), una reducida a stub (`ux-design`), una eliminada (`handoff-ingest`).

---

## 8. Plan por etapas

Ordenado para que **la primera etapa arregle la queja más fuerte** y sea shippable sola.

| Etapa | Objetivo | Entregables | Verificación |
|---|---|---|---|
| **E0 — Baseline RED** | Evidencia, como exige el repo | `docs/frontend-design-baseline.md`: correr hoy la Ruta 2 en un subagente sobre un fixture y capturar el design system débil verbatim; `scripts/baseline-fixture.js --stage 4` | El documento reproduce la queja P1 |
| **E1 — Dirección y brief** *(el arreglo de P1)* | Forzar la decisión estética | `BRAND_BRIEF_TEMPLATE.md`; gate de 3 direcciones + regla de divergencia; ADR de dirección; test de intencionalidad; elemento firma; ledger de defaults prohibidos | `scripts/design-lint.js directions` + `banned`; baseline GREEN |
| **E2 — Sistema como espina** | Que el sistema deje de ser un doc pobre | `DESIGN_SYSTEM_TEMPLATE.md` reescrita (14 secciones + capa semántica + gobernanza); `tokens.yml`; `COMPONENT_REFERENCE_TEMPLATE.md`; helper OKLCH + matriz de contraste; lint de paleta stock | `scripts/design-lint.js contrast|palette`; tests unitarios de la aritmética |
| **E3 — Inventario derivado** | Matar la lista copiada | `scripts/design-inventory.js` (nav map × contrato); `inventory.yml`; gate de cobertura; niveles con mínimo de dominio | tests contra fixture: colección→quinteto, enum→variantes de Badge, DELETE→ConfirmDialog |
| **E4 — Canales** | P2 + P3 | `skills/design-track/` + `CHANNELS.md`; detección de forma del handoff; adaptador canvas; adaptador `DesignSync` pull/push; `channel.yml`; stubs de alias | ingesta de los 3 handoffs reales del usuario sin fallar |
| **E5 — Build vivo** | El diseño no muere en Fase 03 | `SYNC.md`; rebanada resuelta a `ux-implementer`; marcadores `data-ds-*` + aserción de cobertura; lint de tokens en Dimensión 6; reglas `R-*`; baseline visual en el momento de aprobación | showcase DOM = inventario |
| **E6 — Plumbing** | Que sea un release de verdad | grupo `design` en el doctor; migraciones; settings; mirrors de Copilot; Milestone 7 en el roadmap; documentación | `npm test` verde, `npm run schema:sync`, `npm run mirrors:sync` |

**E1 sola ya cambia el resultado**: RedContención prueba que forzar el razonamiento sobre audiencia y sobre *qué evita la paleta* pasa de 5% a 100% de color propio, sin ninguna herramienta externa.

---

## 9. Workstream de documentación (qué cambia para el usuario del framework)

Requerido, no opcional. El repo lo exige mecánicamente en algunos puntos:

- **`README.md` — seis lugares**, uno de ellos verificado por test (`release-contract.test.js:38-43` falla la build sin entrada de changelog): árbol del framework (~línea 195), tabla de fases (246-274), bloque `#### /specture:design-track` en Referencia de Comandos (~400-420), árbol de `docs/` del proyecto (531-556), tabla de agentes, y entrada `### v1.20.0`.
- **`CLAUDE.md`** — la tabla de Quick command reference colapsa dos filas en una: *"Diseño de frontend, con o sin herramienta externa"* → `design-track`.
- **`skills/start/SKILL.md`** — el router; y si necesita leer un segundo campo de `stack.yml`, hay que **enmendar explícitamente** su regla de costo de la línea 20, que hoy prohíbe leer más que `frontend.framework`.
- **`skills/doctor/SKILL.md`** — una fila por migración en la tabla del catálogo (líneas 59-80). Es la **única** explicación humana de qué hace cada id.
- **`copilot/compatibility-matrix.json`** — `skills[]` alfabético (**acoplamiento obligatorio**, `copilot-plugin-contract.test.js:70-75` hace `deepEqual` contra el listado del directorio) y `gates[]` para paridad.
- **`scripts/copilot-mirrors.js`** — **crítico:** en cuanto un `AGENT.md` mencione `DesignSync`, la skill `design` nativa, Artifact o el MCP pencil, hay que añadir entradas a `SUBSTITUTIONS` en el **mismo commit**, o el mirror de Copilot enviará instrucciones exclusivas de Claude a una plataforma que no las tiene. Los mirrors se regeneran en silencio y ningún test detecta el desajuste semántico.
- **Guía de usuario**: cada campo nuevo del brief con **una respuesta de ejemplo y una respuesta rechazada**; qué falla cada gate nuevo y cómo desbloquearlo; cómo anular deliberadamente una entrada del ledger; **qué checks son deterministas y cuáles asesores**, para que nadie sobreconfíe en la pasada VLM.
- **Nota de migración** para proyectos cuyo `design_system.md` es anterior a la capa semántica (backfill perezoso, patrón del ítem 38).

---

## 10. Límites honestos

- **La conversión entre frameworks nunca es pixel-perfect automática.** "Al pie de la letra" es literal solo si el stack destino coincide con el del handoff; si difiere, lo honesto es prometer paridad visual y de tokens, confirmada en el gate humano.
- **El round-trip del canvas tiene techo.** Specture empuja HTML estático estilizado, no componentes vivos. Un usuario que refina mucho en el canvas está refinando el *render* de Specture, no el sistema; los tokens no se actualizan solos desde ediciones visuales arbitrarias.
- **`/design import` (herramienta `ClaudeDesign`) está apagado y no es activable por el usuario** — flag de Statsig evaluado en servidor, sin clave de settings, sin env var, sin versión posterior a la que subir. Si el flag se enciende algún día, es el camino de bajada más limpio; hasta entonces se modela como upgrade detectable, no como dependencia. **La alternativa soportada es el servidor MCP `claude-design` (§2.3b), cuyo inventario de herramientas Anthropic no publica** — hay que confirmarlo tras autenticar antes de que el canal dependa de él.
- **`/design-sync` es solo React.** Rompe la agnosticidad; por eso es opt-in según `stack.yml`.
- **Escrituras a claude.ai/design no pueden salir de la sesión principal.** El permiso durable no se puede emitir desde un subagente, plan mode ni sesión no interactiva. Es una restricción real sobre la arquitectura de despacho de Specture.
- **La derivación del inventario depende de la riqueza del contrato.** Enums, formats, `maxLength`, `required` y respuestas no-2xx documentadas son lo que produce componentes de dominio. Un contrato pobre de Fase 2 degrada la derivación — debe reportarse como *"contrato demasiado delgado para derivar"* y escalar a Fase 2, no degradar en silencio.
- **Los stacks no-web pierden buena parte de la verificación.** Flutter y nativo no tienen stylelint, ni showcase marcado por DOM, ni geometría por Playwright. Les queda un set degradado pero real: golden tests del showcase + aritmética de contraste sobre el archivo de tokens.
- **Librerías UI muy opinadas** (Angular Material, Vuetify, PrimeNG) tienen defaults a veces genuinamente inanulables. El elemento firma y la regla token-only pueden ser insatisfacibles ahí; hace falta un concepto de "presupuesto de override de librería".
- **El lint de paleta stock dará falsos positivos.** Un proyecto cuya marca *es* teal de Tailwind no está haciendo nada mal. Por eso el escape con racional obligatorio existe.
- **Fatiga de gates.** Esto añade tres gates mecánicos y uno humano a una fase que tenía una casilla de self-review. Si el gate de cobertura bloquea por componentes legítimamente diferidos, los usuarios aprenderán a marcar todo como `deferred` y el gate muere. El estado `deferred` necesita ser visible y contable, no una escotilla silenciosa.
- **Acoplamiento a un producto externo.** El set de métodos de `DesignSync`, la convención `@dsCard` y los topes de 256 KiB / 256 archivos se leyeron del binario actual. Pueden cambiar. Por eso el canal se aísla en un adaptador y no se filtra al resto del track.

---

## 11. Decisiones abiertas

Sin estas, la implementación puede tomar dos formas materialmente distintas.

**D1 — Alcance de la primera entrega.** ¿E1+E2+E3 (arreglar P1, sin canales, sin tocar `handoff-ingest`) como v1.20.0 y los canales en v1.21.0? ¿O el Milestone 7 completo de una? *Recomendación: partir.* E1-E3 no depende de nada externo, arregla la queja más fuerte, y es la mitad del riesgo.

**D2 — Topología de skills. → RESUELTA (2026-09-08).** `handoff-ingest` se **elimina por completo** (skill, comando, artefactos y concepto); `ux-design` queda como stub de alias al Design Track. Ver §7.

**D3 — Dirección primaria del canal.** El usuario corre **las dos en producción hoy**: CEAgenda es design-first (pull por componente desde claude.ai/design) y Psikora es code-first (push del sistema construido). ¿Cuál es el default del framework? *Recomendación: design-first como default cuando hay canal, con el push como paso de cierre del epic de fundación* — así el proyecto DS refleja el código real y todo mockup posterior nace on-brand.

**D4 — `design.channel` como enum vs pares de booleanos.** `settings.yml` está modelado en booleanos; un enum parsea pero `effectiveValues()` lo descarta bajo `profile: lean|full` salvo que se caso-especialice como `docs_index.max_entries_per_dispatch`. *Recomendación: booleanos* (`design.claude_design.enabled`, `design.pencil.enabled`) — entran sin código nuevo y heredan la semántica de perfiles, con `context7.enabled` como precedente exacto de capacidad externa opcional.

**D5 — ¿El gate de cobertura bloquea o reporta?** Bloquear arriesga trabar por componentes legítimamente diferidos; reportar arriesga ser ignorado — que es **exactamente cómo falla hoy** `SKILL.md:124`. *Recomendación: bloquea, con `status: deferred` explícito, contable y visible en el doctor.*

**D6 — ¿Requerir o vendorizar el plugin oficial `frontend-design`?** Está cacheado en el marketplace del usuario pero **no habilitado**, y trae la lista de tells de slop mantenida por Anthropic. Requerirlo importa guía mantenida gratis pero añade dependencia dura; vendorizarlo duplica contenido que Anthropic seguirá actualizando.

**D8 — ¿Cómo se mide la genericidad, ahora que sabemos que el ratio de paleta stock no la mide?** (§12.2) La medición tiene que ser sobre *ejes de decisión*, no sobre valores: familia de hue del primario, si los neutros están teñidos con el hue de marca o son grises puros, si la display es una de las caras por defecto, si el radio es uniforme. *Recomendación: prototiparlo contra los 5 proyectos reales antes de escribir ninguna línea de gate* — el corpus ya existe y es el único set de calibración honesto que hay.

**D9 — ¿Se repite el baseline antes de construir?** (§12.6) El RED es n=1 con tres defectos de método conocidos. *Recomendación: sí, 2-3 corridas en sonnet con prompt neutro.* Es barato, y decide si E3 sigue justificado por completitud o solo por el argumento de Code Surface.

**D7 — ¿Dónde viven las coordenadas remotas?** Un `projectId` de claude.ai/design o una URL de Artifact no son rutas locales, y el `broken-path` del corpus lint del doctor es **ERROR**. Opciones: `.specture/design.yml` (archivo nuevo del framework, migración mecánica al estilo de `1.19-rules-file.js`), un campo en `stack.yml`, o front-matter en `design_system.md`.

---

## 12. Revisión adversarial (2026-09-08)

> Las seis críticas del workflow que produjo este documento **murieron por límite de sesión**, así que su cuerpo nunca pasó por revisión. Esta sección es esa revisión, hecha contra el código real y contra una medición. Corrige §3 y §6, invalida tres propuestas de §5, y encuentra un bug vivo que el documento daba por sano.

### 12.1 El baseline RED contradice la mitad del diagnóstico de P1

Se corrió la skill `ux-design` **actual, sin modificar**, sobre un proyecto limpio con frontend declarado y `docs/03-ux-ui/` vacío — la misma condición de partida de MiEmpleadApp. Resultado:

| | MiEmpleadApp (la evidencia de §3.1) | El run RED |
|---|---|---|
| `design_system.md` | 211 líneas | **412 líneas** |
| Componentes especificados | — | **21**, incluidos `FileDropzone`, `TagChip`, `ErrorState`, `Skeleton` |
| Pares de contraste calculados | ninguno | **22**, con ratios y una lista de pares rechazados |
| Gaps de contrato | — | **7 registrados** (G-01…G-07) en vez de inventar endpoints |
| Hex propios | 1 de 20 (**5 %**) | 33 de 38 (**87 %**) |

Además emitió una tabla de trazabilidad componente→pantalla y una lista de omisiones deliberadas con sus razones, para que las ausencias fueran auditables.

**Conclusión: la mitad "pocos componentes, documento pobre" de P1 no se reprodujo.** La afirmación de §3.3(c) —que el `### Card, Modal, Toast, …` de la plantilla pone techo al inventario— **queda sin confirmar**. Con esta condición, el ancla no ganó.

### 12.2 El medidor de paleta stock está roto, y era candidato a gate

Lo que sí reveló la medición es un fallo en la métrica que §6 proponía como check determinista. Las tres decisiones de fondo de cada diseño:

| | MiEmpleadApp | El run RED |
|---|---|---|
| Primario | `#0D9488` — teal-600 | `#0F766E` — **teal-700** |
| Neutros | escala `slate` literal | slate-azulado mezclado a mano |
| Tipografía | Inter | Inter |

**Son el mismo diseño.** Uno copió los hex de Tailwind; el otro mezcló una rampa alrededor del teal-700 de Tailwind. La métrica les da 95 % y 13 %.

Mide **procedencia del hex, no genericidad**. Premia mezclar a mano y deja pasar la convergencia estética, que es el problema real. Como gate sería peor que inútil: enseñaría a esquivarlo desplazando un dígito.

Queda degradado a **señal de advertencia**, nunca bloqueante. Y queda abierta la pregunta de cómo medir genericidad de verdad — probablemente sobre los *ejes* (familia de hue del primario, si los neutros están teñidos con el hue de marca, si la display es una de las caras por defecto), no sobre los valores.

### 12.3 Lo que sí se reprodujo, y por qué el argumento del brief cambia

El agente escribió, sin que se le preguntara:

> *"No logo, palette, tone, or visual references exist in the project."*
> *"Palette and fonts are mine… these are the likeliest things the user will want to change at the Phase 4 visual gate."*

Inventó la marca porque **nada la captura**, y lo sabe. Eso confirma el hueco, pero el argumento correcto para el brief y el gate de dirección **no es "el output es genérico"** — es **"la marca no se captura y el agente la suple con su propio gusto"**. Es un argumento más débil de vender pero más honesto, y sigue justificando E1 entero.

### 12.4 Un bug vivo: el gate visual (G4) no puede dispararse

El documento apoya toda su disciplina de frontend en la aprobación humana. **Hoy esa aprobación no puede ocurrir.**

- El gate vive en `EPIC_LOOP.md:45-49`, el archivo que recibe el **epic-agent** — un subagente no interactivo.
- Su vocabulario de reporte es `DONE | BLOCKED | REJECTED_MAJOR`. No existe `AWAITING_APPROVAL`.
- `build/SKILL.md:316` exige: *"If DONE: update ROADMAP.md to [x] … BEFORE reporting"* — justo lo que `EPIC_LOOP.md:48` prohíbe hacer antes de la aprobación.
- La lista de contactos humanos sancionados del coordinador (`SKILL.md:258-261`) **no lo incluye**, bajo un encabezado que afirma que un epic sin dudas corre hasta `[x]` sin interrupción.

Y es **el único gate de Specture sin artefacto durable**: los demás dejan `MECH_CHECK: PASS <sha>`, `SPEC_SHA`, `build-locked.json`, `review-*.md`. Éste deja una pregunta en español en un chat.

Repararlo tiene un efecto de segundo orden valioso: con un registro de aprobación, el "design system primero" se puede hacer **mecánico** en `spec-set-check.js`, simétrico al check C1-consume que ya hace mecánico el "página después de su backend" (`:133-141`).

### 12.5 Hallazgos de viabilidad que invalidan propuestas de §5

| Propuesta de §5 | Veredicto |
|---|---|
| `tokens.yml` con árbol de tres capas | **Inviable.** El repo es cero-dependencias por invariante (declarado en `settings.js:9`, `rules.js:10`, `project.js:156`, `bump-version.js:10`): sin `dependencies`, sin lockfile. Y `parseSettingsYaml` hace `.trim()` antes de comparar — el anidamiento **no falla, colisiona claves en silencio**. |
| `inventory.yml`, `channel.yml` | Sobreviven solo si son planos. `channel.yml` es innecesario: sus coordenadas caben como claves planas en `settings.yml`. |
| Derivación mecánica del inventario desde el contrato | **Sin fuente.** El compañero legible lleva los enums en una celda de texto libre `Notas`, los tipos del request body a un salto y solo si el DTO se expandió, y ninguna columna de `format`. El único precedente de lectura del contrato (`migrations/lib.js:54-76`) devuelve ids con `method` y `path` **vacíos**. Y `navigation_map.md` tiene **dos formas incompatibles conviviendo hoy** (plantilla vs fixture), sin plantilla canónica ni check. Un derivador emitiría inventarios vacíos **en silencio** — el peor fallo para un gate que debe hacer fallar la fase. |
| Matemática OKLCH en `scripts/` | Viable pero desproporcionada: sería el código numérico más pesado del repo por ~10×. El inventario matemático existente entero es `Math.max` para anchos de columna y `Math.round` para una media. La aritmética de contraste sí es pequeña y bien especificada; la **generación** de rampas puede quedarse en prosa. |

Dos hallazgos que **refuerzan** el documento en vez de debilitarlo:

- **El inventario tiene una justificación mejor que la que se le daba.** El sello de Code Surface exige enumerar cada componente como `Crea:` con firma (`SPEC_TEMPLATE.md:58-64`), y lo autora un `spec-planner` que tiene **prohibido leer código**, recibe **tres líneas** de condicionales de frontend (`spec-planner/AGENT.md:59-61`) y no tiene fila de cobertura para componentes ni tokens — C1 y C2 se omiten los dos en un epic de design system. El inventario no es completitud documental: es el input que le falta al planner. Este argumento es independiente de §12.1 y sobrevive intacto.
- **Specture se exige menos a sí mismo que a la herramienta que quiere reemplazar.** `ux-design/SKILL.md:100` le pide a la IA externa diez componentes *más los de dominio*, con variantes, estados y accesibilidad; `:111` le pide **cinco** al deliverable propio. Arreglo de una línea.

Colateral, todo verificado: el dispatch de `EPIC_LOOP.md:43` omite inputs que el Step 0 de `ux-implementer` exige (lectura literal → `NEEDS_CONTEXT`); y hay tres referencias muertas a una sección `build/SKILL.md` "Modo: Frontend" que ya no existe (`architecture/SKILL.md:118`, `ux-design/SKILL.md:69`, `handoff-ingest/SKILL.md:8`) más `README.md:940`.

Y una restricción de migración que el documento no contemplaba: `skills/start/SKILL.md:71` usa exactamente `navigation_map.md` + `design_system.md` como predicado de "Fase 3 completa". Añadir `brief.md` al predicado **devuelve los 5 proyectos existentes a "Fase 3 incompleta"** de golpe.

### 12.6 Los fallos de método del propio experimento

El RED de §12.1 es **n=1**, igual que la evidencia de §3.1 que contradice. Tres defectos, todos del diseño del experimento:

1. **Corrió en Opus**, heredado de la sesión. `ux-implementer` está declarado `model: sonnet`; un modelo más fuerte produce menos default con las mismas instrucciones.
2. **Se le pidió enumerar todos los hex.** Pedir eso pudo inducir más cuidado con el color — efecto observador.
3. **El prompt era más exigente que la realidad**: "sigue la skill exactamente", "respeta el HARD-GATE". Una sesión real entra por el router con mucho menos énfasis.

**Antes de construir sobre §12.1 hay que repetirlo bien**: 2-3 corridas en sonnet, prompt neutro, entrada por el router. Es barato y es la diferencia entre ingeniería y adivinar.

### 12.7 Balance

| Propuesta | Estado tras la revisión |
|---|---|
| Brief de marca + gate de 3 direcciones + ADR | **Sobrevive**, con argumento corregido (§12.3) |
| Elemento firma, test de intencionalidad, ledger de defaults prohibidos | **Sobrevive** — el ledger es el único mecanismo anti-genérico plenamente determinista |
| Reescritura de la plantilla (14 secciones, capa semántica) | **Sobrevive** |
| Un archivo por componente | **Sobrevive** |
| Eliminar `handoff-ingest` | **Sobrevive** — tres formatos en cuatro meses, ningún canal vivo lo necesita |
| Reglas de marca → `rules.yml` | **Sobrevive** (caben: son de una línea, ≤240 caracteres) |
| Inventario derivado | **Sobrevive con otro argumento** (Code Surface, §12.5), no con el de completitud |
| Los tres archivos `.yml` | **Caen.** Tablas markdown con gramática prescrita + claves planas en `settings.yml` |
| Derivación mecánica desde el contrato | **Cae.** El script debe **verificar**, no derivar |
| Ratio de paleta stock como gate | **Cae** a señal (§12.2) |
| Generación OKLCH en el framework | **Aparcada.** Contraste sí; rampas en prosa |
| Reparar G4 | **Nuevo, y probablemente lo más valioso del conjunto** (§12.4) |

---

## Apéndice — trazabilidad de la evidencia

| Afirmación | Fuente |
|---|---|
| 19/20 hex stock en Ruta 2 pura | `C:\Proyectos\MiEmpleadApp\docs\03-ux-ui\design_system.md` §2.1-2.3, contrastado con la paleta Tailwind v3 |
| 100% custom sin herramienta externa | `C:\Proyectos\RedContencionPsicologicaEmergencia\docs\03-ux-ui\design_system.md` §1 |
| 44 componentes con 12 de dominio | `C:\Proyectos\CEAgenda\docs\03-ux-ui\handoff\components\**\*.reference.md` |
| Tres formas de handoff en cuatro meses | `Psikora-handoff/` (en disco), `Splity/docs/03-ux-ui/design_system.md:9-13`, `CEAgenda/docs/03-ux-ui/handoff/README.md` |
| Cero integración nativa | `grep -r "DesignSync\|dc\.html\|claude\.ai/design\|design-sync" C:\Proyectos\VibeCoding` → 0 hits |
| Skill `design`, `seed-canvas.mjs`, round-trip | extracción del binario `~/.local/share/claude/versions/2.1.263` |
| `ClaudeDesign` apagado por `tengu_omelette_fouet` | mismo binario + `ToolSearch(select:ClaudeDesign)` → sin resultados |
| Handoff sigue existiendo | `academy.claude.com/tutorials/using-claude-design-for-prototypes-and-ux`; `support.claude.com/en/articles/14604416`; `anthropic.com/news/claude-design-anthropic-labs` |
| VLM 52% preciso, peor en estética | `arxiv.org/html/2403.13139` (evaluado por 12 diseñadores expertos sobre 51 UIs) |
| Tells de slop de IA | plugin oficial `frontend-design` (cacheado, no habilitado); `claudecodehq.com/playbooks/unslop-ui` |
| OKLCH, DTCG, WCAG 2.2 | `evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl`; `w3.org/community/design-tokens` (v1 estable 2025-10-28); `w3.org/TR/WCAG22/` |
| Plumbing (manifests, migraciones, mirrors) | `scripts/schema-manifest.js:52-66`, `migrations/index.js:1-10`, `scripts/copilot-mirrors.js:24-32,98-106`, `copilot-plugin-contract.test.js:70-75`, `hooks/lib/settings.js:17-41` |
| **§12.1 — baseline RED: 412 líneas, 21 componentes, 87 % hex propios** | corrida de la skill `ux-design` sin modificar sobre un proyecto limpio, 2026-09-08. Medición de paleta contra `tailwindcss@3.4.17` extraído de una instalación real, no de memoria |
| **§12.2 — mismo diseño, 95 % vs 13 %** | `primary.500 = #0F766E` (= teal-700) en el run RED vs `#0D9488` (= teal-600) en MiEmpleadApp; neutros slate e Inter en ambos |
| **§12.4 — G4 no puede dispararse** | `EPIC_LOOP.md:45-49` vs `build/SKILL.md:308-316` y `:258-261` |
| **§12.5 — cero dependencias es invariante** | `hooks/lib/settings.js:9`, `hooks/lib/rules.js:10`, `hooks/lib/doctor/project.js:156`, `scripts/bump-version.js:10`; `package.json` sin `dependencies` ni lockfile |
| **§12.5 — sin fuente para derivar el inventario** | `migrations/lib.js:54-76` (ids con `method`/`path` vacíos); `templates/API_CONTRACT_TEMPLATE.md` §2 (enums en celda `Notas`); plantilla vs fixture de `navigation_map.md` |
| **§12.5 — el planner no puede enumerar la superficie** | `SPEC_TEMPLATE.md:58-64`, `agents/spec-planner/AGENT.md:29-38` y `:59-61`, `hooks/lib/spec-set-check.js:208-213` |
| **§12.5 — Specture se exige menos que a la IA externa** | `skills/ux-design/SKILL.md:100` vs `:111` |
