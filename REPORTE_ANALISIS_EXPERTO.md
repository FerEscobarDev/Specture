# Reporte Experto: VibeCoding vs Superpowers — Análisis Integral

## Resumen Ejecutivo

VibeCoding es un framework con un enfoque **marcadamente diferente** a Superpowers: donde Superpowers es un sistema de skills composable y agnóstico a tecnología, VibeCoding apuesta por una **metodología de ciclo de vida completo** (levantamiento → arquitectura → UX → roadmap → specs → ejecución → auditoría). Esa apuesta es su mayor fortaleza y al mismo tiempo su mayor riesgo. El proyecto tiene una base sólida con varias ideas genuinamente superiores a Superpowers, pero tiene brechas técnicas críticas que lo impedirían funcionar bien hoy en proyectos reales.

---

## 1. Fortalezas Genuinas de VibeCoding

Estas son cosas que VibeCoding hace **mejor** que Superpowers y que deberías preservar:

### 1.1 Levantamiento de Negocio vs Brainstorming Técnico

El `01-levantamiento.md` tiene un foco en **actores, reglas de negocio, historias de usuario y casos límite** que el brainstorming de Superpowers no tiene. Superpowers hace diseño técnico; VibeCoding hace análisis de producto. Para proyectos empresariales esto es crítico. La distinción "qué pasaría si…" para descubrir edge cases de negocio es un patrón socrático genuinamente valioso.

### 1.2 La Fase UX/UI con Dual Route

Superpowers **no tiene nada equivalente**. Las dos rutas (delegar a Claude Design vs construir Design System interno) son una diferenciación inteligente. El mandato de "nunca definas código en esta fase" para el diseño es correcto: evita el problema de que el diseñador-IA contamine el contexto con código pre-generado.

### 1.3 ROADMAP como Contexto Macro Condensado

El `ROADMAP.md` como documento único con links a reglas de negocio y estados `[ ]`/`[/]`/`[x]` es una estrategia de optimización de tokens brillante. Superpowers no tiene un equivalente de "brújula macro" — sus planes son por feature, no tienen visión de proyecto completo.

### 1.4 La Regla de Limpieza de Contexto

El mandato en `06-agente-ejecutor` de "ignora conversaciones pasadas, tu único contexto es el `.spec.md` activo" es una de las ideas más importantes del framework. Superpowers resuelve esto con subagentes, pero la regla explícita de limpieza es más accesible para usuarios que no usan ejecución con subagentes.

### 1.5 Debug Log Template como Artefacto Físico

Obligar a que cada hipótesis de debugging quede en un archivo físico `/docs/debug_logs/` antes de tocar código crea un **audit trail real**. Superpowers tiene el protocolo verbal, VibeCoding lo hace verificable.

### 1.6 Fase 9: Nueva Funcionalidad con Análisis de Impacto

El `09-nueva-funcionalidad.md` tiene un paso de "Auditoría de Impacto" que evalúa qué componentes se verán afectados antes de planificar. Superpowers no tiene esto — simplemente vuelve al brainstorming sin revisar el sistema existente.

---

## 2. Problemas Críticos (Bloqueantes)

Estos problemas **rompen el framework** en proyectos reales:

### 2.1 Lock-in Tecnológico en `02-arquitectura.md` — CRÍTICO

```
# El skill dice literalmente:
"Lineamientos Técnicos Obligatorios:
1. Backend: C# .NET (última versión LTS), Entity Framework Core, PostgreSQL.
2. Patrón: Modular Monolith usando DDD y CQRS."
```

Pero el `spec_vive_code.md` dice explícitamente: *"debe poder ser personalizable a muchos lenguajes, arquitecturas"*. **El framework se contradice a sí mismo en su requisito más fundamental.** Un proyecto Node.js + MongoDB, o Python + FastAPI, simplemente no puede usar VibeCoding hoy. La arquitectura hardcodeada también viola YAGNI: DDD y CQRS para una aplicación CRUD simple es sobreingeniería por diseño.

