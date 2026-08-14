import { NextResponse, type NextRequest } from 'next/server';
import { PROFILE_ERROR_STATUS } from '@/modules/profile/application/errors';
import { logout } from '@/modules/profile/application/use-cases';
import { getProfileDeps } from '@/modules/profile/composition';
import { jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/me/logout — выход из кабинета на этом устройстве.
 * Профиль остаётся жить: вернуться (или войти в другой) можно по
 * личному коду. Cookie не трогаем — это identity для записей на игры.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const deps = getProfileDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);

  const limit = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!limit.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', limit.retryAfterSeconds);
  }

  const token = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  if (token === null) return jsonError('PROFILE_NOT_FOUND', 'Профиль не найден', 404);

  const result = await logout(deps, { deviceTokenHash: deps.tokens.hash(token) });
  if (!result.ok) {
    return jsonError(
      result.error.code,
      result.error.message,
      PROFILE_ERROR_STATUS[result.error.code],
    );
  }
  return jsonOk({ loggedOut: true });
}
