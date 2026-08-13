import { err, ok, type Result } from '@/shared/lib/result';
import { isActiveStatus } from './game-status';
import type { GameStatus } from './types';

/** Инварианты продукта (границы значений — см. ТЗ §3). */
export const PLAYERS_MIN_LIMIT = 4;
export const PLAYERS_MAX_LIMIT = 30;
export const MAX_START_DAYS_AHEAD = 60;
export const DURATION_MIN_MINUTES = 30;
export const DURATION_MAX_MINUTES = 480;
/** Отказ позже, чем за N часов до старта, — всегда late-cancel. */
export const LATE_CANCEL_HOURS = 3;
/** За сколько часов до начала по умолчанию закрывается свободный отказ. */
export const DEFAULT_CANCEL_LEAD_HOURS = 6;

/**
 * Дедлайн свободного отказа по умолчанию: за 6 часов до начала, но никогда
 * в прошлом. Игру часто создают «на сегодня, через час-два» — там шесть
 * часов не помещаются, и просроченный дедлайн заставлял фоновую уборку
 * отменять игру сразу после создания (статус CANCELLED_NOT_ENOUGH,
 * из-за чего игра пропадала из ленты). В таком случае дедлайном
 * становится сам старт.
 */
export function defaultCancelDeadline(startsAt: Date, now: Date): Date {
  const lead = new Date(startsAt.getTime() - DEFAULT_CANCEL_LEAD_HOURS * 60 * 60 * 1000);
  return lead.getTime() > now.getTime() ? lead : startsAt;
}

export interface GameTimingDraft {
  startsAt: Date;
  cancelDeadline: Date;
  /** null — «как получится»: длительность не проверяется. */
  durationMinutes: number | null;
}

export interface PlayerCountsDraft {
  minPlayers: number;
  maxPlayers: number;
}

export interface DraftViolation {
  field: string;
  message: string;
}

export function validateGameDraft(
  draft: GameTimingDraft & PlayerCountsDraft & { pricePerPitch: number },
  now: Date,
): Result<void, DraftViolation[]> {
  const violations: DraftViolation[] = [];

  if (draft.startsAt.getTime() <= now.getTime()) {
    violations.push({ field: 'startsAt', message: 'Дата начала должна быть в будущем' });
  }
  const maxAhead = new Date(now.getTime() + MAX_START_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  if (draft.startsAt.getTime() > maxAhead.getTime()) {
    violations.push({
      field: 'startsAt',
      message: `Игру можно создать не дальше чем за ${MAX_START_DAYS_AHEAD} дней`,
    });
  }
  if (draft.cancelDeadline.getTime() > draft.startsAt.getTime()) {
    violations.push({
      field: 'cancelDeadline',
      message: 'Дедлайн отмены должен быть не позже начала игры',
    });
  }
  if (
    draft.durationMinutes !== null &&
    (draft.durationMinutes < DURATION_MIN_MINUTES || draft.durationMinutes > DURATION_MAX_MINUTES)
  ) {
    violations.push({
      field: 'durationMinutes',
      message: `Длительность — от ${DURATION_MIN_MINUTES} до ${DURATION_MAX_MINUTES} минут`,
    });
  }
  if (draft.maxPlayers < PLAYERS_MIN_LIMIT || draft.maxPlayers > PLAYERS_MAX_LIMIT) {
    violations.push({
      field: 'maxPlayers',
      message: `Максимум игроков — от ${PLAYERS_MIN_LIMIT} до ${PLAYERS_MAX_LIMIT}`,
    });
  }
  if (draft.minPlayers < 2 || draft.minPlayers > draft.maxPlayers) {
    violations.push({
      field: 'minPlayers',
      message: 'Минимум игроков — от 2 и не больше максимума',
    });
  }
  if (!Number.isInteger(draft.pricePerPitch) || draft.pricePerPitch < 0) {
    violations.push({
      field: 'pricePerPitch',
      message: 'Стоимость — целое неотрицательное число в минимальных единицах валюты',
    });
  }

  return violations.length > 0 ? err(violations) : ok(undefined);
}

// ---------- Присоединение ----------

export type JoinDecision =
  { role: 'MAIN'; becomesFull: boolean } | { role: 'WAITLIST'; waitlistOrder: number };

export type JoinRejection = 'GAME_NOT_JOINABLE';

export interface JoinContext {
  status: GameStatus;
  startsAt: Date;
  maxPlayers: number;
  activeMainCount: number;
  maxWaitlistOrder: number | null;
  now: Date;
}

export function decideJoin(ctx: JoinContext): Result<JoinDecision, JoinRejection> {
  if (!isActiveStatus(ctx.status) || ctx.startsAt.getTime() <= ctx.now.getTime()) {
    return err('GAME_NOT_JOINABLE');
  }
  if (ctx.activeMainCount < ctx.maxPlayers) {
    return ok({ role: 'MAIN', becomesFull: ctx.activeMainCount + 1 >= ctx.maxPlayers });
  }
  return ok({ role: 'WAITLIST', waitlistOrder: (ctx.maxWaitlistOrder ?? 0) + 1 });
}

// ---------- Отказ от участия ----------

/** Поздний отказ: после дедлайна отмены ИЛИ менее чем за LATE_CANCEL_HOURS до старта. */
export function isLateCancel(now: Date, cancelDeadline: Date, startsAt: Date): boolean {
  const lateBoundary = Math.min(
    cancelDeadline.getTime(),
    startsAt.getTime() - LATE_CANCEL_HOURS * 60 * 60 * 1000,
  );
  return now.getTime() > lateBoundary;
}
