# Adoption con Documentacion Preexistente — Findings y Propuesta

> **Origen:** sesion 2026-05-18 configurando Specture en el proyecto SGD (Sistema de Gestion Documental de Sinco ERP). SGD es un monolito modular maduro con ~17 anos de antiguedad, multi-frontend (Angular 6, React 18, AngularJS, WebForms), y una carpeta `SGD.Docs/` con ~70 documentos .md organizados en 9 subcarpetas con criterio interno del equipo (no con la taxonomia de Specture).
>
> Este documento captura el problema, las decisiones tomadas en SGD proyecto de ejemplo y pruebas para adopción y la propuesta para incorporar este escenario al `setup` skill modo **Adopt** de Specture.

---

## 1. El problema

El modo **Adopt** actual de `skills/setup/SKILL.md` esta optimizado para inferir el **stack tecnico** desde archivos de configuracion (`package.json`, `*.csproj`, `Cargo.toml`, etc.) y la estructura de codigo. No esta optimizado para **proyectos con documentacion abundante preexistente**.

Cuando un proyecto adoptado tiene una carpeta `docs/`, `Documentation/`, `wiki/`, `*.Docs/` o equivalente con decenas de archivos .md mantenidos por el equipo:

### Sintoma 1: Specture re-pide lo que ya esta escrito

Tras el setup, `skills/start/SKILL.md` ejecuta su routing:

1. ¿Existe `.specture/stack.yml`? Si.
2. ¿Existe `docs/01-requirements/business_requirements.md`? **No** -> enruta a `/specture:discover` para "levantar requerimientos desde cero sin tener en cuenta o preguntar al usuario si tiene documentación de la cual alimentarse".

Pero los requerimientos YA EXISTEN distribuidos en `SGD.Docs/funcionalidades/`, `SGD.Docs/gestion-equipo/`, `SGD.Docs/solicitudes-cliente/`. Re-extraerlos con `discover` es:

- Gasto de horas (el discover socratico es largo en proyectos grandes).
- Riesgo de divergencia con la documentacion real mantenida por el equipo.
- Frustracion del usuario: "ya escribi todo esto, ¿para que me lo pregunta?".
- Sólo preguntar ante dudas o ambiguedades.

### Sintoma 2: los agentes son ciegos a la documentacion del equipo

`architecture-validator`, `code-reviewer` y `tdd-test-writer` reciben `.specture/` como contexto. No reciben para este ejemplo `SGD.Docs/`. Cuando un agente necesita contexto adicional sobre "flujo de radicacion" o "multitenancy" o "doble token":

- No sabe que documento de `SGD.Docs/` leer.
- Si intenta listar `SGD.Docs/` recursivamente, gasta muchos tokens y aun asi tiene que adivinar.
- Termina o leyendo demasiado (40-60k tokens facilmente) o leyendo mal (escoge un doc tangencial y se pierde el detalle critico que estaba en otro).

### Sintoma 3: el setup produce ADRs pobres

Modo **Adopt** genera `001-adopted-stack.md` que documenta el stack. Pero en un proyecto maduro hay decenas de decisiones arquitectonicas tomadas implicitamente y nunca formalizadas:

- "Multitenancy por request via middleware" (no es una opcion — es invariante).
- "No try/catch en controllers" (regla del equipo, no obvia para un agente).
- "Migracion Strangler Fig Angular -> React" (define todo el patron de evolucion).
- "Doble token movil" (modelo de seguridad especifico).
- "Legacy `SGD.Core` congelado" (regla de scope de cambios).

Sin estos ADRs explicitos, `architecture-validator` no tiene base para aprobar/rechazar planes que los violan.

---

## 2. Que hicimos en SGD (referencia para el patron)

### 2.1. Mantener `SGD.Docs/` como fuente de verdad

No reorganizamos la documentacion del equipo. Hubiera sido invasivo, generaria conflictos con el flujo de trabajo del equipo y un PR enorme. Decision: **dejar `SGD.Docs/` intacta** y construir las piezas que faltan ALREDEDOR.

### 2.2. Crear archivos puente en `docs/` (la estructura que Specture espera)

Cada archivo es **denso, referencial, no duplica contenido**. Estructura repetida en cada uno:

