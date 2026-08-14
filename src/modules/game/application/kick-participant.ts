import { err, ok, type Result } from '@/shared/lib/result';
import { isActiveStatus, statusForMainCount } from '../domain/game-status';
import { domainError, type DomainError } from './errors';
import { isHostAuthorized, type HostAuth } from './host-auth';
import type { Clock, EventBus, TokenService, UnitOfWork } from './ports';

export interface KickParticipantInput extends HostAuth {
  gameCode: string;
  participantId: string;
}

export interface KickParticipantOutput {
  /** Никнейм удалённого. */
  nickname: string;
  /** Никнейм поднятого из листа ожидания (если был). */
  promotedNickname: string | null;
}

export interface KickParticipantDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

/**
 * Удаление участника организатором. Та же механика, что при отказе
 * самого игрока (leftAt + промоушен из waitlist), но без пометки
 * «поздний отказ»: репутацию игрока чужое решение портить не должно.
 */
export async function kickParticipant(
  deps: KickParticipantDeps,
  input: KickParticipantInput,
): Promise<Result<KickParticipantOutput, DomainError>> {
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<KickParticipantOutput, DomainError>>(
    input.gameCode,
    async (tx) => {
      if (!isHostAuthorized(deps.tokens, tx.game, input)) {
        return err(domainError('FORBIDDEN', 'Удалять участников может только организатор'));
      }
      if (!isActiveStatus(tx.game.status)) {
        return err(domainError('GAME_NOT_EDITABLE', 'Игра уже завершена или отменена'));
      }

      const participants = await tx.activeParticipants();
      const participant = participants.find((p) => p.id === input.participantId);
      if (participant === undefined) {
        return err(domainError('NOT_PARTICIPANT', 'Такого участника в игре нет'));
      }

      await tx.updateParticipant(participant.id, { leftAt: now, wasLateCancel: false });

      // Освободилось место в основе — поднимаем очередь ожидания
      let promotedNickname: string | null = null;
      if (participant.role === 'MAIN') {
        const next = await tx.firstWaitlisted();
        if (next) {
          await tx.updateParticipant(next.id, { role: 'MAIN', waitlistOrder: null });
          promotedNickname = next.nickname;
        }
      }

      const mainCount = await tx.activeMainCount();
      const newStatus = statusForMainCount(mainCount, tx.game.maxPlayers);
      if (newStatus !== tx.game.status) {
        await tx.updateGame({ status: newStatus });
      }

      await tx.audit('PARTICIPANT_KICKED', {
        participantId: participant.id,
        nickname: participant.nickname,
        promotedNickname,
      });

      return ok({ nickname: participant.nickname, promotedNickname });
    },
  );

  if (result === null) {
    return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));
  }
  if (result.ok) {
    deps.events.publish(input.gameCode, {
      type: 'participants_changed',
      at: now.toISOString(),
    });
  }
  return result;
}
