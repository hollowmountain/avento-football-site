'use client';

import { MapPin, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatMoneyMinor, formatShortDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Pill } from '@/shared/ui/pill';
import { Progress } from '@/shared/ui/progress';
import type { GameSummaryDto } from './dto';

/**
 * Карточка игры в публичной ленте. Владельцу сайта под карточкой
 * показывается снятие с публикации — кнопка живёт вне ссылки,
 * иначе клик по ней уводил бы на страницу игры.
 */
export function GameCard({ game, onRemove }: { game: GameSummaryDto; onRemove?: () => void }) {
  const t = useTranslations('feed.card');
  const tAdmin = useTranslations('admin');
  const tFormats = useTranslations('formats');
  const tLevels = useTranslations('levels');
  const tStatuses = useTranslations('statuses');

  const card = (
    <Link href={`/games/${game.code}`} className="group block focus-visible:outline-none">
      <Card className="group-focus-visible:ring-ring group-hover:border-primary/50 transition-colors group-focus-visible:ring-2">
        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill>{tFormats(game.format)}</Pill>
            {game.skillLevel !== 'ANY' ? <Pill>{tLevels(game.skillLevel)}</Pill> : null}
            {game.status === 'FULL' ? <Pill tone="muted">{tStatuses('FULL')}</Pill> : null}
            <span className="text-muted-foreground ml-auto digits text-xs">
              {formatShortDate(game.startsAt, game.timezone)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="display text-xl leading-tight text-balance">{game.title}</p>
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {game.city} · {game.venueName}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Progress value={(game.mainCount / game.maxPlayers) * 100} />
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground digits">
                {t('players', { main: game.mainCount, max: game.maxPlayers })}
                {game.needMore > 0 ? ` · ${t('needMore', { count: game.needMore })}` : ''}
              </span>
              <span className="text-lamp digits">
                {game.pricePerPitch === 0
                  ? t('free')
                  : game.perPersonPrice !== null
                    ? formatMoneyMinor(game.perPersonPrice, game.currency)
                    : formatMoneyMinor(game.pricePerPitch, game.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  if (onRemove === undefined) return card;

  return (
    <div className="flex flex-col gap-1">
      {card}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive self-end"
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden /> {tAdmin('remove')}
      </Button>
    </div>
  );
}
