'use client';

import { useSyncExternalStore } from 'react';
import { getHostToken } from '@/shared/lib/host-tokens';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * Host-токен игры из localStorage. На сервере и до гидратации — null,
 * на клиенте — актуальное значение (строки сравниваются по значению,
 * так что стабильный снапшот гарантирован).
 */
export function useHostToken(gameCode: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getHostToken(gameCode),
    () => null,
  );
}
