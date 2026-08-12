import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pino', 'pino-pretty', 'pg', '@prisma/adapter-pg'],
};

export default nextConfig;
