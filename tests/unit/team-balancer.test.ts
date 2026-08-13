import { describe, expect, it } from 'vitest';
import {
  balanceTeams,
  playerWeight,
  teamWeight,
  type BalancerPlayer,
} from '@/modules/game/domain/team-balancer';
import type { Position, SkillLevel } from '@/modules/game/domain/types';

const AT = new Date('2026-08-12T10:00:00Z');

function player(
  id: string,
  position: Position,
  skillLevel: SkillLevel = 'INTERMEDIATE',
): BalancerPlayer {
  return { participantId: id, nickname: `nick-${id}`, position, skillLevel };
}

function squad(): BalancerPlayer[] {
  return [
    player('gk1', 'GOALKEEPER', 'ADVANCED'),
    player('gk2', 'GOALKEEPER', 'BEGINNER'),
    player('d1', 'DEFENDER', 'ADVANCED'),
    player('d2', 'DEFENDER', 'INTERMEDIATE'),
    player('d3', 'DEFENDER', 'BEGINNER'),
    player('m1', 'MIDFIELDER', 'ADVANCED'),
    player('m2', 'MIDFIELDER', 'ANY'),
    player('f1', 'FORWARD', 'INTERMEDIATE'),
    player('f2', 'FORWARD', 'BEGINNER'),
    player('a1', 'ANY', 'ADVANCED'),
  ];
}

describe('balanceTeams', () => {
  it('детерминирован: одинаковый seed даёт одинаковый расклад', () => {
    const a = balanceTeams(squad(), 42, AT);
    const b = balanceTeams(squad(), 42, AT);
    expect(a).toEqual(b);
  });

  it('другой seed даёт другой расклад (перегенерация)', () => {
    // Игроки с одинаковым весом: порядок внутри группы решает seed
    const tied = Array.from({ length: 8 }, (_, i) => player(`p${i}`, 'ANY', 'INTERMEDIATE'));
    const a = balanceTeams(tied, 1, AT);
    const b = balanceTeams(tied, 2, AT);
    expect(a.teamA.map((p) => p.participantId)).not.toEqual(b.teamA.map((p) => p.participantId));
  });

  it('никого не теряет и не дублирует', () => {
    const teams = balanceTeams(squad(), 7, AT);
    const ids = [...teams.teamA, ...teams.teamB].map((p) => p.participantId).sort();
    expect(ids).toEqual(
      squad()
        .map((p) => p.participantId)
        .sort(),
    );
  });

  it('размеры команд отличаются не больше чем на 1', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const count of [2, 3, 5, 7, 10, 11]) {
        const teams = balanceTeams(squad().slice(0, count), seed, AT);
        expect(Math.abs(teams.teamA.length - teams.teamB.length)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('вратари расходятся по разным командам', () => {
    const teams = balanceTeams(squad(), 13, AT);
    const gkInA = teams.teamA.filter((p) => p.position === 'GOALKEEPER').length;
    const gkInB = teams.teamB.filter((p) => p.position === 'GOALKEEPER').length;
    expect(gkInA).toBe(1);
    expect(gkInB).toBe(1);
  });

  it('суммарные веса команд отличаются не больше чем на вес одного игрока', () => {
    // Шкала выросла до пяти уровней: максимальный вес игрока — 5 (PRO)
    const maxWeight = 5;
    for (const seed of [1, 5, 9, 21, 33]) {
      const teams = balanceTeams(squad(), seed, AT);
      const diff = Math.abs(teamWeight(teams.teamA) - teamWeight(teams.teamB));
      expect(diff).toBeLessThanOrEqual(maxWeight);
    }
  });

  it('пустой список и один игрок — корректные крайние случаи', () => {
    const empty = balanceTeams([], 1, AT);
    expect(empty.teamA).toEqual([]);
    expect(empty.teamB).toEqual([]);

    const single = balanceTeams([player('solo', 'ANY')], 1, AT);
    expect(single.teamA.length + single.teamB.length).toBe(1);
  });

  it('generatedAt и seed сохраняются в снапшоте', () => {
    const teams = balanceTeams(squad(), 99, AT);
    expect(teams.seed).toBe(99);
    expect(teams.generatedAt).toBe(AT.toISOString());
  });
});

describe('playerWeight', () => {
  it('веса уровней упорядочены', () => {
    expect(playerWeight({ skillLevel: 'BEGINNER' })).toBeLessThan(
      playerWeight({ skillLevel: 'INTERMEDIATE' }),
    );
    expect(playerWeight({ skillLevel: 'INTERMEDIATE' })).toBeLessThan(
      playerWeight({ skillLevel: 'ADVANCED' }),
    );
    expect(playerWeight({ skillLevel: 'ANY' })).toBe(playerWeight({ skillLevel: 'INTERMEDIATE' }));
  });
});
