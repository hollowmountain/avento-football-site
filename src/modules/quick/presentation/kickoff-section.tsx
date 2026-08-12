'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { QuickTeam } from '../domain/types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { startMatch, type QuickDay } from './quick-day-store';
import { teamColorVar } from './team-colors';

/** Кто играет первым / следующий матч по очереди дня. */
export function KickoffSection({ day }: { day: QuickDay }) {
  const t = useTranslations('quick.kickoff');
  const tStandings = useTranslations('quick.standings');
  const [pairIndex, setPairIndex] = useState(0);

  const teamById = new Map(day.teams.map((team) => [team.id, team]));
  const hasPlayers = day.players.length >= 2;

  // Очередь уже идёт: пара следующего матча известна заранее
  const nextPair =
    day.rotation !== null
      ? ([
          teamById.get(day.rotation.playing[0]) ?? null,
          teamById.get(day.rotation.playing[1]) ?? null,
        ] as const)
      : null;

  const pairs: [QuickTeam, QuickTeam][] = [];
  for (let i = 0; i < day.teams.length; i += 1) {
    for (let j = i + 1; j < day.teams.length; j += 1) {
      const a = day.teams[i];
      const b = day.teams[j];
      if (a !== undefined && b !== undefined) pairs.push([a, b]);
    }
  }
  const chosen = pairs[Math.min(pairIndex, pairs.length - 1)];

  const begin = () => {
    if (nextPair !== null && nextPair[0] !== null && nextPair[1] !== null) {
      startMatch(nextPair[0].id, nextPair[1].id);
    } else if (chosen !== undefined) {
      startMatch(chosen[0].id, chosen[1].id);
    }
  };

  const resting =
    day.rotation !== null
      ? day.rotation.waiting
          .map((id) => teamById.get(id)?.name)
          .filter((name): name is string => name !== undefined)
          .join(', ')
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-xl tracking-wide">
          {nextPair !== null ? t('nextTitle') : t('chooseTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {nextPair !== null && nextPair[0] !== null && nextPair[1] !== null ? (
          <p className="display text-2xl tracking-wide">
            <TeamName team={nextPair[0]} />
            <span className="text-muted-foreground mx-2">—</span>
            <TeamName team={nextPair[1]} />
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('chooseTitle')}>
            {pairs.map((pair, index) => (
              <button
                key={`${pair[0].id}-${pair[1].id}`}
                type="button"
                aria-pressed={index === Math.min(pairIndex, pairs.length - 1)}
                onClick={() => setPairIndex(index)}
                className={`focus-visible:ring-ring rounded-md border px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  index === Math.min(pairIndex, pairs.length - 1)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <span className="display text-base tracking-wide">
                  <TeamName team={pair[0]} />
                  <span className="text-muted-foreground mx-1.5">—</span>
                  <TeamName team={pair[1]} />
                </span>
              </button>
            ))}
          </div>
        )}

        {resting !== null && resting !== '' ? (
          <p className="text-muted-foreground text-sm">{t('rest', { team: resting })}</p>
        ) : null}
        {day.teams.length === 3 ? (
          <p className="text-muted-foreground text-xs">
            {t('autoSub')}. {tStandings('drawRule')}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="display self-start text-base tracking-wide"
            disabled={!hasPlayers}
            onClick={begin}
          >
            {t('start')}
          </Button>
          {!hasPlayers ? <p className="text-muted-foreground text-xs">{t('needPlayers')}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamName({ team }: { team: QuickTeam }) {
  return <span style={{ color: teamColorVar(team.colorId) }}>{team.name}</span>;
}
