import { NextResponse, type NextRequest } from 'next/server';
import { isMatchDayManager } from '@/modules/game/application/host-auth';
import { runMatchDayCommand, startMatchDay } from '@/modules/game/application/matchday';
import { getGameDeps } from '@/modules/game/composition';
import { getMatchDayView } from '@/modules/game/presentation/get-matchday-view';
import { matchDayCommandSchema, startMatchDayBodySchema } from '@/modules/game/schemas';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/** GET /api/games/:code/matchday — состояние протокола (видно всем). */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { code } = await context.params;
  const view = await getMatchDayView(
    code,
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
    request.headers.get('x-host-token'),
  );
  if (view === null) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);
  return jsonOk(view);
}

/**
 * POST /api/games/:code/matchday — запуск дня и все действия протокола.
 * Тело без `kind` — это старт (со списком команд), с `kind` — команда.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
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

  // Вести протокол может организатор или назначенный им менеджер
  const viewerProfile = await profileByDeviceToken(
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
  );
  const authorized = isMatchDayManager(deps.tokens, game, {
    hostToken: request.headers.get('x-host-token'),
    viewerProfileId: viewerProfile?.id ?? null,
  });
  if (!authorized) {
    return jsonError('FORBIDDEN', 'Протокол ведёт организатор или менеджер игры', 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const isCommand =
    typeof body === 'object' && body !== null && 'kind' in (body as Record<string, unknown>);

  if (!isCommand) {
    const parsed = startMatchDayBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('BAD_REQUEST', 'Некорректные данные запуска матч-дня', 400, {
        details: parsed.error.flatten((issue) => issue.message),
      });
    }
    const started = await startMatchDay(deps, { gameCode, teams: parsed.data.teams });
    if (!started.ok) return jsonDomainError(started.error);
    return jsonOk(await viewOf(request, gameCode), { status: 201 });
  }

  const parsed = matchDayCommandSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректная команда протокола', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const result = await runMatchDayCommand(deps, { gameCode, command: parsed.data });
  if (!result.ok) return jsonDomainError(result.error);
  return jsonOk(await viewOf(request, gameCode));
}

/** Ответ на любое действие — состояние целиком: клиенту нечего склеивать. */
async function viewOf(request: NextRequest, gameCode: string) {
  return getMatchDayView(
    gameCode,
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
    request.headers.get('x-host-token'),
  );
}
