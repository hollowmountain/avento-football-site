import { env } from '@/shared/lib/env';
import type { Geocoder } from './application/ports';
import { createNominatimGeocoder } from './infrastructure/nominatim-geocoder';
import { createStubGeocoder } from './infrastructure/stub-geocoder';

const globalForGeo = globalThis as unknown as { kickoffGeocoder?: Geocoder };

export function getGeocoder(): Geocoder {
  if (!globalForGeo.kickoffGeocoder) {
    // В e2e ходить в публичный Nominatim нельзя: медленно и флаки
    globalForGeo.kickoffGeocoder =
      env.GEOCODER === 'stub' ? createStubGeocoder() : createNominatimGeocoder(env.APP_URL);
  }
  return globalForGeo.kickoffGeocoder;
}
