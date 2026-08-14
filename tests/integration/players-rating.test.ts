import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createGame } from '@/modules/game/application/create-game';
import { joinGame } from '@/modules/game/application/join-game';
import { PrismaProfileRepository } from '@/modules/profile/infrastructure/prisma-profile-repository';
import { unwrap } from '@/shared/lib/result';
import { createTestDeps, createTestPrisma, gameDraft, truncateAll } from './helpers';

/**
 * Рейтинг игроков считается сырым SQL — проверяем его на настоящей базе:
 * порядок по сумме «гол + пас», гости без кабинета в него не попадают,
 * а голы не размножают счётчик сыгранных матчей.
 */
let prisma: PrismaClient;
let deps: ReturnType<typeof createTestDeps>;
let profiles: PrismaProfileRepository;

beforeAll(async () => {
  prisma = createTestPrisma();
  await truncateAll(prisma);
  await prisma.$executeRawUnsafe('TRUNCATE "UserProfile", "ProfileDevice" CASCADE');
  deps = createTestDeps(prisma);
  profiles = new PrismaProfileRepository(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createProfile(tag: string, displayName: string) {
  return prisma.userProfile.create({
    data: { tag, displayName, loginCodeHash: `hash-${tag}` },
  });
}

describe('listPlayers — рейтинг по сумме голов и передач', () => {
  it('сортирует по «гол + пас», считает игры и не берёт гостей', async () => {
    const bomber = await createProfile('bomber', 'Бомбардир');
    const passer = await createProfile('passer', 'Ассистент');
    const quiet = await createProfile('quiet', 'Молчун');

    const { game } = unwrap(await createGame(deps, gameDraft({ maxPlayers: 10 })));

    const join = async (n: number, profileId: string | null) =>
      unwrap(
        await joinGame(deps, {
          gameCode: game.code,
          name: `Игрок ${n}`,
          nickname: `player${n}`,
          position: 'ANY',
          skillLevel: 'ANY',
          attendance: 'CONFIRMED',
          participantToken: `token-${n}`,
          profileId,
        }),
      ).participant;

    const bomberPart = await join(1, bomber.id);
    const passerPart = await join(2, passer.id);
    await join(3, quiet.id);
    const guestPart = await join(4, null);

    // Игра состоялась — только такие идут в счётчик матчей
    await prisma.game.update({ where: { id: game.id }, data: { status: 'FINISHED' } });

    const day = await prisma.matchDay.create({
      data: {
        gameId: game.id,
        teams: {
          create: [
            { name: 'Жёлтые', colorId: 'amber', order: 0 },
            { name: 'Зелёные', colorId: 'green', order: 1 },
          ],
        },
      },
      include: { teams: { orderBy: { order: 'asc' } } },
    });
    const [home, away] = day.teams;
    if (home === undefined || away === undefined) throw new Error('команды дня не созданы');

    const match = await prisma.dayMatch.create({
      data: {
        dayId: day.id,
        order: 1,
        status: 'FINISHED',
        homeTeamId: home.id,
        awayTeamId: away.id,
      },
    });

    // Три гола бомбардира: два с передачи ассистента, третий сам.
    // Суммы выходят разные (3 против 2) — порядок задаёт именно она,
    // а не алфавит, которым решаются равные строки.
    const withAssist = {
      matchId: match.id,
      teamId: home.id,
      scorerParticipantId: bomberPart.id,
      assistParticipantId: passerPart.id,
    };
    await prisma.dayGoal.createMany({
      data: [
        withAssist,
        withAssist,
        { matchId: match.id, teamId: home.id, scorerParticipantId: bomberPart.id },
        // Гол гостя без кабинета: в рейтинг попасть не должен
        { matchId: match.id, teamId: away.id, scorerParticipantId: guestPart.id },
      ],
    });

    const rating = await profiles.listPlayers(10);
    const byTag = new Map(rating.map((row) => [row.tag, row]));

    expect(rating.map((row) => row.tag)).toEqual(['bomber', 'passer', 'quiet']);
    expect(byTag.get('bomber')).toMatchObject({ goals: 3, assists: 0, played: 1 });
    expect(byTag.get('passer')).toMatchObject({ goals: 0, assists: 2, played: 1 });
    expect(byTag.get('quiet')).toMatchObject({ goals: 0, assists: 0, played: 1 });
    // Голы не размножили счётчик игр: у бомбардира их два, а матч один
    expect(byTag.get('bomber')?.played).toBe(1);
  });
});
