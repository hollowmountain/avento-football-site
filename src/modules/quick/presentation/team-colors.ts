import type { QuickTeamColorId } from '../domain/types';

/**
 * Палитра команд: 6 пресетов, читаемых на чернильном фоне. В интерфейсе
 * цвет подаётся через CSS-переменную --quick-team-* (в светлой теме —
 * затемнённый вариант, см. globals.css), в карточке результата фон
 * всегда чернильный — там используется hex напрямую.
 */
export interface TeamColorPreset {
  id: QuickTeamColorId;
  /** Цвет на чернильном фоне (тёмная тема, карточка результата). */
  hex: string;
}

export const TEAM_COLORS: readonly TeamColorPreset[] = [
  { id: 'amber', hex: '#ffb020' },
  { id: 'green', hex: '#5fd98c' },
  { id: 'coral', hex: '#f0616b' },
  { id: 'sky', hex: '#6fb7ff' },
  { id: 'violet', hex: '#c08cff' },
  { id: 'paper', hex: '#f2ede3' },
];

export function teamColorHex(colorId: QuickTeamColorId): string {
  return TEAM_COLORS.find((preset) => preset.id === colorId)?.hex ?? '#f2ede3';
}

/** CSS-переменная пресета: тема сама подставляет читаемый вариант. */
export function teamColorVar(colorId: QuickTeamColorId): string {
  return `var(--quick-team-${colorId})`;
}
