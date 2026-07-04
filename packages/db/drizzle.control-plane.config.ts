import { defineConfig } from 'drizzle-kit';

/**
 * Control-plane database config. The connection string is injected from the
 * environment (never committed). Tenant databases have their own config and
 * are migrated by the provisioner, tracked per tenant.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/control-plane/schema.ts',
  out: './migrations/control-plane',
  dbCredentials: {
    url: process.env.CONTROL_PLANE_DATABASE_URL ?? '',
  },
});
