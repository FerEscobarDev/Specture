> **Estado: SIMULACIÓN EJECUTADA — 2026-09-28.** Prueba la "etapa única de decisiones por
> milestone" propuesta en `docs/milestone-planning-stage-analysis.md` con su criterio de
> descarte: **si captura menos del 60 % de las decisiones reales, o deja más de 1 parada
> tardía por epic, se mantiene el gate por epic con políticas y delegación**. Solo lectura
> sobre Psikora; todo el material de la simulación vive en el scratchpad de la sesión.

# Simulación: ¿se pueden anticipar tus decisiones al entrar la milestone?

## 1. Método

**Por qué retrospectiva.** HC-IHCE.6–.9 todavía no pasaron por el gate, así que no hay contra
qué medir. Por eso se simuló sobre los epics que ya tienen registro de lo que se te preguntó
realmente: **HC-IHCE.1, .3, .4 y .5**.

1. **Punto de partida congelado.** Copia de Psikora al commit `d0905787` (2026-09-21 23:28, merge
   de la planificación de la milestone, justo antes de bloquear HC-IHCE.1), exportada con
   `git archive`, **sin historial git**. Los agentes solo podían leer esa copia y las
   definiciones del spec-planner y del validador.
2. **Verdad de referencia.** Un agente aislado reconstruyó, desde las transcripciones y los
   `_planning.md`, las **31 decisiones humanas reales** de esos 4 epics. Por clase:

   | Clase | N.º | Qué es |
   |---|---:|---|
   | a | 18 | Negocio, legal, modelo o contrato |
   | a-pol | 5 | Políticas de proceso |
   | b | 2 | Dependían de la ejecución |
   | c | 5 | No debieron preguntarse |
   | exógena | 1 | Tu cambio de alcance del frontend |

3. **Dos variantes** por epic, con la regla "el código es fuente de premisas y de preguntas,
   nunca de decisiones":
   - **Q (solo preguntas):** un planner por epic genera la partición y todas las preguntas.
   - **DV (borrador + validación):** un planner escribe un borrador desechable del
     comportamiento y sus preguntas; después un validador independiente lo revisa y agrega
     las decisiones que el borrador no vio.
4. **Juicio a ciegas.** Para cada epic, un juez independiente recibió las dos agendas
   etiquetadas "X" e "Y", sin la clave, y comparó cada decisión real contra ellas. Anotó si
   la capturaba (**FULL**, **PARTIAL** o **NONE**), si la recomendada coincidía con tu
   respuesta real y cuánto ruido agregaba cada agenda.
5. **Integridad.** Hubo 0 fugas de conocimiento posterior. Dos agentes listaron por error el
   repo del framework: uno solo vio rutas y cantidades de líneas, otro líneas del README.
   Ninguno vio información de Psikora posterior a la fecha simulada. El ciego es parcial,
   porque la agenda DV se reconoce por su sección de "segunda revisión".

## 2. Resultados

### 2.1 — Captura de las 18 decisiones de clase (a)

| Epic | Variante | FULL | PARTIAL | NONE | FULL % | Paradas tardías | Recomendada = tu respuesta (entre FULL) |
|---|---|---:|---:|---:|---:|---:|---|
| HC-IHCE.1 | Q | 1 | 0 | 0 | 100 % | 0 | 0/1 |
| | DV | 1 | 0 | 0 | 100 % | 0 | 0/1 |
| HC-IHCE.3 | Q | 1 | 0 | 1 | 50 % | 1 | 1/1 |
| | DV | 2 | 0 | 0 | 100 % | 0 | 0/2 (1 parcial) |
| HC-IHCE.4 | Q | 3 | 0 | 0 | 100 % | 0 | 1/3 (2 parciales) |
| | DV | 3 | 0 | 0 | 100 % | 0 | 2/3 (1 parcial) |
| HC-IHCE.5 | Q | 6 | 2 | 4 | 50 % | **6** | 1/6 (2 parciales) |
| | DV | 6 | 2 | 4 | 50 % | **6** | 3/6 (2 parciales) |
| **Total** | **Q** | **11** | 2 | 5 | **61 %** | **7** | 3/11 |
| **Total** | **DV** | **12** | 2 | 4 | **67 %** | **6** | 5/12 |

### 2.2 — Qué se escapó (HC-IHCE.5)

**Ninguna variante capturó estas cuatro.** Todas habrían sido paradas:
- **GT-5-02**, nacida del coordinador: no pedir la autorización de habeas data al agendar en el
  portal; queda como deuda.
