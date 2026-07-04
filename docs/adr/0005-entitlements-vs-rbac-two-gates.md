# ADR-0005: Entitlements and RBAC as two independent gates

**Status:** Accepted · 2026-07-04

## Decision
Two separate packages that never import each other's logic:
- `@hr/entitlements` — company gate. Tier → module flags, data-driven from the
  feature-sheet matrix (`modules.ts`, transcribed verbatim). Per-tenant
  overrides overlay tier defaults (`tenant_entitlement_overrides`).
  Downgrade = retain-but-lock (`{ enabled: true, locked: true }`).
- `@hr/rbac` — user gate. Roles → permissions with action, record scope
  (self/team/all) and optional field-level keys binding to schema-engine
  definitions. Enforced via JWT claims + RLS inside each tenant DB (Phase 3).

Access requires BOTH: `canUseModule(entitlements, m)` **and**
`isAllowed(roleDefs, req)`. Changing a role can never change licensing;
changing a tier can never change a user's role.

## Rationale
Non-negotiable #3. Blending these is the classic way HR products end up with
"the admin can see Payroll even though the company never bought it".
