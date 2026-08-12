import { describe, expect, it } from 'vitest';
import {
  applyMatchResult,
  startRotation,
  type RotationState,
} from '@/modules/quick/domain/rotation';
import type { QuickMatchResult } from '@/modules/quick/domain/types';

function result(state: RotationState, homeGoals: number, awayGoals: number): QuickMatchResult {
  const [homeId, awayId] = state.playing;
  return { homeId, awayId, homeGoals, awayGoals };
}

describe('startRotation', () => {
  it('пара на поле и очередь сохраняют порядок', () => {
    const state = startRotation(['a', 'b'], ['c', 'd']);
    expect(state.playing).toEqual(['a', 'b']);
    expect(state.waiting).toEqual(['c', 'd']);
  });
});

describe('applyMatchResult', () => {
  it('победитель остаётся, проигравший — в конец очереди, ожидающий выходит', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 2, 1));
    expect(outcome.leaving).toBe('b');
    expect(outcome.entering).toBe('c');
    expect(outcome.state.playing).toEqual(['a', 'c']);
    expect(outcome.state.waiting).toEqual(['b']);
  });

  it('победа гостей: уходят хозяева', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 0, 2));
    expect(outcome.leaving).toBe('a');
    expect(outcome.state.playing).toEqual(['b', 'c']);
  });

  it('ничья решается суефа: уходит переданный проигравший (гости)', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 1, 1), 'b');
    expect(outcome.leaving).toBe('b');
    expect(outcome.state.playing).toEqual(['a', 'c']);
    expect(outcome.state.waiting).toEqual(['b']);
  });

  it('ничья решается суефа: уходит переданный проигравший (хозяева)', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 1, 1), 'a');
    expect(outcome.leaving).toBe('a');
    expect(outcome.state.playing).toEqual(['b', 'c']);
    expect(outcome.state.waiting).toEqual(['a']);
  });

  it('ничья в самом первом матче тоже решается суефа', () => {
    // Раньше действовало «кто дольше на поле» — в первом матче оно
    // бессмысленно: обе команды вышли одновременно
    const first = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(first, result(first, 0, 0), 'b');
    expect(outcome.leaving).toBe('b');
  });

  it('ничья без переданного проигравшего: запасной путь — уходят хозяева', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 1, 1));
    expect(outcome.leaving).toBe('a');
  });

  it('при победе переданный drawLoserId игнорируется', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 3, 0), 'a');
    expect(outcome.leaving).toBe('b');
  });

  it('две команды без очереди: играют те же, ротации нет', () => {
    const state = startRotation(['a', 'b'], []);
    const outcome = applyMatchResult(state, result(state, 3, 1));
    expect(outcome.leaving).toBeNull();
    expect(outcome.entering).toBeNull();
    expect(outcome.state.playing).toEqual(['a', 'b']);
  });

  it('4 команды: очередь из двух движется по кругу', () => {
    let state = startRotation(['a', 'b'], ['c', 'd']);
    state = applyMatchResult(state, result(state, 1, 0)).state; // b уходит, c выходит
    expect(state.playing).toEqual(['a', 'c']);
    expect(state.waiting).toEqual(['d', 'b']);

    state = applyMatchResult(state, result(state, 0, 1)).state; // a уходит, d выходит
    expect(state.playing).toEqual(['c', 'd']);
    expect(state.waiting).toEqual(['b', 'a']);

    state = applyMatchResult(state, result(state, 2, 2), 'c').state; // суефа: c уходит
    expect(state.playing).toEqual(['d', 'b']);
    expect(state.waiting).toEqual(['a', 'c']);
  });

  it('определяет победителя по id независимо от порядка сторон', () => {
    const state = startRotation(['a', 'b'], ['c']);
    // Результат записан с перевёрнутыми сторонами — правило не ломается
    const swapped: QuickMatchResult = { homeId: 'b', awayId: 'a', homeGoals: 2, awayGoals: 0 };
    const outcome = applyMatchResult(state, swapped);
    expect(outcome.leaving).toBe('a');
  });
});
