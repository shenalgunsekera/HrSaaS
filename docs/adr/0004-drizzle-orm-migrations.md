# ADR-0004: Drizzle ORM + git-tracked SQL migrations

**Status:** Accepted · 2026-07-04

## Decision
Drizzle ORM (0.45.x) with drizzle-kit migrations, per database class:
control plane (`packages/db/src/control-plane`) and, from Phase 1, the tenant
schema (`packages/db/src/tenant`). Every tenant-schema migration ships its
matching RLS policy changes in the same change-set.

## Rules
- Migrations are backward-compatible (**expand → migrate → contract**) so code
  and schema never change in lockstep across N tenant databases.
- The provisioner applies tenant migrations and records each in
  `tenant_migrations` (per-tenant ledger); rollout is in waves.
- The FULL tenant schema exists from day one (all tiers) — upgrade is a flag
  flip (non-negotiable #6), never a migration.

## Rationale
Typed schema ↔ TS types in one place; plain SQL artifacts reviewable in PRs;
no runtime magic in a payroll system where auditability matters.
