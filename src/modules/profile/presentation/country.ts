/**
 * Флаг страны «для красоты»: код ISO 3166-1 alpha-2 превращается в
 * эмодзи из региональных символов — без картинок и без сети.
 * Названия стран локализует стандартный Intl.DisplayNames.
 */

export const COUNTRY_CODES: readonly string[] = [
  'kg',
  'kz',
  'uz',
  'tj',
  'ru',
  'by',
  'am',
  'az',
  'ge',
  'us',
  'br',
  'ar',
  'pt',
  'es',
  'fr',
  'de',
  'it',
];

export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export function countryName(countryCode: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([locale], { type: 'region' }).of(countryCode.toUpperCase()) ??
      countryCode.toUpperCase()
    );
  } catch {
    return countryCode.toUpperCase();
  }
}
