import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Redis опционален: без REDIS_URL возвращается null, и все потребители
 * (rate limit, кэш, шина событий) обязаны работать через PostgreSQL-fallback.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

export function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  if (!env.REDIS_URL) {
    logger.info('REDIS_URL не задан — rate limit и кэш работают через PostgreSQL');
    globalForRedis.redis = null;
    return null;
  }
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });
  client.on('error', (error) => {
    logger.warn({ err: error.message }, 'ошибка Redis (работаем через fallback)');
  });
  globalForRedis.redis = client;
  return client;
}
