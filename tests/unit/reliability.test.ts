import { describe, expect, it } from 'vitest';
import { reliabilityBadge } from '@/modules/reliability/domain/score';

describe('reliabilityBadge', () => {
  it('меньше 3 игр — новичок', () => {
    expect(reliabilityBadge({ gamesJoined: 0, gamesAttended: 0, lateCancels: 0 })).toEqual({
      kind: 'new',
    });
    expect(reliabilityBadge({ gamesJoined: 2, gamesAttended: 2, lateCancels: 0 })).toEqual({
      kind: 'new',
    });
  });

  it('без поздних отмен — 100%', () => {
    expect(reliabilityBadge({ gamesJoined: 10, gamesAttended: 9, lateCancels: 0 })).toEqual({
      kind: 'score',
      percent: 100,
    });
  });

  it('поздние отмены снижают процент', () => {
    expect(reliabilityBadge({ gamesJoined: 10, gamesAttended: 8, lateCancels: 2 })).toEqual({
      kind: 'score',
      percent: 80,
    });
  });

  it('процент не уходит ниже нуля', () => {
    const badge = reliabilityBadge({ gamesJoined: 3, gamesAttended: 0, lateCancels: 5 });
    expect(badge).toEqual({ kind: 'score', percent: 0 });
  });
});
