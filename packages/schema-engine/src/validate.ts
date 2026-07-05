/**
 * Runtime validation for metadata-driven records. Every rule derives from the
 * FieldDefinition — nothing here knows any specific object.
 */
import type { FieldDefinition, ObjectDefinition } from './types';

export interface ValidationIssue {
  fieldKey: string;
  message: string;
}

const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function checkField(f: FieldDefinition, value: unknown): string | null {
  const v = f.validation ?? {};
  if (isBlank(value)) return v.required ? 'is required' : null;

  switch (f.type) {
    case 'text':
    case 'longText': {
      if (typeof value !== 'string') return 'must be text';
      if (v.minLength && value.length < v.minLength) return `must be at least ${v.minLength} characters`;
      if (v.maxLength && value.length > v.maxLength) return `must be at most ${v.maxLength} characters`;
      if (v.pattern && !new RegExp(v.pattern).test(value)) return 'has an invalid format';
      return null;
    }
    case 'number':
    case 'currency': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return 'must be a number';
      if (v.min !== undefined && n < v.min) return `must be ≥ ${v.min}`;
      if (v.max !== undefined && n > v.max) return `must be ≤ ${v.max}`;
      return null;
    }
    case 'date':
    case 'datetime': {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'must be a valid date';
      return null;
    }
    case 'boolean':
      return typeof value === 'boolean' || value === 'true' || value === 'false'
        ? null
        : 'must be true or false';
    case 'singleSelect':
      return v.options?.includes(String(value)) ? null : 'must be one of the allowed options';
    case 'multiSelect': {
      const arr = Array.isArray(value) ? value : [value];
      return arr.every((x) => v.options?.includes(String(x)))
        ? null
        : 'contains a value outside the allowed options';
    }
    case 'lookup':
      return typeof value === 'string' && value.length > 0 ? null : 'must reference a record';
    case 'file':
      return typeof value === 'string' ? null : 'must be a file reference';
    case 'computed':
    case 'section':
      return null; // never user-supplied
    default:
      return 'unknown field type';
  }
}

/** Validate a record payload against a definition. Coerces nothing; reports all issues. */
export function validateRecord(
  def: ObjectDefinition,
  data: Record<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = new Set(def.fields.map((f) => f.key));
  for (const f of def.fields) {
    if (f.type === 'section' || f.type === 'computed') continue;
    const msg = checkField(f, data[f.key]);
    if (msg) issues.push({ fieldKey: f.key, message: `${f.label} ${msg}` });
  }
  for (const key of Object.keys(data)) {
    if (!known.has(key)) issues.push({ fieldKey: key, message: `${key} is not a defined field` });
  }
  return issues;
}

/** Filter a record to the fields a role may SEE (field-level RBAC binding). */
export function visibleFields(def: ObjectDefinition, role: string): FieldDefinition[] {
  return def.fields.filter(
    (f) => !f.visibleToRoles || f.visibleToRoles.length === 0 || f.visibleToRoles.includes(role),
  );
}

/** Fields a role may EDIT. */
export function editableFields(def: ObjectDefinition, role: string): FieldDefinition[] {
  return visibleFields(def, role).filter(
    (f) =>
      f.type !== 'computed' &&
      f.type !== 'section' &&
      (!f.editableByRoles || f.editableByRoles.length === 0 || f.editableByRoles.includes(role)),
  );
}
