---
name: handoff-ingest
description: Use when the user has a design handoff package from a design-specialized AI (especially Claude Design — a folder with a design-system README, a token CSS/file, per-screen prototypes, and optionally a ui_kit and a SKILL.md) and wants to convert it into the project's frontend stack. Extracts tokens and brand rules deterministically into docs/03-ux-ui/, builds a fidelity checklist, maps screens to the API contract, and plans faithful conversion (verbatim copy when the stack matches, visual-parity translation when it differs). Does NOT write production code — that happens in build via ux-implementer.
---

# Handoff Ingest — Convert a Design Handoff into the Project Stack

You are a **design-systems engineer** turning an external design deliverable into Specture's source-of-truth artifacts. Specture is optimized for **Claude Design handoffs**, but this skill handles any structured handoff. Your output feeds Phase 3 (`docs/03-ux-ui/`) and prepares Phase 4 (`build` "Modo: Frontend") to render the UI faithfully.

## What a Claude Design handoff looks like

A typical package (the reference is `C:\Proyectos\Psikora\spec\Psikora-handoff`) contains:

- `README.md` — the **design-system master**: brand context, tone, color/type/spacing tokens, radii, shadows, icon rules, brand "do/don't" rules.
- A **token file** — e.g. `colors_and_type.css` (CSS variables for colors, type, spacing, shadows, radii).
- `preview/` — HTML cards visualizing each part of the system (colors, type scale, spacing, components).
- `ui_kits/<app>/` — interactive prototype: real components (e.g. `.jsx`) + an `index.html`.
- Per-screen prototypes — e.g. `<App> Dashboard.html`, `<screen>.jsx`.
- `SKILL.md` — a design skill describing how to design "on brand".
- `uploads/` — what was fed *into* the design AI (often the `navigation_map.md` + `branding.md`).
- `assets/` — logos, icons.

Treat `.html`/`.jsx` prototypes as **fidelity targets**, not as code to blindly paste (unless the stack matches — see Conversion Strategy).

## Required Inputs

- The handoff directory path (ask the user if not given).
- `.specture/stack.yml` — `frontend.framework`, `frontend.ui_library`, `frontend.styling`, `frontend.language`.
- `.specture/conventions.md`.
- `docs/02-architecture/api-contract.md` (+ `.openapi.yaml`) — to map screens → operations.
- `docs/03-ux-ui/navigation_map.md` if it already exists (the handoff often contains the one it was given).

## Hard Rules

<HARD-GATE>
- **No production code in this skill.** You produce design docs, a fidelity checklist, a mapping, and copied assets. The actual UI code is written in `build` by `ux-implementer`, behind the visual-approval gate. (Copying static asset files like logos is fine; writing components is not.)
- **Token extraction is deterministic, not creative.** Read the handoff's token file and transcribe values exactly. Do not "improve" the palette, round values, or invent tokens the handoff doesn't have.
- **Never invent brand rules.** Every rule in the fidelity checklist must be traceable to a line in the handoff README/SKILL.
- **Faithfulness is bounded by stack.** Promise verbatim copy only when the target stack equals the handoff stack. When stacks differ, promise *visual + token parity*, not code parity — and say so to the user.
</HARD-GATE>

## Step 1 — Map the handoff

Inventory the package: locate the README, the token file, the prototypes, the `ui_kit`, the `SKILL.md`, the `uploads/`, and `assets/`. Report a short manifest to the user: "Encontré: design-system README, tokens en `colors_and_type.css`, prototipo `ui_kits/dashboard` (React), 21 pantallas en `uploads/navigation_map.md`, SKILL.md de marca, logos."

If the handoff is a `.zip`, ask the user to extract it (or extract it) before reading. **Never** read `.pen` files directly — those are Pencil/encrypted; use the pencil MCP if present.

## Step 2 — Determine the conversion mode (read stack.yml)

Compare the handoff's implementation stack (infer from the prototype files — `.jsx` ⇒ React, `.vue` ⇒ Vue, etc.) against `stack.yml.frontend`:

- **Same stack** (e.g. handoff is React/Next + target is React/Next): **Verbatim copy mode.** Components can be copied close to as-is in Phase 4; the work is stripping the prototype's mock data and wiring the typed client.
- **Different stack** (e.g. handoff is React, target is Angular/Vue/Flutter): **Parity translation mode.** Components are re-authored in the target framework preserving tokens, structure, states, and brand rules exactly. The `.jsx`/`.html` become reference, not source.

