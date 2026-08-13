import { NextResponse, type NextRequest } from 'next/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { PROFILE_ERROR_STATUS } from '@/modules/profile/application/errors';
import { loginByCode } from '@/modules/profile/application/use-cases';
import { profileToDto } from '@/modules/profile/presentation/dto';
import { loginBodySchema } from '@/modules/profile/schemas';
import { jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import {
  PARTICIPANT_COOKIE,
  clientIpHash,
  getRateLimiter,
  participantCookieOptions,
} from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

/** POST /api/me/login — вход по личному коду: привязать это устройство. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const deps = getProfileDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);

  const limit = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!limit.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', limit.retryAfterSeconds);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные формы', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const existingToken = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  const deviceToken = existingToken ?? deps.tokens.generate();

  const result = await loginByCode(deps, {
    code: parsed.data.code,
    deviceTokenHash: deps.tokens.hash(deviceToken),
  });
  if (!result.ok) {
    return jsonError(
      result.error.code,
      result.error.message,
      PROFILE_ERROR_STATUS[result.error.code],
    );
  }

  const response = jsonOk({ profile: profileToDto(result.value) });
  if (existingToken === null) {
    response.cookies.set(PARTICIPANT_COOKIE, deviceToken, participantCookieOptions);
  }
  return response;
}
