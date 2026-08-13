import { NextResponse, type NextRequest } from 'next/server';
import { getGameDeps } from '@/modules/game/composition';
import { gameToSummaryDto } from '@/modules/game/presentation/dto';
import { profileByDeviceToken } from '@/modules/profile/server';
import { jsonOk } from '@/shared/errors/api-response';
import { PARTICIPANT_COOKIE } from '@/shared/security/api-guard';

export const dynamic = 'force-dynamic';

/** GET /api/me/games — игры кабинета: созданные и с активной записью. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const profile = await profileByDeviceToken(
    request.cookies.get(PARTICIPANT_COOKIE)?.value ?? null,
  );
  if (profile === null) return jsonOk({ items: [] });

  const deps = getGameDeps();
  const items = await deps.games.listByProfile(profile.id, 20);
  return jsonOk({
    items: items.map((item) => ({
      game: gameToSummaryDto(item.game, item.activeMainCount, item.activeMainCount),
      roles: item.roles,
    })),
  });
}
