/**
 * Флаг страны «для красоты»: код ISO 3166-1 alpha-2 превращается в
 * эмодзи из региональных символов — без картинок и без сети.
 * Названия стран локализует стандартный Intl.DisplayNames.
 */

export const COUNTRY_CODES: readonly string[] = [
  'kg',
  'ru',
  'kz',
  'uz',
  'tj',
  'tm',
  'ua',
  'by',
  'az',
  'am',
  'ge',
  'md',
  'tr',
  'de',
  'pl',
  'gb',
  'fr',
  'es',
  'it',
  'pt',
  'nl',
  'se',
  'no',
  'cz',
  'rs',
  'hr',
  'us',
  'ca',
  'br',
  'ar',
  'mx',
  'cn',
  'jp',
  'kr',
  'in',
  'ae',
  'sa',
  'eg',
  'ma',
  'ng',
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
