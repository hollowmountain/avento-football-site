import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/shared/ui/site-header';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
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
    <html lang={locale} className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
            <footer className="text-muted-foreground border-t py-4 text-center text-xs">
              Kickoff
            </footer>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
