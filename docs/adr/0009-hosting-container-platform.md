# ADR-0009: Hosting/runtime target — container platform

**Status:** Accepted · 2026-07-05 (user approved recommended default)

## Decision
- `apps/app`, `apps/admin`, and `services/provisioner` ship as **containers**
  (Next standalone output; one versioned image for all tenants — never a
  per-tenant build). Target: a container platform with scale-to-zero
  (Fly.io / Railway / AKS-class; exact vendor picked at first deploy, images
  are platform-agnostic OCI).
- Scale-to-zero implements the **autosleep** cost guardrail: an idle tenant's
  app instance costs ~nothing; its dedicated DB pauses per ADR-0008.
- `apps/marketing` may deploy to Vercel (static/SSG, no tenant context).
- Per-tenant domains terminate at the platform edge; the app resolves the
  tenant from Host in `proxy.ts` — same image, config-only differences
  (non-negotiables #1–2).

## Trade-off accepted
More initial setup than all-in Vercel, but Vercel fits neither the dedicated-
compute-per-tenant economics nor the long-running provisioner worker.
