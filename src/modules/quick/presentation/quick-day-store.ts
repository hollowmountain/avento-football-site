'use client';

import { useSyncExternalStore } from 'react';
import { applyMatchResult, startRotation, type RotationState } from '../domain/rotation';
import type {
  QuickGoal,
  QuickMatch,
  QuickPlayer,
  QuickTeam,
  QuickTeamColorId,
} from '../domain/types';

/**
 * Состояние игрового дня целиком живёт в localStorage — бэкенда у режима
 * нет. Снапшот кэшируется, пишется атомарно, вкладки синхронизируются
 * событием storage (тот же useSyncExternalStore-паттерн, что use-host-token).
 */
export const QUICK_DAY_STORAGE_KEY = 'avento_quick_day_v1';

export interface QuickTimer {
  running: boolean;
  /** Накопленное до последней паузы время, мс. */
  accumulatedMs: number;
  /** Момент последнего запуска (epoch ms), null — на паузе. */
  startedAt: number | null;
}

export interface LiveMatch {
  homeId: string;
  awayId: string;
  goals: QuickGoal[];
  timer: QuickTimer;
}

export interface QuickDay {
  version: 1;
  startedAt: string;
  /** Заполнен — день завершён, показываем экран итогов. */
  finishedAt?: string | null;
  players: QuickPlayer[];
  teams: QuickTeam[];
  rotation: RotationState | null;
  matches: QuickMatch[];
  live: LiveMatch | null;
}

type Snapshot = QuickDay | null;

let cache: Snapshot | undefined;
const listeners = new Set<() => void>();

function readSnapshot(): Snapshot {
  if (cache === undefined) {
    try {
      const raw = window.localStorage.getItem(QUICK_DAY_STORAGE_KEY);
      const parsed = raw === null ? null : (JSON.parse(raw) as QuickDay);
      cache = parsed !== null && parsed.version === 1 ? parsed : null;
    } catch {
      cache = null;
    }
  }
  return cache;
}

function write(next: Snapshot): void {
  cache = next;
  try {
    if (next === null) window.localStorage.removeItem(QUICK_DAY_STORAGE_KEY);
    else window.localStorage.setItem(QUICK_DAY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Приватный режим или квота: день доживёт до перезагрузки страницы
  }
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUICK_DAY_STORAGE_KEY || event.key === null) {
      cache = undefined;
      onChange();
    }
  };
  listeners.add(onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** null — день не начат; undefined — до гидратации ещё не знаем. */
export function useQuickDay(): QuickDay | null | undefined {
  return useSyncExternalStore(subscribe, readSnapshot, () => undefined);
}

function update(mutator: (day: QuickDay) => QuickDay): void {
  const day = readSnapshot();
  if (day !== null) write(mutator(day));
}

// ─── День ────────────────────────────────────────────────────────────────

export function startDay(teams: readonly { name: string; colorId: QuickTeamColorId }[]): void {
  write({
    version: 1,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    players: [],
    teams: teams.map((team) => ({ id: crypto.randomUUID(), ...team })),
    rotation: null,
    matches: [],
    live: null,
  });
}

export function resetDay(): void {
  write(null);
}

/** Завершить день: дальше только итоги, журнал и шаринг. */
export function finishDay(): void {
  update((day) => (day.live !== null ? day : { ...day, finishedAt: new Date().toISOString() }));
}

/** Передумали: вернуться к игровому дню с экрана итогов. */
export function resumeDay(): void {
  update((day) => ({ ...day, finishedAt: null }));
}

/** Кнопка из демо-тура: начать день, не затирая уже идущий. */
export function startDayIfAbsent(
  teams: readonly { name: string; colorId: QuickTeamColorId }[],
): void {
  if (readSnapshot() === null) startDay(teams);
}

// ─── Кто пришёл ──────────────────────────────────────────────────────────

/** Новичок попадает в самую малочисленную команду. */
export function addPlayer(name: string, guest: boolean): void {
  update((day) => {
    const counts = new Map<string, number>(day.teams.map((team) => [team.id, 0]));
    for (const player of day.players) {
      if (player.teamId !== null && counts.has(player.teamId)) {
        counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
      }
    }
    let targetId: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const team of day.teams) {
      const count = counts.get(team.id) ?? 0;
      if (count < best) {
        best = count;
        targetId = team.id;
      }
    }
    return {
      ...day,
      players: [...day.players, { id: crypto.randomUUID(), name, guest, teamId: targetId }],
    };
  });
}

export function removePlayer(playerId: string): void {
  update((day) => ({ ...day, players: day.players.filter((p) => p.id !== playerId) }));
}

/** Нажатие на игрока переводит его в следующую команду по кругу. */
export function movePlayerToNextTeam(playerId: string): void {
  update((day) => ({
    ...day,
    players: day.players.map((player) => {
      if (player.id !== playerId) return player;
      const index = day.teams.findIndex((team) => team.id === player.teamId);
      const next = day.teams[(index + 1) % Math.max(day.teams.length, 1)];
      return { ...player, teamId: next?.id ?? null };
    }),
  }));
}

// ─── Команды ─────────────────────────────────────────────────────────────

