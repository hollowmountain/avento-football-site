import { describe, expect, it } from 'vitest';
import {
  MATCHDAY_START_WINDOW_MINUTES,
  canStartMatchDay,
  distributeMembers,
  elapsedMs,
  liveMatch,
  matchResult,
  matchScore,
  nextPair,
  playedResults,
  type DayMatchEntity,
} from '@/modules/game/domain/matchday';

const START = new Date('2026-08-14T18:00:00.000Z');
const minutesBefore = (minutes: number) => new Date(START.getTime() - minutes * 60_000);

function match(overrides: Partial<DayMatchEntity> = {}): DayMatchEntity {
  return {
    id: 'm1',
    order: 1,
    status: 'LIVE',
    homeTeamId: 'A',
    awayTeamId: 'B',
    timer: { running: false, accumulatedMs: 0, startedAt: null },
    goals: [],
    ...overrides,
  };
}

const goal = (teamId: string, id = `g-${Math.random()}`) => ({
  id,
  teamId,
  scorerParticipantId: null,
  assistParticipantId: null,
});

describe('canStartMatchDay', () => {
  it('до окна протокол закрыт', () => {
    const game = { status: 'OPEN' as const, startsAt: START };
    expect(canStartMatchDay(game, minutesBefore(MATCHDAY_START_WINDOW_MINUTES + 1))).toBe(false);
  });

  it('внутри окна и после начала — открыт', () => {
    const game = { status: 'OPEN' as const, startsAt: START };
    expect(canStartMatchDay(game, minutesBefore(MATCHDAY_START_WINDOW_MINUTES))).toBe(true);
    expect(canStartMatchDay(game, new Date(START.getTime() + 60 * 60_000))).toBe(true);
  });

  it('завершённая игра протоколу не мешает: команда могла начать позже', () => {
    expect(canStartMatchDay({ status: 'FINISHED', startsAt: START }, START)).toBe(true);
  });

  it('у отменённой игры матч-дня быть не может', () => {
    expect(canStartMatchDay({ status: 'CANCELLED_BY_HOST', startsAt: START }, START)).toBe(false);
    expect(canStartMatchDay({ status: 'CANCELLED_NOT_ENOUGH', startsAt: START }, START)).toBe(
      false,
    );
  });
});

describe('matchScore и matchResult', () => {
  it('счёт считается по голам, чужие команды не влияют', () => {
    const m = match({ goals: [goal('A'), goal('A'), goal('B'), goal('C')] });
    expect(matchScore(m)).toEqual({ home: 2, away: 1 });
    expect(matchResult(m)).toEqual({ homeId: 'A', awayId: 'B', homeGoals: 2, awayGoals: 1 });
  });

  it('без голов — нули', () => {
    expect(matchScore(match())).toEqual({ home: 0, away: 0 });
  });
});

describe('liveMatch и playedResults', () => {
  const day = {
    matches: [
      match({ id: 'm1', status: 'FINISHED', goals: [goal('A')] }),
      match({ id: 'm2', status: 'FINISHED', homeTeamId: 'B', awayTeamId: 'C', goals: [] }),
      match({ id: 'm3', status: 'LIVE', goals: [goal('B'), goal('B')] }),
    ],
  };

  it('идущий матч находится по статусу', () => {
    expect(liveMatch(day)?.id).toBe('m3');
    expect(liveMatch({ matches: [] })).toBeNull();
  });

  it('в таблицу дня идут только завершённые матчи', () => {
    expect(playedResults(day)).toEqual([
      { homeId: 'A', awayId: 'B', homeGoals: 1, awayGoals: 0 },
      { homeId: 'B', awayId: 'C', homeGoals: 0, awayGoals: 0 },
    ]);
  });
});

describe('distributeMembers', () => {
  it('при двух командах берётся расклад жеребьёвки', () => {
    const snapshot = {
      teamA: [{ participantId: 'p1' }, { participantId: 'p3' }],
      teamB: [{ participantId: 'p2' }],
    };
    expect(distributeMembers(['p1', 'p2', 'p3'], 2, snapshot)).toEqual([
      { participantId: 'p1', teamIndex: 0 },
      { participantId: 'p2', teamIndex: 1 },
      { participantId: 'p3', teamIndex: 0 },
    ]);
  });

  it('записавшихся после жеребьёвки раскладывает по кругу', () => {
    const snapshot = { teamA: [{ participantId: 'p1' }], teamB: [{ participantId: 'p2' }] };
    const result = distributeMembers(['p1', 'p2', 'p3', 'p4'], 2, snapshot);
    expect(result.slice(2)).toEqual([
      { participantId: 'p3', teamIndex: 0 },
      { participantId: 'p4', teamIndex: 1 },
    ]);
  });

  it('при трёх командах жеребьёвка не годится — раскладывает по кругу', () => {
    const snapshot = { teamA: [{ participantId: 'p1' }], teamB: [{ participantId: 'p2' }] };
    expect(distributeMembers(['p1', 'p2', 'p3', 'p4'], 3, snapshot)).toEqual([
      { participantId: 'p1', teamIndex: 0 },
      { participantId: 'p2', teamIndex: 1 },
      { participantId: 'p3', teamIndex: 2 },
      { participantId: 'p4', teamIndex: 0 },
    ]);
  });

  it('число команд зажимается в 2–4', () => {
    const wild = distributeMembers(['p1', 'p2', 'p3', 'p4', 'p5'], 9, null);
    expect(Math.max(...wild.map((m) => m.teamIndex))).toBe(3);
  });
});

describe('nextPair', () => {
  const teams = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];

  it('без очереди играют первые две команды', () => {
    expect(nextPair({ rotation: null, teams })).toEqual(['A', 'B']);
  });

  it('с очередью пару диктует ротация', () => {
    expect(nextPair({ rotation: { playing: ['B', 'C'], waiting: ['A'] }, teams })).toEqual([
      'B',
      'C',
    ]);
  });

  it('одной команды на матч не хватает', () => {
    expect(nextPair({ rotation: null, teams: [{ id: 'A' }] })).toBeNull();
  });
});

describe('elapsedMs', () => {
  const now = new Date('2026-08-14T18:10:00.000Z');

  it('на паузе показывает накопленное', () => {
    expect(elapsedMs({ running: false, accumulatedMs: 90_000, startedAt: null }, now)).toBe(90_000);
  });

  it('на ходу добавляет время с последнего запуска', () => {
    const startedAt = new Date(now.getTime() - 30_000);
    expect(elapsedMs({ running: true, accumulatedMs: 60_000, startedAt }, now)).toBe(90_000);
  });

  it('часы, ушедшие назад, не дают отрицательное время', () => {
    const startedAt = new Date(now.getTime() + 5_000);
    expect(elapsedMs({ running: true, accumulatedMs: 1_000, startedAt }, now)).toBe(1_000);
  });
});
