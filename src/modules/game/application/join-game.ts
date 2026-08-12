import { err, ok, type Result } from '@/shared/lib/result';
import { decideJoin } from '../domain/game-rules';
import type { Attendance, ParticipantEntity, Position, SkillLevel } from '../domain/types';
import { domainError, type DomainError } from './errors';
import type { Clock, EventBus, TokenService, UnitOfWork } from './ports';

export interface JoinGameInput {
  gameCode: string;
  name: string;
  nickname: string;
  position: Position;
  skillLevel: SkillLevel;
  attendance: Attendance;
  /** Анонимный токен участника (cookie), plain. */
  participantToken: string;
}

export interface JoinGameOutput {
  participant: ParticipantEntity;
}

export interface JoinGameDeps {
  uow: UnitOfWork;
  tokens: TokenService;
  clock: Clock;
  events: EventBus;
}

/**
 * Присоединение к игре. Вся развилка MAIN/WAITLIST выполняется
 * под блокировкой строки игры — параллельные запросы не превысят maxPlayers.
 */
export async function joinGame(
  deps: JoinGameDeps,
  input: JoinGameInput,
): Promise<Result<JoinGameOutput, DomainError>> {
  const tokenHash = deps.tokens.hash(input.participantToken);
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<Result<JoinGameOutput, DomainError>>(
    input.gameCode,
    async (tx) => {
      const existing = await tx.findParticipantByToken(tokenHash);
      if (existing && existing.leftAt === null) {
        return err(domainError('ALREADY_JOINED', 'Вы уже записаны на эту игру'));
      }

      const sameNickname = await tx.findParticipantByNickname(input.nickname);
      if (sameNickname && sameNickname.tokenHash !== tokenHash) {
        return err(domainError('NICKNAME_TAKEN', 'Такой никнейм в этой игре уже занят'));
      }

      const decision = decideJoin({
        status: tx.game.status,
        startsAt: tx.game.startsAt,
        maxPlayers: tx.game.maxPlayers,
        activeMainCount: await tx.activeMainCount(),
        maxWaitlistOrder: await tx.maxWaitlistOrder(),
        now,
      });
      if (!decision.ok) {
        return err(domainError('GAME_NOT_JOINABLE', 'Запись на эту игру закрыта'));
      }

      const record = {
        name: input.name,
        nickname: input.nickname,
        position: input.position,
        skillLevel: input.skillLevel,
        attendance: input.attendance,
        role: decision.value.role,
        waitlistOrder: decision.value.role === 'WAITLIST' ? decision.value.waitlistOrder : null,
        tokenHash,
      };

      let participant: ParticipantEntity;
      if (existing) {
        // Возвращение после отказа: оживляем прежнюю запись
        participant = await tx.updateParticipant(existing.id, {
          ...record,
          leftAt: null,
          wasLateCancel: false,
        });
      } else {
        participant = await tx.insertParticipant(record);
        await tx.bumpProfile(tokenHash, { joined: 1 });
      }

      if (decision.value.role === 'MAIN' && decision.value.becomesFull) {
        await tx.updateGame({ status: 'FULL' });
      }

      await tx.audit('PARTICIPANT_JOINED', {
        participantId: participant.id,
        role: participant.role,
      });

      return ok({ participant });
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
