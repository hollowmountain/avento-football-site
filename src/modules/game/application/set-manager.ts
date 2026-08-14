import { err, ok, type Result } from '@/shared/lib/result';
import { domainError, type DomainError } from './errors';
import type { Clock, EventBus, UnitOfWork } from './ports';

export interface SetManagerDeps {
  uow: UnitOfWork;
  clock: Clock;
  events: EventBus;
}

/**
 * Кому вести протокол матч-дня. По умолчанию — создателю; он может
 * передать таймер и счёт кому-то из записавшихся. Менеджеру нужен
 * кабинет: права проверяются по нему, а голы пишутся на профили.
 * participantId = null возвращает протокол создателю.
 */
export async function setMatchDayManager(
  deps: SetManagerDeps,
  input: { gameCode: string; participantId: string | null },
): Promise<Result<{ managerProfileId: string | null }, DomainError>> {
  const now = deps.clock.now();

  const result = await deps.uow.withGameLock<
    Result<{ managerProfileId: string | null }, DomainError>
  >(input.gameCode, async (tx) => {
    if (input.participantId === null) {
      await tx.updateGame({ managerProfileId: null });
      await tx.audit('MATCHDAY_MANAGER_SET', { managerProfileId: null });
      return ok({ managerProfileId: null });
    }

    const participants = await tx.activeParticipants();
    const participant = participants.find((p) => p.id === input.participantId);
    if (participant === undefined || participant.role !== 'MAIN') {
      return err(domainError('NOT_PARTICIPANT', 'Такого игрока нет в основном составе'));
    }
    if (participant.profileId === null) {
      return err(
        domainError('VALIDATION_FAILED', 'Менеджером можно назначить только игрока с кабинетом'),
      );
    }

    await tx.updateGame({ managerProfileId: participant.profileId });
    await tx.audit('MATCHDAY_MANAGER_SET', { managerProfileId: participant.profileId });
    return ok({ managerProfileId: participant.profileId });
  });

  if (result === null) return err(domainError('GAME_NOT_FOUND', 'Игра не найдена'));
  if (result.ok) {
    deps.events.publish(input.gameCode, { type: 'game_updated', at: now.toISOString() });
  }
  return result;
}
