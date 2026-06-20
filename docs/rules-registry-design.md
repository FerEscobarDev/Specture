> **Estado: DISEÑO — no implementado aún.** Documento de diseño de la Fase 3 del
> plan maestro (registro de reglas invariantes + reglas de proceso). Objetivo de
> release: **v1.10.0**. Decisiones cerradas con el usuario el 2026-06-19 (forks
> Q1/Q2); la implementación ocurre en una fase posterior con la disciplina
> `write-skill` (baseline → cambio → verify). Independiente de la Fase 2 — se
> puede construir antes o después.

# Plan de diseño: Registro de reglas invariantes + reglas de proceso

## Context

Specture no tiene mecanismo para **reglas de desarrollo que nunca cambian y aplican en todo el proyecto** (ej. "DTOs inmutables para DDD", "cómo se nombran los métodos", "de dónde nace cada rama"). El usuario las puso en `CLAUDE.md` y no funcionaron: **los agentes de contexto restringido no leen `CLAUDE.md`** ([code-reviewer:28](agents/code-reviewer/AGENT.md#L28): *"Anywhere else it does not exist"*).

**Hallazgo clave que define el diseño:** `conventions.md` **YA llega** al implementer y al code-reviewer (está en sus Required Inputs). Entonces poner las reglas en `conventions.md` resuelve "las reglas no llegan a los agentes" **sin maquinaria nueva**. Un `rules.yml` con routing selectivo es el upgrade escalable, no un requisito de v1.

**Dos familias de reglas, dos consumidores:**
- **Código / naming** (DTO inmutable, naming de métodos) → las aplica el *implementer/ux-implementer*, las enforça el *code-reviewer*.
- **Proceso / workflow** (rama, commit, PR) → las consume el *orquestador del build*. Hoy no tienen hogar (conventions §1-9 son de código; el branching no existe en el build loop).

## Decisiones cerradas

| # | Decisión | Elección |
|---|----------|----------|
| **Q1** | hogar / formato | **Secciones en `conventions.md`** (lean): nuevas §12 Invariantes + §13 Workflow. Ya llegan a los agentes; cero archivo/toggle nuevo. `rules.yml` queda como graduación futura. |
| **Q2** | git-flow de proceso en v1 | **Crear la rama por regla, sin auto-merge.** El build crea la rama al iniciar la sesión; el merge/PR lo hace el usuario. |
| derivada | granularidad de rama | **Por sesión de build (el batch/feature), no por epic** — evita stacked-branches con dependencias; todos los epics encolados commitean a la misma rama, en orden. |
| derivada | toggles | **Ninguno nuevo.** La **presencia** de reglas en §12/§13 es el switch: sin §12 el reviewer no encuentra nada; sin reglas de rama en §13 el build NO crea ramas (comportamiento actual intacto). |
| derivada | lint/analyzer + hook | **Diferidos.** v1 enforça invariantes vía review (tier prosa) y proceso vía orquestador. |

## 1. `conventions.md` §12 — Invariantes del Proyecto (R-*)

Reglas enforzables con **ID estable**. Como `conventions.md` se pasa completo al implementer y al code-reviewer, **§12 los alcanza gratis** — sin routing.

```markdown
## 12. Invariantes del Proyecto (R-*)
> Reglas que NUNCA cambian y aplican en todo el proyecto. Las APLICA el
> implementer/ux-implementer al escribir código; las ENFORÇA el code-reviewer
> (Dimensión 7), citándolas por ID. Para patrones de más alto nivel, usá §3
> (allow-list) / §4 (deny-list).

| ID  | Ámbito (tag)  | Regla | Cómo verificar | Severidad | Racional / ADR |
|-----|---------------|-------|----------------|-----------|----------------|
| R-1 | dto, domain   | Los DTOs son inmutables (sin setters; campos readonly/final) | sin setters públicos ni mutación post-construcción | BLOCKER | DDD — ADR-00X |
| R-2 | naming        | Métodos query = sustantivo; comandos = verbo imperativo | nombres de métodos nuevos | IMPORTANT | §1 Naming |
```

- **Ámbito (tag):** organizativo en v1 (todo §12 llega a los agentes). Prepara la graduación a `rules.yml` con inyección selectiva si el set crece.
- **Severidad:** la regla declara si su violación es `BLOCKER` o `IMPORTANT` (el reviewer la respeta).
- **Relación con §3/§4:** §3/§4 son listas de patrones de arquitectura (ya chequeadas en Dim 2). §12 son reglas finas, enforzables y citables por ID. Complementarias.

### Cómo se aplican y enforzan
- **Alcanzan:** `conventions.md` ya está en los Required Inputs del implementer y del code-reviewer → §12 llega sin cambios de dispatch.
- **Aplican:** Iron Rule 4 del implementer ("Honor conventions") se extiende explícitamente a honrar los R-* de §12 al escribir código.
- **Enforzan:** nueva **Dimensión 7 — Invariantes del Proyecto** en `code-reviewer/AGENT.md`. Activa cuando §12 tiene R-* relevantes al diff. Cada finding cita el ID (`R-1 violado: el DTO X expone un setter`) con la severidad declarada por la regla.
- **No llega al tdd-test-writer** (a propósito): los tests verifican comportamiento, no cómo se escribe el código; el test-writer sigue ciego a invariantes de estructura.

## 2. `conventions.md` §13 — Workflow / Proceso (W-*)

Reglas de flujo que **sigue el orquestador del build**. No son reglas de código.

```markdown
## 13. Workflow / Proceso (W-*)
> Reglas de flujo de trabajo que el orquestador del build SIGUE. El build crea la
> rama según estas reglas (sin auto-merge); el implementer honra el formato de
> commit. Sin reglas de rama aquí, el build NO crea ramas (comportamiento actual).

### Branching — de dónde nace cada rama
| ID  | Tipo de trabajo | Rama base | Nombre |
|-----|-----------------|-----------|--------|
| W-1 | feature / epic  | `develop` | `feature/<slug>` |
| W-2 | hotfix / bug    | `main`    | `hotfix/<slug>` |

### Commits
- W-3: Conventional Commits; el cuerpo cita el spec (`Spec: docs/05-specs/...`).

### Pull Requests
- W-4: base de PR = `develop` (features) · `main` (hotfix). Specture NO crea ni mergea el PR — lo sugiere al cerrar la sesión.
```

### Cómo lo consume el build loop (decisión Q2 — crear, no mergear)
- **Al iniciar la sesión de build** (antes del queue loop): el orquestador lee §13, determina el tipo de trabajo (default `feature`; `hotfix` si el usuario lo indica o si viene de un flujo de bug/debug), y **crea la rama** desde la base configurada con el nombre configurado. `<slug>` se llena con el identificador de trabajo disponible (nombre de feature si vino de `new-feature`, milestone si el batch cae en uno, o el slug del primer epic). Si ya estás en una rama apropiada, lo confirma y no crea otra.
- **Granularidad = la sesión (el batch).** Los N epics de la cola commitean a esa única rama, en orden de dependencia → sin stacked branches.
- **Al drenar la cola:** el orquestador **NO mergea**. Anuncia: *"Trabajo completo en `feature/<slug>`. Merge/PR cuando quieras (base: `develop` por W-4)."*
- **Commit format:** el implementer ya honra el formato de commit de conventions (Step 7); ahora lee explícitamente W-3.

## 3. Backward-compat (cero fricción out-of-the-box)

- Proyecto **sin §12** → la Dimensión 7 del reviewer no encuentra reglas: no-op. Reviews idénticas a hoy.
- Proyecto **sin reglas de rama en §13** → el build **no crea ramas**: comportamiento idéntico a v1.9.0/v1.8.0.
- **Cero toggles nuevos** — la presencia de reglas es el switch. Coherente con el objetivo de aligeramiento (Fase 4 no hereda perillas de esta fase).

## 4. Alcance de implementación (para la fase de build futura)

- `templates/project-config/conventions.template.md` — agregar **§12 (Invariantes R-*)** y **§13 (Workflow/Proceso W-*)** con ejemplos + notas de "cómo se consume". (No tocar la numeración de §10/§11 — hay referencias a "Section 10" en el código.)
- `agents/code-reviewer/AGENT.md` — nueva **Dimensión 7 (Invariantes del Proyecto)**: lee §12 del `conventions.md` que ya recibe, cita violaciones por ID con la severidad declarada.
- `agents/implementer/AGENT.md` + `agents/ux-implementer/AGENT.md` — Iron Rule 4 se extiende a honrar los R-* de §12 al escribir código.
- `skills/build/SKILL.md` — nuevo paso "Branching (W-*)" al **iniciar la sesión** (crear rama si §13 la define; skip si no); anuncio de merge sugerido al drenar la cola; el implementer recibe la regla de commit (W-3) en su dispatch.
- `skills/setup/SKILL.md` — poblar stubs de §12/§13. Adopt: inferir la base de rama del git existente (¿hay `develop`?); reconfigure: actualizar.
- `skills/new-feature/SKILL.md` — pasar `tipo de trabajo = feature` al build para la regla de rama (nota menor).
- `README.md` — entrada de changelog **v1.10.0** (no reescribir historia) + bump de `plugin.json`.

## 5. Diferido (graduación futura, fuera de v1)

- **`.specture/rules.yml` + "Rules Resolution"** (inyección selectiva por tag, clon de Docs Index Resolution) — graduar cuando §12 crezca lo suficiente como para que pasar todo en cada dispatch sea caro. Medir antes (como la decisión de modularización de v1.7.0).
- **Generación de lint/analyzer** desde §12 (enforcement mecánico de invariantes de código).
- **Hook de git** que enforça la regla de rama (W-*) mecánicamente, estilo TDD Honesty Gate.
- **Auto-merge / creación de PR.**

## 6. Verificación

1. Disciplina `write-skill` por skill/agente tocado (baseline → cambio → verify).
2. Proyecto de prueba:
   - Definir R-1 (`dto`, BLOCKER, "DTOs inmutables") → construir un epic que crea un DTO con setter → el code-reviewer **rechaza citando R-1** como BLOCKER.
   - Definir R-2 (naming) → un método mal nombrado → finding IMPORTANT citando R-2.
   - Definir W-1 (feature → `develop`, `feature/<slug>`) → iniciar build → el orquestador **crea `feature/<slug>` desde `develop`**, la cola commitea ahí, y al terminar **sugiere el merge sin ejecutarlo**.
   - Proyecto **sin §12 ni reglas de rama en §13** → review y branching idénticos a v1.9.0 (backward-compat).
3. Grep sweep: ningún agente lee §12/§13 fuera de su `conventions.md` ya provisto; el branching solo lo ejecuta el orquestador (no los epic-agents).
