import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ObjectDefinition } from './types';
import { editableFields, validateRecord, visibleFields } from './validate';
import { isProtectedCore } from './types';

const def: ObjectDefinition = {
  key: 'site-safety-record',
  label: 'Site Safety Record',
  kind: 'custom',
  moduleKey: 'employee-master',
  version: 1,
  status: 'published',
  sections: [{ key: 'general', label: 'General', displayOrder: 1 }],
  fields: [
    { key: 'site_name', label: 'Site Name', type: 'text', displayOrder: 1, sectionKey: 'general', validation: { required: true, minLength: 3 } },
    { key: 'severity', label: 'Severity', type: 'singleSelect', displayOrder: 2, sectionKey: 'general', validation: { required: true, options: ['Low', 'Medium', 'High'] } },
    { key: 'incident_date', label: 'Incident Date', type: 'date', displayOrder: 3, sectionKey: 'general' },
    { key: 'headcount', label: 'Headcount', type: 'number', displayOrder: 4, sectionKey: 'general', validation: { min: 0, max: 10000 } },
    { key: 'reviewed', label: 'Reviewed', type: 'boolean', displayOrder: 5, sectionKey: 'general', visibleToRoles: ['hr', 'tenant-admin'], editableByRoles: ['hr'] },
  ],
};

describe('schema engine validation', () => {
  it('accepts a valid record', () => {
    assert.deepEqual(
      validateRecord(def, { site_name: 'Colombo Plant', severity: 'High', incident_date: '2026-07-01', headcount: '42' }),
      [],
    );
  });

  it('enforces required, options, ranges, patterns', () => {
    const issues = validateRecord(def, { severity: 'Catastrophic', headcount: '-5', site_name: 'ab' });
    const keys = issues.map((i) => i.fieldKey).sort();
    assert.deepEqual(keys, ['headcount', 'severity', 'site_name']);
  });

  it('rejects unknown fields (no silent EAV-style sprawl)', () => {
    const issues = validateRecord(def, { site_name: 'Colombo Plant', severity: 'Low', hacked: 'x' });
    assert.ok(issues.some((i) => i.fieldKey === 'hacked'));
  });

  it('field-level visibility and editability bind to roles', () => {
    assert.ok(!visibleFields(def, 'employee').some((f) => f.key === 'reviewed'));
    assert.ok(visibleFields(def, 'hr').some((f) => f.key === 'reviewed'));
    assert.ok(editableFields(def, 'hr').some((f) => f.key === 'reviewed'));
    assert.ok(!editableFields(def, 'tenant-admin').some((f) => f.key === 'reviewed'), 'visible-but-not-editable');
  });

  it('protected cores are recognized', () => {
    assert.ok(isProtectedCore('payslip'));
    assert.ok(isProtectedCore('payroll-run'));
    assert.ok(!isProtectedCore('site-safety-record'));
  });
});
