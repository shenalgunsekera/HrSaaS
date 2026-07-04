import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@hr/design-system',
    '@hr/entitlements',
    '@hr/rbac',
    '@hr/schema-engine',
    '@hr/tenant-context',
  ],
};

export default nextConfig;
