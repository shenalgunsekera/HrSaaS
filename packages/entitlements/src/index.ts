/**
 * Entitlements — the FIRST gate: "does this COMPANY have this module?"
 * Keyed to tenant + tier. Entirely separate from RBAC (@hr/rbac), which is
 * the second gate evaluated per user WITHIN an entitled module. Both gates
 * must pass; neither may influence the other.
 */
import { MODULES, TIERS, type ModuleKey, type Tier } from './modules';

export * from './modules';

export interface ModuleEntitlement {
  enabled: boolean;
  /** true = retain-but-lock: data preserved, UI read-only (downgrade state). */
  locked: boolean;
}

export type EntitlementSet = Record<ModuleKey, ModuleEntitlement>;

export interface EntitlementOverride {
  moduleKey: ModuleKey;
  enabled: boolean;
  locked?: boolean;
  expiresAt?: Date | null;
}

const tierRank = (t: Tier) => TIERS.indexOf(t);

/** Base flags for a tier, straight from the feature-sheet matrix. */
export function entitlementsForTier(tier: Tier): EntitlementSet {
  const out = {} as EntitlementSet;
  for (const m of MODULES) {
    out[m.key] = { enabled: tierRank(tier) >= tierRank(m.minTier), locked: false };
  }
  return out;
}

/**
 * Full resolution: tier defaults → retain-but-lock for previously held higher
 * tier → explicit per-tenant overrides from the control plane.
 */
export function resolveEntitlements(input: {
  tier: Tier;
  maxTierHeld?: Tier;
  overrides?: EntitlementOverride[];
  now?: Date;
}): EntitlementSet {
  const { tier, maxTierHeld, overrides = [], now = new Date() } = input;
  const set = entitlementsForTier(tier);

  // Downgrade: modules from the previously held higher tier stay visible but locked.
  if (maxTierHeld && tierRank(maxTierHeld) > tierRank(tier)) {
    for (const m of MODULES) {
      if (
        tierRank(m.minTier) > tierRank(tier) &&
        tierRank(m.minTier) <= tierRank(maxTierHeld)
      ) {
        set[m.key] = { enabled: true, locked: true };
      }
    }
  }

  for (const o of overrides) {
    if (o.expiresAt && o.expiresAt < now) continue;
    set[o.moduleKey] = { enabled: o.enabled, locked: o.locked ?? false };
  }
  return set;
}

/** Guard used by app code: module usable (entitled AND not locked)? */
export function canUseModule(set: EntitlementSet, key: ModuleKey): boolean {
  const e = set[key];
  return !!e && e.enabled && !e.locked;
}

/** Module visible at all (usable or retained-but-locked)? */
export function canSeeModule(set: EntitlementSet, key: ModuleKey): boolean {
  const e = set[key];
  return !!e && e.enabled;
}
