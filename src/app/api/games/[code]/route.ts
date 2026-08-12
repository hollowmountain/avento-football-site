import { NextResponse, type NextRequest } from 'next/server';
import { cancelGame } from '@/modules/game/application/cancel-game';
import { updateGame } from '@/modules/game/application/update-game';
import { getGameDeps } from '@/modules/game/composition';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { gameToSummaryDto, participantToDto } from '@/modules/game/presentation/dto';
import { patchGameBodySchema } from '@/modules/game/schemas';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

const HOST_TOKEN_HEADER = 'x-host-token';

/** GET /api/games/:code — игра, состав, waitlist, сплит цены. */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  lazySweep();

  const deps = getGameDeps();
  const { code } = await context.params;

  const game = await deps.games.findByCode(code.toUpperCase());
  if (!game) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);

  const participants = await deps.games.activeParticipants(game.id);
  const main = participants.filter((p) => p.role === 'MAIN');
  const waitlist = participants.filter((p) => p.role === 'WAITLIST');
  const confirmedMain = main.filter((p) => p.attendance === 'CONFIRMED');

  const viewerToken = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  const viewerTokenHash = viewerToken ? deps.tokens.hash(viewerToken) : null;

  const hostToken = request.headers.get(HOST_TOKEN_HEADER);
  const isHost = hostToken ? deps.tokens.verify(hostToken, game.hostTokenHash) : false;

  return jsonOk({
    game: gameToSummaryDto(game, main.length, confirmedMain.length),
    participants: main.map((p) => participantToDto(p, viewerTokenHash)),
    waitlist: waitlist.map((p) => participantToDto(p, viewerTokenHash)),
    viewer: {
      isHost,
      isParticipant: participants.some((p) => p.tokenHash === viewerTokenHash),
    },
  });
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

  const result = await updateGame(deps, {
    gameCode: code.toUpperCase(),
    hostToken,
    patch: parsed.data,
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
