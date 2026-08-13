'use client';

import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { GameSummaryDto } from '@/modules/game/presentation/dto';
import { apiFetch } from '@/shared/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Pill } from '@/shared/ui/pill';
import { Skeleton } from '@/shared/ui/skeleton';

interface MyGameItem {
  game: GameSummaryDto;
  roles: ('HOST' | 'PLAYER')[];
}

function isUpcoming(game: GameSummaryDto): boolean {
  return (
    (game.status === 'OPEN' || game.status === 'FULL') &&
    new Date(game.startsAt).getTime() > Date.now() - 3 * 60 * 60 * 1000
  );
}

/** «Мои игры»: созданные и те, куда записан, — прямо в кабинете. */
export function MyGames() {
  const t = useTranslations('profile.myGames');

  const query = useQuery({
    queryKey: ['me-games'],
    queryFn: () => apiFetch<{ items: MyGameItem[] }>('/api/me/games'),
  });

  if (query.isPending) return <Skeleton className="h-32 w-full" aria-busy="true" />;
  const items = query.data?.items ?? [];

  // Будущие — сверху и по возрастанию (ближайшая первой), прошлые — ниже
  const upcoming = items
    .filter((item) => isUpcoming(item.game))
    .sort((a, b) => a.game.startsAt.localeCompare(b.game.startsAt));
  const past = items.filter((item) => !isUpcoming(item.game));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-xl tracking-wide">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        ) : (
          <>
            {upcoming.map((item) => (
              <GameRow key={item.game.code} item={item} upcoming />
            ))}
            {past.length > 0 && upcoming.length > 0 ? (
              <p className="eyebrow text-muted-foreground mt-2 mb-0.5">{t('pastTitle')}</p>
            ) : null}
            {past.map((item) => (
              <GameRow key={item.game.code} item={item} upcoming={false} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GameRow({ item, upcoming }: { item: MyGameItem; upcoming: boolean }) {
  const t = useTranslations('profile.myGames');
  const tStatuses = useTranslations('statuses');
  const format = useFormatter();
  const { game, roles } = item;

  return (
    <Link
      href={`/games/${game.code}`}
      className={`group focus-visible:ring-ring hover:bg-secondary/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        upcoming ? '' : 'opacity-60'
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{game.title}</span>
        <span className="text-muted-foreground truncate text-xs">
          {format.dateTime(new Date(game.startsAt), {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          {game.venueName}
          {upcoming ? (
            <>
              {' · '}
              <span className="digits">
                {game.mainCount}/{game.maxPlayers}
              </span>
            </>
          ) : (
            <> · {tStatuses(game.status)}</>
          )}
        </span>
      </span>
      {roles.includes('HOST') ? <Pill tone="accent">{t('host')}</Pill> : null}
      {roles.includes('PLAYER') && !roles.includes('HOST') ? <Pill>{t('player')}</Pill> : null}
    </Link>
  );
}
