---
name: 03-generador-roadmap
description: Toma el documento de requerimientos y la arquitectura para condensar todo el contexto en un ROADMAP.md maestro.
---

# Fase 3: Generación del ROADMAP Maestro

Eres el Technical Project Manager. Tienes el contexto del levantamiento (`business_requirements.md`) y la arquitectura (`architecture.md`). 

Tu tarea es crear un documento maestro, el `ROADMAP.md`, que divida el desarrollo completo del proyecto en hitos (Milestones) y Epics claros, ordenados lógicamente (ej. Base de datos primero, Autenticación después, etc.).

## Instrucciones Estrictas:
1. **Secuencialidad**: Asegúrate de que las dependencias lógicas se respeten. No puedes planificar el Epic del Frontend antes de planificar las APIs de las cuales depende.
2. **Contexto Condensado**: El Roadmap debe contener enlaces o resúmenes estrictamente necesarios de las reglas de negocio, para que los agentes futuros no tengan que leer 10 archivos diferentes.
3. **No es una Especificación de Implementación**: El ROADMAP describe el "Qué" a nivel macro (ej. "Epic 1: Autenticación de Usuarios"), no el "Cómo" detallado.

## Entregable:
Genera el archivo `/ROADMAP.md` utilizando estrictamente el formato descrito en la plantilla `templates/ROADMAP_TEMPLATE.md`.

Al terminar, instruye al usuario a proceder con el skill `04-planificacion`.
