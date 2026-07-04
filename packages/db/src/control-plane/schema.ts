/**
 * CONTROL PLANE schema — vendor-side registry, never queryable by tenants.
 *
 * Holds: tenant registry, domains, tiers/entitlement overrides, dedicated
 * datastore references, provisioning state, billing status, branding, deployed
 * versions, prospects (marketing leads), and shared Sri Lanka statutory
 * reference data (tax tables, EPF/ETF rates, holiday calendars).
 *
 * Isolation policy (fixed): every tenant gets its own dedicated database
 * (own Supabase project / self-hosted instance) AND its own domain, at every
 * tier. `tenants.db_ref` points at that dedicated datastore; there is no
 * pooled mode and no tenant_id-scoped shared business tables anywhere.
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

/* ── enums ─────────────────────────────────────────────────────────── */

export const tierEnum = pgEnum('tier', ['L1', 'L2', 'L3', 'L4', 'L5']);

export const tenantStatusEnum = pgEnum('tenant_status', [
  'prospect', //      lead captured, not yet a customer
  'provisioning', //  factory pipeline running
  'active',
  'suspended', //     e.g. billing hold — access gated, data retained
  'downgraded_locked', // retain-but-lock data from a higher tier
  'pending_erasure', //   hard cancellation requested, teardown scheduled
  'erased', //        PDPA erasure complete (registry row kept as legal record)
]);

export const provisioningStatusEnum = pgEnum('provisioning_status', [
  'queued',
  'running',
  'failed',
  'complete',
]);

export const domainTypeEnum = pgEnum('domain_type', ['platform_subdomain', 'custom']);

export const domainStatusEnum = pgEnum('domain_status', [
  'pending_dns', //  waiting for customer CNAME (custom domains)
  'verifying',
  'issuing_cert',
  'active',
  'expiring_soon', // renewal alert raised
  'failed',
]);

export const billingStatusEnum = pgEnum('billing_status', [
  'trial',
  'active',
  'past_due',
  'cancelled',
]);

/* ── tenant registry ───────────────────────────────────────────────── */

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 63 }).notNull(), // {slug}.yourhr.app
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    region: varchar('region', { length: 32 }).notNull().default('ap-south-1'),
    dataResidency: varchar('data_residency', { length: 2 }).notNull().default('LK'),
    tier: tierEnum('tier').notNull().default('L1'),
    status: tenantStatusEnum('status').notNull().default('prospect'),
    billingStatus: billingStatusEnum('billing_status').notNull().default('trial'),
    /**
     * Reference to the tenant's DEDICATED datastore: Supabase project ref or
     * self-hosted instance id. Connection secrets live in the vault under
     * this key — never here.
     */
    dbRef: varchar('db_ref', { length: 128 }),
    /** App artifact version currently serving this tenant. */
    deployedVersion: varchar('deployed_version', { length: 64 }),
    /** Highest tier ever held — governs retain-but-lock on downgrade. */
    maxTierHeld: tierEnum('max_tier_held').notNull().default('L1'),
    /** Retention window (days) for retained-but-locked data. */
    retentionDays: integer('retention_days').notNull().default(365),
    /** Logo URL + brand CSS variable overrides (design-system contract). */
    theme: jsonb('theme').$type<{
      logoUrl?: string;
      colors?: Record<string, string>;
    }>(),
    autosleepEnabled: boolean('autosleep_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tenants_slug_idx').on(t.slug),
    index('tenants_status_idx').on(t.status),
  ],
);

/* ── domains & certificates ────────────────────────────────────────── */

export const tenantDomains = pgTable(
  'tenant_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull(), // e.g. acme.yourhr.app | hr.acme.lk
    type: domainTypeEnum('type').notNull(),
    status: domainStatusEnum('status').notNull().default('pending_dns'),
    isPrimary: boolean('is_primary').notNull().default(false),
    certExpiresAt: timestamp('cert_expires_at', { withTimezone: true }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tenant_domains_hostname_idx').on(t.hostname),
    index('tenant_domains_tenant_idx').on(t.tenantId),
    // cert-renewal monitor scans by expiry
    index('tenant_domains_cert_expiry_idx').on(t.certExpiresAt),
  ],
);

/* ── entitlements ──────────────────────────────────────────────────── */

/**
 * Per-tenant entitlement overrides. The BASE set of module flags derives
 * from `tenants.tier` via @hr/entitlements (data-driven from the feature
 * sheet). Rows here override individual flags (early access, retain-but-lock
 * on downgrade, promos). Resolution: tier defaults → overlaid by these rows.
 */
