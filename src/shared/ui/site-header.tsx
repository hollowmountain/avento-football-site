import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from '@/shared/ui/theme-toggle';

export async function SiteHeader() {
  const t = await getTranslations('header');
  const tCommon = await getTranslations('common');

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span aria-hidden>⚽</span>
          <span>{tCommon('appName')}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">{t('feed')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/games/new">{t('create')}</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