State the detected mode to the user explicitly, with the honest implication (see Hard Rules).

## Step 3 — Extract tokens (deterministic) → `design_system.md`

Read the handoff token file and transcribe **exactly** into `docs/03-ux-ui/design_system.md` (use `$SPECTURE_ROOT/templates/DESIGN_SYSTEM_TEMPLATE.md`):

- Color tokens (hex/rgba) with their semantic names and usage.
- Typography (families, scale, weights, line-heights).
- Spacing scale, radii, shadows, breakpoints, z-index.
- Dark mode policy if present.

Map them to the target's token mechanism notation (CSS vars / theme object / Tailwind config) per `stack.yml.frontend.styling`, but keep the **values identical**. Validate WCAG AA on the text/background pairs and note any pair that fails (don't silently "fix" the brand — flag it).

## Step 4 — Build the Fidelity Checklist → `docs/03-ux-ui/fidelity-checklist.md`

Convert the README/SKILL brand rules into a verifiable checklist that `ux-implementer` must honor and `code-reviewer` Dimension 6 checks. Each item cites its source line. Examples (from the Psikora handoff):

- Icons: stroke style, `strokeWidth 1.8`, round caps/joins (Feather/Lucide vocabulary). No icon fonts. No emoji in dashboard UI.
- Status badges: always alpha tints (`rgba`), never solid fills.
- Cards: no left-border-only accent; no glassmorphism; `1.5px` borders.
- Single font family; specified weights only.
- Copy tone/locale rules.

This checklist is the machine-usable form of "copy the handoff al pie de la letra".

## Step 5 — Map screens → navigation_map → contract

For each prototype screen in the handoff, reconcile it with `navigation_map.md` and the API contract. Produce `docs/03-ux-ui/handoff-mapping.md`:

| Handoff screen | Route (navigation_map) | Components used | operationId(s) consumed | Conversion mode |
|---|---|---|---|---|

- If the handoff included an `uploads/navigation_map.md`, diff it against the project's current one and flag drift.
- If a screen consumes data with no matching `operationId` in the contract, log it as a **contract gap** (escalate to Phase 2) — do not invent an endpoint.
- Catalog the reusable components the prototype implies so the design-system foundation epic in the ROADMAP covers all of them.

## Step 6 — Assets and the brand skill (optional)

- Copy logos/icons from the handoff `assets/` into the project's asset location (per conventions).
- If the handoff ships a `SKILL.md`, offer to register it as a **project-level skill** so design work stays on-brand. Do not auto-install without the user's ok.

## Step 7 — Self-review

- [ ] `design_system.md` tokens match the handoff values exactly (spot-check several).
- [ ] Every fidelity-checklist item cites a handoff source line.
- [ ] Every handoff screen maps to a route and to contract `operationId`s (or a logged contract gap).
- [ ] Conversion mode (verbatim vs parity) stated to the user with its honest implication.
- [ ] No production component code written by this skill.
- [ ] WCAG AA checked; failing pairs flagged, not silently changed.

## Step 8 — Hand-off

Announce in Spanish:
> "Handoff ingerido. En `docs/03-ux-ui/`: `design_system.md` (tokens y componentes), `fidelity-checklist.md` (reglas de marca verificables) y `handoff-mapping.md` (pantalla → ruta → operación del contrato). Modo de conversión detectado: **[Verbatim copy / Parity translation]** — [implicación honesta]. [Si hubo contract gaps: 'Detecté N operaciones que las pantallas necesitan y el contrato no expone; hay que resolverlas en la Fase 2.'] Cuando quieras, en la Fase 4 (build, Modo Frontend) codificamos el design system, lo apruebas en `/dev/design-system`, y construimos las páginas. ¿Avanzamos?"

Wait for the user. Do not auto-route.

## Honest Limits (state these when relevant)

- **Cross-framework conversion is not pixel-perfect-automatic.** Parity translation preserves tokens, structure, and rules, but the final look is confirmed at the human visual-approval gate in `build`, not certified by this skill.
- **"Al pie de la letra" is literal only in verbatim mode** (matching stacks). In parity mode it means visual + token parity, not identical code.
- **The handoff's data is mock.** Real behavior comes from wiring the typed client to the contract in `build`; the prototype's hardcoded data is discarded.
