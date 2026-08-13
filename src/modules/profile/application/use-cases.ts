import { err, ok, type Result } from '@/shared/lib/result';
import type { Gender, ProfileEntity, ProfileSkillLevel } from '../domain/types';
import { profileError, type ProfileError } from './errors';
import type { ProfileRepository, TokenService } from './ports';

/**
 * Use-cases кабинета. Кабинет без пароля: устройство идентифицируется
 * анонимным cookie, вход с нового устройства — по личному коду. Код
 * показывается один раз, в БД хранится только его хеш.
 */

export interface ProfileDeps {
  profiles: ProfileRepository;
  tokens: TokenService;
}

export interface ProfileInput {
  displayName: string;
  tag: string;
  age: number | null;
  gender: Gender | null;
  countryCode: string | null;
  club: string | null;
  skillLevel: ProfileSkillLevel;
}

export interface CreatedProfile {
  profile: ProfileEntity;
  /** Личный код для входа с других устройств — показать один раз. */
  loginCode: string;
}

export async function createProfile(
  deps: ProfileDeps,
  input: ProfileInput & { deviceTokenHash: string },
): Promise<Result<CreatedProfile, ProfileError>> {
  const existing = await deps.profiles.findByDeviceHash(input.deviceTokenHash);
  if (existing !== null) {
    return err(profileError('PROFILE_EXISTS', 'У этого устройства уже есть профиль'));
  }
  if (await deps.profiles.isTagTaken(input.tag)) {
    return err(profileError('TAG_TAKEN', 'Этот тег уже занят'));
  }

  const loginCode = deps.tokens.generate();
  const profile = await deps.profiles.create({
    tag: input.tag,
    displayName: input.displayName,
    age: input.age,
    gender: input.gender,
    countryCode: input.countryCode,
    club: input.club,
    skillLevel: input.skillLevel,
    loginCodeHash: deps.tokens.hash(loginCode),
    deviceTokenHash: input.deviceTokenHash,
  });
  return ok({ profile, loginCode });
}

export async function updateProfile(
  deps: ProfileDeps,
  input: ProfileInput & { deviceTokenHash: string },
): Promise<Result<ProfileEntity, ProfileError>> {
  const profile = await deps.profiles.findByDeviceHash(input.deviceTokenHash);
  if (profile === null) {
    return err(profileError('PROFILE_NOT_FOUND', 'Профиль не найден'));
  }
  if (input.tag !== profile.tag && (await deps.profiles.isTagTaken(input.tag))) {
    return err(profileError('TAG_TAKEN', 'Этот тег уже занят'));
  }
  const updated = await deps.profiles.update(profile.id, {
    tag: input.tag,
    displayName: input.displayName,
    age: input.age,
    gender: input.gender,
    countryCode: input.countryCode,
    club: input.club,
    skillLevel: input.skillLevel,
  });
  return ok(updated);
}

/** Вход по коду: привязывает текущее устройство к найденному профилю. */
export async function loginByCode(
  deps: ProfileDeps,
  input: { code: string; deviceTokenHash: string },
): Promise<Result<ProfileEntity, ProfileError>> {
  const profile = await deps.profiles.findByLoginCodeHash(deps.tokens.hash(input.code.trim()));
  if (profile === null) {
    return err(profileError('BAD_LOGIN_CODE', 'Код не подошёл. Проверьте и попробуйте ещё раз.'));
  }
  await deps.profiles.attachDevice(profile.id, input.deviceTokenHash);
  return ok(profile);
}

/** Перевыпуск личного кода: старый перестаёт действовать сразу. */
export async function rotateLoginCode(
  deps: ProfileDeps,
  input: { deviceTokenHash: string },
): Promise<Result<CreatedProfile, ProfileError>> {
  const profile = await deps.profiles.findByDeviceHash(input.deviceTokenHash);
  if (profile === null) {
    return err(profileError('PROFILE_NOT_FOUND', 'Профиль не найден'));
  }
  const loginCode = deps.tokens.generate();
  const updated = await deps.profiles.update(profile.id, {
    loginCodeHash: deps.tokens.hash(loginCode),
  });
  return ok({ profile: updated, loginCode });
}
