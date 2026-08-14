import type { PrismaClient, UserProfile } from '@/generated/prisma/client';
import type { ProfileEntity, ProfileSkillLevel } from '../domain/types';
import type {
  NewProfileRecord,
  PlayerListItem,
  ProfilePatch,
  ProfileRepository,
} from '../application/ports';

function toEntity(row: UserProfile): ProfileEntity {
  return {
    id: row.id,
    tag: row.tag,
    displayName: row.displayName,
    age: row.age,
    gender: row.gender,
    countryCode: row.countryCode,
    club: row.club,
    skillLevel: row.skillLevel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listPlayers(limit: number): Promise<PlayerListItem[]> {
    // Одним запросом: и игры, и голы с передачами считает СУБД, а не память.
    // Гости без кабинета в рейтинг не попадают — всё сводится по profileId.
    // Голы и передачи агрегируются отдельными CTE: join голов к составу
    // размножил бы строки и испортил счёт сыгранных матчей.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tag: string;
        displayName: string;
        countryCode: string | null;
        club: string | null;
        skillLevel: ProfileSkillLevel;
        played: number;
        goals: number;
        assists: number;
      }>
    >`
      WITH scored AS (
        SELECT pt."profileId" AS profile_id, COUNT(*)::int AS goals
        FROM "DayGoal" dg
        JOIN "Participant" pt ON pt.id = dg."scorerParticipantId"
        WHERE pt."profileId" IS NOT NULL
        GROUP BY pt."profileId"
      ),
      assisted AS (
        SELECT pt."profileId" AS profile_id, COUNT(*)::int AS assists
        FROM "DayGoal" dg
        JOIN "Participant" pt ON pt.id = dg."assistParticipantId"
        WHERE pt."profileId" IS NOT NULL
        GROUP BY pt."profileId"
      ),
      base AS (
        SELECT p.id, p.tag, p."displayName", p."countryCode", p.club, p."skillLevel",
               COUNT(pt.id) FILTER (WHERE g."status"::text = 'FINISHED')::int AS played
        FROM "UserProfile" p
        LEFT JOIN "Participant" pt ON pt."profileId" = p.id AND pt."leftAt" IS NULL
        LEFT JOIN "Game" g ON g.id = pt."gameId"
        GROUP BY p.id
      )
      SELECT base.id, base.tag, base."displayName", base."countryCode", base.club,
             base."skillLevel", base.played,
             COALESCE(scored.goals, 0) AS goals,
             COALESCE(assisted.assists, 0) AS assists
      FROM base
      LEFT JOIN scored ON scored.profile_id = base.id
      LEFT JOIN assisted ON assisted.profile_id = base.id
      ORDER BY (COALESCE(scored.goals, 0) + COALESCE(assisted.assists, 0)) DESC,
               base.played DESC,
               lower(base."displayName") ASC
      LIMIT ${limit}
    `;
    return rows;
  }

  async findByDeviceHash(tokenHash: string): Promise<ProfileEntity | null> {
    const device = await this.prisma.profileDevice.findUnique({
      where: { tokenHash },
      include: { profile: true },
    });
    return device === null ? null : toEntity(device.profile);
  }

  async findByLoginCodeHash(codeHash: string): Promise<ProfileEntity | null> {
    const row = await this.prisma.userProfile.findUnique({ where: { loginCodeHash: codeHash } });
    return row === null ? null : toEntity(row);
  }

  async isTagTaken(tag: string): Promise<boolean> {
    const row = await this.prisma.userProfile.findUnique({
      where: { tag },
      select: { id: true },
    });
    return row !== null;
  }

  async create(record: NewProfileRecord): Promise<ProfileEntity> {
    const row = await this.prisma.userProfile.create({
      data: {
        tag: record.tag,
        displayName: record.displayName,
        age: record.age,
        gender: record.gender,
        countryCode: record.countryCode,
        club: record.club,
        skillLevel: record.skillLevel,
        loginCodeHash: record.loginCodeHash,
        devices: { create: { tokenHash: record.deviceTokenHash } },
      },
    });
    return toEntity(row);
  }

  async update(profileId: string, patch: ProfilePatch): Promise<ProfileEntity> {
    const row = await this.prisma.userProfile.update({ where: { id: profileId }, data: patch });
    return toEntity(row);
  }

  async attachDevice(profileId: string, tokenHash: string): Promise<void> {
    // Устройство могло быть привязано к другому профилю — перепривязываем
    await this.prisma.profileDevice.upsert({
      where: { tokenHash },
      create: { tokenHash, profileId },
      update: { profileId },
    });
  }

  async countDevices(profileId: string): Promise<number> {
    return this.prisma.profileDevice.count({ where: { profileId } });
  }
}
