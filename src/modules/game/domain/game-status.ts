import type { GameStatus } from './types';

/** Машина статусов игры: какие переходы допустимы. */
const TRANSITIONS: Record<GameStatus, readonly GameStatus[]> = {
  OPEN: ['FULL', 'CANCELLED_BY_HOST', 'CANCELLED_NOT_ENOUGH', 'FINISHED'],
  FULL: ['OPEN', 'CANCELLED_BY_HOST', 'FINISHED'],
  CANCELLED_BY_HOST: [],
  CANCELLED_NOT_ENOUGH: [],
  FINISHED: [],
};

export function canTransition(from: GameStatus, to: GameStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Игра «живая»: набор идёт или состав полон, но она ещё не прошла и не отменена. */
export function isActiveStatus(status: GameStatus): boolean {
  return status === 'OPEN' || status === 'FULL';
}

/** Статус по фактическому числу основных игроков. */
export function statusForMainCount(activeMainCount: number, maxPlayers: number): GameStatus {
  return activeMainCount >= maxPlayers ? 'FULL' : 'OPEN';
}
