# Baseline de la Fase 03 — medición previa al rediseño de frontend

> **Estado:** medición · **Fecha:** 2026-09-11 · **Versión objetivo:** v2.0.0
>
> El repo persiste cada RED con sus números verbatim (`spec-planning-baseline.md`,
> `spec-planning-baseline-stage2.md`, `knowledge-reconcile-baseline.md`). La medición que motivó
> el rediseño de frontend era la única que no seguía esa convención: sus cifras vivían en una celda
> de tabla de un documento de propuesta, sin fixture regenerable y sin forma de re-puntuarlas. Este
> documento la reemplaza con lo que sí se midió y se puede repetir.
>
> Corpus: los cinco proyectos con `.specture/` en `C:/Proyectos`. Es un muestreo de conveniencia,
> no un experimento controlado — ver §4.

---

## 1. Qué se midió y qué decidió cada medición

| Medición | Resultado | Decisión |
|---|---|---|
| Tipografía de fábrica como tell suelto | Dispara en MiEmpleadApp, **CEAgenda y Splity** | La entrada suelta **no se escribe**: reprobaría al ejemplar de mayor calidad del corpus |
| Genericidad por ejes de color | **No separa las clases** | **D8 se cierra como "no medir"** — no hay gate de genericidad, ni siquiera como señal |
| Ledger de defaults sobre `design_system.md` | 0 verdaderos positivos, 2 falsos positivos | El ledger **no corre sobre el documento**: sus tells son artefactos de código |
| Ledger de defaults sobre **código** | Volumen real, pero mide otra cosa | Se reencuadra como **adherencia a tokens**, WARNING, nunca gate |
| Aritmética de contraste | Determinista, sin calibración necesaria | **Ships como gate bloqueante**, con piso de pares obligatorios |

---

## 2. La medición de genericidad que falló

Se prototipó la medida que D8 proponía —ejes de decisión: familia de hue del primario, croma de
los neutros, desviación de hue entre neutros y marca— sobre los cinco `design_system.md`:

```
MiEmpleadApp   primario #7c3aed (h293)  neutros C=0.0365 h258  Δhue=35   → TEÑIDO CON LA MARCA
CEAgenda       primario #ef4444 (h25)   neutros C=0.0363 h257  Δhue=128  → TINTE PRESTADO
Splity         primario #1d4ed8 (h264)  neutros C=0.0379 h258  Δhue=7    → TEÑIDO CON LA MARCA
RedContención  primario #d6553c (h33)   neutros C=0.0361 h218  Δhue=175  → TINTE PRESTADO
Psikora        primario #ef4444 (h25)   neutros C=0.0235 h259  Δhue=126  → TINTE PRESTADO
```

**Los veredictos están invertidos respecto de la calidad conocida de cada proyecto**, y la causa
es identificable: el detector elige como "primario" el hex cromático más saturado, y eso no es el
primario de marca.

- En MiEmpleadApp eligió `#7C3AED`, que es `cal.festivo` — el morado de días festivos, un token
  **de dominio** con racional propio (`design_system.md:51`). El primario real es `#0D9488`
  (`:20`).
- En CEAgenda, RedContención y Psikora eligió el rojo de error (`#ef4444`, `#d6553c`).

**El rol vive en el nombre del token, no en el valor.** Una pasada ciega al rol sobre una lista de
hex no puede distinguir un primario de marca de un color de dominio, y por tanto no puede medir
genericidad. Se descarta la medida entera, no se ajusta el umbral.

**Consecuencia directa sobre el ledger:** la entrada que prohíbe índigo/violeta debe grepear
**con rol** —`#7c3aed` en la fila cuyo token es `color.primary.*`— y su escape debe llevar rol
(`allow: violet in cal.*`). Un escape por valor blanquearía `#7C3AED` también como primario, y
dejaría al proyecto ciego justo al caso que la entrada existía para atrapar.

---

## 3. Calibración del ledger de defaults prohibidos

### 3.1 Sobre `design_system.md` — no sirve

Las diez entradas literales del diseño, probadas sobre los cinco documentos:

| Entrada | MiEmpleadApp | CEAgenda | Splity | RedContención | Psikora | Veredicto |
|---|---|---|---|---|---|---|
| primary índigo/violeta (con rol) | · | · | · | · | · | no dispara |
| neutros de fábrica | · | · | · | · | · | no dispara |
| cadena Card de shadcn | · | · | · | · | · | no dispara |
| `baseColor: "slate"` | · | · | · | · | · | no dispara |
| texto con gradiente | · | · | · | · | · | no dispara |
| `rounded-2xl` | · | · | · | · | · | no dispara |
| emoji en slot de ícono | · | · | · | · | · | no dispara |
| franja de borde izquierdo | · | · | · | · | **SÍ** | **falso positivo** |
| display de fábrica (suelta) | SÍ | **SÍ** | **SÍ** | · | · | **falso positivo** |
| display de fábrica (conjunción) | · | · | · | · | · | no dispara |

