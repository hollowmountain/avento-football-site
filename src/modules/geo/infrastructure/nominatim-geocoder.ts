import { logger } from '@/shared/lib/logger';
import type { Coordinates, Geocoder } from '../application/ports';

interface NominatimHit {
  lat?: string;
  lon?: string;
}

interface CacheEntry {
  value: Coordinates | null;
  at: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
/** Правила Nominatim: не чаще одного запроса в секунду и осмысленный User-Agent. */
const MIN_INTERVAL_MS = 1100;

/**
 * Геокодер на OpenStreetMap Nominatim: бесплатно и без ключа.
 * Результаты кэшируются в памяти процесса (политика сервиса требует кэширования),
 * запросы сериализуются с паузой, чтобы не превышать лимит.
 */
export function createNominatimGeocoder(appUrl: string): Geocoder {
  const cache = new Map<string, CacheEntry>();
  let lastRequestAt = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const fetchOne = async (query: string): Promise<Coordinates | null> => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();

    const url =
      'https://nominatim.openstreetmap.org/search' +
      `?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&accept-language=ru`;

    const response = await fetch(url, {
      headers: {
        // Nominatim требует идентифицировать приложение
        'User-Agent': `Kickoff pickup football (${appUrl})`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const hits = (await response.json()) as NominatimHit[];
    const hit = hits[0];
    if (!hit?.lat || !hit?.lon) return null;

    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  };

  return {
    async lookup(query) {
      const key = query.trim().toLowerCase();
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

      // Очередь: параллельные создания игр не должны бить лимит сервиса
      const result = queue
        .then(() => fetchOne(query))
        .catch((error: unknown) => {
          logger.warn(
            { err: error instanceof Error ? error.message : String(error) },
            'геокодер недоступен',
          );
          return null;
        });
      queue = result;

      const value = await result;
      cache.set(key, { value, at: Date.now() });
      return value;
    },
  };
}
