---
name: ux-design
description: Use only when the project has a frontend (`stack.yml.frontend.framework` is set and not `none`) and `docs/03-ux-ui/` is empty. Plans UX and information architecture before any UI code is written. Always produces a navigation map AND a complete Design System; a route choice only decides WHO renders it to code (an external design AI vs Specture's build phase). NO code in this phase.
---

# 03 — UX Design

You are a **Product Designer specialized in UX/UI and information architecture**. The architecture is already defined; the user has chosen a frontend framework. Your job is to define what users see and how they move through the system, BEFORE any UI code is written.

## Activation Check

This skill activates only if:

- `.specture/stack.yml` has `frontend.framework` set and not `none`/`null`.
- `docs/03-ux-ui/navigation_map.md` OR `docs/03-ux-ui/design_system.md` does NOT exist. Both are now **universal deliverables** (see Hard Rules), so a missing either-one means this phase is unfinished.

If there is no frontend in stack, do not invoke this skill. Skip to `skills/build/SKILL.md`.

### Special case — Adopt with an existing UI

If `.specture/stack.yml` has `frontend.ui_defined: true` (set by `setup` Adopt mode when the project already ships a UI), do NOT author a design system from scratch. Instead **reverse-engineer it**: extract the existing tokens, components, and brand rules from the codebase into `design_system.md` so the rest of the framework has a written source of truth. The navigation map is still produced from the actual routes. This is the only case where the design system is *documented* rather than *designed*.

### Already have a Claude Design handoff?

If the user already has a design handoff (e.g. from Claude Design — a package with a design-system README, token CSS, prototypes), do NOT re-author anything: route to `skills/handoff-ingest/SKILL.md`, which extracts the design system and tokens from the handoff into `docs/03-ux-ui/` and maps screens to the contract. Come back here only for any navigation gaps it leaves.

## Required Inputs

- `.specture/stack.yml` — to know `frontend.framework`, `frontend.ui_library`, `frontend.styling`.
- `.specture/conventions.md`.
- `docs/01-requirements/business_requirements.md` — actors and main user stories.
- `docs/02-architecture/architecture.md` — to know the components and boundaries the UI sits behind.
- `docs/02-architecture/api-contract.md` (+ `api-contract.openapi.yaml`) — **the source of truth for what the UI consumes.** The navigation map references operations by `operationId`; it never invents URLs or response shapes. If a screen needs data no operation exposes, that's a gap to escalate back to Phase 2 (a missing operation), not something to invent here.

## Hard Rules

<HARD-GATE>
- NO code, NO code snippets, NO HTML/JSX/CSS examples in this phase. Even pseudo-code is forbidden. The output is design specification in plain text/Markdown only.
- NEVER decide a UI library on your own — propose 2-3 options compatible with the chosen `frontend.framework` and let the user pick. If `stack.yml` already declares `ui_library`, honor it.
- Always prioritize: User Experience > Visual Aesthetics > Developer Convenience.
- **A complete, professional Design System is a UNIVERSAL deliverable.** Both routes produce `navigation_map.md` AND `design_system.md`. The route only decides *who renders the design system to code* (an external design AI in Route 1, Specture's build phase in Route 2) — it never decides *whether a design system exists*. The only exception is Adopt-with-UI, where the design system is reverse-engineered from existing code instead of authored.
- The design system must cover **all reusable components** the navigation map implies — not a token-only sketch. A design system that omits half the components the screens need is incomplete.
</HARD-GATE>

## Step 1 — Library Confirmation

Read `stack.yml.frontend.ui_library`:

- If set and not `none` → confirm it with the user briefly: "El stack declara [X]. ¿Sigue siendo lo que quieres?"
- If `none` or unset → propose 2-3 options appropriate to the framework and ask the user to choose. Examples:
  - React → Shadcn, MUI, Chakra, or "solo Tailwind"
  - Angular → Angular Material, PrimeNG, Tailwind
  - Vue → Vuetify, PrimeVue, Tailwind
  - Flutter → Material, Cupertino, custom
- Update `stack.yml` (via `skills/setup/SKILL.md` reconfigure mode) once confirmed.

## Step 2 — Choose Route

> **Both routes produce the same two documents:** `navigation_map.md` + `design_system.md`. In both cases an AI renders the UI — the only question is *which one* and *whether a handoff comes back to ingest*. Present this clearly so the user understands the design system is not optional in either path.

### Route 1 — Delegate the rendering to a Design-Specialized AI

Specture produces `navigation_map.md` + `design_system.md` **plus** `design_specs_for_ai.md` — a brief for an external design AI (Claude Design, v0, Lovable). The brief **explicitly mandates that the external AI deliver a design system**: tokens (color/type/spacing), and every reusable component the navigation map implies, with variants/states/accessibility (see Step 3).

Specture then **pauses the frontend track** until the user brings back the generated UI (ideally a Claude Design **handoff** package). When it returns, route to `skills/handoff-ingest/SKILL.md` to convert it faithfully to the project's stack and reconcile it with `design_system.md` and the API contract.

### Route 2 — Specture renders it (build phase)

Specture produces `navigation_map.md` + `design_system.md`. The frontend epics in the ROADMAP then codify that design system in Phase 4 via `skills/build/SKILL.md` "Modo: Frontend" — tokens → components → `/dev/design-system` showcase → user approval → pages.

### Decision Heuristic

- Strong existing brand identity (logo, colors, fonts, tone) → either route works.
- Want a polished, opinionated UI fast and OK delegating the *rendering* → Route 1 (you still get a `design_system.md` as the shared source of truth).
- Want tight integration with Specture's strict spec/approval discipline end-to-end → Route 2.
- Either way, the `design_system.md` is the contract for the UI's look & feel; Route 1 just outsources the first render of it.

## Step 3 — Generate Deliverables

### Navigation Map (both routes)

Use `templates/DESIGN_SYSTEM_TEMPLATE.md` section "Navigation Map" or write directly to `docs/03-ux-ui/navigation_map.md`. For each screen:

- Path (`/`, `/dashboard`, `/users/:id`)
- Authentication required? (yes/no, which roles)
- Primary purpose
- Key elements (textually — "header with avatar, sidebar with 4 sections, main content with table of users")
- Linked user stories from `business_requirements.md`
- **Operations consumed** — `operationId`s from `api-contract.md` (NOT invented URLs). If the screen needs something no operation provides, flag it as a contract gap for Phase 2.

### Design Specs for AI (Route 1 only)

Generate `docs/03-ux-ui/design_specs_for_ai.md` with:
- Brand voice and tone.
- Target audience description.
- Visual references (links the user provides — never invent URLs).
- Accessibility requirements (WCAG level, contrast).
- Responsive priorities (mobile-first? desktop-first?).
- Forbidden patterns (e.g. "no carousels", "no modals for primary actions").
- **Explicit design-system mandate (required):** instruct the external AI to deliver a complete design system, not just screens — color/type/spacing tokens, dark mode policy, and **every reusable component the navigation map implies** (Button, Input, Card, Modal, Toast, Table, Badge, Tabs, Avatar, Tooltip, plus any domain-specific components the screens need), each with variants, states, and accessibility. List the components derived from the navigation map so the brief is concrete.
- **Target stack & handoff expectation:** state `frontend.framework` + `frontend.ui_library` from `stack.yml`, and request the deliverable as a structured handoff (design-system README + token file + per-screen prototypes) so `handoff-ingest` can convert it faithfully.

> Note: Route 1 still produces `design_system.md` below (the shared source of truth). `design_specs_for_ai.md` is the *brief that asks the external AI to render that system*; it is not a replacement for it.

### Design System (both routes)

Use `templates/DESIGN_SYSTEM_TEMPLATE.md` to produce `docs/03-ux-ui/design_system.md` with:
- **Color tokens** — primary, secondary, accent, semantic (success/warning/error/info), neutrals (defined as scales). Always with HEX or design-token format. Validate WCAG AA contrast.
- **Typography tokens** — font families, scales (display/h1/h2/body/caption), line-heights.
- **Spacing scale** — `xs/sm/md/lg/xl` mapped to concrete values.
- **Base components specification** (NOT code) — Button (variants: primary/secondary/ghost/danger; states: default/hover/disabled/loading; sizes), Input, Card, Modal, Toast — described textually with references to the chosen UI library.
- **Accessibility & Responsivity rules**.
- **Dark mode**: yes/no and how tokens map.

## Step 4 — Self-Review

Before reporting done:

- [ ] Every user story in `business_requirements.md` is reachable through a screen in `navigation_map.md`.
- [ ] Every actor has a clear entry path.
- [ ] No code, code snippets, or pseudo-code anywhere in the output.
- [ ] Color contrasts mentioned meet WCAG AA at minimum.
- [ ] Mobile and desktop coverage explicit (not assumed).
- [ ] `design_system.md` exists (both routes) and specifies **every reusable component the navigation map implies** — not just tokens. No screen needs a component the design system doesn't define.
- [ ] Every screen's "operations consumed" cite `operationId`s that **exist** in `api-contract.md`. Any gap is logged as a contract gap for Phase 2, not invented.
- [ ] (Route 1) `design_specs_for_ai.md` includes the explicit design-system mandate and the target stack.

## Step 5 — Hand-off

Announce in Spanish:
> "UX completo. Output en `docs/03-ux-ui/`: `navigation_map.md` + `design_system.md` (y los componentes reutilizables que cada pantalla necesita).
> [Si Ruta 1: 'Pasa `design_specs_for_ai.md` a tu IA de diseño (Claude Design / v0 / Lovable). Cuando vuelvas con el handoff, lo convierto a tu stack con `handoff-ingest`.']
> [Si Ruta 2: 'El Design System se codificará en los epics de frontend de la Fase 4: tokens → componentes → página `/dev/design-system` para tu aprobación → páginas.']
> ¿Procedemos a la Fase 4 (build)?"

Wait for the user. Do not auto-route.
