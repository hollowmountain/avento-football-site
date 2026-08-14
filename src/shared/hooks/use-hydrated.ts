'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * false на сервере и в первом клиентском рендере, true после гидратации.
 * Нужно всему, что зависит от текущего времени: разметка сервера и
 * клиента обязана совпасть, а секунды к этому моменту уже разошлись.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
