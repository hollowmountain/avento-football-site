import { describe, expect, it } from 'vitest';
import { splitPrice } from '@/modules/game/domain/price-split';

describe('splitPrice', () => {
  it('делит поровну без остатка', () => {
    expect(splitPrice(100_000, 10).perPersonMinor).toBe(10_000);
  });

  it('округляет вверх при остатке (поле оплачено полностью)', () => {
    const split = splitPrice(100_000, 7);
    expect(split.perPersonMinor).toBe(14_286);
    expect(split.perPersonMinor! * 7).toBeGreaterThanOrEqual(100_000);
  });

  it('бесплатная игра — по нулям', () => {
    expect(splitPrice(0, 5).perPersonMinor).toBe(0);
  });

  it('нет подтверждённых игроков — платить некому', () => {
    expect(splitPrice(50_000, 0).perPersonMinor).toBeNull();
  });

  it('отрицательная или дробная стоимость — ошибка программиста', () => {
    expect(() => splitPrice(-1, 5)).toThrow();
    expect(() => splitPrice(10.5, 5)).toThrow();
  });
});
