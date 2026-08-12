import { randomInt } from 'node:crypto';

/** Алфавит без визуально похожих символов (нет I, L, O, 0, 1). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const PREFIX = 'AVA';

/** Короткий код игры вида AVA-7F2A. */
export function generateGameCode(): string {
  let suffix = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${PREFIX}-${suffix}`;
}

export const GAME_CODE_PATTERN = /^AVA-[A-HJ-NP-Z2-9]{4}$/;
