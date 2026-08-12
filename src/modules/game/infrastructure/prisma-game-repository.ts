import type { PrismaClient } from '@/generated/prisma/client';
import { boundingBox, haversineMeters } from '../domain/geo';
import type { GameEntity } from '../domain/types';
import {
  CodeCollisionError,
  type GameListFilters,
  type GameListPage,
  type GameListSort,
  type GameRepository,
  type NewGameRecord,
} from '../application/ports';
import { toGameEntity, toParticipantEntity } from './mappers';

function isUniqueViolationOn(error: unknown, fragment: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return false;
  return JSON.stringify(e.meta?.target ?? '').includes(fragment);
}

interface ListCursor {
  s: number; // startsAt (ms)
  id: string;
  f: number; // свободные слоты (для сортировки few_slots)
}

function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): ListCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const c = parsed as Partial<ListCursor>;
    if (typeof c.s !== 'number' || typeof c.id !== 'string' || typeof c.f !== 'number') {
      return null;
    }
    return { s: c.s, id: c.id, f: c.f };
  } catch {
    return null;
  }
}

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCode(code: string): Promise<GameEntity | null> {
    const row = await this.prisma.game.findUnique({ where: { code } });
    return row ? toGameEntity(row) : null;
  }

  async activeParticipants(gameId: string) {
    const rows = await this.prisma.participant.findMany({
      where: { gameId, leftAt: null },
      orderBy: [{ role: 'asc' }, { waitlistOrder: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map(toParticipantEntity);
  }

  async activeMainCount(gameId: string): Promise<number> {
    return this.prisma.participant.count({
      where: { gameId, leftAt: null, role: 'MAIN' },
    });
  }

  async create(record: NewGameRecord): Promise<GameEntity> {
    try {
      const row = await this.prisma.game.create({ data: record });
      return toGameEntity(row);
    } catch (error) {
      if (isUniqueViolationOn(error, 'code')) throw new CodeCollisionError();
      throw error;
    }
  }

  async countActiveByCreator(creatorTokenHash: string, now: Date): Promise<number> {
    return this.prisma.game.count({
      where: {
        creatorTokenHash,
        status: { in: ['OPEN', 'FULL'] },
        startsAt: { gt: now },
      },
    });
  }

  async findNearbyAt(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    startsAt: Date;
    windowMinutes: number;
  }): Promise<GameEntity | null> {
    const box = boundingBox(params.latitude, params.longitude, params.radiusMeters);
    const windowMs = params.windowMinutes * 60_000;
    const candidates = await this.prisma.game.findMany({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        startsAt: {
          gte: new Date(params.startsAt.getTime() - windowMs),
          lte: new Date(params.startsAt.getTime() + windowMs),
        },
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLon, lte: box.maxLon },
      },
      take: 10,
    });
    const hit = candidates.find(
      (g) =>
        haversineMeters(g.latitude, g.longitude, params.latitude, params.longitude) <=
        params.radiusMeters,
    );
    return hit ? toGameEntity(hit) : null;
  }

  async list(
    filters: GameListFilters,
    sort: GameListSort,
    cursor: string | null,
    limit: number,
  ): Promise<GameListPage> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const add = (fragment: (n: number) => string, value: unknown) => {
      params.push(value);
      conditions.push(fragment(params.length));
    };

    conditions.push(
      filters.hasFreeSlots ? `g."status"::text = 'OPEN'` : `g."status"::text IN ('OPEN', 'FULL')`,
    );
    if (filters.city) add((n) => `lower(g."city") = lower($${n})`, filters.city);
    if (filters.format) add((n) => `g."format"::text = $${n}`, filters.format);
    if (filters.skillLevel) add((n) => `g."skillLevel"::text = $${n}`, filters.skillLevel);
    if (filters.dateFrom) add((n) => `g."startsAt" >= $${n}`, filters.dateFrom);
    if (filters.dateTo) add((n) => `g."startsAt" <= $${n}`, filters.dateTo);

    const decoded = cursor ? decodeCursor(cursor) : null;
    let cursorCondition = '';
    if (decoded) {
      if (sort === 'soonest') {
        params.push(new Date(decoded.s), new Date(decoded.s), decoded.id);
        const n = params.length;
        cursorCondition = `AND ("startsAt" > $${n - 2} OR ("startsAt" = $${n - 1} AND id > $${n}))`;
      } else {
        params.push(
          decoded.f,
          decoded.f,
          new Date(decoded.s),
          decoded.f,
          new Date(decoded.s),
          decoded.id,
        );
        const n = params.length;
        cursorCondition = `AND (free > $${n - 5} OR (free = $${n - 4} AND "startsAt" > $${n - 3}) OR (free = $${n - 2} AND "startsAt" = $${n - 1} AND id > $${n}))`;
      }
    }

    const orderBy =
      sort === 'soonest' ? `"startsAt" ASC, id ASC` : `free ASC, "startsAt" ASC, id ASC`;

    params.push(limit + 1);
    const limitParam = params.length;

    const sql = `
      WITH games_filtered AS (
        SELECT g.id, g."startsAt", g."maxPlayers",
               (SELECT COUNT(*)::int FROM "Participant" p
                 WHERE p."gameId" = g.id AND p."leftAt" IS NULL AND p."role"::text = 'MAIN'
               ) AS main_count
        FROM "Game" g
        WHERE ${conditions.join(' AND ')}
      ),
      games_ranked AS (
        SELECT id, "startsAt", main_count, ("maxPlayers" - main_count) AS free
        FROM games_filtered
      )
      SELECT id, "startsAt", main_count, free
      FROM games_ranked
      WHERE TRUE ${cursorCondition}
      ORDER BY ${orderBy}
      LIMIT $${limitParam}
    `;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; startsAt: Date; main_count: number; free: number }>
    >(sql, ...params);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);

    const games = await this.prisma.game.findMany({ where: { id: { in: ids } } });
    const byId = new Map(games.map((g) => [g.id, g]));

    const items = page.flatMap((r) => {
      const game = byId.get(r.id);
      return game ? [{ game: toGameEntity(game), activeMainCount: r.main_count }] : [];
    });

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ s: last.startsAt.getTime(), id: last.id, f: last.free })
        : null;

    return { items, nextCursor };
  }

  async findCodesToCancel(now: Date, limit: number): Promise<string[]> {
    const rows = await this.prisma.game.findMany({
      where: { status: 'OPEN', cancelDeadline: { lt: now } },
      select: { code: true },
      take: limit,
    });
    return rows.map((r) => r.code);
  }

  async findCodesToFinish(now: Date, limit: number): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ code: string }>>(
      `SELECT code FROM "Game"
        WHERE "status"::text IN ('OPEN', 'FULL')
          AND "startsAt" + ("durationMinutes" * interval '1 minute') < $1
        LIMIT $2`,
      now,
      limit,
    );
    return rows.map((r) => r.code);
  }
}
