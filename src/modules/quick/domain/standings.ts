import type { QuickMatchResult } from './types';

export interface StandingsRow {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  points: number;
}

const POINTS_WIN = 3;
const POINTS_DRAW = 1;

/**
 * Таблица игрового дня: победа +3, ничья +1, поражение 0.
 * Сортировка: очки → разница мячей → забитые; при полном равенстве
 * порядок стабилен — как команды заведены в день.
 */
export function computeStandings(
  teamIds: readonly string[],
  matches: readonly QuickMatchResult[],
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const teamId of teamIds) {
    rows.set(teamId, {
      teamId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      diff: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    const home = rows.get(match.homeId);
    const away = rows.get(match.awayId);
    // Матч распущенной команды не роняет таблицу — просто не считается
    if (!home || !away) continue;
    applySide(home, match.homeGoals, match.awayGoals);
    applySide(away, match.awayGoals, match.homeGoals);
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.diff - a.diff || b.goalsFor - a.goalsFor,
  );
}

function applySide(row: StandingsRow, scored: number, conceded: number): void {
  row.played += 1;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  row.diff = row.goalsFor - row.goalsAgainst;
  if (scored > conceded) {
    row.wins += 1;
    row.points += POINTS_WIN;
  } else if (scored === conceded) {
    row.draws += 1;
    row.points += POINTS_DRAW;
  } else {
    row.losses += 1;
  }
}
