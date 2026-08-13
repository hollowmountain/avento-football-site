import { NextResponse, type NextRequest } from 'next/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { PROFILE_ERROR_STATUS } from '@/modules/profile/application/errors';
import { rotateLoginCode } from '@/modules/profile/application/use-cases';
import { jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

/** POST /api/me/code — перевыпустить личный код (старый гаснет сразу). */
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

  const result = await rotateLoginCode(getProfileDeps(), {
    deviceTokenHash: deps.tokens.hash(token),
  });
  if (!result.ok) {
    return jsonError(
      result.error.code,
      result.error.message,
      PROFILE_ERROR_STATUS[result.error.code],
    );
  }
  return jsonOk({ loginCode: result.value.loginCode });
}
