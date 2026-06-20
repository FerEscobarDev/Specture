# Adoption with Existing Docs + Continuous Knowledge Capture — Guía End-to-End

> **Audiencia:** equipos que adoptan Specture en proyectos maduros con documentación abundante preexistente (carpetas como `docs/`, `SGD.Docs/`, `Documentation/`, `wiki/` con decenas de archivos `.md`).
>
> **Disponible desde:** v1.7.0
>
> **Nota v1.11.0:** las skills `learn` y `audit-knowledge` se unificaron en `knowledge` (modos `capture`/`audit`); los comandos viejos siguen funcionando como alias. El toggle `learn.enabled` pasó a `knowledge.enabled`, y los sub-toggles `learn.min_session_threshold_minutes` / `learn.max_drafts_per_invocation` / `learn.write_human_report` se eliminaron (defaults fijos: 30 min / 3 drafts / sin reporte). Esta guía conserva la nomenclatura v1.7.0 por contexto histórico.
>
> **Documentos hermanos:**
> - [`adoption-with-existing-docs.md`](./adoption-with-existing-docs.md) — propuesta original y motivación.
> - [`continuous-knowledge-capture.md`](./continuous-knowledge-capture.md) — propuesta original de `/specture:learn`.
> - Este documento — guía de uso del MVP implementado.

---

## 1. ¿Para quién es esto?

Marcalo si:

- [ ] Tu proyecto tiene una carpeta de documentación con **≥10 archivos `.md`** mantenidos por el equipo.
- [ ] La documentación está organizada con criterio interno (no con la taxonomía `docs/01-`, `docs/02-` que Specture espera).
- [ ] Querés que los agentes de Specture (`architecture-validator`, `code-reviewer`) **aprovechen** esa documentación sin duplicarla ni reorganizarla.
- [ ] Querés que el equipo **acumule aprendizajes** a medida que avanza, sin perderlos al cerrar la conversación.

Si todo marca: esta guía es para vos.

Si solo marcaste el primero: probablemente solo necesitás **Fase 1 (adoption)**. Las fases 2 y 3 son opcionales.

Si no marcaste ninguno: tu proyecto es greenfield o tiene pocos docs — corré `/specture:setup` normalmente y no te preocupes por esto.

---

## 2. ¿Qué problema resolvemos?

### Antes del MVP

1. **`/specture:start` ruteaba ciego a `discover`** si no encontraba `docs/01-requirements/business_requirements.md`, aunque los requerimientos ya estuvieran escritos en otro lado. Re-extracción innecesaria.
2. **`architecture-validator` y `code-reviewer` eran ciegos** a `SGD.Docs/`, `Documentation/`, etc. — la doctrina de contexto restringido les prohíbe leer archivos al azar.
3. **Decisiones arquitectónicas implícitas** (multitenancy, doble token, legacy congelado) no tenían ADRs. El validator no podía aprobar/rechazar planes que las violaban.
4. **Aprendizajes evaporados** entre sesiones: el equipo redescubría la misma causa raíz dos o tres veces antes de que alguien la documentara.

### Después del MVP

1. `/specture:start` Step 2 hace **fallback al `docs-index.yml`** antes de routear a `discover`.
2. Los **orquestadores** (`build`, `architecture`) resuelven el índice y pasan docs relevantes a los agentes — los agentes siguen ciegos al disco (preserva caché, determinismo, paralelización).
3. `/specture:setup-docs-bridge` detecta decisiones implícitas y genera **ADRs `Proposed`** (nunca `Accepted` automáticamente — el equipo confirma).
4. `/specture:learn` captura aprendizajes post-epic y post-debug con **aprobación granular vía Plan mode**, máximo 3 drafts por invocación, log en JSONL.
5. `/specture:audit-knowledge` detecta drift del índice periódicamente y reporta — nunca auto-corrige.

---

## 3. Flujo end-to-end

### Fase 0 — Setup del proyecto

Si recién instalaste Specture en un proyecto Adopt:

```
/specture:setup
```

El skill detecta que es modo Adopt, escanea el stack, escribe `.specture/stack.yml` y `.specture/conventions.md`. Luego en **Step 8.5** escanea carpetas de docs preexistentes:

