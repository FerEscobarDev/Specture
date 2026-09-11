---
name: ux-design
description: Use when the project has a frontend (`stack.yml.frontend.framework` is set and not `none`) and `docs/03-ux-ui/navigation_map.md` or `design_system.md` is missing. Also use when the user says "diseñemos la UI", "el diseño ya está en Claude Design", or asks to start the frontend. Forces the aesthetic decision to be made by a human before any UI code exists.
---

# 03 — UX Design

## Overview

A design system that nobody decided is the average of the model's training data. This phase exists to make one human decision — **what this product looks like and what it deliberately is not** — and to write it down where restricted-context subagents can inherit it.

Three levels decide **who draws**. They never decide whether the decision gets made, nor whether the system is good: everything that raises quality is local, deterministic, and runs with no account and no network.

## When to use

- `stack.yml.frontend.framework` is set and not `none`, and `docs/03-ux-ui/navigation_map.md` **or** `design_system.md` is missing.
- The user says the design already exists in Claude Design and wants to start building pages.
- A project is adopted (`frontend.ui_defined: true`) and has no written design system.

## When NOT to use

- No frontend in `stack.yml` → go straight to `build`.
- Both deliverables exist and the user wants pages → that is `build`, not this phase.
- The user wants to change one token on a built system → that is a delta in `design_system.md` §7, not a re-run of this phase.

## Required Inputs

- `.specture/stack.yml` — `frontend.framework`, `frontend.ui_library`, `frontend.styling`, `frontend.ui_defined`, `frontend.design_channel`.
- `.specture/conventions.md`.
- `docs/01-requirements/business_requirements.md` — actors, stories, and **§Identidad de Marca (`MK-nnn`)**, which is the only sanctioned source of brand.
- `docs/02-architecture/architecture.md`.
- The API contract declared in `stack.yml.api.contract_file` + its readable companion — the source of truth for what the UI consumes. The navigation map cites `operationId`s; it never invents URLs or response shapes.
- Templates: `BRAND_BRIEF_TEMPLATE.md`, `NAVIGATION_MAP_TEMPLATE.md`, `DESIGN_SYSTEM_TEMPLATE.md`, `COMPONENT_REFERENCE_TEMPLATE.md`.

## Hard Rules

<HARD-GATE>
- **NO code, NO snippets, NO HTML/JSX/CSS.** Even pseudo-code. Output is specification. *(Exception: throwaway direction comps — Step 2, deleted after the choice.)*
- **BRAND PROVENANCE GATE.** Count the `MK-001`…`MK-005` fields that read `sin definir`. **If 2 or more, you may not author `design_system.md`.** Emit `docs/03-ux-ui/brief.md` from `BRAND_BRIEF_TEMPLATE.md`, run the refusal protocol of Step 2, and stop. `PROPUESTO_POR_EL_AGENTE` marks *individual fields the user could not answer* — **never a whole direction**. If the entire brand is proposed, there is no brand: there is your average.
- **Delegation is not authorization.** "Elegí vos", "confío en tu gusto", "no me preguntes" changes **who picks among options you present**. It never authorizes you to generate the options *and* pick. There is exactly one legal response: the refusal protocol.
- **An external design is not yours to author.** If `frontend.design_channel` is `claude-design`, or `.design-sync/config.json` exists, or `docs/03-ux-ui/handoff/` exists, the design system **already exists elsewhere**. You may not write `design_system.md` with values of your own — not as a draft, a scaffold, a placeholder, or "proposed". You ingest, or you stop.
- **Every number has provenance.** Every contrast ratio and every OKLCH ΔL in `design_system.md` comes from a run of `scripts/design-lint.js contrast`. Paste its `DESIGN_CHECK:` token in §6. Writing an estimated number is forbidden; write `sin verificar` instead.
- **NEVER decide a UI library on your own**, and never accept a declared one without the collision check of Step 1.
- **Violating the letter of a rule is violating its spirit.**
</HARD-GATE>

## The process

### Step 0 — Detect the level

Read `frontend.design_channel` from `stack.yml`, and look for `.design-sync/config.json` and `docs/03-ux-ui/handoff/`.

| Level | Condition | Who draws |
|---|---|---|
| **A — Claude Design** | `design_channel: claude-design`, or a pointer to a remote design project exists | The user, in claude.ai/design. Specture pulls per component, on demand, in `build`. |
| **B — native canvas** | `design_channel: canvas`, or the user asks for visual iteration and has no external project | Claude, via the `design` skill, inside this session. |
| **C — no external tool** | anything else, including Copilot and other providers | Specture alone. The spine runs whole. |

**Adopt (`ui_defined: true`) is orthogonal to the level** — see Step 5.

The level never changes the deliverables, the gates, or the standard. If you cannot determine it, say so and ask; **never assume C to avoid asking**.

