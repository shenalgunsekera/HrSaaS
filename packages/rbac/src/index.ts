/**
 * RBAC — the SECOND gate: "can this USER do this, within an entitled module?"
 * Evaluated only after @hr/entitlements passes. Changing a user's role must
 * never change what the company is licensed for, and vice-versa.
 *
 * Phase 0: types + guard contracts. Enforcement (JWT custom claims + RLS
 * policies inside each tenant DB + field-level checks bound to the schema
 * engine) lands in Phase 3.
 */

/** Tenant-level roles. `system-admin` is vendor-side (control plane only). */
export const ROLES = [
  'employee', //     self-service: sees own records only
  'manager', //      team scope
  'hr', //           all employees in the company
  'payroll-admin', //payroll + statutory
  'tenant-admin', // company settings, theme, schema wizard, roles
] as const;
export type Role = (typeof ROLES)[number];

export type RecordScope = 'self' | 'team' | 'all';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'export';

export interface Permission {
  moduleKey: string; //  @hr/entitlements ModuleKey
  action: Action;
  scope: RecordScope;
  /** Optional field-level restriction, bound to schema-engine field keys. */
  fieldKeys?: string[];
}

export interface RoleDefinition {
  role: Role;
  permissions: Permission[];
}

export interface AccessRequest {
  role: Role;
  moduleKey: string;
  action: Action;
  /** Relationship of the acting user to the target record. */
  targetScope: RecordScope;
  fieldKey?: string;
}

const scopeRank: Record<RecordScope, number> = { self: 0, team: 1, all: 2 };

/** Pure permission check. Entitlement must have been checked FIRST. */
export function isAllowed(defs: RoleDefinition[], req: AccessRequest): boolean {
  const def = defs.find((d) => d.role === req.role);
  if (!def) return false;
  return def.permissions.some(
    (p) =>
      (p.moduleKey === req.moduleKey || p.moduleKey === '*') &&
      p.action === req.action &&
      scopeRank[p.scope] >= scopeRank[req.targetScope] &&
      (!req.fieldKey || !p.fieldKeys || p.fieldKeys.includes(req.fieldKey)),
  );
}

export { DEFAULT_ROLE_DEFINITIONS } from './defaults';
