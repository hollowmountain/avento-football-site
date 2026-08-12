import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isActiveStatus,
  statusForMainCount,
} from '@/modules/game/domain/game-status';
import type { GameStatus } from '@/modules/game/domain/types';

const ALL: GameStatus[] = ['OPEN', 'FULL', 'CANCELLED_BY_HOST', 'CANCELLED_NOT_ENOUGH', 'FINISHED'];

describe('canTransition', () => {
  it('OPEN может стать FULL, отменённой или завершённой', () => {
    expect(canTransition('OPEN', 'FULL')).toBe(true);
    expect(canTransition('OPEN', 'CANCELLED_BY_HOST')).toBe(true);
    expect(canTransition('OPEN', 'CANCELLED_NOT_ENOUGH')).toBe(true);
    expect(canTransition('OPEN', 'FINISHED')).toBe(true);
  });

  it('FULL может вернуться в OPEN (кто-то отказался)', () => {
    expect(canTransition('FULL', 'OPEN')).toBe(true);
  });

  it('FULL не может стать CANCELLED_NOT_ENOUGH', () => {
    expect(canTransition('FULL', 'CANCELLED_NOT_ENOUGH')).toBe(false);
  });

  it('терминальные статусы не меняются', () => {
    for (const from of ['CANCELLED_BY_HOST', 'CANCELLED_NOT_ENOUGH', 'FINISHED'] as const) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

describe('isActiveStatus', () => {
  it('активны только OPEN и FULL', () => {
    expect(ALL.filter(isActiveStatus)).toEqual(['OPEN', 'FULL']);
  });
});

describe('statusForMainCount', () => {
  it('меньше максимума — OPEN, достигли — FULL', () => {
    expect(statusForMainCount(9, 10)).toBe('OPEN');
    expect(statusForMainCount(10, 10)).toBe('FULL');
  });
});
