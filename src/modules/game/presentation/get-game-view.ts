import { getGameDeps } from '../composition';
import type { GameViewData } from './api-types';
import { gameToSummaryDto, participantToDto } from './dto';

/**
 * Сборка данных страницы игры — общая для GET /api/games/:code и SSR.
 */
export async function getGameView(
  code: string,
  viewerToken: string | null,
  hostToken: string | null,
): Promise<GameViewData | null> {
  const deps = getGameDeps();

  const game = await deps.games.findByCode(code.toUpperCase());
  if (!game) return null;

  const participants = await deps.games.activeParticipants(game.id);
  const main = participants.filter((p) => p.role === 'MAIN');
  const waitlist = participants.filter((p) => p.role === 'WAITLIST');
  const confirmedMain = main.filter((p) => p.attendance === 'CONFIRMED');

  const viewerTokenHash = viewerToken ? deps.tokens.hash(viewerToken) : null;
  const isHost = hostToken ? deps.tokens.verify(hostToken, game.hostTokenHash) : false;

  return {
    game: gameToSummaryDto(game, main.length, confirmedMain.length),
    participants: main.map((p) => participantToDto(p, viewerTokenHash)),
    waitlist: waitlist.map((p) => participantToDto(p, viewerTokenHash)),
    viewer: {
      isHost,
      isParticipant:
        viewerTokenHash !== null && participants.some((p) => p.tokenHash === viewerTokenHash),
    },
  };
}