**Impacto:** Cualquier proyecto fuera del stack .NET queda excluido.

### 2.2 Referencias con Rutas Absolutas de Windows — CRÍTICO

```markdown
@c:\Proyectos\VibeCoding\skills\05-agente-ejecutor.md
```

Estas referencias aparecen en el README y en las instrucciones de instalación. **No son portables entre máquinas** y rompen completamente el onboarding para cualquier otro usuario. Superpowers resolvió esto siendo un plugin instalable (`/plugin install superpowers`).

### 2.3 No Existe Ejecución con Subagentes

El `06-agente-ejecutor.md` ejecuta TDD en la sesión principal. Esto significa acumulación de contexto, riesgo de contaminación entre specs, y pérdida de la capacidad de review de dos etapas (spec compliance + code quality) que Superpowers tiene. Para un ROADMAP de 20+ epics, la calidad degradará progresivamente conforme el contexto crece.

### 2.4 Descripción de Skills No Optimizada para Descubrimiento (CSO)

Los skills tienen frontmatter como:
```yaml
description: Fase inicial para convertir una idea vaga de proyecto en un conjunto claro de requerimientos y reglas de negocio.
```

Esto describe **qué hace** el skill, no **cuándo activarlo**. El principio CSO (Claude Search Optimization) de Superpowers, descubierto empíricamente, demuestra que cuando la descripción resume el flujo, Claude **sigue la descripción en lugar de leer el skill completo**. El formato correcto es:
```yaml
description: Use when the user says "inicia un proyecto nuevo", "levanta requerimientos", or when starting a project from scratch with no existing code.
```

---

## 3. Brechas Importantes (No Críticas pero Significativas)

### 3.1 Falta `verification-before-completion`

No hay ningún mecanismo que obligue a la IA a ejecutar los tests y mostrar la salida **antes** de declarar "completado". En el contexto de `06-agente-ejecutor`, el agente podría declarar que el test pasó sin haberlo ejecutado realmente. Superpowers tiene una skill dedicada con la Ley de Hierro: "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE".

### 3.2 Falta `writing-skills` Meta-Skill

No existe metodología para **crear y validar nuevos skills de VibeCoding**. El requisito #7 del spec dice que el sistema debe ser personalizable, lo que implica que los usuarios van a crear sus propios skills. Sin una guía para hacerlo bien (con el ciclo TDD aplicado a documentación), los skills personalizados serán de baja calidad.

### 3.3 Falta `finishing-a-development-branch`

¿Qué ocurre cuando el ROADMAP llega a 100% completo? El `00-using-vibecoding.md` dice "pregunta si quieren auditar o nueva funcionalidad" pero no hay un flujo estructurado para merge, PR, limpieza de rama, o decisión de deployment.

### 3.4 Falta Git Worktrees

No hay integración con git worktrees para aislar features. Trabajar sobre el branch principal durante toda la ejecución es riesgoso. Superpowers crea un worktree aislado antes de cualquier implementación.

### 3.5 El `05-planificacion.md` es Superficial vs `writing-plans`

El spec de planificación de VibeCoding prohíbe código en specs (correcto), pero el resultado es un documento de alto nivel que deja demasiado al criterio del agente ejecutor. Superpowers' `writing-plans` genera planes con **rutas exactas de archivos, código completo en cada paso, comandos de verificación con output esperado**. Ese nivel de detalle es lo que hace que los subagentes puedan ejecutar sin preguntas. VibeCoding necesita un equivalente de "implementation plan" entre el spec y la ejecución.

### 3.6 Falta `receiving-code-review`

Cuando `07-auditoria-codigo.md` genera un reporte con "ESTADO: RECHAZADO", no hay un skill estructurado para que el agente ejecutor interprete y responda ese feedback de manera disciplinada.

### 3.7 Sin Soporte Multi-Plataforma

Superpowers tiene `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` y referencias de tool mapping para diferentes IDEs. VibeCoding solo contempla Claude Code y Antigravity, sin documentación de adaptación.