export const tenantEntitlementOverrides = pgTable(
  'tenant_entitlement_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleKey: varchar('module_key', { length: 64 }).notNull(), // @hr/entitlements ModuleKey
    enabled: boolean('enabled').notNull(),
    /** Module visible but read-only (retain-but-lock downgrade state). */
    locked: boolean('locked').notNull().default(false),
    reason: text('reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('entitlement_override_unique').on(t.tenantId, t.moduleKey)],
);

/* ── provisioning factory ──────────────────────────────────────────── */

/**
 * One row per factory pipeline execution (provision / migrate / teardown /
 * domain issue …). Steps are recorded so a re-run heals instead of
 * duplicating: completed steps are skipped (idempotency).
 */
export const provisioningRuns = pgTable(
  'provisioning_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(), // provision | migrate | teardown | domain
    status: provisioningStatusEnum('status').notNull().default('queued'),
    /** step key → { status, startedAt, finishedAt, error } */
    steps: jsonb('steps')
      .$type<
        Record<
          string,
          { status: 'pending' | 'done' | 'failed'; startedAt?: string; finishedAt?: string; error?: string }
        >
      >()
      .notNull()
      .default({}),
    attempt: integer('attempt').notNull().default(1),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('provisioning_runs_tenant_idx').on(t.tenantId)],
);

/** Per-tenant migration ledger: which schema version each dedicated DB is on. */
export const tenantMigrations = pgTable(
  'tenant_migrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    migrationTag: varchar('migration_tag', { length: 128 }).notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    succeeded: boolean('succeeded').notNull(),
    error: text('error'),
  },
  (t) => [uniqueIndex('tenant_migration_unique').on(t.tenantId, t.migrationTag)],
);

/* ── prospects (marketing → provisioning handoff) ──────────────────── */

export const prospects = pgTable(
  'prospects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyName: text('company_name').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    phone: varchar('phone', { length: 32 }),
    headcount: integer('headcount'),
    interestedTier: tierEnum('interested_tier'),
    consultationAt: timestamp('consultation_at', { withTimezone: true }),
    schedulerRef: text('scheduler_ref'), // adapter-specific booking id
    /** Branding intake carried into tenant creation. */
    brandingIntake: jsonb('branding_intake').$type<{
      logoUrl?: string;
      colors?: Record<string, string>;
      preferredSlug?: string;
    }>(),
    notes: text('notes'),
    /** Set when converted — links the lead to the provisioned tenant. */
    convertedTenantId: uuid('converted_tenant_id').references(() => tenants.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('prospects_email_idx').on(t.email)],
);

/* ── shared statutory reference data (Sri Lanka) ───────────────────── */

/**
 * Versioned statutory rates (EPF employee/employer, ETF, gratuity params).
 * A rate change is a new row with a new effective window — data update,
 * never a redeploy. Seeded into each tenant DB by the factory and refreshed
 * by the migration orchestrator.
 */
export const statutoryRates = pgTable(
  'statutory_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    country: varchar('country', { length: 2 }).notNull().default('LK'),
    kind: varchar('kind', { length: 32 }).notNull(), // epf_employee | epf_employer | etf_employer | gratuity
    ratePercent: numeric('rate_percent', { precision: 6, scale: 3 }),
    params: jsonb('params').$type<Record<string, unknown>>(), // e.g. gratuity service threshold
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    source: text('source'), // authoritative citation
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('statutory_rates_lookup_idx').on(t.country, t.kind, t.effectiveFrom)],
);

/** APIT (PAYE) tax brackets, versioned by effective window. */
export const taxTables = pgTable(
  'tax_tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    country: varchar('country', { length: 2 }).notNull().default('LK'),
    name: varchar('name', { length: 64 }).notNull(), // e.g. APIT
    /** Ordered brackets: [{ upTo: number|null, ratePercent: number }] */
    brackets: jsonb('brackets')
      .$type<Array<{ upTo: number | null; ratePercent: number }>>()
      .notNull(),
    reliefs: jsonb('reliefs').$type<Record<string, number>>(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tax_tables_lookup_idx').on(t.country, t.name, t.effectiveFrom)],
);

/** Public-holiday calendars (linked into attendance/leave per tenant). */
export const holidayCalendars = pgTable(
  'holiday_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    country: varchar('country', { length: 2 }).notNull().default('LK'),
    year: integer('year').notNull(),
    /** [{ date: 'YYYY-MM-DD', name, type: 'public'|'bank'|'mercantile'|'poya' }] */
    holidays: jsonb('holidays')
      .$type<Array<{ date: string; name: string; type: string }>>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('holiday_calendar_unique').on(t.country, t.year)],
);

/* ── vendor-side audit ─────────────────────────────────────────────── */

export const controlPlaneAuditLog = pgTable(
  'control_plane_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actor: text('actor').notNull(), // system-admin user id or 'factory'
    action: varchar('action', { length: 64 }).notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cp_audit_tenant_idx').on(t.tenantId, t.createdAt)],
);
