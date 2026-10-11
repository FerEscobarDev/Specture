> **Estado: baseline TDD-for-docs de la alineación de reglas (v2.8.0). RED y GREEN corridos el
> 2026-10-11.** RED con copias congeladas de los `AGENT.md` de v2.7.0 (implementer,
> ux-implementer, code-reviewer, spec-planner); GREEN con las versiones de v2.8.0. Metodología:
> `skills/write-skill/SKILL.md`. Lo mecánico (la partición de `R-FILE-003`, la migración
> `2.8-rules-core-scope`, el aviso `rules-tag-unreachable`) vive en los tests
> (`hooks/test/rules.test.js`, `migrations/test/rules-core.test.js`,
> `hooks/test/doctor-check.test.js`).

# Baseline de la alineación de reglas — implementer vs. reviewer

## La condición que lo disparó

Un usuario reportó que el code-reviewer encuentra de forma recurrente los mismos tipos de
errores, incluso de reglas ya registradas en `rules.yml`. El análisis señaló tres causas
estructurales:

1. **Choque de instrucciones en el implementer.** Su Iron Rule 2 ("Minimum code first… no
   abstractions not demanded by tests") y su Step 2 ("If you need an interface, justify it with
   an ADR or convention. Otherwise, use a concrete type") dejaban fuera a las reglas `R-*`: una
   abstracción que solo pedía `R-SOLID-001` contaba como "prematura".
2. **Asimetría de rigor.** El reviewer recorre la cláusula `verificar:` de cada regla
   (Dimensión 7); el autochequeo del implementer (Step 6) no mencionaba `RULES_RESOLVED` ni
   `CUSTOM_RULES`.
3. **Tags que nunca resuelven.** La plantilla sugería tags conceptuales (`[dto, domain]`,
   `[naming]`) que no coinciden con módulo, componente ni capa: la regla nunca entra en
   `RULES_RESOLVED` y solo la revisión de cumplimiento (que lee todas) la reporta.

Más la decisión del usuario sobre el núcleo: constantes y hooks son de frontend, y una constante
puede quedarse en el archivo del componente solo si no se reutiliza en otro lado.

## Resultados — sondas de conducta

Escenarios en el scratchpad de la sesión (`probes/scenarios.md`); formato DECISIÓN · CÓDIGO ·
REPORTE · JUSTIFICACIÓN con cita textual. Modelo de cada sonda = el del agente (implementer y
ux-implementer en sonnet; reviewer y planner en opus).

| # | Escenario | Exigido v2.8 | RED v2.7.0 | GREEN v2.8.0 | Veredicto |
|---|---|---|---|---|---|
| I1 | Implementer backend: servicio de aplicación consume una clase de infraestructura; la convención §3 **y** `R-SOLID-001` piden abstracción; la Superficie no declara la interfaz | `BLOCKED: spec` nombrando la interfaz | `BLOCKED: spec` (la convención §3 cuenta como justificación del Step 2) | `BLOCKED: spec` con las dos rutas | PASA; **no discrimina** |
| I1b | Igual que I1 **sin** la convención §3: solo `R-SOLID-001` pide la abstracción | `BLOCKED: spec` nombrando la interfaz | depende de `SmtpEmailSender` concreto y reporta `DONE_WITH_CONCERNS` citando "If you need an interface, justify it with an ADR or convention. Otherwise, use a concrete type" y "Minimum code first" | `BLOCKED: spec`, cita "Required = a rule in `RULES_RESOLVED` (e.g. `R-SOLID-001`…)" y la fila "The rule is only IMPORTANT, minimum code wins" | PASA (discrimina) |
| I2 | Implementer: función pura estática sin colaboradores (guarda de sobre-diseño) | sin interfaz, `DONE` | sin interfaz | sin interfaz, cita "A pure function or a class with no collaborators needs no interface" | PASA (guarda: el arreglo no sobre-diseña) |
| I3 | ux-implementer: constante de negocio usada en dos componentes y umbral usado solo en uno; Superficie sin archivo de constantes | la compartida → `BLOCKED: spec` con `src/constants/<dominio>.ts`; la local se queda | `BLOCKED: spec`, pero saca también la local (la `R-FILE-003` vieja no distinguía) | `BLOCKED: spec` por la compartida; la local no exportada queda en `PatientCard.tsx` | PASA (discrimina por la regla nueva, no por el prompt) |
| I4 | `RULES_CHECK` en el reporte | una línea por regla | ausente en I1, I1b, I2 e I3 | presente en las cuatro, con evidencia `archivo::símbolo` | PASA (discrimina) |
| R1 | Reviewer sobre el diff de I2 | ningún hallazgo `R-SOLID-001` | `APPROVED`, sin hallazgos ("no hay principio concreto que citar") | — | **no se cambió** el reviewer |
| R2 | Reviewer sobre el diff acoplado de I1 | `R-SOLID-001` (DIP) | `IMPORTANT` en D2 (§3) y en D7 (`R-SOLID-001`) | — | **no se cambió** el reviewer |
| P1 | Planner, epic frontend con hook y constante compartida | declara `Crea:` del hook y de la constante | declara types, constante (`src/constants/search.ts`) y hooks en sus archivos | — | **no se cambió** el planner |

### Lo que el plan preveía y no se hizo (por falta de un RED que falle)

- **code-reviewer**: el plan añadía a la Dimensión 3 la misma frontera "abstracción especulativa
  vs. requerida". R1 y R2 muestran que el reviewer ya la aplica: no se tocó.
- **spec-planner**: el plan le pedía declarar los archivos que exigen las reglas de estructura.
  P1 muestra que ya lo hace cuando las reglas le llegan en `RULES_RESOLVED`: no se tocó. Su
  límite real es otro — si la regla no le llega (tags que no resuelven), no la ve — y eso lo
  cubre `rules-tag-unreachable`.
- **`EPIC_LOOP.md`**: pasarle el `RULES_CHECK` del implementer al reviewer se descartó: anclaría
  al reviewer en la auto-evaluación del implementer, y la Dimensión 7 ya recorre cada regla.

## REFACTOR (aplicado tras GREEN)

1. En I1/I1b el implementer marcó `R-SOLID-001 ✗` como causa del `BLOCKED: spec`, no como
   `DONE_WITH_CONCERNS`. El formato decía "(only with DONE_WITH_CONCERNS)"; ahora admite también
   "as the cause of a `BLOCKED: spec`" (implementer y ux-implementer).

## Hallazgos fuera de alcance (anotados, no corregidos)

- **Doble conteo D2/D7 en el reviewer** (R2): la regla anti-duplicado solo nombra la deny-list
  de §4; una prohibición de §3 que también es `R-SOLID-001` sale dos veces. El veredicto no
  cambia (ambas `IMPORTANT`) pero el informe infla el recuento.
- **`CAUSE` solo para BLOCKERs**: un `IMPORTANT` que nace de la Superficie del spec sale con
  `CAUSE: none` y no llega a `build-metrics.jsonl`.
- **Línea de estado**: con `BLOCKED: spec`, el implementer a veces escribe `STATUS: BLOCKED` y
  deja el `spec <ID>` en `CONCERNS`; el epic-agent lo lee igual, pero la forma canónica es
  `STATUS: BLOCKED: spec <ID>`.

## Qué no prueba este baseline

- Que en un epic real la tasa de `REJECTED_MINOR` por reglas baje: lo mide `review_rejections`
  en `knowledge stats` sobre las próximas tandas.
- El costo de los `BLOCKED: spec` adicionales (I1b ahora vuelve al planner en vez de entregar con
  concerns): un loop de corrección por spec cuya Superficie omitía la abstracción. Es el precio
  de no entregar código que el reviewer o la revisión de cumplimiento van a marcar.
