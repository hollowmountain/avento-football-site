import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getGameDeps } from '@/modules/game/composition';
import { lazySweep } from '@/modules/game/lazy-sweep';
import { gameToSummaryDto } from '@/modules/game/presentation/dto';
import { GameCard } from '@/modules/game/presentation/game-card';
import { Button } from '@/shared/ui/button';

export const dynamic = 'force-dynamic';

/** Публичная лента ближайших игр (фильтры — на клиенте, см. итерацию 7). */
export default async function FeedPage() {
  lazySweep();

  const t = await getTranslations('feed');
  const tHeader = await getTranslations('header');
  const deps = getGameDeps();

  const page = await deps.games.list({ dateFrom: new Date() }, 'soonest', null, 20);
  const items = page.items.map(({ game, activeMainCount }) =>
    gameToSummaryDto(game, activeMainCount, activeMainCount),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {items.length === 0 ? (
        <div className="text-muted-foreground space-y-4 py-16 text-center">
          <p>{t('empty')}</p>
          <Button asChild>
            <Link href="/games/new">{tHeader('create')}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((game) => (
            <GameCard key={game.code} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
