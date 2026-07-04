# ADR-0006: Schema engine — metadata-driven, JSONB storage, protected cores

**Status:** Accepted · 2026-07-04

## Decision
- Custom **fields** on core objects and fully **custom objects** are defined as
  versioned, tenant-scoped metadata (`ObjectDefinition`/`FieldDefinition`/
  `LayoutDefinition` in `@hr/schema-engine`).
- Values: JSONB columns with engine-enforced validation and GIN indexes where
  queried — **not** EAV rows. Core objects keep typed columns; their custom
  fields go to a JSONB `custom` column on the core table.
- Statutory/payroll/compliance entities are fixed typed schema and are
  refused by the wizard (`PROTECTED_CORE_OBJECTS` guardrail).
- Starter templates are generated from `HR_System_Feature_Sheets_v5` lettered
  field groups; Employee Master (A–K) is transcribed as the proof pattern,
  remaining modules in Phase 4.
- Definitions are versioned; field changes create a new definition version so
  existing records never corrupt. Dynamic-change migrations flow through the
  same orchestrated per-tenant pipeline.

## Rationale
Non-negotiable #4: dynamic where safe, typed where money/compliance flows.
JSONB keeps reporting sane (single row per record, indexable) where EAV
explodes joins.
