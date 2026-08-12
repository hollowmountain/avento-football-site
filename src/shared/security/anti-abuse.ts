import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Time-trap: сервер подписывает момент рендера формы; при сабмите проверяем,
 * что прошло не меньше minSeconds (бот отправляет мгновенно) и не больше суток.
 */
export interface FormToken {
  ts: string;
  sig: string;
}

function signTimestamp(ts: string, secret: string): string {
  return createHmac('sha256', secret).update(`form-rendered:${ts}`).digest('hex');
}

export function issueFormToken(secret: string, now: Date): FormToken {
  const ts = String(now.getTime());
  return { ts, sig: signTimestamp(ts, secret) };
}

export function checkFormToken(
  token: FormToken,
  secret: string,
  now: Date,
  minSeconds: number,
): boolean {
  const expected = Buffer.from(signTimestamp(token.ts, secret), 'hex');
  const actual = Buffer.from(token.sig, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }
  const rendered = Number(token.ts);
  if (!Number.isFinite(rendered)) return false;
  const elapsedMs = now.getTime() - rendered;
  return elapsedMs >= minSeconds * 1000 && elapsedMs <= 24 * 60 * 60 * 1000;
}

/** Honeypot: скрытое поле заполнено → бот. Ответ должен быть «тихим» (200 OK). */
export function isHoneypotTripped(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------- Cloudflare Turnstile (за флагом TURNSTILE_ENABLED) ----------

export interface TurnstileVerifier {
  verify(token: string | null, ipHash: string): Promise<boolean>;
}

/** Заглушка, когда капча выключена. */
export const turnstileDisabled: TurnstileVerifier = {
  verify: () => Promise.resolve(true),
};

export function createTurnstileVerifier(secretKey: string): TurnstileVerifier {
  return {
    async verify(token) {
      if (!token) return false;
      try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: secretKey, response: token }),
        });
        const data = (await response.json()) as { success?: boolean };
        return data.success === true;
      } catch {
        return false;
      }
    },
  };
}
