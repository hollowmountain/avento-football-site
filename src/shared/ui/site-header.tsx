import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/shared/ui/button';
import { HeaderNav } from '@/shared/ui/header-nav';
import { ThemeToggle } from '@/shared/ui/theme-toggle';

export async function SiteHeader() {
  const t = await getTranslations('header');
  const tCommon = await getTranslations('common');

  const logo = (
    <Link
      href="/"
      className="display focus-visible:ring-ring rounded-sm text-2xl leading-none tracking-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {tCommon('appName')}
    </Link>
  );

  const profileButton = (
    <Button asChild variant="ghost" size="icon-sm" aria-label={t('profile')}>
      <Link href="/me">
        <UserRound aria-hidden />
      </Link>
    </Button>
  );

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto h-14 w-full max-w-3xl px-4 lg:max-w-4xl">
        {/* Телефон: тема слева, логотип по центру, кабинет справа.
            Разделы уехали вниз, в MobileTabBar — под большой палец */}
        <div className="grid h-full grid-cols-[auto_1fr_auto] items-center sm:hidden">
          <ThemeToggle />
          <span className="justify-self-center">{logo}</span>
          {profileButton}
        </div>

        {/* Десктоп: логотип слева, разделы «таблетками» справа */}
        <div className="hidden h-full items-center gap-2 sm:flex">
          {logo}
          <nav className="ml-auto flex items-center gap-1.5">
            <HeaderNav
              items={[
                { href: '/', label: t('feed') },
                { href: '/games/new', label: t('create') },
                { href: '/quick', label: t('quick') },
                { href: '/players', label: t('players') },
              ]}
            />
            {profileButton}
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
