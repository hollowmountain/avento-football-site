import type { Coordinates, Geocoder } from '../application/ports';

/**
 * Детерминированный геокодер для тестов: без сети и без флаки.
 * Разные адреса дают разные точки (иначе не проверить гео-дедупликацию),
 * один и тот же адрес — всегда одну и ту же.
 */
export function createStubGeocoder(): Geocoder {
  return {
    lookup(query) {
      let hash = 0;
      for (let i = 0; i < query.length; i += 1) {
        hash = (hash * 31 + query.charCodeAt(i)) | 0;
      }
      const spread = (n: number) => ((Math.abs(n) % 20_000) / 20_000) * 4 - 2;
      const coords: Coordinates = {
        latitude: 55.75 + spread(hash),
        longitude: 37.62 + spread(hash >> 8),
      };
      return Promise.resolve(coords);
    },
  };
}
