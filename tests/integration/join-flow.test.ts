import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createGame } from '@/modules/game/application/create-game';
import { joinGame } from '@/modules/game/application/join-game';
import { leaveGame } from '@/modules/game/application/leave-game';
import { unwrap } from '@/shared/lib/result';
import { createTestDeps, createTestPrisma, gameDraft, truncateAll } from './helpers';

let prisma: PrismaClient;
let deps: ReturnType<typeof createTestDeps>;

beforeAll(async () => {
  prisma = createTestPrisma();
  await truncateAll(prisma);
  deps = createTestDeps(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function joinInput(gameCode: string, n: number) {
  return {
    gameCode,
    name: `Игрок ${n}`,
    nickname: `player${n}`,
    position: 'ANY' as const,
    skillLevel: 'ANY' as const,
    attendance: 'CONFIRMED' as const,
    participantToken: `token-player-${n}`,
  };
}

describe('create → join → waitlist → leave → промоушен', () => {
  it('полный happy path', async () => {
    const { game } = unwrap(await createGame(deps, gameDraft({ maxPlayers: 4 })));
    expect(game.code).toMatch(/^AVA-/);
    expect(game.status).toBe('OPEN');

    // Заполняем основной состав
    for (let n = 1; n <= 3; n += 1) {
      const { participant } = unwrap(await joinGame(deps, joinInput(game.code, n)));
      expect(participant.role).toBe('MAIN');
    }
    // Четвёртый занимает последнее место — игра становится FULL
    unwrap(await joinGame(deps, joinInput(game.code, 4)));
    const fullGame = await deps.games.findByCode(game.code);
    expect(fullGame?.status).toBe('FULL');

    // Пятый и шестой — в лист ожидания по порядку
    const fifth = unwrap(await joinGame(deps, joinInput(game.code, 5)));
    expect(fifth.participant.role).toBe('WAITLIST');
    expect(fifth.participant.waitlistOrder).toBe(1);
    const sixth = unwrap(await joinGame(deps, joinInput(game.code, 6)));
    expect(sixth.participant.waitlistOrder).toBe(2);

    // Игрок 2 отказывается — первый из очереди поднимается в основу
    const left = unwrap(
      await leaveGame(deps, { gameCode: game.code, participantToken: 'token-player-2' }),
    );
    expect(left.promotedNickname).toBe('player5');

    const participants = await deps.games.activeParticipants(game.id);
    const main = participants.filter((p) => p.role === 'MAIN');
    const waitlist = participants.filter((p) => p.role === 'WAITLIST');
    expect(main.map((p) => p.nickname).sort()).toEqual(
      ['player1', 'player3', 'player4', 'player5'].sort(),
    );
    expect(waitlist.map((p) => p.nickname)).toEqual(['player6']);

    // Состав снова полон — статус остаётся FULL
    expect((await deps.games.findByCode(game.code))?.status).toBe('FULL');

    // Уходит игрок 6 (из waitlist) и игрок 1 (из основы, очередь пуста) → OPEN
    unwrap(await leaveGame(deps, { gameCode: game.code, participantToken: 'token-player-6' }));
    unwrap(await leaveGame(deps, { gameCode: game.code, participantToken: 'token-player-1' }));
    expect((await deps.games.findByCode(game.code))?.status).toBe('OPEN');

    // Live-события публиковались
    expect(deps.bus.published.filter((e) => e.gameCode === game.code).length).toBeGreaterThan(5);
  });

  it('никнейм занят другим участником', async () => {
    const { game } = unwrap(await createGame(deps, gameDraft()));
    unwrap(await joinGame(deps, joinInput(game.code, 1)));
    const dup = await joinGame(deps, {
      ...joinInput(game.code, 2),
      nickname: 'player1',
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('NICKNAME_TAKEN');
  });

  it('повторный join тем же токеном отклоняется', async () => {
    const { game } = unwrap(await createGame(deps, gameDraft()));
    unwrap(await joinGame(deps, joinInput(game.code, 1)));
    const again = await joinGame(deps, joinInput(game.code, 1));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('ALREADY_JOINED');
  });

  it('возвращение после отказа оживляет запись', async () => {
    const { game } = unwrap(await createGame(deps, gameDraft()));
    const input = { ...joinInput(game.code, 1), participantToken: 'rejoin-token' };
    unwrap(await joinGame(deps, input));
    unwrap(await leaveGame(deps, { gameCode: game.code, participantToken: 'rejoin-token' }));
    const rejoined = unwrap(await joinGame(deps, input));
    expect(rejoined.participant.leftAt).toBeNull();
    expect(rejoined.participant.role).toBe('MAIN');

    // Профиль не задвоился: joined засчитан один раз
    const profile = await prisma.participantProfile.findUnique({
      where: { tokenHash: deps.tokens.hash('rejoin-token') },
    });
    expect(profile?.gamesJoined).toBe(1);
  });

  it('поздний отказ помечается и попадает в reliability-профиль', async () => {
    // Старт через 2 часа → любой отказ уже «менее чем за 3 часа»
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { game } = unwrap(
      await createGame(
        deps,
        gameDraft({ startsAt, cancelDeadline: new Date(startsAt.getTime() - 90 * 60 * 1000) }),
      ),
    );
    unwrap(await joinGame(deps, { ...joinInput(game.code, 7), participantToken: 'late-token' }));
    const left = unwrap(
      await leaveGame(deps, { gameCode: game.code, participantToken: 'late-token' }),
    );
    expect(left.wasLateCancel).toBe(true);

    const profile = await prisma.participantProfile.findUnique({
      where: { tokenHash: deps.tokens.hash('late-token') },
    });
    expect(profile?.lateCancels).toBe(1);
  });

  it('несуществующая игра — GAME_NOT_FOUND', async () => {
    const result = await joinGame(deps, joinInput('AVA-ZZZZ', 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('GAME_NOT_FOUND');
  });
});

describe('лимиты создания', () => {
  it('не больше N активных игр на организатора', async () => {
    const creatorToken = 'creator-limit-token';
    unwrap(await createGame(deps, gameDraft({ creatorToken })));
    unwrap(await createGame(deps, gameDraft({ creatorToken })));
    const third = await createGame(deps, gameDraft({ creatorToken }));
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error.code).toBe('HOST_GAME_LIMIT');
  });

  it('дубль по месту и времени отклоняется', async () => {
    const draft = gameDraft();
    unwrap(await createGame(deps, draft));
    const dup = await createGame(deps, {
      ...gameDraft(),
      latitude: draft.latitude + 0.0005, // ~55 м
      longitude: draft.longitude,
      startsAt: new Date(draft.startsAt.getTime() + 30 * 60 * 1000),
      cancelDeadline: new Date(draft.startsAt.getTime() - 60 * 60 * 1000),
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('DUPLICATE_GAME');
  });
});
