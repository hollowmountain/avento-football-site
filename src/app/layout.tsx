import type { Metadata } from 'next';
import { JetBrains_Mono, Sofia_Sans, Sofia_Sans_Extra_Condensed } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { env } from '@/shared/lib/env';
import { SiteHeader } from '@/shared/ui/site-header';
import { Providers } from './providers';
import './globals.css';

/*
 * Sofia Sans Extra Condensed Black — свободный родственник Burbank Big
 * Condensed (шрифт Fortnite), но с настоящей кириллицей. Нормальная ширина
 * той же суперсемьи держит текст, JetBrains Mono — цифры табло.
 * Все три самохостятся next/font, внешних запросов к шрифтам нет.
 */
const sofia = Sofia_Sans({
  variable: '--font-sofia',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const sofiaCondensed = Sofia_Sans_Extra_Condensed({
  variable: '--font-sofia-condensed',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const monoDigits = JetBrains_Mono({
  variable: '--font-mono-digits',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    // Без metadataBase Next разрешает адрес OG-картинки от угаданного хоста,
    // и превью ссылки в мессенджерах ломается на проде
    metadataBase: new URL(env.APP_URL),
    title: {
      default: `${t('appName')} — ${t('tagline')}`,
      template: `%s | ${t('appName')}`,
    },
    description: t('tagline'),
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${sofia.variable} ${sofiaCondensed.variable} ${monoDigits.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
            <footer className="text-muted-foreground border-t py-5 text-center">
              <span className="eyebrow">Kickoff</span>
            </footer>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
