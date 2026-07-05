# Delivery Plan & Status

Living document. Phases from the build prompt (§12); each must meet its DoD
before the next starts.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundations: monorepo, design tokens + motion, control-plane schema, ADRs | ✅ **Complete** (2026-07-04) |
| 1 | One reproducible tenant (containerized app, one-command provision) | ✅ **Complete** (2026-07-05) |
| 2 | Factory + control-plane console + entitlement flips | ✅ **Complete** (2026-07-05) |
| 3 | Isolation end-to-end: dedicated DB per tenant, RLS, RBAC, tenant resolution | ✅ **Complete** (2026-07-05) |
| 4 | Dynamic schema engine (wizard, generated forms, templates) | ✅ **Complete** (2026-07-05) — remaining module templates transcribe in Phase 6+ as their cores land |
| 5 | Marketing site + consultation → provisioning handoff | ✅ **Complete** (2026-07-05) |
| 6 | L1 modules (incl. SL statutory payroll + gratuity, Leave↔Attendance↔Payroll coupling) | 🟨 **Statutory core complete** (2026-07-05) — attendance/leave UIs, payslip PDFs, bank files, remaining L1 modules + dashboards continue |
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

## Phase 2 — what was built

- **Shared factory module** (`scripts/factory.mjs`): `enqueueProvision` +
  `executeRun` used identically by the CLI, the worker, and the admin API —
  one pipeline, three entry points.
- **Queue worker** (`services/provisioner/src/worker.mjs`): claims queued
  `provisioning_runs` with FOR UPDATE SKIP LOCKED (multi-worker safe),
  executes unattended, applies control-plane migrations on boot. Failed runs
  keep their step ledger; re-queueing resumes at the failed step.
- **Admin console** (`apps/admin`): tenant list + create form (`/`), tenant
  detail (`/tenants/[slug]`) with one-click tier flips, resolved entitlement
  matrix (locks visible), domains, and per-run step ledgers. API:
  `POST /api/tenants` (create/queue), `POST /api/tenants/[slug]/tier`.
  ⚠ No auth yet — vendor console must not be exposed before Phase 3 auth.
- **Control plane migration 0001**: `provisioning_runs.params`.

## Phase 2 DoD verification (2026-07-05)

- `POST /api/tenants {initech, L2, #E11D48}` → worker claimed the run and
  provisioned unattended in **~10 s**; instance live with crimson brand at L2.
- Live tier flip on a running tenant (globex): L3→L1 rendered 10 modules
  retained-but-locked on the instance immediately; L1→L3 restored them —
  no redeploy, no migration, flag flip only.
- Admin list + detail pages render from the control plane, including the
  10-step provisioning ledger.

## Phase 3 — what was built

- **Tenant resolution** (`@hr/tenant-context`): control-plane-backed resolver
  (hostname or pinned slug), 30s cache, pluggable secret resolution, no
  fallthrough for unknown hosts. Wired into `apps/app` via `lib/tenant.ts`;
  `/status` now resolves per request. Verified: ONE host-mode process served
  acme/globex/initech correctly by Host header alone; evil.localhost got
  nothing.
- **RLS groundwork** (tenant migration 0001): RLS enabled on all tenant
  tables, deny-by-default, minimal `hr_app` grants/policies. Applied fleet-wide
  via the new `npm run migrate:tenants` orchestrator (per-tenant ledger).
- **RBAC defaults** + 15 unit tests (`npm run test:unit`); 6 isolation tests
  (`npm run test:isolation`).
- **Admin auth**: Basic-auth proxy; refuses non-localhost when unconfigured
  (verified 403 on spoofed Host). Interim until central IdP (ADR-0007 §6).
- **Branding**: company logos (URL or ≤300KB upload → data URI locally) +
  brand color editable any time in admin; applies to live instances instantly.
  Tier flips at any time with data preserved — verified globex L3→L1→L3 with
  member data intact throughout.
- **Fleet tooling**: `npm run redeploy` (one image → all tenants),
  `npm run migrate:tenants`. See ADR-0010.

## Phase 4 — what was built

- **Storage** (tenant migration 0002): versioned immutable `object_definitions`
  (JSONB definition per version), `custom_records` (JSONB + GIN index, records
  pinned to their definition version), RLS enabled — per ADR-0006, never EAV.
- **Runtime** (`@hr/schema-engine`): `validateRecord` (all rules derive from
  field metadata), `visibleFields`/`editableFields` (field-level RBAC binding);
  5 new unit tests (20 total green).