- Encabezado claro: "Adopcion, no greenfield" + nota de cual es la fuente de verdad real.
- Tablas con `concepto | doc fuente` apuntando a `SGD.Docs/...`.
- Reglas resumidas (3-10 lineas) con link al detalle.
- Seccion final "Como leer este documento desde Specture" mapeando agente -> que necesita -> donde buscarlo.

Archivos creados:

- `docs/01-requirements/business_requirements.md`
- `docs/02-architecture/architecture.md`
- `docs/03-ux-ui/navigation_map.md`
- `docs/04-roadmap/ROADMAP.md` (este SI tiene contenido propio: epics extraidos de la deuda tecnica + roadmap + migraciones en curso)

Costo: ~1 hora de sintesis humana. Los puentes son CORTOS (200-300 lineas cada uno) precisamente porque referencian, no duplican.

### 2.3. Crear `.specture/docs-index.yml` — el catalogo machine-readable

Este es el componente nuevo que **no esta en Specture actual**. Esquema:

```yaml
schema_version: 1
last_updated: 2026-05-18
source_of_truth_dir: SGD.Docs/
entries:
  - concept: flujo-radicacion-correspondencia
    file: SGD.Docs/funcionalidades/flujo-radicacion-correspondencia.md
    read_when: feature en modulo Correspondencia que toque radicacion
    tags: [backend, frontend]
    related_code:
      - SGD.Correspondencia.Aplicacion/Comandos/Radicar*
      - SGD.React/src/correspondencia/radicacion/
```

- **`concept`** — slug estable. Sirve de clave.
- **`file`** — ruta relativa al repo. Lo que el agente debe leer.
- **`read_when`** — disparador en lenguaje natural. El agente decide si aplica al feature actual.
- **`tags`** — filtros estructurados (`backend`, `frontend`, `db`, `security`, `multitenancy`, `auth`, `testing`, etc.).
- **`related_code`** (opcional) — patrones glob que ayudan al agente a cruzar codigo con doc.

Catalogo total para SGD: 70+ entradas, ~700 lineas de YAML, organizado en secciones comentadas.

### 2.4. Enriquecer ADRs

Pasamos de 1 ADR (`001-adopted-stack.md`) a 6:

- `001-adopted-stack.md` (existia)
- `002-multi-tenant-per-request.md`
- `003-strangler-fig-angular-react.md`
- `004-no-try-catch-controllers.md`
- `005-doble-token-mobile.md`
- `006-sgd-core-legacy-frozen.md`

Cada uno tiene Context, Decision, Consequences, References. Captura decisiones IMPLICITAS que ya estaban tomadas pero no escritas.

### 2.5. Ampliar `conventions.md`

Agregamos:

- Seccion 9 (idioma del codigo — espanol).
- Seccion 10 (toggles Specture: hooks, context7).
- Seccion 11 (indice de docs apuntando al `docs-index.yml`).
- Seccion 12 (organizacion de archivos por modulo backend y feature React).

### 2.6. Actualizar `CLAUDE.md` raiz

Documentamos la coexistencia: `SGD.Docs/` para el equipo, `docs/` para Specture, `docs-index.yml` para los agentes. Regla nueva: cuando se cree documentacion nueva relevante, **actualizar el indice**.

---

## 3. Propuesta para Specture

### 3.1. Nuevo paso `4.6 — Existing Docs Adoption` en modo Adopt de `setup`

Insertar despues del paso 4 (detection scan) y antes del paso 5 (mostrar draft):

