# Stack — resolved versions

Verified with `npm show <pkg> version` on 2026-07-04 (Node v22.16.0, npm 11.11.0).

| Package | Version | Notes |
|---|---|---|
| next | **16.2.10** | App Router, Turbopack default, `proxy.ts` (middleware rename), async request APIs |
| react / react-dom | **19.2.7** | |
| typescript | **6.0.3** | strict mode everywhere |
| tailwindcss / @tailwindcss/postcss | **4.3.2** | v4 CSS-first config — tokens live in `@theme` (packages/design-system/src/theme.css); brand colors indirect through `:root` CSS vars for runtime tenant theming |
| framer-motion | **12.42.2** | central motion spec in `@hr/design-system/motion` |
| drizzle-orm | **0.45.2** | typed schema + SQL migrations in git |
| drizzle-kit | **0.31.10** | |
| @supabase/supabase-js | **2.110.0** | added when tenant datastores land (Phase 1) |
| zod | **4.4.3** | added with schema-engine validation (Phase 4) |

Notable deviation from the build prompt: the prompt anticipated Tailwind v3-style
config; current stable is **Tailwind 4** (CSS-first). Adopted v4 — see ADR-0003;
it makes the per-tenant CSS-variable branding requirement first-class.