### Step 1 — Library, and the collision check

Read `frontend.ui_library`. If unset, propose 2-3 options for the framework and let the user pick. If declared, confirm it briefly.

**Then, before authoring a single token** — and only when the library is not `none`/`tailwind-only` — write its **default gravity centre** on four axes: neutral palette, radius profile, type pairing, density. Compare against `MK-003` (attributes) and `MK-004` (anti-references).

If the library's factory look falls inside a declared anti-reference, **stop** and put two options to the user:

- **(a)** change `ui_library`; or
- **(b)** sign an **override budget** — the named list of the library's components that will have to be rewritten, with the axis forcing each rewrite. It goes in `design_system.md` §1 and the Phase 4 visual gate checks it.

> Resolving this by calling the library "headless", "unstyled" or "themeable" is forbidden. That describes **colour**, which is cheap to replace. The expensive part is radius, density, control heights and type metrics, which are wired into every copied component.

### Step 2 — The direction decision

This is the step the phase exists for. **The user chooses; you never choose for them.**

1. **Emit `docs/03-ux-ui/brief.md`** from `BRAND_BRIEF_TEMPLATE.md`. Part A comes from `MK-nnn`; you ask for what is missing. Part B you *propose* from Part A.
2. **Generate exactly three named directions.** Each declares: thesis in one sentence · type pairing (and its bucket) · seed hue · shape language · density · motion personality · signature element · **what it deliberately sacrifices**.
3. **Show them.** At level A or B, draw them (level B: in an **isolated working directory**, so the `design` skill's step 0 cannot lift a factory scaffold — `tailwind.config.js` defaults or `components.json` with `baseColor: slate` — and anchor all three to it). At level C, a 3-row Markdown table plus one throwaway self-contained `.html` comp per direction, marked non-importable and deleted after the choice. A direction chosen from adjectives is a vocabulary choice, not a design choice.
4. **Ask for a number.** One question, one character, ~20 seconds.

**Refusal protocol** — when the user delegates, refuses, or does not answer: present the three directions anyway and ask for the number. If the answer is still "cualquiera" or silence, the phase ends **`BLOQUEADA-MARCA`**. It is not complete. Do not announce "UX completo" and do not offer Phase 4.

**Validity rule (mechanical):** any two directions must differ on **≥2 axes computable from the artefact** — type bucket, hue family of the hex, radius profile, border treatment. A free-text label never counts toward the minimum. Three perturbations of one centre are one direction wearing three names; regenerate.

The chosen direction **and the two discarded ones** are recorded as an ADR in `.specture/decisions/` — that is the anti-regression artefact restricted-context subagents inherit instead of re-deriving an average. Emit it as `Proposed`; the Phase 4 visual gate promotes it to `Accepted`.

### Step 3 — Navigation map

Write `docs/03-ux-ui/navigation_map.md` from `NAVIGATION_MAP_TEMPLATE.md`. The five-column table of §1 is the machine-readable source: a screen that is not a row does not exist for the coverage gate.

- `operationId`s come from the contract. **Assigning one by name plausibility is forbidden** — that an id exists does not make it the right id, and the verifier cannot tell those apart. A screen whose operations you have not confirmed writes `por-confirmar`.
- If a screen needs data no operation exposes, that is a contract gap for §4 and Phase 2. Never invent an operation.

### Step 4 — Design system

Write `docs/03-ux-ui/design_system.md` from `DESIGN_SYSTEM_TEMPLATE.md`. Brand fields come from `MK-nnn` and are **not re-invented**.

- **Tokens in three layers**, referenced one way only. Derive neutrals by desaturating the brand hue — never copy a factory scale.
- **The roster of §3 is written whole, in this phase**: one row per reusable component, including those of later milestones. **Lazy authoring applies only to `components/<Nombre>.md`, never to the roster row.** Merging components with different anatomy, props or states into one row is forbidden — `Table` and `Pagination` are two rows; `Input`, `Select` and `DatePicker` are three. If the roster exceeds 40 rows, that is the size of the product, not a problem with this phase.
- **`deferred` needs a destination that exists today** in `docs/04-roadmap/ROADMAP.md`. If the epic is not in the roadmap yet, the only legal value is `deferred → sin epic asignado`.

**At level A you do not write this file.** The design system exists in the remote project. Write `navigation_map.md` (it comes from the contract and the requirements, not from the visuals), then stop with `BLOQUEADA-ESPERANDO-DISEÑO`, naming what is missing and how to get it. `build` pulls each component from the channel, on demand, before the epic that needs it.

### Step 5 — Adopt (`ui_defined: true`)

The one case where the design system is **documented, not designed**.

- Extract tokens, components and brand rules from the codebase.
- §1: direction, sacrifice and signature element are `extraído del código` or **`no declarado`**. Promoting an incidental detail to "signature element" is inventing, not naming. A sacrifice nobody decided is not reconstructible.
- **§2.5's banned rationales invert here.** "Es el default de la librería" is the *true* answer in an adopted project, and writing it is required. Inventing a domain rationale that sounds better is the failure mode.
- Dark mode that the app does not implement is `no implementado`, not a derived column.
- The direction gate of Step 2 does **not** apply: there is a shipped product. G1 is N/A; note it.

### Step 6 — Run the checks, then self-review

Run both, and paste their tokens into the documents:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/design-lint.js" contrast
node "${CLAUDE_PLUGIN_ROOT}/scripts/design-inventory.js" --verify
```

(Copilot / Antigravity: `${PLUGIN_ROOT}`; manual `@import`: `$SPECTURE_ROOT`.) Never re-implement these by hand, and never report a check you did not run.

Then the judgment-only points:

- [ ] **Provenance.** `design_system.md` §1 says `usuario` or `mixto`. If it says `PROPUESTO_POR_EL_AGENTE`, the phase is **`INCOMPLETA — marca sin confirmar`**: do not offer Phase 4, offer the three directions.
- [ ] Every user story is reachable through a screen; every actor has an entry path.
- [ ] **Enums counted by hand.** Report `enums: N/N cubiertos`. When the contract is YAML, `design-inventory.js` check I5 skips itself — enum coverage is then manual and mandatory. "Verify pasa" is not evidence.
- [ ] Every number in §2.3 and §6 came from the linter, or says `sin verificar`.
- [ ] No code, snippets or pseudo-code anywhere.

### Step 7 — Hand-off

Announce in Spanish, and say the true state:

> "Fase 3 completa. `docs/03-ux-ui/`: `brief.md` + `navigation_map.md` + `design_system.md`.
> Dirección elegida: **[nombre]** — sacrifica [qué]. Registrada en `ADR-nnn` (Proposed).
> Contraste: `[token]` · Inventario: `[token]` · Enums: N/N.
> El design system se codifica en el epic de fundación de la Fase 4, y lo apruebas mirando
> `/dev/design-system` antes de que se construya ninguna página. ¿Seguimos?"

If the phase is `BLOQUEADA-MARCA`, `BLOQUEADA-ESPERANDO-DISEÑO` or `INCOMPLETA`, say that instead — and do not offer Phase 4. Wait for the user. Never auto-route.

## Red flags — STOP

| What you are about to say | Why it is wrong |
|---|---|
| "No te la invento: te la **propongo**" | Proposing an entire direction *is* inventing it. `PROPUESTO_POR_EL_AGENTE` is for a field, never for the brand. |
| "El usuario delegó, así que tengo mandato" | Delegation moves the choice, not the generation. Present three, ask for a number. |
| "Un campo que existe es un permiso" | A field that exists is a *record*, and it carries a cost: the phase is incomplete until a human confirms it. |
| "Es un andamio, la ingesta lo pisa después" | A 400-line design system is not reversible: later ingestion reconciles against it instead of replacing it, and you end up with two identities competing. |
| "No lo invento, lo estoy **nombrando**" | Promoting an incidental detail to signature element is inventing with better grammar. In Adopt, `no declarado` is the honest value. |
| "Es shadcn/MUI, pero es headless / themeable" | That describes colour. Radius, density, control heights and type metrics are wired in, and they are the expensive part. |
| "ΔL 0.13 · cumple" (estimated by eye) | A fabricated number with the right shape is the vacuous green the linter exists to prevent. Run it or write `sin verificar`. |
| "`design-inventory --verify` pasa en verde" | On a YAML contract, I5 skips itself. Green there is not evidence about enums. Count them. |
| "Lo acoté a familias de componente" | Laziness applies to `components/<X>.md`, not to the roster. A merged row hands the anatomy decision to Phase 4, which is what this phase existed to prevent. |
| "`deferred → Epic 2.1`, se afinará" | An epic that does not exist in the ROADMAP today is an invented destination. Use `deferred → sin epic asignado`. |
| "Le asigno `listarFacturas` a `/facturas`, es obvio" | I2 only checks that the id exists, not that it is correct. Plausibility is a guess wearing a gate's approval. Write `por-confirmar`. |

## Exit criteria

- `navigation_map.md` exists, in the five-column grammar, with no invented `operationId`.
- `design_system.md` exists **or** the phase is reported blocked with its reason — levels A and B included.
- `brief.md` exists whenever any `MK` field was `sin definir`.
- The direction was chosen by a human and is an ADR with its two discarded alternatives.
- Both checks ran; their tokens are pasted; enums are reported `N/N`.
- The phase state was announced truthfully: `completa`, `INCOMPLETA — marca sin confirmar`, `BLOQUEADA-MARCA`, or `BLOQUEADA-ESPERANDO-DISEÑO`.
