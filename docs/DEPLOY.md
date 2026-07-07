# Deploy — fastest test on Supabase + Vercel

Goal: get the real product running on Supabase (control plane + one tenant) with
all three apps on Vercel, tenant pinned by slug (no custom domains yet).

## 1. Supabase — create two projects (~10 min, free tier)

At supabase.com, in one organization, create **two** projects (region:
Singapore or Mumbai for Sri Lanka):

| Project | Purpose |
|---|---|
| `hr-control-plane` | vendor brain (registry, entitlements, prospects) |
| `hr-tenant-demo` | the first tenant's dedicated database |

For **each**, set a DB password you'll remember, then from
**Project Settings → Database → Connection string** copy two forms:
- **Direct** (host `db.<ref>.supabase.co`, port **5432**) — for migrations
- **Transaction pooler** (Supavisor, port **6543**) — for the apps at runtime

Append `?sslmode=require` to every connection string.

## 2. Wire them (one command, from your machine)

```sh
CONTROL_PLANE_DATABASE_URL="<control-plane DIRECT 5432 url>" \
TENANT_DATABASE_URL="<tenant DIRECT 5432 url>" \
node scripts/setup-supabase.mjs --slug demo --name "Demo Company" --tier L3 --brand "#0D9488"
```

This migrates both databases, seeds the verified SL statutory data, and
registers the tenant as active. Idempotent.

## 3. Vercel — three projects from the one GitHub repo

Import `github.com/shenalgunsekera/HrSaaS` three times (New Project → same repo),
each with a different **Root Directory**:

| Vercel project | Root Directory | Env vars |
|---|---|---|
| hr-marketing | `apps/marketing` | `CONTROL_PLANE_DATABASE_URL` (pooler 6543) |
| hr-admin | `apps/admin` | `CONTROL_PLANE_DATABASE_URL` (pooler), `ADMIN_USER`, `ADMIN_PASSWORD` |
| hr-app | `apps/app` | `CONTROL_PLANE_DATABASE_URL` (pooler), `TENANT_SLUG=demo`, `TENANT_DATABASE_URL` (tenant pooler) |

Vercel auto-detects Next.js + npm workspaces (installs at repo root, builds the
app). Framework preset: Next.js. Leave build/output at defaults.

Deploy. The tenant app serves the `demo` tenant; admin manages the control
plane; marketing shows data-driven pricing.

## What comes after this first test
- **Custom per-tenant domains** (`{slug}.yourhr.app`) instead of the pinned slug.
- **Auto-provisioning driver**: Supabase Management API creates a project per
  tenant unattended (needs `SUPABASE_ACCESS_TOKEN` + `SUPABASE_ORG_ID`, and a
  Pro org since free tier caps at ~2 projects).
- **Real per-tenant auth**: Supabase Auth inside each tenant project, replacing
  the interim `_role` field (see docs/SECURITY.md).

## Note on the provisioner worker
The long-running factory worker (`services/provisioner`) is for unattended
multi-tenant provisioning and does **not** run on Vercel (serverless). For this
test, `setup-supabase.mjs` does the provisioning from your machine. At scale it
runs on a small always-on host or as a scheduled job (ADR-0009).
