import type { GameSummaryDto, ParticipantDto } from './dto';

/** Ответ GET /api/games/:code и данные SSR страницы игры. */
export interface GameViewData {
  game: GameSummaryDto;
  participants: ParticipantDto[];
  waitlist: ParticipantDto[];
  viewer: {
    isHost: boolean;
    isParticipant: boolean;
  };
  /** Ключ-приглашение приватной игры «по ссылке» — только организатору. */
  inviteKey: string | null;
}

export interface GamesListData {
  items: GameSummaryDto[];
  nextCursor: string | null;
}
