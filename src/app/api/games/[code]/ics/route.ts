import type { NextRequest } from 'next/server';
import { getGameDeps } from '@/modules/game/composition';
import { jsonError } from '@/shared/errors/api-response';
import { env } from '@/shared/lib/env';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Дата в формате ICS UTC: 20260814T160000Z. RFC 5545 §3.3.5. */
function toIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Свёртка строк по 75 октетов (RFC 5545 §3.1) — упрощённо по символам. */
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  parts.push(rest);
  return parts.join('\r\n');
}

/** GET /api/games/:code/ics — «Добавить в календарь». */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const deps = getGameDeps();
  const { code } = await context.params;

  const game = await deps.games.findByCode(code.toUpperCase());
  if (!game) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);

  const gameUrl = `${env.APP_URL}/games/${game.code}`;
  // «Как получится» (null) — в календарь ставим 2 часа
  const endsAt = new Date(game.startsAt.getTime() + (game.durationMinutes ?? 120) * 60_000);
  const cancelled = game.status === 'CANCELLED_BY_HOST' || game.status === 'CANCELLED_NOT_ENOUGH';

  const description = [game.description, '', gameUrl].filter((v) => v !== null).join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AVENTO ASCENT//Pickup Football//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${game.code}@avento-ascent`,
    `DTSTAMP:${toIcsUtc(deps.clock.now())}`,
    `DTSTART:${toIcsUtc(game.startsAt)}`,
    `DTEND:${toIcsUtc(endsAt)}`,
    `SUMMARY:${icsEscape(`⚽ ${game.title}`)}`,
    `LOCATION:${icsEscape(`${game.venueName}, ${game.address}, ${game.city}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${gameUrl}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const body = lines.map(foldLine).join('\r\n') + '\r\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="avento-${game.code}.ics"`,
      'Cache-Control': 'no-cache',
    },
  });
}
