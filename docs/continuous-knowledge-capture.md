# Continuous Knowledge Capture — Propuesta `/specture:learn`

> **Origen:** sesion 2026-05-18 con Fernando Escobar (equipo SGD) tras configurar Specture sobre un proyecto con documentacion preexistente (ver [`adoption-with-existing-docs.md`](./adoption-with-existing-docs.md)). El usuario pregunto si era viable que Specture acumulara aprendizajes a medida que el proyecto avanza, sin que la informacion descubierta en cada sesion se perdiera al cerrar la conversacion. La respuesta corta es si, y este documento describe como.

---

## 1. El problema

Cada conversacion con Claude (o cualquier IA de Specture) empieza desde cero. La memoria del modelo no persiste entre sesiones por defecto. Cuando un agente descubre algo no documentado durante el trabajo — un comportamiento de integracion peculiar, una causa raiz de un bug, una regla de negocio implicita, un patron emergente — ese conocimiento se evapora al cerrar la conversacion.

**Sintomas observables en proyectos maduros:**

- El equipo redescubre la misma causa raiz dos o tres veces antes de que alguien la escriba en un doc.
- Los ADRs reflejan decisiones grandes pero no las "decisiones pequenas" que aparecen durante el debug.
- `code-reviewer` rechaza un PR por un patron que ya se habia validado en otra sesion, porque el nuevo agente no sabe que se habia validado.
- La documentacion del equipo (`SGD.Docs/`, `docs/`, wikis) se atrasa respecto al codigo porque actualizarla es trabajo manual sin un trigger explicito.

**Lo que Specture no resuelve hoy:**

- El flujo `build` cierra epics marcando checkboxes, pero no captura "que aprendio el equipo en este epic".
- `code-reviewer` produce reportes per-PR pero esos reportes mueren con el PR — no alimentan los ADRs ni el indice.
- `debug` produce `DEBUG_LOG.md` (excelente paso) pero no promueve los hallazgos a documentacion permanente cuando aplican mas alla del bug puntual.
- El usuario tiene que recordar manualmente que un descubrimiento merece quedar archivado, y la friccion del "escribir el doc" suele ganar.

---

## 2. La forma simple — patron manual (lo que aplicamos hoy en SGD)

En SGD aplicamos la version barata sin modificar Specture. En `CLAUDE.md` del proyecto agregamos esta regla:

> **Captura continua de conocimiento (regla de cierre de conversacion).** Al finalizar cualquier conversacion no trivial (>30 minutos, debug profundo, integracion nueva, comportamiento no documentado, decision arquitectonica), Claude pregunta antes de cerrar: "¿algo de lo que descubrimos merece quedar como (a) entrada en `SGD.Docs/`, (b) ADR, (c) entrada en `docs-index.yml`, (d) regla en `conventions.md`, (e) memoria personal de Claude?". Si si, escribe el delta en el mismo turno.

Esto funciona a medias porque no siempre se activa y más porque tenemos el principio de no llenar de contexto innecesario a los agentes entonces la lectura inicial de CLAUDE.md no se dispersa entre los agentes lo cual es correcto, se debe pensar una manera de mantener esto pero que el orquestador al final pueda determinar si lo que hizo justifica para memorizarlo y documentarlo.

---

## 3. Propuesta — skill `/specture:learn` + hooks

### 3.1. El skill `/specture:learn`

Nuevo skill transversal (mismo nivel que `verify`, `debug`, `new-feature`). Frontmatter:

```yaml
---
name: learn
description: Use al final de cualquier epic, debug, integration, o sesion de descubrimiento no trivial — antes de marcar el trabajo como completo. Captura aprendizajes en documentacion permanente (SGD.Docs/, ADRs, conventions, docs-index) para que el equipo se beneficie en sesiones futuras.
---
```

**Flujo del skill:**

1. **Recolecta el contexto de la sesion** — diff del trabajo + conversacion + outputs de agentes invocados.
2. **Filtro de relevancia.** Aplica criterios para decidir si vale la pena correr la captura:
   - Trabajo > N minutos / > X archivos tocados, O
   - Conversacion menciona "descubri", "no sabia", "resulta que", "no esta documentado", "tuvimos que averiguar", etc., O
   - El skill se invoco al final de `build` con un epic acabado de cerrar, O
   - El skill se invoco al final de `debug` con root cause confirmada, O
   - Invocacion manual del usuario.
3. **Analiza candidatos a captura.** Cruza el diff y la conversacion contra:
   - `.specture/conventions.md` — ¿el codigo nuevo introduce un patron que merece convencion?
   - `.specture/decisions/` — ¿hay decision tecnica implicita que no esta en ningun ADR?
   - `.specture/docs-index.yml` — ¿hay concepto tocado que no esta indexado?
   - Documentacion del proyecto (`SGD.Docs/`, `docs/`) — ¿hay comportamiento descubierto que no esta documentado?
   - Cobertura de tests del modulo tocado — ¿hay regla descubierta que un test deberia atrapar?
