# Runbook — tenant lifecycle (local Docker driver)

Prereqs: Docker Desktop running, `npm install` done, image built once:

```sh
npm run docker:build:app        # builds hr-app:dev (one image for ALL tenants)
```

## Unattended mode (admin console + worker)

```sh
npm run worker                      # factory worker (claims queued runs)
npm run dev:admin                   # System Admin console → http://localhost:3002
```

Create a tenant in the console (or `POST /api/tenants` with
`{slug,name,tier,brand}`) — the worker provisions it unattended; watch the
step ledger on the tenant detail page. Tier flips on the detail page apply to
live instances immediately (downgrade = retain-but-lock, never delete).

## Provision (one command, zero manual steps, idempotent)

```sh
node scripts/provision-tenant.mjs --slug acme --name "Acme Holdings" --tier L3 \
  [--brand "#0D9488"] [--port 4101] [--admin admin@acme.lk]
```

What it does (steps ledgered in `provisioning_runs`; re-run resumes/heals):
1. control plane container (`hr-control-plane`) up + migrated
2. dedicated tenant DB container (`hr-tenant-{slug}-db`, own volume, own password in `_secrets/`)
3. tenant migrations applied, recorded in `tenant_migrations`
4. SL statutory seeds (EPF/ETF/gratuity, APIT placeholder — UNVERIFIED until Phase 6, holidays)
5. domain record `{slug}.localhost` (+ cert step, no-op locally)
6. entitlements = tier; first admin user; theme applied
7. app container (`hr-tenant-{slug}-app`) from the shared `hr-app:dev` image, env-only config
8. tenant marked `active`, audit logged

Instance: `http://localhost:{port}/status`.

## Teardown (hard cancellation / PDPA erasure)

```sh
node scripts/teardown-tenant.mjs --slug acme
```

Removes app + DB containers **and the data volume**, deletes secrets, marks the
tenant `erased`, records a teardown run + audit entry.

## Inspect

```sh
docker ps --filter name=hr-                       # running instances
docker exec hr-control-plane psql -U postgres -c "table tenants;"
docker exec hr-tenant-acme-db psql -U postgres -c "table tenant_members;"
```

## Production driver

Same pipeline, different driver: Supabase Management API creates the project
(ADR-0008), platform API runs the container + domain + ACME cert (ADR-0009).
Driver selection comes from provisioner config, not code paths per tenant.
