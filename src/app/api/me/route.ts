import { NextResponse, type NextRequest } from 'next/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { PROFILE_ERROR_STATUS } from '@/modules/profile/application/errors';
import { createProfile, updateProfile } from '@/modules/profile/application/use-cases';
import { profileToDto } from '@/modules/profile/presentation/dto';
import { profileBodySchema } from '@/modules/profile/schemas';
import { jsonError, jsonOk, jsonRateLimited } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';
import {
  PARTICIPANT_COOKIE,
  clientIpHash,
  getRateLimiter,
  participantCookieOptions,
} from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

/** GET /api/me — профиль текущего устройства (null, если кабинета нет). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const deps = getProfileDeps();
  const token = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  if (token === null) return jsonOk({ profile: null });

  const profile = await deps.profiles.findByDeviceHash(deps.tokens.hash(token));
  return jsonOk({ profile: profile === null ? null : profileToDto(profile) });
}

/** POST /api/me — создать кабинет; в ответе одноразовый личный код. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const deps = getProfileDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);

  const limit = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!limit.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', limit.retryAfterSeconds);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = profileBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные формы', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const existingToken = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  const deviceToken = existingToken ?? deps.tokens.generate();

  const result = await createProfile(deps, {
    displayName: parsed.data.displayName,
    tag: parsed.data.tag,
    age: parsed.data.age ?? null,
    gender: parsed.data.gender ?? null,
    countryCode: parsed.data.countryCode ?? null,
    club: parsed.data.club ?? null,
    skillLevel: parsed.data.skillLevel ?? 'ANY',
    deviceTokenHash: deps.tokens.hash(deviceToken),
  });
  if (!result.ok) {
    return jsonError(
      result.error.code,
      result.error.message,
      PROFILE_ERROR_STATUS[result.error.code],
    );
  }

  const response = jsonOk(
    { profile: profileToDto(result.value.profile), loginCode: result.value.loginCode },
    { status: 201 },
  );
  if (existingToken === null) {
    response.cookies.set(PARTICIPANT_COOKIE, deviceToken, participantCookieOptions);
  }
  return response;
}

/** PATCH /api/me — правка профиля (имя, тег, возраст, пол). */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const deps = getProfileDeps();
  const limiter = getRateLimiter();
  const ipHash = clientIpHash(request);

  const limit = await limiter.consume(`w:${ipHash}`, env.RATE_GLOBAL_WRITES_PER_MIN, 60, 'open');
  if (!limit.allowed) {
    return jsonRateLimited('Слишком много запросов. Попробуйте позже.', limit.retryAfterSeconds);
  }

  const token = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  if (token === null) return jsonError('PROFILE_NOT_FOUND', 'Профиль не найден', 404);

  const body: unknown = await request.json().catch(() => null);
  const parsed = profileBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('BAD_REQUEST', 'Некорректные данные формы', 400, {
      details: parsed.error.flatten((issue) => issue.message),
    });
  }

  const result = await updateProfile(deps, {
    displayName: parsed.data.displayName,
    tag: parsed.data.tag,
    age: parsed.data.age ?? null,
    gender: parsed.data.gender ?? null,
    countryCode: parsed.data.countryCode ?? null,
    club: parsed.data.club ?? null,
    skillLevel: parsed.data.skillLevel ?? 'ANY',
    deviceTokenHash: deps.tokens.hash(token),
  });
  if (!result.ok) {
    return jsonError(
      result.error.code,
      result.error.message,
      PROFILE_ERROR_STATUS[result.error.code],
    );
  }
  return jsonOk({ profile: profileToDto(result.value) });
}
