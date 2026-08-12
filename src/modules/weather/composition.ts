import { prisma } from '@/shared/lib/db';
import { env } from '@/shared/lib/env';
import type { WeatherCacheStore, WeatherProvider } from './application/ports';
import { createOpenMeteoProvider } from './infrastructure/open-meteo';
import { createPrismaWeatherCache } from './infrastructure/prisma-weather-cache';

export interface WeatherModuleDeps {
  provider: WeatherProvider;
  cache: WeatherCacheStore;
}

const globalForWeather = globalThis as unknown as { kickoffWeatherDeps?: WeatherModuleDeps };

export function getWeatherDeps(): WeatherModuleDeps {
  if (!globalForWeather.kickoffWeatherDeps) {
    globalForWeather.kickoffWeatherDeps = {
      provider: createOpenMeteoProvider(),
      cache: createPrismaWeatherCache(prisma, env.WEATHER_CACHE_TTL_MINUTES),
    };
  }
  return globalForWeather.kickoffWeatherDeps;
}
