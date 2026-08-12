'use client';

import { MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatGameDate, formatMoneyMinor } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import type { GameSummaryDto } from './dto';

/** Карточка игры в публичной ленте. */
export function GameCard({ game }: { game: GameSummaryDto }) {
  const t = useTranslations('feed.card');
  const tFormats = useTranslations('formats');
  const tLevels = useTranslations('levels');
  const tStatuses = useTranslations('statuses');

  return (
    <Link href={`/games/${game.code}`} className="block focus-visible:outline-none group">
      <Card className="group-focus-visible:ring-ring transition-shadow group-focus-visible:ring-2 hover:shadow-md">
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{tFormats(game.format)}</Badge>
            <Badge variant="outline">{tLevels(game.skillLevel)}</Badge>
            {game.status === 'FULL' ? <Badge variant="secondary">{tStatuses('FULL')}</Badge> : null}
            <span className="text-muted-foreground ml-auto text-xs">
              {formatGameDate(game.startsAt, game.timezone)}
            </span>
          </div>
          <div>
            <p className="font-semibold">{game.title}</p>
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3.5" aria-hidden />
              {game.city} · {game.venueName}
            </p>
          </div>
          <div className="space-y-1.5">
            <Progress value={(game.mainCount / game.maxPlayers) * 100} />
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {t('players', { main: game.mainCount, max: game.maxPlayers })}
                {game.needMore > 0 ? ` · ${t('needMore', { count: game.needMore })}` : ''}
              </span>
              <span>
                {game.pricePerPitch === 0
                  ? t('free')
                  : game.perPersonPrice !== null
                    ? t('perPerson', {
                        price: formatMoneyMinor(game.perPersonPrice, game.currency),
                      })
                    : formatMoneyMinor(game.pricePerPitch, game.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
