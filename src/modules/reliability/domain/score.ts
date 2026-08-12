/**
 * Индекс надёжности участника (по анонимному токену).
 * Меньше 3 игр — «новичок»; дальше процент, который снижают поздние отмены.
 */
export const NEWCOMER_THRESHOLD = 3;

export interface ReliabilityProfile {
  gamesJoined: number;
  gamesAttended: number;
  lateCancels: number;
}

export type ReliabilityBadge = { kind: 'new' } | { kind: 'score'; percent: number };

export function reliabilityBadge(profile: ReliabilityProfile): ReliabilityBadge {
  if (profile.gamesJoined < NEWCOMER_THRESHOLD) {
    return { kind: 'new' };
  }
  const base = Math.max(1, profile.gamesJoined);
  const percent = Math.round(100 * (1 - profile.lateCancels / base));
  return { kind: 'score', percent: Math.min(100, Math.max(0, percent)) };
}
