import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { closeExpiredGames } from '@/modules/game/application/close-expired-games';
import { getGameDeps } from '@/modules/game/composition';
import { jsonError, jsonOk } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger';
import { getPgLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

function secretMatches(provided: string | null): boolean {
  if (!provided) return false;
  const expected = Buffer.from(env.CRON_SECRET, 'utf8');
  const actual = Buffer.from(provided, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * POST /api/cron/close-expired — вызывается планировщиком (GitHub Actions /
 * Railway cron-сервис) каждые 10 минут. Защищён заголовком x-cron-secret.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!secretMatches(request.headers.get('x-cron-secret'))) {
    return jsonError('FORBIDDEN', 'Неверный cron-секрет', 403);
  }

  const result = await closeExpiredGames(getGameDeps());

  // Заодно чистим устаревшие записи PG-fallback rate limit'а (старше 25 часов)
  const cleaned = await getPgLimiter().cleanup(25 * 60 * 60);

  logger.info({ ...result, rateLimitRowsCleaned: cleaned }, 'cron close-expired выполнен');
  return jsonOk({ ...result, rateLimitRowsCleaned: cleaned });
}
