'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/shared/lib/api-client';
import { Badge } from '@/shared/ui/badge';

type WeatherData =
  | { available: false }
  | {
      available: true;
      temperatureC: number;
      precipitationProbability: number;
      isWet: boolean;
      emoji: string;
    };

/** Бейдж погоды на время игры. Нет данных — ничего не показываем. */
export function WeatherBadge({ gameCode }: { gameCode: string }) {
  const t = useTranslations('game.weather');

  const query = useQuery({
    queryKey: ['weather', gameCode],
    queryFn: () => apiFetch<WeatherData>(`/api/games/${gameCode}/weather`),
    staleTime: 10 * 60_000,
    retry: 0,
  });

  const weather = query.data;
  if (!weather?.available) return null;

  return (
    <Badge variant="outline" className="font-normal">
      {weather.emoji} {weather.temperatureC}°C
      {weather.isWet ? ` — ${t('rainHint')}` : ''}
    </Badge>
  );
}
