# VibeCoding Framework

Aquí se inicia el desarrollo de VibeCoding herramienta para ayudar a programadores a generar código con IA desde una fase inicial de una idea hasta llegar a un producto final.

VibeCoding es un framework y CLI asistido por IA diseñado para aplicar metodologías de ingeniería de software estructuradas al desarrollo impulsado por IA. Abandona el caos del "prompting" ad-hoc en favor de un enfoque estricto y en 5 fases, garantizando código de alta calidad, testeado, y una arquitectura escalable.

## Las 7 Fases de VibeCoding

1. **Levantamiento de Información (`01-levantamiento`)**:
   La IA usa el método socrático para extraer de ti la idea del proyecto, aterrizando los requerimientos y definiendo las reglas de negocio estrictas, eliminando ambigüedades tempranamente.

2. **Diseño de Arquitectura (`02-arquitectura`)**:
   Definición estricta de la estructura técnica usando .NET (C#), Entity Framework Core, PostgreSQL y un enfoque de Domain-Driven Design (DDD) y CQRS con arquitectura Monolito Modular. Incluye la selección del framework Frontend (Angular, React, Nextjs, Flutter).

3. **Diseño UX/UI Frontend (`03-diseno-ux-frontend`)**:
   Planificación de la experiencia de usuario y arquitectura de información. Ofrece dos rutas:
   - *Ruta 1 (Delegada)*: Genera mapa de navegación y specs visuales para delegar la codificación UI a IAs especializadas en diseño (ej. Claude Design).
   - *Ruta 2 (Design System First)*: Construye un Design System interno completo para ser codificado posteriormente en la Fase 6 por VibeCoding.

4. **Generación de ROADMAP (`04-generador-roadmap`)**:
   La IA consolida todo el contexto generado en un documento único de alto nivel (`ROADMAP.md`). Este archivo será la única brújula a nivel macro.

5. **Planificación y SDD (`05-planificacion`)**:
   La fase crítica donde el ROADMAP se desglosa en Especificaciones concretas usando Spec Driven Development (SDD). Los archivos generados (`.spec.md`) contienen **sólo reglas e instrucciones claras**, prohibiendo la inclusión de ejemplos de código para evitar que la IA alucine o asuma implementaciones. 

6. **Ejecución (`06-agente-ejecutor`)**:
   La IA limpia su contexto, lee *únicamente* la Especificación de turno, y la implementa usando estricto TDD (Test-Driven Development). Una vez que la prueba pasa y la regla se cumple, el contexto se limpia y se avanza a la siguiente tarea.

7. **Auditoría de Código (`07-auditoria-codigo`)**:
   Actúa como un *Code Reviewer* estricto. Audita el código generado por la Fase 6 comparándolo contra la Arquitectura y el Design System, produciendo reportes de error detallados sin intentar parchar el código automáticamente.

## Instalación y Uso

VibeCoding no es un programa que instalas tradicionalmente (`.exe` o `npm global`), sino un **Plugin de Comportamiento** (conjunto de habilidades/skills) que se inyecta en agentes de IA como Claude Code o Antigravity para que operen bajo esta estricta metodología. El agente de IA actúa como tu CLI, ejecutando comandos de terminal por ti guiado por estos skills.

### En Antigravity (Google Gemini)

Antigravity puede leer contexto local de forma nativa. Para usar VibeCoding:

**Modo Manual (Para iniciar un proyecto):**
1. Abre una nueva conversación limpia.
2. Escribe: *"Lee el archivo `c:\Proyectos\VibeCoding\skills\01-levantamiento.md` y asume tu rol. Mi idea de proyecto es [Tu Idea]."*
3. Sigue las instrucciones del agente. Cuando termines una fase, pídele que lea el siguiente skill (ej. `02-arquitectura.md`).

**Modo Automático (Para la Fase de Ejecución):**
Cuando estés construyendo el código, crea un archivo `GEMINI.md` en la raíz de tu proyecto en desarrollo y añade la siguiente línea para que Antigravity siempre asuma el rol ejecutor:
```markdown
@c:\Proyectos\VibeCoding\skills\05-agente-ejecutor.md
```

### En Claude Code

Claude Code busca reglas en un archivo local llamado `CLAUDE.md`.

1. En la carpeta raíz de tu nuevo proyecto, crea un archivo `CLAUDE.md`.
2. Añade las siguientes instrucciones para inyectar VibeCoding:

```markdown
# Reglas VibeCoding
Estás operando bajo el framework VibeCoding. Antes de hacer cualquier cosa, debes obedecer el skill correspondiente a la fase actual.
- Si el proyecto está vacío, lee: `c:\Proyectos\VibeCoding\skills\01-levantamiento.md`
- Si ya hay un ROADMAP, lee: `c:\Proyectos\VibeCoding\skills\04-planificacion.md`
- Si estás implementando un Spec, lee ESTRICTAMENTE: `c:\Proyectos\VibeCoding\skills\05-agente-ejecutor.md`
```

3. Abre tu terminal, lanza `claude` y simplemente dile: *"Inicia la Fase 1"*. Claude leerá el archivo referenciado y se transformará en el CLI de VibeCoding.