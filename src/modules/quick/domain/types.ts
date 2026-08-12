/**
 * Быстрая игра: матч-день без записи и сервера. Домен ничего не знает
 * про React и localStorage — только данные и правила дня.
 */

/** Идентификатор пресета цвета команды (сама палитра — в presentation). */
export type QuickTeamColorId = 'amber' | 'green' | 'coral' | 'sky' | 'violet' | 'paper';

export interface QuickPlayer {
  id: string;
  name: string;
  /** Гость — разовый участник: тот же игрок, но с пометкой в списках. */
  guest: boolean;
  teamId: string | null;
}

export interface QuickTeam {
  id: string;
  name: string;
  colorId: QuickTeamColorId;
}

export interface QuickGoal {
  id: string;
  teamId: string;
  /** null — гол «без автора». */
  scorerId: string | null;
  /** Ассистент по желанию. */
  assistId: string | null;
}

export interface QuickMatchResult {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
}

export interface QuickMatch extends QuickMatchResult {
  id: string;
  /** Голы с авторами; счёт хранится отдельно, чтобы его можно было править. */
  goals: QuickGoal[];
}