```
Detecté `SGD.Docs/` con 70 archivos .md mantenidos por el equipo.
Specture no debe re-extraer esa información — puedo generar un índice
machine-readable (.specture/docs-index.yml) y archivos puente para que
los agentes la lean de forma dirigida sin duplicar contenido. ¿Procedo? (S/n)
```

Si decís **sí**, se invoca el sub-skill `/specture:setup-docs-bridge`.

### Fase 1 — Generación del bridge + índice + ADRs

El sub-skill `setup-docs-bridge` corre 7 fases:

1. **Detection scan** (si invocado standalone) — encuentra la carpeta de docs.
2. **Categorization draft** — categoriza heurísticamente cada `.md` por path + keywords (lee solo las primeras 30 líneas). Te muestra el draft agrupado por categoría con `confidence: 0.0–1.0`. Aprobás en lote o reclasificás archivos específicos.
3. **Bridge generation** — escribe `docs/01-requirements/business_requirements.md`, `docs/02-architecture/architecture.md`, `docs/03-ux-ui/navigation_map.md` SI hay entradas para esa categoría. Los bridges **referencian** el doc fuente, no duplican contenido.
4. **Implicit ADR detection** — basado en `stack.yml` + keywords en los docs, lista ADRs candidatos (multitenancy, JWT, Strangler Fig, etc.). Aceptás los que aplican; se generan con `Status: Proposed — awaiting team confirmation`.
5. **Index write** — escribe `.specture/docs-index.yml` con todas las entradas aprobadas (`confidence: ai_categorized` para todas; promovés a `user_confirmed` manualmente luego).
6. **Conventions update** — agrega `Sección 11 — Índice de Documentación` a `conventions.md` con el contrato de actualización.
7. **Report** — resumen + próximos pasos.

**ROADMAP**: NO se autogenera. Te pregunta de dónde sacarlo (vacío con placeholder | deuda técnica | funcionalidades | diferido).

#### Estructura resultante

```
tu-proyecto/
├── .specture/
│   ├── stack.yml
│   ├── conventions.md            # ahora incluye §10 toggles + §11 índice
│   ├── docs-index.yml            # ← NUEVO: catálogo machine-readable
│   └── decisions/
│       ├── 001-adopted-stack.md  # Accepted (escrito por setup)
│       ├── 002-multitenant.md    # Proposed (escrito por setup-docs-bridge)
│       ├── 003-doble-token.md    # Proposed
│       └── ...
├── docs/
│   ├── 01-requirements/
│   │   └── business_requirements.md  # ← bridge a SGD.Docs/funcionalidades/
│   ├── 02-architecture/
│   │   └── architecture.md           # ← bridge a SGD.Docs/arquitectura/
│   └── 03-ux-ui/
│       └── navigation_map.md         # ← bridge si aplica
├── SGD.Docs/                          # ← NO se toca. Fuente de verdad del equipo.
│   ├── arquitectura/
│   ├── funcionalidades/
│   └── ...
└── .gitignore                         # incluye .specture/state/ y docs/.specture-meta/
```

### Fase 2 — Build con índice resuelto

Cuando corrés `/specture:build` y entra al loop de un epic:

- **Step 3 (architecture-validator dispatch)** — el orquestador lee el spec, extrae tags/conceptos (módulo, componente, backend/frontend), filtra el `docs-index.yml` por intersección de tags, ordena por score, toma top 3 (cap por `docs_index.max_entries_per_dispatch`), lee esos archivos y los pasa al validator como input adicional (`docs_index_resolved: [...]`). El validator NUNCA lee el índice — solo recibe los docs resueltos.

- **Step 6 (code-reviewer dispatch)** — misma lógica. El reviewer recibe los docs y los usa como contexto informativo. Si un finding depende SOLO de una entrada `ai_categorized` (no validada por humano), lo marca explícitamente en el reporte.

- **Log a `docs/.specture-meta/index-usage.jsonl`** — cada resolución se loguea. Permite medir si el índice se usa y qué entradas son útiles.

### Fase 3 — Captura continua con `/specture:learn`

