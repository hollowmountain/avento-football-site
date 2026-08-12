import type { WeatherSnapshot } from '../domain/weather';

export interface WeatherProvider {
  /** Прогноз на конкретный час; null — за горизонтом прогноза или ошибка. */
  forecastAt(latitude: number, longitude: number, at: Date): Promise<WeatherSnapshot | null>;
}

export interface WeatherCacheStore {
  get(key: string): Promise<WeatherSnapshot | null>;
  set(key: string, snapshot: WeatherSnapshot): Promise<void>;
}
