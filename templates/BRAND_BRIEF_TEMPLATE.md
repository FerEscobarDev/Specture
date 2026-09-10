# Brief de Marca — [Nombre del Proyecto]

> `docs/03-ux-ui/brief.md`. Lo produce la Fase 3 (`ux-design`) a partir de
> `business_requirements.md` §Identidad de Marca (`MK-nnn`) y de lo que el usuario responda aquí.
> Es el input de la decisión de dirección — sin él, el agente suple la marca con su propio gusto
> y el resultado converge al centro de su entrenamiento.
>
> **No es una condición de "Fase 3 completa":** un proyecto sin `brief.md` sigue siendo válido y
> el router no lo trata como incompleto. Su ausencia se reporta como migración de contenido.

## Procedencia

> El campo que decide cuánto pesa todo lo demás.

- **Estado:** `usuario` | `PROPUESTO_POR_EL_AGENTE` | `mixto`
- Si hay campos propuestos por el agente, **listarlos aquí por nombre**. El gate visual de la
  Fase 4 debe confirmarlos explícitamente antes de que se construya ninguna página: una marca
  provisional que nadie confirmó no puede viajar como si fuera decisión del usuario.

## Parte A — lo que se le pregunta al usuario

> Cinco campos, en este orden. Son los que un no-diseñador puede contestar reaccionando.
> Un campo sin respuesta se escribe `sin definir`. **No se rellena por el agente.**

1. **Marca preexistente** *(MK-001)* — logos, paleta, un sitio ya vivo que haya que honrar.
   Si existe, es lo más importante del brief: es el predictor más fuerte de que el resultado
   tenga identidad propia.
2. **Objetivo emocional** *(MK-002)* — qué debe sentir el usuario a los 5 segundos, y al minuto 30.
3. **Atributos** *(MK-003)* — 3-5 pares adjetivo/anti-adjetivo. El anti-adjetivo es el que
   aporta la información: "cálido, no lindo" dice mucho más que "cálido".
4. **Anti-referencias** *(MK-004)* — 2-3 productos a los que NO debe parecerse, y por qué.
   Más fáciles de contestar que las referencias, y acotan más.
5. **Locale y script** — RTL, CJK, cadenas largas en alemán, formatos de fecha y moneda.

## Parte B — lo que propone la dirección de arte

> Output de diseño, no input de cliente. El agente los propone **desde la Parte A** y el usuario
> sólo confirma. Preguntárselos a un no-diseñador produce silencio o ruido.

- **Densidad:** `airy-marketing` | `balanced-product` | `dense-professional`
- **Postura tipográfica:** `system-only` | `una display distintiva + texto neutro` | `custom`
- **Personalidad de motion:** `none` | `functional` | `expressive` + presupuesto de duración
- **Ledger honrar/romper:** qué convenciones de industria se honran (destructivo = rojo) y cuál
  es la única que se rompe a propósito
- **Stance de ilustración/fotografía**

> **Estos campos acotan, no fijan.** Si el brief cierra la densidad y la postura tipográfica
> antes de generar direcciones, dos de los ejes sobre los que se mide la divergencia nacen
> constantes y el gate se vuelve trivial o insatisfacible. Declararlos como **rango permitido**
> ("balanced o denso"), y resolverlos en la dirección elegida.

## Parte C — restricciones duras

- **Piso legal de accesibilidad:** [WCAG 2.2 AA por defecto]
- **Activos existentes:** [logos, fuentes con licencia, imágenes de marca]
- **Longevidad:** [cuánto tiene que durar este diseño sin rehacerse]
- **Librería UI declarada:** [de `stack.yml` `frontend.ui_library`]

> **Cuidado con el orden:** una librería muy opinada trae su propio centro de gravedad, y los
> tokens que se autoren para llenar su contrato de tema heredan ese centro. Si la dirección
> elegida y la librería se contradicen, o se cambia la librería o se declara aquí el
> **presupuesto de override** que se va a gastar.
