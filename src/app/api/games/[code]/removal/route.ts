import { NextResponse, type NextRequest } from 'next/server';
import { removeGame } from '@/modules/game/application/remove-game';
import { getGameDeps } from '@/modules/game/composition';
import { removeGameBodySchema } from '@/modules/game/schemas';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/**
 * POST /api/games/:code/removal — снять игру (модерация).
 * Доступно только тегам из ADMIN_TAGS: организатор отменяет свою игру
 * через DELETE, а это снятие чужой с указанием причины.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const viewerProfile = await profileByDeviceToken(
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
  );
  const isAdmin = viewerProfile !== null && env.ADMIN_TAGS.includes(viewerProfile.tag);

  const body: unknown = await request.json().catch(() => null);
  const parsed = removeGameBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const result = await removeGame(deps, {
    gameCode: code.toUpperCase(),
    isAdmin,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
  });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk({ removed: true });
}
