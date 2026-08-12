'use client';

/**
 * Карточка результата 1080×1350 (формат ленты): чернильный фон, янтарные
 * акценты, названия команд — в их цветах. Рисуется в offscreen-canvas,
 * шрифты берём из CSS-переменных next/font (самохост, сеть не нужна).
 */

const WIDTH = 1080;
const HEIGHT = 1350;

const INK = '#0d1013';
const PAPER = '#f2ede3';
const MUTED = '#a2aab1';
const AMBER = '#ffb020';
const LINE = '#262d33';

export interface CardStandingsRow {
  name: string;
  color: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CardMatchRow {
  home: string;
  homeColor: string;
  away: string;
  awayColor: string;
  homeGoals: number;
  awayGoals: number;
}

export interface ResultCardInput {
  eyebrow: string;
  dateLabel: string;
  title: string;
  standings: CardStandingsRow[];
  matchesTitle: string;
  matches: CardMatchRow[];
  /** «и ещё N матчей», если в карточку влезли не все. */
  moreLabel: string | null;
  footer: string;
}

/** Сколько матчей помещается в блок под таблицей. */
export const CARD_MATCH_LIMIT = 8;

function cssFont(variable: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value !== '' ? value : 'sans-serif';
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export async function renderResultCard(input: ResultCardInput): Promise<Blob> {
  await document.fonts.ready;
  const display = cssFont('--font-sofia-condensed');
  const sans = cssFont('--font-sofia');

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('canvas 2d context unavailable');

  // Фон: чернильный + два «прожектора» сверху, как .floodlight на сайте
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const [x, alpha] of [
    [WIDTH * 0.15, 0.14],
    [WIDTH * 0.85, 0.09],
  ] as const) {
    const glow = ctx.createRadialGradient(x, -160, 0, x, -160, 760);
    glow.addColorStop(0, `rgba(255, 176, 32, ${alpha})`);
    glow.addColorStop(1, 'rgba(255, 176, 32, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, 620);
  }

  // Янтарная линия по верху — фирменный «прожектор включился»
  const sweep = ctx.createLinearGradient(0, 0, WIDTH, 0);
  sweep.addColorStop(0, 'rgba(255, 176, 32, 0)');
  sweep.addColorStop(0.4, AMBER);
  sweep.addColorStop(0.6, AMBER);
  sweep.addColorStop(1, 'rgba(255, 176, 32, 0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, WIDTH, 6);

  const left = 72;
  const right = WIDTH - 72;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = AMBER;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(input.eyebrow.toUpperCase(), left, 118);

  ctx.fillStyle = MUTED;
  ctx.font = `400 34px ${sans}`;
  ctx.fillText(input.dateLabel, left, 170);

  ctx.fillStyle = PAPER;
  ctx.font = `800 132px ${display}`;
  ctx.fillText(fitText(ctx, input.title.toUpperCase(), right - left), left, 296);

  // Таблица дня
  let y = 380;
  for (const row of input.standings) {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    ctx.fillStyle = AMBER;
    ctx.font = `800 84px ${display}`;
    const pointsText = String(row.points);
    const pointsWidth = ctx.measureText(pointsText).width;
    ctx.fillText(pointsText, right - pointsWidth, y + 92);

    ctx.fillStyle = row.color;
    ctx.font = `800 64px ${display}`;
    ctx.fillText(
      fitText(ctx, row.name.toUpperCase(), right - left - pointsWidth - 48),
      left,
      y + 74,
    );

    ctx.fillStyle = MUTED;
    ctx.font = `400 30px ${sans}`;
    ctx.fillText(
      `${row.wins} · ${row.draws} · ${row.losses}   ${row.goalsFor}:${row.goalsAgainst}`,
      left,
      y + 118,
    );

    y += 148;
  }

  // Матчи дня
  y += 34;
  ctx.fillStyle = MUTED;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(input.matchesTitle.toUpperCase(), left, y);
  y += 24;

  ctx.font = `800 44px ${display}`;
  const matchLine = 64;
  input.matches.slice(0, CARD_MATCH_LIMIT).forEach((match, index) => {
    y += matchLine;
    let x = left;
    ctx.font = `400 34px ${sans}`;
    ctx.fillStyle = MUTED;
    const numberText = `${index + 1}.  `;
    ctx.fillText(numberText, x, y);
    x += ctx.measureText(numberText).width;

    ctx.font = `800 44px ${display}`;
    const maxName = 300;
    ctx.fillStyle = match.homeColor;
    const homeText = fitText(ctx, match.home.toUpperCase(), maxName);
    ctx.fillText(homeText, x, y);
    x += ctx.measureText(homeText).width;

    ctx.fillStyle = PAPER;
    const scoreText = `  ${match.homeGoals}:${match.awayGoals}  `;
    ctx.fillText(scoreText, x, y);
    x += ctx.measureText(scoreText).width;

    ctx.fillStyle = match.awayColor;
    ctx.fillText(fitText(ctx, match.away.toUpperCase(), right - x), x, y);
  });

  if (input.moreLabel !== null) {
    y += matchLine;
    ctx.fillStyle = MUTED;
    ctx.font = `400 34px ${sans}`;
    ctx.fillText(input.moreLabel, left, y);
  }

  // Подпись снизу
  ctx.fillStyle = MUTED;
  ctx.font = `600 30px ${sans}`;
  const footerText = input.footer.toUpperCase();
  ctx.fillText(footerText, (WIDTH - ctx.measureText(footerText).width) / 2, HEIGHT - 56);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('canvas toBlob failed'));
      else resolve(blob);
    }, 'image/png');
  });
}
