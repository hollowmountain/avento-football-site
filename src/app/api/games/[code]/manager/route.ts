import { NextResponse, type NextRequest } from 'next/server';
import { isHostAuthorized } from '@/modules/game/application/host-auth';
import { setMatchDayManager } from '@/modules/game/application/set-manager';
import { getGameDeps } from '@/modules/game/composition';
import { setManagerBodySchema } from '@/modules/game/schemas';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/**
 * PUT /api/games/:code/manager — назначить менеджера матч-дня.
 * Назначает только организатор; participantId = null возвращает
 * протокол ему самому.
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;
  const gameCode = code.toUpperCase();

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const game = await deps.games.findByCode(gameCode);
  if (game === null) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);

  const viewerProfile = await profileByDeviceToken(
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
  );
  const isHost = isHostAuthorized(deps.tokens, game, {
    hostToken: request.headers.get('x-host-token'),
    viewerProfileId: viewerProfile?.id ?? null,
  });
  if (!isHost) {
    return jsonError('FORBIDDEN', 'Менеджера назначает организатор игры', 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = setManagerBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const result = await setMatchDayManager(deps, {
    gameCode,
    participantId: parsed.data.participantId,
  });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk(result.value);
}
