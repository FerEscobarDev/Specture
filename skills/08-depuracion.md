---
name: 08-depuracion
description: Fase transversal de emergencia. Úsala cuando te atasques con un bug, cuando una prueba falle múltiples veces o cuando la auditoría rechace el código.
---

# Fase 8: Depuración Sistemática (Protocolo de Emergencia)

Estás en modo **Contingencia**. Las correcciones al azar desperdician tiempo y crean nuevos bugs. Los parches rápidos ocultan problemas subyacentes.

## LA LEY DE HIERRO
**ESTÁ ESTRICTAMENTE PROHIBIDO APLICAR CORRECCIONES (FIXES) SIN HABER INVESTIGADO PRIMERO LA CAUSA RAÍZ.** 
Si no has completado la Fase 1 y 2 de este proceso y rellenado el Log, no puedes proponer una solución.

## El Proceso de 4 Fases

Debes completar cada fase secuencialmente:

### Fase 1: Investigación de la Causa Raíz
1. **Lee los errores con cuidado:** No saltes advertencias, lee el stack trace completo.
2. **Rastrea el flujo de datos (Tracing):** Pregúntate: ¿De dónde proviene este valor incorrecto? Rastrea la llamada hacia atrás hasta encontrar el origen.

### Fase 2: Análisis de Patrones
1. **Encuentra ejemplos que funcionen:** Localiza código similar en el proyecto que sí esté funcionando.
2. **Identifica diferencias:** Compara el código roto con el código funcional. Anota las diferencias por pequeñas que sean.

### Fase 3: Hipótesis y Registro (OBLIGATORIO)
1. Formula **UNA SOLA HIPÓTESIS**. ("Creo que X es la causa porque Y").
2. **ACCIÓN OBLIGATORIA:** Crea o actualiza un archivo usando la plantilla `templates/DEBUG_LOG_TEMPLATE.md` en `/docs/debug_logs/`. No puedes escribir código hasta que este log esté documentado.

### Fase 4: Implementación y Testeo
1. Realiza el **CAMBIO MÁS PEQUEÑO POSIBLE** para probar tu hipótesis. No arregles múltiples cosas a la vez.
2. Verifica. Si funciona, documenta el éxito en el Log y regresa al skill anterior (`06-agente-ejecutor` o `07-auditoria-codigo`).
3. **Si el fix falla:** Formula una NUEVA hipótesis en el Log. 
   - **Límite Estricto:** Si has intentado 3 fixes y siguen fallando, DETENTE. Hay un problema de Arquitectura. Discute con el usuario si el patrón o diseño original es incorrecto en lugar de seguir parchando.
