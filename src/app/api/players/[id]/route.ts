import { NextResponse, type NextRequest } from 'next/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { withRequestId } from '@/shared/lib/logger';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/players/:id — удалить профиль (модерация).
 * Только для тегов из ADMIN_TAGS: чистка тестовых и брошенных кабинетов.
 * Игры и составы остаются — участник просто становится гостем.
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const log = withRequestId(request.headers.get('x-request-id'));
  const { id } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const deps = getProfileDeps();
  const viewer = await profileByDeviceToken(request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null);
  if (viewer === null || !env.ADMIN_TAGS.includes(viewer.tag)) {
    return jsonError('FORBIDDEN', 'Удалять профили может только владелец сайта', 403);
  }
  // Снести собственный кабинет случайным нажатием было бы обидно
  if (viewer.id === id) {
    return jsonError('VALIDATION_FAILED', 'Свой профиль так удалить нельзя', 400);
  }

  const target = await deps.profiles.findById(id);
  if (target === null) return jsonError('NOT_FOUND', 'Профиль не найден', 404);

  await deps.profiles.remove(id);
  log.warn({ removedTag: target.tag, byTag: viewer.tag }, 'профиль удалён владельцем');

  return jsonOk({ removed: true, tag: target.tag });
}
