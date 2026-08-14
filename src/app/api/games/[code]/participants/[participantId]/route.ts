import { NextResponse, type NextRequest } from 'next/server';
import { kickParticipant } from '@/modules/game/application/kick-participant';
import { getGameDeps } from '@/modules/game/composition';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonDomainError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string; participantId: string }> };

/** DELETE /api/games/:code/participants/:participantId — организатор удаляет игрока. */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code, participantId } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const viewerProfile = await profileByDeviceToken(
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
  );

  const result = await kickParticipant(deps, {
    gameCode: code.toUpperCase(),
    participantId,
    hostToken: request.headers.get('x-host-token'),
    viewerProfileId: viewerProfile?.id ?? null,
  });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk(result.value);
}
