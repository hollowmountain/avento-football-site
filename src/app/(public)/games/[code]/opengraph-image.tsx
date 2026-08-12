import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getGameView } from '@/modules/game/presentation/get-game-view';

/**
 * Динамическая OG-картинка игры — превью ссылки в WhatsApp/Telegram.
 * Runtime строго nodejs; шрифты с кириллицей лежат рядом и попадают
 * в standalone-трейс через new URL(..., import.meta.url).
 */
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Kickoff — сбор на футбол';

const FORMAT_LABELS: Record<string, string> = {
  FIVE_A_SIDE: '5×5',
  SIX_A_SIDE: '6×6',
  SEVEN_A_SIDE: '7×7',
  EIGHT_A_SIDE: '8×8',
  ELEVEN_A_SIDE: '11×11',
};

export default async function OpengraphImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await getGameView(code, null, null);
  if (!view) notFound();

  const [regular, bold] = await Promise.all([
    readFile(new URL('./Inter-Regular.ttf', import.meta.url)),
    readFile(new URL('./Inter-Bold.ttf', import.meta.url)),
  ]);

  const game = view.game;
  const when = new Intl.DateTimeFormat('ru-RU', {
    timeZone: game.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(game.startsAt));

  const progress = Math.min(1, game.mainCount / game.maxPlayers);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        backgroundImage: 'linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)',
        color: '#ffffff',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>Kickoff</div>
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            fontWeight: 700,
            padding: '8px 24px',
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        >
          {game.code}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            maxHeight: 150,
            overflow: 'hidden',
          }}
        >
          {game.title}
        </div>
        <div style={{ display: 'flex', fontSize: 36, color: '#bbf7d0' }}>{when}</div>
        <div style={{ display: 'flex', fontSize: 32, color: '#dcfce7' }}>
          {game.venueName} · {game.city} · {FORMAT_LABELS[game.format] ?? game.format}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>
          {game.mainCount} из {game.maxPlayers} игроков
        </div>
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: 22,
            borderRadius: 11,
            backgroundColor: 'rgba(255,255,255,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: `${Math.max(2, Math.round(progress * 100))}%`,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#4ade80',
            }}
          />
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400 },
        { name: 'Inter', data: bold, weight: 700 },
      ],
    },
  );
}