export function renameTeam(teamId: string, name: string): void {
  update((day) => ({
    ...day,
    teams: day.teams.map((team) => (team.id === teamId ? { ...team, name } : team)),
  }));
}

export function setTeamColor(teamId: string, colorId: QuickTeamColorId): void {
  update((day) => ({
    ...day,
    teams: day.teams.map((team) => (team.id === teamId ? { ...team, colorId } : team)),
  }));
}

/**
 * Переключение числа команд (2–4). Разрешено только до первого матча —
 * дальше очередь и таблица уже опираются на состав дня.
 */
export function setTeamCount(
  count: 2 | 3 | 4,
  extraTeams: readonly { name: string; colorId: QuickTeamColorId }[],
): void {
  update((day) => {
    if (day.matches.length > 0 || day.live !== null) return day;
    if (count === day.teams.length) return day;

    if (count > day.teams.length) {
      const additions = extraTeams
        .slice(0, count - day.teams.length)
        .map((team) => ({ id: crypto.randomUUID(), ...team }));
      if (additions.length < count - day.teams.length) return day;
      return { ...day, rotation: null, teams: [...day.teams, ...additions] };
    }

    // Игроков распущенных команд раскидываем по кругу по оставшимся
    const kept = day.teams.slice(0, count);
    const removedIds = new Set(day.teams.slice(count).map((team) => team.id));
    let index = 0;
    const players = day.players.map((player) => {
      if (player.teamId === null || !removedIds.has(player.teamId)) return player;
      const target = kept[index % kept.length];
      index += 1;
      return { ...player, teamId: target?.id ?? null };
    });
    return { ...day, rotation: null, teams: kept, players };
  });
}

// ─── Матч ────────────────────────────────────────────────────────────────

export function startMatch(homeId: string, awayId: string): void {
  update((day) => {
    if (day.live !== null) return day;
    const samePair =
      day.rotation !== null &&
      ((day.rotation.playing[0] === homeId && day.rotation.playing[1] === awayId) ||
        (day.rotation.playing[0] === awayId && day.rotation.playing[1] === homeId));
    const rotation = samePair
      ? day.rotation
      : startRotation(
          [homeId, awayId],
          day.teams.map((team) => team.id).filter((id) => id !== homeId && id !== awayId),
        );
    return {
      ...day,
      rotation,
      live: {
        homeId,
        awayId,
        goals: [],
        timer: { running: true, accumulatedMs: 0, startedAt: Date.now() },
      },
    };
  });
}

export function toggleTimer(): void {
  update((day) => {
    if (day.live === null) return day;
    const { timer } = day.live;
    const next: QuickTimer = timer.running
      ? {
          running: false,
          accumulatedMs: timer.accumulatedMs + Date.now() - (timer.startedAt ?? Date.now()),
          startedAt: null,
        }
      : { running: true, accumulatedMs: timer.accumulatedMs, startedAt: Date.now() };
    return { ...day, live: { ...day.live, timer: next } };
  });
}

export function addGoal(teamId: string, scorerId: string | null, assistId: string | null): void {
  update((day) => {
    if (day.live === null) return day;
    const goal: QuickGoal = { id: crypto.randomUUID(), teamId, scorerId, assistId };
    return { ...day, live: { ...day.live, goals: [...day.live.goals, goal] } };
  });
}

export function undoLastGoal(): void {
  update((day) => {
    if (day.live === null || day.live.goals.length === 0) return day;
    return { ...day, live: { ...day.live, goals: day.live.goals.slice(0, -1) } };
  });
}

export function liveScore(live: LiveMatch): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const goal of live.goals) {
    if (goal.teamId === live.homeId) home += 1;
    else if (goal.teamId === live.awayId) away += 1;
  }
  return { home, away };
}

/**
 * Подтвердить результат: матч в журнал, очередь двигается по правилу дня.
 * При ничьей команды играют суефа — проигравшего передаёт диалог завершения.
 */
export function finishMatch(drawLoserId?: string): void {
  update((day) => {
    const { live } = day;
    if (live === null) return day;
    const score = liveScore(live);
    const result = {
      homeId: live.homeId,
      awayId: live.awayId,
      homeGoals: score.home,
      awayGoals: score.away,
    };
    const rotation = day.rotation ?? startRotation([live.homeId, live.awayId], []);
    const match: QuickMatch = { id: crypto.randomUUID(), ...result, goals: live.goals };
    return {
      ...day,
      matches: [...day.matches, match],
      rotation: applyMatchResult(rotation, result, drawLoserId).state,
      live: null,
    };
  });
}

// ─── Журнал ──────────────────────────────────────────────────────────────

/** Правка счёта сыгранного матча: плюс/минус по каждой стороне, не ниже нуля. */
export function adjustMatchScore(matchId: string, side: 'home' | 'away', delta: 1 | -1): void {
  update((day) => ({
    ...day,
    matches: day.matches.map((match) => {
      if (match.id !== matchId) return match;
      const key = side === 'home' ? 'homeGoals' : 'awayGoals';
      return { ...match, [key]: Math.max(0, match[key] + delta) };
    }),
  }));
}
