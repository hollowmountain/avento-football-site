import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTag } from '@/modules/profile/domain/tag';

describe('normalizeTag', () => {
  it('убирает @, пробелы и приводит к нижнему регистру', () => {
    expect(normalizeTag('  @Sanya_10 ')).toBe('sanya_10');
    expect(normalizeTag('@@VANYA')).toBe('vanya');
  });
});

describe('isValidTag', () => {
  it('принимает корректные теги', () => {
    for (const tag of ['abc', 'sanya_10', 'a1b2c3', 'x_y_z9', 'a'.repeat(20)]) {
      expect(isValidTag(tag), tag).toBe(true);
    }
  });

  it('отклоняет короткие, длинные и с недопустимыми символами', () => {
    for (const tag of ['ab', 'a'.repeat(21), 'ваня', 'sanya 10', 'sanya-10', 'Sanya']) {
      expect(isValidTag(tag), tag).toBe(false);
    }
  });

  it('отклоняет тег, начинающийся не с буквы или кончающийся подчёркиванием', () => {
    for (const tag of ['1sanya', '_sanya', 'sanya_']) {
      expect(isValidTag(tag), tag).toBe(false);
    }
  });

  it('служебные теги заняты навсегда', () => {
    for (const tag of ['admin', 'avento', 'support']) {
      expect(isValidTag(tag), tag).toBe(false);
    }
  });
});
