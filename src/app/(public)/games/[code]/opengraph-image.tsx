import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getGameView } from '@/modules/game/presentation/get-game-view';

/**
 * Динамическая OG-картинка игры — превью ссылки в WhatsApp/Telegram.
 * Направление «Табло»: чернильный фон, янтарные цифры.
 * Runtime строго nodejs; шрифты лежат рядом и попадают в standalone-трейс
 * через new URL(..., import.meta.url). Satori понимает только ttf/otf.
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

const INK = '#0d1013';
const PANEL = '#161b20';
const AMBER = '#ffb020';
const WARM = '#f2ede3';
const SOFT = '#a2aab1';
const LINE = '#262d33';

export default async function OpengraphImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await getGameView(code, null, null);
  if (!view) notFound();

  const [condensed, body, mono] = await Promise.all([
    readFile(new URL('./SofiaSansExtraCondensed-ExtraBold.ttf', import.meta.url)),
    readFile(new URL('./SofiaSans-Medium.ttf', import.meta.url)),
    readFile(new URL('./JetBrainsMono-Bold.ttf', import.meta.url)),
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
        background: INK,
        // Свет прожекторов из двух верхних углов
        backgroundImage:
          'radial-gradient(60% 90% at 12% -15%, rgba(255,176,32,0.16), rgba(13,16,19,0) 60%), radial-gradient(60% 90% at 88% -15%, rgba(255,176,32,0.11), rgba(13,16,19,0) 60%)',
        color: WARM,
        fontFamily: 'SofiaSans',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontFamily: 'SofiaCondensed', fontSize: 44 }}>KICKOFF</div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'JetBrains',
            fontSize: 28,
            letterSpacing: 2,
            padding: '10px 22px',
            borderRadius: 6,
            border: `1px solid ${LINE}`,
            background: PANEL,
            color: SOFT,
          }}
        >
          {game.code}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            fontFamily: 'SofiaCondensed',
            fontSize: 82,
            lineHeight: 1.02,
            maxHeight: 176,
            overflow: 'hidden',
            textTransform: 'uppercase',
          }}
        >
          {game.title}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: AMBER }}>{when}</div>
        <div style={{ display: 'flex', fontSize: 30, color: SOFT }}>
          {game.venueName} · {game.city} · {FORMAT_LABELS[game.format] ?? game.format}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: 'JetBrains', fontSize: 46, color: AMBER }}>
            {game.mainCount}
          </span>
          <span style={{ fontFamily: 'JetBrains', fontSize: 30, color: SOFT }}>
            / {game.maxPlayers}
          </span>
          <span style={{ fontSize: 28, color: SOFT, marginLeft: 8 }}>
            {game.needMore > 0 ? `нужно ещё ${game.needMore}` : 'минимум набран'}
          </span>
        </div>
        <div
          style={{ display: 'flex', width: '100%', height: 18, borderRadius: 4, background: PANEL }}
        >
          <div
            style={{
              display: 'flex',
              width: `${Math.max(2, Math.round(progress * 100))}%`,
              height: 18,
              borderRadius: 4,
              background: AMBER,
            }}
          />
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'SofiaCondensed', data: condensed, weight: 800 },
        { name: 'SofiaSans', data: body, weight: 500 },
        { name: 'JetBrains', data: mono, weight: 700 },
      ],
    },
  );
}
