import { err, ok, type Result } from '@/shared/lib/result';
import { isLateCancel } from '../domain/game-rules';
import { isActiveStatus, statusForMainCount } from '../domain/game-status';
import { domainError, type DomainError } from './errors';
import type { Clock, EventBus, TokenService, UnitOfWork } from './ports';

export interface LeaveGameInput {
  gameCode: string;
  participantToken: string;
}

export interface LeaveGameOutput {
  wasLateCancel: boolean;
  /** Никнейм игрока, поднятого из листа ожидания (если был). */
  promotedNickname: string | null;
}

export interface LeaveGameDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

/**
 * Отказ от участия + авто-промоушен первого из waitlist.
 * Выполняется под той же блокировкой строки игры, что и join, —
 * гонка leave/join не может превысить maxPlayers.
 */
export async function leaveGame(
  deps: LeaveGameDeps,
  input: LeaveGameInput,
): Promise<Result<LeaveGameOutput, DomainError>> {
  const tokenHash = deps.tokens.hash(input.participantToken);
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<LeaveGameOutput, DomainError>>(
    input.gameCode,
    async (tx) => {
      const participant = await tx.findParticipantByToken(tokenHash);
      if (!participant || participant.leftAt !== null) {
        return err(domainError('NOT_PARTICIPANT', 'Вы не записаны на эту игру'));
      }
      if (!isActiveStatus(tx.game.status)) {
        return err(domainError('GAME_NOT_EDITABLE', 'Игра уже завершена или отменена'));
      }

      const late = isLateCancel(now, tx.game.cancelDeadline, tx.game.startsAt);
      await tx.updateParticipant(participant.id, { leftAt: now, wasLateCancel: late });
      if (late) {
        await tx.bumpProfile(tokenHash, { lateCancels: 1 });
      }

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

      await tx.audit('PARTICIPANT_LEFT', {
        participantId: participant.id,
        wasLateCancel: late,
        promotedNickname,
      });

      return ok({ wasLateCancel: late, promotedNickname });
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
