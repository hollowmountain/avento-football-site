import { isWetWeatherCode, type WeatherSnapshot } from '../domain/weather';
import type { WeatherProvider } from '../application/ports';

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
}

/** Open-Meteo: бесплатно, без API-ключа. https://open-meteo.com/ */
export function createOpenMeteoProvider(): WeatherProvider {
  return {
    async forecastAt(latitude, longitude, at): Promise<WeatherSnapshot | null> {
      const day = at.toISOString().slice(0, 10);
      const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
        '&hourly=temperature_2m,precipitation_probability,weather_code' +
        `&start_date=${day}&end_date=${day}&timezone=UTC`;

      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) return null;

      const data = (await response.json()) as OpenMeteoResponse;
      const times = data.hourly?.time ?? [];
      const targetHour = at.toISOString().slice(0, 13);
      const index = times.findIndex((t) => t.startsWith(targetHour));
      if (index < 0) return null;

      const temperature = data.hourly?.temperature_2m?.[index];
      const weatherCode = data.hourly?.weather_code?.[index];
      if (temperature === undefined || weatherCode === undefined) return null;

      return {
        temperatureC: Math.round(temperature),
        precipitationProbability: data.hourly?.precipitation_probability?.[index] ?? 0,
        weatherCode,
        isWet: isWetWeatherCode(weatherCode),
      };
    },
  };
}
