'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { QuickMatch, QuickTeam } from '../domain/types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { adjustMatchScore, type QuickDay } from './quick-day-store';
import { teamColorVar } from './team-colors';

/** Журнал дня: каждый матч сохранён, счёт правится плюс-минусом. */
export function JournalSection({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.journal');
  const tMatch = useTranslations('quick.match');
  const teamById = new Map(day.teams.map((team) => [team.id, team]));
  const playerById = new Map(day.players.map((player) => [player.id, player]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-xl tracking-wide">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {day.matches.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">{t('editHint')}</p>
            <ul className="flex flex-col gap-3">
              {day.matches.map((match, index) => {
                const home = teamById.get(match.homeId);
                const away = teamById.get(match.awayId);
                if (home === undefined || away === undefined) return null;
                const scorers = match.goals
                  .map((goal) => {
                    const scorer =
                      goal.scorerId !== null ? playerById.get(goal.scorerId) : undefined;
                    return scorer?.name ?? tMatch('noScorer');
                  })
                  .join(', ');
                return (
                  <li key={match.id} className="bg-background/40 rounded-md border p-2.5">
                    <p className="eyebrow text-muted-foreground mb-1.5">
                      {t('matchNumber', { number: index + 1 })}
                    </p>
                    <div className="flex flex-col gap-1">
                      <ScoreLine
                        match={match}
                        team={home}
                        side="home"
                        value={match.homeGoals}
                        increaseLabel={t('increase', { team: home.name })}
                        decreaseLabel={t('decrease', { team: home.name })}
                      />
                      <ScoreLine
                        match={match}
                        team={away}
                        side="away"
                        value={match.awayGoals}
                        increaseLabel={t('increase', { team: away.name })}
                        decreaseLabel={t('decrease', { team: away.name })}
                      />
                    </div>
                    {scorers !== '' ? (
                      <p className="text-muted-foreground mt-1.5 text-xs">⚽ {scorers}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground text-xs">{t('autosave')}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreLine({
  match,
  team,
  side,
  value,
  increaseLabel,
  decreaseLabel,
}: {
  match: QuickMatch;
  team: QuickTeam;
  side: 'home' | 'away';
  value: number;
  increaseLabel: string;
  decreaseLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: teamColorVar(team.colorId) }}
        aria-hidden
      />
      <span
        className="display min-w-0 flex-1 truncate text-base tracking-wide"
        style={{ color: teamColorVar(team.colorId) }}
      >
        {team.name}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        aria-label={decreaseLabel}
        disabled={value === 0}
        onClick={() => adjustMatchScore(match.id, side, -1)}
      >
        <Minus aria-hidden />
      </Button>
      <span className="display digits w-8 text-center text-2xl leading-none">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        aria-label={increaseLabel}
        onClick={() => adjustMatchScore(match.id, side, 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
