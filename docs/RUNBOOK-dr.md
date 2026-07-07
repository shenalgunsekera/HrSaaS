# Runbook — backups, health, disaster recovery (Phase 9)

Every tenant runs a **dedicated database + domain**, so DR is per-tenant and
each incident is scoped to one company. All tooling below is the local Docker
driver; the production driver swaps `pg_dump`/`pg_restore` for the platform's
managed snapshot API with the identical verify-restore discipline.

## Backups (tested — an untested backup is not a backup)

```sh
npm run backup                 # all active tenants, each restore-VERIFIED
npm run backup -- --slug acme  # one tenant
```

For each tenant: `pg_dump -Fc` → `_backups/{slug}-{ts}.dump`, then the dump is
restored into a throwaway probe container and the employee row count is
asserted to match the source. Only then is the row written to
`tenant_backups` with `restore_tested = true`. Schedule daily (cron / routine).

Verify coverage:
```sh
docker exec hr-control-plane psql -U postgres -c \
  "select t.slug, b.created_at, b.restore_tested from tenant_backups b join tenants t on t.id=b.tenant_id order by b.created_at desc;"
```

## Health & observability

```sh
npm run health                        # snapshot every tenant → tenant_health
npm run health -- --autosleep --idle-min 30
```

Records reachability, latency, current migration tag, and idle minutes per
tenant into the control plane (one aggregated store, every row tenant-tagged).
`--autosleep` stops the app container of any tenant idle beyond the threshold
(idle = no `audit_log` activity in the window) and flags `tenants.sleeping`.
A slept tenant's dedicated compute costs ~nothing; the next redeploy/request
wakes it — the cost guardrail the dedicated-per-tenant model requires (§4.8).

## Migration waves (canary → fleet)

```sh
npm run migrate:tenants -- --canary globex,acme   # wave 1: cohort
# verify the canary cohort, then:
npm run migrate:tenants -- --rest globex,acme     # wave 2: everyone else
```

Migrations are backward-compatible (expand → migrate → contract), so app code
and schema never have to move in lockstep. Per-tenant success is tracked in
`tenant_migrations`; a failed tenant is recorded and does not block the others.

## Disaster recovery — rebuild one tenant

1. **Restore the database** from the latest verified backup:
   ```sh
   npm run restore -- --slug acme            # newest artifact
   npm run restore -- --slug acme --artifact acme-2026-07-06T....dump
   ```
   Drops+recreates the schema, restores the dump, asserts the employee count.
2. **Bring the app back** on the current image:
   ```sh
   npm run redeploy -- --slug acme
   ```
3. **Confirm** health + reachability:
   ```sh
   npm run health -- --slug acme    # (or curl the tenant's /status)
   ```

Full rebuild from scratch (lost container): the factory is idempotent —
`npm run provision -- --slug acme --name "…" --tier L3` recreates the DB +
domain + app, then `npm run restore -- --slug acme` layers the data back.

## Incident notes

- Cross-tenant blast radius is one company by construction (physical isolation).
- Certificates are per-domain; expiry = one tenant down. Production monitors
  ACME renewal and alerts before expiry.
- `service_role` / DB credentials are server-only (in `_secrets/` locally, a
  vault in production); never in the repo or client bundle.
