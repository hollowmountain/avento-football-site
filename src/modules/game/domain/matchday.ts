import type { RotationState } from '@/modules/quick/domain/rotation';
import type { QuickMatchResult, QuickTeamColorId } from '@/modules/quick/domain/types';
import type { GameStatus } from './types';

/**
 * Матч-день обычной игры: тот же протокол, что в «Быстрой игре»,
 * но состояние живёт на сервере, а голы записаны на участников.
 * Здесь только правила и расчёты — ни Prisma, ни React.
 *
 * Ротация очереди и таблица дня не дублируются: они переиспользуются
 * из `modules/quick/domain` (rotation.ts, standings.ts).
 */

/** Собираться начинают заранее — протокол открывается за два часа до начала. */
export const MATCHDAY_START_WINDOW_MINUTES = 120;

export interface MatchDayTeamEntity {
  id: string;
  name: string;
  colorId: QuickTeamColorId;
  order: number;
}

/** Кто за какую команду играет сегодня (null — ещё не распределён). */
export interface MatchDayMemberEntity {
  participantId: string;
  teamId: string | null;
}

export interface DayGoalEntity {
  id: string;
  teamId: string;
  /** null — гол «без автора». */
  scorerParticipantId: string | null;
  assistParticipantId: string | null;
}

export interface DayMatchTimer {
  running: boolean;
  /** Накопленное до последней паузы время, мс. */
  accumulatedMs: number;
  /** Момент последнего запуска; null — на паузе. */
  startedAt: Date | null;
}

export interface DayMatchEntity {
  id: string;
  order: number;
  status: 'LIVE' | 'FINISHED';
  homeTeamId: string;
  awayTeamId: string;
  timer: DayMatchTimer;
  goals: DayGoalEntity[];
}

export interface MatchDayEntity {
  id: string;
  gameId: string;
  status: 'LIVE' | 'FINISHED';
  startedAt: Date;
  finishedAt: Date | null;
  rotation: RotationState | null;
  teams: MatchDayTeamEntity[];
  members: MatchDayMemberEntity[];
  matches: DayMatchEntity[];
}

/**
 * Можно ли запускать протокол. Раньше окна — рано, игра ещё собирается.
 * Завершённая игра протоколу не мешает: фоновая уборка ставит FINISHED
 * по расписанию, а команда могла начать позже. Отменённая — мешает.
 */
export function canStartMatchDay(game: { status: GameStatus; startsAt: Date }, now: Date): boolean {
  if (
    game.status === 'CANCELLED_BY_HOST' ||
    game.status === 'CANCELLED_NOT_ENOUGH' ||
    game.status === 'REMOVED_BY_ADMIN'
  ) {
    return false;
  }
  const opensAt = game.startsAt.getTime() - MATCHDAY_START_WINDOW_MINUTES * 60_000;
  return now.getTime() >= opensAt;
}

/**
 * Минимум, из которого считается счёт. Описан структурно, чтобы одни и те
 * же формулы работали и на сервере (сущности), и в интерфейсе (DTO с датами
 * строками) — считать счёт в двух местах по-разному нельзя.
 */
export interface ScoreSource {
  homeTeamId: string;
  awayTeamId: string;
  goals: readonly { teamId: string }[];
}

/** Счёт матча — это его голы: отдельного поля счёта нет, расходиться нечему. */
export function matchScore(match: ScoreSource): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const goal of match.goals) {
    if (goal.teamId === match.homeTeamId) home += 1;
    else if (goal.teamId === match.awayTeamId) away += 1;
  }
  return { home, away };
}

/** Результат матча в том виде, в каком его ждут ротация и таблица дня. */
export function matchResult(match: ScoreSource): QuickMatchResult {
  const score = matchScore(match);
  return {
    homeId: match.homeTeamId,
    awayId: match.awayTeamId,
    homeGoals: score.home,
    awayGoals: score.away,
  };
}

export function liveMatch<T extends { status: 'LIVE' | 'FINISHED' }>(day: {
  matches: readonly T[];
}): T | null {
  return day.matches.find((match) => match.status === 'LIVE') ?? null;
}

/** Сыгранные матчи — из них считается таблица дня. */
export function playedResults(day: {
  matches: readonly (ScoreSource & { status: 'LIVE' | 'FINISHED' })[];
}): QuickMatchResult[] {
  const results: QuickMatchResult[] = [];
  for (const match of day.matches) {
    if (match.status === 'FINISHED') results.push(matchResult(match));
  }
  return results;
}

/** Сколько времени идёт матч. Считается от переданного «сейчас». */
export function elapsedMs(timer: DayMatchTimer, now: Date): number {
  if (!timer.running || timer.startedAt === null) return timer.accumulatedMs;
  return timer.accumulatedMs + Math.max(0, now.getTime() - timer.startedAt.getTime());
}

/**
 * Стартовое распределение по командам. Если жеребьёвка уже была, её
 * расклад и берём (она делит ровно на две команды); всех остальных —
 * и при 3–4 командах вообще всех — раскладываем по кругу, чтобы
 * составы вышли равными по числу игроков.
 */
export function distributeMembers(
  participantIds: readonly string[],
  teamCount: number,
  snapshot: { teamA: { participantId: string }[]; teamB: { participantId: string }[] } | null,
): { participantId: string; teamIndex: number }[] {
  const teams = Math.max(2, Math.min(4, teamCount));
  const assigned = new Map<string, number>();

  if (snapshot !== null && teams === 2) {
    for (const member of snapshot.teamA) assigned.set(member.participantId, 0);
    for (const member of snapshot.teamB) assigned.set(member.participantId, 1);
  }

  const result: { participantId: string; teamIndex: number }[] = [];
  let next = 0;
  for (const participantId of participantIds) {
    const fromSnapshot = assigned.get(participantId);
    if (fromSnapshot !== undefined) {
      result.push({ participantId, teamIndex: fromSnapshot });
      continue;
    }
    result.push({ participantId, teamIndex: next % teams });
    next += 1;
  }
  return result;
}

/**
 * Пара для следующего матча. Пока очереди нет — первые две команды;
 * дальше пару диктует ротация «победитель остаётся».
 */
export function nextPair(day: {
  rotation: RotationState | null;
  teams: readonly { id: string }[];
}): [string, string] | null {
  if (day.rotation !== null) return [day.rotation.playing[0], day.rotation.playing[1]];
  const [first, second] = day.teams;
  if (first === undefined || second === undefined) return null;
  return [first.id, second.id];
}
