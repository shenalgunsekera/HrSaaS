# ADR-0002: Dedicated database + dedicated domain for every tenant (fixed)

**Status:** Accepted (directive — not revisitable) · 2026-07-04

## Decision
Every company, at every tier L1–L5, gets its own dedicated datastore (own
Supabase project or self-hosted instance) and its own domain
(`{slug}.yourhr.app` minimum; custom domains supported). No pooled/shared-DB
mode exists and none will be built. RLS stays enabled inside every tenant DB
as defense in depth (user/role scoping), and the tenant-aware data access
layer resolves the dedicated connection from the control plane per request.

## Consequences (accepted, designed for)
- Migrations always run across N databases → per-tenant migration ledger
  (`tenant_migrations`) + wave rollout (canary → fleet).
- Postgres connection-per-process economics → connection management planned
  from customer #1; autosleep for idle tenants (`tenants.autosleep_enabled`).
- Supabase per-project cost and project-count limits → track project usage
  centrally; decide account/organization structure before onboarding scales
  (open sub-question in ADR-0007 §1).
- Compliance upside: PDPA erasure = automated teardown of one whole datastore;
  data residency pinned per tenant.

## Cross-tenant leak posture
A leak must require multiple independent failures: wrong-connection resolution
AND RLS bypass AND auth compromise. Isolation tests (Phase 3+, CI) attempt
cross-tenant reads and assert failure.