```markdown
### Paso 4.6 — Existing Docs Adoption (solo modo Adopt)

Busca directorios de documentacion preexistentes con .md files o preguntar al usuario si las tiene y donde. Patrones:

- `docs/`, `Documentation/`, `wiki/`
- `*.Docs/` (convencion .NET — ej. `SGD.Docs/`, `MyProject.Docs/`)
- `documentation/`, `documents/`
- Cualquier carpeta con README.md en la raiz que contenga >= 10 archivos .md

Si encuentra alguna con >= 10 archivos .md, hacer una pausa especial:

1. Anuncia: "Detecte documentacion preexistente en `<carpeta>`. Voy a proponer
   un indice y archivos puente para que Specture la pueda usar sin duplicarla."

2. Categoriza los archivos por contenido (lee primeras 30 lineas de cada uno y
   busca keywords/headings). Categorias y senales:

   | Categoria | Senales (headings, keywords) |
   |---|---|
   | architecture | "arquitectura", "architecture", "diagrama", diagrams mermaid de componentes |
   | requirements | "requerimientos", "user stories", "actores", "reglas de negocio" |
   | conventions | "convenciones", "conventions", "style guide", "naming" |
   | database | "BD", "database", "ERD", "tablas", "SP", "schema" |
   | functionalities | "flujo", "feature", "use case", subcarpetas tipo flows/ |
   | tech-debt | "deuda", "debt", "urgentes", "TODO", "hallazgos" |
   | roadmap | "roadmap", "plan", "milestone", "fase" |
   | team | "equipo", "team", "acuerdos", "SLA", "ANS" |
   | external | manuales en PDF/Excel, complementos, instalacion |

3. Pregunta al usuario:
   "¿Tienes documentación, reglas, convenciones e información relevante del proyecto existente?"

4. Si el usuario indica que existe:
   - Genera los puentes en `docs/01-requirements/business_requirements.md`,
     `docs/02-architecture/architecture.md`, `docs/03-ux-ui/navigation_map.md`
     usando el patron descrito en `docs/adoption-with-existing-docs.md`.
   - El ROADMAP NO se autogenera — el usuario decide su fuente (deuda tecnica,
     migraciones, vacio con epic placeholder o solo documentar las fuentes de los pendientes para hacer el levantamiento en el ROADMAP solo cuando se vaya a ejecutar). Preguntar y dejar marcado.

5. Genera `.specture/docs-index.yml` con una entrada por archivo categorizado.
   Schema en `docs/adoption-with-existing-docs.md` seccion 2.3.

6. Pregunta al usuario sobre ADRs implicitos. Listar decisiones detectables del
   stack que merecen ADR explicito:
   - Multi-tenant? -> sugerir ADR
   - Multiple frontends? -> sugerir ADR de estrategia de coexistencia
   - Codigo legado coexistiendo? -> sugerir ADR "X congelado"
   - Patrones especificos detectados en codigo (CQRS, DDD, Strangler Fig) -> sugerir ADR

7. Preguntar y sugerir al usuario convenciones o reglas de negocio adicionales a las que se detecten.
```

### 3.2. Nuevo template `templates/project-config/docs-index.template.yml`

Schema documentado con comentarios. Copiar de SGD `.specture/docs-index.yml`
quitando contenido especifico.

### 3.3. Modificar `architecture-validator` y `code-reviewer` para usar `docs-index.yml`

Hoy estos agentes reciben `.specture/` completo. Agregar al system prompt:

```
Si `.specture/docs-index.yml` existe y el spec/diff que estas revisando tocael
modulo `X` o el concepto `Y`:

1. Filtra el indice por concept/tags relevantes.
2. Lee SOLO los archivos resultantes (max 3).
3. NO leas SGD.Docs/ entero ni intentes navegar carpetas a ciegas.

Si un concepto del spec NO esta en el indice, marca esto en tu report:
"DOC NOT INDEXED: concepto X mencionado en spec no tiene entrada en
docs-index.yml. Sugiere al usuario agregarlo."
```

### 3.4. Modificar `skills/start/SKILL.md` para detectar adopcion previa

Step 2 actual:

> Check whether `docs/01-requirements/business_requirements.md` exists.

Mejora: si el archivo NO existe pero `.specture/docs-index.yml` SI existe y
contiene entradas con tag `requirements` o categoria equivalente:

```
Detectamos que tu proyecto tiene documentacion preexistente indexada
(.specture/docs-index.yml con N entradas), pero falta el archivo puente
docs/01-requirements/business_requirements.md.

¿Quieres (a) generarlo automaticamente a partir del indice (recomendado), o
(b) ir a /specture:discover para levantar requerimientos desde cero?
```

Esto evita el bug de SGD original: state machine enrutando a discover cuando
los requirements ya estan formalizados en otro lado.

### 3.5. Permitir `documentation_paths` en `stack.yml` (futuro, opcional)

Como evolucion mas adelante, permitir override de paths:

```yaml
documentation:
  primary_dir: SGD.Docs/        # fuente de verdad del equipo
  index_file: .specture/docs-index.yml
  bridges_dir: docs/            # puentes generados (default)
```

