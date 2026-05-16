# Reporte: Oportunidades de Optimización de Tokens en Specture

> Análisis de todos los flujos, skills, agentes y herramientas del framework para reducir consumo de tokens manteniendo o mejorando la calidad — nunca disminuyéndola. Solo se recomiendan cambios cuyo beneficio justifica el costo.
>
> Fecha: 2026-05-15

## Tesis central

El framework tiene tres bolsas de tokens dispares por su **frecuencia de carga**:

1. **Hot path (carga por epic en cada ciclo de build):** `build/SKILL.md` + los 4 agentes especializados. Cada línea aquí se paga 1× por cada spec construido. Una línea bloat acá vale 100× una en `discover/SKILL.md`.
2. **Warm path (carga por sesión):** `CLAUDE.md`, `specture-router`, `start/SKILL.md`. Una vez por conversación.
3. **Cold path (una vez por proyecto):** `discover`, `architecture`, `ux-design`, `setup`, `modernize`. Optimizar acá es ganancia marginal.

**El leverage está concentrado en el hot path.** Se recomiendan solo cuatro intervenciones quirúrgicas (O1–O4). El resto se deja en paz: los recortes mayores tocan defensas activas (Iron Rules, Common Rationalizations) cuyo valor justifica el costo.

---

## Inventario con clasificación por frecuencia

| Archivo | Líneas aprox. | Frecuencia | Tokens amortizados |
|---------|--------------|------------|---------------------|
| `skills/build/SKILL.md` | ~290 | **Hot** (por epic) | Altísimo |
| `agents/tdd-test-writer/AGENT.md` | ~225 | **Hot** (por spec) | Altísimo |
| `agents/implementer/AGENT.md` | ~250 | **Hot** (por spec) | Altísimo |
| `agents/code-reviewer/AGENT.md` | ~240 | **Hot** (por spec) | Altísimo |
| `agents/architecture-validator/AGENT.md` | ~100 | **Hot** (por spec) | Alto |
| `CLAUDE.md` | ~30 | **Warm** (por sesión) | Alto |
| `agents/specture-router/AGENT.md` | ~50 | **Warm** (por sesión) | Alto |
| `skills/start/SKILL.md` | ~93 | **Warm** (por routing) | Medio-Alto |
| `skills/debug/SKILL.md` | ~125 | Cold (on demand) | Bajo |
| `skills/new-feature/SKILL.md` | ~110 | Cold (on demand) | Bajo |
| `skills/discover/SKILL.md` | ~104 | Cold (una vez) | Mínimo |
| `skills/architecture/SKILL.md` | ~111 | Cold (una vez) | Mínimo |
| `skills/ux-design/SKILL.md` | ~121 | Cold (una vez) | Mínimo |
| `skills/setup/SKILL.md` | ~180 | Cold (una vez) | Mínimo |
| `skills/modernize/SKILL.md` | ~360 | Cold (por migración) | Mínimo |
| `skills/verify/SKILL.md` | ~110 | Cold (referenciado) | Mínimo |
| `skills/write-skill/SKILL.md` | ~167 | Cold (raro) | Insignificante |
| Templates | varios | Por generación | Bajo |

---

## Hallazgos: lo que SÍ vale la pena

### O1 — Extraer tabla de violaciones TDD Honesty a referencia externa (APLICAR)

**Hot path. Patrón "progressive disclosure" — el detalle vive externo y solo se lee si la gate dispara.**

Hoy:
- `build/SKILL.md` Step 5.5 (~25 líneas): tabla de 4-5 tipos de violación + 3 opciones de recuperación.
- `code-reviewer/AGENT.md` Dimension 4 (~30 líneas): la **misma** tabla, más checks adicionales, y re-corre el mismo `git diff`.

Propuesta:
- Crear `docs/tdd-honesty-violations.md` (~40 líneas, carga 0× en happy path).
- `build/SKILL.md` Step 5.5 baja a ~6 líneas: corré el diff; si vacío → Step 6; si no → ver doc + classify + escalate.
- `code-reviewer/AGENT.md` Dimension 4 baja a ~6 líneas: consume el resultado de Step 5.5 (no re-ejecuta el diff); si fue violación, eleva BLOCKER citando el doc.

**Ahorro:** ~45 líneas del hot path en cada ciclo. Calidad: idéntica (defense in depth conservado, solo la profundidad explicativa se mueve a lectura on-demand). Adicional: una corrida de `git diff` menos por ciclo.

**Riesgo:** mínimo. La tabla solo es necesaria *cuando* hay violación, y entonces el agente la lee en una sola pasada.

---

### O2 — Mover "What the User Sees Differently with Hooks/Context7 Active" de skills a docs (APLICAR)

**Esos bloques son documentación de usuario, no instrucciones de comportamiento — el LLM los ingiere cada vez sin extraer behavior nuevo de ellos.**

Hoy presentes en `build/SKILL.md` (~8 líneas, hot), `debug/SKILL.md` (~6 líneas), `new-feature/SKILL.md` (~5 líneas), `modernize/SKILL.md` (~8 líneas).

Propuesta: mover a `docs/native-integration-guide.md` (ya existe y vive separado) y reemplazar cada bloque por una línea de referencia.

