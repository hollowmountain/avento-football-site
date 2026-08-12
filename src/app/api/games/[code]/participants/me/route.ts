import { NextResponse, type NextRequest } from 'next/server';
import { leaveGame } from '@/modules/game/application/leave-game';
import { getGameDeps } from '@/modules/game/composition';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/** DELETE /api/games/:code/participants/me — отказ от участия (по httpOnly-cookie). */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const participantToken = request.cookies.get(PARTICIPANT_COOKIE)?.value;
  if (!participantToken) {
    return jsonError('NOT_PARTICIPANT', 'Вы не записаны на эту игру', 404);
  }

  const result = await leaveGame(deps, { gameCode: code.toUpperCase(), participantToken });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk(result.value);
}