Los skills leerian de `bridges_dir` y los agentes consultarian `index_file`. Si
el usuario quiere apuntar a `Documentation/` o a una wiki externa montada como
submodulo, lo declara aqui.

---

## 4. Algoritmo de categorizacion sugerido

Pseudo-codigo del paso 4.6.2:

```python
def categorize_docs(doc_paths):
    categories = {
        "architecture": ["arquitectura", "architecture", "design", "components"],
        "requirements": ["requerimientos", "requirements", "user stories", "actores"],
        "conventions": ["convenciones", "conventions", "style", "naming"],
        "database": ["bd", "database", "erd", "tablas", "schema", "sp", "stored procedure"],
        "functionalities": ["flujo", "flow", "feature", "use case"],
        "tech_debt": ["deuda", "debt", "urgentes", "hallazgos", "findings"],
        "roadmap": ["roadmap", "plan", "milestone", "fase", "phase"],
        "team": ["equipo", "team", "acuerdos", "sla", "ans"],
        "external_integration": ["integracion", "integration", "consumo", "consumer"],
    }
    result = {}
    for path in doc_paths:
        first_30_lines = read_lines(path, 30).lower()
        # Path-based hints (subcarpeta cuenta el doble)
        parent = path.parent.name.lower()
        scores = {}
        for cat, keywords in categories.items():
            score = sum(1 for kw in keywords if kw in first_30_lines)
            if any(kw in parent for kw in keywords):
                score += 5  # subcarpeta es senal fuerte
            scores[cat] = score
        best = max(scores, key=scores.get)
        if scores[best] == 0:
            best = "other"  # mostrar al usuario para clasificacion manual
        result[path] = best
    return result
```

En SGD, las subcarpetas (`architecture/`, `database/`, `funcionalidades/`,
`deuda-tecnica/`, `desarrollo/`, `roadmap/`, `gestion-equipo/`,
`solicitudes-cliente/`) coinciden 1:1 con categorias. Path-based hints solos
hubieran categorizado el 95% correcto.

---

## 5. Tradeoffs y decisiones a discutir

| Tradeoff | Opcion A | Opcion B |
|---|---|---|
| Generar puentes vs paths alternativos | Puentes (sin cambio al framework, mas compatible) | Paths alternativos (mas limpio, requiere modificar skills) |
| Indexar todo vs solo lo que toca un agente | Indexar todo upfront (lo que hicimos en SGD) | Indexar lazy bajo demanda (mas overhead pero menor inversion inicial) |
| ADRs implicitos: generar o solo sugerir | Generar drafts y dejar que usuario refine | Solo sugerir lista y dejar que usuario los escriba |

Mi recomendacion (basada en la experiencia de SGD):

- **Puentes** sobre paths alternativos para esta version. Mas adelante agregar `documentation_paths` como evolucion.
- **Indexar todo upfront**. La inversion de tiempo es contenida (1 hora para 70 docs en SGD) y los lookups dirigidos despues son muy eficientes.
- **Generar drafts de ADR** y dejar que el usuario los apruebe/edite. Los ADRs implicitos son el bloqueador #1 del `architecture-validator`.

---

## 6. Metricas de exito

Si esta propuesta entra a Specture, la metrica clave es:

- En proyectos adoptados con documentacion preexistente, `architecture-validator` y `code-reviewer` deben citar al menos 1 archivo del indice cuando el feature lo amerita (validar con muestreo).
- `skills/start/SKILL.md` NO debe enrutar a `discover` cuando hay 10+ archivos categorizables como `requirements`.
- Tiempo de setup en modo Adopt para un proyecto con 50+ docs: < 10 minutos sin intervencion humana (vs ~1 hora sin esta logica).

---

## 7. Referencias

- Proyecto de prueba: SGD — `C:\CodigoFuente\SGD\.specture\` y `C:\CodigoFuente\SGD\docs\`
- Indice ejemplo (70 entradas): `C:\CodigoFuente\SGD\.specture\docs-index.yml`
- ADRs generados: `C:\CodigoFuente\SGD\.specture\decisions\002..006`
- Skill objetivo: `skills/setup/SKILL.md` (modo Adopt)
- Skills afectados: `skills/start/SKILL.md`, agentes `architecture-validator` y `code-reviewer`
