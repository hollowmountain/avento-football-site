import type { NextRequest } from 'next/server';
import { getGameDeps } from '@/modules/game/composition';
import { jsonError } from '@/shared/errors/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ code: string }> };

const PING_INTERVAL_MS = 25_000;

/**
 * GET /api/games/:code/stream — Server-Sent Events.
 * События «тонкие» (notify-then-fetch): клиент на любое событие
 * перезапрашивает состояние игры, поэтому Last-Event-ID/replay не нужны.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { code } = await context.params;
  const gameCode = code.toUpperCase();

  const deps = getGameDeps();
  const game = await deps.games.findByCode(gameCode);
  if (!game) return jsonError('GAME_NOT_FOUND', 'Игра не найдена', 404);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Интервал реконнекта для EventSource
      send('retry: 3000\n\n');

      const unsubscribe = deps.events.subscribe(gameCode, (event) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Keep-alive: прокси Railway не должен закрывать «тихое» соединение
      const ping = setInterval(() => send(': ping\n\n'), PING_INTERVAL_MS);

      // Cleanup при уходе клиента — иначе утечка подписок и таймеров
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // соединение уже закрыто
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform критичен: иначе compression-middleware буферизует поток
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