4. **Genera drafts especificos.** Para cada categoria que aplique, prepara el delta concreto (no abstracciones tipo "actualiza la doc"):
   - **Nueva entrada en `docs-index.yml`** con `concept`, `file`, `read_when`, `tags`.
   - **Borrador de ADR** en `.specture/decisions/NNN-titulo.md` con Context/Decision/Consequences/References.
   - **Patch a `conventions.md`** mostrando seccion afectada y delta.
   - **Patch o archivo nuevo en `[docs_dir]/[categoria]/`** segun el indice categorizado.
   - **Memoria personal de Claude** para hallazgos que son sobre preferencias del usuario (no del producto).
5. **Pregunta al usuario por aprobacion granular.** Cada draft se ofrece individualmente; el usuario aprueba/rechaza/edita. No es un commit en bloque — es una revision item por item.
6. **Aplica los aprobados** y commitea con mensaje `docs(learn): captura post-[epic-id|debug|sesion]`.
7. **Anota en MEMORY o estado** lo que el usuario rechazo, para no volver a sugerirlo en la misma sesion.

### 3.2. Hooks que disparan `/specture:learn`

En `settings.json` opt-in:

```json
{
  "hooks": {
    "PostBuildEpic": {
      "trigger": "after code-reviewer APPROVED an epic in build loop",
      "action": "invoke /specture:learn with epic context",
      "blocking": false
    },
    "PostDebugSession": {
      "trigger": "after debug skill writes a DEBUG_LOG with root cause CONFIRMED",
      "action": "invoke /specture:learn with debug log context",
      "blocking": false
    },
    "PostNewFeatureRoadmap": {
      "trigger": "after new-feature adds milestone/epic to ROADMAP",
      "action": "invoke /specture:learn with feature impact analysis",
      "blocking": false
    }
  }
}
```

Toggle en `.specture/conventions.md` seccion 10:

```yaml
- learn.enabled: true        # activa captura continua post-epic/debug
- learn.auto_apply: false    # si true, aplica drafts aprobados por defecto sin preguntar (no recomendado)
- learn.min_session_minutes: 30   # umbral para sesiones manuales
```

### 3.3. Integracion con los agentes existentes

- **`code-reviewer`** — al aprobar, ademas del veredicto incluye una seccion `LEARNINGS:` con candidatos detectados (patrones nuevos, decisiones implicitas, gaps de documentacion). `/specture:learn` consume esa seccion como input.
- **`debug`** — el `DEBUG_LOG.md` ya documenta sintoma -> causa raiz -> fix. `/specture:learn` lo lee y propone: ¿esta causa raiz aplica a otros modulos? ¿amerita ADR de "no hacer X"? ¿amerita test caracterizador?
- **`architecture-validator`** — cuando rechaza por violacion, si el usuario decide aceptar la violacion como excepcion documentada, eso es un ADR candidato.
- **`tdd-test-writer`** — si genera tests para un comportamiento descubierto recientemente, sugiere que la regla de negocio que justifica el test debe quedar en `business_requirements.md` o `funcionalidades/`.

### 3.4. Estructura del prompt del skill

Como skill, hereda el patron de `verify`/`debug`:

- **Detect & route** — decide si correr o no segun el filtro de relevancia.
- **Analyze** — corre el cruce contra .specture/ y la documentacion.
- **Propose** — genera drafts especificos con paths y deltas.
- **Confirm** — interaccion granular con el usuario.
- **Apply & commit** — escribe lo aprobado, commitea, actualiza `docs-index.yml` automaticamente si se creo doc nueva.
- **Report** — resumen final de que se capturo, que se rechazo y por que.

---

## 4. Dos niveles de memoria — del repo y de Claude

Diseno explicito: **separar** lo que va al repo de lo que va a la memoria de Claude.

| Tipo de aprendizaje | Destino | Razon |
|---|---|---|
| Comportamiento del producto, regla de negocio, decision tecnica | Repo (`SGD.Docs/`, ADRs, indice) | El equipo entero lo necesita |
| Patron de codigo emergente | Repo (`conventions.md`) | Aplica a todos los devs |
| Causa raiz de bug recurrente | Repo (`SGD.Docs/funcionalidades/` o seccion de deuda) + test caracterizador | Prevenir regresion en cualquier sesion |
| Preferencia del usuario / estilo de colaboracion | Memoria personal de Claude (`~/.claude/projects/.../memory/`) | Es per-usuario; varia entre miembros del equipo |
| Atajo personal del usuario para tareas repetitivas | Memoria personal | Idem |
| Estado in-progress de una sesion | Ninguno (es ephemero — tasks, plan, conversacion lo cubren) | No persistir trabajo en curso |

El skill `/specture:learn` debe ser explicito sobre cual destino propone para cada draft.

---

## 5. Como evita el problema del "ruido"

Riesgo conocido del approach: si se captura todo, los archivos se llenan de findings irrelevantes y dejan de ser utiles. Mitigaciones:

