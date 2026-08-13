import type { TokenService } from './ports';

/** Данные авторизации организатора: токен-легаси и/или кабинет. */
export interface HostAuth {
  /** Секретный host-токен (легаси, старые игры). */
  hostToken: string | null;
  /** Кабинет зрителя (cookie): создатель игры управляет ею без токена. */
  viewerProfileId: string | null;
}

/**
 * Организатором считается владелец host-токена ИЛИ владелец кабинета,
 * с которого игра создана. Токен остаётся для старых игр и «передачи
 * руля» по ссылке; для новых основной путь — кабинет.
 */
export function isHostAuthorized(
  tokens: TokenService,
  game: { hostTokenHash: string; creatorProfileId: string | null },
  auth: HostAuth,
): boolean {
  if (auth.hostToken !== null && tokens.verify(auth.hostToken, game.hostTokenHash)) return true;
  return auth.viewerProfileId !== null && auth.viewerProfileId === game.creatorProfileId;
}
