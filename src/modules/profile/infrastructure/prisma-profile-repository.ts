import type { PrismaClient, UserProfile } from '@/generated/prisma/client';
import type { ProfileEntity } from '../domain/types';
import type { NewProfileRecord, ProfilePatch, ProfileRepository } from '../application/ports';

function toEntity(row: UserProfile): ProfileEntity {
  return {
    id: row.id,
    tag: row.tag,
    displayName: row.displayName,
    age: row.age,
    gender: row.gender,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

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
