/**
 * Dynamic schema engine — metadata model (Phase 0: types; storage,
 * wizard, and rendering land in Phase 4).
 *
 * SCOPE LINE (non-negotiable #4): this engine governs CUSTOM FIELDS on core
 * objects and fully CUSTOM OBJECTS only. Statutory / payroll / compliance
 * entities are fixed typed schema and are NOT editable here. Guardrails must
 * refuse edits to compliance-critical cores.
 *
 * Storage: custom-field values and custom-object records go to JSONB with
 * engine-enforced validation and GIN indexes where queried — never naive EAV.
 * Definitions are versioned; changes never mutate an old version in place.
 */

export const FIELD_TYPES = [
  'text',
  'longText',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'singleSelect',
  'multiSelect',
  'lookup', //   reference to another object
  'file', //     document/file attachment
  'computed', // derived, read-only
  'section', //  heading / visual group marker
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; //   regex for text
  options?: string[]; // singleSelect / multiSelect
  lookupObject?: string; // lookup target object key
  formula?: string; //   computed fields
  fileTypes?: string[];
  maxFileSizeMb?: number;
}

export interface FieldDefinition {
  key: string; //        stable snake_case key (storage key in JSONB)
  label: string;
  type: FieldType;
  helpText?: string;
  defaultValue?: unknown;
  validation?: FieldValidation;
  /** RBAC binding: roles that may see / edit this field. Empty = all. */
  visibleToRoles?: string[];
  editableByRoles?: string[];
  displayOrder: number;
  sectionKey?: string;
}

export interface ObjectDefinition {
  key: string; //   e.g. 'employee' (core-extension) or 'site-safety-record'
  label: string;
  icon?: string;
  /**
   * 'core-extension': adds custom fields to a fixed core object.
   * 'custom': entirely tenant-defined object stored via the engine.
   */
  kind: 'core-extension' | 'custom';
  /** For core-extension: which core object it extends. */
  extendsCore?: string;
  /** Module the object belongs to — entitlement-gated (a company can only
   *  build within modules it is licensed for). */
  moduleKey: string;
  sections: Array<{ key: string; label: string; displayOrder: number }>;
  fields: FieldDefinition[];
  version: number;
  status: 'draft' | 'published' | 'archived';
}

export interface LayoutDefinition {
  objectKey: string;
  kind: 'form' | 'detail' | 'list';
  /** Ordered field keys per section (form/detail) or columns (list). */
  arrangement: Array<{ sectionKey?: string; fieldKeys: string[]; columns?: 1 | 2 }>;
  version: number;
}

/** Core objects the wizard may EXTEND but never alter or delete. */
export const PROTECTED_CORE_OBJECTS = [
  'employee',
  'payroll-run',
  'payslip',
  'statutory-record',
  'attendance-record',
  'leave-request',
  'leave-balance',
] as const;

export function isProtectedCore(objectKey: string): boolean {
  return (PROTECTED_CORE_OBJECTS as readonly string[]).includes(objectKey);
}
