import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed } from './index';
import { DEFAULT_ROLE_DEFINITIONS } from './defaults';

const defs = DEFAULT_ROLE_DEFINITIONS;

describe('RBAC permission matrix (second gate)', () => {
  it('employee reads own record but not others', () => {
    assert.ok(isAllowed(defs, { role: 'employee', moduleKey: 'employee-master', action: 'read', targetScope: 'self' }));
    assert.ok(!isAllowed(defs, { role: 'employee', moduleKey: 'employee-master', action: 'read', targetScope: 'team' }));
    assert.ok(!isAllowed(defs, { role: 'employee', moduleKey: 'employee-master', action: 'read', targetScope: 'all' }));
  });

  it('employee cannot read payroll beyond self, never exports', () => {
    assert.ok(isAllowed(defs, { role: 'employee', moduleKey: 'payroll', action: 'read', targetScope: 'self' }));
    assert.ok(!isAllowed(defs, { role: 'employee', moduleKey: 'payroll', action: 'read', targetScope: 'all' }));
    assert.ok(!isAllowed(defs, { role: 'employee', moduleKey: 'payroll', action: 'export', targetScope: 'self' }));
  });

  it('manager approves team leave but not company-wide', () => {
    assert.ok(isAllowed(defs, { role: 'manager', moduleKey: 'leave', action: 'approve', targetScope: 'team' }));
    assert.ok(isAllowed(defs, { role: 'manager', moduleKey: 'leave', action: 'approve', targetScope: 'self' }));
    assert.ok(!isAllowed(defs, { role: 'manager', moduleKey: 'leave', action: 'approve', targetScope: 'all' }));
  });

  it('manager cannot update payroll', () => {
    assert.ok(!isAllowed(defs, { role: 'manager', moduleKey: 'payroll', action: 'update', targetScope: 'team' }));
  });

  it('hr sees and edits all, cannot delete', () => {
    assert.ok(isAllowed(defs, { role: 'hr', moduleKey: 'succession', action: 'read', targetScope: 'all' }));
    assert.ok(isAllowed(defs, { role: 'hr', moduleKey: 'employee-master', action: 'update', targetScope: 'all' }));
    assert.ok(!isAllowed(defs, { role: 'hr', moduleKey: 'employee-master', action: 'delete', targetScope: 'all' }));
  });

  it('payroll-admin is payroll-scoped, not an HR superuser', () => {
    assert.ok(isAllowed(defs, { role: 'payroll-admin', moduleKey: 'payroll', action: 'export', targetScope: 'all' }));
    assert.ok(!isAllowed(defs, { role: 'payroll-admin', moduleKey: 'succession', action: 'read', targetScope: 'all' }));
    assert.ok(!isAllowed(defs, { role: 'payroll-admin', moduleKey: 'employee-master', action: 'update', targetScope: 'all' }));
  });

  it('tenant-admin can do everything within entitled modules', () => {
    assert.ok(isAllowed(defs, { role: 'tenant-admin', moduleKey: 'ai-assistant', action: 'delete', targetScope: 'all' }));
  });

  it('field-level restriction wins when present', () => {
    const custom = [
      {
        role: 'manager' as const,
        permissions: [
          { moduleKey: 'employee-master', action: 'read' as const, scope: 'team' as const, fieldKeys: ['full_name'] },
        ],
      },
    ];
    assert.ok(isAllowed(custom, { role: 'manager', moduleKey: 'employee-master', action: 'read', targetScope: 'team', fieldKey: 'full_name' }));
    assert.ok(!isAllowed(custom, { role: 'manager', moduleKey: 'employee-master', action: 'read', targetScope: 'team', fieldKey: 'basic_salary' }));
  });

  it('unknown role is denied everything', () => {
    assert.ok(!isAllowed(defs, { role: 'auditor' as never, moduleKey: 'leave', action: 'read', targetScope: 'self' }));
  });
});
