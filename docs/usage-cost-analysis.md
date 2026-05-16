# Reporte: Análisis de Costo de Uso Real (Specture)

> Cruce del informe real de consumo de tokens de Claude (últimas 24 h, sesiones locales) contra la arquitectura del framework, para identificar dónde se consume más y qué es costo accidental vs. esencial.
>
> Fecha: 2026-05-15

## Datos de entrada (informe de Claude)

Características independientes del uso (no es un desglose aditivo):

- 99% del uso vino de sesiones subagent-heavy.
- 41% del uso fue con contexto >150k.
- 27% del uso vino de sesiones activas 8+ horas (background/loop).
- 19% del uso vino de subagentes bajo `specture:start`.
- 13% del uso vino de `/specture:start`.
- 47% del uso vino del plugin `specture`.

Desglose:

| Skills | % |
|--------|---|
| /specture:start | 13% |
| /specture:verify | 1% |

| Subagentes | % |
|------------|---|
| specture:start | 19% |
| specture:code-reviewer | 7% |
| specture:implementer | 3% |
| specture:tdd-test-writer | 3% |
| specture:architecture-validator | 1% |
| Explore | 1% |

| Plugins | % |
|---------|---|
| specture | 47% |

---

## Hallazgo dominante: `specture:start` ≈ 32% del total

```
/specture:start (skill)              13%
specture:start (subagentes bajo él)  19%
                                     ~32%
```

Un router no debería costar esto. `start/SKILL.md` es una máquina de estados: chequea qué archivos existen y enruta. Debería ser <2%. Que sea ~⅓ del consumo es **costo accidental**, no inherente a la metodología.

### R1 — `specture-router` corre en Sonnet (debería ser Haiku) — máximo impacto

`agents/specture-router/AGENT.md` tiene `model: sonnet`. Ese agente no razona: hace existence-checks de filesystem y elige una rama. El propio informe de Claude lo sugiere: "consider configuring a cheaper model for simpler subagents". Cambiar a `model: haiku` ataca de frente el 19% de subagentes + parte del 13%.

- Esfuerzo: 1 línea de frontmatter.
- Impacto: el más alto del análisis.
- Riesgo: bajo (routing es branching determinístico; Haiku lo hace bien). Testear el caso "múltiples epics en [/] → preguntar al usuario".

### R2 — El SessionStart hook (v1.2.0) duplica la invocación de start

`hooks/session-start.js` inyecta "invocá start/SKILL.md" en cada sesión. Pero `settings.json` ya tiene `"agent": "specture-router"` que auto-activa el router que ya invoca start. Con `hooks.enabled: true` hay doble enforcement del mismo arranque por sesión. En sesiones 8+ h / loop (27% del uso) se re-dispara seguido.

- Recomendación: el hook debe ser no-op cuando el router agent ya está activo (son redundantes — uno sobra).
- Esfuerzo: bajo. Riesgo: bajo.

### R3 — `start/SKILL.md` probablemente lee archivos completos cuando solo necesita existencia

El algoritmo de routing solo necesita: ¿existe `stack.yml`? ¿`business_requirements.md`? ¿`ROADMAP.md`? + leer los checkboxes de epics. No necesita el contenido completo de stack.yml ni business_requirements. Si el prompt no lo prohíbe explícito, el modelo los lee enteros cada routing.

- Fix: agregar al skill "check existence only; do NOT read full file contents; for ROADMAP read only epic checkbox lines."
- Esfuerzo: bajo. Riesgo: nulo.

---

## Segundo foco: contexto largo (41% >150k, 27% en 8+ h)

### R4 — El orquestador inline acumula contexto; el plan para arreglarlo está sin implementar

`PLAN-context-management.md` (archivo untracked en la raíz) propone modo agente-por-epic: cada epic corre en un subagente fresco que descarta su contexto al terminar. Hoy el build loop corre inline y acumula spec + tests + reviews + outputs de 4 agentes a lo largo de todos los epics. Eso es exactamente el 41% >150k. El plan nunca se implementó.

- Es el lever estructural más grande contra el costo de contexto largo.
- Esfuerzo: alto. Riesgo: medio. Plan ya escrito.

### R5 — `code-reviewer` (7%, el worker más caro) en Opus + contexto pesado

Recibe spec + stack.yml + conventions + todos los ADRs + secciones de architecture + diff + output de tests + RED_SHA + HEAD_SHA + globs. Opus se justifica (gate de calidad) pero:

- Aplicar O1 del reporte de tokens (extraer tabla Dimension 4 a doc externo).
- Pasarle solo los ADRs relevantes en vez de todos.
- Esfuerzo: medio. Riesgo: bajo. Sin tocar calidad.

---

## Prioridad recomendada

| # | Acción | Ataca | Esfuerzo | Riesgo |
|---|--------|-------|----------|--------|
| R1 | `specture-router` → `model: haiku` | ~19%+ | 1 línea | Bajo |
| R2 | SessionStart hook no-op si router activo | duplicación en sesiones largas | Bajo | Bajo |
| R3 | start/SKILL.md: existence-only, no leer contenidos | 13% directo | Bajo | Nulo |
| R4 | Implementar agente-por-epic (PLAN-context-management.md) | 41% >150k | Alto | Medio |
| R5 | code-reviewer: O1 + solo ADRs relevantes | 7% | Medio | Bajo |

R1+R2+R3 son baratos y atacan ~⅓ del consumo. R4 es el grande estructural; el plan ya existe.

---

## Costo accidental vs. esencial

- **47% del uso es el plugin specture** + **99% sesiones subagent-heavy**: inherente al diseño. Los subagentes de contexto restringido *son* la metodología; no se "arregla" sin cambiar la filosofía.
- El foco correcto es eliminar el costo **accidental** (R1–R3: router en modelo caro, doble arranque, lecturas innecesarias) — no el **esencial** (los 4 workers haciendo su trabajo con contexto restringido).

Línea de corte: optimizar la infraestructura de routing/arranque (accidental, alto leverage), preservar los workers especializados (esencial, costo justificado por calidad).
