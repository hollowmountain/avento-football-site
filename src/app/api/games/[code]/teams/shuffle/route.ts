import { randomInt } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { shuffleTeams } from '@/modules/game/application/shuffle-teams';
import { getGameDeps } from '@/modules/game/composition';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/** POST /api/games/:code/teams/shuffle — авто-жеребьёвка (нужен host-токен). */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const hostToken = request.headers.get('x-host-token');
  if (!hostToken) {
    return jsonError('FORBIDDEN', 'Нужен токен управления игрой (заголовок x-host-token)', 403);
  }

  const result = await shuffleTeams(deps, {
    gameCode: code.toUpperCase(),
    hostToken,
    seed: randomInt(2 ** 31),
  });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk({ teams: result.value.teams });
}
