# Reglas de revisión del proyecto

<!--
Specture — reglas personalizadas de revisión (opcional, desde v2.4.0).
Dueño: el equipo (contenido) · el framework (gramática). Lo leen la revisión de cumplimiento
(al cerrar un milestone y a pedido) y el implementer en cada epic, siempre a través del
orquestador: los agentes nunca abren este archivo ni los archivos que incluye. Lo valida
`/specture:doctor check`. Si este archivo no existe, no hay reglas personalizadas.

Sirve para reutilizar criterios que el equipo ya mantiene (un agente o skill de revisión, una
guía de estilo, un CONTRIBUTING) sin copiarlos: se incluyen por ruta y, si conviene, por sección.

GRAMÁTICA — cuatro secciones; todo lo demás (como este comentario) se ignora.

## Incluye
  - <ruta>                                   el archivo entero
  - <ruta> § <encabezado>                    solo esa sección, con sus subsecciones
  - <ruta>#<encabezado>                      lo mismo, para teclados sin «§»
  - <ruta> § <encabezado> — cuando: <glob>, <glob>
                                             solo si lo revisado toca esas rutas
  Las rutas son relativas a la raíz del proyecto y no pueden salir del repositorio. UN SOLO
  NIVEL: un archivo incluido no puede tener su propio "## Incluye" (el doctor lo marca como
  error y no se sigue). Conviene incluir secciones de criterios y no agentes enteros: el
  procedimiento de otro agente (cómo obtener el diff, dónde guardar) no aplica aquí.

## Severidades
  - <palabra del equipo> = BLOCKER | IMPORTANT | NIT, separadas por « · »

## Nivel flexible
  - rutas: <glob>, <glob>                    código legado con criterios reducidos
  - reglas: <ruta> § <encabezado>            la sección que dice qué rige en esas rutas
  - <regla propia en una línea>
  En esas rutas la revisión de cumplimiento aplica SOLO las reglas de nivel flexible,
  también en lugar de las reglas de Specture.

## Reglas
  - **RV-<n>** [BLOCKER|IMPORTANT|NIT] <regla en una línea>[ — cuando: <glob>]

Globs: con «/» se anclan a la raíz del proyecto (`web/src/**`); sin «/» valen en cualquier
carpeta (`*.sql`). No se admiten llaves {a,b}: escribí un glob por patrón.

Precedencia: si una regla de aquí contradice conventions.md, rules.yml o un ADR, prevalece
Specture y la revisión lista la contradicción para que corrijas la fuente. Las reglas de
ubicación de archivos van en conventions.md §2, donde las ve también quien planifica.

EJEMPLO (un equipo ficticio que ya tenía su agente de revisión):

## Incluye
- .claude/agents/acme-reviewer.md § Bloqueantes críticos
- .claude/agents/acme-reviewer.md § Reglas generales
- .claude/agents/acme-reviewer-reglas.md § Backend .NET — cuando: *.cs
- .claude/agents/acme-reviewer-reglas.md § React — cuando: web/src/**
- .claude/agents/acme-reviewer-reglas.md § Migraciones SQL — cuando: *.sql

## Severidades
- bloqueante = BLOCKER · observación = IMPORTANT

## Nivel flexible
- rutas: legacy-web/**, Acme.Core/**
- reglas: .claude/agents/acme-reviewer.md § Nivel flexible

## Reglas
- **RV-1** [BLOCKER] Ningún endpoint devuelve el detalle de una excepción al cliente.
- **RV-2** [IMPORTANT] Los nombres de los tests dicen la condición y el resultado esperado — cuando: *.test.ts
-->

## Incluye

## Severidades

## Nivel flexible

## Reglas