- **GT-5-05**, seguimiento de tu propia regla: al restaurar un paciente, la autorización
  anterior no vale y se exige una nueva.
- **GT-5-16**, nacida del validador (la única en la que te apartaste de la recomendada): la cita
  anonimizada es de solo lectura también en el dashboard.
- Una por variante: Q no capturó el estado "Vencido" (GT-5-14) y DV no capturó la constancia
  de Menores (GT-5-10). DV, además, la daba por resuelta al revés de lo que elegiste.

**Captura parcial en las dos:**
- **GT-5-03:** un paciente solo se borra por supresión del titular. Fue iniciativa tuya.
- **GT-5-12:** vencimiento de todos los enlaces de Wompi. Nació del validador.

**Por etapa en que nació la decisión:**

| Etapa | Decisiones | Capturadas por Q | Capturadas por DV |
|---|---:|---|---|
| Primera ronda del planner | 12 | 11 (FULL) | 11 (FULL) |
| Nacidas del validador sobre specs ya escritos | 3 | 0 FULL, 1 PARTIAL | 1 FULL, 1 PARTIAL |
| Seguimientos de tus respuestas o iniciativas tuyas | 2 | 0 | 0 |
| Nacidas del coordinador | 1 | 0 | 0 |

### 2.3 — Otras clases

- **Políticas de proceso (a-pol):** los planners solo capturaron 1 de 5. Son escaladas por el
  tope, fallos preexistentes y datos de Pruebas. **No salen del planner.** Tienen que venir de
  una lista fija de políticas en la sesión; con esa lista quedarían cubiertas las 5.
- **Preguntas que no debieron hacerse (c):** ninguna variante repitió ninguna de las 5.
  Verificar premisas leyendo código funcionó, lo que respalda la IDEA 1 en su versión "código =
  premisas".
- **b y exógena:** no se pueden anticipar, como era de esperar.

### 2.4 — Tamaño y calidad de la agenda

| Variante | Ítems | Coinciden con una decisión real | Decisión legítima que no se te preguntó | Ruido | Útil |
|---|---:|---:|---:|---:|---:|
| Q | 40 (≈10/epic) | 20 | 11 | 9 | 78 % |
| DV | 67 (≈17/epic) | 23 | 22 | 22 | 67 % |

**Costo de cómputo por epic:** Q ≈ 15–20 min con un agente; DV ≈ 35–45 min con dos agentes en
serie. Los epics corren en paralelo.

## 3. Evaluación contra el criterio de descarte

