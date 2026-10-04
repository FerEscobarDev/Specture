# Cómo funciona la revisión de cumplimiento (v2.4.0)

> Guía para quien usa `/specture:build` o adopta Specture en un repositorio que ya tiene sus
> propios criterios de revisión. El procedimiento está en `skills/compliance-review/SKILL.md`
> (y `CORRECTION_LOOP.md`); el agente, en `agents/compliance-reviewer/AGENT.md`; las gramáticas del
> reporte, en `templates/COMPLIANCE_REPORT_TEMPLATE.md`; la del archivo de reglas, en el
> comentario de `templates/project-config/review-rules.template.md`.

## La idea en una frase

Cuando se cierra un milestone, un revisor recorre **todo** el código del milestone contra
**todas** las reglas del proyecto —también las del equipo, enlazadas desde un archivo— y te deja
un reporte con comentarios sugeridos que cualquiera entiende. Después tú decides qué se arregla.

## Por qué hace falta si cada spec ya tiene su revisión

La revisión por spec (`code-reviewer`) mira cada spec con las reglas que le corresponden por sus
tags. Hay cosas que nunca ve:

- una regla `R-*` cuyos tags no coincidieron con ningún spec;
- secciones de `conventions.md` que ninguna dimensión cubre de forma explícita (estilo, testing,
  idioma, reglas del equipo);
- las reglas de proceso `W-*` sobre los commits (por ejemplo, Conventional Commits);
- la consistencia entre epics: el mismo concepto con dos nombres, lógica duplicada, código
  muerto que dejó un comportamiento reemplazado;
- los criterios que tu equipo ya tenía escritos en otro lado.

## Cuándo corre

- **Al cerrar un milestone**, dentro de `/specture:build`, sin preguntarte nada: el revisor
  trabaja, el reporte se guarda y la cola sigue. Lo ves al final de la tanda.
- **A pedido**, cuando quieras: `/specture:compliance-review milestone <N>` (revisa y te pregunta
  enseguida) o `/specture:compliance-review triage` (decide lo que quedó pendiente).
- Está **activa por defecto** en cualquier perfil. Para apagar la llamada automática:
  `compliance_review.enabled: false` en `.specture/settings.yml`. Pedirla a mano siempre funciona.

## Qué pasa, paso a paso

1. **El rango.** Se calcula qué código es del milestone: el trabajo de cada epic, desde que se
   marcó `[/]` hasta que se marcó `[x]`. Como los epics corren de a uno, otro milestone que se
   intercale no se cuela. Se excluyen `docs/`, `.specture/`, lockfiles y binarios. Si algo no se
   puede verificar (un historial reescrito, un epic sin su marca), el reporte sale `BLOCKED` y
   dice por qué: nunca revisa código equivocado.
2. **La revisión.** El código se parte en bloques por componente y el revisor recorre cada uno
   con todas las reglas. No modifica nada: escribe una parte por bloque.
3. **El reporte.** Un script une las partes, ordena los hallazgos por severidad y escribe
   `docs/07-reviews/cumplimiento-milestone-<N>-<fecha>.md`, que se commitea.
4. **El triage, contigo.** Al vaciarse la cola (o cuando lo pidas) ves los hallazgos con una
   decisión propuesta y eliges: aplicar la propuesta, decidir hallazgo por hallazgo, diferir todo
   o marcar todo como "no aplica". Nada se aplica sin que lo elijas.
5. **La corrección.** Los hallazgos que elegiste corregir los corrige un agente aparte, uno por
   commit, sin tocar tests, con la suite igual que antes y una verificación del revisor al final.
6. **Lo diferido** queda en el reporte y se te ofrece una vez como posible `/specture:new-feature`.

## Qué se puede corregir y qué no

Cada hallazgo trae un **tipo**:

| Tipo | Qué es | Qué puedes decidir |
|---|---|---|
| `refactor` | arreglarlo no cambia lo que hace el código (nombres, ubicación, duplicación, estilo) | corregir · diferir · no aplica |
| `comportamiento` | arreglarlo cambia lo que hace (una validación que falta, otro código de estado) | diferir (pasa por un spec) · no aplica |
| `test` | el hallazgo está en un archivo de test | diferir (lo cambia quien escribe tests) · no aplica |
| `proceso` | una regla de proceso: el formato de un mensaje de commit, el nombre de una rama | diferir · no aplica (no se arregla con código) |

La razón: en Specture todo cambio de comportamiento pasa por un spec y los tests los escribe el
test-writer. "No aplica" es tu criterio y queda registrado con su motivo.

## Los comentarios sugeridos

Cada hallazgo trae un **comentario sugerido** pensado para quien escribió el código, que quizás
nunca vio los documentos internos del proyecto:

- una a tres frases: qué pasa, por qué importa, qué hacer;
- lenguaje claro y preciso; se permiten términos de código;
- **nunca** un ID de regla, un archivo de configuración, el signo `§` ni el nombre de un archivo
  de criterios del equipo — un script lo comprueba y rechaza la parte si aparecen.

Ejemplo:

> `api/pedidos/handler.js:8` — Esta función toma el usuario de un parámetro de la URL en lugar de
> la cabecera de identificación, así que cualquiera puede pedir los datos de otro usuario. Conviene
> leer el usuario de la cabecera y responder 401 si falta.