**Toggle gate**: activá `learn.enabled: true` en `conventions.md` §10 cuando el proyecto madure.

#### Trigger 1: post-epic (Step 8.5 de build)

Al cerrar un epic con `[x]`:

```
Epic `auth-multitenant-token` completado. ¿Querés correr /specture:learn
para capturar aprendizajes (ADRs implícitos, entradas de docs-index,
patches a conventions)? Es opcional y no toca código. (s/N)
```

Si decís **sí**:
- `/learn` lee el review del epic + diff + epic block del ROADMAP.
- Cross-referencia contra `conventions.md`, ADRs existentes, índice.
- Prioriza gaps por impacto (ADR > docs-index > conventions > bridge > test-todo).
- Genera **max 3 drafts**.
- Entra a **Plan mode** con los drafts.
- Aprobás (atómico) → se aplica y commitea.
- Loguea a `learn-history.jsonl`.

#### Trigger 2: post-debug (Phase 4.5 de debug)

Cuando una hipótesis se confirma y el fix se commitea:

```
Causa raíz confirmada y fix commiteado. ¿La causa raíz aplica más allá
de este bug puntual (ej. otro módulo podría caer en lo mismo)? Puedo
proponer un ADR (regla "no hacer X"), una entrada en docs-index.yml o
un test caracterizador. Es opcional y no toca código. (s/N)
```

Si decís **sí**, `/learn` recibe el `DEBUG_LOG.md` como input y propone drafts a partir de la causa raíz.

#### Trigger 3: manual

```
/specture:learn
```

Sin trigger automático. Analiza la sesión reciente. Aplica filtro de relevancia (umbral `learn.min_session_threshold_minutes`, default 30).

Forzar sin filtro:

```
/specture:learn --force
```

#### Trigger 4: enseñanza activa (Teach mode)

Cuando querés **dictar** una regla nueva (no esperás que la IA la descubra):

```
/specture:learn --teach "regla de bloqueo de doble radicación"
```

Activa modo socrático: hasta 6 preguntas batched en grupos de 2-3, detección de ambigüedad, produce **1 draft** del tipo correcto (ADR | docs-index | conventions | bridge).

### Fase 4 — Auditoría periódica del índice

Cada 1-3 meses (o cuando sospeches que el índice está desactualizado):

```
/specture:audit-knowledge
```

Read-only. Detecta 4 tipos de drift:

| Finding | Severidad | Qué significa |
|---|---|---|
| **ORPHAN** | HIGH | Una entrada apunta a un archivo que ya no existe (movido / renombrado / borrado) |
| **DUPLICATE_CANDIDATE** | MEDIUM | Dos entradas con tags idénticos y `read_when` similar — posible redundancia |
| **STALE / VERY STALE** | LOW / MEDIUM | `last_verified` >180d / >365d — la categorización puede estar obsoleta |
| **UNCOVERED** | LOW | Doc existe en `source_of_truth_dir` pero no tiene entrada en el índice |
| **UNKNOWN_AGE** | LOW | Falta `last_verified` |

Genera:
- `docs/.specture-meta/last-audit.md` — reporte humano-legible con acciones sugeridas.
- `docs/.specture-meta/audit-history.jsonl` — log estructurado + health score (0-100).

**No auto-corrige**. El reporte te dice qué hacer; vos decidís cuándo aplicar.

---

## 4. Toggles importantes

Todos viven en `.specture/conventions.md` §10. Defaults conservadores — el framework no agrega fricción out-of-the-box.

| Toggle | Default | Cuándo activar |
|---|---|---|
| `docs_index.enabled` | `true` si existe el archivo | Casi siempre. Desactivar solo para debug aislado o si el índice está corrupto |
| `docs_index.max_entries_per_dispatch` | `3` | Subir solo si el promedio de hits por spec en `index-usage.jsonl` supera 3 |
| `learn.enabled` | `false` | Activar cuando el proyecto madure y la doc empiece a quedar atrás del código |
| `learn.min_session_threshold_minutes` | `30` | Bajar si querés learn más reactivo en sesiones cortas |
| `learn.max_drafts_per_invocation` | `3` | Mantener en 3. Bajar puede perder capturas, subir genera ruido |
| `learn.write_human_report` | `false` | Activar si el equipo hace revisiones periódicas de aprendizajes |

