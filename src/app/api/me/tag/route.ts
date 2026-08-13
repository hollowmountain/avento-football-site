import { NextResponse, type NextRequest } from 'next/server';
import { getProfileDeps } from '@/modules/profile/composition';
import { isValidTag, normalizeTag } from '@/modules/profile/domain/tag';
import { jsonOk } from '@/shared/errors/api-response';
import { PARTICIPANT_COOKIE } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

export type TagStatus = 'invalid' | 'free' | 'taken' | 'yours';

/** GET /api/me/tag?tag=... — живая проверка тега при вводе. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const deps = getProfileDeps();
  const tag = normalizeTag(request.nextUrl.searchParams.get('tag') ?? '');

  if (!isValidTag(tag)) return jsonOk({ status: 'invalid' as TagStatus });

  // Свой текущий тег — «свободен для вас»: правка профиля не должна ругаться
  const token = request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null;
  if (token !== null) {
    const mine = await deps.profiles.findByDeviceHash(deps.tokens.hash(token));
    if (mine !== null && mine.tag === tag) {
      return jsonOk({ status: 'yours' as TagStatus });
    }
  }

  const taken = await deps.profiles.isTagTaken(tag);
  return jsonOk({ status: (taken ? 'taken' : 'free') as TagStatus });
}
