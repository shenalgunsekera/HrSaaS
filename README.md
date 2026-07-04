# HR SaaS Platform

Multi-tenant HR SaaS for the Sri Lankan market: one codebase, per-company dedicated
database + domain, tier-based entitlements (L1–L5), and a metadata-driven custom
field/object engine.

## Layout

| Path | Purpose |
|---|---|
| `apps/marketing` | Public onboarding/marketing site |
| `apps/app` | Tenant-facing HR system (includes `/gallery` design-system showcase) |
| `apps/admin` | Vendor control-plane console (tenants, tiers, provisioning) |
| `services/provisioner` | Queue-backed tenant factory (provision / migrate / teardown) |
| `packages/design-system` | Tokens, motion spec, components (from the portfolio design language) |
| `packages/db` | Drizzle schema + migrations (control plane + tenant schema) |
| `packages/entitlements` | Tier → module flag resolution |
| `packages/rbac` | Roles, permissions, guards (second gate) |
| `packages/schema-engine` | Dynamic custom field/object metadata engine |
| `packages/tenant-context` | Per-request tenant resolution + tenant-aware data access |
| `docs/` | ADRs, stack notes, delivery plan |

## Getting started

```sh
npm install
npm run dev:app     # tenant app + design gallery at /gallery
```

Authoritative feature spec: `HR_System_Feature_Sheets_v5 (1).xlsx.pdf` (repo root).
Design source of truth: `D:\Shenals Portfolio`.

See `docs/PLAN.md` for phase status and `docs/adr/` for decisions.
