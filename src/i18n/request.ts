import { getRequestConfig } from 'next-intl/server';

/**
 * next-intl без i18n-роутинга: ссылки остаются короткими (/games/AVA-7F2A),
 * локаль по умолчанию — ru; en подключается cookie NEXT_LOCALE (заготовка).
 */
export const SUPPORTED_LOCALES = ['ru', 'en'] as const;
export const DEFAULT_LOCALE = 'ru';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = SUPPORTED_LOCALES.includes(requested as 'ru' | 'en')
    ? (requested as 'ru' | 'en')
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
