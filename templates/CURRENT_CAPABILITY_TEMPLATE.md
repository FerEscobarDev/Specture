# Estado actual — [Nombre del Componente]

> **Verdad viva del comportamiento de este componente.** Vista materializada *sobre*
> los specs (inmutables) que lo construyeron — NO los reemplaza, los consolida en
> presente. La escriben **solo** el coordinador de `build` al cerrar cada milestone que
> toca este componente (Step 8.7) y `/specture:knowledge reconcile|characterize
> --component <slug>` (backfill lazy, un componente por vez, con aprobación en Plan mode).
> **NO editar a mano** — salvo para promover `Confianza` a `user_confirmed`.
>
> - **Componente:** [slug de `architecture.md` § Componentes]
> - **Specs de origen:** [lista de `docs/05-specs/<epic>/<task>.spec.md` que contribuyeron — `(ninguno — caracterizado desde código)` en characterize]
> - **Última reconciliación:** [Milestone N — fecha | fecha — knowledge reconcile|characterize]
> - **Confianza:** [spec_reconciled (Step 8.7, desde los specs del milestone) | ai_reconciled (knowledge reconcile, desde specs [x]) | ai_characterized (knowledge characterize, desde código — informativo) | user_confirmed (un humano lo validó)]

## Reglas de negocio vigentes
> Solo las que rigen HOY. Las superseded bajan a "Historial".
- **BR — [enunciado de la regla vigente]** · origen: `[epic/task]` · fuente: `RN-nnn`

## Comportamiento observable vigente
> Los criterios de aceptación que describen lo que el sistema hace hoy en este componente.
- **AC — [comportamiento observable y verificable]** · origen: `[epic/task]`

## Edge cases manejados
- **EC — [caso] → [resultado]** · origen: `[epic/task]`

## Operaciones del contrato implementadas
> `operationId`s que este componente implementa. El shape vive en `api-contract.md` (no se redefine aquí).
- `[operationId]` — [una frase de qué hace]

## Contrato de comportamiento (consolidado)
> Resumen del comportamiento; para detalle de shapes, el contrato manda.

| Aspecto | Detalle |
|---------|---------|
| Entradas | [consolidado] |
| Salidas (éxito) | [consolidado] |
| Salidas (error) | [consolidado] |
| Efectos secundarios | [persistencia / eventos] |
| Idempotencia | [sí/no por operación] |

## Historial / supersesiones
> Traza de qué cambió. No se borra — preserva el audit trail sin contaminar las secciones vigentes.
- "[regla/criterio viejo]" (origen `[epic/task]`) → superseded por "[nuevo]" (`[epic/task]`) en Milestone N

---
*Archivo generado por reconciliación. Verdad de comportamiento; el contrato de API
y los ADRs siguen siendo fuente de verdad de interfaz y decisiones respectivamente.
Prosa de negocio en español; identificadores en el idioma de `conventions.md` §8.*