Specture **no publica nada** en GitHub ni en Azure DevOps: tú copias lo que quieras. La línea
`Origen:` del reporte sí cita la regla, para que sepas de dónde salió cada hallazgo.

## Tus propias reglas: `.specture/review-rules.md`

Es opcional. Sirve para que Specture use los criterios que tu equipo **ya mantiene** —una guía,
un checklist, un agente de revisión— sin copiarlos: se enlazan por ruta y, si conviene, por
sección. El implementer recibe los que aplican a cada spec mientras programa, y la revisión de
cumplimiento los verifica al cerrar el milestone.

```markdown
## Incluye
- .claude/agents/acme-reviewer.md § Bloqueantes
- .claude/agents/acme-reviewer.md § Tests — cuando: tests/**
- .claude/agents/acme-reviewer-reglas.md § Backend Node — cuando: api/**
- .claude/agents/acme-reviewer-reglas.md § SQL — cuando: *.sql

## Severidades
- bloqueante = BLOCKER · observación = IMPORTANT

## Nivel flexible
- rutas: legacy/**
- reglas: .claude/agents/acme-reviewer.md § Nivel flexible

## Reglas
- **RV-1** [BLOCKER] Ningún endpoint devuelve el detalle de una excepción al cliente.
```

- **`## Incluye`** — un archivo entero (`<ruta>`) o una sección con sus subsecciones
  (`<ruta> § <encabezado>`, o `<ruta>#<encabezado>` si tu teclado no tiene `§`). El encabezado se
  compara sin mayúsculas ni tildes. `— cuando: <globs>` la carga solo si el código toca esas rutas.
- **Un solo nivel.** Solo se siguen las inclusiones de este archivo. Si un archivo incluido tiene
  su propio `## Incluye`, el doctor lo marca como error y no se sigue.
- **Globs.** Con `/` se anclan a la raíz del proyecto (`api/**`); sin `/` valen en cualquier
  carpeta (`*.sql`). No se admiten llaves `{a,b}`: un glob por patrón.
- **`## Severidades`** traduce las palabras del equipo a `BLOCKER`, `IMPORTANT` o `NIT`.
- **`## Nivel flexible`** declara código legado con criterios reducidos: en esas rutas la revisión
  de cumplimiento aplica **solo** esas reglas, también en lugar de las de Specture, y el reporte
  lista lo que no evaluó. Mientras se construye, las reglas obligatorias del framework siguen
  valiendo ahí.
- **`## Reglas`** — reglas propias de una línea, con ID `RV-n` y severidad.
- **Conflictos.** Si una regla de aquí contradice `conventions.md`, `rules.yml` o un ADR, gana
  Specture y el reporte lista la contradicción para que corrijas la fuente.
- **Tope.** Lo que se carga para una revisión no puede pasar de 60 000 caracteres: si pasa, falla
  con el tamaño de cada sección para que la acotes con `§` o `cuando:`.

### Qué conviene incluir

Incluye **secciones de criterios**, no agentes enteros. Un agente de revisión suele traer también
su procedimiento (cómo obtener el diff, dónde guardar el resultado, qué formato usar): eso no
aplica aquí y el doctor avisa (`review-rules-agent-include`). Las secciones que incluyes llegan
a los agentes como **datos**, nunca como instrucciones. Las reglas de **dónde vive cada archivo**
van en el mapa de §2 de `conventions.md`, que también ve quien planifica.

### Ejemplo de adopción: un equipo que ya revisaba con su propio agente

El equipo Acme revisaba sus pull requests con un agente de Claude Code en
`.claude/agents/acme-reviewer.md` (principios, una tabla de bloqueantes, niveles por proyecto,
un checklist y el procedimiento de revisión) y un segundo archivo con reglas por tecnología. Sus
reportes quedaban en otra carpeta y no tenían en cuenta las reglas de Specture. Al adoptar:

1. `setup` (paso 8.6) encuentra esos archivos, lista sus secciones y el equipo elige las de
   criterios: bloqueantes, reglas generales, niveles, checklist y cada tecnología con su `cuando:`.
   Deja afuera "Cómo ejecutar" y "Guardar los hallazgos".
2. Los archivos siguen donde están y los sigue manteniendo el equipo. Si alguien renombra un
   encabezado, el doctor avisa.
3. Desde ahí el implementer recibe esos criterios en cada spec, y la revisión de cumplimiento los
   aplica junto con todas las reglas de Specture, con un solo reporte en `docs/07-reviews/`.

## Qué revisa el doctor

`/specture:doctor check` valida el archivo (gramática, rutas, encabezados, anidación, tamaño,
globs que no tocan nada) y los reportes (`TRIAGE` pendiente, correcciones abiertas, reportes que
no se pueden leer). Detalle en `skills/doctor/SKILL.md`.

## Qué queda registrado

- El reporte, con las decisiones del triage, los diferidos y el resultado de cada corrección.
- Un commit `refactor(cumplimiento): F-n …` por hallazgo corregido.
- Una línea `kind: "compliance"` en `docs/.specture-meta/build-metrics.jsonl`; `/specture:knowledge
  stats` la suma y avisa cuando la mitad o más de los hallazgos fueron "no aplica" (señal de que
  alguna regla es ruido).
