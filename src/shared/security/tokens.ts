import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Токены — криптостойкие 256-битные случайные строки; в БД хранится только
 * HMAC-SHA256(pepper, token). Для равномерно случайных 256-битных токенов
 * медленные KDF (argon2/bcrypt) не дают выигрыша в безопасности,
 * но добавляют латентность на каждый запрос — см. docs/ADR/0002.
 */
export interface TokenServiceImpl {
  generate(): string;
  hash(token: string): string;
  verify(token: string, storedHash: string): boolean;
}

export function createTokenService(pepper: string): TokenServiceImpl {
  const hash = (token: string): string => createHmac('sha256', pepper).update(token).digest('hex');

  return {
    generate: () => randomBytes(32).toString('base64url'),
    hash,
    verify: (token, storedHash) => {
      const actual = Buffer.from(hash(token), 'hex');
      const expected = Buffer.from(storedHash, 'hex');
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}

/** IP хешируется с отдельной солью; сырой IP не хранится и не логируется. */
export function hashIp(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ip).digest('hex');
}
