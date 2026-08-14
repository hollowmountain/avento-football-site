import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveCoordinates } from '@/modules/geo/application/resolve-coordinates';
import { getGeocoder } from '@/modules/geo/composition';
import { createGame } from '@/modules/game/application/create-game';
import { joinGame } from '@/modules/game/application/join-game';
import { getGameDeps } from '@/modules/game/composition';
import { getProfileDeps } from '@/modules/profile/composition';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { gameToDto, gameToSummaryDto } from '@/modules/game/presentation/dto';
import { createGameBodyWithPassword, listGamesQuerySchema } from '@/modules/game/schemas';
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
import { PARTICIPANT_COOKIE, clientIpHash, getRateLimiter } from '@/shared/security/api-guard';
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
  const parsed = createGameBodyWithPassword.safeParse(body);
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

  // Создавать игры могут только игроки с кабинетом: имя организатора
  // берём из профиля, а участие в лимитах и правах — по кабинету
  const existingIdentity = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  const profileDeps = getProfileDeps();
  const profile =
    existingIdentity === null
      ? null
      : await profileDeps.profiles.findByDeviceHash(deps.tokens.hash(existingIdentity));
  // existingIdentity проверяем повторно ради типов: без cookie профиля нет,
  // но именно этот токен уходит в автозапись создателя ниже
  if (profile === null || existingIdentity === null) {
    return jsonError(
      'PROFILE_REQUIRED',
      'Создавать игры могут только игроки с кабинетом. Создайте профиль — это минута.',
      401,
    );
  }
  // Админ-теги (ENV ADMIN_TAGS): без лимитов количества и без дедупа
  const isAdmin = env.ADMIN_TAGS.includes(profile.tag);

  // Публичные игры — по согласованию с владельцем (ENV PUBLIC_GAME_TAGS):
  // чужой человек не соберёт «открытую» игру и не обманет записавшихся.
  // Остальным доступны приватные — по ссылке с ключом или по паролю.
  const canCreatePublic = isAdmin || env.PUBLIC_GAME_TAGS.includes(profile.tag);
  if (parsed.data.visibility === 'PUBLIC' && !canCreatePublic) {
    return jsonError(
      'PUBLIC_NOT_ALLOWED',
      'Публичные игры создаются по согласованию. Выберите приватную — по ссылке или паролю.',
      403,
    );
  }

  // Ключ записи приватной игры: для ссылки — случайный код (хранится
  // открыто, нужен организатору для шаринга), для пароля — только хеш
  let joinKeyHash: string | null = null;
  let inviteKey: string | null = null;
  if (parsed.data.visibility === 'PRIVATE_LINK') {
    inviteKey = randomBytes(9).toString('base64url');
    joinKeyHash = deps.tokens.hash(inviteKey);
  } else if (parsed.data.visibility === 'PRIVATE_PASSWORD') {
    joinKeyHash = deps.tokens.hash(parsed.data.joinPassword ?? '');
  }

  // Лимиты создания игр (fail-closed: хранилище недоступно → отказ).
  // Считаем по кабинету, а не по IP: у друзей с одного Wi-Fi квота своя
  // у каждого. IP держит широкий потолок — он ловит ботов, а не компанию.
  // Здесь только ПРОВЕРКА: квота списывается ниже, после успешного создания,
  // иначе опечатка в форме блокировала бы человека на весь период окна.
  if (!isAdmin) {
    const per10min = await limiter.check(
      `cg10:${profile.id}`,
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
    const perDay = await limiter.check(
      `cgday:${profile.id}`,
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
    const perIp = await limiter.check(
      `cgip:${ipHash}`,
      env.RATE_CREATE_GAME_IP_PER_DAY,
      86_400,
      'closed',
    );
    if (!perIp.allowed) {
      return jsonRateLimited(
        `С этой сети сегодня создано слишком много игр. Попробуйте через ${humanizeSeconds(perIp.retryAfterSeconds)}.`,
        perIp.retryAfterSeconds,
      );
    }
  }

  // Координаты у человека не спрашиваем — определяем по адресу
  const coordinates = await resolveCoordinates(getGeocoder(), {
    venueName: parsed.data.venueName,
    address: parsed.data.address,
    city: parsed.data.city,
  });
  if (!coordinates) {
    return jsonError(
      'ADDRESS_NOT_FOUND',
      'Не удалось найти это место на карте. Проверьте адрес и город.',
      400,
      { details: [{ field: 'address', message: 'адрес не найден' }] },
    );
  }

  const result = await createGame(deps, {
    title: parsed.data.title,
    description: parsed.data.description || null,
    format: parsed.data.format,
    skillLevel: parsed.data.skillLevel,
    startsAt: parsed.data.startsAt,
    durationMinutes: parsed.data.durationMinutes,
    teamCount: parsed.data.teamCount,
    timezone: parsed.data.timezone,
    minPlayers: parsed.data.minPlayers,
    maxPlayers: parsed.data.maxPlayers,
    pricePerPitch: parsed.data.pricePerPitch,
    currency: parsed.data.currency,
    cancelDeadline: parsed.data.cancelDeadline,
    venueName: parsed.data.venueName,
    address: parsed.data.address,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    city: parsed.data.city,
    visibility: parsed.data.visibility,
    joinKeyHash,
    inviteKey,
    // Имя организатора — из кабинета, отдельное поле формы убрано
    hostName: profile.displayName,
    creatorToken: existingIdentity,
    creatorProfileId: profile.id,
    createdIpHash: ipHash,
    bypassLimits: isAdmin,
  });

  if (!result.ok) return jsonDomainError(result.error);

  // Игра создана — только теперь тратим квоту (админ квоту не тратит)
  // Последовательно, а не Promise.all: параллельные запросы по одному
  // соединению pg ругаются депрекейшеном, а три вставки того не стоят
  if (!isAdmin) {
    await limiter.consume(`cg10:${profile.id}`, env.RATE_CREATE_GAME_PER_10MIN, 600, 'closed');
    await limiter.consume(`cgday:${profile.id}`, env.RATE_CREATE_GAME_PER_DAY, 86_400, 'closed');
    await limiter.consume(`cgip:${ipHash}`, env.RATE_CREATE_GAME_IP_PER_DAY, 86_400, 'closed');
  }

  // Организатор обычно и сам играет: без записи состав остаётся «0 / N»,
  // и фоновая уборка отменяет игру как «не набралось игроков». Галочку
  // можно снять — тогда создатель только собирает игру.
  if (parsed.data.joinAsPlayer) {
    const joined = await joinGame(deps, {
      gameCode: result.value.game.code,
      name: profile.displayName,
      nickname: profile.tag,
      position: 'ANY',
      skillLevel: profile.skillLevel,
      attendance: 'CONFIRMED',
      participantToken: existingIdentity,
      profileId: profile.id,
    });
    // Игра уже создана: неудачная автозапись не повод её потерять
    if (!joined.ok) {
      log.warn(
        { code: result.value.game.code, error: joined.error.code },
        'автозапись создателя не удалась',
      );
    }
  }

  log.info({ code: result.value.game.code }, 'игра создана');
  return jsonOk(
    {
      game: gameToDto(result.value.game),
      hostToken: result.value.hostToken,
      // Ключ-приглашение — организатору для ссылки «только для своих»
      inviteKey,
    },
    { status: 201 },
  );
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
