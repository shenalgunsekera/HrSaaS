/**
 * Default tenant role definitions — the starting permission matrix every
 * tenant receives (tenant-admins can refine per role/field later via the
 * schema engine's per-field bindings).
 *
 * `moduleKey: '*'` = any module the COMPANY is entitled to; the entitlement
 * gate has already passed before these are evaluated.
 */
import type { RoleDefinition } from './index';

export const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'employee',
    permissions: [
      { moduleKey: '*', action: 'read', scope: 'self' },
      { moduleKey: 'employee-master', action: 'update', scope: 'self' },
      { moduleKey: 'leave', action: 'create', scope: 'self' },
      { moduleKey: 'attendance', action: 'create', scope: 'self' },
      { moduleKey: 'financial-wellness', action: 'create', scope: 'self' },
    ],
  },
  {
    role: 'manager',
    permissions: [
      { moduleKey: '*', action: 'read', scope: 'team' },
      { moduleKey: 'employee-master', action: 'update', scope: 'self' },
      { moduleKey: 'leave', action: 'create', scope: 'self' },
      { moduleKey: 'leave', action: 'approve', scope: 'team' },
      { moduleKey: 'attendance', action: 'approve', scope: 'team' },
      { moduleKey: 'performance', action: 'update', scope: 'team' },
      { moduleKey: 'recruitment', action: 'create', scope: 'team' },
    ],
  },
  {
    role: 'hr',
    permissions: [
      { moduleKey: '*', action: 'read', scope: 'all' },
      { moduleKey: '*', action: 'create', scope: 'all' },
      { moduleKey: '*', action: 'update', scope: 'all' },
      { moduleKey: '*', action: 'approve', scope: 'all' },
      { moduleKey: '*', action: 'export', scope: 'all' },
    ],
  },
  {
    role: 'payroll-admin',
    permissions: [
      { moduleKey: 'payroll', action: 'read', scope: 'all' },
      { moduleKey: 'payroll', action: 'create', scope: 'all' },
      { moduleKey: 'payroll', action: 'update', scope: 'all' },
      { moduleKey: 'payroll', action: 'approve', scope: 'all' },
      { moduleKey: 'payroll', action: 'export', scope: 'all' },
      { moduleKey: 'multi-entity-payroll', action: 'read', scope: 'all' },
      { moduleKey: 'multi-entity-payroll', action: 'approve', scope: 'all' },
      { moduleKey: 'employee-master', action: 'read', scope: 'all' },
      { moduleKey: 'attendance', action: 'read', scope: 'all' },
      { moduleKey: 'leave', action: 'read', scope: 'all' },
    ],
  },
  {
    role: 'tenant-admin',
    permissions: [
      { moduleKey: '*', action: 'read', scope: 'all' },
      { moduleKey: '*', action: 'create', scope: 'all' },
      { moduleKey: '*', action: 'update', scope: 'all' },
      { moduleKey: '*', action: 'delete', scope: 'all' },
      { moduleKey: '*', action: 'approve', scope: 'all' },
      { moduleKey: '*', action: 'export', scope: 'all' },
    ],
  },
];
