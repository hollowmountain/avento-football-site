import type Redis from 'ioredis';
import type { PrismaClient } from '@/generated/prisma/client';
import { logger } from '@/shared/lib/logger';

/**
 * Sliding-window rate limiter (ТЗ §3).
 * Основной адаптер — Redis (ZSET + Lua, атомарно); fallback — PostgreSQL
 * (таблица rate_limit_events). Политика отказа задаётся на точке вызова:
 *   'closed' — хранилище недоступно → запрос запрещён (создание игр);
 *   'open'   — хранилище недоступно → запрос разрешён (общий write-лимит,
 *              иначе отказ БД превращается в полный отказ сервиса).
 */
export type FailMode = 'closed' | 'open';

export interface RateLimitDecision {
  allowed: boolean;
  /** Через сколько секунд можно повторить (для Retry-After). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
    failMode: FailMode,
  ): Promise<RateLimitDecision>;
}

// ---------- Redis: ZSET + Lua (атомарный sliding window) ----------

const LUA_SLIDING_WINDOW = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, tonumber(ARGV[1]))
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[2]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, oldest[2]}
end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return {1, '0'}
`;

export class RedisRateLimiter {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const raw = (await this.redis.eval(
      LUA_SLIDING_WINDOW,
      1,
      `rl:${key}`,
      String(now - windowMs),
      String(limit),
      String(now),
      `${now}-${Math.random().toString(36).slice(2)}`,
      String(windowMs),
    )) as [number, string];

    const allowed = raw[0] === 1;
    if (allowed) return { allowed: true, retryAfterSeconds: 0 };
    const oldestScore = Number(raw[1]) || now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldestScore + windowMs - now) / 1000)),
    };
  }
}

// ---------- PostgreSQL fallback ----------

export class PgRateLimiter {
  constructor(private readonly prisma: PrismaClient) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    const count = await this.prisma.rateLimitEvent.count({
      where: { key, createdAt: { gt: windowStart } },
    });
    if (count >= limit) {
      const oldest = await this.prisma.rateLimitEvent.findFirst({
        where: { key, createdAt: { gt: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const oldestMs = oldest?.createdAt.getTime() ?? now.getTime();
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((oldestMs + windowSeconds * 1000 - now.getTime()) / 1000),
        ),
      };
    }

    await this.prisma.rateLimitEvent.create({ data: { key } });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Чистка устаревших записей — вызывается из cron. */
  async cleanup(olderThanSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    const result = await this.prisma.rateLimitEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}

// ---------- Композит с политикой отказа ----------

interface InnerLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export class FallbackRateLimiter implements RateLimiter {
  constructor(
    private readonly primary: InnerLimiter,
    private readonly fallback: InnerLimiter | null,
  ) {}

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
    failMode: FailMode,
  ): Promise<RateLimitDecision> {
    try {
      return await this.primary.consume(key, limit, windowSeconds);
    } catch (primaryError) {
      logger.warn(
        { err: primaryError instanceof Error ? primaryError.message : String(primaryError) },
        'rate limiter: основной адаптер недоступен, пробуем fallback',
      );
      if (this.fallback) {
        try {
          return await this.fallback.consume(key, limit, windowSeconds);
        } catch (fallbackError) {
          logger.error(
            { err: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) },
            'rate limiter: fallback тоже недоступен',
          );
        }
      }
      // Шлюзы не открываем: для критичных операций отказ хранилища = запрет
      return failMode === 'closed'
        ? { allowed: false, retryAfterSeconds: 60 }
        : { allowed: true, retryAfterSeconds: 0 };
    }
  }
}
