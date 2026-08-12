import { NextResponse, type NextRequest } from 'next/server';
import { cancelGame } from '@/modules/game/application/cancel-game';
import { updateGame } from '@/modules/game/application/update-game';
import { getGameDeps } from '@/modules/game/composition';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { gameToSummaryDto } from '@/modules/game/presentation/dto';
import { getGameView } from '@/modules/game/presentation/get-game-view';
import { patchGameBodySchema } from '@/modules/game/schemas';
import { resolveCoordinates } from '@/modules/geo/application/resolve-coordinates';
import { getGeocoder } from '@/modules/geo/composition';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

const HOST_TOKEN_HEADER = 'x-host-token';

/** GET /api/games/:code — игра, состав, waitlist, сплит цены. */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  lazySweep();

  const { code } = await context.params;
  const view = await getGameView(
    code,
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
    request.headers.get(HOST_TOKEN_HEADER),
  );
  if (!view) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);
  return jsonOk(view);
}

/** PATCH /api/games/:code — редактирование (нужен host-токен). */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const hostToken = request.headers.get(HOST_TOKEN_HEADER);
  if (!hostToken) {
    return jsonError('FORBIDDEN', 'Нужен токен управления игрой (заголовок x-host-token)', 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = patchGameBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  // Адрес поменяли — пересчитываем координаты, иначе поедут погода и карта
  let patch = parsed.data;
  if (parsed.data.address !== undefined || parsed.data.city !== undefined) {
    const existing = await deps.games.findByCode(code.toUpperCase());
    const coordinates = existing
      ? await resolveCoordinates(getGeocoder(), {
          venueName: parsed.data.venueName ?? existing.venueName,
          address: parsed.data.address ?? existing.address,
          city: parsed.data.city ?? existing.city,
        })
      : null;
    if (!coordinates) {
      return jsonError(
        'ADDRESS_NOT_FOUND',
        'Не удалось найти это место на карте. Проверьте адрес и город.',
        400,
        { details: [{ field: 'address', message: 'адрес не найден' }] },
      );
    }
    patch = { ...patch, ...coordinates };
  }

  const result = await updateGame(deps, {
    gameCode: code.toUpperCase(),
    hostToken,
    patch,
  });
  if (!result.ok) return jsonDomainError(result.error);

  const main = await deps.games.activeMainCount(result.value.game.id);
  return jsonOk({ game: gameToSummaryDto(result.value.game, main, main) });
}

/** DELETE /api/games/:code — отмена игры организатором. */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const { code } = await context.params;

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const hostToken = request.headers.get(HOST_TOKEN_HEADER);
  if (!hostToken) {
    return jsonError('FORBIDDEN', 'Нужен токен управления игрой (заголовок x-host-token)', 403);
  }

  const result = await cancelGame(deps, { gameCode: code.toUpperCase(), hostToken });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk({ cancelled: true });
}
