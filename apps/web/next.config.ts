import { config } from 'dotenv';
config({ path: '../../.env' });

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@latex-ide/shared-types'],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
