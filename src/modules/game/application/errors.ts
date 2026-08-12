/** Ошибки бизнес-логики. Возвращаются значениями через Result, не бросаются. */
export type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'GAME_NOT_FOUND'
  | 'GAME_NOT_JOINABLE'
  | 'GAME_NOT_EDITABLE'
  | 'NICKNAME_TAKEN'
  | 'ALREADY_JOINED'
  | 'NOT_PARTICIPANT'
  | 'FORBIDDEN'
  | 'DUPLICATE_GAME'
  | 'HOST_GAME_LIMIT'
  | 'NOT_ENOUGH_PLAYERS'
  | 'CODE_GENERATION_FAILED';

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  details?: unknown;
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  details?: unknown,
): DomainError {
  return details === undefined ? { code, message } : { code, message, details };
}
