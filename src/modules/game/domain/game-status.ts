import type { GameStatus } from './types';

/**
 * Машина статусов игры: какие переходы допустимы.
 * REMOVED_BY_ADMIN доступен из любого состояния — модерация снимает
 * и уже прошедшие, и отменённые игры, а обратного пути из него нет.
 */
const TRANSITIONS: Record<GameStatus, readonly GameStatus[]> = {
  OPEN: ['FULL', 'CANCELLED_BY_HOST', 'CANCELLED_NOT_ENOUGH', 'FINISHED', 'REMOVED_BY_ADMIN'],
  FULL: ['OPEN', 'CANCELLED_BY_HOST', 'FINISHED', 'REMOVED_BY_ADMIN'],
  CANCELLED_BY_HOST: ['REMOVED_BY_ADMIN'],
  CANCELLED_NOT_ENOUGH: ['REMOVED_BY_ADMIN'],
  FINISHED: ['REMOVED_BY_ADMIN'],
  REMOVED_BY_ADMIN: [],
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
