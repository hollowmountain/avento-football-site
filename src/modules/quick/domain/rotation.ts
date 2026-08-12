import type { QuickMatchResult } from './types';

/**
 * Очередь команд игрового дня. Правило заказчика: победитель остаётся
 * на поле, проигравший — в конец очереди, ожидающая команда выходит.
 * Ничья счётом не решается: команды играют суефа на поле, и проигравшего
 * передают сюда явно (drawLoserId).
 */
export interface RotationState {
  /** Кто на поле: [хозяева, гости] следующего матча. */
  playing: [string, string];
  /** Очередь ожидающих: waiting[0] выходит следующим. */
  waiting: string[];
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
  };
}

export function applyMatchResult(
  state: RotationState,
  result: QuickMatchResult,
  /** Проигравший суефа — обязателен при ничьей, иначе игнорируется. */
  drawLoserId?: string,
): RotationOutcome {
  const entering = state.waiting[0];
  if (entering === undefined) {
    // Двух команд хватает друг другу: ротации нет
    return { state: { ...state, waiting: [...state.waiting] }, leaving: null, entering: null };
  }

  const [home, away] = state.playing;
  const winnerId =
    result.homeGoals > result.awayGoals
      ? result.homeId
      : result.awayGoals > result.homeGoals
        ? result.awayId
        : null;
  // Победа решает сама; ничья — суефа. Если проигравшего суефа не передали,
  // уходят хозяева — детерминированный запасной путь, а не правило дня.
  const leaving =
    winnerId !== null ? (winnerId === home ? away : home) : drawLoserId === away ? away : home;
  const staying = leaving === home ? away : home;

  return {
    state: {
      // Оставшаяся команда становится «хозяевами» следующего матча
      playing: [staying, entering],
      waiting: [...state.waiting.slice(1), leaving],
    },
    leaving,
    entering,
  };
}
