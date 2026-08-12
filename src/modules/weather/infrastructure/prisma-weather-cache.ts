import type { PrismaClient } from '@/generated/prisma/client';
import type { WeatherSnapshot } from '../domain/weather';
import type { WeatherCacheStore } from '../application/ports';

/**
 * Кэш погоды в PostgreSQL (Redis не обязателен). TTL — по fetchedAt.
 * При заданном REDIS_URL можно заменить адаптером на Redis без правки use-case.
 */
export function createPrismaWeatherCache(
  prisma: PrismaClient,
  ttlMinutes: number,
): WeatherCacheStore {
  return {
    async get(key) {
      const row = await prisma.weatherCache.findUnique({ where: { key } });
      if (!row) return null;
      if (Date.now() - row.fetchedAt.getTime() > ttlMinutes * 60_000) return null;
      return row.payload as unknown as WeatherSnapshot;
    },
    async set(key, snapshot) {
      const payload = JSON.parse(JSON.stringify(snapshot)) as object;
      await prisma.weatherCache.upsert({
        where: { key },
        create: { key, payload },
        update: { payload, fetchedAt: new Date() },
      });
    },
  };
}