1. **Filtro de relevancia upstream.** El skill no corre si la sesion no cumple los umbrales.
2. **Granularidad de aprobacion.** El usuario rechaza items uno por uno. Items rechazados se anotan localmente para no re-sugerirse.
3. **Patron "amplificacion vs evento".** Antes de capturar, preguntar: ¿esto aplica solo al modulo X o es una regla general? Solo capturar reglas/decisiones que aplican generalizadamente; los detalles puntuales quedan en el commit message del epic.
4. **Auditoria periodica.** `code-reviewer` puede revisar `docs-index.yml` cada N semanas y proponer consolidacion/limpieza de entradas redundantes.
5. **Limite duro de drafts por sesion.** Max 5 drafts propuestos por `/specture:learn`. Si hay mas, el skill prioriza por impacto y deja los demas para una proxima ronda.

---

## 6. Comparacion con alternativas

| Approach | Pro | Con |
|---|---|---|
| Solo memoria personal de Claude | Cero friccion, opt-in natural | Per-usuario — el equipo no se beneficia |
| Hooks que auto-actualizan docs sin confirmacion | Maxima captura | Genera ruido, requiere confianza ciega en el modelo |
| Skill `/specture:learn` con aprobacion granular (esta propuesta) | Equilibrio captura/control, integra con flujo Specture existente | Mas pasos, requiere disciplina del usuario para invocarlo si no esta en hook |
| Patron manual sin skill (lo que tenemos hoy en SGD) | Cero overhead de framework | Depende de disciplina total, sin amplificacion |
| Agente background que analiza commits cada N dias | No interrumpe el flujo de trabajo | Conocimiento se captura tarde; perdida de contexto del momento del descubrimiento |

La propuesta combina el agente skill (`/specture:learn`) con hooks ligeros — el skill puede invocarse manualmente o auto-disparar en momentos clave del build loop.

---

## 7. Roadmap propuesto para Specture

### Fase 1 — Skill standalone (sin hooks)

- Crear `skills/learn/SKILL.md` siguiendo el patron de `verify`/`debug`.
- Template `LEARN_OUTPUT.template.md` para el reporte.
- Toggle `learn.enabled` en `conventions.template.md` seccion 10.
- Documentacion en `README.md` y `docs/native-integration-guide.md`.

**Entregable:** usuarios pueden invocar `/specture:learn` manualmente al final de cualquier sesion.

### Fase 2 — Hooks opt-in para auto-disparo

- `hooks/post-build-epic.js` — invoca el skill cuando se marca epic `[x]` en `build`.
- `hooks/post-debug-session.js` — invoca el skill cuando `debug` cierra con root cause confirmada.
- `settings.json` registra ambos como `PostToolUse` no bloqueantes.

**Entregable:** captura automatica en los puntos naturales del ciclo Specture.

### Fase 3 — Integracion con agentes especializados

- `code-reviewer` agrega seccion `LEARNINGS:` a su output.
- `debug` enriquece `DEBUG_LOG.md` con seccion `Generalizable:` (si la causa raiz aplica mas alla del bug puntual).
- `architecture-validator` reporta "excepcion documentada" cuando el usuario decide aceptar una violacion.

**Entregable:** los agentes alimentan candidatos de captura sin que el skill tenga que reinferir todo.

### Fase 4 — Auditoria automatica del indice

- Comando `/specture:audit-knowledge` que revisa `docs-index.yml` vs archivos reales, detecta entradas obsoletas (archivo movido/eliminado), duplicadas, o conceptos del codigo no indexados.
- Reporta gaps y propone consolidaciones.

**Entregable:** el indice se mantiene saludable a largo plazo sin trabajo manual.

---

## 8. Metricas de exito

- **Adopcion:** % de epics cerrados en `build` que termina con `/specture:learn` corrido (manual o automatico). Meta: > 70% en proyectos con `learn.enabled: true`.
- **Conversion:** % de drafts propuestos que terminan aceptados por el usuario. Meta: > 40% (debajo de eso = falsos positivos, ajustar filtros).
- **Reduccion de redescubrimiento:** medido cualitativamente — frecuencia con la que un agente cita doc/ADR creado por `/specture:learn` en sesiones posteriores. Meta: cada item capturado deberia ser citado al menos una vez en los siguientes 6 meses.
- **Salud del indice:** % de archivos del repo de documentacion que estan en `docs-index.yml`. Meta: > 90% en proyectos maduros.

---

## 9. Referencias

- Proyecto de prueba (patron manual aplicado): SGD — `C:\CodigoFuente\SGD\CLAUDE.md` (seccion "Captura continua de conocimiento")
- Documento hermano (configuracion inicial con docs preexistentes): [`adoption-with-existing-docs.md`](./adoption-with-existing-docs.md)
- Skills existentes que sirven de modelo: `skills/verify/SKILL.md`, `skills/debug/SKILL.md`
- Agentes a integrar: `agents/code-reviewer/`, `agents/architecture-validator/`
- Memoria personal de Claude: documentado en el system prompt del asistente bajo "auto memory"


### ** NOTA **: 
    Adicionalmente a lo documentado aquí sería de mucho valor también poder usar la skill para enseñarle por ejemplo explicarle un flujo o reglas de negocio nuevas, que pregunte si hay ambiguedad en lo que se intenta enseñarle para que la información sea clara y verídica.