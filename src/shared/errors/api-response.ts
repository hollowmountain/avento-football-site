import { NextResponse } from 'next/server';
import type { DomainError, DomainErrorCode } from '@/modules/game/application/errors';

/**
 * Единый формат ответа API (ТЗ §7):
 *   успех:  { ok: true,  data: ... }
 *   ошибка: { ok: false, error: { code, message, details? } }
 */
export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  options?: { details?: unknown; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(options?.details !== undefined ? { details: options.details } : {}),
      },
    },
    { status, headers: options?.headers },
  );
}

const DOMAIN_ERROR_STATUS: Record<DomainErrorCode, number> = {
  VALIDATION_FAILED: 400,
  GAME_NOT_FOUND: 404,
  GAME_NOT_JOINABLE: 409,
  GAME_NOT_EDITABLE: 409,
  NICKNAME_TAKEN: 409,
  ALREADY_JOINED: 409,
  NOT_PARTICIPANT: 404,
  FORBIDDEN: 403,
  DUPLICATE_GAME: 409,
  HOST_GAME_LIMIT: 429,
  NOT_ENOUGH_PLAYERS: 409,
  CODE_GENERATION_FAILED: 500,
};

export function jsonDomainError(error: DomainError): NextResponse {
  return jsonError(error.code, error.message, DOMAIN_ERROR_STATUS[error.code] ?? 500, {
    details: error.details,
  });
}

/** 429 с Retry-After и человекочитаемым сроком. */
export function jsonRateLimited(message: string, retryAfterSeconds: number): NextResponse {
  return jsonError('RATE_LIMITED', message, 429, {
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });
}

export function humanizeSeconds(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  if (minutes > 1) return `${minutes} мин`;
  return 'минуту';
}
