import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { createGame } from '@/modules/game/application/create-game';
import { joinGame } from '@/modules/game/application/join-game';
import { shuffleTeams } from '@/modules/game/application/shuffle-teams';
import { updateGame } from '@/modules/game/application/update-game';
import { unwrap } from '@/shared/lib/result';
import { createTestDeps, createTestPrisma, gameDraft, truncateAll } from './helpers';

/**
 * Правка игры: жеребьёвка привязана к числу команд, и при его смене
 * старый расклад должен исчезать — иначе на странице «сбора» остаются
 * висеть составы прошлых команд.
 */
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

async function gameWithTeams() {
  const created = unwrap(await createGame(deps, gameDraft({ maxPlayers: 6, teamCount: 2 })));
  for (let n = 1; n <= 4; n += 1) {
    unwrap(
      await joinGame(deps, {
        gameCode: created.game.code,
        name: `Игрок ${n}`,
        nickname: `p${n}-${created.game.code}`,
        position: 'ANY',
        skillLevel: 'ANY',
        attendance: 'CONFIRMED',
        participantToken: `token-${created.game.code}-${n}`,
        profileId: null,
      }),
    );
  }
  unwrap(
    await shuffleTeams(deps, {
      gameCode: created.game.code,
      hostToken: created.hostToken,
      viewerProfileId: null,
      seed: 42,
    }),
  );
  const withTeams = await deps.games.findByCode(created.game.code);
  expect(withTeams?.teamsSnapshot).not.toBeNull();
  return created;
}

describe('updateGame и жеребьёвка', () => {
  it('перевод игры в «сбор» убирает составы команд', async () => {
    const created = await gameWithTeams();

    unwrap(
      await updateGame(deps, {
        gameCode: created.game.code,
        hostToken: created.hostToken,
        viewerProfileId: null,
        patch: { teamCount: 1 },
      }),
    );

    const game = await deps.games.findByCode(created.game.code);
    expect(game?.teamCount).toBe(1);
    expect(game?.teamsSnapshot).toBeNull();
  });

  it('смена числа команд на 3 тоже сбрасывает старый расклад', async () => {
    const created = await gameWithTeams();

    unwrap(
      await updateGame(deps, {
        gameCode: created.game.code,
        hostToken: created.hostToken,
        viewerProfileId: null,
        patch: { teamCount: 3 },
      }),
    );

    const game = await deps.games.findByCode(created.game.code);
    expect(game?.teamsSnapshot).toBeNull();
  });

  it('правка без числа команд жеребьёвку не трогает', async () => {
    const created = await gameWithTeams();

    unwrap(
      await updateGame(deps, {
        gameCode: created.game.code,
        hostToken: created.hostToken,
        viewerProfileId: null,
        patch: { title: 'Новое название' },
      }),
    );

    const game = await deps.games.findByCode(created.game.code);
    expect(game?.title).toBe('Новое название');
    expect(game?.teamsSnapshot).not.toBeNull();
  });
});
