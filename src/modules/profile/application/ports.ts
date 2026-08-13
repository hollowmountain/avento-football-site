import type { Gender, ProfileEntity, ProfileSkillLevel } from '../domain/types';

/** Порты модуля profile: интерфейсы, реализуемые infrastructure. */

export interface NewProfileRecord {
  tag: string;
  displayName: string;
  age: number | null;
  gender: Gender | null;
  countryCode: string | null;
  club: string | null;
  skillLevel: ProfileSkillLevel;
  loginCodeHash: string;
  /** Хеш анонимного cookie первого устройства. */
  deviceTokenHash: string;
}

export interface ProfilePatch {
  tag?: string;
  displayName?: string;
  age?: number | null;
  gender?: Gender | null;
  countryCode?: string | null;
  club?: string | null;
  skillLevel?: ProfileSkillLevel;
  loginCodeHash?: string;
}

/** Строка каталога игроков. */
export interface PlayerListItem {
  id: string;
  tag: string;
  displayName: string;
  countryCode: string | null;
  club: string | null;
  skillLevel: ProfileSkillLevel;
  /** Сколько состоявшихся игр за плечами. */
  played: number;
}

export interface ProfileRepository {
  /** Каталог игроков: сначала те, кто больше сыграл, затем по алфавиту. */
  listPlayers(limit: number): Promise<PlayerListItem[]>;
  findByDeviceHash(tokenHash: string): Promise<ProfileEntity | null>;
  findByLoginCodeHash(codeHash: string): Promise<ProfileEntity | null>;
  isTagTaken(tag: string): Promise<boolean>;
  /** Создание профиля вместе с первым устройством (одна транзакция). */
  create(record: NewProfileRecord): Promise<ProfileEntity>;
  update(profileId: string, patch: ProfilePatch): Promise<ProfileEntity>;
  attachDevice(profileId: string, tokenHash: string): Promise<void>;
  countDevices(profileId: string): Promise<number>;
}

export interface TokenService {
  generate(): string;
  hash(token: string): string;
}
