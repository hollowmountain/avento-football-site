/** Клиентская обёртка над fetch для API формата { ok, data | error }. */

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly payload: ApiErrorPayload,
    public readonly status: number,
  ) {
    super(payload.message);
    this.name = 'ApiRequestError';
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = (await response.json().catch(() => null)) as
    { ok: true; data: T } | { ok: false; error: ApiErrorPayload } | null;

  if (!json) {
    throw new ApiRequestError(
      { code: 'BAD_RESPONSE', message: 'Сервер вернул некорректный ответ' },
      response.status,
    );
  }
  if (!json.ok) {
    throw new ApiRequestError(json.error, response.status);
  }
  return json.data;
}
