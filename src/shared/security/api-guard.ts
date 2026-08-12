import type { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { env } from '@/shared/lib/env';
import { getRedis } from '@/shared/lib/redis';
import {
  FallbackRateLimiter,
  PgRateLimiter,
  RedisRateLimiter,
  type RateLimiter,
} from './rate-limiter';
import { hashIp } from './tokens';

const globalForGuard = globalThis as unknown as {
  kickoffLimiter?: RateLimiter;
  kickoffPgLimiter?: PgRateLimiter;
};

export function getPgLimiter(): PgRateLimiter {
  if (!globalForGuard.kickoffPgLimiter) {
    globalForGuard.kickoffPgLimiter = new PgRateLimiter(prisma);
  }
  return globalForGuard.kickoffPgLimiter;
}

/** Redis (если сконфигурирован) с PG-fallback; без Redis — сразу PG. */
export function getRateLimiter(): RateLimiter {
  if (!globalForGuard.kickoffLimiter) {
    const redis = getRedis();
    const pg = getPgLimiter();
    globalForGuard.kickoffLimiter = redis
      ? new FallbackRateLimiter(new RedisRateLimiter(redis), pg)
      : new FallbackRateLimiter(pg, null);
  }
  return globalForGuard.kickoffLimiter;
}

export function clientIpHash(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'local';
  return hashIp(ip, env.IP_HASH_SALT);
}

/** httpOnly-cookie с анонимным токеном участника/создателя. */
export const PARTICIPANT_COOKIE = 'kickoff_pid';

export const participantCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
};
