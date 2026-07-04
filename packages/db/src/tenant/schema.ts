/**
 * TENANT schema — lives inside each tenant's DEDICATED database.
 * Phase 1 foundation tables only; module tables (employee master, attendance,
 * leave, payroll, …) land in Phase 6+ and exist in EVERY tenant DB regardless
 * of tier (upgrade = flag flip, non-negotiable #6).
 *
 * NOTE there is deliberately no tenant_id column anywhere: isolation is
 * physical (one company = one database). RLS policies for user/role scoping
 * inside the tenant DB are added in Phase 3 alongside auth wiring.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  date,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const memberRoleEnum = pgEnum('member_role', [
  'employee',
  'manager',
  'hr',
  'payroll-admin',
  'tenant-admin',
]);

/** People who can sign in to THIS company's instance. */
export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Supabase Auth user id once auth is wired (Phase 3). */
    authUserId: uuid('auth_user_id'),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    role: memberRoleEnum('role').notNull().default('employee'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tenant_members_email_idx').on(t.email)],
);

/** This instance's own identity + settings (written by the factory). */
export const tenantMeta = pgTable('tenant_meta', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* Statutory reference data — seeded from the control plane by the factory,
   refreshed by the migration orchestrator. Same shapes as the central copies. */

export const statutoryRates = pgTable(
  'statutory_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    country: varchar('country', { length: 2 }).notNull().default('LK'),
    kind: varchar('kind', { length: 32 }).notNull(),
    ratePercent: numeric('rate_percent', { precision: 6, scale: 3 }),
    params: jsonb('params').$type<Record<string, unknown>>(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    source: text('source'),
  },
  (t) => [index('t_statutory_rates_lookup_idx').on(t.country, t.kind, t.effectiveFrom)],
);

export const taxTables = pgTable(
  'tax_tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    country: varchar('country', { length: 2 }).notNull().default('LK'),
    name: varchar('name', { length: 64 }).notNull(),
    brackets: jsonb('brackets')
      .$type<Array<{ upTo: number | null; ratePercent: number }>>()
      .notNull(),
    reliefs: jsonb('reliefs').$type<Record<string, number>>(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    source: text('source'),
  },
  (t) => [index('t_tax_tables_lookup_idx').on(t.country, t.name, t.effectiveFrom)],
);

export const holidayCalendars = pgTable(
  'holiday_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    country: varchar('country', { length: 2 }).notNull().default('LK'),
    year: integer('year').notNull(),
    holidays: jsonb('holidays')
      .$type<Array<{ date: string; name: string; type: string }>>()
      .notNull(),
  },
  (t) => [uniqueIndex('t_holiday_calendar_unique').on(t.country, t.year)],
);

/** In-tenant audit trail (who created/modified what, when). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorMemberId: uuid('actor_member_id'),
    action: varchar('action', { length: 64 }).notNull(),
    objectKey: varchar('object_key', { length: 64 }),
    recordId: text('record_id'),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('t_audit_object_idx').on(t.objectKey, t.createdAt)],
);
