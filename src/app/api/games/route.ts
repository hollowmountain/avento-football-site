import { NextResponse, type NextRequest } from 'next/server';
import { createGame } from '@/modules/game/application/create-game';
import { getGameDeps } from '@/modules/game/composition';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { gameToDto, gameToSummaryDto } from '@/modules/game/presentation/dto';
import { createGameBodySchema, listGamesQuerySchema } from '@/modules/game/schemas';
import {
  humanizeSeconds,
  jsonDomainError,
  jsonError,
  jsonOk,
  jsonRateLimited,
} from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { withRequestId } from '@/shared/lib/logger';
import {
  checkFormToken,
  createTurnstileVerifier,
  isHoneypotTripped,
  turnstileDisabled,
} from '@/shared/security/anti-abuse';
import {
  PARTICIPANT_COOKIE,
  clientIpHash,
  getRateLimiter,
  participantCookieOptions,
} from '@/shared/security/api-guard';
import { generateGameCode } from '@/shared/security/game-code';

export const dynamic = 'force-dynamic';

const turnstile = env.TURNSTILE_ENABLED
  ? createTurnstileVerifier(env.TURNSTILE_SECRET_KEY ?? '')
  : turnstileDisabled;

/** POST /api/games — создать игру. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const log = withRequestId(request.headers.get('x-request-id'));
  const now = deps.clock.now();

  // Общий лимит мутаций (fail-open: недоступность хранилища не роняет сервис)
  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createGameBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные формы', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  // Honeypot: тихий отказ — бот получает правдоподобный «успех», игра не создаётся
  if (isHoneypotTripped(parsed.data.website)) {
    log.warn({ ipHash }, 'honeypot: тихий отказ создания игры');
    return jsonOk(
      { game: { code: generateGameCode() }, hostToken: deps.tokens.generate() },
      { status: 201 },
    );
  }

  // Time-trap: форма отправлена быстрее N секунд после рендера — бот
  if (!checkFormToken(parsed.data.formToken, env.TOKEN_PEPPER, now, env.FORM_MIN_SUBMIT_SECONDS)) {
    return jsonError(
      'FORM_REJECTED',
      'Форма устарела или отправлена слишком быстро. Обновите страницу и попробуйте ещё раз.',
      400,
    );
  }

  if (env.TURNSTILE_ENABLED) {
    const human = await turnstile.verify(parsed.data.turnstileToken ?? null, ipHash);
    if (!human) {
      return jsonError('CAPTCHA_FAILED', 'Не удалось пройти проверку капчи', 400);
    }
  }

  // Лимиты создания игр (fail-closed: хранилище недоступно → отказ)
  const per10min = await limiter.consume(
    `cg10:${ipHash}`,
    env.RATE_CREATE_GAME_PER_10MIN,
    600,
    'closed',
  );
  if (!per10min.allowed) {
    return jsonRateLimited(
      `Вы недавно создали игру. Следующую можно создать через ${humanizeSeconds(per10min.retryAfterSeconds)}.`,
      per10min.retryAfterSeconds,
    );
  }
  const perDay = await limiter.consume(
    `cgday:${ipHash}`,
    env.RATE_CREATE_GAME_PER_DAY,
    86_400,
    'closed',
  );
  if (!perDay.allowed) {
    return jsonRateLimited(
      `Вы уже создали ${env.RATE_CREATE_GAME_PER_DAY} игры за сутки. Следующую можно создать через ${humanizeSeconds(perDay.retryAfterSeconds)}.`,
      perDay.retryAfterSeconds,
    );
  }

  const existingIdentity = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  const creatorToken = existingIdentity ?? deps.tokens.generate();

  const result = await createGame(deps, {
    title: parsed.data.title,
    description: parsed.data.description || null,
    format: parsed.data.format,
    skillLevel: parsed.data.skillLevel,
    startsAt: parsed.data.startsAt,
    durationMinutes: parsed.data.durationMinutes,
    timezone: parsed.data.timezone,
    minPlayers: parsed.data.minPlayers,
    maxPlayers: parsed.data.maxPlayers,
    pricePerPitch: parsed.data.pricePerPitch,
    currency: parsed.data.currency,
    cancelDeadline: parsed.data.cancelDeadline,
    venueName: parsed.data.venueName,
    address: parsed.data.address,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    city: parsed.data.city,
    hostName: parsed.data.hostName,
    creatorToken,
    createdIpHash: ipHash,
  });

  if (!result.ok) return jsonDomainError(result.error);

  log.info({ code: result.value.game.code }, 'игра создана');
  const response = jsonOk(
    { game: gameToDto(result.value.game), hostToken: result.value.hostToken },
    { status: 201 },
  );
  if (!existingIdentity) {
    response.cookies.set(PARTICIPANT_COOKIE, creatorToken, participantCookieOptions);
  }
  return response;
}

/** GET /api/games — публичная лента с фильтрами и cursor-пагинацией. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  lazySweep();

  const deps = getGameDeps();
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listGamesQuerySchema.safeParse(query);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные параметры фильтра', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const { cursor, limit, sort, ...filters } = parsed.data;
  const page = await deps.games.list(
    { ...filters, dateFrom: filters.dateFrom ?? deps.clock.now() },
    sort,
    cursor ?? null,
    limit,
  );

  return jsonOk({
    items: page.items.map(({ game, activeMainCount }) =>
      // В ленте цена на человека считается по текущему основному составу
      gameToSummaryDto(game, activeMainCount, activeMainCount),
    ),
    nextCursor: page.nextCursor,
  });
}
