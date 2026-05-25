# Learn Output — [Trigger] / [ID]

> Reporte generado por `/specture:learn`. Captura aprendizajes aplicados, rechazados y diferidos en esta invocación.
>
> Archivo opcional: el log estructurado vive en `docs/.specture-meta/learn-history.jsonl`. Este reporte humano-legible se genera solo cuando `learn.write_human_report: true` en `conventions.md` §10, o cuando el usuario pidió explícitamente "déjame el reporte".

## Resumen

- **Fecha:** YYYY-MM-DD HH:MM
- **Trigger:** `[epic | debug | manual | teach]`
- **Trigger ID:** `[epic-slug | debug-log-filename | "session"]`
- **Outcome:** `[applied_all | applied_some | rejected_all | rejected_personal_only]`

| Métrica | Valor |
|---------|-------|
| Candidatos detectados | N |
| Drafts propuestos | K (max 3, salvo Teach mode = 1) |
| Drafts aplicados | M |
| Drafts rechazados | N − M |
| Personal candidates listados (NO escritos al repo) | P |
| Deferidos para próxima ronda | D |
| Tokens estimados | T |

## Drafts aplicados

> Una sección por cada draft que el usuario aprobó en Plan mode.

### Applied 1 — `[type]` — `[short title]`

- **Tipo:** `[adr | docs-index | conventions-patch | bridge-patch | test-todo]`
- **Archivo tocado:** `<path>`
- **Resumen del cambio:** [1-2 líneas describiendo el delta aplicado]
- **Evidencia:** [cita del diff / review / debug log que motivó el draft]
- **Próximo paso humano:**
  - Si ADR → "Revisar con el equipo y promover Status: Accepted cuando confirmen."
  - Si docs-index → "Promover a `confidence: user_confirmed` cuando un humano valide."
  - Si conventions → "Verificar que la regla es general, no observación de un solo caso."
  - Si test-todo → "Rutear a `/specture:build` o `/specture:new-feature` para materializar el test."

(Repetir por cada applied draft.)

## Drafts rechazados

> Lo que el usuario decidió no aplicar. Útil para entender por qué `/learn` propuso algo que no calzó — informa futuras invocaciones.

### Rejected 1 — `[type]` — `[short title]`

- **Tipo:** `[adr | docs-index | conventions-patch | bridge-patch | test-todo]`
- **Resumen del draft propuesto:** [1-2 líneas]
- **Razón de rechazo (si la dio el usuario):** [literal o "no provista"]

(Repetir por cada rejected draft.)

## Personal candidates (NO escritos al repo)

> Sugerencias detectadas como preferencias del USUARIO individual (no del producto / proyecto / equipo). `/learn` NO escribe a memoria personal de Claude. Si querés guardarlas, pedíselo a Claude explícitamente o usá tu sistema de memoria preferido.

- [Sugerencia 1 — 1 línea — texto sin formato]
- [Sugerencia 2 — 1 línea]

## Deferred (max-3 cap excedido)

> Candidatos detectados que NO se propusieron porque alcanzamos el tope de 3 drafts por invocación. Re-invocá `/specture:learn` cuando quieras capturarlos.

- [Candidato deferido 1 — tipo + título]
- [Candidato deferido 2 — tipo + título]

## Commit

```
<commit-sha> docs(learn): capture from <trigger>-<id>
```

Files in commit:
- `<file1>`
- `<file2>`
- ...

## Cross-references

- Skill que disparó la captura: `[skills/build/SKILL.md Step 8.5 | skills/debug/SKILL.md Phase 4 Exit | manual | --teach]`
- Próximas auditorías sugeridas:
  - `/specture:audit-knowledge` (revisa el estado general del índice)
  - Promoción de ADRs Proposed → Accepted (manual, requiere equipo)
