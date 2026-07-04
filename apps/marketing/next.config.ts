import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@hr/design-system', '@hr/entitlements'],
};

export default nextConfig;
