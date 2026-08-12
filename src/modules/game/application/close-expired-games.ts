import { canTransition } from '../domain/game-status';
import type { Clock, EventBus, GameRepository, UnitOfWork } from './ports';

export interface CloseExpiredDeps {
  games: GameRepository;
  uow: UnitOfWork;
  clock: Clock;
  events: EventBus;
}

export interface CloseExpiredOutput {
  cancelledNotEnough: number;
  finished: number;
}

const BATCH_LIMIT = 100;

/**
 * Фоновая задача (cron + lazy-sweep):
 *  - к дедлайну не набран минимум → CANCELLED_NOT_ENOUGH;
 *  - игра закончилась по времени → FINISHED (+ зачёт посещений в reliability).
 */
export async function closeExpiredGames(deps: CloseExpiredDeps): Promise<CloseExpiredOutput> {
  const now = deps.clock.now();
  let cancelledNotEnough = 0;
  let finished = 0;

  for (const code of await deps.games.findCodesToCancel(now, BATCH_LIMIT)) {
    const changed = await deps.uow.withGameLock(code, async (tx) => {
      if (tx.game.status !== 'OPEN' || tx.game.cancelDeadline.getTime() > now.getTime()) {
        return false;
      }
      const mainCount = await tx.activeMainCount();
      if (mainCount >= tx.game.minPlayers) return false;
      await tx.updateGame({ status: 'CANCELLED_NOT_ENOUGH' });
      await tx.audit('GAME_CANCELLED_NOT_ENOUGH', { mainCount, minPlayers: tx.game.minPlayers });
      return true;
    });
    if (changed) {
      cancelledNotEnough += 1;
      deps.events.publish(code, { type: 'game_cancelled', at: now.toISOString() });
    }
  }

  for (const code of await deps.games.findCodesToFinish(now, BATCH_LIMIT)) {
    const changed = await deps.uow.withGameLock(code, async (tx) => {
      const endsAt = tx.game.startsAt.getTime() + tx.game.durationMinutes * 60_000;
      if (!canTransition(tx.game.status, 'FINISHED') || endsAt > now.getTime()) {
        return false;
      }
      await tx.updateGame({ status: 'FINISHED' });
      // Зачёт посещения всем, кто остался в основном составе
      const attendees = (await tx.activeParticipants()).filter((p) => p.role === 'MAIN');
      for (const attendee of attendees) {
        await tx.bumpProfile(attendee.tokenHash, { attended: 1 });
      }
      await tx.audit('GAME_FINISHED', { attendees: attendees.length });
      return true;
    });
    if (changed) {
      finished += 1;
      deps.events.publish(code, { type: 'game_updated', at: now.toISOString() });
    }
  }

  return { cancelledNotEnough, finished };
}
