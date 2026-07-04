# Delivery Plan & Status

Living document. Phases from the build prompt (§12); each must meet its DoD
before the next starts.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundations: monorepo, design tokens + motion, control-plane schema, ADRs | ✅ **Complete** (2026-07-04) |
| 1 | One reproducible tenant (containerized app, one-command provision) | ✅ **Complete** (2026-07-05) |
| 2 | Factory + control-plane console + entitlement flips | ⬜ |
| 3 | Isolation end-to-end: dedicated DB per tenant, RLS, RBAC, tenant resolution | ⬜ |
| 4 | Dynamic schema engine (wizard, generated forms, all feature-sheet templates) | ⬜ |
| 5 | Marketing site + consultation → provisioning handoff | ⬜ |
| 6 | L1 modules (incl. SL statutory payroll + gratuity, Leave↔Attendance↔Payroll coupling) | ⬜ |
| 7 | L2 & L3 modules (+ disciplinary/grievance, multi-entity payroll) | ⬜ |
| 8 | L4 Analytics, then L5 AI & agent orchestration with governance | ⬜ |
| 9 | Hardening: migration waves, observability, backups/restores, DR, cost/autosleep | ⬜ |

## Phase 0 — what was built

- **Monorepo** (npm workspaces): `apps/{app,marketing,admin}`, `services/provisioner`,
  `packages/{design-system,db,entitlements,rbac,schema-engine,tenant-context}`, `docs/`.
- **Design system** from `D:\Shenals Portfolio`: fixed editorial tokens
  (`tokens.ts`), central motion spec (`motion.ts` — ease `[0.22,1,0.36,1]`,
  0.7s reveals, 0.08s stagger, springs 220/16 & 160/18), Tailwind 4 theme with
  per-tenant brand CSS variables, components (Reveal, Floaty, Magnetic, Tilt,
  Button, SectionHeading, StatCell, Card, TenantThemeStyle). All fx honor
  `prefers-reduced-motion`.
- **Control-plane schema** (Drizzle, `packages/db`): tenants (tier, status,
  dedicated `db_ref`, residency, theme, retention), domains + cert lifecycle,
  entitlement overrides, provisioning runs with per-step idempotency ledger,
  per-tenant migration ledger, prospects (marketing handoff), versioned SL
  statutory rates / APIT tax tables / holiday calendars, vendor audit log.
- **Entitlements**: tier matrix transcribed verbatim from
  `HR_System_Feature_Sheets_v5` (20 modules, L1–L5), resolution incl.
  retain-but-lock downgrade semantics. Two-gate separation from RBAC enforced
  by package boundary.
- **Schema engine (types)**: field-type registry, object/field/layout
  definitions, protected-core guardrails; Employee Master starter template
  transcribed from the feature sheet (groups A–K) as the proof pattern.
- **Provisioner skeleton**: 9-step idempotent pipeline contract + resumable runner.
- **Gallery** (`apps/app/gallery`): components rendering with portfolio
  style/motion, live tenant-theme switching, live tier→entitlement matrix demo.

## Phase 0 DoD verification

- ADR set exists: `docs/adr/0001–0007`.
- Base components render with portfolio style/motion in a gallery: `/gallery` in `apps/app`.
- Control plane can hold a tenant record: `packages/db/src/control-plane/schema.ts`
  (`tenants` + supporting tables); migration generation wired via drizzle-kit.

## Phase 1 — what was built

- **Tenant schema foundation** (`packages/db/src/tenant`): tenant_members,
  tenant_meta, statutory reference copies, audit_log — no tenant_id columns
  anywhere (isolation is physical). Module tables land Phase 6+.
- **Containerized app**: Next standalone output, one `hr-app:dev` image for all
  tenants (`docker/app.Dockerfile`); per-tenant differences are env only.
- **Factory (local Docker driver)**: `scripts/provision-tenant.mjs` — one
  command → dedicated Postgres container + migrations + SL statutory seeds +
  domain record + entitlements + admin user + theme + live app container.
  Step ledger persisted to `provisioning_runs`; re-runs skip completed steps.
  `scripts/teardown-tenant.mjs` is the automated erasure path.
- **/status page**: renders identity, tier, theme, dedicated db_ref, member and
  seed counts, and the resolved module matrix — from config alone.

## Phase 1 DoD verification (2026-07-05)

- `acme` (L1, default brand, port 4101) and `globex` (L3, `#0D9488`, port 4102)
  provisioned by one command each, zero manual steps.
- Both serve HTTP 200 with correct name, tier, theme and `db_ref`; same image.
- Physical isolation verified: each dedicated DB contains only its own admin
  member; separate containers + volumes.
- Idempotency verified: re-running acme's provision skipped all 10 steps and
  reported the live instance.

## Changelog

- **2026-07-05** — Phase 1 delivered: containerized app, idempotent one-command
  tenant factory (local Docker driver), two live isolated tenants differing
  only by config. ADR-0008/0009 accepted (user approved recommended defaults).
- **2026-07-04** — Phase 0 delivered. Tailwind 4 adopted (ADR-0003). Open
  decisions recorded with recommended defaults (ADR-0007).
