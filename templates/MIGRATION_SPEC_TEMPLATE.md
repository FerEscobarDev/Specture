# MIGRATION SPEC: [Módulo/Componente] — [Source Tech] → [Target Tech]

> Template para epics del skill `/specture:modernize`. Usar en lugar de `SPEC_TEMPLATE.md`
> para todos los epics dentro del milestone de migración en `ROADMAP.md`.

- **Epic:** [referencia al epic en el milestone de migración — ej. "Epic N.2: Auth Module"]
- **Módulo:** [módulo de arquitectura según `docs/02-architecture/architecture.md`]
- **Characterization SHA:** [valor de `migration.characterization_sha` en `stack.yml`]
- **Gap analysis reference:** [`docs/migration/gap_analysis.md` § sección de este módulo]

---

## 1. Estado Actual

- **Stack usado en este módulo:** [tech + versión actual, ej. "Angular 6 + RxJS 6"]
- **Patrones presentes:** [lista de patrones del viejo stack — ej. "NgModule, ActivatedRoute, HttpClient v1 API"]
- **APIs/contratos expuestos:** [qué interfaz o contrato expone este módulo al exterior — endpoints, exported functions, events]
- **Dependencias entrantes:** [otros módulos o actores que consumen este módulo]

---

## 2. Estado Target

- **Stack nuevo:** [tech + versión target, ej. "React 19 + React Router 7"]
- **Patrones equivalentes:**

| Patrón actual (source) | Patrón target | Notas |
|------------------------|---------------|-------|
| [ej. NgModule] | [ej. sin equivalente — tree-shaking nativo] | [qué implica] |
| [ej. ActivatedRoute] | [ej. useParams() hook] | |

- **APIs/contratos tras migración:** [debe ser idéntico al estado actual salvo que el spec documente un breaking change explícito]

---

## 3. Breaking Changes en Scope de este Epic

> Solo los cambios que afectan a ESTE módulo. Los del resto del codebase no son scope aquí.

- [API X desaparece → reemplazada por Y. Consumers externos impactados: ninguno / lista]
- [Patrón Z obsoleto → reemplazado por W]
- [Ninguno — migración transparente para consumidores]

---

## 4. Estrategia de Coexistencia

> Si este epic requiere que viejo y nuevo tech coexistan mientras dura la migración.

- **¿Requiere adapter/facade?** [Sí / No]
- **Descripción:** [Si sí: cómo funciona el adapter. El adapter vive FUERA del módulo migrado, nunca dentro.]
- **Cuándo se elimina el adapter:** [en el cleanup epic / en el epic NNN]

---

## 5. Criterios de Aceptación

> Sin código. Solo comportamiento observable verificable. Cada criterio se convierte en un test.

- [ ] [Comportamiento funcional A que debe seguir igual tras la migración]
- [ ] [Comportamiento funcional B]
- [ ] Los characterization tests de este módulo pasan al 100% con el nuevo stack
- [ ] No quedan imports, tipos, ni patrones del source tech dentro del módulo (verificable con grep)

---

## 6. Regresión Obligatoria

Después de que el implementer termina y los tests GREEN pasan, ejecutar:

```
<test-command completo>
```

Los characterization tests (capturados en `CHARACTERIZATION_SHA`) deben terminar en verde.
Si alguno falla: el epic NO se marca `[x]`. Invocar `./skills/debug/SKILL.md`.

---

## 7. Fuera de Scope

> Qué NO cambia en este epic. Crítico para acotar el contexto del implementer.

- [Módulo X no se toca en este epic]
- [Feature Y no se refactoriza aunque podría mejorarse]
- [Config de CI/CD no se actualiza aquí]

---

## 8. Plan de Rollback

```bash
git revert <epic-commit-hash>
```

Este revert restaura el módulo al estado anterior sin afectar otros módulos ya migrados,
dado que cada epic migra exactamente un módulo con interface externa preservada.

---

## 9. Notas de Implementación

> Instrucciones específicas para el `implementer` agent que no encajan en los criterios de aceptación.

- [ej. "El adapter debe implementar la interfaz IAuthService existente para no romper consumers"]
- [ej. "No introducir dependencias npm nuevas sin ADR — si se necesita una lib nueva, BLOCKED"]
