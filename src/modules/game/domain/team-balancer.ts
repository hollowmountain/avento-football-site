import type { Position, SkillLevel, TeamsSnapshot } from './types';

/**
 * Авто-жеребьёвка: жадный алгоритм — сортировка по «весу» игрока
 * (уровень + позиция) и распределение «змейкой» (snake draft).
 * Детерминирован при фиксированном seed — это важно для тестов
 * и для кнопки «перегенерировать» (новый seed → новый расклад).
 */
export interface BalancerPlayer {
  participantId: string;
  nickname: string;
  position: Position;
  skillLevel: SkillLevel;
}

const SKILL_WEIGHT: Record<SkillLevel, number> = {
  BEGINNER: 1,
  ANY: 2, // не указал уровень — считаем средним
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

/** Порядок разбора позиций: вратари в первую очередь, «без разницы» — в конце. */
const POSITION_ORDER: readonly Position[] = [
  'GOALKEEPER',
  'DEFENDER',
  'MIDFIELDER',
  'FORWARD',
  'ANY',
];

export function playerWeight(player: Pick<BalancerPlayer, 'skillLevel'>): number {
  return SKILL_WEIGHT[player.skillLevel];
}

/** mulberry32 — маленький детерминированный PRNG. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function balanceTeams(
  players: readonly BalancerPlayer[],
  seed: number,
  generatedAt: Date,
): TeamsSnapshot {
  const random = mulberry32(seed);

  // Позиционные группы; внутри группы — по весу (сильные раньше),
  // при равном весе порядок задаёт seed (перегенерация даёт другой расклад).
  const ordered: BalancerPlayer[] = [];
  for (const position of POSITION_ORDER) {
    const group = seededShuffle(
      players.filter((p) => p.position === position),
      random,
    ).sort((a, b) => playerWeight(b) - playerWeight(a));
    ordered.push(...group);
  }

  const teamA: BalancerPlayer[] = [];
  const teamB: BalancerPlayer[] = [];

  // Змейка: A B | B A | A B ... — внутри пары порядок чередуется.
  ordered.forEach((player, index) => {
    const round = Math.floor(index / 2);
    const firstInPair = index % 2 === 0;
    const aTakes = round % 2 === 0 ? firstInPair : !firstInPair;
    // Не даём командам разъехаться по численности больше чем на 1
    const target =
      teamA.length - teamB.length >= 1
        ? teamB
        : teamB.length - teamA.length >= 1
          ? teamA
          : aTakes
            ? teamA
            : teamB;
    target.push(player);
  });

  const toMember = (p: BalancerPlayer) => ({
    participantId: p.participantId,
    nickname: p.nickname,
    position: p.position,
    skillLevel: p.skillLevel,
  });

  return {
    seed,
    generatedAt: generatedAt.toISOString(),
    teamA: teamA.map(toMember),
    teamB: teamB.map(toMember),
  };
}

/** Суммарный вес команды — для отображения баланса и тестов. */
export function teamWeight(team: readonly Pick<BalancerPlayer, 'skillLevel'>[]): number {
  return team.reduce((sum, p) => sum + playerWeight(p), 0);
}
