/**
 * Секретные токены управления играми — в localStorage браузера организатора
 * (плюс показываются один раз при создании для переноса на другое устройство).
 */
const STORAGE_KEY = 'kickoff_host_tokens';

function readAll(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveHostToken(gameCode: string, token: string): void {
  if (typeof window === 'undefined') return;
  const all = readAll();
  all[gameCode] = token;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage недоступен (private mode) — токен показан пользователю, не критично
  }
}

export function getHostToken(gameCode: string): string | null {
  return readAll()[gameCode] ?? null;
}
