import type { RotationState } from '@/modules/quick/domain/rotation';
import type { QuickTeamColorId } from '@/modules/quick/domain/types';
import type { MatchDayEntity } from '../domain/matchday';
import type { ParticipantDto } from './dto';

/**
 * DTO матч-дня. Наружу уходят только идентификаторы участников и команд —
 * по ним клиент собирает имена из состава игры.
 */
export interface DayGoalDto {
  id: string;
  teamId: string;
  scorerParticipantId: string | null;
  assistParticipantId: string | null;
}

export interface DayMatchDto {
  id: string;
  order: number;
  status: 'LIVE' | 'FINISHED';
  homeTeamId: string;
  awayTeamId: string;
  timer: {
    running: boolean;
    accumulatedMs: number;
    /** ISO; null — таймер на паузе. */
    startedAt: string | null;
  };
  goals: DayGoalDto[];
}

export interface DayTeamDto {
  id: string;
  name: string;
  colorId: QuickTeamColorId;
  order: number;
}

export interface MatchDayDto {
  status: 'LIVE' | 'FINISHED';
  startedAt: string;
  finishedAt: string | null;
  rotation: RotationState | null;
  teams: DayTeamDto[];
  members: { participantId: string; teamId: string | null }[];
  matches: DayMatchDto[];
}

export interface MatchDayViewData {
  game: {
    code: string;
    title: string;
    startsAt: string;
    timezone: string;
    status: string;
    teamCount: number;
  };
  /** null — протокол ещё не запускали. */
  day: MatchDayDto | null;
  /** Основной состав: из него выбирают авторов голов. */
  participants: ParticipantDto[];
  viewer: {
    /** Может вести протокол: создатель, менеджер или легаси host-токен. */
    isManager: boolean;
    /** Может назначать менеджера — только организатор. */
    isHost: boolean;
  };
  /** Кто ведёт день: участник-менеджер (null — создатель игры). */
  managerParticipantId: string | null;
  /** Время пришло — можно запускать протокол. */
  canStart: boolean;
}

export function matchDayToDto(day: MatchDayEntity): MatchDayDto {
  return {
    status: day.status,
    startedAt: day.startedAt.toISOString(),
    finishedAt: day.finishedAt?.toISOString() ?? null,
    rotation: day.rotation,
    teams: day.teams,
    members: day.members,
    matches: day.matches.map((match) => ({
      id: match.id,
      order: match.order,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      timer: {
        running: match.timer.running,
        accumulatedMs: match.timer.accumulatedMs,
        startedAt: match.timer.startedAt?.toISOString() ?? null,
      },
      goals: match.goals.map((goal) => ({
        id: goal.id,
        teamId: goal.teamId,
        scorerParticipantId: goal.scorerParticipantId,
        assistParticipantId: goal.assistParticipantId,
      })),
    })),
  };
}
