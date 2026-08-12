import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

function createPrisma(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.PG_POOL_MAX,
  });
  return new PrismaClient({ adapter });
}

// Singleton, переживающий hot-reload в dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
