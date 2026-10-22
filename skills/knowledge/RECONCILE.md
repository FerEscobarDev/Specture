# Knowledge — Mode `reconcile` / `characterize` (living behaviour of one component)

Companion of `skills/knowledge/SKILL.md`. Read it when the mode selection resolved to
**reconcile** (`/specture:knowledge reconcile --component <slug>`, the warning `build` or
`new-feature` prints, doctor `current-state-missing` / `current-state-partial`) or to its variant
**characterize** (`--component <slug>` on a component without specs). The Shared Iron Rules and the
Tone of `SKILL.md` apply here too.

## Contents

| Section | When you need it |
|---|---|
| Reconcile Iron Rules | Before anything else — one component per invocation, Plan mode |
| Inputs | What you read and what you never read |
| Procedure | Steps A-B: build or merge `_current/<slug>.md` from the `[x]` specs |
| C — `characterize` | The variant from code, when the component has no specs |
| What this mode does NOT do | Closing checks |

# Mode: reconcile — lazy backfill of `docs/05-specs/_current/` per component (roadmap item 38)

Builds (or incrementally updates) the living-behaviour file of **one** component from the `[x]` specs that cite it, so a mature project gets `_current/` without "consolidating 379 specs at once" — the reviewer and the impact analyses of the next epics see the current behaviour instead of `[]`. **`characterize`** is the variant for a component that has **no specs** (Adopt projects, inherited code): it reads the code, read-only, and writes the same file marked `ai_characterized`. Both are the retroactive / bootstrap side of `build` Step 8.7, which keeps reconciling at every milestone closure.

## Reconcile Iron Rules (additional to the shared rules)

```
1. ONE COMPONENT PER INVOCATION. Never loop over every component; never
   "consolidate everything" — that is the anti-pattern this mode exists to avoid.
2. WRITE ONLY docs/05-specs/_current/<slug>.md — plus the two append-only logs the
   procedure names (`.specture/migrations.log` through the doctor's --verify,
   `docs/.specture-meta/learn-history.jsonl`). Never edit a spec, the ROADMAP,
   another component's file, or code. characterize never writes code or tests.
3. EnterPlanMode BEFORE WRITING — the full proposed file is the plan; approval is
   atomic. (Copilot / Antigravity: a closed proposal in chat + explicit approval.)
4. Confianza: ai_reconciled (from specs) | ai_characterized (from code). Never
   spec_reconciled (that is build Step 8.7's mark) and never user_confirmed.
5. Every vigente item carries `origen:` — the spec id `<epic-dir>/<task-slug>` (the
   template's `[epic/task]`), or `path::símbolo` for characterize, never a line
   number. No origin → the item does not exist (an operation the epic block or the
   contract declares but no [x] spec implements is a note in the plan, not a line).
```

## Reconcile — Inputs

- `docs/04-roadmap/ROADMAP.md` (epic states) and `docs/02-architecture/architecture.md` (§ Componentes: slugs, "Carpeta raíz", "Ubicación"). No `architecture.md` → stop: components are declared there (`architecture` skill).
- `${CLAUDE_PLUGIN_ROOT}/templates/CURRENT_CAPABILITY_TEMPLATE.md` (`$SPECTURE_ROOT/…` in manual setups; `${PLUGIN_ROOT}` in Copilot / Antigravity).
- The existing `docs/05-specs/_current/<slug>.md`, if any (incremental merge, never a blind rebuild).
- **Only** the specs the helper lists (step 1) — never scan `docs/05-specs/` by hand.
- The `operationId` list of the contract file (`stack.yml.api.contract_file`; a `grep operationId` is enough) — only to decide what goes under "Operaciones del contrato implementadas". Never `business_requirements.md` or `conventions.md`: the specs already cite their `RN-nnn`.
- Not gated by `knowledge.enabled` (that toggle governs the opt-in *capture* prompts in build/debug); the doctor, `build` and `new-feature` route here regardless.

## Reconcile — Procedure

