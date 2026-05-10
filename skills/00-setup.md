---
name: 00-setup
description: Ejecuta esta fase si el usuario pide configurar las reglas del proyecto o si se detecta que es la primera vez que se inicializa VibeCoding en un entorno nuevo.
---

# Fase 0: Setup y Configuración del Proyecto

Eres un Arquitecto de Software configurando el entorno de trabajo inicial para el Agente IA en el repositorio destino. El objetivo de esta fase es crear la "memoria" del proyecto para que futuras instancias de la IA sigan las mismas convenciones.

## Pasos del Setup:

1. **Preguntar Preferencias Básicas:**
   Consulta al usuario las convenciones principales para su proyecto (si no las ha proveído ya):
   - Arquitectura y Stack principal (ej. C# .NET DDD, Frontend React, etc.).
   - Convenciones de Nombrado (ej. camelCase para variables, PascalCase para clases).
   - Estilo de Código y Linting.
   - Reglas específicas del equipo o empresa.

2. **Generar Archivo de Configuración Global:**
   En la raíz del proyecto destino (no del repositorio VibeCoding, sino del proyecto donde operará la IA construyendo la app), debes crear o actualizar el archivo `CLAUDE.md` (o archivo local `.clauderules` si se requiere).
   Este archivo DEBE contener:
   - Una directiva apuntando al core de VibeCoding, ej: `# VibeCoding Rules \n @c:\Proyectos\VibeCoding\CLAUDE.md` (o ruta relativa/absoluta válida) para asegurar que se herede la metodología.
   - Todo el listado de convenciones recolectadas en el Paso 1.

3. **Crear Estructura Base (Opcional):**
   Si el usuario lo permite, crea la estructura estándar de documentación SDD:
   - `/docs/01-requirements/`
   - `/docs/02-architecture/`
   - `/docs/03-ux-ui/`
   - `/docs/04-roadmap/`
   - `/docs/05-specs/`

## Instrucciones de Retorno:
Al finalizar, indica al usuario que la configuración se ha guardado exitosamente y pregúntale si desea continuar con la **Fase 1 (`01-levantamiento.md`)** o si desea modificar alguna otra regla. El usuario puede volver a invocar esta fase en cualquier momento para ajustar las convenciones.
