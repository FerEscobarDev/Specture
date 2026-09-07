# Requerimientos de Negocio — Archivador

## Propósito
Cada empleado guarda documentos personales de trabajo (PDF e imágenes) y notas cortas, y puede etiquetar sus archivos para encontrarlos.

## Actores
- **Empleado** — sube, lista, etiqueta y elimina sus propios archivos; escribe notas.
- **Cliente interno (app web)** — consume el API en nombre del empleado *(consumidor externo)*.

## Historias de Usuario
- **HU-ARC-001:** Como empleado quiero subir un archivo para tenerlo en mi archivador · Actor: Empleado · Exposición: `UI`
- **HU-ARC-002:** Como empleado quiero ver la lista de mis archivos · Actor: Empleado · Exposición: `UI`
- **HU-ARC-003:** Como empleado quiero eliminar un archivo que ya no necesito · Actor: Empleado · Exposición: `UI`
- **HU-NOT-001:** Como empleado quiero crear una nota con título y cuerpo · Actor: Empleado · Exposición: `UI`
- **HU-ETQ-001:** Como empleado quiero etiquetar un archivo para encontrarlo después · Actor: Empleado · Exposición: `UI`

## Capacidades de Frontera
- **HU-ARC-001** — consumidor: app web — subir un archivo
- **HU-ARC-002** — consumidor: app web — listar los archivos del empleado
- **HU-ARC-003** — consumidor: app web — eliminar un archivo propio
- **HU-NOT-001** — consumidor: app web — crear una nota
- **HU-ETQ-001** — consumidor: app web — asignar una etiqueta a un archivo

## Reglas de Negocio
- **RN-001:** Un archivo pesa como máximo 10 MB y su tipo es `application/pdf`, `image/png` o `image/jpeg`; cualquier otro caso se rechaza con un error de validación.
- **RN-002:** Toda entrada de texto (título, cuerpo, nombre de etiqueta) se recibe sin espacios sobrantes en los extremos, no vacía y de a lo sumo 200 caracteres; si no cumple, se rechaza con un error de validación.
- **RN-003:** Un empleado no puede tener dos notas con el mismo título; el título se compara sin distinguir mayúsculas.
- **RN-004:** Si un empleado reintenta crear una nota con un título que ya tiene, la nota original se conserva intacta y el reintento se responde como conflicto (no se crea una segunda nota ni se sobreescribe).
- **RN-005:** El nombre de una etiqueta se normaliza a minúsculas y sin acentos antes de guardarse; un archivo admite como máximo 10 etiquetas.
- **RN-006:** Un archivo solo puede ser listado o eliminado por el empleado que lo subió; para cualquier otro empleado ese archivo no existe.

## Casos Límite
- **CL-001:** Título de nota vacío o solo espacios → error de validación (400).
- **CL-002:** Eliminar un archivo inexistente o ajeno → 404 `ARCHIVO_NO_ENCONTRADO`.

## Restricciones No Funcionales (de Negocio)
- Ningún archivo es visible para otro empleado.

## Fuera de Alcance
- **FA-001:** Compartir archivos entre empleados.
- **FA-002:** Búsqueda de texto completo dentro de los archivos.

## Glosario
- **Archivador** — el conjunto de archivos y notas de un empleado.
