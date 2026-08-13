import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/shared/ui/button';
import { HeaderNav } from '@/shared/ui/header-nav';
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
        {/* Все пункты — одинаковые «таблетки»; активный раздел затемнён
            (клиентский HeaderNav следит за pathname) */}
        <nav className="ml-auto flex items-center gap-1.5">
          <HeaderNav
            items={[
              { href: '/', label: t('feed'), hideOnMobile: true },
              { href: '/games/new', label: t('create') },
              { href: '/quick', label: t('quick') },
            ]}
          />
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('profile')}>
            <Link href="/me">
              <UserRound aria-hidden />
            </Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
