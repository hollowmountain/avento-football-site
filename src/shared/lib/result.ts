/**
 * Result<T, E> — возврат ошибок бизнес-логики значениями, без исключений.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Достаёт значение или бросает — только для тестов и скриптов. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw result.error instanceof Error ? result.error : new Error(JSON.stringify(result.error));
  }
  return result.value;
}
