import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /** One versioned container image for ALL tenants (ADR-0009). */
  output: 'standalone',
  /** Monorepo root so standalone tracing includes workspace packages. */
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: [
    '@hr/design-system',
    '@hr/entitlements',
    '@hr/payroll',
    '@hr/rbac',
    '@hr/schema-engine',
    '@hr/tenant-context',
  ],
};

export default nextConfig;
