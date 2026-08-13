import { getProfileDeps } from './composition';
import type { ProfileEntity } from './domain/types';

/**
 * Профиль по анонимному device-токену (cookie kickoff_pid), plain.
 * Серверный helper для роутов и SSR: null — гость без кабинета.
 */
export async function profileByDeviceToken(token: string | null): Promise<ProfileEntity | null> {
  if (token === null) return null;
  const deps = getProfileDeps();
  return deps.profiles.findByDeviceHash(deps.tokens.hash(token));
}
