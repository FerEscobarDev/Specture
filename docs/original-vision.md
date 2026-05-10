# Requerimientos del proyecto VibeCoding

1. Debe tener las herramientas, agentes y skills necesarias para llevar a cabo un flujo de desarrollo de software completo a partir de una idea permitiendo definir todas las reglas de negocio, la arquitectura, las tecnologias a utilizar, entre otras, en información especializada para entendimiento de la IA teniendo en cuenta que se llevará a cabo SDD (Spec Driven Development).

2. Se debe poder iniciar desde cero o a partir de un proyecto ya iniciado, leyendo la documentación y código existente de la idea planteada para llevar a cabo el SDD e identificar el punto en que se encuentra el proyecto, qué hace falta y que se debe corregir así como igualmente hacer preguntas de los vacíos que puedan existir para continuar el flujo de desarrollo.

3. Deber se posible una vez ya se tiene toda la info del proyecto poder ir ejecutando por partes y retomar según lo definido en el ROADMAP generado al inicio del flujo de SDD.

4. Debe tener la capacidad de gestionar bugs encontrados y entenderlos realizando las preguntas necesarias al usuario para lograr su corrección o desarrollo.

5. Debe manejar flujos de diseño diferentes para el frontend segun la necesidad del usuairo, uno donde se deba definir paleta de colores y diseño completo de la marca, otro donde ya se tenga marca definida con la paleta de colores, etc, Adicionalmente debe siempre primero definir el design system y el mapa de navegación con los detalles necesarios para cada pantalla a desarrollar teniendo en cuenta siempre la información del negocio y los requerimientos del proyecto priorizando la experiencia de usuario (UX) y la usabilidad, así como la accesibilidad y las mejores prácticas de diseño y nunca definir código o ejemplos de código en esta fase, por último según lo que desee el usuario podra proceder a desarrollar el frontend o delegar el desarrollo del frontend a Claude Design con los requerimientos definidos para luego tomar la información que genere Claude Design y continuar con el flujo de desarrollo. 

6. Debe poder manejar features nuevas del proyecto y entenderlas realizando las preguntas necesarias al usuario para lograr su desarrollo.

7. La idea es que pueda ser personalizable a muchos lenguajes, arquitecturas, reglas y convenciones mediante archivos de configuración y plantillas que el usuario pueda añadir por medio de un archivo md cómo claude.md o cualquier otro una vez se lea cada agente, skill o tool, etc debe tomarlos por lo que se me ocurre que la herramienta con base en lo que le especifique el usuario cree sus propios archivos de configuración y memoria de las reglas y convenciones que debe seguir por lo que debe existir la herramienta para que el usuario la llame y la configure o actualice cuando lo desee y todo quedar dentro del proyecto para que sea versionable. 

**Notas importantes:**  
- La estructura de carpetas que creará para llevar la documentación y specs debe ser propuesta siguiendos los mejores estandares en el manejo de SDD.  
- El nuevo proyecto se debe basar y tomar lo que le sirva, así como las mejores prácticas y estandares utilizados en el proyecto superpowers, para tener un punto de partida sólido.
- Se debe investigar a fondo las mejores prácticas para la generación de skills, hooks, agents, tools, etc para IA.
- El foco será usarlo con Claude Code
- Se debe realizar un analisis profundo para la limpieza de contexto y generar únicamente el contexto necesario que se requiera para cada fase para optimizar el uso de tokens
