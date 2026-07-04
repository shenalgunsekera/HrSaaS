# ADR-0010: Phase 3 security model — resolution, RLS posture, interim admin auth

**Status:** Accepted · 2026-07-05

## Tenant resolution
- One resolver (`@hr/tenant-context` → `createTenantResolver`), used by every
  deployment shape: dedicated-container mode pins the slug via env (tier/theme
  still resolved live from the control plane per request), host/ingress mode
  resolves the Host header against ACTIVE `tenant_domains` rows.
- Unknown/inactive hostname → `null` (hard stop). There is no default tenant
  and no fallthrough; wrong-DB resolution requires forging control-plane data.
- Secrets are pluggable (`secretResolver`): local driver reads `_secrets/`,
  production reads the vault. Connection strings never live in the registry.

## RLS posture (groundwork)
- Tenant migration `0001_rls-groundwork`: RLS ENABLED on every tenant table,
  deny-by-default for non-owner roles; `hr_app` role holds the minimal grants
  + permissive policies the app layer needs.
- Per-USER scoping policies (self/team/all from auth claims) attach when
  Supabase Auth lands with the production driver — they will tighten this
  posture, never loosen it. Until then user scoping is enforced by
  `@hr/rbac` in the app layer (tested permission matrix).

## Admin console auth (interim)
- HTTP Basic via `apps/admin/proxy.ts` (`ADMIN_USER`/`ADMIN_PASSWORD`).
  With no credentials configured the console refuses any non-localhost Host.
  Replaced by the central IdP decision (ADR-0007 §6) before any real
  deployment.

## Verification (CI-runnable)
- `npm run test:unit` — RBAC permission matrix + entitlement matrix (15 tests).
- `npm run test:isolation` — routing cannot cross tenants: correct dedicated
  DB per hostname, no fallthrough, per-DB data containment, RLS enabled +
  unprivileged role denied (6 tests).
