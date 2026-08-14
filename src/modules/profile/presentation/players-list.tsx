import { getTranslations } from 'next-intl/server';
import type { PlayerListItem } from '../application/ports';
import { Card, CardContent } from '@/shared/ui/card';
import { ClubBadge } from './clubs';
import { FlagIcon } from './country-flag';

const ROW_GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3';

/**
 * Рейтинг игроков: место, ФИО, флаг, клуб, тег и сумма «гол + пас»
 * из протоколов матч-дней. Порядок задаёт СУБД (listPlayers).
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
        <div className={`${ROW_GRID} text-muted-foreground border-b pb-1.5`}>
          <span className="eyebrow">#</span>
          <span className="eyebrow">{t('player')}</span>
          <span className="eyebrow text-right">{t('scoreLabel')}</span>
        </div>

        {players.map((player, index) => (
          <div key={player.id} className={`${ROW_GRID} border-b py-2.5 last:border-b-0`}>
            <span className="text-muted-foreground digits text-sm">#{index + 1}</span>

            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{player.displayName}</span>
                {player.countryCode !== null ? (
                  <FlagIcon code={player.countryCode} width={16} />
                ) : null}
                {player.club !== null ? <ClubBadge clubId={player.club} size={16} /> : null}
              </span>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="text-lamp truncate text-xs font-medium">@{player.tag}</span>
                {player.skillLevel !== 'ANY' ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {tLevels(player.skillLevel)}
                  </span>
                ) : null}
              </span>
            </span>

            {/* Сумма «гол + пас» — по ней и построен порядок */}
            <span className="shrink-0 text-right">
              <span className="display digits text-lamp block text-xl leading-none">
                {player.goals + player.assists}
              </span>
              <span className="text-muted-foreground digits block text-[0.7rem]">
                {t('breakdown', { goals: player.goals, assists: player.assists })}
                {player.played > 0 ? ` · ${t('played', { count: player.played })}` : ''}
              </span>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
