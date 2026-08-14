import { describe, expect, it } from 'vitest';
import { findForbidden, isClean } from '@/modules/moderation/domain/profanity';

describe('фильтр недопустимых слов', () => {
  it('пропускает обычные имена и названия', () => {
    const fine = [
      'Вечерний футбол',
      'Данияр Осмонов',
      'Манеж Юность',
      'Сбор на Спартаке',
      'Команда А',
      'Матч-день у Арбата',
      'Alexandr Petrov',
      'Игра в Махачкале',
      'Христина Иванова',
      'Алла Борисовна',
      'Жидкость для линз',
      'Никита',
      'Счёт 5:3',
    ];
    for (const text of fine) {
      expect(findForbidden(text), text).toBeNull();
    }
  });

  it('ловит мат в открытую', () => {
    expect(isClean('иди на хуй')).toBe(false);
    expect(isClean('пиздец команда')).toBe(false);
    expect(isClean('Мудак Иванов')).toBe(false);
    // «ё» не спасает: она сводится к «е»
    expect(isClean('Хуёвый матч')).toBe(false);
    expect(isClean('fuck this game')).toBe(false);
  });

  it('ловит мат, замаскированный латиницей и цифрами', () => {
    // «х» латинской x, «у» латинской y, «о» нулём
    expect(isClean('xyйло')).toBe(false);
    expect(isClean('п1зда')).toBe(false);
    expect(isClean('бл9дь')).toBe(false);
    expect(isClean('BLYAT team')).toBe(false);
  });

  it('ловит мат, разбитый пробелами и точками', () => {
    expect(isClean('х у й')).toBe(false);
    expect(isClean('п.и.з.д.е.ц')).toBe(false);
    expect(isClean('х_у_й_ло')).toBe(false);
  });

  it('ловит растянутые буквы', () => {
    expect(isClean('хуууй')).toBe(false);
    expect(isClean('ссссука')).toBe(false);
  });

  it('ловит оскорбления по национальности', () => {
    expect(isClean('негр')).toBe(false);
    expect(isClean('Негритос')).toBe(false);
    expect(isClean('чурки')).toBe(false);
    expect(isClean('жид')).toBe(false);
    expect(isClean('nigger')).toBe(false);
  });

  it('не трогает похожие безобидные слова', () => {
    // Именно ради них национальные слова ищутся по словам, а не подстрокой
    expect(isClean('Махачкала')).toBe(true);
    expect(isClean('жидкое топливо')).toBe(true);
    expect(isClean('команда мечты')).toBe(true);
    expect(isClean('Негорелое')).toBe(true);
  });

  it('не пропускает религиозные имена', () => {
    expect(isClean('Иисус')).toBe(false);
    expect(isClean('Пророк Мухаммед')).toBe(false);
    expect(isClean('Аллах')).toBe(false);
    expect(isClean('Jesus')).toBe(false);
    expect(isClean('Будда')).toBe(false);
  });

  it('возвращает найденный корень — по нему видно, за что отказали', () => {
    expect(findForbidden('иди на хуй')).toBe('хуй');
    expect(findForbidden('Негритос')).toBe('негр');
  });
});