---

## 4. Problemas de Diseño de Skills

### 4.1 Los Nombres Numéricos Son Antipatrón

`01-levantamiento`, `02-arquitectura`, etc. Los prefijos numéricos sugieren orden secuencial (correcto), pero dificultan el descubrimiento semántico por búsqueda de palabras clave. Claude busca por contexto, no por números. Superpowers usa `brainstorming`, `systematic-debugging` — verbos/sustantivos descriptivos que aparecen naturalmente en el contexto del usuario.

**Solución**: Mantener la numeración como prefijo interno pero usar nombres semánticamente ricos:
```
01-requirements-gathering
02-architecture-design  
03-ux-design
```

### 4.2 Granularidad Inconsistente entre Specs y Plans

La Fase 5 genera `.spec.md` con criterios de aceptación en texto. La Fase 6 convierte esos criterios a tests. Hay un gap: **¿quién define exactamente qué archivos tocar, en qué orden, con qué verificaciones?** Superpowers tiene una capa intermedia (el implementation plan) que VibeCoding no tiene explícitamente. El resultado es que el agente ejecutor tiene que inferir el plan de implementación desde el spec, lo que introduce oportunidades de alucinación.

### 4.3 El Frontmatter No Sigue la Especificación de AgentSkills.io

Revisando los skills, el frontmatter tiene solo `name` y `description` pero la especificación completa de agentskills.io soporta campos adicionales (`triggers`, `phase`, `priority`) que podrían mejorar el routing. Superpowers también hace referencia a esta especificación en `writing-skills`.

---

## 5. Ideas Innovadoras que VibeCoding Podría Pionear

Estas son oportunidades que **ninguno de los dos frameworks tiene hoy**:

### 5.1 Project AI Memory como Artefacto Versionable
El `00-setup.md` ya crea `CLAUDE.md` en el proyecto destino. Extender esto para crear un archivo `AI_MEMORY.md` versionado con el repositorio que capture: decisiones de arquitectura con su razón (no solo la decisión), convenciones de naming aprobadas, anti-patrones específicos del proyecto, y reglas de negocio críticas. Este archivo se actualiza en cada fase y nunca se borra.

### 5.2 Context Budget Manager
Un skill transversal que, antes de iniciar cualquier fase, calcula explícitamente qué archivos son necesarios y cuáles deben ser **excluidos** del contexto. En lugar de decir "ignora el pasado" (instrucción negativa, difícil de seguir), define una whitelist positiva: "solo estos archivos son válidos para esta tarea".

### 5.3 Modelo de IA por Fase
Basado en el modelo de Superpowers de seleccionar el modelo más barato que puede hacer la tarea:
- Levantamiento + Arquitectura + UX → Opus (máxima capacidad de razonamiento)
- Planificación de specs → Sonnet
- Ejecución TDD → Sonnet (o Haiku para tareas muy simples)
- Auditoría → Opus (revisión crítica)

### 5.4 Impact Ripple Analysis
En el skill `09-nueva-funcionalidad`, añadir un proceso de análisis de "qué specs completados podrían ser afectados" comparando las entidades de negocio del nuevo feature contra las entidades en specs existentes.

### 5.5 Visual Brainstorming para UX
El `03-diseno-ux-frontend.md` podría integrar el Visual Companion de Superpowers (que genera mockups en browser) para que el flujo UX sea realmente visual, no solo textual.

---

## 6. Plan de Mejoras Priorizadas

### Prioridad 1 — Crítico (Framework Roto sin Esto)

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Hacer `02-arquitectura` tecnológicamente agnóstico, leer el stack definido en `00-setup` | Alto | Crítico |
| 2 | Eliminar rutas absolutas; usar paths relativos o variable configurable | Medio | Crítico |
| 3 | Rediseñar descripciones de skills con CSO (triggering conditions, no resumen de flujo) | Bajo | Alto |

