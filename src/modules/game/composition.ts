import { prisma } from '@/shared/lib/db';
import { env } from '@/shared/lib/env';
import { generateGameCode } from '@/shared/security/game-code';
import { createTokenService } from '@/shared/security/tokens';
import type {
  Clock,
  EventBus,
  GameCodeGenerator,
  GameRepository,
  TokenService,
  UnitOfWork,
} from './application/ports';
import type { MatchDayRepository } from './application/matchday-ports';
import { getEventBus } from './infrastructure/event-bus';
import { PrismaGameRepository } from './infrastructure/prisma-game-repository';
import { PrismaMatchDayRepository } from './infrastructure/prisma-matchday-repository';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work';

/**
 * Composition root модуля game: единственное место, где use-cases
 * связываются с конкретными адаптерами (Prisma, crypto, EventEmitter).
 */
export interface GameModuleDeps {
  games: GameRepository;
  days: MatchDayRepository;
  uow: UnitOfWork;
  tokens: TokenService;
  codes: GameCodeGenerator;
  clock: Clock;
  events: EventBus;
  config: {
    maxActiveGamesPerHost: number;
    dedupRadiusMeters: number;
    dedupWindowMinutes: number;
  };
}

const globalForDeps = globalThis as unknown as { kickoffGameDeps?: GameModuleDeps };

export function getGameDeps(): GameModuleDeps {
  if (!globalForDeps.kickoffGameDeps) {
    globalForDeps.kickoffGameDeps = {
      games: new PrismaGameRepository(prisma),
      days: new PrismaMatchDayRepository(prisma),
      uow: new PrismaUnitOfWork(prisma),
      tokens: createTokenService(env.TOKEN_PEPPER),
      codes: { nextCode: generateGameCode },
      clock: { now: () => new Date() },
      events: getEventBus(),
      config: {
        maxActiveGamesPerHost: env.RATE_MAX_ACTIVE_GAMES_PER_HOST,
        dedupRadiusMeters: env.DEDUP_RADIUS_METERS,
        dedupWindowMinutes: env.DEDUP_WINDOW_MINUTES,
      },
    };
  }
  return globalForDeps.kickoffGameDeps;
}
