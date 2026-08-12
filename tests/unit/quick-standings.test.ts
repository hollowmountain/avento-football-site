import { describe, expect, it } from 'vitest';
import { computeStandings } from '@/modules/quick/domain/standings';
import type { QuickMatchResult } from '@/modules/quick/domain/types';

const TEAMS = ['yellow', 'green', 'red'];

function match(
  homeId: string,
  awayId: string,
  homeGoals: number,
  awayGoals: number,
): QuickMatchResult {
  return { homeId, awayId, homeGoals, awayGoals };
}

describe('computeStandings', () => {
  it('без матчей все команды по нулям в исходном порядке', () => {
    const rows = computeStandings(TEAMS, []);
    expect(rows.map((r) => r.teamId)).toEqual(TEAMS);
    for (const row of rows) {
      expect(row).toMatchObject({ played: 0, points: 0, diff: 0, goalsFor: 0 });
    }
  });

  it('победа даёт 3 очка, поражение 0', () => {
    const rows = computeStandings(TEAMS, [match('yellow', 'green', 2, 1)]);
    const yellow = rows.find((r) => r.teamId === 'yellow');
    const green = rows.find((r) => r.teamId === 'green');
    expect(yellow).toMatchObject({ points: 3, wins: 1, draws: 0, losses: 0 });
    expect(green).toMatchObject({ points: 0, wins: 0, draws: 0, losses: 1 });
  });

  it('ничья даёт по очку обеим', () => {
    const rows = computeStandings(TEAMS, [match('yellow', 'green', 1, 1)]);
    expect(rows.find((r) => r.teamId === 'yellow')?.points).toBe(1);
    expect(rows.find((r) => r.teamId === 'green')?.points).toBe(1);
  });

  it('считает забитые, пропущенные и разницу', () => {
    const rows = computeStandings(TEAMS, [
      match('yellow', 'green', 3, 1),
      match('yellow', 'red', 0, 2),
    ]);
    const yellow = rows.find((r) => r.teamId === 'yellow');
    expect(yellow).toMatchObject({ played: 2, goalsFor: 3, goalsAgainst: 3, diff: 0 });
  });

  it('сортировка: очки → разница → забитые', () => {
    // yellow и green по 3 очка: у green разница лучше;
    // red и yellow по разнице −1/+1... подбираем матчи под точный порядок
    const rows = computeStandings(TEAMS, [
      match('green', 'red', 4, 0), // green: 3 очка, +4
      match('yellow', 'red', 2, 1), // yellow: 3 очка, +1
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(['green', 'yellow', 'red']);
  });

  it('при равных очках и разнице выше команда с большим числом забитых', () => {
    const rows = computeStandings(TEAMS, [
      match('yellow', 'red', 3, 3),
      match('green', 'red', 1, 1),
    ]);
    // yellow и green по 1 очку и разнице 0, у yellow забито больше
    const yellowIndex = rows.findIndex((r) => r.teamId === 'yellow');
    const greenIndex = rows.findIndex((r) => r.teamId === 'green');
    expect(yellowIndex).toBeLessThan(greenIndex);
  });

  it('при полном равенстве порядок стабилен', () => {
    const rows = computeStandings(TEAMS, []);
    expect(rows.map((r) => r.teamId)).toEqual(TEAMS);
  });

  it('матч распущенной команды не роняет таблицу', () => {
    const rows = computeStandings(
      ['yellow', 'green'],
      [match('yellow', 'ghost', 5, 0), match('yellow', 'green', 1, 0)],
    );
    expect(rows.find((r) => r.teamId === 'yellow')).toMatchObject({ played: 1, points: 3 });
  });

  it('исправленный счёт учитывается как есть (правка журнала)', () => {
    // Счёт правится в журнале плюс/минусом — таблица пересчитывается заново
    const before = computeStandings(TEAMS, [match('yellow', 'green', 1, 1)]);
    const after = computeStandings(TEAMS, [match('yellow', 'green', 2, 1)]);
    expect(before.find((r) => r.teamId === 'yellow')?.points).toBe(1);
    expect(after.find((r) => r.teamId === 'yellow')?.points).toBe(3);
  });
});
