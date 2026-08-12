import { describe, expect, it } from 'vitest';
import { generateGameCode, GAME_CODE_PATTERN } from '@/shared/security/game-code';
import { createTokenService, hashIp } from '@/shared/security/tokens';

describe('createTokenService', () => {
  const tokens = createTokenService('unit-test-pepper-0123456789');

  it('генерирует уникальные токены достаточной длины', () => {
    const a = tokens.generate();
    const b = tokens.generate();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 байта base64url
  });

  it('хеш детерминирован и не равен токену', () => {
    const token = tokens.generate();
    expect(tokens.hash(token)).toBe(tokens.hash(token));
    expect(tokens.hash(token)).not.toBe(token);
  });

  it('verify принимает свой токен и отклоняет чужой', () => {
    const token = tokens.generate();
    const stored = tokens.hash(token);
    expect(tokens.verify(token, stored)).toBe(true);
    expect(tokens.verify(tokens.generate(), stored)).toBe(false);
    expect(tokens.verify(token, 'не-хекс')).toBe(false);
  });

  it('разный pepper — разный хеш', () => {
    const other = createTokenService('another-pepper-0123456789');
    expect(tokens.hash('t')).not.toBe(other.hash('t'));
  });
});

describe('hashIp', () => {
  it('детерминирован по соли и не содержит сам IP', () => {
    const hash = hashIp('203.0.113.7', 'salt-0123456789abcdef');
    expect(hash).toBe(hashIp('203.0.113.7', 'salt-0123456789abcdef'));
    expect(hash).not.toContain('203');
    expect(hashIp('203.0.113.7', 'other-salt-0123456789')).not.toBe(hash);
  });
});

describe('generateGameCode', () => {
  it('код соответствует формату KCK-XXXX без похожих символов', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateGameCode()).toMatch(GAME_CODE_PATTERN);
    }
  });
});
