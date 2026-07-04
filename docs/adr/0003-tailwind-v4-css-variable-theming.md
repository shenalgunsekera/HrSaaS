# ADR-0003: Tailwind 4 (CSS-first) + CSS-variable tenant branding

**Status:** Accepted · 2026-07-04

## Decision
Adopt Tailwind CSS 4 (current stable 4.3.2) rather than the v3-style JS config
the build prompt anticipated. Design tokens live in `@theme` in
`packages/design-system/src/theme.css`. Brand colors are **indirected through
`:root` CSS custom properties** (`--brand`, `--brand-gradient-*`, …); the app
layer writes a tenant's overrides at runtime (`TenantThemeStyle`, values from
the control plane `tenants.theme`).

## Rationale
- Non-negotiable #2: nothing customer-specific hardcoded — a tenant rebrand is
  a data update, no rebuild, because utilities resolve vars at paint time.
- Tenants restyle *within* the portfolio design: only brand hues/logo are
  overridable; editorial neutrals, type, spacing, motion are fixed platform
  tokens.
- One source of truth for both marketing and app surfaces.

## Consequences
- The fixed identity (chalk/ink/line/surface, fonts, motion) is intentionally
  NOT variable-driven, preventing off-brand tenant themes.
- Theme editor (tenant admin, later phase) writes only the `--brand-*`
  contract defined in `tokens.ts`.
