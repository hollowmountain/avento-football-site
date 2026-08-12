/** Снимок погоды на час начала игры. */
export interface WeatherSnapshot {
  temperatureC: number;
  precipitationProbability: number; // 0..100
  weatherCode: number; // WMO weather interpretation code
  /** Дождь/ливень/гроза/снег — повод предупредить про вторые бутсы. */
  isWet: boolean;
}

/** WMO-коды осадков: морось/дождь 51–67, снег 71–77, ливни 80–86, гроза 95–99. */
export function isWetWeatherCode(code: number): boolean {
  return (code >= 51 && code <= 86) || (code >= 95 && code <= 99);
}

export function weatherEmoji(code: number): string {
  if (code >= 95) return '⛈️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (isWetWeatherCode(code)) return '🌧️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 1 && code <= 3) return '🌤️';
  if (code === 0) return '☀️';
  return '🌥️';
}
