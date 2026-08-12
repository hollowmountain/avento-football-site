import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { getRedis } from '@/shared/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'DB_UNAVAILABLE', message: 'База данных недоступна' } },
      { status: 503 },
    );
  }

  const redis = getRedis();
  let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';
  if (redis) {
    try {
      await redis.ping();
      redisStatus = 'up';
    } catch {
      redisStatus = 'down';
    }
  }

  return NextResponse.json({ ok: true, data: { db: 'up', redis: redisStatus } });
}
