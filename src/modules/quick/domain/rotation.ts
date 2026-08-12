import type { QuickMatchResult } from './types';

/**
 * Очередь команд игрового дня. Правило заказчика: победитель остаётся
 * на поле, проигравший — в конец очереди, ожидающая команда выходит.
 * При ничьей уходит команда, дольше находящаяся на поле; если обе вышли
 * одновременно (первый матч) — уходят хозяева (первая команда пары).
 */
export interface RotationState {
  /** Кто на поле: [хозяева, гости] следующего матча. */
  playing: [string, string];
  /** Очередь ожидающих: waiting[0] выходит следующим. */
  waiting: string[];
  /** Номер матча (с нуля), с которого команда непрерывно на поле. */
  enteredAt: Record<string, number>;
  /** Сколько матчей дня уже сыграно. */
  matchesPlayed: number;
}

export interface RotationOutcome {
  state: RotationState;
  /** Кто ушёл с поля (null — меняться некому, играют те же). */
  leaving: string | null;
  /** Кто вышел из очереди. */
  entering: string | null;
}

export function startRotation(first: [string, string], waiting: readonly string[]): RotationState {
  return {
    playing: [first[0], first[1]],
    waiting: [...waiting],
    enteredAt: { [first[0]]: 0, [first[1]]: 0 },
    matchesPlayed: 0,
  };
}

/** Кто покидает поле по результату (без учёта пустой очереди). */
export function pickLeaving(state: RotationState, result: QuickMatchResult): string {
  const [home, away] = state.playing;
  const winner =
    result.homeGoals > result.awayGoals
      ? result.homeId
      : result.awayGoals > result.homeGoals
        ? result.awayId
        : null;
  if (winner !== null) return winner === home ? away : home;

  // Ничья: уходит команда с большим стажем — меньший номер матча входа.
  // При равном стаже уходят хозяева: пара [home, away] задана при старте.
  const homeEntered = state.enteredAt[home] ?? 0;
  const awayEntered = state.enteredAt[away] ?? 0;
  return awayEntered < homeEntered ? away : home;
}

export function applyMatchResult(state: RotationState, result: QuickMatchResult): RotationOutcome {
  const matchesPlayed = state.matchesPlayed + 1;

  const entering = state.waiting[0];
  if (entering === undefined) {
    // Двух команд хватает друг другу: стаж на поле не сбрасывается
    return { state: { ...state, matchesPlayed }, leaving: null, entering: null };
  }

  const [home, away] = state.playing;
  const leaving = pickLeaving(state, result);
  const staying = leaving === home ? away : home;

  return {
    state: {
      // Оставшаяся команда становится «хозяевами» следующего матча
      playing: [staying, entering],
      waiting: [...state.waiting.slice(1), leaving],
      enteredAt: { [staying]: state.enteredAt[staying] ?? 0, [entering]: matchesPlayed },
      matchesPlayed,
    },
    leaving,
    entering,
  };
}
