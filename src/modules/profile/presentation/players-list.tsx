import { getTranslations } from 'next-intl/server';
import type { PlayerListItem } from '../application/ports';
import { Card, CardContent } from '@/shared/ui/card';
import { ClubBadge } from './clubs';
import { FlagIcon } from './country-flag';

/**
 * Каталог игроков: ФИО, флаг, клуб, уникальный тег. Порядок — по числу
 * сыгранных матчей; когда появится протокол матч-дня (этап 2), сюда
 * добавятся голы с ассистами и список станет рейтингом.
 */
export async function PlayersList({ players }: { players: PlayerListItem[] }) {
  const t = await getTranslations('players');
  const tLevels = await getTranslations('levels');

  if (players.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-b-0"
          >
            <span className="text-muted-foreground digits text-sm">#{index + 1}</span>

            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{player.displayName}</span>
                {player.countryCode !== null ? (
                  <FlagIcon code={player.countryCode} width={16} />
                ) : null}
                {player.club !== null ? <ClubBadge clubId={player.club} size={16} /> : null}
              </span>
              <span className="text-lamp truncate text-xs font-medium">@{player.tag}</span>
            </span>

            <span className="text-muted-foreground shrink-0 text-right text-xs">
              {player.skillLevel !== 'ANY' ? (
                <span className="block">{tLevels(player.skillLevel)}</span>
              ) : null}
              {player.played > 0 ? (
                <span className="digits block">{t('played', { count: player.played })}</span>
              ) : null}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
