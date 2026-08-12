import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { GameEntity } from '../domain/types';
import type {
  GamePatch,
  GameTx,
  NewParticipantRecord,
  ParticipantPatch,
  ProfileDelta,
  UnitOfWork,
} from '../application/ports';
import { toGameEntity, toParticipantEntity } from './mappers';

type Tx = Prisma.TransactionClient;

class PrismaGameTx implements GameTx {
  constructor(
    private readonly tx: Tx,
    public game: GameEntity,
  ) {}

  async activeMainCount(): Promise<number> {
    return this.tx.participant.count({
      where: { gameId: this.game.id, leftAt: null, role: 'MAIN' },
    });
  }

  async maxWaitlistOrder(): Promise<number | null> {
    const agg = await this.tx.participant.aggregate({
      where: { gameId: this.game.id, leftAt: null, role: 'WAITLIST' },
      _max: { waitlistOrder: true },
    });
    return agg._max.waitlistOrder;
  }

  async activeParticipants() {
    const rows = await this.tx.participant.findMany({
      where: { gameId: this.game.id, leftAt: null },
      orderBy: [{ role: 'asc' }, { waitlistOrder: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map(toParticipantEntity);
  }

  async findParticipantByToken(tokenHash: string) {
    const row = await this.tx.participant.findFirst({
      where: { gameId: this.game.id, tokenHash },
      orderBy: { joinedAt: 'desc' },
    });
    return row ? toParticipantEntity(row) : null;
  }

  async findParticipantByNickname(nickname: string) {
    const row = await this.tx.participant.findUnique({
      where: { gameId_nickname: { gameId: this.game.id, nickname } },
    });
    return row ? toParticipantEntity(row) : null;
  }

  async insertParticipant(record: NewParticipantRecord) {
    const row = await this.tx.participant.create({
      data: { ...record, gameId: this.game.id },
    });
    return toParticipantEntity(row);
  }

  async updateParticipant(id: string, patch: ParticipantPatch) {
    const row = await this.tx.participant.update({ where: { id }, data: patch });
    return toParticipantEntity(row);
  }

  async firstWaitlisted() {
    const row = await this.tx.participant.findFirst({
      where: { gameId: this.game.id, leftAt: null, role: 'WAITLIST' },
      orderBy: { waitlistOrder: 'asc' },
    });
    return row ? toParticipantEntity(row) : null;
  }

  async updateGame(patch: GamePatch): Promise<GameEntity> {
    const { teamsSnapshot, ...rest } = patch;
    const row = await this.tx.game.update({
      where: { id: this.game.id },
      data: {
        ...rest,
        ...(teamsSnapshot !== undefined
          ? { teamsSnapshot: JSON.parse(JSON.stringify(teamsSnapshot)) }
          : {}),
      },
    });
    this.game = toGameEntity(row);
    return this.game;
  }

  async bumpProfile(tokenHash: string, delta: ProfileDelta): Promise<void> {
    await this.tx.participantProfile.upsert({
      where: { tokenHash },
      create: {
        tokenHash,
        gamesJoined: delta.joined ?? 0,
        gamesAttended: delta.attended ?? 0,
        lateCancels: delta.lateCancels ?? 0,
      },
      update: {
        ...(delta.joined ? { gamesJoined: { increment: delta.joined } } : {}),
        ...(delta.attended ? { gamesAttended: { increment: delta.attended } } : {}),
        ...(delta.lateCancels ? { lateCancels: { increment: delta.lateCancels } } : {}),
      },
    });
  }

  async audit(action: string, payload: Record<string, unknown>): Promise<void> {
    await this.tx.auditLog.create({
      data: {
        gameId: this.game.id,
        action,
        payload: JSON.parse(JSON.stringify(payload)),
      },
    });
  }
}

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async withGameLock<T>(gameCode: string, fn: (tx: GameTx) => Promise<T>): Promise<T | null> {
    return this.prisma.$transaction(
      async (tx) => {
        // Пессимистичная блокировка строки игры: параллельные join/leave
        // сериализуются и не могут превысить maxPlayers (см. docs/ADR/0004).
        const locked = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM "Game" WHERE code = ${gameCode} FOR UPDATE`;
        if (locked.length === 0) return null;

        const row = await tx.game.findUnique({ where: { code: gameCode } });
        if (!row) return null;

        return fn(new PrismaGameTx(tx, toGameEntity(row)));
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  }
}
