import { err, ok, type Result } from '@/shared/lib/result';
import { validateGameDraft } from '../domain/game-rules';
import { isActiveStatus, statusForMainCount } from '../domain/game-status';
import type { GameEntity } from '../domain/types';
import { domainError, type DomainError } from './errors';
import type { Clock, EventBus, GamePatch, TokenService, UnitOfWork } from './ports';

export interface UpdateGameInput {
  gameCode: string;
  hostToken: string;
  patch: Omit<GamePatch, 'status' | 'teamsSnapshot'>;
}

export interface UpdateGameDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

/**
 * Редактирование игры организатором. При увеличении maxPlayers
 * освободившиеся места автоматически занимают игроки из waitlist.
 */
export async function updateGame(
  deps: UpdateGameDeps,
  input: UpdateGameInput,
): Promise<Result<{ game: GameEntity }, DomainError>> {
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<{ game: GameEntity }, DomainError>>(
    input.gameCode,
    async (tx) => {
      if (!deps.tokens.verify(input.hostToken, tx.game.hostTokenHash)) {
        return err(domainError('FORBIDDEN', 'Неверный токен управления игрой'));
      }
      if (!isActiveStatus(tx.game.status)) {
        return err(domainError('GAME_NOT_EDITABLE', 'Игра уже завершена или отменена'));
      }

      const draft = {
        startsAt: input.patch.startsAt ?? tx.game.startsAt,
        cancelDeadline: input.patch.cancelDeadline ?? tx.game.cancelDeadline,
        // null — валидный сброс на «как получится», undefined — «не менять»
        durationMinutes:
          input.patch.durationMinutes !== undefined
            ? input.patch.durationMinutes
            : tx.game.durationMinutes,
        minPlayers: input.patch.minPlayers ?? tx.game.minPlayers,
        maxPlayers: input.patch.maxPlayers ?? tx.game.maxPlayers,
        pricePerPitch: input.patch.pricePerPitch ?? tx.game.pricePerPitch,
      };
      const validation = validateGameDraft(draft, now);
      if (!validation.ok) {
        return err(
          domainError('VALIDATION_FAILED', 'Данные игры не прошли проверку', validation.error),
        );
      }

      const mainCount = await tx.activeMainCount();
      if (draft.maxPlayers < mainCount) {
        return err(
          domainError(
            'VALIDATION_FAILED',
            `Нельзя уменьшить максимум ниже текущего состава (${mainCount})`,
            [{ field: 'maxPlayers', message: 'меньше текущего состава' }],
          ),
        );
      }

      await tx.updateGame(input.patch);

      // Стало больше мест — поднимаем очередь ожидания
      let promoted = 0;
      let freeSlots = draft.maxPlayers - mainCount;
      while (freeSlots > 0) {
        const next = await tx.firstWaitlisted();
        if (!next) break;
        await tx.updateParticipant(next.id, { role: 'MAIN', waitlistOrder: null });
        promoted += 1;
        freeSlots -= 1;
      }

      const newMainCount = mainCount + promoted;
      const game = await tx.updateGame({
        status: statusForMainCount(newMainCount, draft.maxPlayers),
      });

      await tx.audit('GAME_UPDATED', { patch: JSON.parse(JSON.stringify(input.patch)), promoted });
      return ok({ game });
    },
  );

  if (result === null) {
    return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));
  }
  if (result.ok) {
    deps.events.publish(input.gameCode, { type: 'game_updated', at: now.toISOString() });
  }
  return result;
}
