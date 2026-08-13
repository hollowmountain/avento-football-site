import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { setTeams } from '@/modules/game/application/set-teams';
import { getGameDeps } from '@/modules/game/composition';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

const setTeamsBodySchema = z.object({
  teamA: z.array(z.string().min(1)).max(30),
  teamB: z.array(z.string().min(1)).max(30),
});

/** PUT /api/games/:code/teams — ручная правка составов (нужен host-токен). */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const hostToken = request.headers.get('x-host-token');
  const viewerProfile = await profileByDeviceToken(
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
  );

  const body: unknown = await request.json().catch(() => null);
  const parsed = setTeamsBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные', 400);
  }

  const result = await setTeams(deps, {
    gameCode: code.toUpperCase(),
    hostToken,
    viewerProfileId: viewerProfile?.id ?? null,
    teamA: parsed.data.teamA,
    teamB: parsed.data.teamB,
  });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk({ teams: result.value.teams });
}
