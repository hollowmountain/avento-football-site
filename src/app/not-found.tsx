import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/shared/ui/button';

export default async function NotFound() {
  const t = await getTranslations('game');
  const tHeader = await getTranslations('header');

  return (
    <div className="space-y-4 py-16 text-center">
      <p className="text-6xl font-bold">404</p>
      <p className="text-muted-foreground">{t('notFound')}</p>
      <Button asChild variant="outline">
        <Link href="/">{tHeader('feed')}</Link>
      </Button>
    </div>
  );
}
