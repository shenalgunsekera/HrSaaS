# ADR-0007: Open decisions (§14) — recommended defaults awaiting confirmation

**Status:** Partially resolved · updated 2026-07-05 — user approved the recommended defaults.
Items **1 → ADR-0008 (accepted)** and **5 → ADR-0009 (accepted)**. Items 2, 3, 4, 6, 8
proceed on the recommended defaults below (each gets its own ADR when implemented);
item 7's verification step is mandatory at Phase 6 start.

| # | Decision | Recommendation | Trade-off |
|---|---|---|---|
| 1 | Supabase account/org structure for many per-tenant projects | One Supabase **organization per environment** (prod/staging), projects created via Management API under it; plan self-hosted Supabase on a shared cluster (isolated namespace per tenant) past ~50–100 projects for cost/limits | Managed = fastest + least ops, but per-project cost and project caps; self-hosted = cheaper at scale, more ops burden |
| 2 | Custom domains day one? | Ship `{slug}.yourhr.app` (wildcard cert) at launch; add self-serve CNAME→verify→issue custom domains in Phase 5 | Delays a sales nicety, avoids ACME/DNS support load before there are customers. Per-company subdomain is mandatory either way |
| 3 | Scheduling vendor (consultation booking) | **Cal.com** behind a `SchedulerAdapter` (self-hostable, webhooks, no per-seat lock-in) | Calendly is slicker but closed + costlier; adapter makes the choice reversible |
| 4 | Payments/billing vendor + auto-gating | **Stripe Billing** behind a `BillingAdapter`; `billing_status=past_due` → grace banner, then suspend (retain data). LKR collection via local PSP adapter later if needed | Stripe LKR support is limited for local rails; adapter keeps a swap cheap |
| 5 | Hosting/runtime target | **Container platform** (e.g. Fly.io/Railway/AKS) for apps + provisioner: one artifact, regional pinning, scale-to-zero aligns with autosleep. Vercel acceptable for `apps/marketing` only | Vercel is easiest for Next but weak for the per-tenant dedicated-compute + worker model; containers cost a bit more setup now |
| 6 | Central IdP / enterprise SSO | Defer. Per-tenant Supabase Auth now; add a pluggable OIDC/SAML adapter above per-tenant auth when the first enterprise deal needs it | Building SSO now is speculative; the auth-adapter seam is already in the design |
| 7 | Gratuity + statutory rates | Implement gratuity as first-class statutory (Payment of Gratuity Act — ½ month's last salary per year after 5 years' service; EPF 8%+12%, ETF 3%; APIT brackets) — **verify all against IRD/CBSL/Labour Dept sources at Phase 6 start**; rates live in versioned `statutory_rates`/`tax_tables`, never code | None — verification is mandatory before payroll math ships |
| 8 | Retention window + erasure SLA | Retain-but-lock: **365 days** default (per-tenant configurable, `tenants.retention_days`); PDPA erasure SLA: teardown within **30 days** of a verified request, certificate of erasure logged | Longer retention = friendlier re-upgrades but more stored personal data to justify under PDPA data-minimization |
