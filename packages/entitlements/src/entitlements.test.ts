import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULES,
  canSeeModule,
  canUseModule,
  entitlementsForTier,
  resolveEntitlements,
} from './index';

describe('Entitlements (first gate) — tier matrix from the feature sheet', () => {
  it('module counts per tier match the sheet', () => {
    const counts = { L1: 8, L2: 13, L3: 18, L4: 19, L5: 20 } as const;
    for (const [tier, expected] of Object.entries(counts)) {
      const set = entitlementsForTier(tier as never);
      const enabled = MODULES.filter((m) => set[m.key].enabled).length;
      assert.equal(enabled, expected, `${tier} should enable ${expected} modules`);
    }
  });

  it('L1 includes payroll and data privacy; excludes recruitment', () => {
    const set = entitlementsForTier('L1');
    assert.ok(canUseModule(set, 'payroll'));
    assert.ok(canUseModule(set, 'data-privacy'));
    assert.ok(!canSeeModule(set, 'recruitment'));
  });

  it('downgrade retains-but-locks previously held modules (never deletes)', () => {
    const set = resolveEntitlements({ tier: 'L1', maxTierHeld: 'L3' });
    assert.ok(!canUseModule(set, 'succession'), 'locked module is not usable');
    assert.ok(canSeeModule(set, 'succession'), 'locked module stays visible');
    assert.deepEqual(set['succession'], { enabled: true, locked: true });
    // L4/L5 modules were never held → plain disabled, not locked
    assert.deepEqual(set['hr-analytics'], { enabled: false, locked: false });
  });

  it('re-upgrade unlocks instantly', () => {
    const set = resolveEntitlements({ tier: 'L3', maxTierHeld: 'L3' });
    assert.ok(canUseModule(set, 'succession'));
    assert.ok(canUseModule(set, 'multi-entity-payroll'));
  });

  it('overrides overlay tier defaults and expire', () => {
    const now = new Date('2026-07-05T00:00:00Z');
    const set = resolveEntitlements({
      tier: 'L1',
      overrides: [
        { moduleKey: 'recruitment', enabled: true }, // early access
        { moduleKey: 'payroll', enabled: false }, // suspended module
        { moduleKey: 'training', enabled: true, expiresAt: new Date('2026-01-01') }, // expired
      ],
      now,
    });
    assert.ok(canUseModule(set, 'recruitment'));
    assert.ok(!canUseModule(set, 'payroll'));
    assert.ok(!canUseModule(set, 'training'));
  });

  it('roles never appear here — entitlements are company-level only', () => {
    const set = entitlementsForTier('L5');
    for (const m of MODULES) {
      assert.deepEqual(Object.keys(set[m.key]).sort(), ['enabled', 'locked']);
    }
  });
});
