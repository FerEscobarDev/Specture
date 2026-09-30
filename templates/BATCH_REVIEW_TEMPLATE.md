# Revisión de tanda — <slug>

> Registro de la etapa de revisión de `build` (`skills/build/REVIEW_STAGE.md`): una sola sentada
> de decisiones antes de ejecutar la tanda. Vive en `docs/05-specs/_reviews/<YYYY-MM-DD>-<slug>.md`
> (trackeado). Lo escribe el coordinador; `hooks/lib/review.js` lo lee (`status`, `scope-check`)
> y `/specture:doctor` lo vigila. Las líneas con `- CAMPO:` y los ítems `- A-n —`, `- F-n —`,
> `- PR-n —` tienen gramática fija; el resto es prosa. La recomendada nunca se aplica por defecto.

- ID: <YYYY-MM-DD>-<slug>
- ESTADO: PREPARANDO
- EPICS: <X.Y>, <X.Z>
- REGULATORIOS: (ninguno)

## POLÍTICAS
- P-1 — tope de rondas del refresco de cada epic: <respuesta> — fuente: <usuario <fecha> | pendiente>
- P-2 — tests viejos rotos por diseño (loop de supersesiones sin preguntar): <respuesta> — fuente: <…>
- P-3 — fallos preexistentes de la suite (línea base): <respuesta> — fuente: <…>
- P-4 — datos de pruebas (semillas, fixtures con datos personales): <respuesta> — fuente: <…>
- P-5 — acciones destructivas o sobre producción (migraciones, borrados, despliegues): <respuesta> — fuente: <…>
- P-6 — rama de trabajo de la tanda: <respuesta> — fuente: <…>
- P-7 — decisión nueva que aparece después del sello: aparcar el epic y seguir con los independientes (recomendada) | <otra> — fuente: <…>

## AGENDA
### Ronda 1
> Formato: `- A-n — <X.Y> — <dinero | legal | datos | contrato | ciclo-de-vida | roles | negocio | politica> — <pregunta cerrada> — respuesta: <texto | pendiente> — fuente: <usuario <fecha> | delegado por el usuario <fecha> | pendiente>`

### Ronda 2
> Solo preguntas nacidas de las respuestas (clase `derivada de A-n`) o LATE; misma gramática que la ronda 1.

## FILTRADAS
> Formato: `- F-n — <X.Y> — <pregunta> — resuelta por: <RN-nnn | ADR-nnn | contrato op | rules.yml R-n | revisión <id> A-n> — cita: "<texto>"`

## PREMISAS
> Formato: `- PR-n — <X.Y> — <borrador o bloque del epic>: "<premisa sobre el estado actual>" — <VERIFICADA | FALSA> <path:línea> [→ <A-n | VIOLATION>]`

## DECISIONES PERSISTIDAS
> Formato: `- A-n → <business_requirements.md RN-nnn (aclarado en revisión <id>) | ADR-nnn | _planning.md de <epic>>`

## SCOPE
> Formato: `- <X.Y>: SCOPE <sha12> — <ISO-8601>` (una línea por epic al cerrar, con `review.js scope-hash`)

## APARCADOS
> Formato: `- <X.Y> — <ISO-8601> — <clase> — <motivo>` (epics aparcados durante la ejecución)

## EJECUCIÓN
> Formato: `- <X.Y>: <pendiente | en curso | [x] <ISO-8601> | aparcado>` (una línea por epic de EPICS)

## MÉTRICAS
- review_rounds: 0 · review_questions: 0 · review_filtered: 0 · review_human_contacts: 0 · late_questions: 0 · premises_false: 0
