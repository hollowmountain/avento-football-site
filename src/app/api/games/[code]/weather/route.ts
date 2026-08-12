import { NextResponse, type NextRequest } from 'next/server';
import { getGameDeps } from '@/modules/game/composition';
import { getWeatherFor } from '@/modules/weather/application/get-weather';
import { getWeatherDeps } from '@/modules/weather/composition';
import { weatherEmoji } from '@/modules/weather/domain/weather';
import { jsonError, jsonOk } from '@/shared/errors/api-response';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

/** GET /api/games/:code/weather — погода на время игры (кэш 1 ч). */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const deps = getGameDeps();
  const { code } = await context.params;

  const game = await deps.games.findByCode(code.toUpperCase());
  if (!game) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);

  const snapshot = await getWeatherFor(getWeatherDeps(), {
    latitude: game.latitude,
    longitude: game.longitude,
    startsAt: game.startsAt,
    now: deps.clock.now(),
  });

  if (!snapshot) return jsonOk({ available: false as const });

  return jsonOk({
    available: true as const,
    temperatureC: snapshot.temperatureC,
    precipitationProbability: snapshot.precipitationProbability,
    isWet: snapshot.isWet,
    emoji: weatherEmoji(snapshot.weatherCode),
  });
}
