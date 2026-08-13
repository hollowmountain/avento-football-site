/**
 * Тег профиля — как username в Telegram: глобально уникальный, латиница
 * в нижнем регистре, цифры и подчёркивание, 3–20 символов, не может
 * начинаться с цифры или подчёркивания и заканчиваться подчёркиванием.
 */

export const TAG_MIN = 3;
export const TAG_MAX = 20;

const TAG_PATTERN = /^[a-z][a-z0-9_]{1,18}[a-z0-9]$/;

/** Служебные и вводящие в заблуждение теги, занимать нельзя. */
const RESERVED_TAGS = new Set([
  'admin',
  'administrator',
  'avento',
  'moderator',
  'root',
  'support',
  'system',
]);

/** Приводит пользовательский ввод к канонической форме: без @, lowercase. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidTag(tag: string): boolean {
  return (
    tag.length >= TAG_MIN &&
    tag.length <= TAG_MAX &&
    TAG_PATTERN.test(tag) &&
    !RESERVED_TAGS.has(tag)
  );
}
