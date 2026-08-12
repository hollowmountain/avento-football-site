import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createGame } from '@/modules/game/application/create-game';
import { joinGame } from '@/modules/game/application/join-game';
import { unwrap } from '@/shared/lib/result';
import { createTestDeps, createTestPrisma, gameDraft, truncateAll } from './helpers';

let prisma: PrismaClient;
let deps: ReturnType<typeof createTestDeps>;

beforeAll(async () => {
  // Пул из 20 соединений — 10 конкурентных join реально идут параллельно
  prisma = createTestPrisma(20);
  await truncateAll(prisma);
  deps = createTestDeps(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('гонка за последнее место', () => {
  it('10 параллельных join на 1 свободное место не превышают maxPlayers', async () => {
    const { game } = unwrap(await createGame(deps, gameDraft({ maxPlayers: 4 })));

    // Занимаем 3 из 4 мест
    for (let n = 1; n <= 3; n += 1) {
      unwrap(
        await joinGame(deps, {
          gameCode: game.code,
          name: `Базовый ${n}`,
          nickname: `base${n}`,
          position: 'ANY',
          skillLevel: 'ANY',
          attendance: 'CONFIRMED',
          participantToken: `base-token-${n}`,
        }),
      );
    }

    // 10 претендентов на последнее место — строго одновременно
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        joinGame(deps, {
          gameCode: game.code,
          name: `Гонщик ${i}`,
          nickname: `racer${i}`,
          position: 'ANY',
          skillLevel: 'ANY',
          attendance: 'CONFIRMED',
          participantToken: `race-token-${i}`,
        }),
      ),
    );

    const successes = results.filter((r) => r.ok);
    expect(successes).toHaveLength(10); // никто не упал — все либо MAIN, либо WAITLIST

    const participants = await deps.games.activeParticipants(game.id);
    const main = participants.filter((p) => p.role === 'MAIN');
    const waitlist = participants.filter((p) => p.role === 'WAITLIST');

    // Ровно maxPlayers в основе: 3 базовых + 1 победитель гонки
    expect(main).toHaveLength(4);
    expect(main.filter((p) => p.nickname.startsWith('racer'))).toHaveLength(1);

    // Остальные 9 — в очереди с уникальными последовательными номерами
    expect(waitlist).toHaveLength(9);
    const orders = waitlist.map((p) => p.waitlistOrder).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    expect((await deps.games.findByCode(game.code))?.status).toBe('FULL');
  });
});
