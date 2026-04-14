import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@latex-ide/shared-types'],
};

export default nextConfig;
