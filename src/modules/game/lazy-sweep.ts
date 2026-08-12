import { logger } from '@/shared/lib/logger';
import { closeExpiredGames } from './application/close-expired-games';
import { getGameDeps } from './composition';

const SWEEP_INTERVAL_MS = 60_000;

const globalForSweep = globalThis as unknown as { kickoffLastSweep?: number };

/**
 * Lazy-sweep: дешёвая фоновая уборка при чтении ленты/игры (не чаще раза
 * в минуту на инстанс). Делает внешний cron некритичным — просроченные
 * игры закрываются даже если cron не настроен. Fire-and-forget.
 */
export function lazySweep(): void {
  const last = globalForSweep.kickoffLastSweep ?? 0;
  const now = Date.now();
  if (now - last < SWEEP_INTERVAL_MS) return;
  globalForSweep.kickoffLastSweep = now;

  closeExpiredGames(getGameDeps())
    .then((result) => {
      if (result.cancelledNotEnough > 0 || result.finished > 0) {
        logger.info(result, 'lazy-sweep: закрыты просроченные игры');
      }
    })
    .catch((error) => {
      logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        'lazy-sweep failed',
      );
    });
}