- **Wizard + generated views** (`apps/app`): `/objects` (create blank or from
  the Employee Master feature-sheet template, module list limited to entitled
  modules), `/objects/[key]` builder (add/remove fields → new published
  version), `/objects/[key]/records` (form + table generated from metadata,
  role-aware). APIs mirror the UI.
- **Guardrails verified live**: non-entitled module refused; protected core
  keys (payslip, payroll-run, …) refused; unknown fields rejected; every
  definition change audit-logged.

## Phase 4 DoD verification (2026-07-05)

On live tenant acme with no deploy: object created (v1) → 3 fields added
(v2–v4) → valid record 201; bad payload 422 with per-field issues; employee
role 403 (RBAC gate); field removed (v5) and instantly gone from the
generated form/table. Template adoption on globex instantiated the full
Employee Master A–K field set. Role-based field visibility verified in
generated views (`?role=` simulation until per-tenant auth).

## Phase 5 — what was built

- **Marketing site** (`apps/marketing`, :3001): home with real product story;
  `/pricing` fully data-driven from `@hr/entitlements` (tier cards + complete
  module matrix — cannot drift from what the product enforces); `/book`
  consultation form.
- **Scheduler adapter** (`lib/scheduler.ts`): booking behind an interface
  (local stub now, Cal.com when credentials exist — ADR-0007 §3).
- **Lead → prospect**: `POST /api/leads` books via the adapter and writes a
  `prospects` row (control plane) — marketing lead is the system of record.
- **Admin `/prospects`**: pipeline view; one-click **Convert to tenant**
  (slug/tier/brand) → `enqueueProvision` carries company name, contact email
  (becomes the tenant-admin user) and branding intake straight into the
  factory queue. Prospect links to its tenant afterward.

## Phase 5 DoD verification (2026-07-05)

Booked "Hemas Textiles" on the marketing site → prospect appeared in admin →
converted with slug `hemas`, L2, `#0E7490` → worker provisioned unattended →
instance live at :4303 with correct name, tier, brand, and
`nadeesha@hemastextiles.lk` as tenant-admin (zero re-keying). Incidentally
verified multi-worker safety: two workers were running and FOR UPDATE SKIP
LOCKED gave the run to exactly one.

## Phase 6 (statutory core) — what was built

- **Statutory verification first** (docs/STATUTORY.md): EPF 8/12, ETF 3,
  APIT Y/A 2025/26 (relief 150k/mo; 6/18/24/30/36%), Gratuity Act 12/1983 —
  sources recorded; seeds flipped UNVERIFIED → VERIFIED fleet-wide.
- **Typed L1 cores** (tenant migration 0003): employees (+`custom` JSONB for
  the schema engine), attendance_records, leave_requests, payroll_runs,
  payslips — fixed schema, RLS enabled, check constraints.
- **`@hr/payroll`** — pure engine, rates always injected from tenant reference
  rows: progressive monthly APIT, EPF/ETF, no-pay (divisor 30), gratuity
  accrual. `deriveNoPayDays` is the ONE Leave↔Attendance↔Payroll surface:
  approved no-pay leave + uncovered absences (half-days 0.5), never
  double-counted. 13 hand-checked tests (33 total green).
- **App**: `/employees` (typed intake + list), `/payroll` (run per period,
  dashboard strip: gross/net/statutory liability, payslip register),
  `POST /api/payroll/run` (draft re-run allowed; approved/locked immutable;
  entitlement-gated; rates resolved per period).

## Phase 6 core DoD verification (2026-07-05, tenant hemas)

Two employees; June 2026 inputs: EMP-001 one uncovered absence + one approved
no-pay day; EMP-002 absence covered by approved annual leave. Run produced
exact hand-checked figures: EMP-001 gross 205,333.33 (2 no-pay days →
14,666.67), EPF 16,426.67, APIT 3,320.00, net 185,586.66; EMP-002 zero no-pay
(leave-covered), APIT 0 (below relief), net 110,400. Draft re-run replaced
payslips correctly.

## Changelog

- **2026-07-05** — Phase 2 delivered: queue-backed unattended factory worker,
  System Admin console over the control plane, live tier flips with
  retain-but-lock verified on running instances.
- **2026-07-05** — Phase 1 delivered: containerized app, idempotent one-command
  tenant factory (local Docker driver), two live isolated tenants differing
  only by config. ADR-0008/0009 accepted (user approved recommended defaults).
- **2026-07-04** — Phase 0 delivered. Tailwind 4 adopted (ADR-0003). Open
  decisions recorded with recommended defaults (ADR-0007).
