# Security posture (Phase 9 review)

Reviewed 2026-07-06 against the changed surface. Summary: no injection, secret,
or isolation defects found. One known interim item (auth) tracked below.

## Multi-tenant isolation (defense in depth)
- **Physical**: one dedicated database per tenant; no pooled tables, no
  `tenant_id`-scoped shared business data. Cross-tenant blast radius = one
  company by construction.
- **Routing**: tenant resolved once per request from host/env, never from a
  client body/query (`packages/tenant-context`); unknown host → null, no
  fallthrough. Covered by `npm run test:isolation` (6 tests) in CI.
- **RLS**: enabled on every tenant table (deny-by-default; `hr_app` role holds
  minimal grants). `service_role`/DB creds are server-only.

## Injection
- All queries use parameterized tagged templates (`postgres.js`). The three
  `db.unsafe` sites are safe: `entities.ts` runs **static registry SQL** (no
  user input); `crud/[entity]` builds SQL from **registry-whitelisted** table
  and column names only, with every value passed as a `$N` placeholder. The
  `entity` path segment indexes a hardcoded whitelist (404 otherwise).
- No `child_process` shell interpolation of user input; scripts use
  `execFileSync` with arg arrays.

## Secrets
- No secrets in the repo. Local dev keys live in gitignored `_secrets/`;
  production reads a vault. `.env*`, `_secrets/`, `_backups/` gitignored.
- Admin console gated by Basic auth (`apps/admin/proxy.ts`); refuses
  non-localhost when unconfigured.

## AuthZ gates (both enforced server-side)
- **Entitlements** (company/tier) and **RBAC** (user/role) are independent and
  both checked; delete is tenant-admin-only; disciplinary/grievance and DSR
  decisions and agent approvals are HR/tenant-admin-only. Money/statutory
  history is non-deletable by design.

## Data protection
- PDPA module: consent lifecycle, data-subject requests with 30-day SLA,
  automated per-tenant teardown for erasure. Full audit trail across schema
  changes, payroll, cases, and agent actions.

## Known interim item (close before production)
- **Per-tenant auth not yet wired**: the acting `role` is currently supplied by
  the request (`_role`) as a documented simulation. Production replaces this
  with the authenticated Supabase Auth session + JWT custom claims (planned in
  the auth-adapter work); the RBAC checks themselves are already server-side and
  unchanged — only the role *source* moves from form field to verified claim.
  Until then, tenant apps must not be exposed publicly.

## CI gates (recommended, per §13)
lint · typecheck · `test:unit` (34) · `test:isolation` (6) · migration check ·
secrets scan · entitlement/RBAC matrix. Waves only to production (§4.6).
