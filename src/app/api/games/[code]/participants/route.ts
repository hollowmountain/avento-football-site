import { NextResponse, type NextRequest } from 'next/server';
import { joinGame } from '@/modules/game/application/join-game';
import { getGameDeps } from '@/modules/game/composition';
import { participantToDto } from '@/modules/game/presentation/dto';
import { joinGameBodySchema } from '@/modules/game/schemas';
import { jsonDomainError, jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import { withRequestId } from '@/shared/lib/logger';
import { checkFormToken, isHoneypotTripped } from '@/shared/security/anti-abuse';
import {
  PARTICIPANT_COOKIE,
  clientIpHash,
  getRateLimiter,
  participantCookieOptions,
} from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/** POST /api/games/:code/participants — «Я иду». */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);
  const log = withRequestId(request.headers.get('x-request-id'));
  const { code } = await context.params;
  const now = deps.clock.now();

  const global = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!global.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', global.retryAfterSeconds);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = joinGameBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные формы', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  // Honeypot: тихий отказ
  if (isHoneypotTripped(parsed.data.website)) {
    log.warn({ ipHash }, 'honeypot: тихий отказ записи на игру');
    return jsonOk({ joined: true }, { status: 201 });
  }

  if (!checkFormToken(parsed.data.formToken, env.TOKEN_PEPPER, now, env.FORM_MIN_SUBMIT_SECONDS)) {
    return jsonError(
      'FORM_REJECTED',
      'Форма устарела или отправлена слишком быстро. Обновите страницу и попробуйте ещё раз.',
      400,
    );
  }

  const existingToken = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  const participantToken = existingToken ?? deps.tokens.generate();

  const result = await joinGame(deps, {
    gameCode: code.toUpperCase(),
    name: parsed.data.name,
    nickname: parsed.data.nickname,
    position: parsed.data.position,
    skillLevel: parsed.data.skillLevel,
    attendance: parsed.data.attendance,
    participantToken,
  });

  if (!result.ok) return jsonDomainError(result.error);

  const viewerHash = deps.tokens.hash(participantToken);
  const response = jsonOk(
    { participant: participantToDto(result.value.participant, viewerHash) },
    { status: 201 },
  );
  if (!existingToken) {
    response.cookies.set(PARTICIPANT_COOKIE, participantToken, participantCookieOptions);
  }
  return response;
}