### Prioridad 2 — Alta (Calidad Significativamente Mejor)

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 4 | Añadir skill equivalente de `subagent-driven-development` para Fase 6 | Alto | Alto |
| 5 | Añadir `verification-before-completion` como skill transversal | Bajo | Alto |
| 6 | Expandir `05-planificacion` para generar implementation plans con rutas/comandos exactos | Medio | Alto |
| 7 | Añadir `finishing-a-development-branch` para cierre de ROADMAP | Medio | Medio |
| 8 | Añadir `writing-skills` para que usuarios puedan crear skills validados | Medio | Alto |

### Prioridad 3 — Importante (Adopción y Madurez)

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 9 | Crear sistema de instalación/distribución (plugin en marketplace o script) | Alto | Alto |
| 10 | Añadir soporte multi-plataforma (`GEMINI.md`, `AGENTS.md`) | Medio | Medio |
| 11 | Añadir `receiving-code-review` para Fase 7 rechazos | Bajo | Medio |
| 12 | Añadir `dispatching-parallel-agents` para epics independientes | Medio | Medio |
| 13 | Añadir git worktrees antes de Fase 6 | Bajo | Medio |

---

## 7. Comparativa Consolidada

| Dimensión | VibeCoding | Superpowers | Ventaja |
|-----------|-----------|-------------|---------|
| Ciclo de vida completo (idea→código) | ✅ 7 fases explícitas | ⚠️ Parcial (falta levantamiento de negocio) | VibeCoding |
| Análisis de negocio / actores | ✅ Fase 1 socrática | ❌ No existe | VibeCoding |
| UX/UI planning | ✅ Fase 3 con dual route | ❌ No existe | VibeCoding |
| ROADMAP como brújula macro | ✅ Explícito con estados | ❌ No existe | VibeCoding |
| Agnóstico a tecnología | ❌ Hardcoded .NET | ✅ Completamente | Superpowers |
| Ejecución con subagentes | ❌ No existe | ✅ Two-stage review | Superpowers |
| TDD discipline | ✅ Integrado en Fase 6 | ✅ Skill dedicado | Empate |
| Debugging sistemático | ✅ Protocolo 4 fases + log | ✅ Protocolo 4 fases | Empate (debug log = ventaja VC) |
| Verificación antes de completar | ❌ No existe | ✅ Skill dedicado | Superpowers |
| Git worktrees | ❌ No existe | ✅ Integrado | Superpowers |
| Writing skills (meta) | ❌ No existe | ✅ TDD para docs | Superpowers |
| Instalación y distribución | ❌ Manual con rutas absolutas | ✅ Plugin marketplace | Superpowers |
| Multi-plataforma | ❌ Solo Claude Code / Antigravity | ✅ 5 plataformas | Superpowers |
| CSO (descubrimiento de skills) | ❌ Descripciones de flujo | ✅ Triggering conditions | Superpowers |
| Receiving code review | ❌ No existe | ✅ Skill dedicado | Superpowers |
| Soporte en español | ✅ Nativo | ❌ Solo inglés | VibeCoding |

---

## 8. Veredicto Final

VibeCoding tiene una **visión más ambiciosa y correcta** que Superpowers para el problema completo del desarrollo de software asistido por IA — desde la idea hasta el código. La columna vertebral del framework (Levantamiento → Arquitectura → UX → ROADMAP → Spec → Ejecución) es sólida y superior a Superpowers en cobertura del ciclo de vida.

El problema es que **la implementación actual no está a la altura de la visión**. El lock-in tecnológico invalida el requisito más importante, la distribución está rota para cualquier otra máquina, y faltan los skills operacionales que hacen que un framework sea confiable en producción (verificación, subagentes, writing-skills).

La estrategia correcta es clara: tomar la arquitectura de ciclo de vida de VibeCoding (que Superpowers no tiene) y las mejores prácticas de calidad de Superpowers (que VibeCoding no tiene), y fusionarlas. VibeCoding puede ser genuinamente mejor que Superpowers si resuelve los problemas críticos — no necesita reemplazarlo, necesita incorporar sus mejores lecciones aprendidas.
