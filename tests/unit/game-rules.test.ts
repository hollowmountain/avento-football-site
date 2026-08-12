import { describe, expect, it } from 'vitest';
import {
  decideJoin,
  isLateCancel,
  validateGameDraft,
  type JoinContext,
} from '@/modules/game/domain/game-rules';

const NOW = new Date('2026-08-12T10:00:00Z');
const IN_2_DAYS = new Date('2026-08-14T10:00:00Z');

const validDraft = {
  startsAt: IN_2_DAYS,
  cancelDeadline: new Date('2026-08-14T06:00:00Z'),
  durationMinutes: 90,
  minPlayers: 6,
  maxPlayers: 10,
  pricePerPitch: 500_000,
};

describe('validateGameDraft', () => {
  it('корректный черновик проходит', () => {
    expect(validateGameDraft(validDraft, NOW).ok).toBe(true);
  });

  const cases: Array<{ name: string; patch: Partial<typeof validDraft>; field: string }> = [
    {
      name: 'дата в прошлом',
      patch: { startsAt: new Date('2026-08-11T10:00:00Z') },
      field: 'startsAt',
    },
    {
      name: 'дальше 60 дней',
      patch: {
        startsAt: new Date('2026-11-11T10:00:00Z'),
        cancelDeadline: new Date('2026-11-11T09:00:00Z'),
      },
      field: 'startsAt',
    },
    {
      name: 'дедлайн позже начала',
      patch: { cancelDeadline: new Date('2026-08-14T11:00:00Z') },
      field: 'cancelDeadline',
    },
    { name: 'слишком короткая игра', patch: { durationMinutes: 10 }, field: 'durationMinutes' },
    { name: 'maxPlayers меньше 4', patch: { maxPlayers: 3, minPlayers: 2 }, field: 'maxPlayers' },
    { name: 'maxPlayers больше 30', patch: { maxPlayers: 31 }, field: 'maxPlayers' },
    { name: 'минимум больше максимума', patch: { minPlayers: 11 }, field: 'minPlayers' },
    { name: 'дробная цена', patch: { pricePerPitch: 10.5 }, field: 'pricePerPitch' },
    { name: 'отрицательная цена', patch: { pricePerPitch: -1 }, field: 'pricePerPitch' },
  ];

  for (const { name, patch, field } of cases) {
    it(`отклоняет: ${name}`, () => {
      const result = validateGameDraft({ ...validDraft, ...patch }, NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.map((v) => v.field)).toContain(field);
      }
    });
  }
});

describe('decideJoin', () => {
  const base: JoinContext = {
    status: 'OPEN',
    startsAt: IN_2_DAYS,
    maxPlayers: 10,
    activeMainCount: 5,
    maxWaitlistOrder: null,
    now: NOW,
  };

  it('есть места — MAIN', () => {
    const result = decideJoin(base);
    expect(result).toEqual({ ok: true, value: { role: 'MAIN', becomesFull: false } });
  });

  it('последнее место — MAIN и игра становится FULL', () => {
    const result = decideJoin({ ...base, activeMainCount: 9 });
    expect(result).toEqual({ ok: true, value: { role: 'MAIN', becomesFull: true } });
  });

  it('мест нет — WAITLIST c порядковым номером', () => {
    const result = decideJoin({
      ...base,
      status: 'FULL',
      activeMainCount: 10,
      maxWaitlistOrder: 2,
    });
    expect(result).toEqual({ ok: true, value: { role: 'WAITLIST', waitlistOrder: 3 } });
  });

  it('первый в пустом waitlist получает номер 1', () => {
    const result = decideJoin({ ...base, status: 'FULL', activeMainCount: 10 });
    expect(result).toEqual({ ok: true, value: { role: 'WAITLIST', waitlistOrder: 1 } });
  });

  for (const status of ['CANCELLED_BY_HOST', 'CANCELLED_NOT_ENOUGH', 'FINISHED'] as const) {
    it(`нельзя присоединиться к игре в статусе ${status}`, () => {
      expect(decideJoin({ ...base, status }).ok).toBe(false);
    });
  }

  it('нельзя присоединиться к начавшейся игре', () => {
    expect(decideJoin({ ...base, startsAt: NOW }).ok).toBe(false);
  });
});

describe('isLateCancel', () => {
  const startsAt = new Date('2026-08-12T18:00:00Z');
  const deadline = new Date('2026-08-12T12:00:00Z');

  it('до дедлайна и раньше чем за 3 часа — не late', () => {
    expect(isLateCancel(new Date('2026-08-12T11:00:00Z'), deadline, startsAt)).toBe(false);
  });

  it('после дедлайна — late', () => {
    expect(isLateCancel(new Date('2026-08-12T13:00:00Z'), deadline, startsAt)).toBe(true);
  });

  it('менее чем за 3 часа до старта — late даже при позднем дедлайне', () => {
    const lateDeadline = new Date('2026-08-12T17:30:00Z');
    expect(isLateCancel(new Date('2026-08-12T16:00:00Z'), lateDeadline, startsAt)).toBe(true);
  });
});
