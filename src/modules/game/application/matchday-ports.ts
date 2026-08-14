import type { RotationState } from '@/modules/quick/domain/rotation';
import type { QuickTeamColorId } from '@/modules/quick/domain/types';
import type { DayMatchTimer, MatchDayEntity } from '../domain/matchday';

/** Команда дня при запуске протокола: название приходит с клиента (i18n). */
export interface NewMatchDayTeam {
  name: string;
  colorId: QuickTeamColorId;
}

export interface CreateMatchDayInput {
  gameId: string;
  teams: NewMatchDayTeam[];
  /** Стартовое распределение: индекс команды в списке teams. */
  members: { participantId: string; teamIndex: number }[];
  startedAt: Date;
}

export interface NewDayGoal {
  teamId: string;
  scorerParticipantId: string | null;
  assistParticipantId: string | null;
}

/**
 * Операции над днём внутри транзакции с заблокированной строкой дня.
 * Тот же приём, что у GameTx: параллельные нажатия менеджеров
 * (создатель и назначенный) не перемешиваются.
 */
export interface MatchDayTx {
  /** День, перечитанный после захвата блокировки. */
  readonly day: MatchDayEntity;
  renameTeam(teamId: string, name: string): Promise<void>;
  assignMember(participantId: string, teamId: string | null): Promise<void>;
  startMatch(input: {
    order: number;
    homeTeamId: string;
    awayTeamId: string;
    startedAt: Date;
  }): Promise<void>;
  setTimer(matchId: string, timer: DayMatchTimer): Promise<void>;
  addGoal(matchId: string, goal: NewDayGoal): Promise<void>;
  removeGoal(goalId: string): Promise<void>;
  finishMatch(matchId: string, finishedAt: Date): Promise<void>;
  setRotation(rotation: RotationState | null): Promise<void>;
  finishDay(finishedAt: Date): Promise<void>;
  resumeDay(): Promise<void>;
  /** Игра состоялась: статус FINISHED учитывается в рейтинге игроков. */
  markGameFinished(): Promise<void>;
}

export interface MatchDayRepository {
  findByGameId(gameId: string): Promise<MatchDayEntity | null>;
  create(input: CreateMatchDayInput): Promise<MatchDayEntity>;
  /**
   * Выполняет fn под блокировкой строки дня.
   * Возвращает null, если у игры дня ещё нет.
   */
  withDayLock<T>(gameId: string, fn: (tx: MatchDayTx) => Promise<T>): Promise<T | null>;
}
