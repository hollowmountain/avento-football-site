import type { Gender, ProfileEntity } from '../domain/types';

/** Порты модуля profile: интерфейсы, реализуемые infrastructure. */

export interface NewProfileRecord {
  tag: string;
  displayName: string;
  age: number | null;
  gender: Gender | null;
  countryCode: string | null;
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
  loginCodeHash?: string;
}

export interface ProfileRepository {
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
