import { defineConfig } from 'drizzle-kit';

/**
 * Tenant-schema config. Generation only — application of these migrations is
 * ALWAYS done by the provisioner across every tenant's dedicated database,
 * tracked per tenant in the control plane's `tenant_migrations`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/tenant/schema.ts',
  out: './migrations/tenant',
});