---

## 5. Mantenimiento del índice

### Cuando agregás un doc nuevo al repo

Opción A — manual (recomendado si es 1 doc):
- Editá `.specture/docs-index.yml` directamente.
- Agregá una entrada con `confidence: user_confirmed` y `last_verified: <hoy>`.

Opción B — automática (recomendado si son varios docs):
- Invocá `/specture:learn` en modo manual. Phase 2 detecta los docs nuevos como GAP y propone entries (con `confidence: ai_categorized`).

Opción C — refresh completo:
- Invocá `/specture:setup-docs-bridge` standalone. Regenera categorización para todo. Las entradas `user_confirmed` se preservan; las `ai_categorized` se recalculan.

### Cuando renombrás o movés un doc

- Actualizá `entry.file` en el índice. Eso es todo.
- Si te olvidás, `/specture:audit-knowledge` lo va a detectar como ORPHAN.

### Cuando borrás un doc

- Eliminá la entrada del índice.
- O marcala `superseded_by: <otro-concept>` si fue reemplazada por otra.

### Cuando un humano valida una categorización de la IA

- Cambiá `confidence: ai_categorized` → `confidence: user_confirmed`.
- Actualizá `last_verified: <hoy>`.

El orquestador prefiere `user_confirmed` sobre `ai_categorized` cuando ambos aplicarían al spec.

---

## 6. ADRs `Proposed` — política de promoción

Los ADRs generados por `setup-docs-bridge` o `/specture:learn` nacen con:

```markdown
## Status
Proposed — awaiting team confirmation
```

**El `architecture-validator` los ignora**. Solo valida contra ADRs `Accepted`. Esta es la salvaguarda: ADRs auto-generados no se vuelven ley sin confirmación humana.

Para promover un ADR a `Accepted`:

1. Discutir con el equipo. La IA infirió la decisión a partir de patrones en código + docs — puede estar mal o incompleta.
2. Editar `Status:` → `Accepted`.
3. Completar las secciones marcadas "To be completed by the team": Alternatives Considered, Consequences (Positivas / Negativas).
4. Eliminar la entrada del checklist en `conventions.md` §11.
5. Commit con mensaje: `docs(adr): accept ADR-NNN <slug>`.

Desde el siguiente dispatch del `architecture-validator`, el ADR es vinculante.

---

## 7. Diagrama de flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│  Proyecto Adopt con docs preexistentes                               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────┐         ┌──────────────────────────────┐
        │ /specture:setup  │────────▶│ Step 8.5: detect docs folder │
        │     (Adopt)      │         └──────────────┬───────────────┘
        └──────────────────┘                        │ ≥10 .md files
                                                    ▼
                            ┌───────────────────────────────────────┐
                            │ /specture:setup-docs-bridge           │
                            │  ┌────────────────────────────────┐  │
                            │  │ 1. Detection (skipped if from  │  │
                            │  │    setup)                       │  │
                            │  │ 2. Categorization (draft → user)│  │
                            │  │ 3. Bridges (docs/01-, 02-, 03-) │  │
                            │  │ 4. ADRs Proposed (lista usuario)│  │
                            │  │ 5. Write docs-index.yml         │  │
                            │  │ 6. Update conventions §11       │  │
                            │  │ 7. Report                       │  │
                            │  └────────────────────────────────┘  │
                            └───────────────────────────────────────┘
                                                    │
                                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │  /specture:start  →  /specture:build (loop por epic)     │
        │                                                          │
        │   Step 3 (architecture-validator) ────┐                  │
        │   Step 6 (code-reviewer)         ─────┤  (pre-flight)    │
        │                                       ▼                  │
        │   ┌────────────────────────────────────────────┐         │
        │   │ Docs Index Resolution (en orquestador):    │         │
        │   │  - tags from spec                          │         │
        │   │  - filter docs-index.yml                   │         │
        │   │  - top 3 (prefer user_confirmed)           │         │
        │   │  - log a index-usage.jsonl                 │         │
        │   │  - pass docs_index_resolved: [...] al agent│         │
        │   └────────────────────────────────────────────┘         │
        │                                       │                  │
        │                                       ▼                  │
        │   Agent recibe contexto enriquecido (sigue ciego al disco)│
        │                                                          │
        │   ... (resto del loop: tests → impl → review → verify)   │
        │                                                          │
        │   Step 8 — mark epic [x]                                 │
        │   Step 8.5 — opt-in /specture:learn (epic trigger)       │
        │   Step 9 — context reset                                 │
        └──────────────────────────────────┬───────────────────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │ /specture:learn        │
                              │  - filter relevance    │
                              │  - cross-reference     │
                              │  - max 3 drafts        │
                              │  - Plan mode confirm   │
                              │  - apply + commit      │
                              │  - log learn-history   │
                              └────────────────────────┘

        ┌─────────────────────────────────────────────────────────┐
        │  Periódicamente (1-3 meses)                              │
        │                                                          │
        │   /specture:audit-knowledge                              │
        │     - ORPHAN | DUPLICATE | STALE | UNCOVERED            │
        │     - reporte humano + JSONL                             │
        │     - health score                                       │
        │     - NO auto-corrige                                    │
        └─────────────────────────────────────────────────────────┘
