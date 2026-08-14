import { profileByDeviceToken } from '@/modules/profile/server';
import { isHostAuthorized, isMatchDayManager } from '../application/host-auth';
import { getGameDeps } from '../composition';
import { canStartMatchDay } from '../domain/matchday';
import { participantToDto } from './dto';
import { matchDayToDto, type MatchDayViewData } from './matchday-dto';

/**
 * Данные страницы матч-дня — общие для SSR и GET /api/games/:code/matchday.
 * Смотреть протокол может любой, вести — только менеджер.
 */
export async function getMatchDayView(
  code: string,
  viewerToken: string | null,
  hostToken: string | null,
): Promise<MatchDayViewData | null> {
  const deps = getGameDeps();

  const game = await deps.games.findByCode(code.toUpperCase());
  if (game === null) return null;

  const viewerProfile = await profileByDeviceToken(viewerToken);
  const auth = { hostToken, viewerProfileId: viewerProfile?.id ?? null };

  const participants = await deps.games.activeParticipants(game.id);
  const main = participants.filter((p) => p.role === 'MAIN');
  const viewerTokenHash = viewerToken === null ? null : deps.tokens.hash(viewerToken);

  const day = await deps.days.findByGameId(game.id);
  const manager =
    game.managerProfileId === null
      ? null
      : (main.find((p) => p.profileId === game.managerProfileId) ?? null);

  return {
    game: {
      code: game.code,
      title: game.title,
      startsAt: game.startsAt.toISOString(),
      timezone: game.timezone,
      status: game.status,
      teamCount: game.teamCount,
    },
    day: day === null ? null : matchDayToDto(day),
    participants: main.map((p) => participantToDto(p, viewerTokenHash)),
    viewer: {
      isManager: isMatchDayManager(deps.tokens, game, auth),
      isHost: isHostAuthorized(deps.tokens, game, auth),
    },
    managerParticipantId: manager?.id ?? null,
    canStart: canStartMatchDay(game, deps.clock.now()),
  };
}
