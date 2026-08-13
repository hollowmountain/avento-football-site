import { err, ok, type Result } from '@/shared/lib/result';
import { canTransition } from '../domain/game-status';
import { domainError, type DomainError } from './errors';
import { isHostAuthorized, type HostAuth } from './host-auth';
import type { Clock, EventBus, TokenService, UnitOfWork } from './ports';

export interface CancelGameInput extends HostAuth {
  gameCode: string;
}

export interface CancelGameDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

export async function cancelGame(
  deps: CancelGameDeps,
  input: CancelGameInput,
): Promise<Result<{ cancelled: true }, DomainError>> {
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<{ cancelled: true }, DomainError>>(
    input.gameCode,
    async (tx) => {
      if (!isHostAuthorized(deps.tokens, tx.game, input)) {
        return err(domainError('FORBIDDEN', 'Управлять игрой может только организатор'));
      }
      if (!canTransition(tx.game.status, 'CANCELLED_BY_HOST')) {
        return err(domainError('GAME_NOT_EDITABLE', 'Эту игру уже нельзя отменить'));
      }
      await tx.updateGame({ status: 'CANCELLED_BY_HOST' });
      await tx.audit('GAME_CANCELLED_BY_HOST', {});
      return ok({ cancelled: true });
    },
  );

  if (result === null) {
    return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));
  }
  if (result.ok) {
    deps.events.publish(input.gameCode, { type: 'game_cancelled', at: now.toISOString() });
  }
  return result;
}