**Ahorro:** ~25 líneas combinadas, dos hot (build, debug). Calidad: nula pérdida — el LLM no usa esas secciones para decidir; eran descripción de comportamiento observable. El usuario sigue teniendo el contenido en docs/.

---

### O3 — Consolidar el "Worked Example" duplicado entre tdd-test-writer e implementer (APLICAR)

**Patrón DRY sobre los exemplars agregados en v1.3.0.**

Hoy: el mismo mini-spec (registro de email único) aparece en ambos archivos (~40 líneas cada uno = 80 totales en hot path).

Propuesta: una sola sección canónica con las dos mitades (RED tests + GREEN impl) en `templates/WORKED_EXAMPLE.md` o `docs/worked-example-spec-to-code.md`. Cada agente conserva ~6 líneas: referencia + la regla "use it as a PATTERN — write real code in the stack.yml framework".

**Ahorro:** ~65 líneas del hot path. Calidad: igual o mejor — un solo lugar es más fácil de mantener coherente; hoy editar uno y olvidar el otro genera divergencia.

---

### O4 — Tighten Step 9 (Context Reset) en build/SKILL.md (APLICAR)

**Hot path. La regla es corta; la prosa es larga.**

Hoy ~10 líneas con dos anuncios verbatim al usuario + un "RESET" reminder. El segundo bloque casi nunca dispara (el usuario rara vez se niega a resetear) y consume tokens en cada ciclo.

Propuesta: dejar el anuncio principal (3 líneas) + 1 línea para el caso de rechazo. Sin tabla, sin segundo bloque verbatim.

**Ahorro:** ~6 líneas. Calidad: igual — el comportamiento es idéntico.

---

## Hallazgos: probablemente NO vale la pena

### O5 — Consolidar Context Restriction clauses en los 4 agentes — NO APLICAR

Las diferencias entre agentes son significativas (code-reviewer SÍ permite Context7 para Dimension 5; tdd-test-writer rechaza implementación; implementer rechaza explorar codebase). Consolidar requeriría caveats por agente que pesan lo mismo. Leverage no compensa riesgo de pérdida de precisión.

### O6 — Trim "Common Rationalizations" tables — NO APLICAR

Cada fila es un caso que ya falló históricamente. Son los tokens que evitan los fallos más caros (un implementer que toca un test cuesta mucho más que sus 14 filas). Return alto aunque no firen en cada ciclo.

### O7 — Compress TaskCreate state mapping table (build Step 2.5) — OPCIONAL

Es prescriptivo: sin el mapeo el orquestador improvisa los `activeForm` y pierde consistencia. Si se toca, mover el mapeo a `docs/native-integration-guide.md` §4.1 (que ya lo tiene) y dejar una línea de referencia. Ahorro ~12 líneas. Vale la pena solo combinado con O2 (mismo patrón de "docs externas para mapeos de UX").

### O8 — Compress Output Format templates en agentes — NO TOCAR

El agente copia las plantillas con altísima fidelidad. ROI por token altísimo. Comprimir degrada parsing aguas abajo.

### O9 — Compress Dispatch Manifest (v1.3.0) — NO TOCAR

Cada ítem es esencial para el chequeo. Comprimir pierde la lista verificable.

### O10 — Redundancia CLAUDE.md ↔ specture-router — NO TOCAR

Cargan en contextos distintos (@import manual vs plugin). Consolidar arriesga romper uno de los dos modos por ~10 líneas.

---

## Resumen de ahorro recomendado

| Optimización | Líneas ahorradas en hot path | Riesgo | Aplicar |
|--------------|-----------------------------|--------|---------|
| O1 — Violaciones TDD a doc externo | ~45 | Mínimo | Sí |
| O2 — "User Sees Differently" a docs | ~25 | Nulo | Sí |
| O3 — Worked Example consolidado | ~65 | Mínimo | Sí |
| O4 — Tighten Step 9 | ~6 | Nulo | Sí |
| O7 — TaskCreate mapping a docs (opcional) | ~12 | Bajo | A criterio |
| **Total recomendado (O1–O4)** | **~141 líneas** | | |

A ~30-40 tokens por línea de prosa estructurada: **~4.5-5.5K tokens menos por ciclo de build**. Sobre un proyecto de 20 epics × ~3 specs (60 dispatches): **~270-330K tokens ahorrados** sobre la vida del proyecto. Sin pérdida de behavior — solo desbloat de prosa amortizada que no influye en decisiones del LLM.

---

## Principio subyacente

- Texto **denso y valioso** (Iron Rules, Common Rationalizations, Output Format templates, Context Restriction clauses) = tokens que **previenen fallos caros**. El return justifica el costo. No tocar.
- Texto **denso y descriptivo** (anuncios verbatim, tablas de mapeo UX, secciones "What you see differently", exemplars duplicados, classification tables para casos raros) = tokens que **documentan comportamiento sin modificarlo**. Migrar a `docs/` o consolidar sin pérdida.

Línea de corte: **"este texto cambia lo que el agente hace" → keep**; **"este texto explica lo que el agente hace" → docs/ externo**.
