import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import {
  FallbackRateLimiter,
  PgRateLimiter,
  type RateLimitDecision,
} from '@/shared/security/rate-limiter';
import { createTestPrisma } from './helpers';

let prisma: PrismaClient;
let pg: PgRateLimiter;

beforeAll(async () => {
  prisma = createTestPrisma(5);
  await prisma.rateLimitEvent.deleteMany();
  pg = new PgRateLimiter(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PgRateLimiter (fallback-хранилище)', () => {
  it('пускает до лимита и отсекает сверх него с внятным Retry-After', async () => {
    const key = `test:${Date.now()}:basic`;
    for (let i = 0; i < 3; i += 1) {
      const decision = await pg.consume(key, 3, 60);
      expect(decision.allowed).toBe(true);
    }
    const denied = await pg.consume(key, 3, 60);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('окно скользит: после истечения окна запросы снова проходят', async () => {
    const key = `test:${Date.now()}:sliding`;
    expect((await pg.consume(key, 1, 1)).allowed).toBe(true);
    expect((await pg.consume(key, 1, 1)).allowed).toBe(false);
    await sleep(1100);
    expect((await pg.consume(key, 1, 1)).allowed).toBe(true);
  });

  it('cleanup удаляет старые события', async () => {
    const key = `test:${Date.now()}:cleanup`;
    await pg.consume(key, 10, 60);
    const removed = await pg.cleanup(-1); // всё старше «минус секунды» = всё
    expect(removed).toBeGreaterThan(0);
  });
});

describe('FallbackRateLimiter (политика отказа)', () => {
  const broken = {
    consume(): Promise<RateLimitDecision> {
      return Promise.reject(new Error('storage down'));
    },
  };

  it('падение основного адаптера → работает fallback', async () => {
    const limiter = new FallbackRateLimiter(broken, pg);
    const key = `test:${Date.now()}:failover`;
    expect((await limiter.consume(key, 1, 60, 'closed')).allowed).toBe(true);
    expect((await limiter.consume(key, 1, 60, 'closed')).allowed).toBe(false);
  });

  it('оба адаптера недоступны: fail-closed запрещает, fail-open пропускает', async () => {
    const limiter = new FallbackRateLimiter(broken, null);
    const closed = await limiter.consume('k', 10, 60, 'closed');
    expect(closed.allowed).toBe(false);
    expect(closed.retryAfterSeconds).toBeGreaterThan(0);

    const open = await limiter.consume('k', 10, 60, 'open');
    expect(open.allowed).toBe(true);
  });
});