| Criterio | Q | DV | Veredicto |
|---|---|---|---|
| Captura ≥ 60 % | 61 % total | 67 % total | **Pasa en el total, por poco** |
| | 100/50/100/**50** % por epic | 100/100/100/**50** % por epic | **Falla en HC-IHCE.5** |
| ≤ 1 parada tardía por epic | 0/1/0/**6** | 0/0/0/**6** | **Falla en HC-IHCE.5** |

**Lectura.** La etapa única funciona muy bien en epics de infraestructura o esquema como
HC-IHCE.1, .3 y .4: captura 5–6 de 6 decisiones con 0–1 paradas. Pero **no alcanza sola** en un
epic regulatorio como HC-IHCE.5, que es el tipo de la mayoría de los pendientes (.8–.20, .24).
Allí capta la mitad y deja ~6 paradas. Lo que se escapa no son las preguntas de primera ronda,
que capta 11 de 12, sino las **decisiones de segundo orden**:
- las que nacen de tus propias respuestas (reglas nuevas, "ninguna de las opciones");
- las que el coordinador descubre después;
- las que el validador ve sobre specs ya escritos.

## 4. Otros hallazgos que cambian la recomendación

1. **Delegar con "usa la recomendada" habría fallado en estas decisiones.** Entre las
   capturadas, la recomendada de la simulación coincidió con tu respuesta real solo en 3 de 11
   (Q) y 5 de 12 (DV). En los gates reales aceptaste la recomendada 24 de 31 veces, pero eran
   recomendadas formadas con más contexto. Para decisiones legales, de dinero y de datos, tu
   respuesta aporta información que las fuentes no tienen: **la sesión humana es necesaria, no
   un trámite**.
2. **DV mejora poco sobre Q en esta muestra**, y la diferencia no es concluyente con n = 18:
   - +1 captura, −1 parada y +2 recomendadas acertadas;
   - a cambio, +27 ítems, +13 de ruido y el doble de cómputo.
   El único epic donde DV aporta claramente es el regulatorio (HC-5), en las decisiones que
   nacen al validar.
3. **Escala.** Con 10–17 ítems por epic, una milestone de 20 epics produciría ~200–340
   preguntas. Una sola sentada no es realista sin filtrar el ruido y agrupar por tema y tramo.
4. **Efecto lateral valioso: el barrido funciona como auditoría de defectos.** Entre las
   "decisiones legítimas que no se te preguntaron" hay fallos reales del sistema. Uno lo
   verifiqué en la rama actual (`feature/hc-ihce-esquema-y-nucleo`):
   - **`SessionsController` y `RolesController` solo exigen `[Authorize]`.** Toman el `userId`
     de la ruta o del cuerpo, y ni el controller ni los handlers verifican que sea el del
     usuario autenticado; no encontré ningún filtro global que lo haga. Cualquier usuario
     autenticado podría listar o revocar sesiones de otro y ver su historial (email, IP), y
     asignar o revocar roles. **Hay que tratarlo como incidente de seguridad**, fuera de este
     análisis.
   - **Otros señalados en la copia del 21-09, sin verificar en HEAD:**
     - `setup` del 2FA devuelve el secreto aunque ya esté activo;
     - el webhook de Wompi elige el secreto con la cuenta vigente y no con la del pago;
     - una cita puede consumir el paquete de otro paciente del mismo psicólogo;
     - un pago aprobado sobre una cita cancelada queda como `Fallido`, sin aviso de
       reembolso;
     - `reintentar-pago` sobrescribe el enlace anterior;
     - queda un PDF con datos personales huérfano si la firma pierde una carrera.

## 5. Recomendación ajustada

Con estos datos, "una sola etapa" pasa a **dos niveles, con una sola entrada tuya por nivel**:

1. **Sesión de apertura de la milestone.** Barrido Q (más barato y con menos ruido) de todos los
   epics, más la **lista fija de políticas** (tope, supersesiones al loop, fallos preexistentes,
   datos de Pruebas, rama, etc.). Resuelve el grueso: en esta muestra, 11 de 12 decisiones de
   primera ronda y las 5 políticas. Los epics de infraestructura o esquema quedan listos para
   correr sin contacto.
2. **Ronda única justo antes de cada epic regulatorio** (legal, dinero o datos personales).
   Se hace un re-barrido **DV** con todas tus respuestas previas y el código de ese momento, y
   todas sus preguntas van en **un solo contacto**, en lugar de las paradas dispersas de hoy.
   Esa ronda es donde aparecen las decisiones de segundo orden. Si el barrido de apertura no
   marca decisiones legales, de dinero o de datos en un epic, ese epic no tiene ronda.

**Estimación para estos 4 epics:**

| Escenario | Momentos de contacto |
|---|---|
| Real | ≈ 25 |
| Con el esquema de dos niveles | 2 (apertura + ronda de HC-5) + 2–3 imprevistos no anticipables (clases b y exógena) |

Esta estimación todavía no está medida para la ronda de HC-5.

**Pendiente de medir (hipótesis).** No está probado si una sesión de apertura **en dos rondas**,
con un re-barrido de tus respuestas entre ambas, captaría también las decisiones de segundo
orden sin necesitar la ronda por epic. Se puede probar barato: re-barrer HC-5 con tus respuestas
reales de la primera ronda y ver si aparecen GT-5-02, -05, -12 y -16.

## 6. Limitaciones

- **Muestra chica.** Hay 18 decisiones de clase (a), 12 de ellas en un solo epic. Cada variante
  corrió una sola vez y hubo un juez por epic. Las diferencias de 1–2 decisiones entre Q y DV no
  son concluyentes.
- **Snapshot incompleto.** No incluye el artefacto externo "Revisión del Esquema Psikora", que
  varios epics citan. Los planners reales tampoco lo tenían en el repo, pero el coordinador
  sí se lo pasaba.
- **Código de un momento distinto.** Los agentes leyeron el código anterior a la demolición de
  HC-IHCE.1; los gates reales vieron el código posterior a cada epic previo.
- **Criterio de parada del juez.** La regla "parada si el tema es legal, dinero o datos" es
  conservadora: algunas de esas decisiones podrían haberse diferido sin daño.
- **Esfuerzo de los agentes.** Corrieron con el esfuerzo heredado de la sesión, no con el
  `effort: medium` propuesto.
