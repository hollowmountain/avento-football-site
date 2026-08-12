import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { EventBus, GameEvent } from '@/modules/game/application/ports';
import type { CreateGameInput } from '@/modules/game/application/create-game';
import type { GameModuleDeps } from '@/modules/game/composition';
import { PrismaGameRepository } from '@/modules/game/infrastructure/prisma-game-repository';
import { PrismaUnitOfWork } from '@/modules/game/infrastructure/prisma-unit-of-work';
import { generateGameCode } from '@/shared/security/game-code';
import { createTokenService } from '@/shared/security/tokens';

export function createTestPrisma(poolMax = 20): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL не задан');
  // Пул шире числа параллельных запросов в тесте гонки —
  // иначе пул сериализует запросы и тест ничего не проверяет.
  const adapter = new PrismaPg({ connectionString: url, max: poolMax });
  return new PrismaClient({ adapter });
}

/** Записывающая шина событий для ассертов. */
export class RecordingEventBus implements EventBus {
  readonly published: Array<{ gameCode: string; event: GameEvent }> = [];

  publish(gameCode: string, event: GameEvent): void {
    this.published.push({ gameCode, event });
  }

  subscribe(): () => void {
    return () => undefined;
  }
}

export function createTestDeps(
  prisma: PrismaClient,
  now?: () => Date,
): GameModuleDeps & { bus: RecordingEventBus } {
  const bus = new RecordingEventBus();
  return {
    games: new PrismaGameRepository(prisma),
    uow: new PrismaUnitOfWork(prisma),
    tokens: createTokenService('integration-pepper-0123456789'),
    codes: { nextCode: generateGameCode },
    clock: { now: now ?? (() => new Date()) },
    events: bus,
    bus,
    config: {
      maxActiveGamesPerHost: 2,
      dedupRadiusMeters: 150,
      dedupWindowMinutes: 60,
    },
  };
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Game", "Participant", "ParticipantProfile", "RateLimitEvent", "AuditLog", "WeatherCache" CASCADE',
  );
}

export function gameDraft(overrides: Partial<CreateGameInput> = {}): CreateGameInput {
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return {
    title: 'Вечерний футбол',
    description: 'Тестовая игра',
    format: 'FIVE_A_SIDE',
    skillLevel: 'ANY',
    startsAt,
    durationMinutes: 90,
    timezone: 'Europe/Moscow',
    minPlayers: 2,
    maxPlayers: 4,
    pricePerPitch: 400_000,
    currency: 'RUB',
    cancelDeadline: new Date(startsAt.getTime() - 6 * 60 * 60 * 1000),
    venueName: 'Манеж',
    address: 'ул. Тестовая, 1',
    latitude: 55.751 + Math.random() * 0.5, // разные точки — не задевать дедуп
    longitude: 37.618 + Math.random() * 0.5,
    city: 'Москва',
    hostName: 'Организатор',
    creatorToken: null,
    createdIpHash: 'ip-hash-test',
    ...overrides,
  };
}