0. **Resolve the component**: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/current-state.js" components --project .` prints `SLUG | NAME | ROOT | SPECS_DONE | SPECS_OTHER | CURRENT` and a `MISSING:` line. `--component <slug>` must match a slug or name exactly; on an unknown or partial slug the helper exits 2 with candidates → ask the user with those candidates (≤ 4 options), **never guess** a component.
1. **List the specs**: `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/current-state.js" specs --project . --component <slug>` → `SPEC | EPIC | STATE | MATCH` in ROADMAP order, `[x]` only. `MATCH = modulo` = the spec's own `Módulo:`; `MATCH = epic` = cited only through the epic's "Componentes de arquitectura involucrados" — include it, but take from it only the items whose subject is this component's data or operations (e.g. an ownership rule about *archivos* enforced by the Etiquetas epic — yes; the tag-normalisation rule — no, that belongs to Etiquetas); it is a judgment call, so the plan lists exactly what was taken. `NONE` → this is a `characterize` case (section C). `NONE_DONE` → nothing to reconcile yet; stop and say so.
2. **Read those specs, in that order, and apply "último gana"** (`docs/reconciliation-design.md` § schema): for each business rule, acceptance criterion, edge case and contract operation, the **most recent** spec that touches the **same `operationId` or the same rule subject** defines the vigente item; the older statement moves to "Historial / supersesiones" with both origins. Two `[x]` specs on the same subject with no clear order or no declared supersession → an open question for the user (in the plan), not a coin toss. Fill the template: header (`Componente`, `Specs de origen` = every listed spec, `Última reconciliación: <fecha> — knowledge reconcile`, `Confianza: ai_reconciled`), the four vigente sections with `origen:` + `fuente: RN-nnn`, the consolidated contract table, the Historial (its "en Milestone N" = the milestone of the superseding epic).
3. **Incremental merge** when the file already exists: keep what it says unless a listed spec supersedes it; never drop an item whose origin spec is still `[x]`; append to the Historial, never rewrite it. An item whose `origen:` is not a spec (a human wrote it) is kept and **flagged in the plan** — the user decides. A previous `Confianza: user_confirmed` is preserved only if the merge changes nothing vigente — otherwise the file goes back to `ai_reconciled` and the plan says so. If the merge changes **nothing** (same vigente items, no new supersession), say so and stop: no rewrite, no refreshed date, no commit.
4. **`EnterPlanMode`** — the plan is the full proposed file plus: the supersessions applied (old → new, origins), what was taken from `MATCH = epic` specs, the open conflicts as questions. **`ExitPlanMode`**. Approve → write; reject → nothing (log `outcome: rejected`).
5. **Write** `docs/05-specs/_current/<slug>.md`. If this created the `_current/` directory itself, record the content migration: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" migrate --verify 1.9-current-state-init --by "knowledge reconcile"`.
6. **Verify**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js" check --brief` — no `current-state-partial` for this slug, no new ERROR.
7. **Commit** `docs(knowledge): reconcile _current/<slug> — N specs` — that file, plus `.specture/migrations.log` when step 5 wrote it (the log is tracked, append-only) — and append to `docs/.specture-meta/learn-history.jsonl` (fail-open): `{"ts":"<ISO-8601>","trigger":"reconcile","trigger_id":"<slug>","specs":N,"supersessions":M,"confidence":"ai_reconciled","outcome":"applied|rejected|unchanged"}` (`supersessions` = statements moved to the Historial, not subjects).

### C — `characterize` (a component without specs)

Same gate, different source. Only when step 1 says `NONE`, or the user asks for it on an Adopt component:

1. **Root** = the component's `Ubicación` (fallback "Carpeta raíz") from `architecture.md`. Nothing under it → say so; there is nothing to characterize.
2. **Read-only extraction** — the fourth application of "the orchestrator resolves, the agent never reads" (see Code Surface Resolution in `build/PLANNING_GATE.md`): dispatch a general-purpose subagent with `model: haiku` (sonnet if haiku is unavailable), read-only tools (Read/Glob/Grep), this prompt and nothing else (`<root>` = the component's `Ubicación`, or its "Carpeta raíz" when there is no `Ubicación`):
   ~~~
   Read ONLY files under: <root>. Do not read anything else. Do not write anything.
   Extract the OBSERVABLE behaviour as rows, strict format, no prose, max 60 rows:
   KIND | STATEMENT | ANCHOR
   KIND = BR (a rule the code enforces) | AC (what a caller observes) | EC (an edge case handled) | OP (a public operation: name + parameters)
   STATEMENT = one sentence in Spanish, present tense, with the literal values (limits, codes, defaults).
   ANCHOR = <path>::<symbol> — never a line number. If nothing is observable, output exactly: NONE
   ~~~
   No subagent tool → read the root yourself under the same 60-row cap; never open a file outside it (the contract's `operationId` grep of the Inputs is the one exception).
3. **Fill the template** from the rows: `origen:` = the ANCHOR; `Specs de origen: (ninguno — caracterizado desde código)`; `Confianza: ai_characterized`; Historial empty; no `fuente:` lines (there is no spec citing an `RN-nnn` — do not open `business_requirements.md` to hunt for one; the first epic on the component will). "Operaciones del contrato" only for operations whose `operationId` exists in the contract file — otherwise the OP rows go under "Comportamiento observable" and that section says so; never invent an `operationId`.
4. Steps 4-7 as above with `--by "knowledge characterize"` in step 5, the commit `docs(knowledge): characterize _current/<slug> — N rows`, and the log line `{"ts":…,"trigger":"characterize","trigger_id":"<slug>","rows":N,"confidence":"ai_characterized","outcome":"applied|rejected"}`. Sibling of `modernize` Step 5's characterization brief — the tests come later, when an epic touches the component.

## Reconcile — What this mode does NOT do

- ❌ Consolidate every component in one run · edit specs, the ROADMAP or code · invent behaviour with no origin · mark `spec_reconciled` or `user_confirmed` · "refresh" an `ai_characterized` file into something stronger by re-running it (only a human promotes `Confianza`).
- ❌ Replace `build` Step 8.7: at every milestone closure the coordinator still reconciles that milestone's components and marks them `spec_reconciled`; this mode is the retroactive backfill and the Adopt bootstrap.

