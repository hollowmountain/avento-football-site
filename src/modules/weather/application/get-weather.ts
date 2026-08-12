import type { WeatherSnapshot } from '../domain/weather';
import type { WeatherCacheStore, WeatherProvider } from './ports';

export interface GetWeatherDeps {
  provider: WeatherProvider;
  cache: WeatherCacheStore;
}

/** Горизонт прогноза Open-Meteo — 16 дней; берём с запасом 10. */
const FORECAST_HORIZON_DAYS = 10;

/**
 * Погода на время игры с кэшем (TTL контролирует хранилище кэша).
 * Ошибки не пробрасываются: нет погоды — нет бейджа, игра важнее.
 */
export async function getWeatherFor(
  deps: GetWeatherDeps,
  params: { latitude: number; longitude: number; startsAt: Date; now: Date },
): Promise<WeatherSnapshot | null> {
  const { latitude, longitude, startsAt, now } = params;

  const msAhead = startsAt.getTime() - now.getTime();
  if (msAhead < -60 * 60 * 1000 || msAhead > FORECAST_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
    return null;
  }

  const hourIso = new Date(Math.floor(startsAt.getTime() / 3_600_000) * 3_600_000)
    .toISOString()
    .slice(0, 13);
  const key = `${latitude.toFixed(2)}:${longitude.toFixed(2)}:${hourIso}`;

  try {
    const cached = await deps.cache.get(key);
    if (cached) return cached;

    const fresh = await deps.provider.forecastAt(latitude, longitude, startsAt);
    if (fresh) await deps.cache.set(key, fresh);
    return fresh;
  } catch {
    return null;
  }
}
