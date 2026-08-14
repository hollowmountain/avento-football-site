import { err, ok, type Result } from '@/shared/lib/result';
import { canTransition } from '../domain/game-status';
import type { RemovalReason } from '../domain/types';
import { domainError, type DomainError } from './errors';
import type { Clock, EventBus, UnitOfWork } from './ports';

export interface RemoveGameInput {
  gameCode: string;
  /** Проверяется на входе в маршруте по ADMIN_TAGS. */
  isAdmin: boolean;
  reason: RemovalReason;
  /** Пояснение владельца — обязательно для причины «другое». */
  note: string | null;
}

export interface RemoveGameDeps {
  uow: UnitOfWork;
  clock: Clock;
  events: EventBus;
}

/**
 * Снятие игры владельцем сайта. Не удаляет запись: игра исчезает из
 * ленты, но остаётся у участников в кабинете — с причиной, чтобы люди
 * понимали, куда делся их сбор, а не искали его молча.
 */
export async function removeGame(
  deps: RemoveGameDeps,
  input: RemoveGameInput,
): Promise<Result<{ removed: true }, DomainError>> {
  if (!input.isAdmin) {
    return err(domainError('FORBIDDEN', 'Снимать игры может только владелец сайта'));
  }
  if (input.reason === 'OTHER' && (input.note === null || input.note.trim() === '')) {
    return err(domainError('VALIDATION_FAILED', 'Опишите причину своими словами'));
  }

  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<{ removed: true }, DomainError>>(
    input.gameCode,
    async (tx) => {
      if (tx.game.status === 'REMOVED_BY_ADMIN') {
        return err(domainError('GAME_NOT_EDITABLE', 'Эта игра уже снята'));
      }
      if (!canTransition(tx.game.status, 'REMOVED_BY_ADMIN')) {
        return err(domainError('GAME_NOT_EDITABLE', 'Эту игру снять нельзя'));
      }

      await tx.updateGame({
        status: 'REMOVED_BY_ADMIN',
        removalReason: input.reason,
        removalNote: input.note?.trim() || null,
      });
      await tx.audit('GAME_REMOVED_BY_ADMIN', { reason: input.reason, note: input.note });
      return ok({ removed: true });
    },
  );

  if (result === null) return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));
  if (result.ok) {
    // Тем, кто сейчас на странице игры, страница обновится сама
    deps.events.publish(input.gameCode, { type: 'game_cancelled', at: now.toISOString() });
  }
  return result;
}