**Nueve de diez entradas nunca disparan; las dos que disparan son falsos positivos; y el ledger no
caza a MiEmpleadApp —el proyecto con 20/20 hex de fábrica— en ninguna entrada.**

La razón es estructural: los tells son artefactos de **clases CSS** (`bg-slate-500`,
`rounded-2xl`, `bg-clip-text`), y un `design_system.md` es un documento de especificación que
nombra tokens y valores hex, no utilidades. El ledger se diseñó para grepear código y el documento
lo apuntaba a prosa.

### 3.2 Sobre el código — sí sirve, pero mide otra cosa

Los mismos tells sobre el código de UI real (`.tsx/.jsx/.vue/.blade.php`, sin `node_modules`):

| Tell | MiEmpleadApp | Psikora | RedContención | CEAgenda |
|---|---|---|---|---|
| neutros de fábrica | 12 | **196** | 1 | 0 |
| `rounded-2xl` | 0 | 8 | 0 | 0 |
| índigo/violeta | 0 | 0 | 0 | 0 |
| cadena Card de shadcn | 0 | 0 | 0 | 0 |
| texto con gradiente | 0 | 4 | 0 | 0 |
| franja de borde izquierdo | 0 | 8 | 1 | 0 |

Sólo la entrada de neutros tiene volumen. Y lo que detecta **no es genericidad**: Psikora tiene una
paleta propia y aun así usa la escala de fábrica 196 veces en el código. Eso es **código que se
salta el design system del propio proyecto** — adherencia a tokens, que es un hallazgo legítimo y
útil, con otro nombre y otra severidad.

**Decisión:** el modo `tokens` de `design-lint.js` corre sobre código, emite WARNING y nunca
bloquea. Las entradas con cero apariciones en cuatro bases de código se conservan como literales
por ser baratas, pero su ausencia aquí no es evidencia de que funcionen: no están calibradas.

---

## 4. Aritmética de contraste — el único check que se defiende solo

No necesita calibración contra corpus: los umbrales son el piso legal (WCAG 2.2 AA), no una
cuestión de gusto. Corrido sobre los cinco proyectos, los cinco fallan **con hallazgos idénticos**
(mismo sha `106a44c7e794`), y todos por la misma causa:

```
BLOCKER par obligatorio no declarado: falta `color.text.primary`
BLOCKER par obligatorio no declarado: falta `color.bg.canvas`
BLOCKER par obligatorio no declarado: falta `color.bg.surface`
… 9 líneas en total
```

Ninguno declara la capa semántica: son sistemas de una sola capa, anteriores a v2.0.0. Es
exactamente lo que la migración `2.0-design-system-layers` existe para nombrar, y la razón de que
el **piso de pares obligatorios** sea imprescindible: sin él, el check itera sobre el conjunto
vacío y emite PASS sobre un sistema que no declara nada — el mismo fallo de "verde vacuo" contra el
que `code-reviewer` ya protege en los tests.

### 4.1 Dos correcciones que la implementación encontró

1. **`border.subtle` sale del piso; entra `border.strong`.** Un separador decorativo no es un
   límite significativo bajo SC 1.4.11, y exigirle 3:1 reprueba sistemas honestos. El que dibuja
   límites de control es el que debe cumplir.
2. **El anillo de foco sobre el control que enfoca es WARNING, no BLOCKER.** SC 2.4.11 exige 3:1
   contra los colores adyacentes, pero la forma estándar de cumplirlo es un offset o un anillo
   bitono, y una tabla de tokens no puede expresar ninguno de los dos. Medido: **ningún color plano
   supera 3:1 contra un canvas blanco y contra un color de acción medio a la vez** — se probaron
   cinco candidatos y todos fallan uno de los dos lados. Bloquear ahí reprobaría a todo sistema
   real sin probar nada.

---

## 5. Límites de este baseline

- **Muestreo de conveniencia, n=5.** Son los proyectos de un solo usuario, con un solo stack
  dominante. No hay condición de control.
- **Ninguna fila mide el producto.** Todo se mide sobre documentos y código, nunca sobre una
  pantalla. El supuesto de que un design system más rico produce una UI mejor sigue sin ponerse a
  prueba, y es el que sostiene el resto del rediseño.
- **La variable que separa el corpus no está controlada.** Cuatro de los cinco proyectos tenían
  material de marca previo; el único que no (MiEmpleadApp) es el del peor resultado. Además
  declara `ui_library: shadcn/ui`, cuyo contrato de tema tiene su propio centro de gravedad — un
  confundidor que nadie ha aislado.
- **Lo que este documento NO establece:** que la Fase 03 rediseñada produzca mejor diseño. Eso
  requiere correr la skill nueva sobre el fixture y comparar, y se hará cuando la skill exista.
