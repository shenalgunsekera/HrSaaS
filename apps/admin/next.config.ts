import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@hr/design-system', '@hr/entitlements', '@hr/db'],
};

export default nextConfig;