```

---

## 8. Métricas para validar valor

Estas se computan leyendo los `.jsonl` en `docs/.specture-meta/`:

| Métrica | Cómo medirla | Meta |
|---|---|---|
| Selectividad del índice | `index-usage.jsonl`: ratio `resolved.length / total_in_index` | <0.1 (resolver bien filtra) |
| Adopción de `/learn` | `learn-history.jsonl`: count de invocaciones desde Step 8.5 / count de epics cerrados | >70% en proyectos con `learn.enabled: true` |
| Conversion de drafts | `learn-history.jsonl`: `drafts_applied / drafts_proposed` | >40% (sub-40% = falsos positivos, ajustar filtros) |
| Salud del índice | `audit-history.jsonl`: último `health_score` | >85 |
| Tokens por `/learn` | `learn-history.jsonl`: avg `tokens_estimated` | <30K |

Si alguna métrica está fuera de meta, ajustá toggles o reportá un bug.

---

## 9. Limitaciones conocidas del MVP

- **Categorización heurística** (`setup-docs-bridge` Phase 2) depende de keywords y nombres de carpeta. Carpetas como `notas-juan/`, `varios/`, `wiki/2023-q4/` caen a `other` y requieren reclasificación manual.
- **Resolución del índice basada en tags** funciona bien cuando el spec menciona explícitamente módulos/componentes. Specs muy abstractos pueden no traer hits.
- **No hay re-embedding ni RAG**. La resolución es determinista por tags. Si un concepto NO está taggeado correctamente, no se encuentra. Mitigación: `/specture:audit-knowledge` detecta UNCOVERED files; `/specture:learn` propone re-taggear.
- **`/specture:learn` no escribe a memoria personal de Claude**. Si querés guardar preferencias individuales, hacelo vos manualmente o pedile a Claude que las recuerde.
- **Plan mode atómico**: Plan mode aprueba/rechaza el bloque entero. Para aprobación granular real, re-invocás `/learn` con la lista de rechazados como exclusión.

Estas limitaciones son **conscientes** — cada una representa un tradeoff entre simplicidad/determinismo/control y automatización. Si alguna se vuelve dolorosa en un proyecto real, abrir issue para discutir la evolución.

---

## 10. Próximos pasos sugeridos

Si recién terminaste el setup con bridge:

1. **Revisar los ADRs `Proposed`** con el equipo. Promover a `Accepted` los que confirmen, completando las secciones "To be completed".
2. **Promover entradas del índice** de `ai_categorized` a `user_confirmed` a medida que el equipo valide las categorizaciones (especialmente las que aparecen frecuente en `index-usage.jsonl`).
3. **Activar `learn.enabled: true`** en `conventions.md` §10 cuando empieces a notar redescubrimientos.
4. **Programar `/specture:audit-knowledge` cada 1-3 meses** o cada vez que el equipo agregue muchos docs nuevos.

Si tenés feedback del flujo, dudas o casos que el MVP no cubre — anotalo y volvemos a iterar.
