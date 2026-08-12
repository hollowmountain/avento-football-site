import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from '@/shared/ui/theme-toggle';

export async function SiteHeader() {
  const t = await getTranslations('header');
  const tCommon = await getTranslations('common');

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4 lg:max-w-4xl">
        <Link
          href="/"
          className="display focus-visible:ring-ring rounded-sm text-2xl leading-none tracking-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {tCommon('appName')}
        </Link>
        {/* Оба пункта набраны одинаково — узким капсом одного размера:
            вперемешку с обычным начертанием строка выглядела разнородной */}
        <nav className="ml-auto flex items-center gap-1">
          {/* На мобильном «Игры» скрыты: на ленту ведёт логотип */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="display hidden text-sm tracking-wide sm:inline-flex"
          >
            <Link href="/">{t('feed')}</Link>
          </Button>
          <Button asChild size="sm" className="display text-sm tracking-wide">
            <Link href="/games/new">{t('create')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="display text-sm tracking-wide">
            <Link href="/quick">{t('quick')}</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
