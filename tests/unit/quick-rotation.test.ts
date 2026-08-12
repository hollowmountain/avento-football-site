import { describe, expect, it } from 'vitest';
import {
  applyMatchResult,
  pickLeaving,
  startRotation,
  type RotationState,
} from '@/modules/quick/domain/rotation';
import type { QuickMatchResult } from '@/modules/quick/domain/types';

function result(state: RotationState, homeGoals: number, awayGoals: number): QuickMatchResult {
  const [homeId, awayId] = state.playing;
  return { homeId, awayId, homeGoals, awayGoals };
}

describe('startRotation', () => {
  it('пара на поле входит с нулевым стажем, очередь сохраняет порядок', () => {
    const state = startRotation(['a', 'b'], ['c', 'd']);
    expect(state.playing).toEqual(['a', 'b']);
    expect(state.waiting).toEqual(['c', 'd']);
    expect(state.enteredAt).toEqual({ a: 0, b: 0 });
    expect(state.matchesPlayed).toBe(0);
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

  it('вышедшая команда получает стаж с номера следующего матча', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 2, 1));
    expect(outcome.state.enteredAt).toEqual({ a: 0, c: 1 });
    expect(outcome.state.matchesPlayed).toBe(1);
  });

  it('ничья: уходит команда, дольше находящаяся на поле', () => {
    const first = startRotation(['a', 'b'], ['c']);
    // a выиграла и осталась (стаж с матча 0), c вышла (стаж с матча 1)
    const second = applyMatchResult(first, result(first, 1, 0)).state;
    expect(second.playing).toEqual(['a', 'c']);

    // Ничья во втором матче: 'a' дольше на поле — уходит именно она
    const outcome = applyMatchResult(second, result(second, 2, 2));
    expect(outcome.leaving).toBe('a');
    expect(outcome.state.playing).toEqual(['c', 'b']);
    expect(outcome.state.waiting).toEqual(['a']);
  });

  it('ничья при равном стаже (первый матч): уходят хозяева', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 1, 1));
    expect(outcome.leaving).toBe('a');
    expect(outcome.state.playing).toEqual(['b', 'c']);
  });

  it('серия побед не сбрасывает стаж — победитель копит время на поле', () => {
    let state = startRotation(['a', 'b'], ['c']);
    state = applyMatchResult(state, result(state, 1, 0)).state; // a побеждает b
    state = applyMatchResult(state, result(state, 1, 0)).state; // a побеждает c
    expect(state.playing).toEqual(['a', 'b']);
    expect(state.enteredAt['a']).toBe(0);

    // Ничья: уходит 'a' — на поле с самого первого матча
    const outcome = applyMatchResult(state, result(state, 0, 0));
    expect(outcome.leaving).toBe('a');
  });

  it('две команды без очереди: играют те же, ротации нет', () => {
    const state = startRotation(['a', 'b'], []);
    const outcome = applyMatchResult(state, result(state, 3, 1));
    expect(outcome.leaving).toBeNull();
    expect(outcome.entering).toBeNull();
    expect(outcome.state.playing).toEqual(['a', 'b']);
    expect(outcome.state.matchesPlayed).toBe(1);
  });

  it('победа гостей: уходят хозяева', () => {
    const state = startRotation(['a', 'b'], ['c']);
    const outcome = applyMatchResult(state, result(state, 0, 2));
    expect(outcome.leaving).toBe('a');
    expect(outcome.state.playing).toEqual(['b', 'c']);
  });

  it('очередь из двух команд движется по кругу', () => {
    let state = startRotation(['a', 'b'], ['c', 'd']);
    state = applyMatchResult(state, result(state, 1, 0)).state; // b уходит, c выходит
    expect(state.playing).toEqual(['a', 'c']);
    expect(state.waiting).toEqual(['d', 'b']);

    state = applyMatchResult(state, result(state, 0, 1)).state; // a уходит, d выходит
    expect(state.playing).toEqual(['c', 'd']);
    expect(state.waiting).toEqual(['b', 'a']);
  });
});

describe('pickLeaving', () => {
  it('определяет победителя по счёту независимо от порядка сторон', () => {
    const state = startRotation(['a', 'b'], ['c']);
    // Результат записан с перевёрнутыми сторонами — правило не ломается
    const swapped: QuickMatchResult = { homeId: 'b', awayId: 'a', homeGoals: 2, awayGoals: 0 };
    expect(pickLeaving(state, swapped)).toBe('a');
  });
});
