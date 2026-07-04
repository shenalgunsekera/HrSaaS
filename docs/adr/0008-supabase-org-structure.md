# ADR-0008: Supabase account/organization structure

**Status:** Accepted · 2026-07-05 (user approved recommended default)

## Decision
- One Supabase **organization per environment**: `hr-saas-prod`, `hr-saas-staging`.
- Tenant projects are created **only** by the provisioner via the Supabase
  Management API (service token in the vault), named `tenant-{slug}`, region
  pinned from `tenants.data_residency`.
- The control plane tracks project count and per-project cost; an alert fires
  at 80% of the organization's project quota.
- **Scale plan:** past ~50–100 tenant projects (or when per-project cost
  dominates), new tenants land on **self-hosted Supabase on a shared cluster**
  — own database, own resource limits, own network boundary per tenant (still
  physical isolation, cheaper dedication). `tenants.db_ref` already abstracts
  managed-vs-self-hosted, so migration is per-tenant and non-breaking.

## Trade-off accepted
Managed Supabase first = fastest to market, least ops; the project-count and
cost ceilings are mitigated by the driver abstraction and autosleep guardrail.

## Development/local
A `local-docker` datastore driver provisions one Postgres container per tenant
with the same pipeline — used for dev and for Phase 1's reproducible-tenant
proof. The driver interface is identical to the Supabase driver.
