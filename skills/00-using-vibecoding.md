---
name: 00-using-vibecoding
description: Úsalo siempre al iniciar cualquier interacción bajo VibeCoding. Establece cómo evaluar el estado del proyecto, encontrar la fase correcta y aplicar la disciplina de skills.
---

# 🦸‍♂️ Usando VibeCoding (Metodología SDD)

<EXTREMELY-IMPORTANT>
Si estás bajo el framework VibeCoding, NO PUEDES ignorar este skill.
Debes identificar en qué fase del proyecto te encuentras y usar el skill específico de esa fase ANTES de tomar cualquier acción o escribir código.
</EXTREMELY-IMPORTANT>

## Cómo determinar la Fase Actual y el Estado del ROADMAP

Si el usuario pide "Continuar con el roadmap" o no especifica una fase, DEBES evaluar el estado del proyecto:

1. **¿Existe un archivo `/docs/04-roadmap/ROADMAP.md`?**
   - **NO:** Entonces estás en una fase inicial. 
     - Si hay `/docs/01-requirements/`, ve a la Fase 2 (`02-arquitectura.md`).
     - Si no hay nada, ve a la Fase 1 (`01-levantamiento.md`).
   - **SÍ:** Abre y lee el `ROADMAP.md`. 
     - Revisa los checkboxes `[ ]` (pendiente), `[/]` (en progreso) y `[x]` (completado).
     - **Si hay tareas de planificación pendientes:** Ve a la Fase 5 (`05-planificacion.md`).
     - **Si hay especificaciones (`.spec.md`) listas pero no implementadas:** Ve a la Fase 6 (`06-agente-ejecutor.md`).
     - **Si el Roadmap está 100% en `[x]`:** Pregunta al usuario si desea auditar (`07-auditoria-codigo.md`) o añadir una nueva funcionalidad (`09-nueva-funcionalidad.md`).

## 🛑 Banderas Rojas (Red Flags)

Si piensas en alguna de estas frases, DETENTE, estás rompiendo la disciplina VibeCoding:

| Pensamiento | Realidad |
|---------|---------|
| "Es un cambio pequeño, puedo codificarlo directo" | Todo código debe estar respaldado por un Spec (`.spec.md`). |
| "Asumiré esta regla de negocio para avanzar más rápido" | Prohibido asumir. Debes preguntar al usuario. |
| "Voy a leer todo el repositorio para tener más contexto" | Desperdicio de tokens. Solo lee el Spec activo y los archivos mencionados en él. |
| "La prueba falló, voy a cambiar la lógica a ver si pasa" | Ley de Hierro: Cero fixes sin investigar la causa raíz (`08-depuracion.md`). |

## Regla de Limpieza de Contexto
- Cuando pases de la Fase de Planificación a la Fase de Ejecución, o entre specs, **DEBES limpiar tu contexto**. Si no puedes limpiar tu historial de chat directamente (según la interfaz que uses), **fuérzate** a ignorar instrucciones pasadas y concentrarte EXCLUSIVAMENTE en el contenido del archivo `.spec.md` actual. NO busques respuestas en el ROADMAP ni en la fase de arquitectura a menos que haya una inconsistencia grave.

## Prioridad de Instrucciones
1. **Instrucciones explícitas del Usuario** (CLAUDE.md, GEMINI.md, o un mensaje directo).
2. **Skills de VibeCoding** (este archivo y las fases 01-09).
3. **Comportamiento por defecto del sistema**.

## Siguiente Acción:
Invoca el skill de la fase que corresponda (ej. "Voy a usar `skills/01-levantamiento.md`") y sigue sus instrucciones.
